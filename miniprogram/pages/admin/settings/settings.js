const DEFAULT_MEMBER_LEVELS = [
  { level: 1, threshold: 0, selfDiscount: 0.5, referralRate: 2 },
  { level: 2, threshold: 2000, selfDiscount: 0.8, referralRate: 3 },
  { level: 3, threshold: 5000, selfDiscount: 1, referralRate: 4 },
  { level: 4, threshold: 15000, selfDiscount: 1.5, referralRate: 5 },
  { level: 5, threshold: 30000, selfDiscount: 2, referralRate: 6 }
]

Page({
  data: {
    config: {
      restaurantName: '',
      restaurantAddress: '',
      contactPhone: '',
      membershipPrice: '',
      freeCrabCouponValue: '',
      minWithdrawAmount: '',
      logoUrl: '',
      logoFileId: ''
    },
    memberLevels: JSON.parse(JSON.stringify(DEFAULT_MEMBER_LEVELS))
  },

  onLoad() {
    this.loadConfig()
  },

  async loadConfig() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getConfig' }
      })
      if (res.result && res.result.data) {
        const data = res.result.data

        this.setData({
          config: {
            restaurantName: data.restaurantName || '',
            restaurantAddress: data.restaurantAddress || '',
            contactPhone: data.contactPhone || '',
            membershipPrice: data.membershipPrice !== undefined ? String(data.membershipPrice / 100) : '20',
            freeCrabCouponValue: data.freeCrabCouponValue !== undefined ? String(data.freeCrabCouponValue / 100) : '199',
            minWithdrawAmount: data.minWithdrawAmount !== undefined ? String(data.minWithdrawAmount) : '',
            logoUrl: data.logoUrl || '',
            logoFileId: data.logoFileId || ''
          }
        })

        // 加载等级配置（从分转元，从小数转百分比）
        if (data.memberLevels && data.memberLevels.length > 0) {
          const levels = data.memberLevels.map(lv => ({
            level: lv.level,
            threshold: lv.threshold / 100,
            selfDiscount: lv.selfDiscount * 100,
            referralRate: lv.referralRate * 100
          }))
          this.setData({ memberLevels: levels })
        }
      }
    } catch (err) {
      console.error('加载配置失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`config.${field}`]: e.detail.value
    })
  },

  onLevelInput(e) {
    const { index, field } = e.currentTarget.dataset
    this.setData({
      [`memberLevels[${index}].${field}`]: e.detail.value
    })
  },

  async uploadLogo() {
    try {
      const chooseRes = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })

      const filePath = chooseRes.tempFilePaths[0]
      wx.showLoading({ title: '上传中...' })

      const timestamp = Date.now()
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `config/logo_${timestamp}.jpg`,
        filePath: filePath
      })

      this.setData({
        'config.logoUrl': uploadRes.fileID,
        'config.logoFileId': uploadRes.fileID
      })

      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf('cancel') > -1) return
      console.error('上传Logo失败:', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async saveConfig() {
    const { config, memberLevels } = this.data

    if (!config.restaurantName.trim()) {
      return wx.showToast({ title: '请输入店铺名称', icon: 'none' })
    }
    if (!config.contactPhone.trim()) {
      return wx.showToast({ title: '请输入联系电话', icon: 'none' })
    }

    // 转换等级配置（元→分，百分比→小数）
    const levelsForSave = memberLevels.map(lv => ({
      level: lv.level,
      threshold: Math.round(Number(lv.threshold) * 100),
      selfDiscount: Number(lv.selfDiscount) / 100,
      referralRate: Number(lv.referralRate) / 100
    }))

    wx.showLoading({ title: '保存中...' })
    try {
      await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'updateConfig',
          restaurantName: config.restaurantName.trim(),
          restaurantAddress: config.restaurantAddress.trim(),
          contactPhone: config.contactPhone.trim(),
          membershipPrice: config.membershipPrice ? Math.round(Number(config.membershipPrice) * 100) : 2000,
          freeCrabCouponValue: config.freeCrabCouponValue ? Math.round(Number(config.freeCrabCouponValue) * 100) : 19900,
          minWithdrawAmount: config.minWithdrawAmount ? Number(config.minWithdrawAmount) : 0,
          memberLevels: levelsForSave,
          logoUrl: config.logoUrl,
          logoFileId: config.logoFileId
        }
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.error('保存配置失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
