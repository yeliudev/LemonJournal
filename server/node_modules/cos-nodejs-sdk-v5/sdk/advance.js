var fs = require('fs');
var Async = require('./async');
var EventProxy = require('./event').EventProxy;
var util = require('./util');

// 文件分块上传全过程，暴露的分块上传接口
function sliceUploadFile(params, callback) {
    var ep = new EventProxy();
    var TaskId = params.TaskId;
    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var FilePath = params.FilePath;
    var ChunkSize = params.ChunkSize || params.SliceSize || this.options.ChunkSize;
    var AsyncLimit = params.AsyncLimit;
    var StorageClass = params.StorageClass || 'Standard';
    var ServerSideEncryption = params.ServerSideEncryption;
    var FileSize;
    var self = this;

    var onProgress;
    var onHashProgress = params.onHashProgress;

    // 上传过程中出现错误，返回错误
    ep.on('error', function (err) {
        if (!self._isRunningTask(TaskId)) return;
        return callback(err);
    });

    // 上传分块完成，开始 uploadSliceComplete 操作
    ep.on('upload_complete', function (UploadCompleteData) {
        callback(null, UploadCompleteData);
    });

    // 上传分块完成，开始 uploadSliceComplete 操作
    ep.on('upload_slice_complete', function (UploadData) {
        uploadSliceComplete.call(self, {
            Bucket: Bucket,
            Region: Region,
            Key: Key,
            UploadId: UploadData.UploadId,
            SliceList: UploadData.SliceList,
        }, function (err, data) {
            if (!self._isRunningTask(TaskId)) return;
            delete uploadIdUsing[UploadData.UploadId];
            if (err) {
                onProgress(null, true);
                return ep.emit('error', err);
            }
            onProgress({loaded: FileSize, total: FileSize}, true);
            removeUploadId.call(self, UploadData.UploadId);
            ep.emit('upload_complete', data);
        });
    });

    // 获取 UploadId 完成，开始上传每个分片
    ep.on('get_upload_data_finish', function (UploadData) {

        // 处理 UploadId 缓存
        var uuid = util.getFileUUID(params.FileStat, params.ChunkSize);
        uuid && setUploadId.call(self, uuid, UploadData.UploadId); // 缓存 UploadId
        uploadIdUsing[UploadData.UploadId] = true; // 标记 UploadId 为正在使用
        TaskId && self.on('inner-kill-task', function (data) {
            if (data.TaskId === TaskId && data.toState === 'canceled') {
                delete uploadIdUsing[UploadData.UploadId]; // 去除 UploadId 正在使用的标记
            }
        });

        // 获取 UploadId
        uploadSliceList.call(self, {
            TaskId: TaskId,
            Bucket: Bucket,
            Region: Region,
            Key: Key,
            FilePath: FilePath,
            FileSize: FileSize,
            SliceSize: ChunkSize,
            AsyncLimit: AsyncLimit,
            ServerSideEncryption: ServerSideEncryption,
            UploadData: UploadData,
            onProgress: onProgress
        }, function (err, data) {
            if (!self._isRunningTask(TaskId)) return;
            if (err) {
                onProgress(null, true);
                return ep.emit('error', err);
            }
            ep.emit('upload_slice_complete', data);
        });
    });

    // 开始获取文件 UploadId，里面会视情况计算 ETag，并比对，保证文件一致性，也优化上传
    ep.on('get_file_size_finish', function () {

        onProgress = util.throttleOnProgress.call(self, FileSize, params.onProgress);

        if (params.UploadData.UploadId) {
            ep.emit('get_upload_data_finish', params.UploadData);
        } else {
            var _params = util.extend({
                TaskId: TaskId,
                Bucket: Bucket,
                Region: Region,
                Key: Key,
                Headers: params.Headers,
                StorageClass: StorageClass,
                FilePath: FilePath,
                FileSize: FileSize,
                SliceSize: ChunkSize,
                onHashProgress: onHashProgress,
            }, params);
            getUploadIdAndPartList.call(self, _params, function (err, UploadData) {
                if (!self._isRunningTask(TaskId)) return;
                if (err) return ep.emit('error', err);
                params.UploadData.UploadId = UploadData.UploadId;
                params.UploadData.PartList = UploadData.PartList;
                ep.emit('get_upload_data_finish', params.UploadData);
            });
        }
    });

    // 获取上传文件大小
    FileSize = params.ContentLength;
    delete params.ContentLength;
    !params.Headers && (params.Headers = {});
    util.each(params.Headers, function (item, key) {
        if (key.toLowerCase() === 'content-length') {
            delete params.Headers[key];
        }
    });

    // 控制分片大小
    (function () {
        var SIZE = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 1024 * 2, 1024 * 4, 1024 * 5];
        var AutoChunkSize = 1024 * 1024;
        for (var i = 0; i < SIZE.length; i++) {
            AutoChunkSize = SIZE[i] * 1024 * 1024;
            if (FileSize / AutoChunkSize < 10000) break;
        }
        params.ChunkSize = params.SliceSize = ChunkSize = Math.max(ChunkSize, AutoChunkSize);
    })();

    // 开始上传
    if (FileSize === 0) {
        params.Body = '';
        self.putObject(params, callback);
    } else {
        ep.emit('get_file_size_finish');
    }

}


