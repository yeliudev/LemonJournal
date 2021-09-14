const app = getApp()

Component({
  properties: {
    // 组件类型 ('sticker','image','text')
    component_type: {
      type: String,
      value: ''
    },

    // 是否处于选中状态
    selected: {
      type: Boolean,
      value: true
    },
    // 边框样式
    border: {
      type: String,
      value: ''
    },

    // 组件图片地址
    image_url: {
      type: String,
      value: ''
    },
    // 组件包含的文字
    text: {
      type: String,
      value: ''
    },
    // 组件中心坐标
    stickerCenterX: {
      type: Number,
      value: 375
    },
    stickerCenterY: {
      type: Number,
      value: 300
    },

    // 组件缩放比例
    scale: {
      type: Number,
      value: 1
    },
    // 组件旋转角度
    rotate: {
      type: Number,
      value: 0
    },
    // 组件层级
    z_index: {
      type: Number,
      value: 1
    },
    // 当前最高层级
    max_z_index: {
      type: Number,
      value: 1
    }
  },

  data: {
    // 删除按钮中心坐标
    removeCenterX: 0,
    removeCenterY: 0,

    // 操作按钮中心坐标
    handleCenterX: 0,
    handleCenterY: 0,

    // 是否隐藏移除按钮
    hideRemove: false
  },

  attached: function() {
    this.active()
  },

  methods: {
    onTouchStart: function(e) {
      // 若未选中则直接返回
      if (!this.data.selected) {
        return
      }

      switch (e.target.id) {
        case 'sticker':
          {
            this.touch_target = e.target.id
            this.start_x = e.touches[0].clientX * 2
            this.start_y = e.touches[0].clientY * 2
            break
          }
        case 'handle':
          {
            // 隐藏移除按钮
            this.setData({
              hideRemove: true
            })

            this.touch_target = e.target.id
            this.start_x = e.touches[0].clientX * 2
            this.start_y = e.touches[0].clientY * 2

            this.sticker_center_x = this.data.stickerCenterX;
            this.sticker_center_y = this.data.stickerCenterY;
            this.remove_center_x = this.data.removeCenterX;
            this.remove_center_y = this.data.removeCenterY;
            this.handle_center_x = this.data.handleCenterX;
            this.handle_center_y = this.data.handleCenterY;

            this.scale = this.data.scale;
            this.rotate = this.data.rotate;
            break
          }
      }
    },

    onTouchEnd: function(e) {
      this.active()
      this.touch_target = ''

      // 显示移除按钮
      this.setData({
        removeCenterX: 2 * this.data.stickerCenterX - this.data.handleCenterX,
        removeCenterY: 2 * this.data.stickerCenterY - this.data.handleCenterY,
        hideRemove: false
      })

      // 若点击移除按钮则触发移除事件，否则触发刷新数据事件
      if (e.target.id === 'remove') {
        this.triggerEvent('removeSticker', this.data.sticker_id)
      } else {
        this.triggerEvent('refreshData', this.data)
      }
    },

    onTouchMove: function(e) {
      // 若无选中目标则返回
      if (!this.touch_target) {
        return
      }

      var current_x = e.touches[0].clientX * 2
      var current_y = e.touches[0].clientY * 2
      var diff_x = current_x - this.start_x
      var diff_y = current_y - this.start_y

      switch (e.target.id) {
        case 'sticker':
          {
            // 拖动组件则所有控件同时移动
            this.setData({
              stickerCenterX: this.data.stickerCenterX + diff_x,
              stickerCenterY: this.data.stickerCenterY + diff_y,
              removeCenterX: this.data.removeCenterX + diff_x,
              removeCenterY: this.data.removeCenterY + diff_y,
              handleCenterX: this.data.handleCenterX + diff_x,
              handleCenterY: this.data.handleCenterY + diff_y
            })
            break
          }
        case 'handle':
          {
            // 拖动操作按钮则原地旋转缩放
            this.setData({
              handleCenterX: this.data.handleCenterX + diff_x,
              handleCenterY: this.data.handleCenterY + diff_y
            })

            var diff_x_before = this.handle_center_x - this.sticker_center_x;
            var diff_y_before = this.handle_center_y - this.sticker_center_y;
            var diff_x_after = this.data.handleCenterX - this.sticker_center_x;
            var diff_y_after = this.data.handleCenterY - this.sticker_center_y;
            var distance_before = Math.sqrt(diff_x_before * diff_x_before + diff_y_before * diff_y_before);
            var distance_after = Math.sqrt(diff_x_after * diff_x_after + diff_y_after * diff_y_after);
            var angle_before = Math.atan2(diff_y_before, diff_x_before) / Math.PI * 180;
            var angle_after = Math.atan2(diff_y_after, diff_x_after) / Math.PI * 180;

            this.setData({
              scale: distance_after / distance_before * this.scale,
              rotate: angle_after - angle_before + this.rotate
            })
            break
          }
      }

      this.start_x = current_x;
      this.start_y = current_y;
    },

    // 激活组件
    active: function() {
      // 刷新按钮坐标
      this.setData({
        removeCenterX: this.data.stickerCenterX - 100 * Math.sqrt(2) * this.data.scale * Math.cos((45 + this.data.rotate) * Math.PI / 180),
        removeCenterY: this.data.stickerCenterY - 100 * Math.sqrt(2) * this.data.scale * Math.sin((45 + this.data.rotate) * Math.PI / 180),
        handleCenterX: this.data.stickerCenterX + 100 * Math.sqrt(2) * this.data.scale * Math.cos((45 + this.data.rotate) * Math.PI / 180),
        handleCenterY: this.data.stickerCenterY + 100 * Math.sqrt(2) * this.data.scale * Math.sin((45 + this.data.rotate) * Math.PI / 180)
      })

      // 切换选中状态
      this.triggerEvent('refreshView')
      this.setData({
        selected: true,
        border: 'dashed 2rpx #cfced0',
        z_index: this.data.max_z_index + 1
      })
      this.triggerEvent('updateMax_z_index')
    }
  }
})