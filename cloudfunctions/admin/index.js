const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 所有 admin 操作均需验证管理员身份
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return { code: -1, msg: '无管理员权限' }
  }

  switch (action) {
    case 'getDashboard':
      return handleGetDashboard()
    case 'getOrders':
      return handleGetOrders(event)
    case 'updateOrderStatus':
      return handleUpdateOrderStatus(event)
    case 'getMembers':
      return handleGetMembers(event)
    case 'getDishes':
      return handleGetDishes(event)
    case 'addDish':
      return handleAddDish(event)
    case 'updateDish':
      return handleUpdateDish(event)
    case 'deleteDish':
      return handleDeleteDish(event)
    case 'clearDishes':
      return handleClearDishes()
    case 'getConfig':
      return handleGetConfig()
    case 'updateConfig':
      return handleUpdateConfig(event)
    case 'shipOrder':
      return handleShipOrder(event)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 验证管理员
async function checkAdmin(openid) {
  const userRes = await db.collection('users').where({ _openid: openid }).get()
  return userRes.data && userRes.data[0] && userRes.data[0].isAdmin === true
}

// ========== 仪表盘 ==========
async function handleGetDashboard() {
  try {
    // 总用户数
    const totalUsersRes = await db.collection('users').count()
    const totalUsers = totalUsersRes.total

    // 总会员数
    const totalMembersRes = await db.collection('users').where({ isMember: true }).count()
    const totalMembers = totalMembersRes.total

    // 总订单数
    const totalOrdersRes = await db.collection('orders').count()
    const totalOrders = totalOrdersRes.total

    // 总营收（已支付订单）
    const paidOrdersRes = await db.collection('orders')
      .where({ status: _.in(['paid', 'completed']) })
      .get()
    let totalRevenue = 0
    for (const o of paidOrdersRes.data) {
      totalRevenue += (o.actualFee || o.totalFee || 0)
    }

    // 今日统计
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayOrdersRes = await db.collection('orders')
      .where({ createdAt: _.gte(today) })
      .get()
    const todayOrders = todayOrdersRes.data.length

    let todayRevenue = 0
    for (const o of todayOrdersRes.data) {
      if (o.status === 'paid' || o.status === 'completed') {
        todayRevenue += (o.actualFee || o.totalFee || 0)
      }
    }

    // 推荐统计
    const totalReferralRes = await db.collection('referrals').count()
    const totalReferralCount = totalReferralRes.total

    const referralRecords = await db.collection('referrals').get()
    let totalReferralRewards = 0
    for (const r of referralRecords.data) {
      totalReferralRewards += (r.reward || 0)
    }

    return {
      code: 0,
      data: {
        totalUsers,
        totalMembers,
        totalOrders,
        totalRevenue,
        todayOrders,
        todayRevenue,
        totalReferralCount,
        totalReferralRewards
      }
    }
  } catch (err) {
    console.error('getDashboard error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 订单列表（筛选 + 分页） ==========
async function handleGetOrders(event) {
  const { status, startDate, endDate, page = 1, pageSize = 20 } = event

  try {
    const skip = (page - 1) * pageSize
    const condition = {}

    if (status) {
      condition.status = status
    }

    if (startDate || endDate) {
      condition.createdAt = {}
      if (startDate) condition.createdAt = _.gte(new Date(startDate))
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        condition.createdAt = startDate
          ? _.and(_.gte(new Date(startDate)), _.lte(end))
          : _.lte(end)
      }
    }

    const countRes = await db.collection('orders').where(condition).count()

    const listRes = await db.collection('orders')
      .where(condition)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      code: 0,
      data: {
        list: listRes.data,
        total: countRes.total,
        page,
        pageSize
      }
    }
  } catch (err) {
    console.error('getOrders error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 更新订单状态 ==========
async function handleUpdateOrderStatus(event) {
  const { orderId, status } = event

  try {
    if (!orderId || !status) {
      return { code: -1, msg: '缺少 orderId 或 status' }
    }

    const updateData = {
      status,
      updatedAt: db.serverDate()
    }

    if (status === 'completed') {
      updateData.completedAt = db.serverDate()
    }

    await db.collection('orders').doc(orderId).update({ data: updateData })

    return { code: 0, msg: '订单状态已更新' }
  } catch (err) {
    console.error('updateOrderStatus error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 会员列表 ==========
async function handleGetMembers(event) {
  const { page = 1, pageSize = 20 } = event

  try {
    const skip = (page - 1) * pageSize

    const countRes = await db.collection('users')
      .where({ isMember: true })
      .count()

    const listRes = await db.collection('users')
      .where({ isMember: true })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      code: 0,
      data: {
        list: listRes.data,
        total: countRes.total,
        page,
        pageSize
      }
    }
  } catch (err) {
    console.error('getMembers error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 菜品列表（含下架） ==========
async function handleGetDishes(event) {
  const { page = 1, pageSize = 50 } = event

  try {
    const skip = (page - 1) * pageSize

    const countRes = await db.collection('dishes').count()

    const listRes = await db.collection('dishes')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      code: 0,
      data: {
        list: listRes.data,
        total: countRes.total,
        page,
        pageSize
      }
    }
  } catch (err) {
    console.error('getDishes error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 新增菜品 ==========
async function handleAddDish(event) {
  const { name, price, category, imageUrl, description } = event

  try {
    if (!name || !price) {
      return { code: -1, msg: '商品名称和价格必填' }
    }

    const now = db.serverDate()
    const res = await db.collection('dishes').add({
      data: {
        name,
        price, // 单位: 分
        category: category || '',
        imageUrl: imageUrl || '',
        description: description || '',
        isAvailable: true,
        createdAt: now,
        updatedAt: now
      }
    })

    return { code: 0, data: { dishId: res._id }, msg: '商品已添加' }
  } catch (err) {
    console.error('addDish error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 更新菜品 ==========
async function handleUpdateDish(event) {
  const { dishId, ...fields } = event
  // 移除非数据字段
  delete fields.action

  try {
    if (!dishId) {
      return { code: -1, msg: '缺少 dishId' }
    }

    fields.updatedAt = db.serverDate()

    await db.collection('dishes').doc(dishId).update({ data: fields })

    return { code: 0, msg: '商品已更新' }
  } catch (err) {
    console.error('updateDish error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 删除菜品（软删除） ==========
async function handleDeleteDish(event) {
  const { dishId } = event

  try {
    if (!dishId) {
      return { code: -1, msg: '缺少 dishId' }
    }

    await db.collection('dishes').doc(dishId).update({
      data: {
        isAvailable: false,
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, msg: '商品已下架' }
  } catch (err) {
    console.error('deleteDish error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 清空商品（批量删除） ==========
async function handleClearDishes() {
  try {
    // 云数据库每次最多删20条，需循环删除
    let deleted = 0
    while (true) {
      const res = await db.collection('dishes').where({
        _id: _.exists(true)
      }).limit(20).remove()
      if (res.stats.removed === 0) break
      deleted += res.stats.removed
    }
    return { code: 0, data: { deleted }, msg: `已清空${deleted}条商品数据` }
  } catch (err) {
    console.error('clearDishes error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 发货操作 ==========
async function handleShipOrder(event) {
  const { orderId, expressCompany, expressNo } = event

  try {
    if (!orderId) {
      return { code: -1, msg: '缺少 orderId' }
    }
    if (!expressCompany || !expressNo) {
      return { code: -1, msg: '请填写快递公司和快递单号' }
    }

    const res = await db.collection('orders').doc(orderId).get()
    const order = res.data

    if (!order) {
      return { code: -1, msg: '订单不存在' }
    }
    if (order.status !== 'paid') {
      return { code: -1, msg: '仅待发货订单可发货' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'shipped',
        expressCompany,
        expressNo,
        shippedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, msg: '已发货' }
  } catch (err) {
    console.error('shipOrder error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 获取全局配置 ==========
async function handleGetConfig() {
  try {
    const res = await db.collection('config').doc('global').get()
    return { code: 0, data: res.data }
  } catch (err) {
    // 配置不存在时返回空
    if (err.errCode === -1) {
      return { code: 0, data: {} }
    }
    console.error('getConfig error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 更新全局配置 ==========
async function handleUpdateConfig(event) {
  const { ...fields } = event
  delete fields.action

  try {
    fields.updatedAt = db.serverDate()

    try {
      await db.collection('config').doc('global').update({ data: fields })
    } catch (e) {
      // 如果文档不存在则创建
      await db.collection('config').add({
        data: {
          _id: 'global',
          ...fields,
          createdAt: db.serverDate()
        }
      })
    }

    return { code: 0, msg: '配置已更新' }
  } catch (err) {
    console.error('updateConfig error', err)
    return { code: -1, msg: err.message }
  }
}
