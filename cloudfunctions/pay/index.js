const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ========== 会员等级默认配置（金额单位: 分） ==========
const DEFAULT_MEMBER_LEVELS = [
  { level: 1, threshold: 0, selfDiscount: 0.005, referralRate: 0.02 },
  { level: 2, threshold: 200000, selfDiscount: 0.008, referralRate: 0.03 },
  { level: 3, threshold: 500000, selfDiscount: 0.01, referralRate: 0.04 },
  { level: 4, threshold: 1500000, selfDiscount: 0.015, referralRate: 0.05 },
  { level: 5, threshold: 3000000, selfDiscount: 0.02, referralRate: 0.06 }
]

// 获取会员等级配置
function getMemberLevels(config) {
  return config.memberLevels || DEFAULT_MEMBER_LEVELS
}

// 根据累计消费(分)计算当前等级
function calcLevelBySpent(totalSpent, levels) {
  let result = levels[0]
  for (const lv of levels) {
    if (totalSpent >= lv.threshold) {
      result = lv
    }
  }
  return result
}

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'membership':
      return handleMembership(openid, event)
    case 'order':
      return handleOrder(openid, event)
    case 'meal':
      return handleOrder(openid, event)
    case 'payCallback':
      return handlePayCallback(event)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// ========== 会员开通下单 ==========
