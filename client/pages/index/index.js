var util = require('../../utils/util.js')
var config = require('../../config')
const app = getApp()

Page({
  data: {
    authorized: true, // 默认值设置为 true 以防止授权数据在 onLoad 之后才返回
    bookList: [],
    bookCoverUrl: config.service.bookCoverUrl,
    bookCovers: [],
    name: '',
    background_id: '1'
  },

  onLoad: function () {
    // 判断用户是否已经授权
    this.setData({
      authorized: app.globalData.authorized ? true : false,
    })
    app.userInfoReadyCallback = () => {
      this.setData({
        authorized: false
      })
    }

    // 刷新手帐本列表数据
    if (app.globalData.authorized) {
      util.getBookList(this, true)
    }
    app.skeyReadyCallback = () => {
      util.getBookList(this, true)
    }
  },

  onShow: function () {
    util.getBookList(this)
  },

  onGetUserInfo: function (e) {
    var that = this
    if (e.detail.errMsg === 'getUserInfo:ok') {
      app.globalData.authorized = true
      // 执行登录请求
      util.getUserInfo(function () {
        that.setData({
          authorized: true,
        })
        // 刷新手帐本列表数据
        util.getBookList(that, true)
      })
    }
  },

  onRefreshBookList: function () {
    util.getBookList(this)
  },

  onAvatarTap: function () {
    util.showAbout()
  },

  onNewJournalBookTap: function () {
    // 若未授权则直接返回
    if (!app.globalData.authorized) {
      util.showModal('提示', '请先授权登录')
      return
    }

    // 初始化封面选中状态
    this.data.bookCovers = new Array(12)
    this.data.bookCovers[0] = 'box-shadow: 0 0 12px #365c8d;'

    this.setData({
      name: '',
      background_id: '1',
      bookCovers: this.data.bookCovers,
      style: 'transform: rotateY(180deg);'
    })
  },

  onBlur: function (e) {
    this.setData({
      name: e.detail.value
    })
  },

  onBookCoverTap: function (e) {
    // 更新封面选中状态
    this.data.bookCovers = new Array(12)
    this.data.bookCovers[e.target.id - 1] = 'box-shadow: 0 0 12px #365c8d;'

    this.setData({
      background_id: e.target.id,
      bookCovers: this.data.bookCovers
    })
  },

  onReturnButtonTap: function () {
    util.getBookList(this)
    this.setData({
      style: ''
    })
  },

  onSubmitButtonTap: function () {
    var that = this
    wx.request({
      url: config.service.newJournalBookUrl,
      method: 'POST',
      header: { skey: app.globalData.skey },
      data: {
        name: this.data.name ? this.data.name : '我的手帐本',
        background_id: this.data.background_id
      },
      success: res => {
        if (res.data.success) {
          util.showSuccess('添加成功')
          util.getBookList(that)
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
        util.getBookList(that)
      }
    })
    this.setData({
      style: ''
    })
  },

  onAddNewJournal: function () {
    // 若当前无可用手账本则直接返回
    if (this.data.bookList.length === 0) {
      util.showModal('提示', '请先添加手帐本')
      return
    }

    wx.navigateTo({
      url: '/pages/edit/edit'
    })
  }
})