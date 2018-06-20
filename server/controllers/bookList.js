const { mysql } = require('../qcloud')

module.exports = async ctx => {
    var open_id_object = await mysql('cSessionInfo').where({ skey: ctx.header.skey }).select('open_id').first()
    if (open_id_object) {
        // 数据库存在 skey ，验证通过
        try {
            var open_id = open_id_object.open_id

            ctx.body = {
                success: true,
                data: await mysql('journal_book').where({ open_id: open_id }).select('journal_book_id', 'name', 'background_id', 'count').orderBy('create_time', 'asc')
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
