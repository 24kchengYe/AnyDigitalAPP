const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'list':
      return handleList(openid, event)
    case 'detail':
      return handleDetail(openid, event)
    case 'cancel':
      return handleCancel(openid, event)
    case 'complete':
      return handleComplete(openid, event)
    case 'ship':
      return handleShip(openid, event)
    case 'confirmReceive':
      return handleConfirmReceive(openid, event)
    case 'createCrabCard':
      return handleCreateCrabCard(openid, event)
    case 'getCrabCards':
      return handleGetCrabCards(openid, event)
    case 'getCrabCardDetail':
      return handleGetCrabCardDetail(event)
    case 'redeemCrabCard':
      return handleRedeemCrabCard(openid, event)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 订单列表（分页 + 状态筛选）
async function handleList(openid, event) {
  const { page = 1, pageSize = 10, status } = event

  try {
    const skip = (page - 1) * pageSize
    const condition = { _openid: openid }

    if (status) {
      condition.status = status
    }

    const countRes = await db.collection('orders')
      .where(condition)
      .count()

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
    console.error('order list error', err)
    return { code: -1, msg: err.message }
  }
}

// 订单详情
async function handleDetail(openid, event) {
  const { orderId } = event

  try {
    if (!orderId) {
      return { code: -1, msg: '缺少 orderId' }
    }

    const res = await db.collection('orders').doc(orderId).get()
    const order = res.data

    if (!order) {
      return { code: -1, msg: '订单不存在' }
    }

    // 普通用户只能查看自己的订单
    if (order._openid !== openid) {
      // 检查是否管理员
      const userRes = await db.collection('users').where({ _openid: openid }).get()
      const isAdmin = userRes.data && userRes.data[0] && userRes.data[0].isAdmin
      if (!isAdmin) {
        return { code: -1, msg: '无权查看该订单' }
      }
    }

    return { code: 0, data: order }
  } catch (err) {
    console.error('order detail error', err)
    return { code: -1, msg: err.message }
  }
}

// 取消订单（仅 pending 可取消）
async function handleCancel(openid, event) {
  const { orderId } = event

  try {
    if (!orderId) {
      return { code: -1, msg: '缺少 orderId' }
    }

    const res = await db.collection('orders').doc(orderId).get()
    const order = res.data

    if (!order) {
      return { code: -1, msg: '订单不存在' }
    }
    if (order._openid !== openid) {
      return { code: -1, msg: '无权操作该订单' }
    }
    if (order.status !== 'pending') {
      return { code: -1, msg: '当前订单状态不可取消' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'cancelled',
        updatedAt: db.serverDate()
      }
    })

    // 如果使用了优惠券，退还优惠券
    if (order.couponId) {
      await db.collection('coupons').doc(order.couponId).update({
        data: { used: false, usedAt: null }
      })
    }

    return { code: 0, msg: '订单已取消' }
  } catch (err) {
    console.error('order cancel error', err)
    return { code: -1, msg: err.message }
  }
}

