const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    // 收货地址
    receiverName: '',
    receiverPhone: '',
    region: ['江苏省', '南京市', '高淳区'],
    address: '',
    saveAsDefault: false,

    items: [],
    coupons: [],
    selectedCoupon: null,
    showCoupons: false,
    totalPrice: 0,
    actualPrice: 0,
    memberLevel: 0,
    selfDiscountRate: 0,
    memberDiscount: 0,
    isMember: false
  },

  onLoad() {
    this.loadCartItems()
    this.loadCoupons()
    this.loadDefaultAddress()
    this.loadMemberLevel()
  },

  /**
   * Load cart items from app global data
   */
  loadCartItems() {
    const cart = app.globalData.cart || []
    const items = cart.map(item => ({
      ...item,
      subtotal: item.price * item.quantity
    }))

    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

    this.setData({
      items,
      totalPrice: totalPrice,
      actualPrice: totalPrice
    })
    this.calculatePrice()
  },

  /**
   * Load default address from user record
   */
  async loadDefaultAddress() {
    try {
      const res = await db.collection('users')
        .where({ _openid: '{openid}' })
        .get()
      if (res.data && res.data[0] && res.data[0].defaultAddress) {
        const addr = res.data[0].defaultAddress
        this.setData({
          receiverName: addr.name || '',
          receiverPhone: addr.phone || '',
          region: addr.region || ['江苏省', '南京市', '高淳区'],
          address: addr.address || ''
        })
      }
    } catch (err) {
      console.error('Failed to load default address:', err)
    }
  },

  /**
   * Load unused coupons from cloud DB
   */
  async loadCoupons() {
    try {
      const res = await db.collection('coupons')
        .where({
          _openid: '{openid}',
          used: false,
          expireDate: db.command.gte(new Date())
        })
        .get()

      this.setData({ coupons: res.data })
    } catch (err) {
      console.error('Failed to load coupons:', err)
    }
  },

  /**
   * Load member level for self-discount calculation
   */
  async loadMemberLevel() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: { action: 'getMemberLevel' }
      })
      if (res.result && res.result.code === 0 && res.result.data.isMember) {
        const d = res.result.data
        this.setData({
          isMember: true,
          memberLevel: d.memberLevel,
          selfDiscountRate: d.selfDiscount
        })
        this.calculatePrice()
      }
    } catch (err) {
      console.error('Failed to load member level:', err)
    }
  },

  // ===== 收货地址输入 =====
  onNameInput(e) {
    this.setData({ receiverName: e.detail.value })
  },

  onPhoneInput(e) {
    this.setData({ receiverPhone: e.detail.value })
  },

  onRegionChange(e) {
    this.setData({ region: e.detail.value })
  },

  onAddressInput(e) {
    this.setData({ address: e.detail.value })
  },

  onSaveDefaultChange(e) {
    this.setData({ saveAsDefault: e.detail.value })
  },

  /**
   * Toggle coupon list visibility
   */
  toggleCouponList() {
    this.setData({ showCoupons: !this.data.showCoupons })
  },

  /**
   * Select a coupon
   */
  selectCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    if (this.data.totalPrice < coupon.minAmount) {
      wx.showToast({ title: `需满¥${coupon.minAmount}才可使用`, icon: 'none' })
      return
    }
    this.setData({ selectedCoupon: coupon })
    this.calculatePrice()
  },

  /**
   * Clear coupon selection
   */
  clearCoupon() {
    this.setData({ selectedCoupon: null })
    this.calculatePrice()
  },

  /**
   * Calculate final price based on total and coupon
   */
  calculatePrice() {
    const total = this.data.totalPrice  // 单位：分
    const couponDiscount = this.data.selectedCoupon ? this.data.selectedCoupon.discount : 0

    // 会员自购折扣
    let memberDisc = 0
    if (this.data.isMember && this.data.selfDiscountRate > 0) {
      memberDisc = Math.round(total * this.data.selfDiscountRate)
    }

    const actual = Math.max(0, total - couponDiscount - memberDisc)

    this.setData({
      memberDiscount: memberDisc,
      actualPrice: actual
    })
  },

  /**
   * Validate shipping info
   */
  validateShipping() {
    const { receiverName, receiverPhone, region, address } = this.data

    if (!receiverName.trim()) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' })
      return false
    }
    if (!receiverPhone.trim() || !/^1\d{10}$/.test(receiverPhone.trim())) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return false
    }
    if (!region || region.length < 3) {
      wx.showToast({ title: '请选择收货地区', icon: 'none' })
      return false
    }
    if (!address.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' })
      return false
    }
    return true
  },

  /**
   * Submit order and initiate WeChat payment
   */
  async submitOrder() {
    // Validate shipping info
    if (!this.validateShipping()) return

    if (this.data.items.length === 0) {
      wx.showToast({ title: '订单为空', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '提交订单中...' })

      const shippingInfo = {
        name: this.data.receiverName.trim(),
        phone: this.data.receiverPhone.trim(),
        province: this.data.region[0],
        city: this.data.region[1],
        district: this.data.region[2],
        address: this.data.address.trim()
      }

      // Prepare order data
      const orderData = {
        items: this.data.items.map(item => ({
          _id: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        shippingInfo,
        couponId: this.data.selectedCoupon ? this.data.selectedCoupon._id : null,
        totalPrice: this.data.totalPrice,
        actualPrice: this.data.actualPrice
      }

      // Save default address if checked
      if (this.data.saveAsDefault) {
        db.collection('users')
          .where({ _openid: '{openid}' })
          .update({
            data: {
              defaultAddress: {
                name: shippingInfo.name,
                phone: shippingInfo.phone,
                region: this.data.region,
                address: shippingInfo.address
              }
            }
          }).catch(err => console.error('Save address failed:', err))
      }

      // Call cloud function to create order and get payment params
      const res = await wx.cloud.callFunction({
        name: 'pay',
        data: {
          action: 'order',
          ...orderData
        }
      })

      wx.hideLoading()

      if (res.result && res.result.payment) {
        // Initiate WeChat payment
        const payment = res.result.payment
        await wx.requestPayment({
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'MD5',
          paySign: payment.paySign
        })

        // Payment successful
        wx.showToast({ title: '支付成功', icon: 'success' })

        // Clear cart
        app.clearCart()

        // Redirect to order list
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/order-list/order-list'
          })
        }, 1500)
      } else {
        wx.showToast({ title: '订单创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      if (err.errMsg && err.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        console.error('Payment failed:', err)
        wx.showToast({ title: '支付失败', icon: 'none' })
      }
    }
  }
})
