/**
 * Helper utility functions for tests
 * This file contains functions that are used by testUtils.js
 * to support testing throughout the application
 */

/**
 * Creates a mock object with methods that can be spied on and controlled in tests
 * @param {Object} baseObj - Base object with methods to mock
 * @returns {Object} - Mock object with jest.fn() versions of each method
 */
function createMockObject(baseObj) {
  const mock = {};
  Object.keys(baseObj).forEach(key => {
    if (typeof baseObj[key] === 'function') {
      mock[key] = jest.fn();
    } else {
      mock[key] = baseObj[key];
    }
  });
  return mock;
}

/**
 * Creates a promise that resolves after a specified time
 * Useful for testing async behavior
 * @param {number} ms - Time in milliseconds to wait
 * @returns {Promise} - Promise that resolves after the specified time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Deep clone an object to avoid reference issues in tests
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = {
  createMockObject,
  delay,
  deepClone
};