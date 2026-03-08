Component({
  properties: {
    coupon: { type: Object, value: {} },
    selectable: { type: Boolean, value: false },
    selected: { type: Boolean, value: false }
  },
  methods: {
    onSelect() {
      if (this.data.selectable) {
        this.triggerEvent('select', { coupon: this.data.coupon })
      }
    },
    onUse() {
      this.triggerEvent('use', { coupon: this.data.coupon })
    }
  }
})
