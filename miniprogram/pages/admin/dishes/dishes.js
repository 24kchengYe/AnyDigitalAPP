Page({
  data: {
    dishes: [],
    loading: false,
    showForm: false,
    formMode: 'add', // 'add' or 'edit'
    formData: {
      _id: '',
      name: '',
      category: '',
      categoryIndex: 0,
      price: '',
      description: '',
      imageUrl: '',
      imageFileId: ''
    },
    categories: ['活蟹', '套餐', '蟹卡', '礼盒', '蟹味美食', '配件', '其他'],
    editingIndex: -1
  },

  onLoad() {
    this.loadDishes()
  },

  onShow() {
    this.loadDishes()
  },

  async loadDishes() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'getDishes' }
      })
      if (res.result && res.result.data) {
        const data = res.result.data
        this.setData({ dishes: data.list || data })
      }
    } catch (err) {
      console.error('加载菜品列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  showAddForm() {
    this.setData({
      showForm: true,
      formMode: 'add',
      formData: {
        _id: '',
        name: '',
        category: '',
        categoryIndex: 0,
        price: '',
        description: '',
        imageUrl: '',
        imageFileId: ''
      },
      editingIndex: -1
    })
  },

  showEditForm(e) {
    const index = e.currentTarget.dataset.index
    const dish = this.data.dishes[index]
    const categoryIndex = this.data.categories.indexOf(dish.category)
    this.setData({
      showForm: true,
      formMode: 'edit',
      formData: {
        _id: dish._id,
        name: dish.name,
        category: dish.category,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
        price: String(dish.price / 100),
        description: dish.description || '',
        imageUrl: dish.imageUrl || '',
        imageFileId: dish.imageFileId || ''
      },
      editingIndex: index
    })
  },

  hideForm() {
    this.setData({ showForm: false })
  },

  preventClose() {
    // Prevent modal from closing when tapping content area
  },

  onInputName(e) {
    this.setData({ 'formData.name': e.detail.value })
  },

  onPickCategory(e) {
    const index = e.detail.value
    this.setData({
      'formData.categoryIndex': index,
      'formData.category': this.data.categories[index]
    })
  },

  onInputPrice(e) {
    this.setData({ 'formData.price': e.detail.value })
  },

  onInputDesc(e) {
    this.setData({ 'formData.description': e.detail.value })
  },

  async uploadImage() {
    try {
      const chooseRes = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })

      const filePath = chooseRes.tempFilePaths[0]
      wx.showLoading({ title: '上传中...' })

      const timestamp = Date.now()
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `dishes/${timestamp}_${Math.random().toString(36).substr(2, 8)}.jpg`,
        filePath: filePath
      })

      this.setData({
        'formData.imageUrl': uploadRes.fileID,
        'formData.imageFileId': uploadRes.fileID
      })

      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      if (err.errMsg && err.errMsg.indexOf('cancel') > -1) return
      console.error('上传图片失败:', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async saveDish() {
    const { formData, formMode } = this.data

    // Validate
    if (!formData.name.trim()) {
      return wx.showToast({ title: '请输入菜品名称', icon: 'none' })
    }
    if (!formData.category) {
      return wx.showToast({ title: '请选择菜品分类', icon: 'none' })
    }
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      return wx.showToast({ title: '请输入有效价格', icon: 'none' })
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const action = formMode === 'add' ? 'addDish' : 'updateDish'
      const dishData = {
        name: formData.name.trim(),
        category: formData.category,
        price: Math.round(Number(formData.price) * 100),
        description: formData.description.trim(),
        imageUrl: formData.imageUrl,
        imageFileId: formData.imageFileId
      }

      if (formMode === 'edit') {
        dishData.dishId = formData._id
      }

      await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: action,
          ...dishData
        }
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
      this.hideForm()
      this.loadDishes()
    } catch (err) {
      console.error('保存菜品失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async toggleAvailable(e) {
    const { id, available } = e.currentTarget.dataset
    try {
      await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'updateDish',
          _id: id,
          isAvailable: !available
        }
      })
      this.loadDishes()
    } catch (err) {
      console.error('切换上架状态失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async clearAllDishes() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认清空',
        content: '将删除全部商品数据，此操作不可撤销！确定继续？',
        confirmColor: '#e74c3c',
        confirmText: '确认清空',
        success: res => resolve(res.confirm)
      })
    })

    if (!confirmed) return

    wx.showLoading({ title: '清空中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: { action: 'clearDishes' }
      })
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: res.result.msg, icon: 'success' })
        this.loadDishes()
      } else {
        wx.showToast({ title: res.result.msg || '清空失败', icon: 'none' })
      }
    } catch (err) {
      console.error('清空商品失败:', err)
      wx.showToast({ title: '清空失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async deleteDish(e) {
    const { id, name } = e.currentTarget.dataset
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除商品"${name}"吗？此操作不可撤销。`,
        confirmColor: '#1a3a5c',
        success: res => resolve(res.confirm)
      })
    })

    if (!confirmed) return

    wx.showLoading({ title: '删除中...' })
    try {
      await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'deleteDish',
          dishId: id
        }
      })
      wx.showToast({ title: '删除成功', icon: 'success' })
      this.loadDishes()
    } catch (err) {
      console.error('删除菜品失败:', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