// 按照文件特征值，缓存 UploadId
var uploadIdCache;
var uploadIdUsing = {};
var uploadIdCacheKey = 'cos_sdk_upload_cache';
function initUploadId() {
    var cacheLimit = this.options.UploadIdCacheLimit;
    if (!uploadIdCache) {
        if (cacheLimit) {
            try {
                uploadIdCache = JSON.parse(util.localStorage.getItem(uploadIdCacheKey)) || [];
            } catch (e) {}
        }
        if (!uploadIdCache) {
            uploadIdCache = [];
        }
    }
}
function setUploadId(uuid, UploadId, isDisabled) {
    initUploadId.call(this);
    uuid = uuid || '';
    var part1 = uuid.substr(0, uuid.indexOf('-') + 1);
    for (var i = uploadIdCache.length - 1; i >= 0; i--) {
        var item = uploadIdCache[i];
        if (item[0] === uuid && item[1] === UploadId) {
            uploadIdCache.splice(i, 1);
        } else if (uuid !== item[0] && item[0].indexOf(part1) === 0) { // 文件路径相同，但其他信息不同，说明文件改变了，清理掉
            uploadIdCache.splice(i, 1);
        }
    }
    uploadIdCache.unshift([uuid, UploadId]);
    var cacheLimit = this.options.UploadIdCacheLimit;
    if (uploadIdCache.length > cacheLimit) {
        uploadIdCache.splice(cacheLimit);
    }
    cacheLimit && setTimeout(function () {
        try {
            util.localStorage.setItem(uploadIdCacheKey, JSON.stringify(uploadIdCache));
        } catch (e) {}
    });
}
function removeUploadId(UploadId) {
    initUploadId.call(this);
    delete uploadIdUsing[UploadId];
    for (var i = uploadIdCache.length - 1; i >= 0; i--) {
        if (uploadIdCache[i][1] === UploadId) {
            uploadIdCache.splice(i, 1)
        }
    }
    var cacheLimit = this.options.UploadIdCacheLimit;
    if (uploadIdCache.length > cacheLimit) {
        uploadIdCache.splice(cacheLimit);
    }
    cacheLimit && setTimeout(function () {
        try {
            if (uploadIdCache.length) {
                util.localStorage.setItem(uploadIdCacheKey, JSON.stringify(uploadIdCache));
            } else {
                util.localStorage.removeItem(uploadIdCacheKey);
            }
        } catch (e) {}
    });
}
function getUploadId(uuid) {
    initUploadId.call(this);
    var CacheUploadIdList = [];
    for (var i = 0; i < uploadIdCache.length; i++) {
        if (uploadIdCache[i][0] === uuid) {
            CacheUploadIdList.push(uploadIdCache[i][1]);
        }
    }
    return CacheUploadIdList.length ? CacheUploadIdList : null;
}

