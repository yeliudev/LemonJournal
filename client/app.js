var constants = require('./vendor/wafer2-client-sdk/lib/constants.js')
var SESSION_KEY = 'weapp_session_' + constants.WX_SESSION_MAGIC_ID
var util = require('./utils/util.js')

App({
  globalData: {
    authorized: true, // 默认值设置为 true 以防止授权数据在 Page.onLoad 之后才返回
    skey: '', // 由 session_key 通过 sha1 加密获得
    userInfo: {},
    bookList: []
  },

  onLaunch: function () {
    var that = this

    // 判断用户是否已授权
    wx.getSetting({
      success: res => {
        if (res.authSetting.hasOwnProperty('scope.userInfo') && res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用相关接口
          wx.checkSession({
            success: () => {
              // session_key 未过期，并且在本生命周期一直有效
              this.globalData.skey = wx.getStorageSync(SESSION_KEY)
              if (!this.globalData.skey) {
                util.getUserInfo(function () {
                  if (that.skeyReadyCallback) {
                    that.skeyReadyCallback()
                  }
                }, false)
              }
              // 加入 callback 以防止请求数据在 Page.onLoad 之后才返回
              if (this.skeyReadyCallback) {
                this.skeyReadyCallback()
              }
            },
            fail: () => {
              // session_key 已过期，重新执行登录流程
              util.getUserInfo(function () {
                if (that.skeyReadyCallback) {
                  that.skeyReadyCallback()
                }
              }, false)
            }
          })
        } else {
          // 未授权，等待用户主动点击授权
          this.globalData.authorized = false
          if (this.userInfoReadyCallback) {
            this.userInfoReadyCallback()
          }
        }
      }
    })
  }
})