/**
 * auth.js - Login and authentication utilities
 */

const app = getApp()

/**
 * Ensures the user is logged in.
 * @returns {Promise<string>} openid
 */
function ensureLogin() {
  return new Promise((resolve, reject) => {
    if (app.globalData.openid) {
      return resolve(app.globalData.openid)
    }
    wx.cloud.callFunction({
      name: 'login',
      data: { action: 'login' }
    }).then(res => {
      const openid = res.result && res.result.openid
      if (openid) {
        app.globalData.openid = openid
        app.globalData.userInfo = res.result.userInfo
        resolve(openid)
      } else {
        reject(new Error('Failed to obtain openid'))
      }
    }).catch(reject)
  })
}

/**
 * Gets current user info from cloud DB.
 * @param {boolean} forceRefresh - bypass cache
 * @returns {Promise<Object>} user info object
 */
function getUserInfo(forceRefresh) {
  if (!forceRefresh && app.globalData.userInfo) {
    return Promise.resolve(app.globalData.userInfo)
  }
  return ensureLogin().then(openid => {
    const db = wx.cloud.database()
    return db.collection('users').doc(openid).get().then(res => {
      app.globalData.userInfo = res.data
      return res.data
    })
  })
}

/**
 * Checks whether the current user is a member.
 * @returns {Promise<boolean>}
 */
function checkMember() {
  return getUserInfo(true).then(user => {
    const isMember = !!(user && user.isMember)
    return isMember
  })
}

/**
 * Checks whether the current user is an admin.
 * @returns {Promise<boolean>}
 */
function checkAdmin() {
  return getUserInfo(true).then(user => {
    const isAdmin = !!(user && user.isAdmin)
    return isAdmin
  })
}

/**
 * Handles the phone number button callback.
 * @param {Object} e - event from getphonenumber button
 * @returns {Promise<string>} phone number
 */
function getPhoneNumber(e) {
  if (!e.detail || !e.detail.code) {
    return Promise.reject(new Error('User denied phone number access'))
  }
  return wx.cloud.callFunction({
    name: 'login',
    data: {
      action: 'getPhoneNumber',
      cloudID: e.detail.cloudID || '',
      code: e.detail.code
    }
  }).then(res => {
    const phone = res.result && res.result.phone
    if (phone) return phone
    throw new Error('Failed to get phone number')
  })
}

module.exports = {
  ensureLogin,
  checkMember,
  checkAdmin,
  getUserInfo,
  getPhoneNumber
}