// 获取上传任务的 UploadId
function getUploadIdAndPartList(params, callback) {
    var TaskId = params.TaskId;
    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var StorageClass = params.StorageClass;
    var self = this;

    // 计算 ETag
    var ETagMap = {};
    var FileSize = params.FileSize;
    var SliceSize = params.SliceSize;
    var SliceCount = Math.ceil(FileSize / SliceSize);
    var FinishSliceCount = 0;
    var FinishSize = 0;
    var onHashProgress = util.throttleOnProgress.call(self, FileSize, params.onHashProgress);
    var getChunkETag = function (PartNumber, callback) {
        var start = SliceSize * (PartNumber - 1);
        var end = Math.min(start + SliceSize, FileSize);
        var ChunkSize = end - start;

        if (ETagMap[PartNumber]) {
            callback(null, {
                PartNumber: PartNumber,
                ETag: ETagMap[PartNumber],
                Size: ChunkSize
            });
        } else {
            var chunkItem = util.fileSlice(params.FilePath, start, end);
            util.getFileMd5(chunkItem, function (err, md5) {
                if (err) return callback(err);
                var ETag = '"' + md5 + '"';
                ETagMap[PartNumber] = ETag;
                FinishSliceCount += 1;
                FinishSize += ChunkSize;
                callback(err, {
                    PartNumber: PartNumber,
                    ETag: ETag,
                    Size: ChunkSize
                });
                onHashProgress({loaded: FinishSize, total: FileSize});
            });
        }
    };

    // 通过和文件的 md5 对比，判断 UploadId 是否可用
    var isAvailableUploadList = function (PartList, callback) {
        var PartCount = PartList.length;
        // 如果没有分片，通过
        if (PartCount === 0) {
            return callback(null, true);
        }
        // 检查分片数量
        if (PartCount > SliceCount) {
            return callback(null, false);
        }
        // 检查分片大小
        if (PartCount > 1) {
            var PartSliceSize = Math.max(PartList[0].Size, PartList[1].Size);
            if (PartSliceSize !== SliceSize) {
                return callback(null, false);
            }
        }
        // 逐个分片计算并检查 ETag 是否一致
        var next = function (index) {
            if (index < PartCount) {
                var Part = PartList[index];
                getChunkETag(Part.PartNumber, function (err, chunk) {
                    if (chunk && chunk.ETag === Part.ETag && chunk.Size === Part.Size) {
                        next(index + 1);
                    } else {
                        callback(null, false);
                    }
                });
            } else {
                callback(null, true);
            }
        };
        next(0);
    };

    var ep = new EventProxy();
    ep.on('error', function (errData) {
        if (!self._isRunningTask(TaskId)) return;
        return callback(errData);
    });

    // 存在 UploadId
    ep.on('upload_id_ready', function (UploadData) {
        // 转换成 map
        var map = {};
        var list = [];
        util.each(UploadData.PartList, function (item) {
            map[item.PartNumber] = item;
        });
        for (var PartNumber = 1; PartNumber <= SliceCount; PartNumber++) {
            var item = map[PartNumber];
            if (item) {
                item.PartNumber = PartNumber;
                item.Uploaded = true;
            } else {
                item = {
                    PartNumber: PartNumber,
                    ETag: null,
                    Uploaded: false
                };
            }
            list.push(item);
        }
        UploadData.PartList = list;
        callback(null, UploadData);
    });

    // 不存在 UploadId, 初始化生成 UploadId
    ep.on('no_available_upload_id', function () {
        if (!self._isRunningTask(TaskId)) return;
        var _params = util.extend({
            Bucket: Bucket,
            Region: Region,
            Key: Key,
            Headers: params.Headers,
            StorageClass: StorageClass,
        }, params);
        self.multipartInit(_params, function (err, data) {
            if (!self._isRunningTask(TaskId)) return;
            if (err) return ep.emit('error', err);
            var UploadId = data.UploadId;
            if (!UploadId) {
                return callback({Message: 'no upload id'});
            }
            ep.emit('upload_id_ready', {UploadId: UploadId, PartList: []});
        });
    });

    // 如果已存在 UploadId，找一个可以用的 UploadId
    ep.on('has_upload_id', function (UploadIdList) {
        // 串行地，找一个内容一致的 UploadId
        UploadIdList = UploadIdList.reverse();
        Async.eachLimit(UploadIdList, 1, function (UploadId, asyncCallback) {
            if (!self._isRunningTask(TaskId)) return;
            // 如果正在上传，跳过
            if (uploadIdUsing[UploadId]) {
                asyncCallback(); // 检查下一个 UploadId
                return;
            }
            // 判断 UploadId 是否可用
            wholeMultipartListPart.call(self, {
                Bucket: Bucket,
                Region: Region,
                Key: Key,
                UploadId: UploadId,
            }, function (err, PartListData) {
                if (!self._isRunningTask(TaskId)) return;
                if (err) {
                    removeUploadId.call(self, UploadId);
                    return ep.emit('error', err);
                }
                var PartList = PartListData.PartList;
                PartList.forEach(function (item) {
                    item.PartNumber *= 1;
                    item.Size *= 1;
                    item.ETag = item.ETag || '';
                });
                isAvailableUploadList(PartList, function (err, isAvailable) {
                    if (!self._isRunningTask(TaskId)) return;
                    if (err) return ep.emit('error', err);
                    if (isAvailable) {
                        asyncCallback({
                            UploadId: UploadId,
                            PartList: PartList
                        }); // 马上结束
                    } else {
                        asyncCallback(); // 检查下一个 UploadId
                    }
                });
            });
        }, function (AvailableUploadData) {
            if (!self._isRunningTask(TaskId)) return;
            onHashProgress(null, true);
            if (AvailableUploadData && AvailableUploadData.UploadId) {
                ep.emit('upload_id_ready', AvailableUploadData);
            } else {
                ep.emit('no_available_upload_id');
            }
        });
    });

    // 在本地缓存找可用的 UploadId
    ep.on('seek_local_avail_upload_id', function (RemoteUploadIdList) {
        // 在本地找可用的 UploadId
        var uuid = util.getFileUUID(params.FileStat, params.ChunkSize), LocalUploadIdList;
        if (uuid && (LocalUploadIdList = getUploadId.call(self, uuid))) {
            var next = function (index) {
                // 如果本地找不到可用 UploadId，再一个个遍历校验远端
                if (index >= LocalUploadIdList.length) {
                    ep.emit('has_upload_id', RemoteUploadIdList);
                    return;
                }
                var UploadId = LocalUploadIdList[index];
                // 如果不在远端 UploadId 列表里，跳过并删除
                if (!util.isInArray(RemoteUploadIdList, UploadId)) {
                    removeUploadId.call(self, UploadId);
                    next(index + 1);
                    return;
                }
                // 如果正在上传，跳过
                if (uploadIdUsing[UploadId]) {
                    next(index + 1);
                    return;
                }
                // 判断 UploadId 是否存在线上
                wholeMultipartListPart.call(self, {
                    Bucket: Bucket,
                    Region: Region,
                    Key: Key,
                    UploadId: UploadId,
                }, function (err, PartListData) {
                    if (!self._isRunningTask(TaskId)) return;
                    if (err) {
                        removeUploadId.call(self, UploadId);
                        next(index + 1);
                    } else {
                        // 找到可用 UploadId
                        ep.emit('upload_id_ready', {
                            UploadId: UploadId,
                            PartList: PartListData.PartList,
                        });
                    }
                });
            };
            next(0);
        } else {
            ep.emit('has_upload_id', RemoteUploadIdList);
        }
    });

    // 获取线上 UploadId 列表
    ep.on('get_remote_upload_id_list', function (RemoteUploadIdList) {
        // 获取符合条件的 UploadId 列表，因为同一个文件可以有多个上传任务。
        wholeMultipartList.call(self, {
            Bucket: Bucket,
            Region: Region,
            Key: Key,
        }, function (err, data) {
            if (!self._isRunningTask(TaskId)) return;
            if (err) {
                return ep.emit('error', err);
            }
            // 整理远端 UploadId 列表
            var RemoteUploadIdList = util.filter(data.UploadList, function (item) {
                return item.Key === Key && (!StorageClass || item.StorageClass.toUpperCase() === StorageClass.toUpperCase());
            }).reverse().map(function (item) {
                return item.UploadId || item.UploadID;
            });
            if (RemoteUploadIdList.length) {
                ep.emit('seek_local_avail_upload_id', RemoteUploadIdList);
            } else {
                var uuid = util.getFileUUID(params.FileStat, params.ChunkSize), LocalUploadIdList;
                if (uuid && (LocalUploadIdList = getUploadId.call(self, uuid))) {
                    util.each(LocalUploadIdList, function (UploadId) {
                        removeUploadId.call(self, UploadId);
                    });
                }
                ep.emit('no_available_upload_id');
            }
        });
    });

    // 开始找可用 UploadId
    ep.emit('get_remote_upload_id_list');

}

