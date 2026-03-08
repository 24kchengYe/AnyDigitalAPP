// pages/index/index.js
const app = getApp()

Page({
  data: {
    shopInfo: {},
    hotDishes: [],
    userInfo: null,
    config: {},
    showNewUserPopup: false
  },

  onLoad() {
    // Silent login & check new user
    app.silentLogin().then(openid => {
      // 检查是否需要显示新人弹窗
      const hasShown = wx.getStorageSync('newUserPopupShown')
      if (!hasShown && app.globalData.userInfo) {
        // 新注册用户在 login 返回 isNewUser
        this.checkNewUserCoupon()
      }
    })

    // Load config (async)
    app.getConfig().then(config => {
      this.setData({
        config,
        shopInfo: {
          name: config.restaurantName || '十脚怪兽',
          slogan: config.shopSlogan || '高淳螃蟹·产地直发',
          phone: config.shopPhone || '400-000-0000'
        }
      })
    }).catch(() => {
      this.setData({
        shopInfo: { name: '十脚怪兽', slogan: '高淳螃蟹·产地直发', phone: '400-000-0000' }
      })
    })

    // Load hot products from cloud DB
    this.loadHotDishes()
  },

  onShow() {
    this.refreshUserInfo()
  },

  loadHotDishes() {
    const db = wx.cloud.database()
    db.collection('dishes')
      .where({
        isAvailable: true
      })
      .orderBy('sortOrder', 'asc')
      .limit(6)
      .get()
      .then(res => {
        this.setData({
          hotDishes: res.data
        })
      })
      .catch(err => {
        console.error('Failed to load hot products:', err)
      })
  },

  refreshUserInfo() {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({ userInfo })
    }
  },

  checkNewUserCoupon() {
    const hasShown = wx.getStorageSync('newUserPopupShown')
    if (hasShown) return
    const db = wx.cloud.database()
    db.collection('coupons')
      .where({ _openid: app.globalData.openid, type: 'newUser', used: false })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ showNewUserPopup: true })
          wx.setStorageSync('newUserPopupShown', true)
        }
      })
  },

  closePopup() {
    this.setData({ showNewUserPopup: false })
  },

  goShop() {
    this.setData({ showNewUserPopup: false })
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  goGroupBuy() {
    wx.navigateTo({ url: '/pages/group-buy/group-buy' })
  },

  callPhone() {
    wx.makePhoneCall({
      phoneNumber: this.data.shopInfo.phone || '400-000-0000'
    })
  },

  onPullDownRefresh() {
    this.loadHotDishes()
    this.refreshUserInfo()
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    return {
      title: '十脚怪兽·高淳螃蟹',
      path: '/pages/index/index'
    }
  }
})
