var fs = require('fs');
var path = require('path');
var COS = require('../index');
var util = require('./util');
var config = require('./config');



var cos = new COS({
    // 必选参数
    SecretId: config.SecretId,
    SecretKey: config.SecretKey,
    // 可选参数
    FileParallelLimit: 3,    // 控制文件上传并发数
    ChunkParallelLimit: 8,   // 控制单个文件下分片上传并发数，在同园区上传可以设置较大的并发数
    ChunkSize: 1024 * 1024,  // 控制分片大小，单位 B，在同园区上传可以设置较大的分片大小
});
var TaskId;

function getService() {
    cos.getService(function (err, data) {
        console.log(err || data);
    });
}

function getAuth() {
    var key = '1mb.zip';
    var auth = cos.getAuth({
        Method: 'get',
        Key: key,
        Expires: 60,
    });
    // 注意：这里的 Bucket 格式是 test-1250000000
    console.log('http://' + config.Bucket + '.cos.' + config.Region + '.myqcloud.com' + '/' + encodeURIComponent(key) + '?sign=' + encodeURIComponent(auth));
}

function getV4Auth() {
    console.log();
    var key = '中文.txt';
    var auth = cos.getV4Auth({
        Bucket: config.Bucket,
        Key: key,
        Expires: 60,
    });
    // 注意：这里的 Bucket 格式是 test-1250000000
    console.log('http://' + config.Bucket + '.cos.' + config.Region + '.myqcloud.com' + '/' + encodeURIComponent(key) + '?sign=' + encodeURIComponent(auth));
}

function getObjectUrl() {
    var url = cos.getObjectUrl({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.zip',
        Expires: 60,
        Sign: true,
    }, function (err, data) {
        console.log(err || data);
    });
    console.log(url);
}