// 获取符合条件的全部上传任务 (条件包括 Bucket, Region, Prefix)
function wholeMultipartList(params, callback) {
    var self = this;
    var UploadList = [];
    var sendParams = {
        Bucket: params.Bucket,
        Region: params.Region,
        Prefix: params.Key
    };
    var next = function () {
        self.multipartList(sendParams, function (err, data) {
            if (err) return callback(err);
            UploadList.push.apply(UploadList, data.Upload || []);
            if (data.IsTruncated == 'true') { // 列表不完整
                sendParams.KeyMarker = data.NextKeyMarker;
                sendParams.UploadIdMarker = data.NextUploadIdMarker;
                next();
            } else {
                callback(null, {UploadList: UploadList});
            }
        });
    };
    next();
}

// 获取指定上传任务的分块列表
function wholeMultipartListPart(params, callback) {
    var self = this;
    var PartList = [];
    var sendParams = {
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        UploadId: params.UploadId
    };
    var next = function () {
        self.multipartListPart(sendParams, function (err, data) {
            if (err) return callback(err);
            PartList.push.apply(PartList, data.Part || []);
            if (data.IsTruncated == 'true') { // 列表不完整
                sendParams.PartNumberMarker = data.NextPartNumberMarker;
                next();
            } else {
                callback(null, {PartList: PartList});
            }
        });
    };
    next();
}

