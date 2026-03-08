App({
  onLaunch(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'your-cloud-env-id',
      traceUser: true
    })

    // 处理推荐人场景值
    if (options.query && options.query.referrerId) {
      this.globalData.pendingReferrerId = options.query.referrerId
    }

    // 静默登录
    this.silentLogin()
  },

  globalData: {
    userInfo: null,
    openid: null,
    pendingReferrerId: null,
    cart: [],
    config: null
  },

  silentLogin() {
    return new Promise((resolve, reject) => {
      if (this.globalData.openid) {
        resolve(this.globalData.openid)
        return
      }
      wx.cloud.callFunction({
        name: 'login',
        data: {
          action: 'login',
          referrerId: this.globalData.pendingReferrerId || ''
        }
      }).then(res => {
        const result = res.result || {}
        const data = result.data || result
        const openid = data.openid
        const userInfo = data.userInfo
        this.globalData.openid = openid
        this.globalData.userInfo = userInfo
        this.globalData.pendingReferrerId = null
        resolve(openid)
      }).catch(err => {
        console.error('登录失败', err)
        reject(err)
      })
    })
  },

  getConfig() {
    return new Promise((resolve, reject) => {
      if (this.globalData.config) {
        resolve(this.globalData.config)
        return
      }
      const db = wx.cloud.database()
      db.collection('config').doc('global').get().then(res => {
        this.globalData.config = res.data
        resolve(res.data)
      }).catch(reject)
    })
  },

  // 购物车操作
  addToCart(dish) {
    const cart = this.globalData.cart
    const idx = cart.findIndex(item => item._id === dish._id)
    if (idx > -1) {
      cart[idx].quantity += 1
    } else {
      cart.push({ ...dish, quantity: 1 })
    }
    this.globalData.cart = cart
  },

  removeFromCart(dishId) {
    const cart = this.globalData.cart
    const idx = cart.findIndex(item => item._id === dishId)
    if (idx > -1) {
      if (cart[idx].quantity > 1) {
        cart[idx].quantity -= 1
      } else {
        cart.splice(idx, 1)
      }
    }
    this.globalData.cart = cart
  },

  removeItemFromCart(dishId) {
    this.globalData.cart = this.globalData.cart.filter(item => item._id !== dishId)
  },

  clearCart() {
    this.globalData.cart = []
  },

  getCartTotal() {
    return this.globalData.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  getCartCount() {
    return this.globalData.cart.reduce((sum, item) => sum + item.quantity, 0)
  }
})
