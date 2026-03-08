const EXPRESS_COMPANIES = ['顺丰速运', '京东快递', '中通快递', '圆通速递', '韵达快递', '申通快递', '极兔速递']

Page({
  data: {
    orders: [],
    currentStatus: '',
    page: 0,
    pageSize: 20,
    loading: false,
    noMore: false,
    // 发货弹窗
    showShipModal: false,
    shipOrderId: '',
    expressCompanies: EXPRESS_COMPANIES,
    expressCompanyIndex: 0,
    expressNo: ''
  },

  onLoad() {
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.setData({ orders: [], page: 0, noMore: false })
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadOrders()
    }
  },

  filterByStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({
      currentStatus: status,
      orders: [],
      page: 0,
      noMore: false
    })
    this.loadOrders()
  },

  async loadOrders() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getOrders',
          status: this.data.currentStatus,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (res.result && res.result.data) {
        const newOrders = res.result.data.list || res.result.data || []
        this.setData({
          orders: [...this.data.orders, ...newOrders],
          page: this.data.page + 1,
          noMore: newOrders.length < this.data.pageSize
        })
      }
    } catch (err) {
      console.error('加载订单失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ===== 发货功能 =====
  openShipModal(e) {
    const orderId = e.currentTarget.dataset.id
    this.setData({
      showShipModal: true,
      shipOrderId: orderId,
      expressCompanyIndex: 0,
      expressNo: ''
    })
  },

  closeShipModal() {
    this.setData({ showShipModal: false, shipOrderId: '', expressNo: '' })
  },

  onExpressCompanyChange(e) {
    this.setData({ expressCompanyIndex: e.detail.value })
  },

  onExpressNoInput(e) {
    this.setData({ expressNo: e.detail.value })
  },

  async confirmShip() {
    const { shipOrderId, expressCompanies, expressCompanyIndex, expressNo } = this.data

    if (!expressNo.trim()) {
      wx.showToast({ title: '请输入快递单号', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发货中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'shipOrder',
          orderId: shipOrderId,
          expressCompany: expressCompanies[expressCompanyIndex],
          expressNo: expressNo.trim()
        }
      })

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '发货成功', icon: 'success' })
        this.closeShipModal()
        this.setData({ orders: [], page: 0, noMore: false })
        this.loadOrders()
      } else {
        wx.showToast({ title: res.result.msg || '发货失败', icon: 'none' })
      }
    } catch (err) {
      console.error('发货失败:', err)
      wx.showToast({ title: '发货失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async completeOrder(e) {
    const orderId = e.currentTarget.dataset.id
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认操作',
        content: '确定要将此订单标记为已完成吗？',
        success: res => resolve(res.confirm)
      })
    })

    if (!confirmed) return

    wx.showLoading({ title: '处理中...' })
    try {
      await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'updateOrderStatus',
          orderId: orderId,
          status: 'completed'
        }
      })
      wx.showToast({ title: '操作成功', icon: 'success' })
      this.setData({ orders: [], page: 0, noMore: false })
      this.loadOrders()
    } catch (err) {
      console.error('更新订单状态失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 复制快递单号
  copyExpressNo(e) {
    const no = e.currentTarget.dataset.no
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  viewDetail(e) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + orderId
    })
  }
})
