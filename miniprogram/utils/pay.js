/**
 * pay.js - Payment utilities
 */

const { ensureLogin } = require('./auth')

/**
 * Internal helper that calls the 'pay' cloud function, then invokes
 * wx.requestPayment with the returned payment parameters.
 * @param {Object} params - parameters forwarded to the cloud function
 * @returns {Promise<Object>} the wx.requestPayment success result
 */
function _requestPayment(params) {
  return ensureLogin().then((openid) => {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'pay',
        data: Object.assign({ openid: openid }, params),
        success: (res) => {
          if (!res.result || !res.result.payment) {
            return reject(new Error('Cloud function did not return payment params'))
          }

          const payment = res.result.payment

          wx.requestPayment({
            timeStamp: payment.timeStamp,
            nonceStr: payment.nonceStr,
            package: payment.package,
            signType: payment.signType || 'MD5',
            paySign: payment.paySign,
            success: (payRes) => {
              resolve(payRes)
            },
            fail: (payErr) => {
              reject(payErr)
            }
          })
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  })
}

/**
 * Initiates payment for a membership purchase.
 * Calls the 'pay' cloud function with action 'membership',
 * then opens the WeChat payment dialog.
 * @returns {Promise<Object>} the wx.requestPayment success result
 */
function payForMembership() {
  return _requestPayment({
    action: 'membership'
  })
}

/**
 * Initiates payment for a meal order.
 * Calls the 'pay' cloud function with action 'meal',
 * then opens the WeChat payment dialog.
 * @param {string} orderId - the order ID to pay for
 * @param {number} amount  - the payment amount (in fen / cents)
 * @returns {Promise<Object>} the wx.requestPayment success result
 */
function payForOrder(orderId, amount) {
  return _requestPayment({
    action: 'meal',
    orderId: orderId,
    amount: amount
  })
}

module.exports = {
  payForMembership,
  payForOrder
}
