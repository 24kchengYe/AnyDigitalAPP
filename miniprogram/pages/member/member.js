const app = getApp()
const { ensureLogin, getUserInfo } = require('../../utils/auth')
const { payForMembership } = require('../../utils/pay')

Page({
  data: {
    userInfo: null,
    config: null,
    isMember: false,
    memberExpiry: '',
    expandedKey: '',
    // 等级信息（预格式化）
    memberLevel: 0,
    totalSpentYuan: '0.00',
    selfDiscountPct: '0.0',
    referralRatePct: 0,
    nextLevel: null,
    spentToNextYuan: 0,
    levelProgress: 0,
    levels: []
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    this.initPage()
  },

  initPage() {
    Promise.all([
      this.loadUserInfo(),
      this.loadConfig()
    ]).then(() => {
      if (this.data.isMember) {
        this.loadMemberLevel()
      }
    }).catch(err => {
      console.error('初始化会员页面失败', err)
    })
  },

  loadUserInfo() {
    return getUserInfo().then(userInfo => {
      this.setData({
        userInfo: userInfo,
        isMember: !!userInfo.isMember,
        memberExpiry: userInfo.memberExpiry || ''
      })
    })
  },

  loadConfig() {
    return app.getConfig().then(config => {
      this.setData({ config: config })
    })
  },

  async loadMemberLevel() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { action: 'getMemberLevel' }
      })
      if (res.result && res.result.code === 0 && res.result.data.isMember) {
        const d = res.result.data
        // 计算进度条百分比
        let progress = 0
        if (d.nextThreshold) {
          // 当前等级起点
          const levels = d.levels || []
          const currentLvInfo = levels.find(l => l.level === d.memberLevel)
          const currentThreshold = currentLvInfo ? currentLvInfo.threshold : 0
          const range = d.nextThreshold - currentThreshold
          const spent = d.totalSpent - currentThreshold
          progress = range > 0 ? Math.min(100, Math.round((spent / range) * 100)) : 100
        } else {
          progress = 100 // 已满级
        }

        // 预格式化显示值（WXML不支持.toFixed）
        const fmtLevels = (d.levels || []).map(lv => ({
          level: lv.level,
          thresholdYuan: lv.threshold > 0 ? (lv.threshold / 100) : 0,
          selfDiscountPct: (lv.selfDiscount * 100).toFixed(1),
          referralRatePct: Math.round(lv.referralRate * 100)
        }))

        this.setData({
          memberLevel: d.memberLevel,
          totalSpentYuan: (d.totalSpent / 100).toFixed(2),
          selfDiscountPct: (d.selfDiscount * 100).toFixed(1),
          referralRatePct: Math.round(d.referralRate * 100),
          nextLevel: d.nextLevel,
          spentToNextYuan: Math.round(d.spentToNext / 100),
          levelProgress: progress,
          levels: fmtLevels
        })
      }
    } catch (err) {
      console.error('Failed to load member level:', err)
    }
  },

  toggleDetail(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      expandedKey: this.data.expandedKey === key ? '' : key
    })
  },

  buyMembership() {
    wx.showLoading({ title: '正在发起支付...' })

    payForMembership().then(() => {
      wx.hideLoading()
      wx.showToast({
        title: '开通成功！',
        icon: 'success',
        duration: 2000
      })
      this.initPage()
    }).catch(err => {
      wx.hideLoading()
      if (err.errMsg && err.errMsg.indexOf('cancel') > -1) {
        return
      }
      console.error('支付失败', err)
      wx.showToast({
        title: '支付失败，请重试',
        icon: 'none'
      })
    })
  }
})
