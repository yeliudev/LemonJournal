var util = require('util.js')
var config = require('../config')
const app = getApp()

var getSignature = () => {
  wx.request({
    url: config.service.signUrl,
    method: 'GET',
    header: {
      skey: app.globalData.skey
    },
    success: function(res) {
      return res.data.signature
    }
  })
}

// 上传图片到 COS 对象存储
var uploadImage = (localImageObjects, journal_book_id, journal_id, previewImagePath, page, callback) => {
  // 若无组件则直接返回空数组
  if (localImageObjects === []) {
    callback([])
    return
  }

  // 通过鉴权服务器计算签名
  wx.request({
    url: config.service.signUrl,
    method: 'GET',
    header: {
      skey: app.globalData.skey
    },
    success: res => {
      if (res.data.success) {
        // 上传预览图
        var previewFileName = Math.random().toString(36).substr(2, 4)
        wx.uploadFile({
          url: `${config.service.cosUrl}${res.data.data.open_id}/${journal_book_id}/${journal_id}/preview_${previewFileName}.png`,
          filePath: previewImagePath,
          header: {
            'Authorization': res.data.data.signature
          },
          name: 'filecontent',
          formData: {
            op: 'upload'
          },
          success: () => {
            // 保存预览图 URL
            page.setData({
              previewImageUrl: `${config.service.cos_host_cdn}/user_data/${res.data.data.open_id}/${journal_book_id}/${journal_id}/preview_${previewFileName}.png`
            })
            // 同步上传图片
            doUpload(res.data.data, localImageObjects, [], journal_book_id, journal_id, callback)
          },
          fail: error => {
            util.showModal('上传失败', error, true)
            return
          }
        })
      }
    }
  })
}

var doUpload = (data, localImageObjects, webImageObjects, journal_book_id, journal_id, callback) => {
  var imageObject = localImageObjects.pop()
  if (imageObject) {
    switch (imageObject.component_type) {
      case 'image':
        {
          wx.uploadFile({
            url: `${config.service.cosUrl}${data.open_id}/${journal_book_id}/${journal_id}/${imageObject.id}.png`,
            filePath: imageObject.image_url,
            header: {
              'Authorization': data.signature
            },
            name: 'filecontent',
            formData: {
              op: 'upload'
            },
            success: () => {
              imageObject.image_url = `${config.service.cos_host_cdn}/user_data/${data.open_id}/${journal_book_id}/${journal_id}/${imageObject.id}.png`
              webImageObjects.push(imageObject)
              doUpload(data, localImageObjects, webImageObjects, journal_book_id, journal_id, callback)
            },
            fail: error => {
              util.showModal('上传失败', error, true)
              return
            }
          })
          break
        }
      case 'sticker':
        {
          imageObject.image_url = `${config.service.stickerUrl}${imageObject.sticker_type}/${imageObject.sticker_id}.png`
          webImageObjects.push(imageObject)
          doUpload(data, localImageObjects, webImageObjects, journal_book_id, journal_id, callback)
          break
        }
      case 'text':
        {
          webImageObjects.push(imageObject)
          doUpload(data, localImageObjects, webImageObjects, journal_book_id, journal_id, callback)
          break
        }
    }
  } else {
    callback(webImageObjects)
  }
}

module.exports = {
  uploadImage
}