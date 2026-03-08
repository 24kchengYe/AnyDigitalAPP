Page({
  data: {
    stats: {
      totalReferrals: 0,
      totalEarnings: '0.00',
      pendingEarnings: '0.00'
    },
    records: [],
    page: 1,
    hasMore: true,
    posterUrl: '',
    showPoster: false,
    generating: false,
    loading: false
  },

  onLoad() {
    this.loadStats()
    this.loadRecords()
  },

  // Load referral stats
  async loadStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'referral',
        data: { action: 'getStats' }
      })
      if (res.result && res.result.data) {
        this.setData({ stats: res.result.data })
      }
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  },

  // Load referral records
  async loadRecords() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'referral',
        data: {
          action: 'getRecords',
          page: this.data.page,
          pageSize: 10
        }
      })
      if (res.result && res.result.data) {
        const newRecords = res.result.data.records || []
        this.setData({
          records: this.data.page === 1 ? newRecords : this.data.records.concat(newRecords),
          hasMore: newRecords.length >= 10
        })
      }
    } catch (err) {
      console.error('Failed to load records:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // Load more records
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadRecords()
  },

  // Navigate to withdraw page
  goToWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/withdraw' })
  },

  // Generate referral poster
  async generatePoster() {
    if (this.data.generating) return
    this.setData({ generating: true })

    try {
      // Step 1: Get QR code from cloud function
      const qrRes = await wx.cloud.callFunction({
        name: 'referral',
        data: { action: 'getQrcode' }
      })

      if (!qrRes.result || !qrRes.result.data || !qrRes.result.data.qrcodeUrl) {
        throw new Error('Failed to get QR code')
      }

      const qrcodeUrl = qrRes.result.data.qrcodeUrl

      // Step 2: Download QR code image
      const qrImage = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: qrcodeUrl,
          success: res => resolve(res.tempFilePath),
          fail: reject
        })
      })

      // Step 3: Draw poster using Canvas 2D API
      const query = this.createSelectorQuery()
      const canvas = await new Promise(resolve => {
        query.select('#posterCanvas')
          .fields({ node: true, size: true })
          .exec(res => resolve(res[0]))
      })

      const canvasNode = canvas.node
      const ctx = canvasNode.getContext('2d')

      const dpr = wx.getSystemInfoSync().pixelRatio
      const canvasWidth = 600
      const canvasHeight = 900
      canvasNode.width = canvasWidth * dpr
      canvasNode.height = canvasHeight * dpr
      ctx.scale(dpr, dpr)

      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
      gradient.addColorStop(0, '#1a3a5c')
      gradient.addColorStop(0.4, '#2c5f8a')
      gradient.addColorStop(0.4, '#ffffff')
      gradient.addColorStop(1, '#ffffff')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Shop name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('十脚怪兽', canvasWidth / 2, 100)

      // User info
      ctx.font = '28px sans-serif'
      ctx.fillText('高淳好蟹，与你分享', canvasWidth / 2, 160)

      // Decorative line
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(100, 200)
      ctx.lineTo(500, 200)
      ctx.stroke()

      // Promo text area
      ctx.fillStyle = '#333333'
      ctx.font = 'bold 36px sans-serif'
      ctx.fillText('扫码下单，产地直发', canvasWidth / 2, 500)

      ctx.fillStyle = '#1a3a5c'
      ctx.font = '28px sans-serif'
      ctx.fillText('新用户专享折扣', canvasWidth / 2, 550)

      // Draw QR code
      const qrImg = canvasNode.createImage()
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve
        qrImg.onerror = reject
        qrImg.src = qrImage
      })
      const qrSize = 200
      const qrX = (canvasWidth - qrSize) / 2
      const qrY = 600
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

      // Bottom hint
      ctx.fillStyle = '#999999'
      ctx.font = '22px sans-serif'
      ctx.fillText('长按识别小程序码', canvasWidth / 2, 840)

      // Step 4: Export canvas to image
      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: canvasNode,
          success: res => resolve(res.tempFilePath),
          fail: reject
        })
      })

      this.setData({
        posterUrl: tempFilePath,
        showPoster: true
      })
    } catch (err) {
      console.error('Failed to generate poster:', err)
      wx.showToast({ title: '海报生成失败', icon: 'none' })
    } finally {
      this.setData({ generating: false })
    }
  },

  // Save poster to album
  savePoster() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterUrl,
      success() {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail(err) {
        if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存图片到相册',
            confirmText: '去授权',
            success(modalRes) {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  // Close poster modal
  closePoster() {
    this.setData({ showPoster: false })
  },

  // Share
  onShareAppMessage() {
    return {
      title: '高淳好蟹，产地直发，推荐给你尝尝！',
      path: `/pages/index/index?referrerId=${wx.getStorageSync('userId') || ''}`,
      imageUrl: this.data.posterUrl || ''
    }
  }
})
