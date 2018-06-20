var fs = require('fs');
var path = require('path');
var COS = require('../index');
var request = require('request');
var util = require('../demo/util');
var config = require('../demo/config');
var Writable = require('stream').Writable;

if (process.env.AppId) {
    config = {
        SecretId: process.env.SecretId,
        SecretKey: process.env.SecretKey,
        Bucket: process.env.Bucket, // Bucket 格式：test-1250000000
        Region: process.env.Region
    }
}

var cos = new COS({
    SecretId: config.SecretId,
    SecretKey: config.SecretKey
});

var AppId = config.AppId;
var Bucket = config.Bucket;
var BucketShortName = Bucket;
var BucketLongName = Bucket + '-' + AppId;

var match = config.Bucket.match(/^(.+)-(\d+)$/);
if (match) {
    BucketLongName = config.Bucket; // Bucket 格式：test-1250000000
    BucketShortName = match[1];
    AppId = match[2];
}

var assert = require("assert");
assert.ok = assert;

function prepareBucket() {
    return new Promise(function (resolve, reject) {
        cos.putBucket({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region
        }, function (err, data) {
            resolve();
        });
    });
}

function prepareBigObject() {
    return new Promise(function (resolve, reject) {
        // 创建测试文件
        var filename = 'big.zip';
        var filepath = path.resolve(__dirname, filename);
        var put = function () {
            // 调用方法
            cos.putObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename,
                Body: fs.createReadStream(filepath),
                ContentLength: fs.statSync(filepath).size,
            }, function (err, data) {
                err ? reject(err) : resolve()
            });
        };
        if (fs.existsSync(filepath)) {
            put();
        } else {
            util.createFile(filepath, 1024 * 1024 * 10, put);
        }
    });
}

function comparePlainObject(a, b) {
    if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
    }
    for (var key in a) {
        if (typeof a[key] === 'object' && typeof b[key] === 'object') {
            if (!comparePlainObject(a[key], b[key])) {
                return false;
            }
        } else if (a[key] != b[key]) {
            return false;
        }
    }
    return true;
}

describe('getService()', function () {
    this.timeout(60000);
    it('能正常列出 Bucket', function (done) {
        prepareBucket().then(function () {
            cos.getService(function (err, data) {
                var hasBucket = false;
                data.Buckets && data.Buckets.forEach(function (item) {
                    if (item.Name === BucketLongName && (item.Location === config.Region || !item.Location)) {
                        hasBucket = true;
                    }
                });
                assert.equal(true, hasBucket);
                done();
            });
        }).catch(function () {
        });
    });
});

describe('getAuth()', function () {
    this.timeout(60000);
    it('通过获取签名能正常获取文件', function (done) {
        var content = Date.now().toString();
        var key = '1.txt';
        prepareBucket().then(function () {
            cos.putObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: key,
                Body: new Buffer(content)
            }, function (err, data) {
                var auth = cos.getAuth({
                    Method: 'get',
                    Key: key
                });
                var link = 'http://' + BucketLongName + '.cos.' + config.Region + '.myqcloud.com/' + key +
                    '?sign=' + encodeURIComponent(auth);
                request(link, function (err, response, body) {
                    assert.ok(response.statusCode === 200);
                    assert.ok(body === content);
                    done();
                });
            });
        }).catch(function () {
        });
    });
});

describe('getV4Auth()', function () {
    this.timeout(60000);
    it('通过获取签名能正常获取文件', function (done) {
        var content = Date.now().toString();
        var key = '1.txt';
        prepareBucket().then(function () {
            cos.putObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: key,
                Body: new Buffer(content)
            }, function (err, data) {
                var auth = cos.getV4Auth({
                    Bucket: config.Bucket,
                    Key: key,
                });
                var link = 'http://' + BucketLongName + '.cos.' + config.Region + '.myqcloud.com/' + key +
                    '?sign=' + encodeURIComponent(auth);
                request(link, function (err, response, body) {
                    assert.ok(response.statusCode === 200);
                    assert.ok(body === content);
                    done();
                });
            });
        }).catch(function () {
        });
    });
});

describe('auth check', function () {
    this.timeout(60000);
    it('auth check', function (done) {
        cos.getBucketCors({
            Bucket: config.Bucket,
            Region: config.Region,
            Headers: {
                'x-cos-test': 'aksjhdlash sajlhj!@#$%^&*()_+=-[]{}\';:\"/.<>?.,??sadasd#/.,/~`',
            },
        }, function (err, data) {
            assert.ok(!err);
            done();
        });
    });
});