function putBucket() {
    cos.putBucket({
        Bucket: 'testnew-' + config.Bucket.substr(config.Bucket.lastIndexOf('-') + 1),
        Region: 'ap-guangzhou'
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucket() {
    cos.getBucket({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function headBucket() {
    cos.headBucket({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function putBucketAcl() {
    cos.putBucketAcl({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        // GrantFullControl: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // GrantWrite: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // GrantRead: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // GrantReadAcp: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // GrantWriteAcp: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // ACL: 'public-read-write',
        // ACL: 'public-read',
        ACL: 'private',
        // AccessControlPolicy: {
        // "Owner": { // AccessControlPolicy 里必须有 owner
        //     "ID": 'qcs::cam::uin/459000000:uin/459000000' // 459000000 是 Bucket 所属用户的 QQ 号
        // },
        // "Grants": [{
        //     "Grantee": {
        //         "ID": "qcs::cam::uin/1001:uin/1001", // 10002 是 QQ 号
        //         "DisplayName": "qcs::cam::uin/1001:uin/1001" // 10002 是 QQ 号
        //     },
        //     "Permission": "READ"
        // }, {
        //     "Grantee": {
        //         "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
        //     },
        //     "Permission": "WRITE"
        // }, {
        //     "Grantee": {
        //         "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
        //     },
        //     "Permission": "READ_ACP"
        // }, {
        //     "Grantee": {
        //         "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
        //     },
        //     "Permission": "WRITE_ACP"
        // }]
        // }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketAcl() {
    cos.getBucketAcl({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function putBucketCors() {
    cos.putBucketCors({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        CORSConfiguration: {
            "CORSRules": [{
                "AllowedOrigin": ["*"],
                "AllowedMethod": ["GET", "POST", "PUT", "DELETE", "HEAD"],
                "AllowedHeader": ["*"],
                "ExposeHeader": ["ETag", "x-cos-acl", "x-cos-version-id", "x-cos-delete-marker", "x-cos-server-side-encryption"],
                "MaxAgeSeconds": "5"
            }]
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketCors() {
    cos.getBucketCors({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteBucketCors() {
    cos.deleteBucketCors({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function putBucketTagging() {
    cos.putBucketTagging({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Tagging: {
            "Tags": [
                {"Key": "k1", "Value": "v1"},
                {"Key": "k2", "Value": "v2"}
            ]
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketTagging() {
    cos.getBucketTagging({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteBucketTagging() {
    cos.deleteBucketTagging({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function putBucketPolicy() {
    var AppId = config.Bucket.substr(config.Bucket.lastIndexOf('-') + 1);
    cos.putBucketPolicy({
        Policy: {
            "version": "2.0",
            "principal": {"qcs": ["qcs::cam::uin/10001:uin/10001"]}, // 这里的 10001 是 QQ 号
            "statement": [
                {
                    "effect": "allow",
                    "action": [
                        // 这里可以从临时密钥的权限上控制前端允许的操作
                        // 'name/cos:*', // 这样写可以包含下面所有权限

                        // // 列出所有允许的操作
                        // // ACL 读写
                        // 'name/cos:GetBucketACL',
                        // 'name/cos:PutBucketACL',
                        // 'name/cos:GetObjectACL',
                        // 'name/cos:PutObjectACL',
                        // // 简单 Bucket 操作
                        // 'name/cos:PutBucket',
                        // 'name/cos:HeadBucket',
                        // 'name/cos:GetBucket',
                        // 'name/cos:DeleteBucket',
                        // 'name/cos:GetBucketLocation',
                        // // Versioning
                        // 'name/cos:PutBucketVersioning',
                        // 'name/cos:GetBucketVersioning',
                        // // CORS
                        // 'name/cos:PutBucketCORS',
                        // 'name/cos:GetBucketCORS',
                        // 'name/cos:DeleteBucketCORS',
                        // // Lifecycle
                        // 'name/cos:PutBucketLifecycle',
                        // 'name/cos:GetBucketLifecycle',
                        // 'name/cos:DeleteBucketLifecycle',
                        // // Replication
                        // 'name/cos:PutBucketReplication',
                        // 'name/cos:GetBucketReplication',
                        // 'name/cos:DeleteBucketReplication',
                        // // 删除文件
                        // 'name/cos:DeleteMultipleObject',
                        // 'name/cos:DeleteObject',
                        // 简单文件操作
                        'name/cos:PutObject',
                        'name/cos:AppendObject',
                        'name/cos:GetObject',
                        'name/cos:HeadObject',
                        'name/cos:OptionsObject',
                        'name/cos:PutObjectCopy',
                        'name/cos:PostObjectRestore',
                        // 分片上传操作
                        'name/cos:InitiateMultipartUpload',
                        'name/cos:ListMultipartUploads',
                        'name/cos:ListParts',
                        'name/cos:UploadPart',
                        'name/cos:CompleteMultipartUpload',
                        'name/cos:AbortMultipartUpload',
                    ],
                    // "resource": ["qcs::cos:ap-guangzhou:uid/1250000000:test-1250000000/*"] // 1250000000 是 appid
                    "resource": ["qcs::cos:" + config.Region + ":uid/" + AppId + ":" + config.Bucket + "/*"] // 1250000000 是 appid
                }
            ]
        },
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketPolicy() {
    cos.getBucketPolicy({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketLocation() {
    cos.getBucketLocation({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function putBucketLifecycle() {
    cos.putBucketLifecycle({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        LifecycleConfiguration: {
            "Rules": [{
                'ID': 1,
                'Filter': {
                    'Prefix': 'cas',
                },
                'Status': 'Enabled',
                'Transition': {
                    'Days': 0,
                    'StorageClass': 'ARCHIVE'
                }
            }]
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketLifecycle() {
    cos.getBucketLifecycle({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteBucketLifecycle() {
    cos.deleteBucketLifecycle({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function putBucketVersioning() {
    cos.putBucketVersioning({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        VersioningConfiguration: {
            MFADelete: "Enabled",
            Status: "Enabled"
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketVersioning() {
    cos.getBucketVersioning({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function listObjectVersions() {
    cos.listObjectVersions({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Prefix: "1mb.zip"
    }, function (err, data) {
        console.log(err || JSON.stringify(data, null, '    '));
    });
}

function putBucketReplication() {
    var AppId = config.Bucket.substr(config.Bucket.lastIndexOf('-') + 1);
    cos.putBucketReplication({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        ReplicationConfiguration: {
            Role: "qcs::cam::uin/459000000:uin/459000000",
            Rules: [{
                ID: "1",
                Status: "Enabled",
                Prefix: "img/",
                Destination: {
                    Bucket: "qcs::cos:ap-guangzhou::test-" + AppId
                },
            }]
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getBucketReplication() {
    cos.getBucketReplication({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteBucketReplication() {
    cos.deleteBucketReplication({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteBucket() {
    cos.deleteBucket({
        Bucket: 'testnew-' + config.Bucket.substr(config.Bucket.lastIndexOf('-') + 1),
        Region: 'ap-guangzhou'
    }, function (err, data) {
        console.log(err || data);
    });
}

function putObject() {
    // 创建测试文件
    var filename = '1mb.zip';
    var filepath = path.resolve(__dirname, filename);
    util.createFile(filepath, 1024 * 1024, function (err) {
        // 调用方法
        cos.putObject({
            Bucket: config.Bucket, /* 必须 */ // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: filename, /* 必须 */
            TaskReady: function (tid) {
                TaskId = tid;
            },
            onProgress: function (progressData) {
                console.log(JSON.stringify(progressData));
            },
            // 格式1. 传入文件内容
            // Body: fs.readFileSync(filepath),
            // 格式2. 传入文件流，必须需要传文件大小
            Body: fs.createReadStream(filepath),
            ContentLength: fs.statSync(filepath).size
        }, function (err, data) {
            console.log(err || data);
            fs.unlinkSync(filepath);
        });
    });
}

function putObjectCopy() {
    cos.putObjectCopy({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.copy.zip',
        CopySource: config.Bucket + '.cos.' + config.Region + '.myqcloud.com/1mb.zip', // Bucket 格式：test-1250000000
    }, function (err, data) {
        console.log(err || data);
    });
}

function getObject() {
    var filepath1 = path.resolve(__dirname, '1mb.out1.zip');
    var filepath2 = path.resolve(__dirname, '1mb.out2.zip');
    var filepath3 = path.resolve(__dirname, '1mb.out3.zip');
    // cos.getObject({
    //     Bucket: config.Bucket, // Bucket 格式：test-1250000000
    //     Region: config.Region,
    //     Key: '1mb.zip',
    //     onProgress: function (progressData) {
    //         console.log(JSON.stringify(progressData));
    //     }
    // }, function (err, data) {
    //     fs.writeFileSync(filepath1, data.Body);
    // });
    // cos.getObject({
    //     Bucket: config.Bucket, // Bucket 格式：test-1250000000
    //     Region: config.Region,
    //     Key: '1mb.zip',
    //     Output: fs.createWriteStream(filepath2),
    //     onProgress: function (progressData) {
    //         console.log(JSON.stringify(progressData));
    //     }
    // }, function (err, data) {
    //     console.log(err || data);
    // });
    cos.getObject({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.zip',
        Output: filepath3,
        onProgress: function (progressData) {
            console.log(JSON.stringify(progressData));
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function headObject() {
    cos.headObject({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.zip'
    }, function (err, data) {
        console.log(err || data);
    });
}

function putObjectAcl() {
    cos.putObjectAcl({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.zip',
        // GrantFullControl: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // GrantWrite: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // GrantRead: 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"',
        // ACL: 'public-read-write',
        // ACL: 'public-read',
        // ACL: 'private',
        ACL: 'default', // 继承上一级目录权限
        // AccessControlPolicy: {
        //     "Owner": { // AccessControlPolicy 里必须有 owner
        //         "ID": 'qcs::cam::uin/459000000:uin/459000000' // 459000000 是 Bucket 所属用户的 QQ 号
        //     },
        //     "Grants": [{
        //         "Grantee": {
        //             "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
        //         },
        //         "Permission": "READ"
        //     }]
        // }
    }, function (err, data) {
        console.log(err || data);
    });
}

function getObjectAcl() {
    cos.getObjectAcl({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.zip'
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteObject() {
    cos.deleteObject({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1mb.zip'
    }, function (err, data) {
        console.log(err || data);
    });
}

function deleteMultipleObject() {
    cos.deleteMultipleObject({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Objects: [
            {Key: '1mb.zip'},
            {Key: '3mb.zip'},
        ]
    }, function (err, data) {
        console.log(err || data);
    });
}

function restoreObject() {
    cos.restoreObject({
        Bucket: config.Bucket, // Bucket 格式：test-1250000000
        Region: config.Region,
        Key: '1.txt',
        RestoreRequest: {
            Days: 1,
            CASJobParameters: {
                Tier: 'Expedited'
            }
        }
    }, function (err, data) {
        console.log(err || data);
    });
}

function abortUploadTask() {
    cos.abortUploadTask({
        Bucket: config.Bucket, /* 必须 */ // Bucket 格式：test-1250000000
        Region: config.Region, /* 必须 */
        // 格式1，删除单个上传任务
        // Level: 'task',
        // Key: '10mb.zip',
        // UploadId: '14985543913e4e2642e31db217b9a1a3d9b3cd6cf62abfda23372c8d36ffa38585492681e3',
        // 格式2，删除单个文件所有未完成上传任务
        Level: 'file',
        Key: '10mb.zip',
        // 格式3，删除 Bucket 下所有未完成上传任务
        // Level: 'bucket',
    }, function (err, data) {
        console.log(err || data);
    });
}

function sliceUploadFile() {
    // 创建测试文件
    var filename = '10mb.zip';
    var filepath = path.resolve(__dirname, filename);
    util.createFile(filepath, 1024 * 1024 * 10, function (err) {
        // 调用方法
        cos.sliceUploadFile({
            Bucket: config.Bucket, /* 必须 */ // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: filename, /* 必须 */
            FilePath: filepath, /* 必须 */
            TaskReady: function (tid) {
                TaskId = tid;
            },
            onHashProgress: function (progressData) {
                console.log(JSON.stringify(progressData));
            },
            onProgress: function (progressData) {
                console.log(JSON.stringify(progressData));
            },
        }, function (err, data) {
            console.log(err || data);
            fs.unlinkSync(filepath);
        });
    });
}

function cancelTask() {
    cos.cancelTask(TaskId);
    console.log('canceled');
}

function pauseTask() {
    cos.pauseTask(TaskId);
    console.log('paused');
}

function restartTask() {
    cos.restartTask(TaskId);
    console.log('restart');
}

function uploadFiles() {
    var filepath = path.resolve(__dirname, '1mb.zip');
    util.createFile(filepath, 1024 * 1024 * 10, function (err) {
        var filename = 'mb.zip';
        cos.uploadFiles({
            files: [{
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: '1' + filename,
                FilePath: filepath,
            }, {
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: '2' + filename,
                FilePath: filepath,
            // }, {
            //     Bucket: config.Bucket, // Bucket 格式：test-1250000000
            //     Region: config.Region,
            //     Key: '3' + filename,
            //     FilePath: filepath,
            }],
            SliceSize: 1024 * 1024,
            onProgress: function (info) {
                var percent = parseInt(info.percent * 10000) / 100;
                var speed = parseInt(info.speed / 1024 / 1024 * 100) / 100;
                console.log('进度：' + percent + '%; 速度：' + speed + 'Mb/s;');
            },
            onFileFinish: function (err, data, options) {
                console.log(options.Key + ' 上传' + (err ? '失败' : '完成'));
            },
        }, function (err, data) {
            console.log(err || data);
            fs.unlinkSync(filepath);
        });
    });
}

getService();
// getAuth();
// getV4Auth();
// getObjectUrl();
// putBucket();
// getBucket();
// headBucket();
// putBucketAcl();
// getBucketAcl();
// putBucketCors();
// getBucketCors();
// deleteBucketCors();
// putBucketTagging();
// getBucketTagging();
// deleteBucketTagging();
// putBucketPolicy();
// getBucketPolicy();
// getBucketLocation();
// getBucketLifecycle();
// putBucketLifecycle();
// deleteBucketLifecycle();
// getBucketVersioning();
// listObjectVersions();
// putBucketVersioning();
// getBucketReplication();
// putBucketReplication();
// deleteBucketReplication();
// deleteBucket();
// putObject();
// putObjectCopy();
// getObject();
// headObject();
// putObjectAcl();
// getObjectAcl();
// deleteObject();
// deleteMultipleObject();
// restoreObject();
// abortUploadTask();
// sliceUploadFile();
// cancelTask();
// pauseTask();
// restartTask();
// uploadFiles();
