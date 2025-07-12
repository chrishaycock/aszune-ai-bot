/**
 * Chat message handler for the bot
 */
const perplexityService = require('../services/perplexity');
const conversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const config = require('../config/config');
const commandHandler = require('../commands');
const cacheService = require('../services/cache');
const { ChatError } = require('../utils/errors');

/**
 * Handle an incoming chat message
 * @param {Object} message - Discord.js message object
 * @returns {Promise<void>}
 */
async function handleChatMessage(message) {
  if (message.author.bot || !message.content) return;
  
  // Ensure userId is extracted from message.author.id
  const userId = message.author.id;
  if (!userId) {
    logger.warn('Missing userId in message object:', message.author);
    // Use a fallback ID if needed or return early
    return message.reply('Unable to process your request due to a system error.');
  }
  
  // Check for rate limiting
  if (conversationManager.isRateLimited(userId)) {
    return message.reply('Please wait a few seconds before sending another message.');
  }
  conversationManager.updateTimestamp(userId);
  
  // Check for commands
  if (message.content.startsWith('!')) {
    const commandResult = await commandHandler.handleTextCommand(message);
    return commandResult;
  }
  
  // Show typing indicator
  message.channel.sendTyping();
  
  try {
    // Extract the user's question
    const userQuestion = message.content;
    
    let reply;
    let fromCache = false;
    
    // Statistics for logging
    let cacheAttempt = false;
    let cacheHit = false;
    let cacheError = false;
    let similarityScore = null;
    
    // Add message to conversation history before cache lookup
    conversationManager.addMessage(userId, "user", userQuestion);
    
    // Try to find the question in the cache first
    let cacheResult = null;
    try {
      cacheAttempt = true;
      cacheResult = cacheService.findInCache(userQuestion);
      
      if (cacheResult) {
        cacheHit = true;
        similarityScore = cacheResult.similarity;
        
        // Track memory cache stats if available
        if (cacheService.metrics && cacheService.metrics.memoryHits > 0) {
          logger.debug(`Memory cache hit ratio: ${cacheService.metrics.memoryHits}/${cacheService.metrics.hits}`);
        }
      }
    } catch (error) {
      const errMsg = error.name === 'CacheValueError' ? error.message : 'Cache lookup failed';
      logger.warn(`${errMsg}, falling back to API:`, error);
      cacheError = true;
    }
    
    if (cacheResult) {
      // Cache hit!
      const hitType = cacheResult.similarity ? `similar (${cacheResult.similarity.toFixed(2)})` : 'exact';
      logger.info(`Cache hit (${hitType}) for question: "${userQuestion.substring(0, 30)}..."`);
      reply = cacheResult.answer;
      fromCache = true;
      
      // If the entry needs a refresh (is stale), update it in the background
      // but still serve the cached response immediately to the user
      if (cacheResult.needsRefresh) {
        logger.debug('Refreshing stale cache entry in the background');
        // Don't await this to avoid delaying the response
        // Ensure userId is explicitly extracted from message.author.id before passing
        const authorId = message.author.id; // Explicitly extract again to ensure we have it
        refreshCacheEntry(userQuestion, authorId)
          .catch(error => logger.error('Background cache refresh failed:', error));
      }
    } else {
      // Cache miss - call the API
      logger.info(`Cache miss for question: "${userQuestion.substring(0, 30)}..."`);
      const history = conversationManager.getHistory(userId);
      reply = await perplexityService.generateChatResponse(history);
      
      // Add the new Q&A pair to the cache
      try {
        const added = cacheService.addToCache(userQuestion, reply);
        if (!added) {
          logger.warn('Failed to add response to cache');
        }
      } catch (cacheSaveError) {
        logger.error('Error adding to cache:', cacheSaveError);
        // Continue even if cache save fails - we already have the reply for the user
      }
    }
    
    // Log cache statistics
    const stats = {
      attempted: cacheAttempt,
      hit: cacheHit,
      error: cacheError,
      similarity: similarityScore
    };
    logger.debug('Cache request stats:', stats);
    
    // Add emojis based on reply content
    const enhancedReply = emojiManager.addEmojisToResponse(reply);
    
    // Add bot's reply to the conversation history
    conversationManager.addMessage(userId, 'assistant', enhancedReply);
    
    // Create an embed for the reply
    const embed = {
      color: config.COLORS.PRIMARY,
      description: enhancedReply,
      footer: { text: fromCache ? 'Aszai Bot • From Cache' : 'Aszai Bot' },
    };
    
    await message.reply({ embeds: [embed] });
    
    // Add reactions to the user's message based on content
    await emojiManager.addReactionsToMessage(message);
  } catch (error) {
    const errorMessage = logger.handleError(error, 'chat generation');
    message.reply(errorMessage);
  }
}