describe('putBucket()', function () {
    this.timeout(60000);
    var NewBucket = 'test' + Date.now().toString(36) + '-' + AppId;
    it('正常创建 bucket', function (done) {
        cos.putBucket({
            Bucket: NewBucket,
            Region: config.Region
        }, function (err, data) {
            assert.equal(NewBucket + '.cos.' + config.Region + '.myqcloud.com', data.Location);
            cos.headBucket({
                Bucket: NewBucket,
                Region: config.Region
            }, function (err, data) {
                assert.ok(data);
                cos.deleteBucket({
                    Bucket: NewBucket,
                    Region: config.Region
                }, function (err, data) {
                    done();
                });
            });
        });
    });
});

describe('getBucket()', function () {
    this.timeout(60000);
    it('正常获取 bucket 里的文件列表', function (done) {
        prepareBucket().then(function () {
            cos.getBucket({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region
            }, function (err, data) {
                assert.equal(true, data.Name === BucketLongName);
                assert.equal(data.Contents.constructor, Array);
                done();
            });
        }).catch(function () {
            assert.equal(false);
            done();
        });
    });
});

describe('putObject()', function () {
    this.timeout(60000);
    var filename = '1.txt';
    var filepath = path.resolve(__dirname, filename);
    var getObjectContent = function (callback) {
        var objectContent = new Buffer([]);
        var outputStream = new Writable({
            write: function (chunk, encoding, callback) {
                objectContent = Buffer.concat([objectContent, chunk]);
            }
        });
        setTimeout(function () {
            cos.getObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename,
                Output: outputStream
            }, function (err, data) {
                var content = objectContent.toString();
                callback(content);
            });
        }, 2000);
    };
    it('fs.createReadStream 创建 object', function (done) {
        var content = Date.now().toString();
        fs.writeFileSync(filepath, content);
        var lastPercent = 0;
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: filename,
            Body: fs.createReadStream(filepath),
            ContentLength: fs.statSync(filepath).size,
            onProgress: function (processData) {
                lastPercent = processData.percent;
            },
        }, function (err, data) {
            if (err) throw err;
            assert.ok(data.ETag.length > 0);
            fs.unlinkSync(filepath);
            getObjectContent(function (objectContent) {
                assert.ok(objectContent === content);
                cos.putObjectCopy({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    //ServerSideEncryption: 'AES256',
                    Key: '1.copy.text',
                    CopySource: config.Bucket + '.cos.' + config.Region + '.myqcloud.com/' + filename, // Bucket 格式：test-1250000000
                }, function (err, data) {
                    assert.ok(!err);
                    assert.ok(data.ETag.length > 0);
                    done();
                });
            });
        });
    });
    it('fs.readFileSync 创建 object', function (done) {
        var content = Date.now().toString();
        fs.writeFileSync(filepath, content);
        var lastPercent = 0;
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: filename,
            Body: fs.readFileSync(filepath),
            onProgress: function (processData) {
                lastPercent = processData.percent;
            },
        }, function (err, data) {
            if (err) throw err;
            assert.ok(data.ETag.length > 0);
            fs.unlinkSync(filepath);
            getObjectContent(function (objectContent) {
                assert.ok(objectContent === content);
                done();
            });
        });
    });
    it('捕获输入流异常', function (done) {
        var filename = 'big.zip';
        var filepath = path.resolve(__dirname, filename);
        var put = function () {
            var Body = fs.createReadStream(filepath);
            setTimeout(function () {
                Body.emit('error', new Error('some error'))
            }, 1000);
            cos.putObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename,
                Body: Body,
                ContentLength: fs.statSync(filepath).size,
            }, function (err, data) {
                fs.unlinkSync(filepath);
                done();
            });
        };
        if (fs.existsSync(filepath)) {
            put();
        } else {
            util.createFile(filepath, 5 << 20, put);
        }
    });
    it('putObject(),buffer', function (done) {
        var content = new Buffer('中文_' + Date.now());
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: '1.txt',
            Body: content,
        }, function (err, data) {
            var ETag = data.ETag;
            assert.ok(!err && ETag);
            cos.getObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename
            }, function (err, data) {
                assert.ok(data.Body && data.Body.toString() === content.toString() && (data.headers && data.headers.etag) === ETag);
                done();
            });
        });
    });
    it('putObject(),buffer,empty', function (done) {
        var content = new Buffer('');
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: '1.txt',
            Body: content,
        }, function (err, data) {
            var ETag = data.ETag;
            assert.ok(!err && ETag);
            cos.getObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename
            }, function (err, data) {
                assert.ok(data.Body && data.Body.toString() === content.toString() && (data.headers && data.headers.etag) === ETag);
                done();
            });
        });
    });
    it('putObject(),string', function (done) {
        var content = '中文_' + Date.now();
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: '1.txt',
            Body: content,
        }, function (err, data) {
            var ETag = data.ETag;
            assert.ok(!err && ETag);
            cos.getObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename
            }, function (err, data) {
                assert.ok(data.Body && data.Body.toString() === content.toString() && (data.headers && data.headers.etag) === ETag);
                done();
            });
        });
    });
    it('putObject(),string,empty', function (done) {
        var content = '';
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: '1.txt',
            Body: content,
        }, function (err, data) {
            var ETag = data.ETag;
            assert.ok(!err && ETag);
            cos.getObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename
            }, function (err, data) {
                assert.ok(data.Body && data.Body.toString() === content && (data.headers && data.headers.etag) === ETag);
                done();
            });
        });
    });
});

