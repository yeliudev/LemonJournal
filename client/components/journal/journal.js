var util = require('../../utils/util.js')
var config = require('../../config')
const app = getApp()

Component({
  properties: {
    journal_id: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    previewImageUrl: {
      type: String,
      value: ''
    },
    date: {
      type: String,
      value: ''
    }
  },

  data: {
    editingJournalName: false
  },

  methods: {
    onJournalTap: function() {
      wx.navigateTo({
        url: '/pages/edit/edit?journal_id=' + this.data.journal_id
      })
    },

    // 点击设置图标则弹出设置 ActionSheet
    onSettingsTap: function() {
      var that = this

      wx.showActionSheet({
        itemList: ['保存到相册', '修改标题', '移除手帐'],
        success: res => {
          switch (res.tapIndex) {
            case 0:
              {
                // 下载预览图
                wx.downloadFile({
                  url: this.data.previewImageUrl,
                  success: downloadRes => {
                    // 保存预览图到相册
                    wx.saveImageToPhotosAlbum({
                      filePath: downloadRes.tempFilePath,
                      success: () => {
                        util.showSuccess('保存成功')
                      }
                    })
                  },
                  fail: error => {
                    util.showModal('添加失败', error, true)
                  }
                })
                break
              }
            case 1:
              {
                // 显示弹框
                this.setData({
                  editingJournalName: true
                })
                break
              }
            case 2:
              {
                wx.showModal({
                  title: '提示',
                  content: '确定移除手帐吗？',
                  success: res => {
                    if (res.confirm) {
                      wx.request({
                        url: config.service.delJournalUrl,
                        method: 'POST',
                        header: {
                          skey: app.globalData.skey
                        },
                        data: {
                          journal_id: that.data.journal_id,
                        },
                        success: res => {
                          if (res.data.success) {
                            that.triggerEvent('refreshJournalList')
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
                  }
                })
                break
              }
          }
        }
      })
    },

    onInputCancel: function() {
      // 隐藏弹框
      this.setData({
        editingJournalName: false
      })
    },

    onInputConfirm: function(e) {
      // 隐藏弹框
      this.setData({
        editingJournalName: false
      })

      // 手帐标题不同则发起修改请求
      if (e.detail && this.data.title != e.detail) {
        wx.request({
          url: config.service.setJournalUrl,
          method: 'POST',
          header: {
            skey: app.globalData.skey
          },
          data: {
            journal_id: this.data.journal_id,
            title: e.detail
          },
          success: res => {
            if (res.data.success) {
              this.triggerEvent('refreshJournalList')
            } else {
              util.showModal('请求失败', res.data.errMsg)
            }
          },
          fail: error => {
            util.showModal('请求失败', error, true)
          }
        })
      }
    }
  }
})