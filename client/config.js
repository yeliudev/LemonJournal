/**
 * 小程序配置文件
 */

// 此处主机域名修改成腾讯云解决方案分配的域名
var host = ''

// 腾讯云对象存储 CDN 域名
var cos_host_cdn = ''

// 腾讯云对象存储原始域名
var cos_host = ''

var config = {

  // 下面的地址配合云端 Demo 工作
  service: {
    host,
    cos_host_cdn,
    cos_host,

    // 登录地址，用于建立会话
    loginUrl: `${host}/weapp/login`,

    // 测试的请求地址，用于测试会话
    requestUrl: `${host}/weapp/user`,

    // 上传图片接口
    uploadUrl: `${host}/weapp/upload`,

    // 手帐本封面获取接口
    bookCoverUrl: `${cos_host_cdn}/weapp/bookCover/`,

    // 手帐本列表获取接口
    bookListUrl: `${host}/weapp/bookList`,

    // 新建手帐本接口
    newJournalBookUrl: `${host}/weapp/newJournalBook`,

    // 修改手帐本接口
    setJournalBookUrl: `${host}/weapp/setJournalBook`,

    // 移除手帐本接口
    delJournalBookUrl: `${host}/weapp/delJournalBook`,

    // 手帐背景图获取接口
    backgroundUrl: `${cos_host_cdn}/weapp/background/`,

    // 贴纸素材获取接口
    stickerUrl: `${cos_host_cdn}/weapp/stickers/`,

    // 手帐id获取接口
    newJournalIdUrl: `${host}/weapp/newJournalId`,

    // 新建手帐接口
    newJournalUrl: `${host}/weapp/newJournal`,

    // 手帐获取接口
    getJournalUrl: `${host}/weapp/getJournal`,

    // 修改手帐本接口
    setJournalUrl: `${host}/weapp/setJournal`,

    // 移除手帐本接口
    delJournalUrl: `${host}/weapp/delJournal`,

    // 手帐列表获取接口
    journalListUrl: `${host}/weapp/journalList`,

    // 自定义图片获取接口
    imageUrl: `${cos_host_cdn}/user_data/`,

    // COS 鉴权接口
    signUrl: `${host}/weapp/sign`,

    // COS 上传接口
    cosUrl: ''
  }
}

module.exports = config