describe('getObject()', function () {
    this.timeout(60000);
    it('stream', function (done) {
        var key = '1.txt';
        var objectContent = new Buffer([]);
        var outputStream = new Writable({
            write: function (chunk, encoding, callback) {
                objectContent = Buffer.concat([objectContent, chunk]);
            }
        });
        var content = Date.now().toString(36);
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: key,
            Body: new Buffer(content)
        }, function (err, data) {
            setTimeout(function () {
                cos.getObject({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    Key: key,
                    Output: outputStream
                }, function (err, data) {
                    if (err) throw err;
                    objectContent = objectContent.toString();
                    assert.ok(data.headers['content-length'] === '' + content.length);
                    assert.ok(objectContent === content);
                    cos.headObject({
                        Bucket: config.Bucket,
                        Region: config.Region,
                        Key: key
                    }, function (err, data) {
                        assert.ok(!err);
                        done();
                    });
                });
            }, 2000);
        });
    });
    it('body', function (done) {
        var key = '1.txt';
        var content = Date.now().toString();
        cos.putObject({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Key: key,
            Body: new Buffer(content)
        }, function (err, data) {
            setTimeout(function () {
                cos.getObject({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    Key: key
                }, function (err, data) {
                    if (err) throw err;
                    var objectContent = data.Body.toString();
                    assert.ok(data.headers['content-length'] === '' + content.length);
                    assert.ok(objectContent === content);
                    done();
                });
            }, 2000);
        });
    });
});

describe('sliceUploadFile()', function () {
    this.timeout(120000);
    it('正常分片上传 object', function (done) {
        var filename = '3mb.zip';
        var filepath = path.resolve(__dirname, filename);
        var put = function () {
            var lastPercent = 0;
            cos.sliceUploadFile({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: filename,
                FilePath: filepath,
                SliceSize: 1024 * 1024,
                AsyncLimit: 5,
                onHashProgress: function (progressData) {
                },
                onProgress: function (progressData) {
                    lastPercent = progressData.percent;
                },
            }, function (err, data) {
                assert.equal(true, data.ETag.length > 0 && lastPercent === 1);
                fs.unlinkSync(filepath);
                done();
            });
        };
        if (fs.existsSync(filepath)) {
            put();
        } else {
            util.createFile(filepath, 3 * 1024 * 1024, put);
        }
    });
});

