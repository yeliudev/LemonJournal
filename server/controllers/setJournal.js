const { mysql } = require('../qcloud')
const moment = require('moment')
const COS = require('cos-nodejs-sdk-v5')

var cos = new COS({
    SecretId: '',
    SecretKey: '',
})

module.exports = async ctx => {
    var open_id_object = await mysql('cSessionInfo').where({ skey: ctx.header.skey }).select('open_id').first()
    if (open_id_object) {
        // 数据库存在 skey ，验证通过
        try {
            var previewUrl_object = await mysql('journal').where({ journal_id: ctx.request.body.journal_id }).select('previewUrl').first()

            // 更新请求数据中的相应字段
            if (ctx.request.body.title) {
                await mysql('journal').update({ title: ctx.request.body.title }).where({ journal_id: ctx.request.body.journal_id })
            }

            if (ctx.request.body.previewUrl) {
                await mysql('journal').update({ previewUrl: ctx.request.body.previewUrl }).where({ journal_id: ctx.request.body.journal_id })

                // 移除 COS 端数据
                var params = {
                    Bucket: 'lemonjournal-bucket-1251259528',
                    Region: 'ap-guangzhou',
                    Key: previewUrl_object.previewUrl.substring(57)
                }

                cos.deleteObject(params, function (err) {
                    if (err) {
                        throw err
                    }
                })
            }

            if (ctx.request.body.components) {
                await mysql('journal').update({ components: ctx.request.body.components }).where({ journal_id: ctx.request.body.journal_id })
            }

            await mysql('journal').update({ last_update_time: moment().format('YYYY-MM-DD HH:mm:ss') }).where({ journal_id: ctx.request.body.journal_id })

            ctx.body = {
                success: true
            }
        } catch (error) {
            ctx.body = {
                success: false,
                errMsg: error
            }
        }
    } else {
        // 查询结果为 undefined ，验证不通过
        ctx.body = {
            success: false,
            errMsg: 'skey不存在，验证不通过'
        }
    }
}
