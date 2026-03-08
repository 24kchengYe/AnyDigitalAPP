Page({
  data: {
    balance: '0.00',
    amount: '',
    minAmount: 10,
    records: [],
    loading: false,
    submitting: false
  },

  onLoad() {
    this.loadBalance()
    this.loadConfig()
    this.loadRecords()
  },

  // Load user balance
  async loadBalance() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'referral',
        data: { action: 'getStats' }
      })
      if (res.result && res.result.data) {
        this.setData({
          balance: res.result.data.totalEarnings || '0.00'
        })
      }
    } catch (err) {
      console.error('Failed to load balance:', err)
    }
  },

  // Load withdraw config
  async loadConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'withdraw',
        data: { action: 'getConfig' }
      })
      if (res.result && res.result.data) {
        this.setData({
          minAmount: res.result.data.minWithdrawAmount || 10
        })
      }
    } catch (err) {
      console.error('Failed to load config:', err)
    }
  },

  // Load withdrawal records
  async loadRecords() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'withdraw',
        data: { action: 'list' }
      })
      if (res.result && res.result.data) {
        this.setData({
          records: res.result.data.records || []
        })
      }
    } catch (err) {
      console.error('Failed to load records:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // Handle amount input
  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  // Withdraw all balance
  withdrawAll() {
    this.setData({ amount: this.data.balance })
  },

  // Submit withdrawal
  submitWithdraw() {
    const amount = parseFloat(this.data.amount)
    const balance = parseFloat(this.data.balance)
    const minAmount = this.data.minAmount

    if (!this.data.amount || isNaN(amount)) {
      wx.showToast({ title: '请输入提现金额', icon: 'none' })
      return
    }

    if (amount < minAmount) {
      wx.showToast({ title: `最低提现金额为¥${minAmount}`, icon: 'none' })
      return
    }

    if (amount > balance) {
      wx.showToast({ title: '提现金额不能超过可用余额', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认提现',
      content: `确认提现 ¥${amount.toFixed(2)} ？`,
      confirmColor: '#1a3a5c',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ submitting: true })
          try {
            const result = await wx.cloud.callFunction({
              name: 'withdraw',
              data: {
                action: 'apply',
                amount: amount
              }
            })
            if (result.result && result.result.success) {
              wx.showToast({ title: '提现申请已提交', icon: 'success' })
              this.setData({ amount: '' })
              this.loadBalance()
              this.loadRecords()
            } else {
              wx.showToast({
                title: result.result.message || '提现失败',
                icon: 'none'
              })
            }
          } catch (err) {
            console.error('Withdraw failed:', err)
            wx.showToast({ title: '提现失败，请稍后重试', icon: 'none' })
          } finally {
            this.setData({ submitting: false })
          }
        }
      }
    })
  }
})
