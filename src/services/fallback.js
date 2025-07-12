/**
 * Fallback service
 * This service provides a fallback response when other services fail
 */

/**
 * Get a fallback response
 * @param {string} errorMessage - The error message to include in the fallback response
 * @returns {string} - The fallback response
 */
function getFallbackResponse(errorMessage) {
  return `I am sorry, but I encountered an error. Please try again later. Error: ${errorMessage}`;
}

module.exports = {
  getFallbackResponse,
};
