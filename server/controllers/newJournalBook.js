const { mysql } = require('../qcloud')
const crypto = require('crypto')
const moment = require('moment')

module.exports = async ctx => {
    var open_id_object = await mysql('cSessionInfo').where({ skey: ctx.header.skey }).select('open_id').first()
    if (open_id_object) {
        // 数据库存在 skey ，验证通过
        try {
            var open_id = open_id_object.open_id,
                newBook = {
                    journal_book_id: crypto.createHash('md5').update(open_id + Date.now().toString()).digest('hex'),
                    open_id: open_id,
                    name: ctx.request.body.name,
                    background_id: ctx.request.body.background_id,
                    count: 0,
                    create_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }

            await mysql('journal_book').insert(newBook)

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
