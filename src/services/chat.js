/**
 * Chat message handler for the bot
 */
const perplexityService = require('../services/perplexity');
const conversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const config = require('../config/config');
const commandHandler = require('../commands');
// Import the pre-instantiated CacheService singleton
const cacheService = require('../services/cache_lean');

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
        // Default to 1.0 similarity for exact cache hits, otherwise use the returned similarity score
        similarityScore = cacheResult.exact ? 1.0 : cacheResult.similarity;
        
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
          .then(result => {
            if (result) {
              logger.debug('Background cache refresh completed successfully');
            } else {
              logger.warn('Background cache refresh completed but returned false');
            }
          })
          .catch(error => {
            logger.error('Background cache refresh failed:', error);
          })
          .finally(() => {
            // Mark this operation as complete for monitoring/metrics
            if (cacheService.metrics) {
              cacheService.metrics.backgroundRefreshCompleted = (cacheService.metrics.backgroundRefreshCompleted || 0) + 1;
            }
          });
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
 * @param {number} retryCount - Current retry attempt (default: 0)
 * @returns {Promise<boolean>} - True if refresh was successful
 */
async function refreshCacheEntry(question, userId, retryCount = 0) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 2000; // Wait 2 seconds before retrying
  const MAX_RETRY_DELAY = 10000; // Maximum delay cap
  
  // Validate the userId parameter
  if (!userId) {
    logger.error('Missing userId in refreshCacheEntry function call');
    return false;
  }
  
  // Ensure userId is a valid string to avoid errors in conversation manager
  if (typeof userId !== 'string') {
    logger.error(`Invalid userId type in refreshCacheEntry: ${typeof userId}`);
    return false;
  }
  
  // Additional validation for userId format
  if (userId.trim() === '') {
    logger.error('Empty userId in refreshCacheEntry function call');
    return false;
  }
  
  // Safety check: prevent excessive recursion
  if (retryCount > MAX_RETRIES) {
    logger.warn(`Exceeded maximum retries (${MAX_RETRIES}) for refreshing cache entry`);
    return false;
  }
  
  try {
    // Get a fresh copy of the conversation history on each attempt
    // This ensures we're working with the most up-to-date context
    const history = conversationManager.getHistory(userId);
    
    // Store a snapshot of the history length to detect changes during retry
    const historySnapshot = history ? history.length : 0;
    
    // Generate a fresh response from the API
    const freshReply = await perplexityService.generateChatResponse(history);
    
    if (!freshReply || typeof freshReply !== 'string' || freshReply.trim().length === 0) {
      throw new Error('Empty or invalid response from API during cache refresh');
    }
    
    // Before updating the cache, verify the conversation hasn't changed
    // If it has, we might need a different response based on the new context
    const currentHistory = conversationManager.getHistory(userId);
    const currentHistoryLength = currentHistory ? currentHistory.length : 0;
    
    if (currentHistoryLength !== historySnapshot) {
      logger.warn('Conversation history changed during cache refresh, response may be inconsistent');
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
    
    // Implement exponential backoff retry for transient errors with jitter
    if (retryCount < MAX_RETRIES) {
      // Calculate exponential backoff with jitter to avoid thundering herd
      const baseDelay = RETRY_DELAY * Math.pow(2, retryCount);
      const jitter = Math.floor(Math.random() * 1000); // Add random jitter up to 1s
      const delay = Math.min(baseDelay + jitter, MAX_RETRY_DELAY);
      
      logger.info(`Retrying cache refresh in ${delay}ms...`);
      return new Promise(resolve => {
        setTimeout(async () => {
          const result = await refreshCacheEntry(question, userId, retryCount + 1);
          resolve(result);
        }, delay);
      });
    }
    
    // Mark this entry for manual review or future retry
    try {
      // Get the current entry and mark it for later refresh with structured metadata
      const hash = cacheService.generateHash(question);
      if (cacheService.cache && cacheService.cache[hash]) {
        // Add structured metadata about the failure
        cacheService.cache[hash].refreshFailed = true;
        cacheService.cache[hash].lastRefreshAttempt = Date.now();
        cacheService.cache[hash].refreshFailReason = error.message || 'Unknown error';
        cacheService.cache[hash].refreshFailCount = (cacheService.cache[hash].refreshFailCount || 0) + 1;
        cacheService.isDirty = true;
        
        // Use a safer approach to save the cache
        try {
          // Prefer the new error-handling scheduleSave method if available
          if (typeof cacheService.scheduleSave === 'function') {
            cacheService.scheduleSave();
          } else {
            // Fall back to saveIfDirty if scheduleSave isn't available
            cacheService.saveIfDirty();
          }
        } catch (saveError) {
          // Log but don't rethrow - we've already failed the main operation
          logger.error('Failed to save cache after marking refresh failure:', saveError);
        }
      } else {
        logger.warn(`Cache entry for hash ${hash} not found when trying to mark refresh failure`);
      }
    } catch (markingError) {
      // Improved structured error logging
      logger.error('Failed to mark cache entry after refresh failure:', {
        error: markingError.message || 'Unknown error',
        errorType: markingError.name || 'Error',
        questionHash: question ? question.substring(0, 30) : 'undefined',
        userId: userId || 'unknown'
      });
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
        // Don't await this to avoid delaying the response, but use Promise handling
        // instead of setTimeout for better error tracking and management
        Promise.resolve().then(async () => {
          try {
            const newAnswer = await perplexityService.askQuestion(question);
            if (newAnswer) {
              const added = cacheService.addToCache(question, newAnswer);
              if (added) {
                await cacheService.saveIfDirtyAsync();
                logger.debug('Successfully refreshed and saved cache entry in background');
              } else {
                logger.warn('Failed to add refreshed answer to cache');
              }
            }
          } catch (error) {
            logger.error('Background cache refresh failed:', error);
          } finally {
            // Track cache refresh attempts for monitoring
            if (cacheService.metrics) {
              cacheService.metrics.backgroundRefreshAttempts = 
                (cacheService.metrics.backgroundRefreshAttempts || 0) + 1;
            }
          }
        }).catch(error => {
          // This catches errors in the Promise chain itself
          logger.error('Unexpected error in background cache refresh Promise:', error);
        });
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
  refreshCacheEntry, // Export for testing
  processQuestion   // Export for test coverage
};
