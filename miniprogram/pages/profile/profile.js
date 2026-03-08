// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    couponCount: 0,
    stats: {
      balance: '0.00',
      referralCount: 0,
      totalEarnings: '0.00',
      pendingReward: '0.00'
    },
    _tempNickName: '',
    _tempAvatarUrl: ''
  },

  onShow() {
    this.refreshUserInfo()
    this.countUnusedCoupons()
    this.loadReferralStats()
  },

  /**
   * Refresh user info from cloud database
   */
  refreshUserInfo() {
    const db = wx.cloud.database()
    const openid = app.globalData.openid

    if (!openid) {
      // openid还没拿到，等登录完成后再刷新
      app.silentLogin().then(() => this.refreshUserInfo())
      return
    }

    db.collection('users')
      .where({ _openid: openid })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const user = res.data[0]
          app.globalData.userInfo = user
          this.setData({
            userInfo: user,
            stats: {
              balance: (user.balance || 0).toFixed(2),
              referralCount: user.referralCount || 0
            }
          })
        }
      })
      .catch(err => {
        console.error('Failed to refresh user info:', err)
        const userInfo = app.globalData.userInfo
        if (userInfo) {
          this.setData({
            userInfo,
            stats: {
              balance: (userInfo.balance || 0).toFixed(2),
              referralCount: userInfo.referralCount || 0
            }
          })
        }
      })
  },

  /**
   * Count the user's unused coupons
   */
  countUnusedCoupons() {
    const db = wx.cloud.database()
    const openid = app.globalData.openid

    if (!openid) return

    db.collection('coupons')
      .where({
        _openid: openid,
        isUsed: false,
        expireAt: db.command.gt(new Date())
      })
      .count()
      .then(res => {
        this.setData({
          couponCount: res.total
        })
      })
      .catch(err => {
        console.error('Failed to count coupons:', err)
      })
  },

  /**
   * Load referral stats for reward display
   */
  async loadReferralStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'referral',
        data: { action: 'getStats' }
      })
      if (res.result && res.result.data) {
        const data = res.result.data
        this.setData({
          'stats.totalEarnings': data.totalEarnings || '0.00',
          'stats.pendingReward': data.pendingEarnings || '0.00'
        })
      }
    } catch (err) {
      console.error('Failed to load referral stats:', err)
    }
  },

  goToCoupons() {
    wx.navigateTo({ url: '/pages/coupons/coupons' })
  },

  goToWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/withdraw' })
  },

  goToReferral() {
    wx.navigateTo({ url: '/pages/referral/referral' })
  },

  /**
   * Handle avatar selection via chooseAvatar button
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      _tempAvatarUrl: avatarUrl,
      'userInfo.avatarUrl': avatarUrl
    })
    // If nickname is already set, save profile immediately
    if (this.data.userInfo.nickName) {
      this.saveProfile()
    }
  },

  /**
   * Handle nickname input
   */
  onInputNickname(e) {
    this.setData({
      _tempNickName: e.detail.value
    })
  },

  /**
   * Save profile by calling the login cloud function with updateProfile action
   */
  saveProfile() {
    const nickName = this.data._tempNickName || this.data.userInfo.nickName
    const avatarUrl = this.data._tempAvatarUrl || this.data.userInfo.avatarUrl

    if (!nickName && !avatarUrl) return

    wx.showLoading({ title: '保存中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'updateProfile',
        nickName: nickName,
        avatarUrl: avatarUrl
      }
    })
      .then(res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' })
          // Update local data
          this.setData({
            'userInfo.nickName': nickName,
            'userInfo.avatarUrl': avatarUrl
          })
          // Update global data
          app.globalData.userInfo = {
            ...app.globalData.userInfo,
            nickName,
            avatarUrl
          }
        }
      })
      .catch(err => {
        wx.hideLoading()
        console.error('Failed to save profile:', err)
        wx.showToast({ title: '保存失败', icon: 'none' })
      })
  },

  onShareAppMessage() {
    return {
      title: '来看看这家店',
      path: '/pages/index/index'
    }
  }
})
