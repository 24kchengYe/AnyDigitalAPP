Page({
  data: {
    members: [],
    totalMembers: 0,
    newMembersToday: 0,
    newMembersMonth: 0,
    page: 0,
    pageSize: 20,
    loading: false,
    noMore: false
  },

  onLoad() {
    this.loadMembers()
  },

  onPullDownRefresh() {
    this.setData({ members: [], page: 0, noMore: false })
    this.loadMembers().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (!this.data.noMore && !this.data.loading) {
      this.loadMembers()
    }
  },

  async loadMembers() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'getMembers',
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (res.result && res.result.data) {
        const { list, totalMembers, newMembersToday, newMembersMonth } = res.result.data
        this.setData({
          members: [...this.data.members, ...list],
          totalMembers: totalMembers || this.data.totalMembers,
          newMembersToday: newMembersToday || this.data.newMembersToday,
          newMembersMonth: newMembersMonth || this.data.newMembersMonth,
          page: this.data.page + 1,
          noMore: list.length < this.data.pageSize
        })
      }
    } catch (err) {
      console.error('加载会员列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