/**
 * Refresh a stale cache entry in the background
 * @param {string} question - The original question
 * @param {string} userId - The user ID for conversation history
 * @returns {Promise<boolean>} - True if refresh was successful
 */
async function refreshCacheEntry(question, userId, retryCount = 0) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 2000; // Wait 2 seconds before retrying
  
  // Validate the userId parameter
  if (!userId) {
    logger.error('Missing userId in refreshCacheEntry function call');
    return false;
  }
  
  try {
    // Get the current history - this includes the question we just processed
    const history = conversationManager.getHistory(userId);
    
    // Generate a fresh response from the API
    const freshReply = await perplexityService.generateChatResponse(history);
    
    if (!freshReply || typeof freshReply !== 'string' || freshReply.trim().length === 0) {
      throw new Error('Empty or invalid response from API during cache refresh');
    }
    
    // Update the cache with the fresh response
    const added = cacheService.addToCache(question, freshReply);
    
    if (!added) {
      throw new Error('Failed to add refreshed response to cache');
    }
    
    logger.debug(`Refreshed cache entry for: "${question.substring(0, 30)}..."`);
    return true;
  } catch (error) {
    logger.error(`Error refreshing cache entry (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
    
    // Implement exponential backoff retry for transient errors
    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying cache refresh in ${RETRY_DELAY}ms...`);
      return new Promise(resolve => {
        setTimeout(async () => {
          const result = await refreshCacheEntry(question, userId, retryCount + 1);
          resolve(result);
        }, RETRY_DELAY);
      });
    }
    
    // Mark this entry for manual review or future retry
    try {
      // Get the current entry and mark it for later refresh
      const hash = cacheService.generateHash(question);
      if (cacheService.cache[hash]) {
        cacheService.cache[hash].refreshFailed = true;
        cacheService.cache[hash].lastRefreshAttempt = Date.now();
        cacheService.isDirty = true;
        
        // Use the new scheduleSave method which handles errors better
        if (typeof cacheService.scheduleSave === 'function') {
          cacheService.scheduleSave();
        } else {
          // Fall back to saveIfDirty if scheduleSave isn't available
          cacheService.saveIfDirty();
        }
      }
    } catch (markingError) {
      const errName = markingError.name || 'Error';
      const errMsg = markingError.message || 'Unknown error';
      logger.error(`Failed to mark cache entry after refresh failure (${errName}): ${errMsg}`);
    }
    
    return false;
  }
}

/**
 * Process a question with caching layer
 * This method is used primarily for testing and internal use
 * @param {string} question - The question to process
 * @returns {Promise<string>} - The answer
 */
async function processQuestion(question) {
  // First, try to find in cache
  try {
    const cacheResult = cacheService.findInCache(question);
    
    if (cacheResult) {
      const answer = cacheResult.answer;
      
      // If the entry needs a refresh (is stale), update it in the background
      // but still serve the cached response immediately
      if (cacheResult.needsRefresh) {
        logger.debug('Refreshing stale cache entry in the background');
        // Don't await this to avoid delaying the response
        setTimeout(async () => {
          try {
            const newAnswer = await perplexityService.askQuestion(question);
            cacheService.addToCache(question, newAnswer);
            await cacheService.saveIfDirtyAsync();
          } catch (error) {
            logger.error('Background cache refresh failed:', error);
          }
        }, 0);
      }
      
      return answer;
    }
  } catch (error) {
    // Log cache error but continue to API call
    logger.warn(`Cache error: ${error.message}, falling back to API`);
  }
  
  // Cache miss or error, use the API
  try {
    const answer = await perplexityService.askQuestion(question);
    // Add to cache for future use
    cacheService.addToCache(question, answer);
    await cacheService.saveIfDirtyAsync();
    return answer;
  } catch (error) {
    // Wrap API errors in our custom error type
    const { ChatError } = require('../utils/errors');
    throw new ChatError(`Failed to get answer: ${error.message}`, { originalError: error });
  }
}

module.exports = {
  handleChatMessage,
  refreshCacheEntry,
  processQuestion
};
