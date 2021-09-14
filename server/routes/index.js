/**
 * ajax 服务路由集合
 */
const router = require('koa-router')({
    prefix: '/weapp'
})
const controllers = require('../controllers')

// 从 sdk 中取出中间件
// 这里展示如何使用 Koa 中间件完成登录态的颁发与验证
const { auth: { authorizationMiddleware, validationMiddleware } } = require('../qcloud')

// 登录接口
router.get('/login', authorizationMiddleware, controllers.login)

// 用户信息接口（可以用来验证登录态）
router.get('/user', validationMiddleware, controllers.user)

// COS 鉴权接口
router.get('/sign', controllers.sign)

// 图片上传接口，小程序端可以直接将 url 填入 wx.uploadFile 中
router.post('/upload', controllers.upload)

// 手帐本列表接口
router.get('/bookList', controllers.bookList)

// 新建手帐本接口
router.post('/newJournalBook', controllers.newJournalBook)

// 修改手帐本接口
router.post('/setJournalBook', controllers.setJournalBook)

// 移除手帐本接口
router.post('/delJournalBook', controllers.delJournalBook)

// 手帐 id 接口
router.get('/newJournalId', controllers.newJournalId)

// 新建手帐接口
router.post('/newJournal', controllers.newJournal)

// 手帐获取接口
router.get('/getJournal', controllers.getJournal)

// 修改手帐本接口
router.post('/setJournal', controllers.setJournal)

// 移除手帐接口
router.post('/delJournal', controllers.delJournal)

// 手帐列表获取接口
router.get('/journalList', controllers.journalList)

module.exports = router
