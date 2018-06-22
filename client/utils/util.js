var constants = require('../vendor/wafer2-client-sdk/lib/constants.js')
var SESSION_KEY = 'weapp_session_' + constants.WX_SESSION_MAGIC_ID
var qcloud = require('../vendor/wafer2-client-sdk/index')
var config = require('../config')

// 微信小程序 App ID (用于鉴权测试)
const appId = ''

// 微信小程序 App Secret (用于鉴权测试)
const appSecret = ''

// 显示读取提示
var showLoading = title => {
  wx.hideToast()
  wx.showToast({
    title,
    icon: 'loading',
    mask: true,
    duration: 10000
  })
}

// 显示成功提示
var showSuccess = title => {
  wx.hideToast()
  wx.showToast({
    title,
    icon: 'success'
  })
}

// 显示失败提示
var showModal = (title, content, doStringify = false) => {
  wx.hideToast()
  wx.showModal({
    title,
    content: doStringify ? JSON.stringify(content) : content,
    showCancel: false
  })
}

// 显示关于信息
var showAbout = () => {
  wx.showModal({
    title: '关于',
    content: '「当前版本」\nv0.1.3 2018-6-21\n\n「更新日志」\n1. 修复已知bug\n2. 支持转发小程序\n\n「版权所有」\n柠檬柚子团队 from WHU',
    showCancel: false,
    confirmText: '知道了'
  })
}

// 调用 wafer2 登录接口获取用户信息
var getUserInfo = (callback, alertSuccess = true) => {
  showLoading('正在登录')
  var app = getApp()
  qcloud.setLoginUrl(config.service.loginUrl)

  qcloud.login({
    success: res => {
      if (res) {
        // 首次登录将返回用户信息
        if (alertSuccess) {
          showSuccess('登录成功')
        }
        app.globalData.userInfo = res
        app.globalData.skey = wx.getStorageSync(SESSION_KEY)
        if (callback) {
          callback()
        }
      } else {
        // 如果不是首次登录，不会返回用户信息，请求用户信息接口获取
        qcloud.request({
          url: config.service.requestUrl,
          login: true,
          success: res => {
            if (alertSuccess) {
              showSuccess('登录成功')
            }
            app.globalData.userInfo = res.data.data
            app.globalData.skey = wx.getStorageSync(SESSION_KEY)
            if (callback) {
              callback()
            }
          },
          fail: error => {
            showModal('请求失败', error, true)
            if (callback) {
              callback()
            }
          }
        })
      }
    },
    fail: error => {
      showModal('登录失败', error, true)
      if (callback) {
        callback()
      }
    }
  })
}

// 获取手帐本列表
var getBookList = (e, alert = false) => {
  var app = getApp()

  // 若存在有效 skey 则执行请求，否则直接返回
  if (app.globalData.skey) {
    if (alert) {
      showLoading('正在刷新')
    }

    wx.request({
      url: config.service.bookListUrl,
      method: 'GET',
      header: { skey: app.globalData.skey },
      success: res => {
        if (res.data.success) {
          if (alert) {
            showSuccess('刷新成功')
          }

          // 更新bookList全局变量
          app.globalData.bookList = res.data.data

          // 刷新页面数据
          if (e.data.bookList !== res.data.data) {
            e.setData({
              bookList: res.data.data
            })
          }
        } else {
          if (res.data.errMsg) {
            showModal('刷新失败', res.data.errMsg)
          } else {
            showModal('刷新失败', 'statusCode: ' + res.statusCode)
          }
        }
      },
      fail: error => {
        showModal('刷新失败', error, true)
      }
    })
  }
}

// 获取手帐列表
var getJournalList = (e, alert = false) => {
  var app = getApp()

  if (alert) {
    showLoading('正在获取')
  }

  wx.request({
    url: config.service.journalListUrl,
    method: 'GET',
    header: { skey: app.globalData.skey },
    data: {
      journal_book_id: e.data.journal_book_id
    },
    success: res => {
      if (res.data.success) {
        // 转换时区
        for (var i in res.data.data) {
          var date = new Date(res.data.data[i].last_update_time),
            utc = date.getTime() + date.getTimezoneOffset() * 60000,
            pek = utc + (3600000 * 8)
          date = new Date(pek)
          res.data.data[i].last_update_time = date.getMonth() + 1 + '/' + date.getDate()
        }

        wx.hideToast()
        if (!alert) {
          showSuccess('操作成功')
        }

        // 刷新页面数据
        e.setData({
          journals: res.data.data
        })
      } else {
        if (res.data.errMsg) {
          showModal('请求失败', res.data.errMsg)
        } else {
          showModal('请求失败', 'statusCode: ' + res.statusCode)
        }
      }
    },
    fail: error => {
      showModal('请求失败', error, true)
    }
  })
}

module.exports = { appId, appSecret, showLoading, showSuccess, showModal, showAbout, getUserInfo, getBookList, getJournalList }