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

/**
 * Handle an incoming chat message
 * @param {Object} message - Discord.js message object
 * @returns {Promise<void>}
 */
async function handleChatMessage(message) {
  if (message.author.bot || !message.content) return;
  
  const userId = message.author.id;
  
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
  
  // Add message to history
  conversationManager.addMessage(userId, 'user', message.content);
  
  // Show typing indicator
  message.channel.sendTyping();
  
  try {
    // Extract the user's question
    const userQuestion = message.content;
    let reply;
    let fromCache = false;
    
    // Try to find the question in the cache first
    const cacheResult = cacheService.findInCache(userQuestion);
    
    if (cacheResult) {
      // Cache hit!
      logger.info(`Cache hit for question: "${userQuestion.substring(0, 30)}..."`);
      reply = cacheResult.answer;
      fromCache = true;
      
      // If the entry needs a refresh (is stale), update it in the background
      // but still serve the cached response immediately to the user
      if (cacheResult.needsRefresh) {
        logger.debug('Refreshing stale cache entry in the background');
        // Don't await this to avoid delaying the response
        refreshCacheEntry(userQuestion, userId);
      }
    } else {
      // Cache miss - call the API
      logger.info(`Cache miss for question: "${userQuestion.substring(0, 30)}..."`);
      const history = conversationManager.getHistory(userId);
      reply = await perplexityService.generateChatResponse(history);
      
      // Add the new Q&A pair to the cache
      cacheService.addToCache(userQuestion, reply);
    }
    
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
 */
async function refreshCacheEntry(question, userId) {
  try {
    // Get the current history - this includes the question we just processed
    const history = conversationManager.getHistory(userId);
    
    // Generate a fresh response from the API
    const freshReply = await perplexityService.generateChatResponse(history);
    
    // Update the cache with the fresh response
    cacheService.addToCache(question, freshReply);
    logger.debug(`Refreshed cache entry for: "${question.substring(0, 30)}..."`);
  } catch (error) {
    logger.error('Error refreshing cache entry:', error);
    // Failed refresh doesn't affect the user experience, so just log it
  }
}

module.exports = handleChatMessage;
