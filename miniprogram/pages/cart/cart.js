const app = getApp()

Page({
  data: {
    cartItems: [],
    totalPrice: 0,
    totalCount: 0
  },

  onShow() {
    this.loadCart()
  },

  /**
   * Load cart data from app.globalData.cart
   */
  loadCart() {
    const cart = app.globalData.cart || []
    const cartItems = cart.map(item => ({
      ...item,
      subtotal: item.price * item.quantity
    }))

    this.setData({
      cartItems,
      totalPrice: app.getCartTotal(),
      totalCount: app.getCartCount()
    })
  },

  /**
   * Increase quantity of a cart item
   */
  addQty(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart || []
    const dish = cart.find(item => item._id === id)
    if (dish) {
      app.addToCart(dish)
      this.loadCart()
    }
  },

  /**
   * Decrease quantity of a cart item
   */
  reduceQty(e) {
    const id = e.currentTarget.dataset.id
    app.removeFromCart(id)
    this.loadCart()
  },

  /**
   * Remove an item entirely from cart
   */
  removeItem(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          app.removeItemFromCart(id)
          this.loadCart()
        }
      }
    })
  },

  /**
   * Navigate to order confirmation page
   */
  goCheckout() {
    if (this.data.totalCount === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/order/order'
    })
  },

  /**
   * Navigate to menu page
   */
  goMenu() {
    wx.switchTab({
      url: '/pages/menu/menu'
    })
  }
})
