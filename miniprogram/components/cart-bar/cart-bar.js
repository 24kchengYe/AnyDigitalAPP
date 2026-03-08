Component({
  properties: {
    count: { type: Number, value: 0 },
    total: { type: Number, value: 0 },
    freeShippingAmount: { type: Number, value: 19900 }
  },
  observers: {
    'total, freeShippingAmount': function (total, freeShippingAmount) {
      if (freeShippingAmount <= 0) return
      const remaining = Math.max(freeShippingAmount - total, 0)
      const progress = Math.min(total / freeShippingAmount * 100, 100)
      const isFreeShipping = total >= freeShippingAmount
      this.setData({ remaining, progress, isFreeShipping })
    }
  },
  data: {
    remaining: 0,
    progress: 0,
    isFreeShipping: false
  },
  methods: {
    goCart() {
      wx.navigateTo({ url: '/pages/cart/cart' })
    },
    goCheckout() {
      wx.navigateTo({ url: '/pages/cart/cart' })
    }
  }
})
