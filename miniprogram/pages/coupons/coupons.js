const app = getApp()
const { ensureLogin } = require('../../utils/auth')

Page({
  data: {
    tabs: [
      { key: 'unused', label: '未使用' },
      { key: 'used', label: '已使用' },
      { key: 'expired', label: '已过期' }
    ],
    activeTab: 'unused',
    coupons: [],
    filteredCoupons: [],
    loading: true
  },

  onLoad() {
    this.loadCoupons()
  },

  onShow() {
    this.loadCoupons()
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ activeTab: status })
    this.filterCoupons(status)
  },

  loadCoupons() {
    this.setData({ loading: true })

    ensureLogin().then(openid => {
      const db = wx.cloud.database()
      return db.collection('coupons')
        .where({ userId: openid })
        .orderBy('createTime', 'desc')
        .get()
    }).then(res => {
      const now = Date.now()
      const coupons = (res.data || []).map(coupon => {
        // Determine status based on usage and expiry
        let status = 'unused'
        if (coupon.used) {
          status = 'used'
        } else if (coupon.expiryTime && coupon.expiryTime < now) {
          status = 'expired'
        }
        return Object.assign({}, coupon, { status: status })
      })

      this.setData({
        coupons: coupons,
        loading: false
      })
      this.filterCoupons(this.data.activeTab)
    }).catch(err => {
      console.error('加载优惠券失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    })
  },

  filterCoupons(status) {
    const filtered = this.data.coupons.filter(c => c.status === status)
    this.setData({ filteredCoupons: filtered })
  },

  goUse() {
    wx.switchTab({
      url: '/pages/menu/menu'
    })
  }
})