(function () {
    var AccessControlPolicy = {
        "Owner": {
            "ID": 'qcs::cam::uin/10001:uin/10001' // 10001 是 QQ 号
        },
        "Grants": [{
            "Grantee": {
                "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
            },
            "Permission": "READ"
        }]
    };
    var AccessControlPolicy2 = {
        "Owner": {
            "ID": 'qcs::cam::uin/10001:uin/10001' // 10001 是 QQ 号
        },
        "Grant": {
            "Grantee": {
                "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
            },
            "Permission": "READ"
        }
    };
    describe('BucketAcl', function () {
        this.timeout(60000);
        it('putBucketAcl() header ACL:private', function (done) {
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                ACL: 'private'
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    AccessControlPolicy.Owner.ID = data.Owner.ID;
                    AccessControlPolicy2.Owner.ID = data.Owner.ID;
                    assert.ok(data.ACL === 'private' || data.ACL === 'default');
                    done();
                });
            });
        });
        it('putBucketAcl() header ACL:public-read', function (done) {
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                ACL: 'public-read',
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.ACL === 'public-read');
                    done();
                });
            });
        });
        it('putBucketAcl() header ACL:public-read-write', function (done) {
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                ACL: 'public-read-write',
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.ACL === 'public-read-write');
                    done();
                });
            });
        });
        it('putBucketAcl() header GrantRead:1001,1002', function (done) {
            var GrantRead = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantRead: GrantRead,
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantRead = GrantRead);
                    done();
                });
            });
        });
        it('putBucketAcl() header GrantWrite:1001,1002', function (done) {
            var GrantWrite = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantWrite: GrantWrite,
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantWrite = GrantWrite);
                    done();
                });
            });
        });
        it('putBucketAcl() header GrantFullControl:1001,1002', function (done) {
            var GrantFullControl = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantFullControl: GrantFullControl,
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantFullControl = GrantFullControl);
                    done();
                });
            });
        });
        it('putBucketAcl() header ACL:public-read, GrantFullControl:1001,1002', function (done) {
            var GrantFullControl = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantFullControl: GrantFullControl,
                ACL: 'public-read',
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantFullControl = GrantFullControl);
                    assert.ok(data.ACL === 'public-read');
                    done();
                });
            });
        });
        it('putBucketAcl() xml', function (done) {
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                AccessControlPolicy: AccessControlPolicy
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.Grants.length === 1);
                    assert.ok(data.Grants[0] && data.Grants[0].Grantee.ID === 'qcs::cam::uin/10002:uin/10002', '设置 AccessControlPolicy ID 正确');
                    assert.ok(data.Grants[0] && data.Grants[0].Permission === 'READ', '设置 AccessControlPolicy Permission 正确');
                    done();
                });
            });
        });
        it('putBucketAcl() xml2', function (done) {
            cos.putBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                AccessControlPolicy: AccessControlPolicy2,
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.Grants.length === 1);
                    assert.ok(data.Grants[0] && data.Grants[0].Grantee.ID === 'qcs::cam::uin/10002:uin/10002');
                    assert.ok(data.Grants[0] && data.Grants[0].Permission === 'READ');
                    done();
                });
            });
        });
        it('putBucketAcl() decodeAcl', function (done) {
            cos.getBucketAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region
            }, function (err, data) {
                cos.putBucketAcl({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    GrantFullControl: data.GrantFullControl,
                    GrantWrite: data.GrantWrite,
                    GrantRead: data.GrantRead,
                    ACL: data.ACL,
                }, function (err, data) {
                    assert.ok(data);
                    done();
                });
            });
        });
    });
})();

