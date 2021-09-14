var constants = require('./lib/constants')
var login = require('./lib/login')
var Session = require('./lib/session')
var request = require('./lib/request')

var exports = module.exports = {
  login: login.login,
  setLoginUrl: login.setLoginUrl,
  LoginError: login.LoginError,

  clearSession: Session.clear,

  request: request.request,
  RequestError: request.RequestError
}

// 导出错误类型码
Object.keys(constants).forEach(function (key) {
  if (key.indexOf('ERR_') === 0) {
    exports[key] = constants[key]
  }
})