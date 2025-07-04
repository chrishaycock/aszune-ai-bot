/**
 * Tests for chat service
 */
const { handleChatMessage } = require('../../src/services/chat');
const perplexityService = require('../../src/services/perplexity');
const conversationManager = require('../../src/utils/conversation');
const emojiManager = require('../../src/utils/emoji');
const { CacheService } = require('../../src/services/cache');

// Mock dependencies
jest.mock('../../src/services/perplexity');
jest.mock('../../src/utils/conversation');
jest.mock('../../src/utils/emoji');

jest.mock('../../src/services/cache', () => {
  const mCacheService = {
    findInCache: jest.fn(),
    addToCache: jest.fn(),
    initSync: jest.fn(),
  };
  return { CacheService: jest.fn(() => mCacheService) };
});

let cacheService;

describe('Chat Service', () => {
  // Create a mock message
  const createMessage = (content = 'hello') => ({
    content,
    author: { bot: false, id: '123' },
    reply: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue({}),
    channel: { sendTyping: jest.fn() }
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService();
    
    // Set up default mocks
    conversationManager.isRateLimited.mockReturnValue(false);
    conversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'hello' }]);
    perplexityService.generateChatResponse.mockResolvedValue('AI response');
    emojiManager.addEmojisToResponse.mockReturnValue('AI response 😊');
    cacheService.findInCache.mockReturnValue(null); // Default: cache miss
  });
  
  it('handles a normal message and sends a reply', async () => {
    const message = createMessage('hello');
    
    await handleChatMessage(message);
    
    expect(conversationManager.addMessage).toHaveBeenCalledWith('123', 'user', 'hello');
    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        description: 'AI response 😊'
      })]
    });
    expect(emojiManager.addReactionsToMessage).toHaveBeenCalled();
  });
  
  it('enforces rate limiting', async () => {
    const message = createMessage('hello');
    conversationManager.isRateLimited.mockReturnValue(true);
    
    await handleChatMessage(message);
    
    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });
  
  it('skips messages from bots', async () => {
    const message = createMessage('hello');
    message.author.bot = true;
    
    await handleChatMessage(message);
    
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });
  
  it('handles messages with missing user ID', async () => {
    const message = createMessage('hello');
    message.author.id = undefined;
    
    await handleChatMessage(message);
    
    expect(message.reply).toHaveBeenCalledWith('Unable to process your request due to a system error.');
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });
  
  it('handles API errors gracefully', async () => {
    const message = createMessage();
    perplexityService.generateChatResponse.mockRejectedValue(new Error('API error'));
    
    await handleChatMessage(message);
    
    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('error'));
  });
  
  it('adds the bot response to conversation history', async () => {
    const message = createMessage();
    
    await handleChatMessage(message);
    
    expect(conversationManager.addMessage).toHaveBeenCalledWith('123', 'user', 'hello');
    expect(conversationManager.addMessage).toHaveBeenCalledWith('123', 'assistant', 'AI response 😊');
  });
  
  describe('Cache Integration', () => {
    it('checks the cache before calling the API', async () => {
      const message = createMessage('What is the meaning of life?');
      
      await handleChatMessage(message);
      
      expect(cacheService.findInCache).toHaveBeenCalledWith('What is the meaning of life?');
    });
    
    it('uses cached response when available', async () => {
      const message = createMessage('What is the meaning of life?');
      cacheService.findInCache.mockReturnValue({
        answer: 'Cached answer: 42',
        accessCount: 5,
        timestamp: Date.now() - 1000
      });
      
      await handleChatMessage(message);
      
      // API should not be called when cache hit
      expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
      expect(emojiManager.addEmojisToResponse).toHaveBeenCalledWith('Cached answer: 42');
      expect(message.reply).toHaveBeenCalledWith({
        embeds: [expect.objectContaining({
          footer: expect.objectContaining({
            text: expect.stringContaining('From Cache')
          })
        })]
      });
    });
    
    it('adds new responses to the cache', async () => {
      const message = createMessage('New question');
      
      await handleChatMessage(message);
      
      expect(cacheService.addToCache).toHaveBeenCalledWith('New question', 'AI response');
    });
    
    it('refreshes stale cache entries in the background', async () => {
      jest.useFakeTimers();
      
      const message = createMessage('What is the meaning of life?');
      cacheService.findInCache.mockReturnValue({
        answer: 'Cached answer: 42',
        needsRefresh: true, // Stale entry
        timestamp: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days old
      });
      
      await handleChatMessage(message);
      
      // Should still use cached response immediately
      expect(message.reply).toHaveBeenCalled();
      
      // API called asynchronously to refresh the cache
      await Promise.resolve(); // Wait for microtask queue
      expect(perplexityService.generateChatResponse).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
});
