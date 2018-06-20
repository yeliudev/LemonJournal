# cos-nodejs-sdk-v5

腾讯云 COS Nodejs SDK（[XML API](https://cloud.tencent.com/document/product/436/7751)）

[releases and changelog](https://github.com/tencentyun/cos-nodejs-sdk-v5/releases)

## install

 [npm 地址](https://www.npmjs.com/package/cos-nodejs-sdk-v5)
 
```
npm i cos-nodejs-sdk-v5 --save
```

## demo

```javascript
// 引入模块
var COS = require('cos-nodejs-sdk-v5');
// 创建实例
var cos = new COS({
    SecretId: 'AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    SecretKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
});
// 分片上传
cos.sliceUploadFile({
    Bucket: 'test-1250000000', // Bucket 格式：test-1250000000
    Region: 'ap-guangzhou',
    Key: '1.zip',
    FilePath: './1.zip'
}, function (err, data) {
    console.log(err, data);
});
```

## 说明文档 

[使用例子](demo/demo.js)

[快速入门](https://cloud.tencent.com/document/product/436/8629)

[接口文档](https://cloud.tencent.com/document/product/436/12264)
