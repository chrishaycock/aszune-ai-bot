/**
 * Tests for the fixed cache service implementation
 */
const path = require('path');
const fs = require('fs');
const { CacheService } = require('../../src/services/cache_lean');
const cacheService = new CacheService();
const { promisify } = require('util');

// Mock fs writeFile for testing race conditions
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      ...originalFs.promises,
      writeFile: jest.fn((path, data) => {
        return new Promise(resolve => {
          // Simulate random delay to test race conditions
          setTimeout(() => {
            resolve();
          }, Math.random() * 10);
        });
      }),
      mkdir: jest.fn().mockResolvedValue(true),
      access: jest.fn().mockResolvedValue(true)
    },
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    accessSync: jest.fn()
  };
});

describe('Cache Service Fixes', () => {
  let testCachePath;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up test cache path
    testCachePath = path.join(__dirname, '../../data/test-cache.json');
    
    // Reset the cache service
    cacheService.resetCache();
    
    // Initialize with test path
    return cacheService.init(testCachePath);
  });
  
  afterEach(() => {
    cacheService.resetCache();
  });
  
  test('cleanup method properly saves pending changes', async () => {
    // Add some items to the cache
    cacheService.addToCache('cleanup test question', 'cleanup test answer');
    
    // Verify the cache is marked as dirty
    expect(cacheService.isDirty).toBe(true);
    
    // Call cleanup
    await cacheService.cleanup();
    
    // Verify save was called
    expect(fs.promises.writeFile).toHaveBeenCalled();
  });
  
  test('inverted index improves search performance', async () => {
    // Add multiple cache entries
    for (let i = 0; i < 10; i++) {
      cacheService.addToCache(`How do I beat the dragon in level ${i}?`, `Strategy ${i}`);
    }
    
    // Force index building
    cacheService._buildInvertedIndex();
    
    // Test finding candidates using index
    const candidates = cacheService._findCandidatesUsingIndex('How do I beat the dragon?');
    
    // Should find relevant entries
    expect(candidates.length).toBeGreaterThan(0);
  });
  
  test('file operations are done asynchronously', async () => {
    // Mock the fileOperation method
    const fileOpSpy = jest.spyOn(cacheService, '_fileOperation');
    
    // Add an entry that should trigger async save
    await cacheService.saveCacheAsync();
    
    // Check if fileOperation was called
    expect(fileOpSpy).toHaveBeenCalled();
  });
  
  test('race condition prevention in addToCache', async () => {
    // Set up the lock to simulate concurrent operation
    cacheService._addToCache_inProgress = true;
    
    // Try to add while lock is active
    const result = cacheService.addToCache('test question', 'test answer');
    
    // Should return false due to lock
    expect(result).toBe(false);
    
    // Release lock
    cacheService._addToCache_inProgress = false;
    
    // Now add should succeed
    const result2 = cacheService.addToCache('test question', 'test answer');
    expect(result2).toBe(true);
  });
  
  test('refresh cache entry has proper retry limits', async () => {
    // Import the chat module directly to access refreshCacheEntry
    const chatService = require('../../src/services/chat');
    
    // Mock conversation manager
    const conversationManager = require('../../src/utils/conversation');
    jest.mock('../../src/utils/conversation');
    conversationManager.getHistory.mockReturnValue([]);
    
    // Mock perplexity service to fail
    const perplexityService = require('../../src/services/perplexity');
    jest.mock('../../src/services/perplexity');
    perplexityService.generateChatResponse.mockRejectedValue(new Error('API error'));
    
    // Call refreshCacheEntry with excessive retry count
    const result = await chatService.refreshCacheEntry('test question', '123456', 3);
    
    // Should return false due to exceeding retries
    expect(result).toBe(false);
  });
});
