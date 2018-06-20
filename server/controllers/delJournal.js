const { mysql } = require('../qcloud')
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
            // 通过 journal_id 查询 journal_book_id 并构造 COS 请求参数
            var open_id = open_id_object.open_id,
                journal_book_id_object = await mysql('journal').where({ journal_id: ctx.request.body.journal_id }).select('journal_book_id').first(),
                journal_book_id = journal_book_id_object.journal_book_id,
                journal_object = await mysql('journal').where({ journal_id: ctx.request.body.journal_id }).select('previewUrl', 'components').first(),
                components = JSON.parse(journal_object.components),
                objects = [{ Key: journal_object.previewUrl.substring(57) }]

            for (var i in components.assemblies) {
                objects.push({
                    Key: 'user_data/' + open_id + '/' + journal_book_id + '/' + ctx.request.body.journal_id + '/' + components.assemblies[i].id + '.png'
                })
            }

            // 移除手帐
            await mysql('journal').where({ journal_id: ctx.request.body.journal_id }).del()

            // 更新手帐本字段
            var journals = await mysql('journal').where({ journal_book_id: journal_book_id }).select('journal_id')
            await mysql('journal_book').update({ count: journals.length }).where({ journal_book_id: journal_book_id })

            // 移除 COS 端数据
            if (objects) {
                var params = {
                    Bucket: 'lemonjournal-bucket-1251259528',
                    Region: 'ap-guangzhou',
                    Quiet: true,
                    Objects: objects
                }

                cos.deleteMultipleObject(params, function (err) {
                    if (err) {
                        throw err
                    }
                })
            }

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
