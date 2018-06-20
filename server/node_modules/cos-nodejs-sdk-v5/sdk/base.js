var pkg = require('../package.json');
var fs = require('fs');
var REQUEST = require('request');
var util = require('./util');


// Bucket 相关

/**
 * 获取用户的 bucket 列表
 * @param  {Object}  params         回调函数，必须，下面为参数列表
 * 无特殊参数
 * @param  {Function}  callback     回调函数，必须
 */
function getService(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = {};
    }
    var protocol = this.options.Protocol || (util.isBrowser && location.protocol === 'http:' ? 'http:' : 'https:');
    var domain = this.options.ServiceDomain;
    var appId = params.AppId || this.options.appId;
    if (domain) {
        domain = domain.replace(/\{\{AppId\}\}/ig, appId || '').replace(/\{\{.*?\}\}/ig, '');
        if (!/^[a-zA-Z]+:\/\//.test(domain)) {
            domain = protocol + '//' + domain;
        }
        if (domain.slice(-1) === '/') {
            domain = domain.slice(0, -1);
        }
    } else {
        domain = protocol + '//service.cos.myqcloud.com';
    }
    submitRequest.call(this, {
        url: domain,
        method: 'GET',
        headers: params.Headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var buckets = (data && data.ListAllMyBucketsResult && data.ListAllMyBucketsResult.Buckets
            && data.ListAllMyBucketsResult.Buckets.Bucket) || [];
        buckets = util.isArray(buckets) ? buckets : [buckets];
        callback(null, {
            Buckets: buckets,
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 查看是否存在该Bucket，是否有权限访问
 * @param  {Object}  params                     参数对象，必须
 *     @param  {String}  params.Bucket          Bucket名称，必须
 *     @param  {String}  params.Region          地域名称，必须
 * @param  {Function}  callback                 回调函数，必须
 * @return  {Object}  err                       请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                      返回的数据
 *     @return  {Boolean}  data.BucketExist     Bucket是否存在
 *     @return  {Boolean}  data.BucketAuth      是否有 Bucket 的访问权限
 */
function headBucket(params, callback) {
    submitRequest.call(this, {
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        method: 'HEAD',
    }, function (err, data) {
        callback(err, data);
    });
}

/**
 * 获取 Bucket 下的 object 列表
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 *     @param  {String}  params.Prefix              前缀匹配，用来规定返回的文件前缀地址，非必须
 *     @param  {String}  params.Delimiter           定界符为一个符号，如果有Prefix，则将Prefix到delimiter之间的相同路径归为一类，非必须
 *     @param  {String}  params.Marker              默认以UTF-8二进制顺序列出条目，所有列出条目从marker开始，非必须
 *     @param  {String}  params.MaxKeys             单次返回最大的条目数量，默认1000，非必须
 *     @param  {String}  params.EncodingType        规定返回值的编码方式，非必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          返回的数据
 *     @return  {Object}  data.ListBucketResult     返回的 object 列表信息
 */
function getBucket(params, callback) {
    var reqParams = {};
    reqParams['prefix'] = params['Prefix'];
    reqParams['delimiter'] = params['Delimiter'];
    reqParams['marker'] = params['Marker'];
    reqParams['max-keys'] = params['MaxKeys'];
    reqParams['encoding-type'] = params['EncodingType'];

    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        qs: reqParams,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var ListBucketResult = data.ListBucketResult || {};
        var Contents = ListBucketResult.Contents || [];
        var CommonPrefixes = ListBucketResult.CommonPrefixes || [];

        Contents = util.isArray(Contents) ? Contents : [Contents];
        CommonPrefixes = util.isArray(CommonPrefixes) ? CommonPrefixes : [CommonPrefixes];

        var result = util.clone(ListBucketResult);
        util.extend(result, {
            Contents: Contents,
            CommonPrefixes: CommonPrefixes,
            statusCode: data.statusCode,
            headers: data.headers,
        });

        callback(null, result);
    });
}

/**
 * 创建 Bucket，并初始化访问权限
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 *     @param  {String}  params.ACL                 用户自定义文件权限，可以设置：private，public-read；默认值：private，非必须
 *     @param  {String}  params.GrantRead           赋予被授权者读的权限，格式x-cos-grant-read: uin=" ",uin=" "，非必须
 *     @param  {String}  params.GrantWrite          赋予被授权者写的权限，格式x-cos-grant-write: uin=" ",uin=" "，非必须
 *     @param  {String}  params.GrantFullControl    赋予被授权者读写权限，格式x-cos-grant-full-control: uin=" ",uin=" "，非必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          返回的数据
 *     @return  {String}  data.Location             操作地址
 */
function putBucket(params, callback) {
    var self = this;
    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var url = getUrl({
            protocol: self.options.Protocol,
            domain: self.options.Domain,
            bucket: params.Bucket,
            region: params.Region,
            isLocation: true,
        });
        callback(null, {
            Location: url,
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 删除 Bucket
 * @param  {Object}  params                 参数对象，必须
 *     @param  {String}  params.Bucket      Bucket名称，必须
 *     @param  {String}  params.Region      地域名称，必须
 * @param  {Function}  callback             回调函数，必须
 * @return  {Object}  err                   请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                  返回的数据
 *     @return  {String}  data.Location     操作地址
 */
function deleteBucket(params, callback) {
    submitRequest.call(this, {
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        method: 'DELETE',
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 获取 Bucket 的 权限列表
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          返回的数据
 *     @return  {Object}  data.AccessControlPolicy  访问权限信息
 */
function getBucketAcl(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'acl',
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var AccessControlPolicy = data.AccessControlPolicy || {};
        var Owner = AccessControlPolicy.Owner || {};
        var Grant = AccessControlPolicy.AccessControlList.Grant || [];
        Grant = util.isArray(Grant) ? Grant : [Grant];
        var result = decodeAcl(AccessControlPolicy);
        if (data.headers && data.headers['x-cos-acl']) {
            result.ACL = data.headers['x-cos-acl'];
        }
        result = util.extend(result, {
            Owner: Owner,
            Grants: Grant,
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

/**
 * 设置 Bucket 的 权限列表
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 *     @param  {String}  params.ACL                 用户自定义文件权限，可以设置：private，public-read；默认值：private，非必须
 *     @param  {String}  params.GrantRead           赋予被授权者读的权限，格式x-cos-grant-read: uin=" ",uin=" "，非必须
 *     @param  {String}  params.GrantWrite          赋予被授权者写的权限，格式x-cos-grant-write: uin=" ",uin=" "，非必须
 *     @param  {String}  params.GrantFullControl    赋予被授权者读写权限，格式x-cos-grant-full-control: uin=" ",uin=" "，非必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          返回的数据
 */
function putBucketAcl(params, callback) {
    var headers = params.Headers;

    var xml = '';
    if (params['AccessControlPolicy']) {
        var AccessControlPolicy = util.clone(params['AccessControlPolicy'] || {});
        var Grants = AccessControlPolicy.Grants || AccessControlPolicy.Grant;
        Grants = util.isArray(Grants) ? Grants : [Grants];
        delete AccessControlPolicy.Grant;
        delete AccessControlPolicy.Grants;
        AccessControlPolicy.AccessControlList = {Grant: Grants};
        xml = util.json2xml({AccessControlPolicy: AccessControlPolicy});

        headers['Content-Type'] = 'application/xml';
        headers['Content-MD5'] = util.binaryBase64(util.md5(xml));
    }

    // Grant Header 去重
    util.each(headers, function (val, key) {
        if (key.indexOf('x-cos-grant-') === 0) {
            headers[key] = uniqGrant(headers[key]);
        }
    });

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: headers,
        action: 'acl',
        body: xml,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 获取 Bucket 的 跨域设置
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          返回的数据
 *     @return  {Object}  data.CORSRules            Bucket的跨域设置
 */
function getBucketCors(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'cors',
    }, function (err, data) {
        if (err) {
            if (err.statusCode === 404 && err.error && err.error.Code === 'NoSuchCORSConfiguration') {
                var result = {
                    CORSRules: [],
                    statusCode: err.statusCode,
                };
                err.headers && (result.headers = err.headers);
                callback(null, result);
            } else {
                callback(err);
            }
            return;
        }
        var CORSConfiguration = data.CORSConfiguration || {};
        var CORSRules = CORSConfiguration.CORSRules || CORSConfiguration.CORSRule || [];
        CORSRules = util.clone(util.isArray(CORSRules) ? CORSRules : [CORSRules]);

        util.each(CORSRules, function (rule) {
            util.each(['AllowedOrigin', 'AllowedHeader', 'AllowedMethod', 'ExposeHeader'], function (key, j) {
                var sKey = key + 's';
                var val = rule[sKey] || rule[key] || [];
                delete rule[key];
                rule[sKey] = util.isArray(val) ? val : [val];
            });
        });

        callback(null, {
            CORSRules: CORSRules,
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 设置 Bucket 的 跨域设置
 * @param  {Object}  params                             参数对象，必须
 *     @param  {String}  params.Bucket                  Bucket名称，必须
 *     @param  {String}  params.Region                  地域名称，必须
 *     @param  {Object}  params.CORSConfiguration       相关的跨域设置，必须
 * @param  {Array}  params.CORSConfiguration.CORSRules  对应的跨域规则
 * @param  {Function}  callback                         回调函数，必须
 * @return  {Object}  err                               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                              返回的数据
 */
function putBucketCors(params, callback) {

    var CORSConfiguration = params['CORSConfiguration'] || {};
    var CORSRules = CORSConfiguration['CORSRules'] || params['CORSRules'] || [];
    CORSRules = util.clone(util.isArray(CORSRules) ? CORSRules : [CORSRules]);
    util.each(CORSRules, function (rule) {
        util.each(['AllowedOrigin', 'AllowedHeader', 'AllowedMethod', 'ExposeHeader'], function (key, k) {
            var sKey = key + 's';
            var val = rule[sKey] || rule[key] || [];
            delete rule[sKey];
            rule[key] = util.isArray(val) ? val : [val];
        });
    });

    var xml = util.json2xml({CORSConfiguration: {CORSRule: CORSRules}});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        body: xml,
        action: 'cors',
        headers: headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 删除 Bucket 的 跨域设置
 * @param  {Object}  params                 参数对象，必须
 *     @param  {String}  params.Bucket      Bucket名称，必须
 *     @param  {String}  params.Region      地域名称，必须
 * @param  {Function}  callback             回调函数，必须
 * @return  {Object}  err                   请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                  返回的数据
 */
function deleteBucketCors(params, callback) {
    submitRequest.call(this, {
        method: 'DELETE',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'cors',
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode || err.statusCode,
            headers: data.headers,
        });
    });
}

function putBucketPolicy(params, callback) {
    var Policy = params['Policy'];
    var PolicyStr = Policy;
    try {
        if (typeof Policy === 'string') {
            Policy = JSON.parse(PolicyStr);
        } else {
            PolicyStr = JSON.stringify(Policy);
        }
    } catch (e) {
        callback({error: 'Policy format error'});
    }

    var headers = params.Headers;
    headers['Content-Type'] = 'application/json';
    headers['Content-MD5'] = util.binaryBase64(util.md5(PolicyStr));

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        action: 'policy',
        body: util.isBrowser ? PolicyStr : Policy,
        headers: headers,
        json: true,
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 获取 Bucket 的 地域信息
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回数据，包含地域信息 LocationConstraint
 */
function getBucketLocation(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'location',
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, data);
    });
}

/**
 * 获取 Bucket 的读取权限策略
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回数据
 */
function getBucketPolicy(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'policy',
        rawBody: true,
    }, function (err, data) {
        if (err) {
            if (err.statusCode && err.statusCode === 403) {
                return callback({ErrorStatus: 'Access Denied'});
            }
            if (err.statusCode && err.statusCode === 405) {
                return callback({ErrorStatus: 'Method Not Allowed'});
            }
            if (err.statusCode && err.statusCode === 404) {
                return callback({ErrorStatus: 'Policy Not Found'});
            }
            return callback(err);
        }
        var Policy = {};
        try {
            Policy = JSON.parse(data.body);
        } catch (e) {
        }
        callback(null, {
            Policy: Policy,
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 获取 Bucket 的标签设置
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回数据
 */
function getBucketTagging(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'tagging',
    }, function (err, data) {
        if (err) {
            if (err.statusCode === 404 && err.error && (err.error === "Not Found" || err.error.Code === 'NoSuchTagSet')) {
                var result = {
                    Tags: [],
                    statusCode: err.statusCode,
                };
                err.headers && (result.headers = err.headers);
                callback(null, result);
            } else {
                callback(err);
            }
            return;
        }
        var Tags = [];
        try {
            Tags = data.Tagging.TagSet.Tag || [];
        } catch (e) {
        }
        Tags = util.clone(util.isArray(Tags) ? Tags : [Tags]);
        callback(null, {
            Tags: Tags,
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 设置 Bucket 的标签
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 *     @param  {Array}   params.TagSet  标签设置，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回数据
 */
function putBucketTagging(params, callback) {

    var Tagging = params['Tagging'] || {};
    var Tags = Tagging.TagSet || Tagging.Tags || params['Tags'] || [];
    Tags = util.clone(util.isArray(Tags) ? Tags : [Tags]);
    var xml = util.json2xml({Tagging: {TagSet: {Tag: Tags}}});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        body: xml,
        action: 'tagging',
        headers: headers,
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}


/**
 * 删除 Bucket 的 标签设置
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回的数据
 */
function deleteBucketTagging(params, callback) {
    submitRequest.call(this, {
        method: 'DELETE',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'tagging',
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

function putBucketLifecycle(params, callback) {

    var LifecycleConfiguration = params['LifecycleConfiguration'] || {};
    var Rules = LifecycleConfiguration.Rules || [];
    Rules = util.clone(Rules);
    var xml = util.json2xml({LifecycleConfiguration: {Rule: Rules}});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        body: xml,
        action: 'lifecycle',
        headers: headers,
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

function getBucketLifecycle(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'lifecycle',
    }, function (err, data) {
        if (err) {
            if (err.statusCode === 404 && err.error && err.error.Code === 'NoSuchLifecycleConfiguration') {
                var result = {
                    Rules: [],
                    statusCode: err.statusCode,
                };
                err.headers && (result.headers = err.headers);
                callback(null, result);
            } else {
                callback(err);
            }
            return;
        }
        var Rules = [];
        try {
            Rules = data.LifecycleConfiguration.Rule || [];
        } catch (e) {
        }
        Rules = util.clone(util.isArray(Rules) ? Rules : [Rules]);
        callback(null, {
            Rules: Rules,
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

function deleteBucketLifecycle(params, callback) {
    submitRequest.call(this, {
        method: 'DELETE',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'lifecycle',
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

function putBucketVersioning(params, callback) {

    if (!params['VersioningConfiguration']) {
        callback({error: 'missing param VersioningConfiguration'});
        return;
    }
    var VersioningConfiguration = params['VersioningConfiguration'] || {};
    var xml = util.json2xml({VersioningConfiguration: VersioningConfiguration});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        body: xml,
        action: 'versioning',
        headers: headers,
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

function getBucketVersioning(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'versioning',
    }, function (err, data) {
        if (!err) {
            !data.VersioningConfiguration && (data.VersioningConfiguration = {});
            !data.VersioningConfiguration.MFADelete && (data.VersioningConfiguration.MFADelete = 'Disabled');
            !data.VersioningConfiguration.Status && (data.VersioningConfiguration.Status = 'Disabled');
        }
        callback(err, data);
    });
}

function putBucketReplication(params, callback) {
    var ReplicationConfiguration = util.clone(params.ReplicationConfiguration);
    ReplicationConfiguration.Rule = ReplicationConfiguration.Rules;
    delete ReplicationConfiguration.Rules;
    var xml = util.json2xml({ReplicationConfiguration: ReplicationConfiguration});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        body: xml,
        action: 'replication',
        headers: headers,
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

function getBucketReplication(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'replication',
    }, function (err, data) {
        if (err) {
            if (err.statusCode === 404 && err.error && (err.error === 'Not Found' || err.error.Code === 'ReplicationConfigurationnotFoundError')) {
                var result = {
                    ReplicationConfiguration: {Rules: []},
                    statusCode: err.statusCode,
                };
                err.headers && (result.headers = err.headers);
                callback(null, result);
            } else {
                callback(err);
            }
            return;
        }
        if (!err) {
            !data.ReplicationConfiguration && (data.ReplicationConfiguration = {});
        }
        callback(err, data);
    });
}

function deleteBucketReplication(params, callback) {
    submitRequest.call(this, {
        method: 'DELETE',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        action: 'replication',
    }, function (err, data) {
        if (err && err.statusCode === 204) {
            return callback(null, {statusCode: err.statusCode});
        } else if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

// Object 相关

/**
 * 取回对应Object的元数据，Head的权限与Get的权限一致
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 *     @param  {String}  params.Key                 文件名称，必须
 *     @param  {String}  params.IfModifiedSince     当Object在指定时间后被修改，则返回对应Object元信息，否则返回304，非必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          为指定 object 的元数据，如果设置了 IfModifiedSince ，且文件未修改，则返回一个对象，NotModified 属性为 true
 *     @return  {Boolean}  data.NotModified         是否在 IfModifiedSince 时间点之后未修改该 object，则为 true
 */
function headObject(params, callback) {
    submitRequest.call(this, {
        method: 'HEAD',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        VersionId: params.VersionId,
        headers: params.Headers,
    }, function (err, data) {
        if (err) {
            var statusCode = err.statusCode;
            if (params.Headers['If-Modified-Since'] && statusCode && statusCode === 304) {
                return callback(null, {
                    NotModified: true,
                    statusCode: statusCode,
                });
            }
            return callback(err);
        }
        if (data.headers && data.headers.etag) {
            data.ETag = data.headers && data.headers.etag;
        }
        callback(null, data);
    });
}


function listObjectVersions(params, callback) {
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        qs: {
            prefix: params.Prefix
        },
        action: 'versions',
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var ListVersionsResult = data.ListVersionsResult || {};
        var DeleteMarkers = ListVersionsResult.DeleteMarker || [];
        DeleteMarkers = util.isArray(DeleteMarkers) ? DeleteMarkers : [DeleteMarkers];
        var Versions = ListVersionsResult.Version || [];
        Versions = util.isArray(Versions) ? Versions : [Versions];

        var result = util.clone(ListVersionsResult);
        delete result.DeleteMarker;
        delete result.Version;
        util.extend(result, {
            DeleteMarkers: DeleteMarkers,
            Versions: Versions,
            statusCode: data.statusCode,
            headers: data.headers,
        });

        callback(null, result);
    });
}

/**
 * 下载 object
 * @param  {Object}  params                                 参数对象，必须
 *     @param  {String}  params.Bucket                      Bucket名称，必须
 *     @param  {String}  params.Region                      地域名称，必须
 *     @param  {String}  params.Key                         文件名称，必须
 *     @param  {WriteStream}  params.Output                 文件写入流，非必须
 *     @param  {String}  params.IfModifiedSince             当Object在指定时间后被修改，则返回对应Object元信息，否则返回304，非必须
 *     @param  {String}  params.IfUnmodifiedSince           如果文件修改时间早于或等于指定时间，才返回文件内容。否则返回 412 (precondition failed)，非必须
 *     @param  {String}  params.IfMatch                     当 ETag 与指定的内容一致，才返回文件。否则返回 412 (precondition failed)，非必须
 *     @param  {String}  params.IfNoneMatch                 当 ETag 与指定的内容不一致，才返回文件。否则返回304 (not modified)，非必须
 *     @param  {String}  params.ResponseContentType         设置返回头部中的 Content-Type 参数，非必须
 *     @param  {String}  params.ResponseContentLanguage     设置返回头部中的 Content-Language 参数，非必须
 *     @param  {String}  params.ResponseExpires             设置返回头部中的 Content-Expires 参数，非必须
 *     @param  {String}  params.ResponseCacheControl        设置返回头部中的 Cache-Control 参数，非必须
 *     @param  {String}  params.ResponseContentDisposition  设置返回头部中的 Content-Disposition 参数，非必须
 *     @param  {String}  params.ResponseContentEncoding     设置返回头部中的 Content-Encoding 参数，非必须
 * @param  {Function}  callback                             回调函数，必须
 * @param  {Object}  err                                    请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @param  {Object}  data                                   为对应的 object 数据，包括 body 和 headers
 */
function getObject(params, callback) {
    var reqParams = {};

    reqParams['response-content-type'] = params['ResponseContentType'];
    reqParams['response-content-language'] = params['ResponseContentLanguage'];
    reqParams['response-expires'] = params['ResponseExpires'];
    reqParams['response-cache-control'] = params['ResponseCacheControl'];
    reqParams['response-content-disposition'] = params['ResponseContentDisposition'];
    reqParams['response-content-encoding'] = params['ResponseContentEncoding'];

    var BodyType;

    var self = this;
    var outputStream = params.Output;
    if (outputStream && typeof outputStream === 'string') {
        outputStream = fs.createWriteStream(outputStream);
        BodyType = 'stream';
    } else if (outputStream && typeof outputStream.pipe === 'function') {
        BodyType = 'stream';
    } else {
        BodyType = 'buffer';
    }

    var onProgress = params.onProgress;
    var onDownloadProgress = (function () {
        var time0 = Date.now();
        var size0 = 0;
        var FinishSize = 0;
        var FileSize = 0;
        var progressTimer;
        var update = function () {
            progressTimer = 0;
            if (onProgress && (typeof onProgress === 'function')) {
                var time1 = Date.now();
                var speed = parseInt((FinishSize - size0) / ((time1 - time0) / 1000) * 100) / 100 || 0;
                var percent = parseInt(FinishSize / FileSize * 100) / 100 || 0;
                time0 = time1;
                size0 = FinishSize;
                try {
                    onProgress({
                        loaded: FinishSize,
                        total: FileSize,
                        speed: speed,
                        percent: percent
                    });
                } catch (e) {
                }
            }
        };
        return function (info, immediately) {
            if (info && info.loaded) {
                FinishSize = info.loaded;
                FileSize = info.total;
            }
            if (immediately) {
                clearTimeout(progressTimer);
                update();
            } else {
                if (progressTimer) return;
                progressTimer = setTimeout(update, self.options.ProgressInterval || 1000);
            }
        };
    })();

    // 如果用户自己传入了 output
    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        VersionId: params.VersionId,
        headers: params.Headers,
        qs: reqParams,
        rawBody: true,
        outputStream: outputStream,
        onDownloadProgress: onDownloadProgress,
    }, function (err, data) {
        onDownloadProgress(null, true);
        if (err) {
            var statusCode = err.statusCode;
            if (params.Headers['If-Modified-Since'] && statusCode && statusCode === 304) {
                return callback(null, {
                    NotModified: true
                });
            }
            return callback(err);
        }
        var result = {};
        if (BodyType === 'buffer') {
            result.Body = new Buffer(data.body);
        } else if (BodyType === 'string') {
            result.Body = data.body;
        }
        if (data.headers && data.headers.etag) {
            result.ETag = data.headers && data.headers.etag;
        }
        util.extend(result, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });

}

/**
 * 上传 object
 * @param  {Object} params                                          参数对象，必须
 *     @param  {String}  params.Bucket                              Bucket名称，必须
 *     @param  {String}  params.Region                              地域名称，必须
 *     @param  {String}  params.Key                                 文件名称，必须
 *     @param  {Buffer || ReadStream || String}  params.Body        上传文件的内容或流或字符串
 *     @param  {String}  params.CacheControl                        RFC 2616 中定义的缓存策略，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ContentDisposition                  RFC 2616 中定义的文件名称，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ContentEncoding                     RFC 2616 中定义的编码格式，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ContentLength                       RFC 2616 中定义的 HTTP 请求内容长度（字节），必须
 *     @param  {String}  params.ContentType                         RFC 2616 中定义的内容类型（MIME），将作为 Object 元数据保存，非必须
 *     @param  {String}  params.Expect                              当使用 Expect: 100-continue 时，在收到服务端确认后，才会发送请求内容，非必须
 *     @param  {String}  params.Expires                             RFC 2616 中定义的过期时间，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ContentSha1                         RFC 3174 中定义的 160-bit 内容 SHA-1 算法校验，非必须
 *     @param  {String}  params.ACL                                 允许用户自定义文件权限，有效值：private | public-read，非必须
 *     @param  {String}  params.GrantRead                           赋予被授权者读的权限，格式 x-cos-grant-read: uin=" ",uin=" "，非必须
 *     @param  {String}  params.GrantWrite                          赋予被授权者写的权限，格式 x-cos-grant-write: uin=" ",uin=" "，非必须
 *     @param  {String}  params.GrantFullControl                    赋予被授权者读写权限，格式 x-cos-grant-full-control: uin=" ",uin=" "，非必须
 *     @param  {String}  params.ServerSideEncryption               支持按照指定的加密算法进行服务端数据加密，格式 x-cos-server-side-encryption: "AES256"，非必须
 *     @param  {Function}  params.onProgress                        上传进度回调函数
 * @param  {Function}  callback                                     回调函数，必须
 * @return  {Object}  err                                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                                          为对应的 object 数据
 *     @return  {String}  data.ETag                                 为对应上传文件的 ETag 值
 */
function putObject(params, callback) {

    var self = this;
    var FileSize = params.ContentLength;
    var onProgress = util.throttleOnProgress.call(self, FileSize, params.onProgress);

    submitRequest.call(this, {
        TaskId: params.TaskId,
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        headers: params.Headers,
        body: params.Body,
        onProgress: onProgress,
    }, function (err, data) {
        if (err) {
            onProgress(null, true);
            return callback(err);
        }
        onProgress({loaded: FileSize, total: FileSize}, true);
        if (data && data.headers && data.headers['etag']) {
            var url = getUrl({
                protocol: self.options.Protocol,
                domain: self.options.Domain,
                bucket: params.Bucket,
                region: params.Region,
                object: params.Key,
            });
            return callback(null, {
                Location: url,
                ETag: data.headers['etag'],
                statusCode: data.statusCode,
                headers: data.headers,
            });
        }
        callback(null, data);
    });
}

/**
 * 删除 object
 * @param  {Object}  params                     参数对象，必须
 *     @param  {String}  params.Bucket          Bucket名称，必须
 *     @param  {String}  params.Region          地域名称，必须
 *     @param  {String}  params.Key             object名称，必须
 * @param  {Function}  callback                 回调函数，必须
 * @param  {Object}  err                        请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @param  {Object}  data                       删除操作成功之后返回的数据
 */
function deleteObject(params, callback) {
    submitRequest.call(this, {
        method: 'DELETE',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        headers: params.Headers,
        VersionId: params.VersionId,
    }, function (err, data) {
        if (err) {
            var statusCode = err.statusCode;
            if (statusCode && statusCode === 204) {
                return callback(null, {statusCode: statusCode});
            } else if (statusCode && statusCode === 404) {
                return callback(null, {BucketNotFound: true, statusCode: statusCode,});
            } else {
                return callback(err);
            }
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 获取 object 的 权限列表
 * @param  {Object}  params                         参数对象，必须
 *     @param  {String}  params.Bucket              Bucket名称，必须
 *     @param  {String}  params.Region              地域名称，必须
 *     @param  {String}  params.Key                 object名称，必须
 * @param  {Function}  callback                     回调函数，必须
 * @return  {Object}  err                           请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                          返回的数据
 *     @return  {Object}  data.AccessControlPolicy  权限列表
 */
function getObjectAcl(params, callback) {

    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        headers: params.Headers,
        action: 'acl',
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var AccessControlPolicy = data.AccessControlPolicy || {};
        var Owner = AccessControlPolicy.Owner || {};
        var Grant = AccessControlPolicy.AccessControlList && AccessControlPolicy.AccessControlList.Grant || [];
        Grant = util.isArray(Grant) ? Grant : [Grant];
        var result = decodeAcl(AccessControlPolicy);
        if (data.headers && data.headers['x-cos-acl']) {
            result.ACL = data.headers['x-cos-acl'];
        }
        result = util.extend(result, {
            Owner: Owner,
            Grants: Grant,
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

/**
 * 设置 object 的 权限列表
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 *     @param  {String}  params.Key     object名称，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回的数据
 */
function putObjectAcl(params, callback) {
    var headers = params.Headers;

    var xml = '';
    if (params['AccessControlPolicy']) {
        var AccessControlPolicy = util.clone(params['AccessControlPolicy'] || {});
        var Grants = AccessControlPolicy.Grants || AccessControlPolicy.Grant;
        Grants = util.isArray(Grants) ? Grants : [Grants];
        delete AccessControlPolicy.Grant;
        delete AccessControlPolicy.Grants;
        AccessControlPolicy.AccessControlList = {Grant: Grants};
        xml = util.json2xml({AccessControlPolicy: AccessControlPolicy});

        headers['Content-Type'] = 'application/xml';
        headers['Content-MD5'] = util.binaryBase64(util.md5(xml));
    }

    // Grant Header 去重
    util.each(headers, function (val, key) {
        if (key.indexOf('x-cos-grant-') === 0) {
            headers[key] = uniqGrant(headers[key]);
        }
    });

    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        action: 'acl',
        headers: headers,
        body: xml,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * Options Object请求实现跨域访问的预请求。即发出一个 OPTIONS 请求给服务器以确认是否可以进行跨域操作。
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Bucket  Bucket名称，必须
 *     @param  {String}  params.Region  地域名称，必须
 *     @param  {String}  params.Key     object名称，必须
 * @param  {Function}  callback         回调函数，必须
 * @return  {Object}  err               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data              返回的数据
 */
function optionsObject(params, callback) {

    var headers = params.Headers;
    headers['Origin'] = params['Origin'];
    headers['Access-Control-Request-Method'] = params['AccessControlRequestMethod'];
    headers['Access-Control-Request-Headers'] = params['AccessControlRequestHeaders'];

    submitRequest.call(this, {
        method: 'OPTIONS',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        headers: headers,
    }, function (err, data) {
        if (err) {
            if (err.statusCode && err.statusCode === 403) {
                return callback(null, {
                    OptionsForbidden: true,
                    statusCode: err.statusCode
                });
            }
            return callback(err);
        }

        var headers = data.headers || {};
        callback(null, {
            AccessControlAllowOrigin: headers['access-control-allow-origin'],
            AccessControlAllowMethods: headers['access-control-allow-methods'],
            AccessControlAllowHeaders: headers['access-control-allow-headers'],
            AccessControlExposeHeaders: headers['access-control-expose-headers'],
            AccessControlMaxAge: headers['access-control-max-age'],
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * @param  {Object}                                     参数列表
 *     @param  {String}  Bucket                         Bucket 名称
 *     @param  {String}  Region                         地域名称
 *     @param  {String}  Key                            文件名称
 *     @param  {String}  CopySource                     源文件URL绝对路径，可以通过versionid子资源指定历史版本
 *     @param  {String}  ACL                            允许用户自定义文件权限。有效值：private，public-read默认值：private。
 *     @param  {String}  GrantRead                      赋予被授权者读的权限，格式 x-cos-grant-read: uin=" ",uin=" "，当需要给子账户授权时，uin="RootAcountID/SubAccountID"，当需要给根账户授权时，uin="RootAcountID"。
 *     @param  {String}  GrantWrite                     赋予被授权者写的权限，格式 x-cos-grant-write: uin=" ",uin=" "，当需要给子账户授权时，uin="RootAcountID/SubAccountID"，当需要给根账户授权时，uin="RootAcountID"。
 *     @param  {String}  GrantFullControl               赋予被授权者读写权限，格式 x-cos-grant-full-control: uin=" ",uin=" "，当需要给子账户授权时，uin="RootAcountID/SubAccountID"，当需要给根账户授权时，uin="RootAcountID"。
 *     @param  {String}  MetadataDirective              是否拷贝元数据，枚举值：Copy, Replaced，默认值Copy。假如标记为Copy，忽略Header中的用户元数据信息直接复制；假如标记为Replaced，按Header信息修改元数据。当目标路径和原路径一致，即用户试图修改元数据时，必须为Replaced
 *     @param  {String}  CopySourceIfModifiedSince      当Object在指定时间后被修改，则执行操作，否则返回412。可与x-cos-copy-source-If-None-Match一起使用，与其他条件联合使用返回冲突。
 *     @param  {String}  CopySourceIfUnmodifiedSince    当Object在指定时间后未被修改，则执行操作，否则返回412。可与x-cos-copy-source-If-Match一起使用，与其他条件联合使用返回冲突。
 *     @param  {String}  CopySourceIfMatch              当Object的Etag和给定一致时，则执行操作，否则返回412。可与x-cos-copy-source-If-Unmodified-Since一起使用，与其他条件联合使用返回冲突。
 *     @param  {String}  CopySourceIfNoneMatch          当Object的Etag和给定不一致时，则执行操作，否则返回412。可与x-cos-copy-source-If-Modified-Since一起使用，与其他条件联合使用返回冲突。
 *     @param  {String}  StorageClass                   存储级别，枚举值：存储级别，枚举值：Standard, Standard_IA，Nearline；默认值：Standard
 *     @param  {String}  CacheControl                   指定所有缓存机制在整个请求/响应链中必须服从的指令。
 *     @param  {String}  ContentDisposition             MIME 协议的扩展，MIME 协议指示 MIME 用户代理如何显示附加的文件
 *     @param  {String}  ContentEncoding                HTTP 中用来对「采用何种编码格式传输正文」进行协定的一对头部字段
 *     @param  {String}  ContentLength                  设置响应消息的实体内容的大小，单位为字节
 *     @param  {String}  ContentType                    RFC 2616 中定义的 HTTP 请求内容类型（MIME），例如text/plain
 *     @param  {String}  Expect                         请求的特定的服务器行为
 *     @param  {String}  Expires                        响应过期的日期和时间
 *     @param  {String}  params.ServerSideEncryption   支持按照指定的加密算法进行服务端数据加密，格式 x-cos-server-side-encryption: "AES256"，非必须
 *     @param  {String}  ContentLanguage                指定内容语言
 *     @param  {String}  x-cos-meta-*                   允许用户自定义的头部信息，将作为 Object 元数据返回。大小限制2K。
 */
function putObjectCopy(params, callback) {
    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        VersionId: params.VersionId,
        headers: params.Headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var result = util.clone(data.CopyObjectResult || {});
        util.extend(result, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

function uploadPartCopy(params, callback) {
    submitRequest.call(this, {
        method: 'PUT',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        VersionId: params.VersionId,
        qs: {
            partNumber: params['PartNumber'],
            uploadId: params['UploadId'],
        },
        headers: params.Headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var result = util.clone(data.CopyObjectResult || {});
        util.extend(result, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

function deleteMultipleObject(params, callback) {
    var Objects = params.Objects || {};
    var Quiet = params.Quiet;

    var xml = util.json2xml({Delete: {Object: Objects, Quiet: Quiet || false}});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'POST',
        Bucket: params.Bucket,
        Region: params.Region,
        body: xml,
        action: 'delete',
        headers: headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var DeleteResult = data.DeleteResult || {};
        var Deleted = DeleteResult.Deleted || [];
        var Errors = DeleteResult.Error || [];

        Deleted = util.isArray(Deleted) ? Deleted : [Deleted];
        Errors = util.isArray(Errors) ? Errors : [Errors];

        var result = util.clone(DeleteResult);
        util.extend(result, {
            Error: Errors,
            Deleted: Deleted,
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

function restoreObject(params, callback) {
    var headers = params.Headers;
    if (!params['RestoreRequest']) {
        callback({error: 'missing param RestoreRequest'});
        return;
    }

    var RestoreRequest = params.RestoreRequest || {};
    var xml = util.json2xml({RestoreRequest: RestoreRequest});

    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'POST',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        VersionId: params.VersionId,
        body: xml,
        action: 'restore',
        headers: headers,
    }, function (err, data) {
        callback(err, data);
    });
}


// 分块上传


/**
 * 初始化分块上传
 * @param  {Object}  params                                     参数对象，必须
 *     @param  {String}  params.Bucket                          Bucket名称，必须
 *     @param  {String}  params.Region                          地域名称，必须
 *     @param  {String}  params.Key                             object名称，必须
 *     @param  {String}  params.UploadId                        object名称，必须
 *     @param  {String}  params.CacheControl                    RFC 2616 中定义的缓存策略，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ContentDisposition              RFC 2616 中定义的文件名称，将作为 Object 元数据保存    ，非必须
 *     @param  {String}  params.ContentEncoding                 RFC 2616 中定义的编码格式，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ContentType                     RFC 2616 中定义的内容类型（MIME），将作为 Object 元数据保存，非必须
 *     @param  {String}  params.Expires                         RFC 2616 中定义的过期时间，将作为 Object 元数据保存，非必须
 *     @param  {String}  params.ACL                             允许用户自定义文件权限，非必须
 *     @param  {String}  params.GrantRead                       赋予被授权者读的权限 ，非必须
 *     @param  {String}  params.GrantWrite                      赋予被授权者写的权限 ，非必须
 *     @param  {String}  params.GrantFullControl                赋予被授权者读写权限 ，非必须
 *     @param  {String}  params.StorageClass                    设置Object的存储级别，枚举值：Standard，Standard_IA，Nearline，非必须
 *     @param  {String}  params.ServerSideEncryption           支持按照指定的加密算法进行服务端数据加密，格式 x-cos-server-side-encryption: "AES256"，非必须
 * @param  {Function}  callback                                 回调函数，必须
 * @return  {Object}  err                                       请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                                      返回的数据
 */
function multipartInit(params, callback) {
    submitRequest.call(this, {
        method: 'POST',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        action: 'uploads',
        headers: params.Headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        data = util.clone(data || {});
        if (data && data.InitiateMultipartUploadResult) {
            return callback(null, util.extend(data.InitiateMultipartUploadResult, {
                statusCode: data.statusCode,
                headers: data.headers,
            }));
        }
        callback(null, data);
    });
}

/**
 * 分块上传
 * @param  {Object}  params                                 参数对象，必须
 *     @param  {String}  params.Bucket                      Bucket名称，必须
 *     @param  {String}  params.Region                      地域名称，必须
 *     @param  {String}  params.Key                         object名称，必须
 *     @param  {Buffer || Stream || String}  params.Body    上传文件对象或字符串
 *     @param  {String} params.ContentLength                RFC 2616 中定义的 HTTP 请求内容长度（字节），非必须
 *     @param  {String} params.Expect                       当使用 Expect: 100-continue 时，在收到服务端确认后，才会发送请求内容，非必须
 *     @param  {String} params.ServerSideEncryption         支持按照指定的加密算法进行服务端数据加密，格式 x-cos-server-side-encryption: "AES256"，非必须
 *     @param  {String} params.ContentSha1                  RFC 3174 中定义的 160-bit 内容 SHA-1 算法校验值，非必须
 * @param  {Function}  callback                             回调函数，必须
 *     @return  {Object}  err                               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 *     @return  {Object}  data                              返回的数据
 *     @return  {Object}  data.ETag                         返回的文件分块 sha1 值
 */
function multipartUpload(params, callback) {

    var self = this;
    util.getFileSize('multipartUpload', params, function () {
        submitRequest.call(self, {
            TaskId: params.TaskId,
            method: 'PUT',
            Bucket: params.Bucket,
            Region: params.Region,
            Key: params.Key,
            qs: {
                partNumber: params['PartNumber'],
                uploadId: params['UploadId'],
            },
            headers: params.Headers,
            onProgress: params.onProgress,
            body: params.Body || null
        }, function (err, data) {
            if (err) {
                return callback(err);
            }
            data['headers'] = data['headers'] || {};
            callback(null, {
                ETag: data['headers']['etag'] || '',
                statusCode: data.statusCode,
                headers: data.headers,
            });
        });
    });

}

/**
 * 完成分块上传
 * @param  {Object}  params                             参数对象，必须
 *     @param  {String}  params.Bucket                  Bucket名称，必须
 *     @param  {String}  params.Region                  地域名称，必须
 *     @param  {String}  params.Key                     object名称，必须
 *     @param  {Array}   params.Parts                   分块信息列表，必须
 *     @param  {String}  params.Parts[i].PartNumber     块编号，必须
 *     @param  {String}  params.Parts[i].ETag           分块的 sha1 校验值
 * @param  {Function}  callback                         回调函数，必须
 * @return  {Object}  err                               请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                              返回的数据
 *     @return  {Object}  data.CompleteMultipartUpload  完成分块上传后的文件信息，包括Location, Bucket, Key 和 ETag
 */
function multipartComplete(params, callback) {
    var self = this;

    var UploadId = params.UploadId;

    var Parts = params['Parts'];

    for (var i = 0, len = Parts.length; i < len; i++) {
        if (Parts[i]['ETag'].indexOf('"') === 0) {
            continue;
        }
        Parts[i]['ETag'] = '"' + Parts[i]['ETag'] + '"';
    }

    var xml = util.json2xml({CompleteMultipartUpload: {Part: Parts}});

    var headers = params.Headers;
    headers['Content-Type'] = 'application/xml';
    headers['Content-MD5'] = util.binaryBase64(util.md5(xml));

    submitRequest.call(this, {
        method: 'POST',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        qs: {
            uploadId: UploadId
        },
        body: xml,
        headers: headers,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var url = getUrl({
            protocol: self.options.Protocol,
            domain: self.options.Domain,
            bucket: params.Bucket,
            region: params.Region,
            object: params.Key,
            isLocation: true,
        });
        var CompleteMultipartUploadResult = data.CompleteMultipartUploadResult || {};
        var result = util.extend(CompleteMultipartUploadResult, {
            Location: url,
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

/**
 * 分块上传任务列表查询
 * @param  {Object}  params                                 参数对象，必须
 *     @param  {String}  params.Bucket                      Bucket名称，必须
 *     @param  {String}  params.Region                      地域名称，必须
 *     @param  {String}  params.Delimiter                   定界符为一个符号，如果有Prefix，则将Prefix到delimiter之间的相同路径归为一类，定义为Common Prefix，然后列出所有Common Prefix。如果没有Prefix，则从路径起点开始，非必须
 *     @param  {String}  params.EncodingType                规定返回值的编码方式，非必须
 *     @param  {String}  params.Prefix                      前缀匹配，用来规定返回的文件前缀地址，非必须
 *     @param  {String}  params.MaxUploads                  单次返回最大的条目数量，默认1000，非必须
 *     @param  {String}  params.KeyMarker                   与upload-id-marker一起使用 </Br>当upload-id-marker未被指定时，ObjectName字母顺序大于key-marker的条目将被列出 </Br>当upload-id-marker被指定时，ObjectName字母顺序大于key-marker的条目被列出，ObjectName字母顺序等于key-marker同时UploadId大于upload-id-marker的条目将被列出，非必须
 *     @param  {String}  params.UploadIdMarker              与key-marker一起使用 </Br>当key-marker未被指定时，upload-id-marker将被忽略 </Br>当key-marker被指定时，ObjectName字母顺序大于key-marker的条目被列出，ObjectName字母顺序等于key-marker同时UploadId大于upload-id-marker的条目将被列出，非必须
 * @param  {Function}  callback                             回调函数，必须
 * @return  {Object}  err                                   请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                                  返回的数据
 *     @return  {Object}  data.ListMultipartUploadsResult   分块上传任务信息
 */
function multipartList(params, callback) {
    var reqParams = {};

    reqParams['delimiter'] = params['Delimiter'];
    reqParams['encoding-type'] = params['EncodingType'];
    reqParams['prefix'] = params['Prefix'];

    reqParams['max-uploads'] = params['MaxUploads'];

    reqParams['key-marker'] = params['KeyMarker'];
    reqParams['upload-id-marker'] = params['UploadIdMarker'];

    reqParams = util.clearKey(reqParams);

    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        headers: params.Headers,
        qs: reqParams,
        action: 'uploads',
    }, function (err, data) {
        if (err) {
            return callback(err);
        }

        if (data && data.ListMultipartUploadsResult) {
            var Upload = data.ListMultipartUploadsResult.Upload || [];

            var CommonPrefixes = data.ListMultipartUploadsResult.CommonPrefixes || [];

            CommonPrefixes = util.isArray(CommonPrefixes) ? CommonPrefixes : [CommonPrefixes];
            Upload = util.isArray(Upload) ? Upload : [Upload];

            data.ListMultipartUploadsResult.Upload = Upload;
            data.ListMultipartUploadsResult.CommonPrefixes = CommonPrefixes;
        }
        var result = util.clone(data.ListMultipartUploadsResult || {});
        util.extend(result, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

/**
 * 上传的分块列表查询
 * @param  {Object}  params                                 参数对象，必须
 *     @param  {String}  params.Bucket                      Bucket名称，必须
 *     @param  {String}  params.Region                      地域名称，必须
 *     @param  {String}  params.Key                         object名称，必须
 *     @param  {String}  params.UploadId                    标示本次分块上传的ID，必须
 *     @param  {String}  params.EncodingType                规定返回值的编码方式，非必须
 *     @param  {String}  params.MaxParts                    单次返回最大的条目数量，默认1000，非必须
 *     @param  {String}  params.PartNumberMarker            默认以UTF-8二进制顺序列出条目，所有列出条目从marker开始，非必须
 * @param  {Function}  callback                             回调函数，必须
 * @return  {Object}  err                                   请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 * @return  {Object}  data                                  返回的数据
 *     @return  {Object}  data.ListMultipartUploadsResult   分块信息
 */
function multipartListPart(params, callback) {
    var reqParams = {};

    reqParams['uploadId'] = params['UploadId'];
    reqParams['encoding-type'] = params['EncodingType'];
    reqParams['max-parts'] = params['MaxParts'];
    reqParams['part-number-marker'] = params['PartNumberMarker'];

    submitRequest.call(this, {
        method: 'GET',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        headers: params.Headers,
        qs: reqParams,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        var ListPartsResult = data.ListPartsResult || {};
        var Part = ListPartsResult.Part || [];
        Part = util.isArray(Part) ? Part : [Part];

        ListPartsResult.Part = Part;
        var result = util.clone(ListPartsResult);
        util.extend(result, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
        callback(null, result);
    });
}

/**
 * 抛弃分块上传
 * @param  {Object}  params                 参数对象，必须
 *     @param  {String}  params.Bucket      Bucket名称，必须
 *     @param  {String}  params.Region      地域名称，必须
 *     @param  {String}  params.Key         object名称，必须
 *     @param  {String}  params.UploadId    标示本次分块上传的ID，必须
 * @param  {Function}  callback             回调函数，必须
 *     @return  {Object}    err             请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 *     @return  {Object}    data            返回的数据
 */
function multipartAbort(params, callback) {
    var reqParams = {};

    reqParams['uploadId'] = params['UploadId'];
    submitRequest.call(this, {
        method: 'DELETE',
        Bucket: params.Bucket,
        Region: params.Region,
        Key: params.Key,
        headers: params.Headers,
        qs: reqParams,
    }, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, {
            statusCode: data.statusCode,
            headers: data.headers,
        });
    });
}

/**
 * 获取签名
 * @param  {Object}  params             参数对象，必须
 *     @param  {String}  params.Method  请求方法，必须
 *     @param  {String}  params.Key     object名称，必须
 *     @param  {String}  params.Expires 名超时时间，单位秒，可选
 * @return  {String}  data              返回签名字符串
 */
function getAuth(params) {
    return util.getAuth({
        SecretId: params.SecretId || this.options.SecretId || '',
        SecretKey: params.SecretKey || this.options.SecretKey || '',
        Method: params.Method,
        Key: params.Key,
        Query: params.Query,
        Headers: params.Headers,
        Expires: params.Expires,
    });
}

function getV4Auth(params) {
    return util.getV4Auth({
        SecretId: params.SecretId || this.options.SecretId || '',
        SecretKey: params.SecretKey || this.options.SecretKey || '',
        Bucket: params.Bucket,
        Key: params.Key,
        Expires: params.Expires,
    });
}

/**
 * 获取文件下载链接
 * @param  {Object}  params                 参数对象，必须
 *     @param  {String}  params.Bucket      Bucket名称，必须
 *     @param  {String}  params.Region      地域名称，必须
 *     @param  {String}  params.Key         object名称，必须
 *     @param  {String}  params.Method      请求的方法，可选
 *     @param  {String}  params.Expires     签名超时时间，单位秒，可选
 * @param  {Function}  callback             回调函数，必须
 *     @return  {Object}    err             请求失败的错误，如果请求成功，则为空。https://cloud.tencent.com/document/product/436/7730
 *     @return  {Object}    data            返回的数据
 */
function getObjectUrl(params, callback) {
    var self = this;
    var url = getUrl({
        protocol: self.options.Protocol,
        domain: self.options.Domain,
        bucket: params.Bucket,
        region: params.Region,
        object: params.Key,
    });
    if (params.Sign !== undefined && !params.Sign) {
        callback(null, {Url: url});
        return url;
    }
    var authorization = getAuthorizationAsync.call(this, {
        Bucket: params.Bucket || '',
        Region: params.Region || '',
        Method: params.Method || 'get',
        Key: params.Key,
        Expires: params.Expires,
    }, function (AuthData) {
        if (!callback) return;
        var result = {
            Url: url + '?sign=' + encodeURIComponent(AuthData.Authorization),
        };
        AuthData.XCosSecurityToken && (result.XCosSecurityToken = AuthData.XCosSecurityToken);
        AuthData.ClientIP && (result.ClientIP = AuthData.ClientIP);
        AuthData.ClientUA && (result.ClientUA = AuthData.ClientUA);
        AuthData.Token && (result.Token = AuthData.Token);
        setTimeout(function () {
            callback(null, result);
        });
    });
    if (authorization) {
        return url + '?sign=' + encodeURIComponent(authorization);
    } else {
        return url;
    }
}


/**
 * 私有方法
 */
function decodeAcl(AccessControlPolicy) {
    var result = {
        GrantFullControl: [],
        GrantWrite: [],
        GrantRead: [],
        GrantReadAcp: [],
        GrantWriteAcp: [],
        ACL: '',
    };
    var GrantMap = {
        'FULL_CONTROL': 'GrantFullControl',
        'WRITE': 'GrantWrite',
        'READ': 'GrantRead',
        'READ_ACP': 'GrantReadAcp',
        'WRITE_ACP': 'GrantWriteAcp',
    };
    var Grant = AccessControlPolicy.AccessControlList.Grant;
    if (Grant) {
        Grant = util.isArray(Grant) ? Grant : [Grant];
    }
    var PublicAcl = {READ: 0, WRITE: 0, FULL_CONTROL: 0};
    Grant.length && util.each(Grant, function (item) {
        if (item.Grantee.ID === 'qcs::cam::anyone:anyone' || item.Grantee.URI === 'http://cam.qcloud.com/groups/global/AllUsers') {
            PublicAcl[item.Permission] = 1;
        } else if (item.Grantee.ID !== AccessControlPolicy.Owner.ID) {
            result[GrantMap[item.Permission]].push('id="' + item.Grantee.ID + '"');
        }
    });
    if (PublicAcl.FULL_CONTROL || (PublicAcl.WRITE && PublicAcl.READ)) {
        result.ACL = 'public-read-write';
    } else if (PublicAcl.READ) {
        result.ACL = 'public-read';
    } else {
        result.ACL = 'private';
    }
    util.each(GrantMap, function (item) {
        result[item] = uniqGrant(result[item].join(','));
    });
    return result;
}

// Grant 去重
function uniqGrant(str) {
    var arr = str.split(',');
    var exist = {};
    var i, item;
    for (i = 0; i < arr.length; ) {
        item = arr[i].trim();
        if (exist[item]) {
            arr.splice(i, 1);
        } else {
            exist[item] = true;
            arr[i] = item;
            i++;
        }
    }
    return arr.join(',');
}

// 生成操作 url
function getUrl(params) {
    var longBucket = params.bucket;
    var shortBucket = longBucket.substr(0, longBucket.lastIndexOf('-'));
    var appId = longBucket.substr(longBucket.lastIndexOf('-') + 1);
    var domain = params.domain;
    var region = params.region;
    var object = params.object;
    var protocol = params.protocol || (util.isBrowser && location.protocol === 'http:' ? 'http:' : 'https:');
    if (!domain) {
        if (['cn-south', 'cn-south-2', 'cn-north', 'cn-east', 'cn-southwest', 'sg'].indexOf(region) > -1) {
            domain = '{{Bucket}}-{{AppId}}.{{Region}}.myqcloud.com';
        } else {
            domain = '{{Bucket}}-{{AppId}}.cos.{{Region}}.myqcloud.com';
        }
    }
    domain = domain.replace(/\{\{AppId\}\}/ig, appId)
        .replace(/\{\{Bucket\}\}/ig, shortBucket)
        .replace(/\{\{Region\}\}/ig, region)
        .replace(/\{\{.*?\}\}/ig, '');
    if (!/^[a-zA-Z]+:\/\//.test(domain)) {
        domain = protocol + '//' + domain;
    }
    if (domain.slice(-1) === '/') {
        domain = domain.slice(0, -1);
    }
    var url = domain;

    if (object) {
        url += '/' + encodeURIComponent(object).replace(/%2F/g, '/');
    }

    if (params.isLocation) {
        url = url.replace(/^https?:\/\//, '');
    }
    return url;
}

// 异步获取签名
function getAuthorizationAsync(params, callback) {
    var self = this;
    var Bucket = params.Bucket || '';
    var Region = params.Region || '';
    self._StsMap = self._StsMap || {};
    var StsData = self._StsMap[Bucket + '.' + Region] || {};

    var calcAuthByTmpKey = function () {
        var Authorization = util.getAuth({
            SecretId: StsData.TmpSecretId,
            SecretKey: StsData.TmpSecretKey,
            Method: params.Method,
            Key: params.Key || '',
            Query: params.Query,
            Headers: params.Headers,
        });
        var AuthData = {
            Authorization: Authorization,
            XCosSecurityToken: StsData.XCosSecurityToken || '',
            Token: StsData.Token || '',
            ClientIP: StsData.ClientIP || '',
            ClientUA: StsData.ClientUA || '',
        };
        callback && callback(AuthData);
    };

    // 先判断是否有临时密钥
    if (StsData.ExpiredTime && StsData.ExpiredTime - (Date.now() / 1000 > 60)) { // 如果缓存的临时密钥有效，并还有超过60秒有效期就直接使用
        calcAuthByTmpKey();
    } else if (self.options.getAuthorization) { // 外部计算签名或获取临时密钥
        self.options.getAuthorization.call(self, {
            Bucket: Bucket,
            Region: Region,
            Method: params.Method,
            Key: params.Key || '',
            Query: params.Query,
            Headers: params.Headers,
        }, function (AuthData) {
            if (typeof AuthData === 'string') {
                AuthData = {Authorization: AuthData};
            }
            if (AuthData.TmpSecretId &&
                AuthData.TmpSecretKey &&
                AuthData.XCosSecurityToken &&
                AuthData.ExpiredTime) {
                StsData = self._StsMap[Bucket + '.' + Region] = AuthData;
                calcAuthByTmpKey();
            } else {
                callback && callback(AuthData);
            }
        });
    } else if (self.options.getSTS) { // 外部获取临时密钥
        self.options.getSTS.call(self, {
            Bucket: Bucket,
            Region: Region,
        }, function (data) {
            StsData = self._StsMap[Bucket + '.' + Region] = data || {};
            StsData.TmpSecretId = StsData.SecretId;
            StsData.TmpSecretKey = StsData.SecretKey;
            calcAuthByTmpKey();
        });
    } else { // 内部计算获取签名
        var Authorization = util.getAuth({
            SecretId: params.SecretId || self.options.SecretId,
            SecretKey: params.SecretKey || self.options.SecretKey,
            Method: params.Method,
            Key: params.Key || '',
            Query: params.Query,
            Headers: params.Headers,
            Expires: params.Expires,
        });
        callback && callback({Authorization: Authorization});
        return Authorization;
    }
    return '';
}

// 获取签名并发起请求
function submitRequest(params, callback) {
    var self = this;

    // 处理 headers
    !params.headers && (params.headers = {});
    params.headers['User-Agent'] = self.options.UserAgent || ('cos-nodejs-sdk-v5-' + pkg.version);

    // 处理 query
    !params.qs && (params.qs = {});
    params.VersionId && (params.qs.versionId = params.VersionId);
    params.qs = util.clearKey(params.qs);

    // 清理 undefined 和 null 字段
    params.headers && (params.headers = util.clearKey(params.headers));
    params.qs && (params.qs = util.clearKey(params.qs));

    var Query = util.clone(params.qs);
    params.action && (Query[params.action] = '');
    getAuthorizationAsync.call(self, {
        Bucket: params.Bucket || '',
        Region: params.Region || '',
        Method: params.method,
        Key: params.Key,
        Query: Query,
        Headers: params.headers,
    }, function (AuthData) {

        // 检查签名格式
        var auth = AuthData.Authorization;
        var formatAllow = false;
        if (auth) {
            if (auth.indexOf(' ') > -1) {
                formatAllow = false;
            } else if (auth.indexOf('q-sign-algorithm=') > -1 &&
                auth.indexOf('q-ak=') > -1 &&
                auth.indexOf('q-sign-time=') > -1 &&
                auth.indexOf('q-key-time=') > -1 &&
                auth.indexOf('q-url-param-list=') > -1) {
                formatAllow = true;
            } else {
                try {
                    auth = atob(auth);
                    if (auth.indexOf('a=') > -1 &&
                        auth.indexOf('k=') > -1 &&
                        auth.indexOf('t=') > -1 &&
                        auth.indexOf('r=') > -1 &&
                        auth.indexOf('b=') > -1) {
                        formatAllow = true;
                    }
                } catch (e) {}
            }
        }
        if (!formatAllow) {
            callback('authorization error');
            return;
        }

        params.AuthData = AuthData;
        _submitRequest.call(self, params, callback);
    });
}

// 发起请求
function _submitRequest(params, callback) {
    var self = this;
    var TaskId = params.TaskId;
    if (TaskId && !self._isRunningTask(TaskId)) return;

    var bucket = params.Bucket;
    var region = params.Region;
    var object = params.Key;
    var method = params.method || 'GET';
    var url = params.url;
    var body = params.body;
    var json = params.json;
    var rawBody = params.rawBody;

    // 处理 readStream and body
    var readStream;
    if (body && typeof body.pipe === 'function') {
        readStream = body;
        body = null;
    }

    // url
    url = url || getUrl({
        protocol: self.options.Protocol,
        domain: self.options.Domain,
        bucket: bucket,
        region: region,
        object: object,
    });
    if (params.action) {
        url  = url + (object ? '' : '/') + '?' + params.action;
    }

    var opt = {
        method: method,
        url: url,
        headers: params.headers,
        qs: params.qs,
        body: body,
        json: json,
    };

    // 获取签名
    opt.headers.Authorization = params.AuthData.Authorization;
    params.AuthData.Token && (opt.headers['token'] = params.AuthData.Token);
    params.AuthData.ClientIP && (opt.headers['clientIP'] = params.AuthData.ClientIP);
    params.AuthData.ClientUA && (opt.headers['clientUA'] = params.AuthData.ClientUA);
    params.AuthData.XCosSecurityToken && (opt.headers['x-cos-security-token'] = params.AuthData.XCosSecurityToken);

    // 清理 undefined 和 null 字段
    opt.headers && (opt.headers = util.clearKey(opt.headers));
    opt = util.clearKey(opt);

    if (this.options.Proxy) {
        opt.proxy = this.options.Proxy;
    }

    var sender = REQUEST(opt);
    var retResponse;
    var hasReturned;
    var cb = function (err, data) {
        TaskId && self.off('inner-kill-task', killTask);
        if (hasReturned) return;
        hasReturned = true;
        var attrs = {};
        retResponse && retResponse.statusCode && (attrs.statusCode = retResponse.statusCode);
        retResponse && retResponse.headers && (attrs.headers = retResponse.headers);
        if (err) {
            err = util.extend(err || {}, attrs);
            callback(err, null);
        } else {
            data = util.extend(data || {}, attrs);
            callback(null, data);
        }
    };
    var xml2json = function (body) {
        try {
            json = util.xml2json(body) || {};
        } catch (e) {
            json = body || {};
        }
        return json;
    };
    sender.on('error', function (err) {
        cb({error: err});
    });
    sender.on('response', function (response) {
        retResponse = response;
        var responseContentLength = response.headers['content-length'] || 0;
        var chunkList = [];
        var statusCode = response.statusCode;
        var statusSuccess = Math.floor(statusCode / 100) === 2; // 200 202 204 206
        if (statusSuccess && params.outputStream) {
            sender.on('end', function () {
                cb(null, {});
            });
        } else if (responseContentLength >= process.binding('buffer').kMaxLength) {
            cb({error: 'file size large than ' + process.binding('buffer').kMaxLength + ', please use "Output" Stream to getObject.'});
        } else {
            sender.on('data', function (chunk) {
                chunkList.push(chunk);
            });
            sender.on('end', function () {
                var json;
                try {
                    var body = Buffer.concat(chunkList);
                } catch (e) {
                    cb({error: e});
                    return;
                }
                var bodyStr = body.toString();
                if (statusSuccess) {
                    if (rawBody) { // 不对 body 进行转换，body 直接挂载返回
                        cb(null, {body: body});
                    } else if (body.length) {
                        json = xml2json(body.toString());
                        if (json && json.Error) {
                            cb({error: json.Error});
                        } else {
                            cb(null, json);
                        }
                    } else {
                        cb(null, {});
                    }
                } else {
                    bodyStr && (json = xml2json(bodyStr));
                    cb({error: json && json.Error || response.statusMessage || 'statusCode error'});
                }
            });
        }
    });

    // kill task
    var killTask = function (data) {
        if (data.TaskId === TaskId) {
            sender && sender.abort && sender.abort();
            self.off('inner-kill-task', killTask);
        }
    };
    TaskId && self.on('inner-kill-task', killTask);

    // upload progress
    if (params.onProgress && typeof params.onProgress === 'function') {
        var contentLength = opt.headers['Content-Length'];
        var time0 = Date.now();
        var size0 = 0;
        sender.on('drain', function () {
            var time1 = Date.now();
            var loaded = 0;
            try {
                loaded = sender.req.connection.bytesWritten - sender.req._header.length;
            } catch (e) {
            }
            var total = contentLength;
            var speed = parseInt((loaded - size0) / ((time1 - time0) / 1000) * 100) / 100;
            var percent = total ? (parseInt(loaded / total * 100) / 100) : 0;
            time0 = time1;
            size0 = loaded;
            params.onProgress({
                loaded: loaded,
                total: total,
                speed: speed,
                percent: percent,
            });
        });
    }
    // download progress
    if (params.onDownloadProgress && typeof params.onDownloadProgress === 'function') {
        var time0 = Date.now();
        var size0 = 0;
        var loaded = 0;
        var total = 0;
        sender.on('response', function (res) {
            total = res.headers['content-length'];
            sender.on('data', function (chunk) {
                loaded += chunk.length;
                var time1 = Date.now();
                var speed = parseInt((loaded - size0) / ((time1 - time0) / 1000) * 100) / 100;
                var percent = total ? (parseInt(loaded / total * 100) / 100) : 0;
                time0 = time1;
                size0 = loaded;
                params.onDownloadProgress({
                    loaded: loaded,
                    total: total,
                    speed: speed,
                    percent: percent,
                });
            });
        });
    }

    // pipe 输入
    if (readStream) {
        readStream.on('error', function (err) {
            sender.abort();
            callback(err);
        });
        readStream.pipe(sender);
    }
    // pipe 输出
    if (params.outputStream) {
        params.outputStream.on('error', function (err) {
            sender.abort();
            callback(err)
        });
        sender.pipe(params.outputStream);
    }

    return sender;

}


var API_MAP = {
    // Bucket 相关方法
    getService: getService,
    putBucket: putBucket,
    getBucket: getBucket,
    headBucket: headBucket,
    deleteBucket: deleteBucket,
    getBucketAcl: getBucketAcl,
    putBucketAcl: putBucketAcl,
    getBucketCors: getBucketCors,
    putBucketCors: putBucketCors,
    deleteBucketCors: deleteBucketCors,
    getBucketLocation: getBucketLocation,
    putBucketTagging: putBucketTagging,
    getBucketTagging: getBucketTagging,
    deleteBucketTagging: deleteBucketTagging,
    getBucketPolicy: getBucketPolicy,
    putBucketPolicy: putBucketPolicy,
    getBucketLifecycle: getBucketLifecycle,
    putBucketLifecycle: putBucketLifecycle,
    deleteBucketLifecycle: deleteBucketLifecycle,
    putBucketVersioning: putBucketVersioning,
    getBucketVersioning: getBucketVersioning,
    putBucketReplication: putBucketReplication,
    getBucketReplication: getBucketReplication,
    deleteBucketReplication: deleteBucketReplication,

    // Object 相关方法
    getObject: getObject,
    headObject: headObject,
    listObjectVersions: listObjectVersions,
    putObject: putObject,
    deleteObject: deleteObject,
    getObjectAcl: getObjectAcl,
    putObjectAcl: putObjectAcl,
    optionsObject: optionsObject,
    putObjectCopy: putObjectCopy,
    deleteMultipleObject: deleteMultipleObject,
    restoreObject: restoreObject,

    // 分块上传相关方法
    uploadPartCopy: uploadPartCopy,
    multipartInit: multipartInit,
    multipartUpload: multipartUpload,
    multipartComplete: multipartComplete,
    multipartList: multipartList,
    multipartListPart: multipartListPart,
    multipartAbort: multipartAbort,

    // 工具方法
    getObjectUrl: getObjectUrl,
    getAuth: getAuth,
    getV4Auth: getV4Auth,
};

util.each(API_MAP, function (fn, apiName) {
    exports[apiName] = util.apiWrapper(apiName, fn);
});
