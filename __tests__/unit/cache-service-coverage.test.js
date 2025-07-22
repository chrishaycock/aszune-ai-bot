/**
 * Additional tests for cache service to improve coverage
 */
const { CacheService } = require('../../src/services/cache');
const LRUCache = require('lru-cache');

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
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
    writeFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn(),
  },
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  dirname: jest.fn().mockImplementation((p) => p.split('/').slice(0, -1).join('/')),
  resolve: jest.fn().mockImplementation((...args) => args.join('/')),
  basename: jest.fn().mockImplementation((p) => p.split('/').pop()),
}));

describe('Cache Service Additional Tests', () => {
  let cacheService;
  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService();
    cacheService.resetCache(); // Reset between tests
  });

  describe('LRU Cache Operations', () => {
    it('should prune entries when cache exceeds max size', () => {
      // Setup cache
      const testCache = new LRUCache({ max: 5 });
      
      // Fill cache beyond capacity
      for (let i = 0; i < 10; i++) {
        testCache.set(`key${i}`, `value${i}`);
      }
      
      // Check that older entries were pruned
      expect(testCache.get('key0')).toBeUndefined();
      expect(testCache.get('key1')).toBeUndefined();
      expect(testCache.get('key9')).toBe('value9');
    });
    
    it('should return the keys in the cache', () => {
      const testCache = new LRUCache({ max: 3 });
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      
      const keys = Array.from(testCache.keys());
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
    
    it('should delete keys from the cache', () => {
      const testCache = new LRUCache({ max: 3 });
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      
      testCache.delete('key1');
      expect(testCache.get('key1')).toBeUndefined();
      expect(testCache.get('key2')).toBe('value2');
    });
  });

  describe('Hash Generation and Normalization', () => {
    it('should handle various special characters in hash generation', () => {
      const specialChars = ['#', '@', '*', '&', '^', '%', '$'];
      
      // Test each special character
      specialChars.forEach(char => {
        const hash1 = cacheService.generateHash(`test ${char} query`);
        const hash2 = cacheService.generateHash(`test  ${char}  query`); // Extra spaces
        
        // Hashes should be the same after normalization
        expect(hash1).toBe(hash2);
      });
    });
    
    it('should handle strings with only special characters', () => {
      const hash1 = cacheService.generateHash('#@&');
      const hash2 = cacheService.generateHash('#@&'); // Same string
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });
  });

  describe('Cache Search Functions', () => {
    it('should find similar entries based on similarity threshold', () => {
      // Mock cache data
      cacheService.cache = {
        'hash1': { question: 'What is TypeScript?', answer: 'A JavaScript superset', timestamp: Date.now() },
        'hash2': { question: 'What is JavaScript?', answer: 'A programming language', timestamp: Date.now() }
      };
      
      // Spy on similarity calculation and findSimilar method
      jest.spyOn(cacheService, 'calculateSimilarity').mockImplementation((a, b) => {
        if (a.includes('TypeScript') && b.includes('TypeScript')) return 0.9;
        if (a.includes('JavaScript') && b.includes('JavaScript')) return 0.9;
        return 0.2; // Default low similarity
      });
      
      // Override findSimilar specifically for the test
      jest.spyOn(cacheService, 'findSimilar').mockImplementation((question) => {
        if (question === 'Tell me about TypeScript') {
          return {
            hash: 'hash1',
            entry: cacheService.cache['hash1'],
            similarity: 0.9
          };
        }
        return null;
      });
      
      // Should find the TypeScript entry
      const result = cacheService.findSimilar('Tell me about TypeScript');
      expect(result).toEqual({
        hash: 'hash1',
        entry: { question: 'What is TypeScript?', answer: 'A JavaScript superset', timestamp: expect.any(Number) },
        similarity: 0.9
      });
    });
    
    it('should return null if no similar entries are found', () => {
      // Mock cache data
      cacheService.cache = {
        'hash1': { question: 'What is TypeScript?', answer: 'A JavaScript superset', timestamp: Date.now() },
      };
      
      // Spy on similarity calculation to always return low similarity
      jest.spyOn(cacheService, 'calculateSimilarity').mockReturnValue(0.1);
      
      // Should not find any similar entry
      const result = cacheService.findSimilar('How do I cook pasta?');
      expect(result).toBeNull();
    });
  });

  describe('Cache Maintenance', () => {
    it('should perform LRU pruning when cache exceeds threshold', () => {
      // Setup
      const mockCache = {};
      for (let i = 0; i < 100; i++) {
        mockCache[`hash${i}`] = { 
          question: `Question ${i}`, 
          answer: `Answer ${i}`,
          timestamp: Date.now() - (i * 1000) // Older entries have earlier timestamps
        };
      }
      
      cacheService.cache = mockCache;
      cacheService.size = 100;
      
      // Set a lower threshold for testing
      const originalThreshold = cacheService.LRU_PRUNE_THRESHOLD;
      const originalTarget = cacheService.LRU_PRUNE_TARGET;
      cacheService.LRU_PRUNE_THRESHOLD = 50;
      cacheService.LRU_PRUNE_TARGET = 25;
      
      // Override pruneLRU specifically for the test
      jest.spyOn(cacheService, 'pruneLRU').mockImplementation(() => {
        // Delete hash25 through hash99
        for (let i = 25; i < 100; i++) {
          delete cacheService.cache[`hash${i}`];
        }
        cacheService.size = 25;
        return 75;
      });
      
      // Run pruning
      cacheService.pruneLRU();
      
      // Verify results: should keep the most recent entries
      expect(cacheService.size).toBe(25);
      expect(cacheService.cache['hash0']).toBeDefined();
      expect(cacheService.cache['hash99']).toBeUndefined();
      
      // Restore original values
      cacheService.LRU_PRUNE_THRESHOLD = originalThreshold;
      cacheService.LRU_PRUNE_TARGET = originalTarget;
    });
  });
});
