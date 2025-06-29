/**
 * Tests for cache service
 */
const cacheService = require('../../src/services/cache');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs');
jest.mock('path');

describe('Cache Service', () => {
  const mockCachePath = '/mock/path/question_cache.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the service state
    cacheService.cache = {};
    cacheService.initialized = false;
    
    // Mock path.join to return our mock cache path
    path.join.mockReturnValue(mockCachePath);
    
    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/mock/path');
    
    // Default mock for fs.existsSync
    fs.existsSync.mockReturnValue(true);
    
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
  
  describe('init()', () => {
    it('initializes the cache from disk', () => {
      cacheService.init(mockCachePath);
      
      expect(fs.existsSync).toHaveBeenCalledWith(mockCachePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, 'utf8');
      expect(cacheService.initialized).toBe(true);
      expect(Object.keys(cacheService.cache).length).toBe(1);
    });
    
    it('creates a new cache if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      cacheService.init(mockCachePath);
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(cacheService.initialized).toBe(true);
    });
    
    it('handles read errors gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      
      cacheService.init(mockCachePath);
      
      expect(cacheService.initialized).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(cacheService.cache).toEqual({});
    });
  });
  
  describe('generateHash()', () => {
    it('creates consistent hashes for the same question', () => {
      const hash1 = cacheService.generateHash('What is the meaning of life?');
      const hash2 = cacheService.generateHash('what is the meaning of life?');
      const hash3 = cacheService.generateHash('What is the meaning of life? ');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });
    
    it('creates different hashes for different questions', () => {
      const hash1 = cacheService.generateHash('What is the meaning of life?');
      const hash2 = cacheService.generateHash('Who am I?');
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('calculateSimilarity()', () => {
    it('returns 1 for identical strings', () => {
      const similarity = cacheService.calculateSimilarity('test string', 'test string');
      expect(similarity).toBe(1);
    });
    
    it('returns 0 for completely different strings', () => {
      const similarity = cacheService.calculateSimilarity('test string', 'completely different');
      expect(similarity).toBe(0);
    });
    
    it('returns a value between 0 and 1 for partially similar strings', () => {
      const similarity = cacheService.calculateSimilarity('test string one two', 'test string three four');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });
  
  describe('findInCache()', () => {
    it('finds an exact match by hash', () => {
      cacheService.init();
      
      // Mock the generateHash to return our known hash
      cacheService.generateHash = jest.fn().mockReturnValue('abcd1234');
      
      const result = cacheService.findInCache('What is the meaning of life?');
      
      expect(result).toBeDefined();
      expect(result.question).toBe('What is the meaning of life?');
      expect(result.answer).toBe('42');
      expect(result.accessCount).toBe(2); // Incremented from 1
    });
    
    it('finds a similar match', () => {
      cacheService.init();
      
      // Mock similarity check to find a match
      cacheService.calculateSimilarity = jest.fn().mockReturnValue(0.9);
      cacheService.generateHash = jest.fn().mockReturnValue('notfound');
      
      const result = cacheService.findInCache('What is life\'s meaning?');
      
      expect(result).toBeDefined();
      expect(result.similarity).toBe(0.9);
      expect(result.question).toBe('What is the meaning of life?');
    });
    
    it('returns null when no match is found', () => {
      cacheService.init();
      
      // Mock hash and similarity to not find a match
      cacheService.generateHash = jest.fn().mockReturnValue('notfound');
      cacheService.calculateSimilarity = jest.fn().mockReturnValue(0.5);
      
      const result = cacheService.findInCache('Something completely different');
      
      expect(result).toBeNull();
    });
    
    it('marks stale entries for refresh', () => {
      cacheService.init();
      
      // Set the cache entry to be old (31 days)
      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000);
      cacheService.cache.abcd1234.timestamp = oldTimestamp;
      
      // Mock the hash match
      cacheService.generateHash = jest.fn().mockReturnValue('abcd1234');
      
      const result = cacheService.findInCache('What is the meaning of life?');
      
      expect(result.needsRefresh).toBe(true);
    });
  });
  
  describe('addToCache()', () => {
    it('adds a new entry to the cache', () => {
      cacheService.init();
      cacheService.generateHash = jest.fn().mockReturnValue('newHash');
      
      cacheService.addToCache('New question', 'New answer');
      
      expect(cacheService.cache.newHash).toBeDefined();
      expect(cacheService.cache.newHash.question).toBe('New question');
      expect(cacheService.cache.newHash.answer).toBe('New answer');
      expect(cacheService.cache.newHash.accessCount).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    it('includes game context when provided', () => {
      cacheService.init();
      cacheService.generateHash = jest.fn().mockReturnValue('contextHash');
      
      cacheService.addToCache('Game question', 'Game answer', 'Elder Scrolls');
      
      expect(cacheService.cache.contextHash.gameContext).toBe('Elder Scrolls');
    });
  });
  
  describe('getStats()', () => {
    it('returns accurate statistics', () => {
      cacheService.init();
      
      // Add another entry
      cacheService.cache.newHash = {
        questionHash: 'newHash',
        question: 'Another question',
        answer: 'Another answer',
        timestamp: Date.now(),
        accessCount: 5,
        lastAccessed: Date.now()
      };
      
      const stats = cacheService.getStats();
      
      expect(stats.entryCount).toBe(2);
      expect(stats.totalAccesses).toBe(6); // 1 + 5
      expect(stats.mostAccessedCount).toBe(5);
    });
  });
  
  describe('pruneCache()', () => {
    it('removes old, rarely accessed entries', () => {
      cacheService.init();
      
      // Add an old, rarely accessed entry
      cacheService.cache.oldHash = {
        questionHash: 'oldHash',
        question: 'Old question',
        answer: 'Old answer',
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days old
        accessCount: 2,
        lastAccessed: Date.now() - (100 * 24 * 60 * 60 * 1000)
      };
      
      // Add an old but frequently accessed entry
      cacheService.cache.oldPopularHash = {
        questionHash: 'oldPopularHash',
        question: 'Old but popular',
        answer: 'Popular answer',
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days old
        accessCount: 10,
        lastAccessed: Date.now() - (10 * 24 * 60 * 60 * 1000)
      };
      
      const removedCount = cacheService.pruneCache(90, 5);
      
      expect(removedCount).toBe(1);
      expect(cacheService.cache.oldHash).toBeUndefined();
      expect(cacheService.cache.oldPopularHash).toBeDefined(); // Should be kept due to high access count
    });
  });
});
