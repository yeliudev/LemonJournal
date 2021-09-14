var util = require('../../utils/util.js')
var cos = require('../../utils/cos.js')
var config = require('../../config')
const app = getApp()

Page({
  data: {
    isNewJournal: true,
    journal_id: '',
    journal_book_id: '',
    previewImageUrl: '',
    previewImagePath: '',
    backgroundId: '',
    backgroundPath: '',
    assemblies: []
  },

  onLoad: function(options) {
    var that = this
    util.showLoading('正在渲染')

    // 解析数据
    options = JSON.parse(options.data)
    this.setData({
      isNewJournal: options.journal_id ? false : true,
      journal_id: options.journal_id,
      journal_book_id: options.journal_book_id,
      backgroundId: options.backgroundId,
      backgroundPath: options.backgroundPath,
      assemblies: options.assemblies
    })

    this.draw()
  },

  uploadImageCallback: function(e) {
    // 构造保存手帐组件信息的 Object
    this.componentObject = {
      backgroundId: this.data.backgroundId,
      assemblies: e
    }

    // 若为新手帐则添加新字段，否则更新数据
    if (this.data.isNewJournal) {
      wx.request({
        url: config.service.newJournalUrl,
        method: 'POST',
        header: {
          skey: app.globalData.skey
        },
        data: {
          journal_id: this.data.journal_id,
          journal_book_id: this.data.journal_book_id,
          title: '我的手帐',
          previewUrl: this.data.previewImageUrl,
          components: JSON.stringify(this.componentObject)
        },
        success: res => {
          if (res.data.success) {
            util.showSuccess('上传成功')
          } else {
            if (res.data.errMsg) {
              util.showModal('请求失败', res.data.errMsg)
            } else {
              util.showModal('请求失败', 'statusCode: ' + res.statusCode)
            }
          }
        },
        fail: error => {
          util.showModal('请求失败', error, true)
        }
      })
    } else {
      wx.request({
        url: config.service.setJournalUrl,
        method: 'POST',
        header: {
          skey: app.globalData.skey
        },
        data: {
          journal_id: this.data.journal_id,
          previewUrl: this.data.previewImageUrl,
          components: JSON.stringify(this.componentObject)
        },
        success: res => {
          if (res.data.success) {
            util.showSuccess('上传成功')
          } else {
            if (res.data.errMsg) {
              util.showModal('请求失败', res.data.errMsg)
            } else {
              util.showModal('请求失败', 'statusCode: ' + res.statusCode)
            }
          }
        },
        fail: error => {
          util.showModal('请求失败', error, true)
        }
      })
    }

  },

  draw: function() {
    // 按照 z-index 的大小对组件排序
    var sortedAssemblies = this.data.assemblies.sort(function(value1, value2) {
      if (value1.z_index < value2.z_index) {
        return -1;
      } else if (value1.z_index > value2.z_index) {
        return 1;
      } else {
        return 0;
      }
    })

    var ctx = wx.createCanvasContext('preview_canvas')
    // 设置文字对齐方式
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    // 绘制背景图
    ctx.drawImage(this.data.backgroundPath, 0, 0, 750, 1112)
    // 绘制组件
    for (var i in sortedAssemblies) {
      ctx.translate(sortedAssemblies[i].stickerCenterX, sortedAssemblies[i].stickerCenterY)
      ctx.rotate(sortedAssemblies[i].rotate * Math.PI / 180)
      switch (sortedAssemblies[i].component_type) {
        case 'sticker':
          {
            ctx.drawImage(sortedAssemblies[i].image_url, -100 * sortedAssemblies[i].scale, -100 * sortedAssemblies[i].scale, 200 * sortedAssemblies[i].scale, 200 * sortedAssemblies[i].scale)
            break
          }
        case 'image':
          {
            if (sortedAssemblies[i].wh_scale >= 1) {
              ctx.drawImage(sortedAssemblies[i].image_url, -100 * sortedAssemblies[i].scale, -100 * sortedAssemblies[i].scale / sortedAssemblies[i].wh_scale, 200 * sortedAssemblies[i].scale, 200 * sortedAssemblies[i].scale / sortedAssemblies[i].wh_scale)
            } else {
              ctx.drawImage(sortedAssemblies[i].image_url, -100 * sortedAssemblies[i].scale * sortedAssemblies[i].wh_scale, -100 * sortedAssemblies[i].scale, 200 * sortedAssemblies[i].scale * sortedAssemblies[i].wh_scale, 200 * sortedAssemblies[i].scale)
            }
            break
          }
        case 'text':
          {
            // 初始化字体大小
            ctx.setFontSize(28 * sortedAssemblies[i].scale)

            // 分割字符串
            var textArray = sortedAssemblies[i].text.split(''),
              temp = '',
              row = []

            // 按长度组合每行的文本
            for (var j in textArray) {
              if (ctx.measureText(temp).width > 180 * sortedAssemblies[i].scale) {
                row.push(temp)
                temp = ''
              }
              temp += textArray[j]
            }
            row.push(temp)

            // 绘制文本
            for (var k in row) {
              ctx.fillText(row[k], 0, (4 * (k + 1) - 100) * sortedAssemblies[i].scale)
            }

            break
          }
      }
      // 恢复上下文状态
      ctx.rotate(-sortedAssemblies[i].rotate * Math.PI / 180)
      ctx.translate(-sortedAssemblies[i].stickerCenterX, -sortedAssemblies[i].stickerCenterY)
    }

    // 开始渲染
    var that = this
    ctx.draw(false, function() {
      wx.canvasToTempFilePath({
        canvasId: 'preview_canvas',
        success: res => {
          // 保存预览图临时路径
          that.setData({
            previewImagePath: res.tempFilePath
          })

          util.showLoading('正在上传')

          // 获取手帐 id
          wx.request({
            url: config.service.newJournalIdUrl,
            method: 'GET',
            header: {
              skey: app.globalData.skey
            },
            success: idRes => {
              if (idRes.data.success) {
                // 若为新手帐则刷新手帐id
                if (that.data.isNewJournal) {
                  that.setData({
                    journal_id: idRes.data.journal_id
                  })
                }

                // 上传图片数据
                cos.uploadImage(sortedAssemblies, that.data.journal_book_id, that.data.journal_id, that.data.previewImagePath, that, that.uploadImageCallback)
              } else {
                if (res.data.errMsg) {
                  util.showModal('请求失败', idRes.data.errMsg)
                } else {
                  util.showModal('请求失败', 'statusCode: ' + idRes.statusCode)
                }
              }
            },
            fail: idError => {
              util.showModal('请求失败', idError, true)
            }
          })
        },
        fail: error => {
          util.showModal('保存失败', error, true)
        }
      })
    })
  },

  onSaveJournal: function() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.previewImagePath,
      success: res => {
        util.showSuccess('保存成功')
      }
    })
  },

  onShareAppMessage: function(res) {
    return {
      title: '来制作属于自己的手帐吧',
      path: '/pages/index/index'
    }
  }
})