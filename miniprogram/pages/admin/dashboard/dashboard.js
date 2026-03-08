Page({
  data: {
    stats: {
      totalUsers: 0,
      memberCount: 0,
      todayOrders: 0,
      todayRevenue: '0.00',
      totalOrders: 0,
      totalRevenue: '0.00',
      totalReferrals: 0,
      totalReferralRewards: '0.00'
    }
  },

  onLoad() {
    this.loadDashboard()
  },

  onShow() {
    this.loadDashboard()
  },

  async loadDashboard() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getDashboard' }
      })
      if (res.result && res.result.data) {
        this.setData({ stats: res.result.data })
      }
    } catch (err) {
      console.error('加载仪表盘数据失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  goToOrders() {
    wx.navigateTo({ url: '/pages/admin/orders/orders' })
  },

  goToMembers() {
    wx.navigateTo({ url: '/pages/admin/members/members' })
  },

  goToDishes() {
    wx.navigateTo({ url: '/pages/admin/dishes/dishes' })
  },

  goToWithdrawals() {
    wx.navigateTo({ url: '/pages/admin/withdrawals/withdrawals' })
  },

  goToSettings() {
    wx.navigateTo({ url: '/pages/admin/settings/settings' })
  },

  goToDashboard() {
    // Already on dashboard
  }
})
