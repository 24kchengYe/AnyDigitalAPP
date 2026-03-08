const app = getApp()

Component({
  properties: {
    dish: { type: Object, value: {} }
  },
  methods: {
    onTap() {
      wx.switchTab({ url: '/pages/menu/menu' })
    },
    onAdd() {
      app.addToCart(this.data.dish)
      wx.showToast({ title: '已加入购物车', icon: 'success', duration: 800 })
    }
  }
})
