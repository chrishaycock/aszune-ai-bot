/**
 * Tests for edge cases in cache service
 */
const { CacheService } = require('../../src/services/cache');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  accessSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    copyFile: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('path');

let cacheService;

describe('Cache Service Edge Cases', () => {
  const mockCachePath = '/mock/path/question_cache.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    cacheService = new CacheService();
    // Reset the service state
    // cacheService.cache = {}; // This is handled by the constructor
    // cacheService.initialized = false; // This is handled by the constructor
    
    // Mock path.join to return our mock cache path
    path.join.mockReturnValue(mockCachePath);
    
    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/mock/path');
    
    // Default mock for fs.accessSync (success)
    fs.accessSync.mockImplementation(() => {});
    
    // Default mock for fs.readFileSync
    fs.readFileSync.mockReturnValue(JSON.stringify({
      'abcd1234': {
        questionHash: 'abcd1234',
        question: 'What is the meaning of life?',
        answer: '42',
        timestamp: Date.now() - 1000, // 1 second ago
        accessCount: 1,
        lastAccessed: Date.now() - 1000
      }
    }));
  });
  
  describe('Memory Cache', () => {
    it('uses memory cache for subsequent lookups', () => {
      cacheService.initSync();
      cacheService.generateHash = jest.fn().mockReturnValue('memtest');
      
      // Add to cache
      cacheService.addToCache('Memory test', 'Memory answer');
      
      // First lookup should hit the main cache
      const result1 = cacheService.findInCache('Memory test');
      expect(result1).toBeTruthy();
      expect(result1.answer).toBe('Memory answer');
      
      // Second lookup should hit memory cache
      const result2 = cacheService.findInCache('Memory test');
      expect(result2).toBeTruthy();
      expect(result2.answer).toBe('Memory answer');
      
      // Verify memoryCache.get was called for the second lookup
      // This is hard to test directly since it's an internal implementation detail
      // But we can verify the metrics show a memory hit
      expect(cacheService.metrics.memoryHits).toBe(1);
    });
  });

  describe('saveIfDirtyAsync', () => {
    it('saves the cache if it is dirty', async () => {
      cacheService.initSync();
      cacheService.isDirty = true;
      
      await cacheService.saveIfDirtyAsync();
      
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
    
    it('does not save the cache if it is not dirty', async () => {
      cacheService.initSync();
      cacheService.isDirty = false;
      
      await cacheService.saveIfDirtyAsync();
      
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
    
    it('handles errors during save operation', async () => {
      cacheService.initSync();
      cacheService.isDirty = true;
      
      // Mock writeFile to throw an error
      fs.promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
      
      await cacheService.saveIfDirtyAsync();
      
      // Should still be marked as dirty after failed save
      expect(cacheService.isDirty).toBe(true);
    });
  });
  
  describe('Error handling during initialization', () => {
    it('should handle directory creation errors in non-test environment', async () => {
      // Change environment to non-test
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Mock access to throw error (directory doesn't exist)
      fs.promises.access.mockRejectedValue(new Error('Directory not found'));
      
      // Mock mkdir to throw error
      fs.promises.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      // Initialize the cache and expect an error
      await expect(cacheService.init(mockCachePath)).rejects.toThrow();
      
      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
    });
    
    it('should handle JSON parse errors during initialization', async () => {
      // Mock readFile to return invalid JSON
      fs.promises.readFile.mockResolvedValue('{ invalid json');
      
      // Initialize the cache
      await cacheService.init(mockCachePath);
      
      // Expect the cache to be initialized with an empty object
      expect(cacheService.initialized).toBe(true);
      expect(cacheService.cache).toEqual({});
    });
  });
  
  describe('Cache operations with disabled cache', () => {
    beforeEach(() => {
      // Save original ASZUNE_ENABLE_SMART_CACHE value
      this.originalEnableCache = process.env.ASZUNE_ENABLE_SMART_CACHE;
      // Disable the cache via environment variable
      process.env.ASZUNE_ENABLE_SMART_CACHE = 'false';
      
      // Mock config to ensure cache is disabled
      jest.mock('../../src/config/config', () => ({
        CACHE: {
          ENABLED: false
        }
      }), { virtual: true });
      
      // Clear all mocks
      jest.clearAllMocks();
      
      // Create a new instance with cache disabled
      const { CacheService } = require('../../src/services/cache');
      cacheService = new CacheService();
    });
    
    afterEach(() => {
      // Re-enable the cache for other tests
      process.env.ASZUNE_ENABLE_SMART_CACHE = this.originalEnableCache;
      jest.resetModules();
    });
    
    it('should make all operations no-ops when cache is disabled', async () => {
      // Init should be a no-op
      await cacheService.init();
      expect(cacheService.initialized).toBe(true);
      
      // Skip the readFile check as we can't properly mock it due to module caching
      
      // addToCache should be a no-op
      const addResult = cacheService.addToCache('test question', 'test answer');
      expect(addResult).toBe(false); // Should return false when cache is disabled
      
      // findInCache should return null
      const getResult = cacheService.findInCache('test question');
      expect(getResult).toBeNull();
      
      // Save should be a no-op
      await cacheService.saveCacheAsync();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });
  
  describe('Cache pruning and management', () => {
    it('should prune cache when size exceeds threshold', () => {
      // Setup cache
      cacheService.initSync();
      
      // Add more entries than the threshold
      const originalPruneThreshold = cacheService.LRU_PRUNE_THRESHOLD;
      cacheService.LRU_PRUNE_THRESHOLD = 10;
      
      // Mock the max size to be smaller to force pruning
      const originalMaxSize = cacheService.maxSize;
      cacheService.maxSize = 15;
      
      // Add entries directly to the cache
      for (let i = 0; i < 20; i++) {
        const hash = `hash${i}`;
        cacheService.cache[hash] = {
          questionHash: hash,
          question: `Question ${i}`,
          answer: `Answer ${i}`,
          timestamp: Date.now() - i * 1000,
          accessCount: i % 5, // Vary access counts
          lastAccessed: Date.now() - i * 500
        };
      }
      
      // Update size manually - this is the key fix
      cacheService.size = Object.keys(cacheService.cache).length;
      
      // Call pruneCache
      const removedCount = cacheService.pruneCache();
      
      // Check if the cache has been pruned
      expect(removedCount).toBeGreaterThan(0);
      expect(Object.keys(cacheService.cache).length).toBeLessThan(20);
      expect(cacheService.size).toBe(Object.keys(cacheService.cache).length);
      
      // Restore original values
      cacheService.LRU_PRUNE_THRESHOLD = originalPruneThreshold;
      cacheService.maxSize = originalMaxSize;
    });
    
    it('should clear the cache properly', () => {
      // Setup cache with entries
      cacheService.initSync();
      
      // Add some entries
      for (let i = 0; i < 5; i++) {
        cacheService.addToCache(`Question ${i}`, `Answer ${i}`);
      }
      
      // Clear the cache
      cacheService.clearCache();
      
      // Verify cache is empty
      expect(Object.keys(cacheService.cache).length).toBe(0);
      expect(cacheService.size).toBe(0);
      expect(cacheService.isDirty).toBe(true);
    });
    
    it('does not save the cache if it is not dirty', (done) => {
      cacheService.initSync();
      cacheService.isDirty = false;
      
      cacheService.saveIfDirtyAsync().then(() => {
        expect(fs.promises.writeFile).not.toHaveBeenCalled();
        expect(cacheService.isDirty).toBe(false);
        done();
      });
    });
  });
  
  describe('saveIfDirty', () => {
    it('saves the cache if it is dirty', () => {
      cacheService.initSync();
      cacheService.isDirty = true;
      
      cacheService.saveIfDirty();
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
    
    it('does not save the cache if it is not dirty', () => {
      // First, clear any previous calls to writeFileSync
      fs.writeFileSync.mockClear();
      
      // Mock the implementation of saveCache to do nothing
      jest.spyOn(cacheService, 'saveCache').mockImplementation(() => {});
      
      cacheService.initSync();
      cacheService.isDirty = false;
      
      cacheService.saveIfDirty();
      
      // Now we're checking that saveCache wasn't called
      expect(cacheService.saveCache).not.toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
  });
  
  describe('getHitRateStats', () => {
    it('returns correct hit rate statistics', () => {
      cacheService.initSync();
      
      // Setup metrics
      cacheService.metrics.hits = 75;
      cacheService.metrics.misses = 25;
      cacheService.metrics.exactMatches = 50;
      cacheService.metrics.similarityMatches = 25;
      cacheService.metrics.errors = 5;
      cacheService.metrics.lastReset = Date.now() - 86400000; // 1 day ago
      
      const stats = cacheService.getHitRateStats();
      
      expect(stats.totalLookups).toBe(100);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.exactMatchRate).toBe(2/3);
      expect(stats.uptimeDays).toBeDefined();
      expect(parseFloat(stats.uptimeDays)).toBeCloseTo(1.0, 1); // About 1 day with some precision
    });
  });
  
  describe('resetMetrics', () => {
    it('resets all metrics to zero', () => {
      cacheService.initSync();
      
      // Setup metrics
      cacheService.metrics.hits = 10;
      cacheService.metrics.misses = 10;
      
      cacheService.resetMetrics();
      
      expect(cacheService.metrics.hits).toBe(0);
      expect(cacheService.metrics.misses).toBe(0);
      expect(cacheService.metrics.exactMatches).toBe(0);
      expect(cacheService.metrics.similarityMatches).toBe(0);
      expect(cacheService.metrics.errors).toBe(0);
      expect(cacheService.metrics.lastReset).toBeLessThanOrEqual(Date.now());
    });
  });
  
  describe('maintain', () => {
    it('calls saveIfDirty when maintenance runs', () => {
      cacheService.initSync();
      cacheService.saveIfDirty = jest.fn();
      cacheService.evictLRU = jest.fn();
      
      cacheService.maintain();
      
      expect(cacheService.saveIfDirty).toHaveBeenCalled();
    });
    
    it('evicts LRU entries when cache exceeds threshold', () => {
      cacheService.initSync();
      cacheService.saveIfDirty = jest.fn();
      cacheService.evictLRU = jest.fn();
      
      // Create mock cache that exceeds threshold
      const mockCache = {};
      for (let i = 0; i < 10000; i++) {
        mockCache[`key${i}`] = { foo: 'bar' };
      }
      cacheService.cache = mockCache;
      
      cacheService.maintain();
      
      expect(cacheService.evictLRU).toHaveBeenCalled();
    });
  });
});
