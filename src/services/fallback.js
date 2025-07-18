/**
 * Fallback service
 * This service provides a fallback response when other services fail
 */

const logger = require('../utils/logger');

/**
 * Get a fallback response
 * @param {string} errorMessage - The error message to include in the fallback response
 * @returns {string} - The fallback response
 */
function getFallbackResponse(errorMessage) {
  // Log the actual error for debugging purposes
  console.error(`Error encountered: ${errorMessage}`);
  
  // Log the full error internally rather than exposing it to the user
  if (logger && typeof logger.error === 'function') {
    logger.error(`Error encountered: ${errorMessage}`);
  }
  
  // Return a generic user-friendly message without exposing error details
  return "I am sorry, but I encountered an error. Please try again later.";
}

module.exports = {
  getFallbackResponse,
};