(function () {
    var AccessControlPolicy = {
        "Owner": {
            "ID": 'qcs::cam::uin/10001:uin/10001' // 10001 是 QQ 号
        },
        "Grants": [{
            "Grantee": {
                "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
            },
            "Permission": "READ"
        }]
    };
    var AccessControlPolicy2 = {
        "Owner": {
            "ID": 'qcs::cam::uin/10001:uin/10001' // 10001 是 QQ 号
        },
        "Grant": {
            "Grantee": {
                "ID": "qcs::cam::uin/10002:uin/10002", // 10002 是 QQ 号
            },
            "Permission": "READ"
        }
    };
    describe('ObjectAcl', function () {
        this.timeout(60000);
        it('putObjectAcl() header ACL:private', function (done) {
            cos.putObject({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: '1.txt',
                Body: new Buffer('hello!'),
            }, function (err, data) {
                assert.ok(!err);
                cos.putObjectAcl({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    ACL: 'private',
                    Key: '1.txt',
                }, function (err, data) {
                    assert.ok(!err, 'putObjectAcl 成功');
                    cos.getObjectAcl({
                        Bucket: config.Bucket, // Bucket 格式：test-1250000000
                        Region: config.Region,
                        Key: '1.txt'
                    }, function (err, data) {
                        assert.ok(data.ACL = 'private');
                        AccessControlPolicy.Owner.ID = data.Owner.ID;
                        AccessControlPolicy2.Owner.ID = data.Owner.ID;
                        assert.ok(data.Grants.length === 1);
                        done();
                    });
                });
            });
        });
        it('putObjectAcl() header ACL:default', function (done) {
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                ACL: 'default',
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    Key: '1.txt'
                }, function (err, data) {
                    assert.ok(data.ACL = 'default');
                    done();
                });
            });
        });
        it('putObjectAcl() header ACL:public-read', function (done) {
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                ACL: 'public-read',
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.ACL = 'public-read');
                    done();
                });
            });
        });
        it('putObjectAcl() header ACL:public-read-write', function (done) {
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                ACL: 'public-read-write',
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.ACL = 'public-read-write');
                    done();
                });
            });
        });
        it('putObjectAcl() header GrantRead:1001,1002', function (done) {
            var GrantRead = 'id="qcs::cam::uin/1001:uin/1001",id="qcs::cam::uin/1002:uin/1002"';
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantRead: GrantRead,
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantRead = GrantRead);
                    done();
                });
            });
        });
        it('putObjectAcl() header GrantWrite:1001,1002', function (done) {
            var GrantWrite = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantWrite: GrantWrite,
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantWrite = GrantWrite);
                    done();
                });
            });
        });
        it('putObjectAcl() header GrantFullControl:1001,1002', function (done) {
            var GrantFullControl = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantFullControl: GrantFullControl,
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantFullControl = GrantFullControl);
                    done();
                });
            });
        });
        it('putObjectAcl() header ACL:public-read, GrantRead:1001,1002', function (done) {
            var GrantFullControl = 'id="qcs::cam::uin/1001:uin/1001", id="qcs::cam::uin/1002:uin/1002"';
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                GrantFullControl: GrantFullControl,
                ACL: 'public-read',
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.GrantFullControl = GrantFullControl);
                    assert.ok(data.ACL = 'public-read');
                    done();
                });
            });
        });
        it('putObjectAcl() xml', function (done) {
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                AccessControlPolicy: AccessControlPolicy,
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getBucketAcl({Bucket: config.Bucket, Region: config.Region, Key: '1.txt'}, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.Grants.length === 1);
                    assert.ok(data.Grants[0] && data.Grants[0].Grantee.ID === 'qcs::cam::uin/10002:uin/10002', '设置 AccessControlPolicy ID 正确');
                    assert.ok(data.Grants[0] && data.Grants[0].Permission === 'READ', '设置 AccessControlPolicy Permission 正确');
                    done();
                });
            });
        });
        it('putObjectAcl() xml2', function (done) {
            cos.putObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                AccessControlPolicy: AccessControlPolicy2,
                Key: '1.txt',
            }, function (err, data) {
                assert.ok(!err, 'putObjectAcl 成功');
                cos.getObjectAcl({
                    Bucket: config.Bucket,
                    Region: config.Region,
                    Key: '1.txt'
                }, function (err, data) { // Bucket 格式：test-1250000000
                    assert.ok(data.Grants.length === 1);
                    assert.ok(data.Grants[0] && data.Grants[0].Grantee.ID === 'qcs::cam::uin/10002:uin/10002', 'ID 正确');
                    assert.ok(data.Grants[0] && data.Grants[0].Permission === 'READ', 'Permission 正确');
                    done();
                });
            });
        });
        it('putObjectAcl() decodeAcl', function (done) {
            cos.getObjectAcl({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Key: '1.txt'
            }, function (err, data) {
                cos.putObjectAcl({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region,
                    Key: '1.txt',
                    GrantFullControl: data.GrantFullControl,
                    GrantWrite: data.GrantWrite,
                    GrantRead: data.GrantRead,
                    ACL: data.ACL,
                }, function (err, data) {
                    assert.ok(data);
                    done();
                });
            });
        });
    });
})();

