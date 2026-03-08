Page({
  data: {
    withdrawals: [],
    currentStatus: 'pending',
    page: 0,
    pageSize: 20,
    loading: false,
    noMore: false
  },

  onLoad() {
    this.loadWithdrawals()
  },

  onPullDownRefresh() {
    this.setData({ withdrawals: [], page: 0, noMore: false })
    this.loadWithdrawals().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadWithdrawals()
    }
  },

  filterByStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({
      currentStatus: status,
      withdrawals: [],
      page: 0,
      noMore: false
    })
    this.loadWithdrawals()
  },

  async loadWithdrawals() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'withdraw',
        data: {
          action: 'adminList',
          status: this.data.currentStatus,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (res.result && res.result.data) {
        const newList = res.result.data
        this.setData({
          withdrawals: [...this.data.withdrawals, ...newList],
          page: this.data.page + 1,
          noMore: newList.length < this.data.pageSize
        })
      }
    } catch (err) {
      console.error('加载提现列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async approveWithdraw(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认审批',
        content: '确定要通过此提现申请吗？',
        confirmColor: '#2ecc71',
        success: res => resolve(res.confirm)
      })
    })

    if (!confirmed) return

    wx.showLoading({ title: '处理中...' })
    try {
      await wx.cloud.callFunction({
        name: 'withdraw',
        data: {
          action: 'approve',
          withdrawId: id
        }
      })
      wx.showToast({ title: '已通过', icon: 'success' })
      this.setData({ withdrawals: [], page: 0, noMore: false })
      this.loadWithdrawals()
    } catch (err) {
      console.error('审批失败:', err)
      wx.showToast({ title: '审批失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async rejectWithdraw(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认拒绝',
        content: '确定要拒绝此提现申请吗？',
        confirmColor: '#1a3a5c',
        success: res => resolve(res.confirm)
      })
    })

    if (!confirmed) return

    wx.showLoading({ title: '处理中...' })
    try {
      await wx.cloud.callFunction({
        name: 'withdraw',
        data: {
          action: 'reject',
          withdrawId: id
        }
      })
      wx.showToast({ title: '已拒绝', icon: 'success' })
      this.setData({ withdrawals: [], page: 0, noMore: false })
      this.loadWithdrawals()
    } catch (err) {
      console.error('拒绝失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
