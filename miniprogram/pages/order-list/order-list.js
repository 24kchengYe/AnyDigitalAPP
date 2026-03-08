const app = getApp()

const STATUS_MAP = {
  pending: '待付款',
  paid: '待发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消'
}

const PAGE_SIZE = 10

Page({
  data: {
    activeTab: '',
    orders: [],
    loading: false,
    noMore: false,
    page: 0
  },

  onLoad() {
    this.loadOrders(true)
  },

  onShow() {
    this.loadOrders(true)
  },

  /**
   * Switch status tab filter
   */
  switchTab(e) {
    const status = e.currentTarget.dataset.status
    if (status === this.data.activeTab) return
    this.setData({ activeTab: status })
    this.loadOrders(true)
  },

  /**
   * Load orders from cloud function
   */
  async loadOrders(reset = false) {
    if (this.data.loading) return

    if (reset) {
      this.setData({
        orders: [],
        page: 0,
        noMore: false
      })
    }

    if (this.data.noMore) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'list',
          status: this.data.activeTab,
          page: this.data.page,
          pageSize: PAGE_SIZE
        }
      })

      const result = res.result || {}
      const rawOrders = (result.data && result.data.list) || result.orders || []

      const formattedOrders = rawOrders.map(order => {
        const orderIdShort = order._id ? order._id.slice(-8).toUpperCase() : ''

        const createTime = order.createdAt ? new Date(order.createdAt) : (order.createTime ? new Date(order.createTime) : new Date())
        const createTimeStr = this.formatTime(createTime)

        const itemsSummary = (order.items || [])
          .map(item => `${item.name}×${item.quantity}`)
          .join('、')

        const statusText = STATUS_MAP[order.status] || order.status

        // 计算实付金额（兼容 actualFee 分和 actualPrice 元）
        let displayPrice
        if (order.actualPrice !== undefined) {
          displayPrice = Number(order.actualPrice).toFixed(2)
        } else if (order.actualFee !== undefined) {
          displayPrice = (order.actualFee / 100).toFixed(2)
        } else {
          displayPrice = '0.00'
        }

        return {
          ...order,
          orderIdShort,
          createTimeStr,
          itemsSummary,
          statusText,
          displayPrice
        }
      })

      const currentOrders = reset ? formattedOrders : [...this.data.orders, ...formattedOrders]

      this.setData({
        orders: currentOrders,
        page: this.data.page + 1,
        noMore: rawOrders.length < PAGE_SIZE,
        loading: false
      })
    } catch (err) {
      console.error('Failed to load orders:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onPullDownRefresh() {
    this.loadOrders(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadOrders(false)
  },

  /**
   * Cancel an order
   */
  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({
              name: 'order',
              data: { action: 'cancel', orderId }
            })
            wx.showToast({ title: '已取消', icon: 'success' })
            this.loadOrders(true)
          } catch (err) {
            console.error('Cancel order failed:', err)
            wx.showToast({ title: '取消失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * Confirm receive (user side)
   */
  confirmReceive(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({
              name: 'order',
              data: { action: 'confirmReceive', orderId }
            })
            wx.showToast({ title: '已确认收货', icon: 'success' })
            this.loadOrders(true)
          } catch (err) {
            console.error('Confirm receive failed:', err)
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * Copy express number to clipboard
   */
  copyExpressNo(e) {
    const expressNo = e.currentTarget.dataset.no
    wx.setClipboardData({
      data: expressNo,
      success: () => {
        wx.showToast({ title: '单号已复制', icon: 'success' })
      }
    })
  },

  /**
   * View order detail
   */
  viewDetail(e) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`
    })
  },

  formatTime(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}`
  }
})
