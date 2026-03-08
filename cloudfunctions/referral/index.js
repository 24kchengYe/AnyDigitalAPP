const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'getStats':
      return handleGetStats(openid)
    case 'getRecords':
      return handleGetRecords(openid, event)
    case 'getQrcode':
      return handleGetQrcode(openid, event)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 推荐统计
async function handleGetStats(openid) {
  try {
    // 总推荐人数（去重被推荐人）
    const referralsRes = await db.collection('referrals')
      .where({ referrerId: openid })
      .get()

    const records = referralsRes.data || []

    // 去重统计被推荐人数
    const uniqueReferees = new Set(records.map(r => r.refereeOpenid))
    const totalReferrals = uniqueReferees.size

    // 总收益 & 待结算收益，区分直推和间推
    let totalEarnings = 0
    let pendingEarnings = 0
    let directEarnings = 0
    let indirectEarnings = 0

    for (const r of records) {
      totalEarnings += r.reward || 0
      if (r.status === 'pending') {
        pendingEarnings += r.reward || 0
      }
      if (r.referralType === 'indirect') {
        indirectEarnings += r.reward || 0
      } else {
        directEarnings += r.reward || 0
      }
    }

    return {
      code: 0,
      data: {
        totalReferrals,
        totalEarnings,
        pendingEarnings,
        directEarnings,
        indirectEarnings
      }
    }
  } catch (err) {
    console.error('getStats error', err)
    return { code: -1, msg: err.message }
  }
}

// 推荐记录（分页）
async function handleGetRecords(openid, event) {
  const { page = 1, pageSize = 10 } = event

  try {
    const skip = (page - 1) * pageSize

    const countRes = await db.collection('referrals')
      .where({ referrerId: openid })
      .count()

    const listRes = await db.collection('referrals')
      .where({ referrerId: openid })
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
    console.error('getRecords error', err)
    return { code: -1, msg: err.message }
  }
}

// 生成带推荐参数的小程序码
async function handleGetQrcode(openid, event) {
  const { page = 'pages/index/index' } = event

  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: `ref=${openid}`,
      page,
      width: 280,
      autoColor: false,
      lineColor: { r: 0, g: 0, b: 0 },
      isHyaline: false
    })

    if (result.errCode !== 0 && result.errCode !== undefined) {
      return { code: -1, msg: result.errMsg || '生成小程序码失败' }
    }

    // 将 buffer 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `qrcode/${openid}_${Date.now()}.png`,
      fileContent: result.buffer
    })

    return {
      code: 0,
      data: {
        fileID: uploadRes.fileID
      }
    }
  } catch (err) {
    console.error('getQrcode error', err)
    return { code: -1, msg: err.message }
  }
}
