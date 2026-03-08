Component({
  properties: {
    order: { type: Object, value: {} }
  },
  methods: {
    onCancel() {
      this.triggerEvent('cancel', { orderId: this.data.order._id })
    },
    onPay() {
      this.triggerEvent('pay', { orderId: this.data.order._id })
    },
    onDetail() {
      this.triggerEvent('detail', { orderId: this.data.order._id })
    }
  }
})
