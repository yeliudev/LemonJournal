const { mysql } = require('../qcloud')
const crypto = require('crypto')
const moment = require('moment')

module.exports = async ctx => {
    var open_id_object = await mysql('cSessionInfo').where({ skey: ctx.header.skey }).select('open_id').first()
    if (open_id_object) {
        // 数据库存在 skey ，验证通过
        try {
            var open_id = open_id_object.open_id,
                newJournal = {
                    journal_id: ctx.request.body.journal_id,
                    journal_book_id: ctx.request.body.journal_book_id,
                    title: ctx.request.body.title,
                    previewUrl: ctx.request.body.previewUrl,
                    components: ctx.request.body.components,
                    last_update_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }

            // 插入新手帐
            await mysql('journal').insert(newJournal)

            // 更新手帐本字段
            var journals = await mysql('journal').where({ journal_book_id: ctx.request.body.journal_book_id }).select('journal_id')
            await mysql('journal_book').update({ count: journals.length }).where({ journal_book_id: ctx.request.body.journal_book_id })

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