describe('BucketCors', function () {
    this.timeout(60000);
    var CORSRules = [{
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": "5"
    }];
    var CORSRulesMulti = [{
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": "5"
    }, {
        "AllowedOrigins": ["http://qq.com", "http://qcloud.com"],
        "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": "5"
    }];
    it('deleteBucketCors()', function (done) {
        cos.deleteBucketCors({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketCors({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject([], data.CORSRules));
                    done();
                });
            }, 2000);
        });
    });
    it('putBucketCors(),getBucketCors()', function (done) {
        CORSRules[0].AllowedHeaders[CORSRules[0].AllowedHeaders.length - 1] =
            'test-' + Date.now().toString(36);
        cos.putBucketCors({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            CORSConfiguration: {
                CORSRules: CORSRules
            }
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketCors({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject(CORSRules, data.CORSRules));
                    done();
                });
            }, 2000);
        });
    });
    it('putBucketCors() old', function (done) {
        var testVal = 'test-' + Date.now().toString(36);
        CORSRules[0].AllowedHeaders.push(testVal);
        cos.putBucketCors({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            CORSConfiguration: {
                CORSRules: CORSRules
            }
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketCors({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject(CORSRules, data.CORSRules));
                    done();
                });
            }, 2000);
        });
    });
    it('putBucketCors() old', function (done) {
        CORSRules[0].AllowedHeaders[CORSRules[0].AllowedHeaders.length - 1] =
            'test-' + Date.now().toString(36);
        cos.putBucketCors({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            CORSRules: CORSRules
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketCors({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject(CORSRules, data.CORSRules));
                    done();
                });
            }, 2000);
        });
    });
    it('putBucketCors() multi', function (done) {
        cos.putBucketCors({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            CORSConfiguration: {
                CORSRules: CORSRulesMulti
            }
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketCors({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject(CORSRulesMulti, data.CORSRules));
                    done();
                });
            }, 2000);
        });
    });
});

describe('BucketTagging', function () {
    this.timeout(60000);
    var Tags = [
        {Key: "k1", Value: "v1"}
    ];
    var TagsMulti = [
        {Key: "k1", Value: "v1"},
        {Key: "k2", Value: "v2"},
    ];
    it('putBucketTagging(),getBucketTagging()', function (done) {
        Tags[0].Value = Date.now().toString(36);
        cos.putBucketTagging({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Tagging: {
                Tags: Tags
            }
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketTagging({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject(Tags, data.Tags));
                    done();
                });
            }, 2000);
        });
    });
    it('deleteBucketTagging()', function (done) {
        cos.deleteBucketTagging({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketTagging({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject([], data.Tags));
                    done();
                });
            }, 2000);
        });
    });
    it('putBucketTagging() multi', function (done) {
        Tags[0].Value = Date.now().toString(36);
        cos.putBucketTagging({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region,
            Tagging: {
                Tags: TagsMulti
            }
        }, function (err, data) {
            assert.ok(!err);
            setTimeout(function () {
                cos.getBucketTagging({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(comparePlainObject(TagsMulti, data.Tags));
                    done();
                });
            }, 2000);
        });
    });
});

(function () {
    var Prefix = Date.now().toString(36);
    var Policy = {
        "version": "2.0",
        "principal": {"qcs": ["qcs::cam::uin/10001:uin/10001"]}, // 这里的 10001 是 QQ 号
        "statement": [{
            "effect": "allow",
            "action": [
                "name/cos:GetBucket",
                "name/cos:PutObject",
                "name/cos:PostObject",
                "name/cos:PutObjectCopy",
                "name/cos:InitiateMultipartUpload",
                "name/cos:UploadPart",
                "name/cos:UploadPartCopy",
                "name/cos:CompleteMultipartUpload",
                "name/cos:AbortMultipartUpload",
                "name/cos:AppendObject"
            ],
            "resource": ["qcs::cos:" + config.Region + ":uid/" + AppId + ":" + BucketLongName + ".cos." + config.Region + ".myqcloud.com//" + AppId + "/" + BucketShortName + "/" + Prefix + "/*"] // 1250000000 是 appid
        }]
    };
    describe('BucketPolicy', function () {
        this.timeout(60000);
        it('putBucketPolicy(),getBucketPolicy()', function (done) {
            cos.putBucketPolicy({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Policy: Policy
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketPolicy({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(Policy, data.Policy);
                    done();
                });
            });
        });
        it('putBucketPolicy() s3', function (done) {
            cos.putBucketPolicy({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                Policy: JSON.stringify(Policy)
            }, function (err, data) {
                assert.ok(!err);
                cos.getBucketPolicy({
                    Bucket: config.Bucket, // Bucket 格式：test-1250000000
                    Region: config.Region
                }, function (err, data) {
                    assert.ok(Policy, data.Policy);
                    done();
                });
            });
        });
    });
})();

