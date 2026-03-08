/**
 * util.js - Common utilities
 */

/**
 * Formats a Date object to "YYYY-MM-DD HH:mm:ss".
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  const year = date.getFullYear()
  const month = padZero(date.getMonth() + 1)
  const day = padZero(date.getDate())
  const hour = padZero(date.getHours())
  const minute = padZero(date.getMinutes())
  const second = padZero(date.getSeconds())

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * Pads a number with a leading zero if it is less than 10.
 * @param {number} n
 * @returns {string}
 */
function padZero(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * Formats a price value (already in yuan) to two decimal places.
 * @param {number} yuan - price in yuan (e.g. 12.5)
 * @returns {string} e.g. "12.50"
 */
function formatPrice(yuan) {
  return Number(yuan).toFixed(2)
}

/**
 * Shows a loading indicator.
 * @param {string} [title='Loading...'] - loading text
 */
function showLoading(title) {
  wx.showLoading({
    title: title || 'Loading...',
    mask: true
  })
}

/**
 * Hides the loading indicator.
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * Shows a toast message.
 * @param {string} title - the message to display
 * @param {string} [icon='none'] - icon type: 'success', 'error', 'loading', 'none'
 */
function showToast(title, icon) {
  wx.showToast({
    title: title || '',
    icon: icon || 'none',
    duration: 2000
  })
}

/**
 * Shows a modal dialog and returns a promise.
 * Resolves with true if the user taps "confirm", false if "cancel".
 * @param {string} title   - modal title
 * @param {string} content - modal body text
 * @returns {Promise<boolean>}
 */
function showModal(title, content) {
  return new Promise((resolve) => {
    wx.showModal({
      title: title || '',
      content: content || '',
      success: (res) => {
        resolve(!!res.confirm)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * Creates a debounced version of the given function.
 * The function will only be invoked after `delay` milliseconds have elapsed
 * since the last time it was called.
 * @param {Function} fn    - the function to debounce
 * @param {number}   delay - debounce delay in milliseconds
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer = null
  return function () {
    const context = this
    const args = arguments
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(function () {
      fn.apply(context, args)
      timer = null
    }, delay)
  }
}

module.exports = {
  formatTime,
  formatPrice,
  showLoading,
  hideLoading,
  showToast,
  showModal,
  debounce
}