// 上传文件分块，包括
/*
 UploadId (上传任务编号)
 AsyncLimit (并发量)，
 SliceList (上传的分块数组)，
 FilePath (本地文件的位置)，
 SliceSize (文件分块大小)
 FileSize (文件大小)
 onProgress (上传成功之后的回调函数)
 */
function uploadSliceList(params, cb) {
    var self = this;
    var TaskId = params.TaskId;
    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var UploadData = params.UploadData;
    var FileSize = params.FileSize;
    var SliceSize = params.SliceSize;
    var ChunkParallel = Math.min(params.AsyncLimit || self.options.ChunkParallelLimit || 1, 256);
    var FilePath = params.FilePath;
    var SliceCount = Math.ceil(FileSize / SliceSize);
    var FinishSize = 0;
    var ServerSideEncryption = params.ServerSideEncryption;
    var needUploadSlices = util.filter(UploadData.PartList, function (SliceItem) {
        if (SliceItem['Uploaded']) {
            FinishSize += SliceItem['PartNumber'] >= SliceCount ? (FileSize % SliceSize || SliceSize) : SliceSize;
        }
        return !SliceItem['Uploaded'];
    });
    var onProgress = params.onProgress;

    Async.eachLimit(needUploadSlices, ChunkParallel, function (SliceItem, asyncCallback) {
        if (!self._isRunningTask(TaskId)) return;
        var PartNumber = SliceItem['PartNumber'];
        var currentSize = Math.min(FileSize, SliceItem['PartNumber'] * SliceSize) - (SliceItem['PartNumber'] - 1) * SliceSize;
        var preAddSize = 0;
        uploadSliceItem.call(self, {
            TaskId: TaskId,
            Bucket: Bucket,
            Region: Region,
            Key: Key,
            SliceSize: SliceSize,
            FileSize: FileSize,
            PartNumber: PartNumber,
            ServerSideEncryption: ServerSideEncryption,
            FilePath: FilePath,
            UploadData: UploadData,
            onProgress: function (data) {
                FinishSize += data.loaded - preAddSize;
                preAddSize = data.loaded;
                onProgress({loaded: FinishSize, total: FileSize});
            },
        }, function (err, data) {
            if (!self._isRunningTask(TaskId)) return;
            if (util.isBrowser && !err && !data.ETag) {
                err = 'get ETag error, please add "ETag" to CORS ExposeHeader setting.';
            }
            if (err) {
                FinishSize -= preAddSize;
            } else {
                FinishSize += currentSize - preAddSize;
                SliceItem.ETag = data.ETag;
            }
            asyncCallback(err || null, data);
        });

    }, function (err) {
        if (!self._isRunningTask(TaskId)) return;
        if (err)  return cb(err);
        cb(null, {
            UploadId: UploadData.UploadId,
            SliceList: UploadData.PartList
        });
    });
}

