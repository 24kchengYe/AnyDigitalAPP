Page({
  data: {
    form: { company: '', name: '', phone: '', quantity: '', remark: '' },
    submitting: false
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  submitForm() {
    const { company, name, phone, quantity } = this.data.form
    if (!company || !name || !phone || !quantity) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    const db = wx.cloud.database()
    db.collection('group_buy_requests').add({
      data: {
        ...this.data.form,
        quantity: parseInt(quantity),
        status: 'pending',
        createdAt: db.serverDate()
      }
    }).then(() => {
      wx.showModal({
        title: '提交成功',
        content: '我们将在24小时内与您联系',
        showCancel: false,
        success: () => wx.navigateBack()
      })
    }).catch(err => {
      console.error(err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