async function handleMembership(openid, event) {
  try {
    const configRes = await db.collection('config').doc('global').get()
    const config = configRes.data || {}
    const membershipPrice = config.membershipPrice || 2000 // 默认20元

    const now = db.serverDate()
    const outTradeNo = `M${Date.now()}${Math.random().toString(36).slice(2, 8)}`

    const orderData = {
      _openid: openid,
      outTradeNo,
      type: 'membership',
      totalFee: membershipPrice,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    }
    await db.collection('orders').add({ data: orderData })

    const payResult = await cloud.cloudPay.unifiedOrder({
      body: '十脚怪兽-会员开通',
      outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId: config.subMchId || '',
      totalFee: membershipPrice,
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'pay',
      nonceStr: outTradeNo,
      tradeType: 'JSAPI'
    })

    return { code: 0, data: { ...payResult, outTradeNo } }
  } catch (err) {
    console.error('membership error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 商品下单（电商模式） ==========
async function handleOrder(openid, event) {
  const { items, shippingInfo, couponId } = event

  try {
    if (!items || items.length === 0) {
      return { code: -1, msg: '请选择商品' }
    }

    if (!shippingInfo || !shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
      return { code: -1, msg: '请填写完整的收货信息' }
    }

    // 计算总价（单位: 分）
    let totalFee = 0
    const orderItems = []
    for (const item of items) {
      const dishRes = await db.collection('dishes').doc(item.dishId || item._id).get()
      const dish = dishRes.data
      if (!dish || !dish.isAvailable) {
        return { code: -1, msg: `商品「${item.name || item.dishId}」已下架` }
      }
      const lineTotal = dish.price * item.quantity
      totalFee += lineTotal
      orderItems.push({
        dishId: item.dishId || item._id,
        name: dish.name,
        price: dish.price,
        quantity: item.quantity,
        lineTotal
      })
    }

    // 应用优惠券
    let couponDiscount = 0
    let appliedCouponId = ''
    if (couponId) {
      const couponRes = await db.collection('coupons').doc(couponId).get()
      const coupon = couponRes.data
      if (coupon && coupon._openid === openid && !coupon.used && new Date(coupon.expiry) > new Date()) {
        couponDiscount = coupon.value // 单位: 分
        appliedCouponId = couponId
      }
    }

    // 查询用户会员信息，计算自购折扣
    let memberDiscount = 0
    let memberLevel = 0
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const user = userRes.data && userRes.data[0]

    if (user && user.isMember) {
      const configRes = await db.collection('config').doc('global').get()
      const config = configRes.data || {}
      const levels = getMemberLevels(config)
      const userTotalSpent = user.totalSpent || 0
      const lvInfo = calcLevelBySpent(userTotalSpent, levels)
      memberLevel = lvInfo.level
      memberDiscount = Math.floor(totalFee * lvInfo.selfDiscount)
    }

    const actualFee = Math.max(totalFee - couponDiscount - memberDiscount, 1) // 最少 1 分

    const now = db.serverDate()
    const outTradeNo = `D${Date.now()}${Math.random().toString(36).slice(2, 8)}`

    const orderData = {
      _openid: openid,
      outTradeNo,
      type: 'order',
      items: orderItems,
      shippingInfo,
      expressCompany: '',
      expressNo: '',
      couponId: appliedCouponId,
      couponDiscount,
      memberDiscount,
      memberLevel,
      totalFee,
      actualFee,
      status: 'pending',
      shippedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    }
    await db.collection('orders').add({ data: orderData })

    // 标记优惠券已使用
    if (appliedCouponId) {
      await db.collection('coupons').doc(appliedCouponId).update({
        data: { used: true, usedAt: now }
      })
    }

    // 读取配置
    let config
    try {
      const cfgRes = await db.collection('config').doc('global').get()
      config = cfgRes.data || {}
    } catch (e) {
      config = {}
    }

    const payResult = await cloud.cloudPay.unifiedOrder({
      body: '十脚怪兽-商品购买',
      outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId: config.subMchId || '',
      totalFee: actualFee,
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'pay',
      nonceStr: outTradeNo,
      tradeType: 'JSAPI'
    })

    return { code: 0, data: { ...payResult, outTradeNo } }
  } catch (err) {
    console.error('order error', err)
    return { code: -1, msg: err.message }
  }
}

// ========== 支付回调 ==========
async function handlePayCallback(event) {
  const { outTradeNo, resultCode, returnCode } = event

  if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
    return { errcode: 0, errmsg: 'SUCCESS' }
  }

  const transaction = async () => {
    try {
      const orderRes = await db.collection('orders').where({ outTradeNo }).get()
      if (!orderRes.data || orderRes.data.length === 0) {
        console.error('payCallback: order not found', outTradeNo)
        return
      }

      const order = orderRes.data[0]
      if (order.status === 'paid') return

      const now = db.serverDate()

      // 更新订单状态
      await db.collection('orders').doc(order._id).update({
        data: { status: 'paid', paidAt: now, updatedAt: now }
      })

      // 查询用户
      const userRes = await db.collection('users').where({ _openid: order._openid }).get()
      const user = userRes.data && userRes.data[0]

      // 读取配置
      let config = {}
      try {
        const cfgRes = await db.collection('config').doc('global').get()
        config = cfgRes.data || {}
      } catch (e) {}

      if (order.type === 'membership') {
        // ---------- 会员订单 ----------
        const oneYearLater = new Date()
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

        // 设置会员身份 + 初始化等级为1 + 初始化累计消费
        const memberUpdate = {
          isMember: true,
          memberExpiry: oneYearLater,
          memberLevel: 1,
          updatedAt: now
        }
        // 只在首次开通时初始化 totalSpent
        if (!user || !user.totalSpent) {
          memberUpdate.totalSpent = 0
        }

        await db.collection('users').where({ _openid: order._openid }).update({
          data: memberUpdate
        })

        // 发放开通赠蟹券
        const freeCrabValue = config.freeCrabCouponValue || 19900 // 默认199元
        const couponExpiry = new Date()
        couponExpiry.setDate(couponExpiry.getDate() + 30)

        await db.collection('coupons').add({
          data: {
            _openid: order._openid,
            value: freeCrabValue,
            desc: '开通会员赠蟹券',
            type: 'freeCrab',
            used: false,
            expiry: couponExpiry,
            createdAt: now
          }
        })

        // 推荐人奖励
        if (user && user.referrerId) {
          await handleReferralReward(user.referrerId, order._openid, order._id, 'membership', order.totalFee, config, now, 'direct')
          // 二级分销：间接推荐人奖励
          if (user.indirectReferrerId) {
            await handleReferralReward(user.indirectReferrerId, order._openid, order._id, 'membership', order.totalFee, config, now, 'indirect')
          }
        }
      }

      if (order.type === 'order' || order.type === 'meal') {
        // ---------- 商品订单 ----------

        // 1. 累加用户消费 + 检查升级
        if (user && user.isMember) {
          const newTotalSpent = (user.totalSpent || 0) + (order.actualFee || 0)
          const levels = getMemberLevels(config)
          const newLvInfo = calcLevelBySpent(newTotalSpent, levels)

          const userUpdate = {
            totalSpent: newTotalSpent,
            updatedAt: now
          }
          // 如果等级提升，更新等级
          if (newLvInfo.level > (user.memberLevel || 1)) {
            userUpdate.memberLevel = newLvInfo.level
          }

          await db.collection('users').where({ _openid: order._openid }).update({
            data: userUpdate
          })
        }

        // 2. 推荐人奖励（仅会员推荐人可获得）
        if (user && user.referrerId) {
          await handleReferralReward(user.referrerId, order._openid, order._id, 'order', order.actualFee, config, now, 'direct')
          // 二级分销：间接推荐人奖励
          if (user.indirectReferrerId) {
            await handleReferralReward(user.indirectReferrerId, order._openid, order._id, 'order', order.actualFee, config, now, 'indirect')
          }
        }
      }
    } catch (err) {
      console.error('payCallback transaction error', err)
    }
  }

  await transaction()
  return { errcode: 0, errmsg: 'SUCCESS' }
}

// ========== 推荐奖励处理（按推荐人会员等级动态计算） ==========
// referralType: 'direct'(直推) 或 'indirect'(间推)
async function handleReferralReward(referrerId, refereeOpenid, orderId, orderType, orderAmount, config, now, referralType) {
  try {
    // 查询推荐人信息
    const referrerRes = await db.collection('users').where({ _openid: referrerId }).get()
    const referrer = referrerRes.data && referrerRes.data[0]

    // 只有会员才能获得推荐返现
    if (!referrer || !referrer.isMember) return

    // 根据推荐人等级获取返现比例
    const levels = getMemberLevels(config)
    const referrerTotalSpent = referrer.totalSpent || 0
    const lvInfo = calcLevelBySpent(referrerTotalSpent, levels)

    // 直推用等级对应的 referralRate，间推固定 1%
    const rewardRate = referralType === 'indirect' ? 0.01 : lvInfo.referralRate

    const reward = Math.floor(orderAmount * rewardRate)
    if (reward <= 0) return

    // 创建推荐记录
    await db.collection('referrals').add({
      data: {
        referrerId,
        refereeOpenid,
        orderId,
        orderType,
        orderAmount,
        rewardRate,
        referrerLevel: lvInfo.level,
        referralType: referralType || 'direct',
        reward,
        status: 'settled',
        createdAt: now
      }
    })

    // 增加推荐人余额
    await db.collection('users').where({ _openid: referrerId }).update({
      data: {
        balance: _.inc(reward),
        updatedAt: now
      }
    })
  } catch (err) {
    console.error('handleReferralReward error', err)
  }
}
