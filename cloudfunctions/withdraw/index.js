const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'apply':
      return handleApply(openid, event)
    case 'list':
      return handleList(openid, event)
    case 'adminList':
      return handleAdminList(openid, event)
    case 'approve':
      return handleApprove(openid, event)
    case 'reject':
      return handleReject(openid, event)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 辅助: 检查管理员权限
async function checkAdmin(openid) {
  const userRes = await db.collection('users').where({ _openid: openid }).get()
  return userRes.data && userRes.data[0] && userRes.data[0].isAdmin === true
}

// 申请提现
async function handleApply(openid, event) {
  const { amount } = event // 单位: 分

  try {
    if (!amount || amount <= 0) {
      return { code: -1, msg: '提现金额无效' }
    }

    // 读取全局配置
    const configRes = await db.collection('config').doc('global').get()
    const config = configRes.data || {}
    const minWithdrawAmount = config.minWithdrawAmount || 1000 // 默认最低 10 元 = 1000 分

    if (amount < minWithdrawAmount) {
      return { code: -1, msg: `最低提现金额为 ${minWithdrawAmount / 100} 元` }
    }

    // 查询用户余额
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const user = userRes.data && userRes.data[0]

    if (!user) {
      return { code: -1, msg: '用户不存在' }
    }
    if ((user.balance || 0) < amount) {
      return { code: -1, msg: '余额不足' }
    }

    const now = db.serverDate()

    // 扣减余额
    await db.collection('users').where({ _openid: openid }).update({
      data: {
        balance: _.inc(-amount),
        updatedAt: now
      }
    })

    // 创建提现记录
    await db.collection('withdrawals').add({
      data: {
        _openid: openid,
        amount,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      }
    })

    return { code: 0, msg: '提现申请已提交' }
  } catch (err) {
    console.error('withdraw apply error', err)
    return { code: -1, msg: err.message }
  }
}

// 用户提现记录
async function handleList(openid, event) {
  const { page = 1, pageSize = 10 } = event

  try {
    const skip = (page - 1) * pageSize

    const countRes = await db.collection('withdrawals')
      .where({ _openid: openid })
      .count()

    const listRes = await db.collection('withdrawals')
      .where({ _openid: openid })
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
    console.error('withdraw list error', err)
    return { code: -1, msg: err.message }
  }
}

// 管理员: 待处理提现列表
async function handleAdminList(openid, event) {
  const { page = 1, pageSize = 20 } = event

  try {
    if (!(await checkAdmin(openid))) {
      return { code: -1, msg: '无管理员权限' }
    }

    const skip = (page - 1) * pageSize

    const countRes = await db.collection('withdrawals')
      .where({ status: 'pending' })
      .count()

    const listRes = await db.collection('withdrawals')
      .where({ status: 'pending' })
      .orderBy('createdAt', 'asc')
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
    console.error('withdraw adminList error', err)
    return { code: -1, msg: err.message }
  }
}

// 管理员: 批准提现
async function handleApprove(openid, event) {
  const { withdrawalId } = event

  try {
    if (!(await checkAdmin(openid))) {
      return { code: -1, msg: '无管理员权限' }
    }

    if (!withdrawalId) {
      return { code: -1, msg: '缺少 withdrawalId' }
    }

    const res = await db.collection('withdrawals').doc(withdrawalId).get()
    const record = res.data

    if (!record) {
      return { code: -1, msg: '提现记录不存在' }
    }
    if (record.status !== 'pending') {
      return { code: -1, msg: '该记录已处理' }
    }

    await db.collection('withdrawals').doc(withdrawalId).update({
      data: {
        status: 'approved',
        approvedBy: openid,
        updatedAt: db.serverDate()
      }
    })

    // 实际转账操作预留，后续对接企业付款接口

    return { code: 0, msg: '提现已批准' }
  } catch (err) {
    console.error('withdraw approve error', err)
    return { code: -1, msg: err.message }
  }
}

// 管理员: 驳回提现，退还余额
async function handleReject(openid, event) {
  const { withdrawalId, reason } = event

  try {
    if (!(await checkAdmin(openid))) {
      return { code: -1, msg: '无管理员权限' }
    }

    if (!withdrawalId) {
      return { code: -1, msg: '缺少 withdrawalId' }
    }

    const res = await db.collection('withdrawals').doc(withdrawalId).get()
    const record = res.data

    if (!record) {
      return { code: -1, msg: '提现记录不存在' }
    }
    if (record.status !== 'pending') {
      return { code: -1, msg: '该记录已处理' }
    }

    const now = db.serverDate()

    // 退还余额
    await db.collection('users').where({ _openid: record._openid }).update({
      data: {
        balance: _.inc(record.amount),
        updatedAt: now
      }
    })

    // 更新提现记录
    await db.collection('withdrawals').doc(withdrawalId).update({
      data: {
        status: 'rejected',
        rejectReason: reason || '',
        rejectedBy: openid,
        updatedAt: now
      }
    })

    return { code: 0, msg: '提现已驳回，余额已退还' }
  } catch (err) {
    console.error('withdraw reject error', err)
    return { code: -1, msg: err.message }
  }
}
