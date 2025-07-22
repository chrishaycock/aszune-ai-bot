/**
 * Utility for handling emoji reactions
 */
const config = require('../config/config');

class EmojiManager {
  constructor() {
    this.reactions = config.REACTIONS;
  }
  
  /**
   * Process the message content and add emojis to the response based on keywords
   * @param {string} content - The message content to analyze
   * @returns {string} - The original message with emojis added
   */
  addEmojisToResponse(content) {
    let modifiedContent = content;
    
    for (const [keyword, emoji] of Object.entries(this.reactions)) {
      // Match whole words only by using word boundary regex
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(content)) {
        modifiedContent += ` ${emoji}`;
      }
    }
    
    return modifiedContent;
  }
  
  /**
   * Get emojis to react with based on message content
   * @param {string} content - The message content to analyze
   * @returns {Array<string>} - Array of emoji characters to react with
   */
  getReactionsForMessage(content) {
    const reactEmojis = [];
    
    for (const [keyword, emoji] of Object.entries(this.reactions)) {
      // Match whole words only by using word boundary regex
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(content)) {
        reactEmojis.push(emoji);
      }
    }
    
    return reactEmojis;
  }
  
  /**
   * Add reactions to a message
   * @param {Object} message - Discord.js message object
   * @returns {Promise<void>}
   */
  async addReactionsToMessage(message) {
    const emojis = this.getReactionsForMessage(message.content);
    
    for (const emoji of emojis) {
      try {
        await message.react(emoji);
      } catch (error) {
        console.error(`Error reacting with ${emoji}:`, error);
      }
    }
  }
}

module.exports = new EmojiManager();