// 管理员标记订单完成
async function handleComplete(openid, event) {
  const { orderId } = event

  try {
    // 验证管理员身份
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const isAdmin = userRes.data && userRes.data[0] && userRes.data[0].isAdmin
    if (!isAdmin) {
      return { code: -1, msg: '无管理员权限' }
    }

    if (!orderId) {
      return { code: -1, msg: '缺少 orderId' }
    }

    const res = await db.collection('orders').doc(orderId).get()
    const order = res.data

    if (!order) {
      return { code: -1, msg: '订单不存在' }
    }
    if (order.status !== 'paid' && order.status !== 'shipped') {
      return { code: -1, msg: '当前订单状态不可标记完成' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        completedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, msg: '订单已完成' }
  } catch (err) {
    console.error('order complete error', err)
    return { code: -1, msg: err.message }
  }
}

// 管理员发货
async function handleShip(openid, event) {
  const { orderId, expressCompany, expressNo } = event

  try {
    // 验证管理员身份
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const isAdmin = userRes.data && userRes.data[0] && userRes.data[0].isAdmin
    if (!isAdmin) {
      return { code: -1, msg: '无管理员权限' }
    }

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
    console.error('order ship error', err)
    return { code: -1, msg: err.message }
  }
}

// 用户确认收货
async function handleConfirmReceive(openid, event) {
  const { orderId } = event

  try {
    if (!orderId) {
      return { code: -1, msg: '缺少 orderId' }
    }

    const res = await db.collection('orders').doc(orderId).get()
    const order = res.data

    if (!order) {
      return { code: -1, msg: '订单不存在' }
    }
    if (order._openid !== openid) {
      return { code: -1, msg: '无权操作该订单' }
    }
    if (order.status !== 'shipped') {
      return { code: -1, msg: '订单未发货，无法确认收货' }
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        completedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, msg: '已确认收货' }
  } catch (err) {
    console.error('order confirmReceive error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 蟹卡送礼 ==========

// 生成6位兑换码
function generateRedeemCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// 购买蟹卡后创建蟹卡记录（从支付回调中调用或手动触发）
async function handleCreateCrabCard(openid, event) {
  const { orderId, greeting, theme } = event

  try {
    // 验证订单存在且已付款
    if (!orderId) return { code: -1, msg: '缺少订单ID' }

    const orderRes = await db.collection('orders').doc(orderId).get()
    const order = orderRes.data
    if (!order) return { code: -1, msg: '订单不存在' }
    if (order._openid !== openid) return { code: -1, msg: '无权操作' }
    if (order.status !== 'paid') return { code: -1, msg: '订单未支付' }

    // 为订单中的每个蟹卡商品生成兑换码
    const cards = []
    for (const item of (order.items || [])) {
      for (let i = 0; i < item.quantity; i++) {
        let redeemCode
        // 确保兑换码唯一
        while (true) {
          redeemCode = generateRedeemCode()
          const existing = await db.collection('crab_cards').where({ redeemCode }).count()
          if (existing.total === 0) break
        }

        const cardData = {
          buyerOpenid: openid,
          orderId,
          dishName: item.name,
          dishPrice: item.price,
          redeemCode,
          greeting: greeting || '送你一份鲜美，愿你蟹蟹常伴！',
          theme: theme || 'default',
          status: 'active',
          recipientOpenid: '',
          shippingInfo: null,
          createdAt: db.serverDate(),
          redeemedAt: null
        }
        const addRes = await db.collection('crab_cards').add({ data: cardData })
        cards.push({ _id: addRes._id, redeemCode, dishName: item.name })
      }
    }

    return { code: 0, data: { cards } }
  } catch (err) {
    console.error('createCrabCard error', err)
    return { code: -1, msg: err.message }
  }
}

// 获取我购买的蟹卡列表
async function handleGetCrabCards(openid, event) {
  try {
    const res = await db.collection('crab_cards')
      .where({ buyerOpenid: openid })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    return { code: 0, data: { list: res.data } }
  } catch (err) {
    console.error('getCrabCards error', err)
    return { code: -1, msg: err.message }
  }
}

// 通过兑换码查询蟹卡信息（收礼人查看）
async function handleGetCrabCardDetail(event) {
  const { redeemCode } = event
  try {
    if (!redeemCode) return { code: -1, msg: '请输入兑换码' }
    const res = await db.collection('crab_cards')
      .where({ redeemCode: redeemCode.toUpperCase() })
      .get()
    if (!res.data || res.data.length === 0) {
      return { code: -1, msg: '兑换码无效' }
    }
    const card = res.data[0]
    return {
      code: 0,
      data: {
        _id: card._id,
        dishName: card.dishName,
        dishPrice: card.dishPrice,
        greeting: card.greeting,
        theme: card.theme,
        status: card.status
      }
    }
  } catch (err) {
    console.error('getCrabCardDetail error', err)
    return { code: -1, msg: err.message }
  }
}

// 兑换蟹卡（收礼人填写地址后兑换）
async function handleRedeemCrabCard(openid, event) {
  const { redeemCode, shippingInfo } = event
  try {
    if (!redeemCode) return { code: -1, msg: '请输入兑换码' }
    if (!shippingInfo || !shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
      return { code: -1, msg: '请填写完整的收货信息' }
    }

    const res = await db.collection('crab_cards')
      .where({ redeemCode: redeemCode.toUpperCase() })
      .get()
    if (!res.data || res.data.length === 0) {
      return { code: -1, msg: '兑换码无效' }
    }

    const card = res.data[0]
    if (card.status !== 'active') {
      return { code: -1, msg: '该蟹卡已被兑换' }
    }

    // 更新蟹卡状态
    await db.collection('crab_cards').doc(card._id).update({
      data: {
        status: 'redeemed',
        recipientOpenid: openid,
        shippingInfo,
        redeemedAt: db.serverDate()
      }
    })

    // 创建一个发货订单给管理员处理
    await db.collection('orders').add({
      data: {
        _openid: openid,
        type: 'crab_card_redeem',
        items: [{ dishId: '', name: card.dishName, price: card.dishPrice, quantity: 1, lineTotal: card.dishPrice }],
        shippingInfo,
        totalFee: card.dishPrice,
        actualFee: 0,
        status: 'paid',
        crabCardId: card._id,
        redeemCode: card.redeemCode,
        expressCompany: '',
        expressNo: '',
        shippedAt: null,
        completedAt: null,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, msg: '兑换成功，我们将尽快发货！' }
  } catch (err) {
    console.error('redeemCrabCard error', err)
    return { code: -1, msg: err.message }
  }
}