describe('BucketLocation', function () {
    this.timeout(60000);
    it('getBucketLocation()', function (done) {
        cos.getBucketLocation({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: config.Region
        }, function (err, data) {
            var map1 = {
                'tianjin': 'ap-beijing-1',
                'cn-south-2': 'ap-guangzhou-2',
                'cn-south': 'ap-guangzhou',
                'cn-east': 'ap-shanghai',
                'cn-southwest': 'ap-chengdu',
            };
            var map2 = {
                'ap-beijing-1': 'tianjin',
                'ap-guangzhou-2': 'cn-south-2',
                'ap-guangzhou': 'cn-south',
                'ap-shanghai': 'cn-east',
                'ap-chengdu': 'cn-southwest',
            };
            assert.ok(data.LocationConstraint === config.Region || data.LocationConstraint === map1[config.Region] ||
                data.LocationConstraint === map2[config.Region]);
            done();
        });
    });
});

(function () {
    var Rules = [{
        'ID': '1',
        'Filter': {
            'Prefix': 'test_' + Date.now().toString(36),
        },
        'Status': 'Enabled',
        'Transition': {
            'Date': '2018-07-29T16:00:00.000Z',
            'StorageClass': 'STANDARD_IA'
        }
    }];
    var RulesMulti = [{
        'ID': '1',
        'Filter': {
            'Prefix': 'test1_' + Date.now().toString(36),
        },
        'Status': 'Enabled',
        'Transition': {
            'Date': '2018-07-29T16:00:00.000Z',
            'StorageClass': 'STANDARD_IA'
        }
    }, {
        'ID': '2',
        'Filter': {
            'Prefix': 'test2_' + Date.now().toString(36),
        },
        'Status': 'Enabled',
        'Transition': {
            'Date': '2018-07-29T16:00:00.000Z',
            'StorageClass': 'STANDARD_IA'
        }
    }];
    describe('BucketLifecycle', function () {
        this.timeout(60000);
        it('deleteBucketLifecycle()', function (done) {
            cos.deleteBucketLifecycle({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region
            }, function (err, data) {
                assert.ok(!err);
                setTimeout(function () {
                    cos.getBucketLifecycle({
                        Bucket: config.Bucket, // Bucket 格式：test-1250000000
                        Region: config.Region
                    }, function (err, data) {
                        assert.ok(comparePlainObject([], data.Rules));
                        done();
                    });
                }, 2000);
            });
        });
        it('putBucketLifecycle(),getBucketLifecycle()', function (done) {
            Rules[0].Filter.Prefix = 'test_' + Date.now().toString(36);
            cos.putBucketLifecycle({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                LifecycleConfiguration: {
                    Rules: Rules
                }
            }, function (err, data) {
                assert.ok(!err);
                setTimeout(function () {
                    cos.getBucketLifecycle({
                        Bucket: config.Bucket, // Bucket 格式：test-1250000000
                        Region: config.Region
                    }, function (err, data) {
                        assert.ok(comparePlainObject(Rules, data && data.Rules));
                        done();
                    });
                }, 2000);
            });
        });
        it('putBucketLifecycle() multi', function (done) {
            Rules[0].Filter.Prefix = 'test_' + Date.now().toString(36);
            cos.putBucketLifecycle({
                Bucket: config.Bucket, // Bucket 格式：test-1250000000
                Region: config.Region,
                LifecycleConfiguration: {
                    Rules: RulesMulti
                }
            }, function (err, data) {
                assert.ok(!err);
                setTimeout(function () {
                    cos.getBucketLifecycle({
                        Bucket: config.Bucket, // Bucket 格式：test-1250000000
                        Region: config.Region
                    }, function (err, data) {
                        assert.ok(comparePlainObject(RulesMulti, data.Rules));
                        done();
                    });
                }, 2000);
            });
        });
    });
})();

describe('params check', function () {
    it('Region', function (done) {
        cos.headBucket({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: 'gz'
        }, function (err, data) {
            assert.ok(err.error.indexOf('param Region format error') === 0);
            done();
        });
    });
});

describe('params check', function () {
    it('Region', function (done) {
        cos.headBucket({
            Bucket: config.Bucket, // Bucket 格式：test-1250000000
            Region: 'cos.ap-guangzhou'
        }, function (err, data) {
            assert.ok(err.error === 'param Region should not be start with "cos."');
            done();
        });
    });
});
