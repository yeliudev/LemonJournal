var util = require('../../utils/util.js')

Page({
  data: {
    journal_book_id: '',
    journals: []
  },

  onLoad: function(options) {
    this.setData({
      journal_book_id: options.journal_book_id
    })
  },

  onShow: function() {
    util.getJournalList(this, true)
  },

  onRefreshJournalList: function() {
    util.getJournalList(this, false)
  }
})