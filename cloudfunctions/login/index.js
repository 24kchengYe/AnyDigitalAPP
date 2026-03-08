const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'login':
      return handleLogin(openid, event)
    case 'updateProfile':
      return handleUpdateProfile(openid, event)
    case 'getPhoneNumber':
      return handleGetPhoneNumber(openid, event)
    case 'getMemberLevel':
      return handleGetMemberLevel(openid)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 登录 / 自动注册
async function handleLogin(openid, event) {
  const { referrerId } = event
  const usersCol = db.collection('users')

  try {
    const { data } = await usersCol.where({ _openid: openid }).get()

    if (data.length > 0) {
      // 已有用户，直接返回
      return { code: 0, data: { openid, userInfo: data[0] } }
    }

    // 新用户 — 创建默认记录
    const now = db.serverDate()
    const newUser = {
      _openid: openid,
      nickName: '',
      avatarUrl: '',
      phone: '',
      isMember: false,
      isAdmin: false,
      memberExpiry: null,
      memberLevel: 0,
      totalSpent: 0,
      balance: 0,
      referrerId: referrerId || '',
      indirectReferrerId: '',
      createdAt: now,
      updatedAt: now
    }

    // 如果有推荐人，查找推荐人的推荐人（二级分销）
    if (referrerId) {
      try {
        const referrerRes = await usersCol.where({ _openid: referrerId }).get()
        const referrer = referrerRes.data && referrerRes.data[0]
        if (referrer && referrer.referrerId) {
          newUser.indirectReferrerId = referrer.referrerId
        }
      } catch (e) {
        console.error('查询间接推荐人失败', e)
      }
    }

    await usersCol.add({ data: newUser })

    // 发放新人优惠券（8折券，有效期24小时）
    try {
      const couponExpiry = new Date()
      couponExpiry.setHours(couponExpiry.getHours() + 24)
      await db.collection('coupons').add({
        data: {
          _openid: openid,
          value: 0,
          discountRate: 0.8,
          desc: '新人专享8折券',
          type: 'newUser',
          used: false,
          expiry: couponExpiry,
          minAmount: 0,
          createdAt: now
        }
      })
    } catch (e) {
      console.error('发放新人券失败', e)
    }

    return { code: 0, data: { openid, userInfo: newUser, isNewUser: true } }
  } catch (err) {
    console.error('login error', err)
    return { code: -1, msg: err.message }
  }
}

// 更新昵称 & 头像
async function handleUpdateProfile(openid, event) {
  const { nickName, avatarUrl } = event

  try {
    await db.collection('users').where({ _openid: openid }).update({
      data: {
        nickName,
        avatarUrl,
        updatedAt: db.serverDate()
      }
    })
    return { code: 0, msg: '更新成功' }
  } catch (err) {
    console.error('updateProfile error', err)
    return { code: -1, msg: err.message }
  }
}

// 查询会员等级详情（含权益信息）
async function handleGetMemberLevel(openid) {
  try {
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const user = userRes.data && userRes.data[0]

    if (!user) {
      return { code: -1, msg: '用户不存在' }
    }

    if (!user.isMember) {
      return { code: 0, data: { isMember: false, memberLevel: 0, totalSpent: 0, levels: [] } }
    }

    // 读取等级配置
    let config = {}
    try {
      const cfgRes = await db.collection('config').doc('global').get()
      config = cfgRes.data || {}
    } catch (e) {}

    const DEFAULT_LEVELS = [
      { level: 1, threshold: 0, selfDiscount: 0.005, referralRate: 0.02 },
      { level: 2, threshold: 200000, selfDiscount: 0.008, referralRate: 0.03 },
      { level: 3, threshold: 500000, selfDiscount: 0.01, referralRate: 0.04 },
      { level: 4, threshold: 1500000, selfDiscount: 0.015, referralRate: 0.05 },
      { level: 5, threshold: 3000000, selfDiscount: 0.02, referralRate: 0.06 }
    ]
    const levels = config.memberLevels || DEFAULT_LEVELS

    const totalSpent = user.totalSpent || 0
    let currentLevel = levels[0]
    for (const lv of levels) {
      if (totalSpent >= lv.threshold) {
        currentLevel = lv
      }
    }

    // 计算下一等级信息
    const nextLevel = levels.find(lv => lv.level === currentLevel.level + 1) || null
    const spentToNext = nextLevel ? Math.max(nextLevel.threshold - totalSpent, 0) : 0

    return {
      code: 0,
      data: {
        isMember: true,
        memberLevel: currentLevel.level,
        totalSpent,
        selfDiscount: currentLevel.selfDiscount,
        referralRate: currentLevel.referralRate,
        nextLevel: nextLevel ? nextLevel.level : null,
        spentToNext,
        nextThreshold: nextLevel ? nextLevel.threshold : null,
        levels
      }
    }
  } catch (err) {
    console.error('getMemberLevel error', err)
    return { code: -1, msg: err.message }
  }
}

// 获取手机号并写入用户记录
async function handleGetPhoneNumber(openid, event) {
  const { cloudID } = event

  try {
    const res = await cloud.getOpenData({ list: [{ jsonPath: 'phoneNumber', cloudID }] })
    const phoneInfo = res.list && res.list[0] && res.list[0].data
    const phoneNumber = phoneInfo ? phoneInfo.phoneNumber : ''

    if (!phoneNumber) {
      return { code: -1, msg: '获取手机号失败' }
    }

    await db.collection('users').where({ _openid: openid }).update({
      data: {
        phone: phoneNumber,
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, data: { phone: phoneNumber } }
  } catch (err) {
    console.error('getPhoneNumber error', err)
    return { code: -1, msg: err.message }
  }
}
