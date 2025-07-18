/**
 * Configuration settings for the Discord bot
 */
require('dotenv').config();

// Environment validation
const requiredEnvVars = ['PERPLEXITY_API_KEY', 'DISCORD_BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Environment-specific defaults
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

module.exports = {
  // API Keys and Tokens
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  
  // Bot Configuration
  MAX_HISTORY: 20,
  RATE_LIMIT_WINDOW: 5000, // 5 seconds
  
  // Cache Configuration
  CACHE: {
    // Enable or disable smart cache
    ENABLED: process.env.ASZUNE_ENABLE_SMART_CACHE !== 'false', // Enabled by default unless explicitly set to 'false'
    // Cache save interval in milliseconds (configurable via env vars)
    SAVE_INTERVAL_MS: parseInt(process.env.ASZUNE_CACHE_SAVE_INTERVAL_MS, 10) || 
                      (isProduction ? 300000 : 60000), // 5 min in prod, 1 min in dev
    // Cache refresh threshold (default 30 days)
    REFRESH_THRESHOLD_MS: parseInt(process.env.ASZUNE_CACHE_REFRESH_THRESHOLD_MS, 10) || 
                         (30 * 24 * 60 * 60 * 1000),
    // Similarity threshold for cache hits
    SIMILARITY_THRESHOLD: parseFloat(process.env.ASZUNE_CACHE_SIMILARITY_THRESHOLD) || 0.85,
    // Maximum cache size
    MAX_SIZE: parseInt(process.env.ASZUNE_MAX_CACHE_SIZE, 10) || 
             (isProduction ? 10000 : (isTest ? 100 : 1000)), // Different defaults per environment
    // LRU thresholds
    LRU_PRUNE_THRESHOLD: parseInt(process.env.ASZUNE_LRU_PRUNE_THRESHOLD, 10) || 
                        (isProduction ? 9000 : (isTest ? 90 : 900)),
    LRU_PRUNE_TARGET: parseInt(process.env.ASZUNE_LRU_PRUNE_TARGET, 10) || 
                     (isProduction ? 7500 : (isTest ? 75 : 750)),
    // Maximum question length for caching
    MAX_QUESTION_LENGTH: parseInt(process.env.ASZUNE_MAX_QUESTION_LENGTH, 10) || 10000,
    // Memory cache size (number of entries)
    MEMORY_CACHE_SIZE: parseInt(process.env.ASZUNE_MEMORY_CACHE_SIZE, 10) || 500
  },
  
  // API Configuration
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
      ENDPOINTS: {
        CHAT_COMPLETIONS: '/chat/completions'
      },
      DEFAULT_MODEL: 'sonar',
      DEFAULT_TEMPERATURE: 0.0,
      MAX_TOKENS: {
        CHAT: 1024,
        SUMMARY: 256
      }
    }
  },
  
  // Discord Embed Colors
  COLORS: {
    PRIMARY: parseInt('0099ff', 16)
  },
    // System Messages
  SYSTEM_MESSAGES: {
    CHAT: 'Aszai is a bot that specialises in gaming lore, game logic, guides, and advice. If you do not know the answer to a question, clearly say "I don\'t know" rather than attempting to make up an answer.',
    SUMMARY: 'Summarise the following conversation between a user and an AI assistant in a concise paragraph, using UK English.',
    TEXT_SUMMARY: 'Summarise the following text in a concise paragraph, using UK English.'
  },
  
  // Emojis for reactions
  REACTIONS: {
    hello: '👋',
    funny: '😂',
    sad: '😢',
    awesome: '😎',
    love: '❤️',
    happy: '😊',
    congratulations: '🎉',
    thanks: '🙏',
    help: '🆘',
    welcome: '👋'
  }
};
