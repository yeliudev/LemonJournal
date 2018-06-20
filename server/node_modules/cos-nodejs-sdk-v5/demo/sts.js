/**
 * 获取临时密钥的例子
 */

var crypto = require('crypto');
var request = require('request');
var config = require('./config');

//固定分配给CSG的密钥
var Url = 'https://sts.api.qcloud.com/v2/index.php';
var Domain = 'sts.api.qcloud.com';

var util = {
    // 获取随机数
    getRandom: function (min, max) {
        return Math.round(Math.random() * (max - min) + min);
    },
    // json 转 query string
    json2str: function (obj, notEncode) {
        var arr = [];
        Object.keys(obj).sort().forEach(function (item) {
            var val = obj[item] || '';
            !notEncode && (val = encodeURIComponent(val));
            arr.push(item + '=' + val);
        });
        return arr.join('&');
    },
    // 计算签名
    getSignature: function (opt, key, method) {
        var formatString = method + Domain + '/v2/index.php?' + util.json2str(opt, 1);
        var hmac = crypto.createHmac('sha1', key);
        var sign = hmac.update(new Buffer(formatString, 'utf8')).digest('base64');
        return sign;
    },
};

// 拼接获取临时密钥的参数
var getSTS = function (options, callback) {

    var LongBucketName = options.Bucket || config.Bucket;
    var ShortBucketName = LongBucketName.substr(0, LongBucketName.indexOf('-'));
    var AppId = LongBucketName.substr(LongBucketName.indexOf('-') + 1);
    var policy = {
        'version': '2.0',
        'statement': [{
            'action': [
                'name/cos:*'
            ],
            'effect': 'allow',
            'principal': {'qcs': ['*']},
            'resource': [
                'qcs::cos:ap-guangzhou:uid/' + AppId + ':prefix//' + AppId + '/' + ShortBucketName,
                'qcs::cos:ap-guangzhou:uid/' + AppId + ':prefix//' + AppId + '/' + ShortBucketName + '/*'
            ]
        }]
    };

    var policyStr = JSON.stringify(policy);
    var Action = 'GetFederationToken';
    var Nonce = util.getRandom(10000, 20000);
    var Timestamp = parseInt(+new Date() / 1000);
    var Method = 'GET';

    var params = {
        Action: Action,
        Nonce: Nonce,
        Region: '',
        name: '',
        SecretId: config.SecretId,
        Timestamp: Timestamp,
        durationSeconds: 1800, // 最长 2 小时 7200
        policy: policyStr,
    };
    params.Signature = encodeURIComponent(util.getSignature(params, config.SecretKey, Method));

    var opt = {
        method: Method,
        url: Url + '?' + util.json2str(params, 1),
        rejectUnauthorized: false,
        headers: {
            Host: config.Domain
        },
    };
    request(opt, function (err, response, body) {
        body = body && JSON.parse(body);
        var data = body.data;
        var message = body.message;
        var error = err || message;
        if (error) {
            console.error(error);
            callback(null);
        } else {
            callback({
                SecretId: data.credentials && data.credentials.tmpSecretId,
                SecretKey: data.credentials && data.credentials.tmpSecretKey,
                XCosSecurityToken: data.credentials && data.credentials.sessionToken,
                ExpiredTime: data.expiredTime,
            });
        }
    });
};

module.exports = {
    getSTS: getSTS
};