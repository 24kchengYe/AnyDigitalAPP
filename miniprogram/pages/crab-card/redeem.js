const app = getApp()

Page({
  data: {
    redeemCode: '',
    cardInfo: null,
    region: [],
    form: { name: '', phone: '', address: '' }
  },

  onLoad(options) {
    if (options.code) {
      this.setData({ redeemCode: options.code })
      this.queryCard()
    }
    app.silentLogin()
  },

  onCodeInput(e) {
    this.setData({ redeemCode: e.detail.value.toUpperCase() })
  },

  queryCard() {
    const code = this.data.redeemCode.trim()
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位兑换码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '查询中...' })
    wx.cloud.callFunction({
      name: 'order',
      data: { action: 'getCrabCardDetail', redeemCode: code }
    }).then(res => {
      wx.hideLoading()
      const result = res.result || {}
      if (result.code === 0) {
        this.setData({ cardInfo: result.data })
      } else {
        wx.showToast({ title: result.msg || '兑换码无效', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '查询失败', icon: 'none' })
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onRegionChange(e) {
    this.setData({ region: e.detail.value })
  },

  redeemCard() {
    const { form, region, redeemCode } = this.data
    if (!form.name || !form.phone || !form.address || region.length === 0) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(form.phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    wx.showLoading({ title: '兑换中...' })
    wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'redeemCrabCard',
        redeemCode,
        shippingInfo: {
          name: form.name,
          phone: form.phone,
          province: region[0],
          city: region[1],
          district: region[2],
          address: form.address
        }
      }
    }).then(res => {
      wx.hideLoading()
      const result = res.result || {}
      if (result.code === 0) {
        wx.showModal({
          title: '兑换成功',
          content: '我们将尽快为您安排发货，请留意物流信息。',
          showCancel: false,
          success: () => wx.navigateBack()
        })
      } else {
        wx.showToast({ title: result.msg || '兑换失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '兑换失败', icon: 'none' })
    })
  }
})