// 上传指定分片
function uploadSliceItem(params, callback) {
    var TaskId = params.TaskId;
    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var FileSize = params.FileSize;
    var FilePath = params.FilePath;
    var PartNumber = params.PartNumber * 1;
    var SliceSize = params.SliceSize;
    var ServerSideEncryption = params.ServerSideEncryption;
    var UploadData = params.UploadData;
    var sliceRetryTimes = 3;
    var self = this;

    var start = SliceSize * (PartNumber - 1);

    var ContentLength = SliceSize;

    var end = start + SliceSize;

    if (end > FileSize) {
        end = FileSize;
        ContentLength = end - start;
    }

    var Body = util.fileSlice(FilePath, start, end);
    var PartItem = UploadData.PartList[PartNumber - 1];
    var ContentSha1 = PartItem.ETag;
    Async.retry(sliceRetryTimes, function (tryCallback) {
        if (!self._isRunningTask(TaskId)) return;
        self.multipartUpload({
            TaskId: TaskId,
            Bucket: Bucket,
            Region: Region,
            Key: Key,
            ContentLength: ContentLength,
            ContentSha1: ContentSha1,
            PartNumber: PartNumber,
            UploadId: UploadData.UploadId,
            ServerSideEncryption: ServerSideEncryption,
            Body: Body,
            onProgress: params.onProgress
        }, function (err, data) {
            if (!self._isRunningTask(TaskId)) return;
            if (err) {
                return tryCallback(err);
            } else {
                PartItem.Uploaded = true;
                return tryCallback(null, data);
            }
        });
    }, function (err, data) {
        if (!self._isRunningTask(TaskId)) return;
        return callback(err, data);
    });
}


// 完成分块上传
function uploadSliceComplete(params, callback) {
    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var UploadId = params.UploadId;
    var SliceList = params.SliceList;
    var self = this;
    var Parts = SliceList.map(function (item) {
        return {
            PartNumber: item.PartNumber,
            ETag: item.ETag
        };
    });

    self.multipartComplete({
        Bucket: Bucket,
        Region: Region,
        Key: Key,
        UploadId: UploadId,
        Parts: Parts
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, data);
    });
}

// 抛弃分块上传任务
/*
 AsyncLimit (抛弃上传任务的并发量)，
 UploadId (上传任务的编号，当 Level 为 task 时候需要)
 Level (抛弃分块上传任务的级别，task : 抛弃指定的上传任务，file ： 抛弃指定的文件对应的上传任务，其他值 ：抛弃指定Bucket 的全部上传任务)
 */
function abortUploadTask(params, callback) {
    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var UploadId = params.UploadId;
    var Level = params.Level || 'task';
    var AsyncLimit = params.AsyncLimit;
    var self = this;

    var ep = new EventProxy();

    ep.on('error', function (errData) {
        return callback(errData);
    });

    // 已经获取到需要抛弃的任务列表
    ep.on('get_abort_array', function (AbortArray) {
        abortUploadTaskArray.call(self, {
            Bucket: Bucket,
            Region: Region,
            Key: Key,
            Headers: params.Headers,
            AsyncLimit: AsyncLimit,
            AbortArray: AbortArray
        }, function (err, data) {
            if (err) {
                return callback(err);
            }
            callback(null, data);
        });
    });

    if (Level === 'bucket') {
        // Bucket 级别的任务抛弃，抛弃该 Bucket 下的全部上传任务
        wholeMultipartList.call(self, {
            Bucket: Bucket,
            Region: Region
        }, function (err, data) {
            if (err) {
                return callback(err);
            }
            ep.emit('get_abort_array', data.UploadList || []);
        });
    } else if (Level === 'file') {
        // 文件级别的任务抛弃，抛弃该文件的全部上传任务
        if (!Key) return callback({error: 'abort_upload_task_no_key'});
        wholeMultipartList.call(self, {
            Bucket: Bucket,
            Region: Region,
            Key: Key
        }, function (err, data) {
            if (err) {
                return callback(err);
            }
            ep.emit('get_abort_array', data.UploadList || []);
        });
    } else if (Level === 'task') {
        // 单个任务级别的任务抛弃，抛弃指定 UploadId 的上传任务
        if (!UploadId) return callback({error: 'abort_upload_task_no_id'});
        if (!Key) return callback({error: 'abort_upload_task_no_key'});
        ep.emit('get_abort_array', [{
            Key: Key,
            UploadId: UploadId
        }]);
    } else {
        return callback({error: 'abort_unknown_level'});
    }
}

