/**
 * Additional tests for chat service to improve coverage
 */
const chatService = require('../../src/services/chat');
const cacheService = require('../../src/services/cache');
const perplexityService = require('../../src/services/perplexity');

// Mock dependencies
jest.mock('../../src/services/cache', () => ({
  findInCache: jest.fn(),
  addToCache: jest.fn(),
  saveIfDirty: jest.fn(),
  saveIfDirtyAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/perplexity', () => ({
  askQuestion: jest.fn(),
}));

describe('Chat Service Additional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Question Processing', () => {
    it('should process a question with cache hit', async () => {
      // Mock cache hit
      const cachedResponse = {
        answer: 'This is a cached answer',
        timestamp: Date.now() - 1000,
        needsRefresh: false
      };
      
      cacheService.findInCache.mockReturnValue(cachedResponse);
      
      // Execute
      const result = await chatService.processQuestion('What is a test?');
      
      // Verify
      expect(result).toBe('This is a cached answer');
      expect(cacheService.findInCache).toHaveBeenCalledWith('What is a test?');
      expect(perplexityService.askQuestion).not.toHaveBeenCalled();
    });

    it('should process a question with cache hit but stale entry', async () => {
      // Mock stale cache hit
      const cachedResponse = {
        answer: 'This is a stale cached answer',
        timestamp: Date.now() - 3600000, // 1 hour ago
        needsRefresh: true
      };
      
      cacheService.findInCache.mockReturnValue(cachedResponse);
      
      // Mock new response
      perplexityService.askQuestion.mockResolvedValue('This is a fresh answer');
      
      // Execute
      const result = await chatService.processQuestion('What is a test?');
      
      // Should return cached answer first, then refresh
      expect(result).toBe('This is a stale cached answer');
      
      // Wait a bit for the async refresh to be called
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify API call was made
      expect(perplexityService.askQuestion).toHaveBeenCalledWith('What is a test?');
      expect(cacheService.addToCache).toHaveBeenCalled();
    });

    it('should process a question with cache miss', async () => {
      // Mock cache miss
      cacheService.findInCache.mockReturnValue(null);
      
      // Mock API response
      perplexityService.askQuestion.mockResolvedValue('This is a new answer');
      
      // Execute
      const result = await chatService.processQuestion('What is a test?');
      
      // Verify
      expect(result).toBe('This is a new answer');
      expect(cacheService.findInCache).toHaveBeenCalledWith('What is a test?');
      expect(perplexityService.askQuestion).toHaveBeenCalledWith('What is a test?');
      expect(cacheService.addToCache).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Mock cache miss
      cacheService.findInCache.mockReturnValue(null);
      
      // Mock API error
      perplexityService.askQuestion.mockRejectedValue(new Error('API Error'));
      
      // Execute and expect error
      await expect(chatService.processQuestion('What is a test?'))
        .rejects.toThrow('Failed to get answer: API Error');
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // Mock cache error
      cacheService.findInCache.mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      // Mock API response as fallback
      perplexityService.askQuestion.mockResolvedValue('API fallback answer');
      
      // Execute
      const result = await chatService.processQuestion('What is a test?');
      
      // Should use API as fallback
      expect(result).toBe('API fallback answer');
      expect(perplexityService.askQuestion).toHaveBeenCalledWith('What is a test?');
    });
  });
});
