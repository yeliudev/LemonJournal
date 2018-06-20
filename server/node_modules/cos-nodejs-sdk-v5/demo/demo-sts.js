/**
 * 使用临时密钥请求的例子
 */

var COS = require('../index');
var sts = require('./sts');
var config = require('./config');

var cos = new COS({
    // 传入获取临时密钥的接口
    getSTS: sts.getSTS
});

cos.getBucket({
    Bucket: config.Bucket,
    Region: config.Region,
}, function (err, data) {
    console.log(err || data);
});