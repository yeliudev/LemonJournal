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
            var open_id = open_id_object.open_id,
                journal_objects = await mysql('journal').where({ journal_book_id: ctx.request.body.journal_book_id }).select('journal_id', 'previewUrl', 'components'),
                objects = []

            // 移除手帐本
            await mysql('journal_book').where({ journal_book_id: ctx.request.body.journal_book_id }).del()

            // 移除 COS 端数据
            if (journal_objects.length > 0) {
                for (var i in journal_objects) {
                    var components = JSON.parse(journal_objects[i].components)

                    objects.push({
                        Key: journal_objects[i].previewUrl.substring(57)
                    })

                    for (var j in components.assemblies) {
                        objects.push({
                            Key: 'user_data/' + open_id + '/' + ctx.request.body.journal_book_id + '/' + journal_objects[i].journal_id + '/' + components.assemblies[j].id + '.png'
                        })
                    }
                }

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
