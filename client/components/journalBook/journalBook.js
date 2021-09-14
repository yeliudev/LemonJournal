var util = require('../../utils/util.js')
var config = require('../../config')
const app = getApp()

Component({
  properties: {
    journal_book_id: {
      type: String,
      value: ''
    },
    name: {
      type: String,
      value: ''
    },
    count: {
      type: Number,
      value: 0
    },
    background_id: {
      type: String,
      value: ''
    }
  },

  data: {
    bookCoverUrl: config.service.bookCoverUrl,
    bookCovers: [],
    newName: '',
    style: ''
  },

  methods: {
    onSettingsTap: function() {
      // 初始化封面选中状态
      this.data.bookCovers = new Array(12)
      this.data.bookCovers[this.data.background_id - 1] = 'box-shadow: 0 0 12px #365c8d;'

      this.setData({
        newName: '',
        bookCovers: this.data.bookCovers,
        style: 'transform: rotateY(180deg);'
      })
    },

    onBookTap: function() {
      if (app.globalData.authorized) {
        wx.navigateTo({
          url: '/pages/journalList/journalList?journal_book_id=' + this.data.journal_book_id
        })
      } else {
        wx.showModal({
          content: '请先授权登录',
          showCancel: false
        })
      }
    },

    onBlur: function(e) {
      this.setData({
        newName: e.detail.value
      })
    },

    onBookCoverTap: function(e) {
      // 更新封面选中状态
      this.data.bookCovers = new Array(12)
      this.data.bookCovers[e.target.id - 1] = 'box-shadow: 0 0 12px #365c8d;'

      this.setData({
        background_id: e.target.id,
        bookCovers: this.data.bookCovers
      })
    },

    onReturnButtonTap: function() {
      this.triggerEvent('refreshBookList')
      this.setData({
        style: ''
      })
    },

    onSubmitButtonTap: function() {
      var that = this

      wx.request({
        url: config.service.setJournalBookUrl,
        method: 'POST',
        header: {
          skey: app.globalData.skey
        },
        data: {
          journal_book_id: this.data.journal_book_id,
          name: this.data.newName ? this.data.newName : this.data.name,
          background_id: this.data.background_id
        },
        success: res => {
          if (res.data.success) {
            util.showSuccess('修改成功')
          } else {
            if (res.data.errMsg) {
              util.showModal('请求失败', res.data.errMsg)
            } else {
              util.showModal('请求失败', 'statusCode: ' + res.statusCode)
            }
          }
          that.triggerEvent('refreshBookList')
        },
        fail: error => {
          util.showModal('请求失败', error, true)
        }
      })
      this.setData({
        style: ''
      })
    },

    onRemoveButtonTap: function() {
      var that = this

      wx.showActionSheet({
        itemList: ['确认移除'],
        itemColor: '#E64340',
        success: res => {
          wx.request({
            url: config.service.delJournalBookUrl,
            method: 'POST',
            header: {
              skey: app.globalData.skey
            },
            data: {
              journal_book_id: that.data.journal_book_id,
            },
            success: res => {
              if (res.data.success) {
                util.showSuccess('移除成功')
              } else {
                if (res.data.errMsg) {
                  util.showModal('请求失败', res.data.errMsg)
                } else {
                  util.showModal('请求失败', 'statusCode: ' + res.statusCode)
                }
              }
              that.setData({
                style: ''
              })
              that.triggerEvent('refreshBookList')
            },
            fail: error => {
              util.showModal('请求失败', error, true)
              that.setData({
                style: ''
              })
              that.triggerEvent('refreshBookList')
            }
          })
        }
      })
    }
  }
})