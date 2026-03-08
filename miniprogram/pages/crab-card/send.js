Page({
  data: {
    cards: []
  },

  onShow() {
    this.loadCards()
  },

  loadCards() {
    wx.cloud.callFunction({
      name: 'order',
      data: { action: 'getCrabCards' }
    }).then(res => {
      const result = res.result || {}
      if (result.code === 0) {
        this.setData({ cards: result.data.list || [] })
      }
    })
  },

  shareCard(e) {
    const { code, name } = e.currentTarget.dataset
    wx.showModal({
      title: '分享蟹卡',
      content: `兑换码: ${code}\n\n请将此码发送给好友，好友打开小程序"蟹卡兑换"页面输入即可提货。\n\n或点击确定复制兑换码。`,
      confirmText: '复制',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: code })
        }
      }
    })
  },

  goShop() {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  onShareAppMessage() {
    return {
      title: '送你一份鲜美螃蟹，快来领取！',
      path: '/pages/crab-card/redeem'
    }
  }
})
