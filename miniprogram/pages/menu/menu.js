const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    categories: [],
    dishGroups: [],
    activeCategory: '',
    scrollTarget: '',
    cartCount: 0,
    cartTotal: 0
  },

  onLoad() {
    this.fetchDishes()
  },

  onShow() {
    this.refreshCart()
  },

  /**
   * Fetch all available dishes from cloud DB and group by category
   */
  async fetchDishes() {
    try {
      wx.showLoading({ title: '加载中...' })
      const res = await db.collection('dishes')
        .where({ isAvailable: true })
        .limit(100)
        .get()

      const dishes = res.data
      // Extract unique categories preserving order
      const categorySet = []
      dishes.forEach(dish => {
        if (categorySet.indexOf(dish.category) === -1) {
          categorySet.push(dish.category)
        }
      })

      // Group dishes by category
      const dishGroups = categorySet.map(category => ({
        category,
        dishes: dishes
          .filter(d => d.category === category)
          .map(d => ({ ...d, quantity: 0 }))
      }))

      this.setData({
        categories: categorySet,
        dishGroups,
        activeCategory: categorySet[0] || ''
      })

      this.refreshCart()
    } catch (err) {
      console.error('Failed to fetch dishes:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * Scroll right panel to the selected category section
   */
  scrollToCategory(e) {
    const category = e.currentTarget.dataset.category
    const index = this.data.categories.indexOf(category)
    if (index >= 0) {
      this.setData({
        activeCategory: category,
        scrollTarget: 'cat-' + index
      })
    }
  },

  /**
   * Handle right panel scroll to update active category
   */
  onContentScroll(e) {
    // Category sync can be enhanced with intersection observer
  },

  /**
   * Add a dish to the cart
   */
  addToCart(e) {
    const dish = e.currentTarget.dataset.dish
    app.addToCart(dish)
    this.refreshCart()
  },

  /**
   * Remove a dish from the cart
   */
  removeFromCart(e) {
    const dish = e.currentTarget.dataset.dish
    app.removeFromCart(dish._id)
    this.refreshCart()
  },

  /**
   * Refresh cart display and update dish quantities
   */
  refreshCart() {
    const cartCount = app.getCartCount()
    const cartTotal = app.getCartTotal()
    const cart = app.globalData.cart || []

    // Build a map of dishId -> quantity from cart
    const qtyMap = {}
    cart.forEach(item => {
      qtyMap[item._id] = item.quantity
    })

    // Update quantities in dishGroups
    const dishGroups = this.data.dishGroups.map(group => ({
      category: group.category,
      dishes: group.dishes.map(dish => ({
        ...dish,
        quantity: qtyMap[dish._id] || 0
      }))
    }))

    this.setData({
      dishGroups,
      cartCount,
      cartTotal
    })
  }
})