// 批量抛弃分块上传任务
function abortUploadTaskArray(params, callback) {

    var Bucket = params.Bucket;
    var Region = params.Region;
    var Key = params.Key;
    var AbortArray = params.AbortArray;
    var AsyncLimit = params.AsyncLimit || 1;
    var self = this;

    var index = 0;
    var resultList = new Array(AbortArray.length);
    Async.eachLimit(AbortArray, AsyncLimit, function (AbortItem, callback) {
        var eachIndex = index;
        if (Key && Key != AbortItem.Key) {
            return callback(null, {
                KeyNotMatch: true
            });
        }
        var UploadId = AbortItem.UploadId || AbortItem.UploadID;

        self.multipartAbort({
            Bucket: Bucket,
            Region: Region,
            Key: AbortItem.Key,
            Headers: params.Headers,
            UploadId: UploadId
        }, function (err, data) {
            var task = {
                Bucket: Bucket,
                Region: Region,
                Key: AbortItem.Key,
                UploadId: UploadId
            };
            resultList[eachIndex] = {error: err, task: task};
            callback(null);
        });
        index++;

    }, function (err) {
        if (err) {
            return callback(err);
        }

        var successList = [];
        var errorList = [];

        for (var i = 0, len = resultList.length; i < len; i++) {
            var item = resultList[i];
            if (item['task']) {
                if (item['error']) {
                    errorList.push(item['task']);
                } else {
                    successList.push(item['task']);
                }
            }
        }

        return callback(null, {
            successList: successList,
            errorList: errorList
        });
    });
}


// 批量上传文件
function uploadFiles(params, callback) {
    var self = this;

    // 判断多大的文件使用分片上传
    var SliceSize = params.SliceSize === undefined ? self.options.SliceSize : params.SliceSize;

    // 汇总返回进度
    var TotalSize = 0;
    var TotalFinish = 0;
    var onTotalProgress = util.throttleOnProgress.call(self, TotalFinish, params.onProgress);

    // 汇总返回回调
    var unFinishCount = params.files.length;
    var _onTotalFileFinish = params.onFileFinish;
    var resultList = Array(unFinishCount);
    var onTotalFileFinish = function (err, data, options) {
        onTotalProgress(null, true);
        _onTotalFileFinish && _onTotalFileFinish(err, data, options);
        resultList[options.Index] = {
            options: options,
            error: err,
            data: data
        };
        if (--unFinishCount <= 0 && callback) {
            callback(null, {
                files: resultList,
            });
        }
    };

    // 开始处理每个文件
    var taskList = [];
    var count = params.files.length;
    util.each(params.files, function (fileParams, index) {
        fs.stat(fileParams.FilePath, function (err, stat) {

            var FileSize = fileParams.ContentLength = stat.size || 0;
            var fileInfo = {Index: index, TaskId: ''};

            // 更新文件总大小
            TotalSize += FileSize;

            // 整理 option，用于返回给回调
            util.each(fileParams, function (v, k) {
                if (typeof v !== 'object' && typeof v !== 'function') {
                    fileInfo[k] = v;
                }
            });

            // 处理单个文件 TaskReady
            var _TaskReady = fileParams.TaskReady;
            var TaskReady = function (tid) {
                fileInfo.TaskId = tid;
                _TaskReady && _TaskReady(tid);
            };
            fileParams.TaskReady = TaskReady;

            // 处理单个文件进度
            var PreAddSize = 0;
            var _onProgress = fileParams.onProgress;
            var onProgress = function (info) {
                TotalFinish = TotalFinish - PreAddSize + info.loaded;
                PreAddSize = info.loaded;
                _onProgress && _onProgress(info);
                onTotalProgress({loaded: TotalFinish, total: TotalSize});
            };
            fileParams.onProgress = onProgress;

            // 处理单个文件完成
            var _onFileFinish = fileParams.onFileFinish;
            var onFileFinish = function (err, data) {
                _onFileFinish && _onFileFinish(err, data);
                onTotalFileFinish && onTotalFileFinish(err, data, fileInfo);
            };

            // 添加上传任务
            var api = FileSize >= SliceSize ? 'sliceUploadFile' : 'putObject';
            api === 'putObject' && (fileParams.Body = fs.createReadStream(fileParams.FilePath));
            taskList.push({
                api: api,
                params: fileParams,
                callback: onFileFinish,
            });
            --count === 0 && self._addTasks(taskList);
        });
    });
}


var API_MAP = {
    sliceUploadFile: sliceUploadFile,
    abortUploadTask: abortUploadTask,
    uploadFiles: uploadFiles,
};

util.each(API_MAP, function (fn, apiName) {
    exports[apiName] = util.apiWrapper(apiName, fn);
});
