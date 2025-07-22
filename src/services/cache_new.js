/**
 * Cache service for storing and retrieving frequently asked questions
 * Reduces API token usage by serving cached responses when possible
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const LRUCache = require('lru-cache');
const { Mutex } = require('async-mutex');
const logger = require('../utils/logger');
const config = require('../config/config');
const { 
  CacheError,
  CacheInitializationError,
  CacheSaveError,
  CacheReadError,
  CacheValueError
} = require('../utils/errors');

// Constants
const DEFAULT_CACHE_PATH = process.env.CACHE_PATH || path.join(__dirname, '../../data/question_cache.json');
const CACHE_REFRESH_THRESHOLD = config.CACHE?.REFRESH_THRESHOLD_MS || (30 * 24 * 60 * 60 * 1000);
const SIMILARITY_THRESHOLD = config.CACHE?.SIMILARITY_THRESHOLD || 0.85;
const CACHE_MAX_SIZE = config.CACHE?.MAX_SIZE || 10000;
// LRU pruning threshold and target size
const LRU_PRUNE_THRESHOLD = config.CACHE?.LRU_PRUNE_THRESHOLD || 9000;
const LRU_PRUNE_TARGET = config.CACHE?.LRU_PRUNE_TARGET || 7500;

class CacheService {
  constructor() {
    // Check if cache is enabled in config
    this.enabled = config.CACHE?.ENABLED !== false;
    
    if (!this.enabled) {
      this._initializeDisabledMode();
    } else {
      this._initializeEnabledMode();
      this._initializeMetrics();
    }
  }
  
  /**
   * Initialize the cache service in disabled mode
   * @private
   */
  _initializeDisabledMode() {
    logger.info('Smart cache is disabled via configuration. Cache operations will be no-ops.');
    // Initialize minimal properties when disabled
    this.cache = {};
    this.initialized = true;
    this.metrics = { disabled: true };
  }
  
  /**
   * Initialize the cache service in enabled mode
   * @private
   */
  _initializeEnabledMode() {
    // Persistent cache
    this.cache = {};
    this.initialized = false;
    this.cachePath = DEFAULT_CACHE_PATH;
    this.isDirty = false; // Track if cache has been modified and needs saving
    this.size = 0;
    this.maxSize = CACHE_MAX_SIZE;
    
    // Mutex for concurrent operations
    this.addToCacheMutex = new Mutex();
    
    // In-memory LRU cache for fast lookups
    const memoryCacheSize = (config.CACHE && config.CACHE.MEMORY_CACHE_SIZE) || 100;
    this.memoryCache = new LRUCache({ max: memoryCacheSize });
    
    // Pruning thresholds
    this.LRU_PRUNE_THRESHOLD = LRU_PRUNE_THRESHOLD;
    this.LRU_PRUNE_TARGET = LRU_PRUNE_TARGET;
  }
  
  /**
   * Initialize cache metrics
   * @private
   */
  _initializeMetrics() {
    // Cache statistics metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      exactMatches: 0,
      similarityMatches: 0,
      memoryHits: 0,
      errors: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Initialize the cache synchronously
   * @param {string} cachePath - Path to the cache file
   */
  initSync(cachePath = DEFAULT_CACHE_PATH) {
    if (!this.enabled) return;
    
    try {
      this.cachePath = cachePath;
      
      // Check if cache file exists
      try {
        fs.accessSync(this.cachePath);
      } catch (error) {
        // Create cache directory if it doesn't exist
        const cacheDir = path.dirname(this.cachePath);
        try {
          fs.mkdirSync(cacheDir, { recursive: true });
        } catch (mkdirError) {
          if (mkdirError.code !== 'EEXIST') {
            throw mkdirError;
          }
        }
        
        // Create empty cache file
        fs.writeFileSync(this.cachePath, '{}', 'utf8');
        this.initialized = true;
        this.cache = {};
        return;
      }
      
      // Read and parse cache file
      try {
        const cacheData = fs.readFileSync(this.cachePath, 'utf8');
        this.cache = JSON.parse(cacheData);
        this.size = Object.keys(this.cache).length;
      } catch (readError) {
        // Handle read/parse errors by creating a new empty cache
        logger.warn('Failed to read or parse cache file: ' + readError.message);
        this.cache = {};
        fs.writeFileSync(this.cachePath, '{}', 'utf8');
      }
      
      this.initialized = true;
      logger.info(`Cache initialized with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      logger.error('Cache initialization error', error);
      // Continue with empty cache to prevent application failure
      this.cache = {};
      this.initialized = true;
      throw new CacheInitializationError('Failed to initialize cache: ' + error.message);
    }
  }

  /**
   * Initialize the cache asynchronously
   * @param {string} cachePath - Path to the cache file
   */
  async init(cachePath = DEFAULT_CACHE_PATH) {
    if (!this.enabled) return;
    
    try {
      this.cachePath = cachePath;
      
      // Check if cache file exists
      try {
        await fs.promises.access(this.cachePath);
      } catch (error) {
        // Create cache directory if it doesn't exist
        const cacheDir = path.dirname(this.cachePath);
        try {
          await fs.promises.mkdir(cacheDir, { recursive: true });
        } catch (mkdirError) {
          if (mkdirError.code !== 'EEXIST') {
            logger.warn('Failed to create cache directory: ' + mkdirError.message);
            throw mkdirError;
          }
        }
        
        // Create empty cache file
        await fs.promises.writeFile(this.cachePath, '{}', 'utf8');
        this.initialized = true;
        this.cache = {};
        logger.info('Cache file not found, creating new cache');
        return;
      }
      
      // Read and parse cache file
      try {
        const cacheData = await fs.promises.readFile(this.cachePath, 'utf8');
        this.cache = JSON.parse(cacheData);
        this.size = Object.keys(this.cache).length;
      } catch (readError) {
        // Handle read/parse errors by creating a new empty cache
        logger.warn('Failed to read or parse cache file: ' + readError.message);
        this.cache = {};
        await fs.promises.writeFile(this.cachePath, '{}', 'utf8');
        logger.info('Cache initialized with empty cache due to errors');
      }
      
      this.initialized = true;
      logger.info(`Cache initialized with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      logger.error('Error initializing cache: ' + error.message);
      // Continue with empty cache to prevent application failure
      this.cache = {};
      this.initialized = true;
      throw new CacheInitializationError('Failed to initialize cache: ' + error.message);
    }
  }
  
  /**
   * Generate a hash for a question to use as a cache key
   * @param {string} question - The question to hash
   * @returns {string} - Hash of the question
   */
  generateHash(question) {
    if (!question || typeof question !== 'string') {
      throw new CacheValueError('Cannot generate hash for invalid question');
    }
    
    // Normalize question before hashing (lowercase, trim whitespace)
    const normalizedQuestion = question.toLowerCase().trim();
    
    // Create MD5 hash of the normalized question
    return crypto.createHash('md5').update(normalizedQuestion).digest('hex');
  }
  
  /**
   * Calculate similarity between two strings using Jaccard similarity
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2 || typeof str1 !== 'string' || typeof str2 !== 'string') {
      return 0;
    }
    
    // Normalize and tokenize strings
    const tokens1 = new Set(str1.toLowerCase().trim().split(/\s+/));
    const tokens2 = new Set(str2.toLowerCase().trim().split(/\s+/));
    
    // Calculate intersection and union size
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    // Calculate Jaccard similarity coefficient
    return intersection.size / union.size;
  }
  
  /**
   * Check if a cache entry is stale and needs refreshing
   * @param {Object} cacheEntry - Cache entry to check
   * @returns {boolean} - True if entry is stale, false otherwise
   */
  isStale(cacheEntry) {
    if (!cacheEntry || !cacheEntry.timestamp) {
      return true;
    }
    
    const now = Date.now();
    return (now - cacheEntry.timestamp) > CACHE_REFRESH_THRESHOLD;
  }
  
  /**
   * Find a question in the cache
   * @param {string} question - The question to find
   * @returns {Object|null} - Cache entry if found, null otherwise
   */
  findInCache(question) {
    if (!this.enabled || !this.initialized) {
      return null;
    }
    
    if (!question || typeof question !== 'string') {
      return null;
    }
    
    // Try memory cache first for faster lookups
    const memoryResult = this.memoryCache.get(question);
    if (memoryResult) {
      this.metrics.hits++;
      this.metrics.memoryHits++;
      this.metrics.exactMatches++;
      
      // Update access count and last accessed
      if (this.cache[memoryResult.questionHash]) {
        this.cache[memoryResult.questionHash].accessCount++;
        this.cache[memoryResult.questionHash].lastAccessed = Date.now();
        this.isDirty = true;
      }
      
      return memoryResult;
    }
    
    // Generate hash for the question
    const questionHash = this.generateHash(question);
    
    // Check for exact match by hash
    if (this.cache[questionHash]) {
      const result = this.cache[questionHash];
      
      // Update access statistics
      result.accessCount = (result.accessCount || 0) + 1;
      result.lastAccessed = Date.now();
      this.isDirty = true;
      
      // Add to memory cache
      this.memoryCache.set(question, result);
      
      // Update metrics
      this.metrics.hits++;
      this.metrics.exactMatches++;
      
      // Check if entry is stale
      if (this.isStale(result)) {
        result.needsRefresh = true;
      }
      
      return result;
    }
    
    // If no exact match, try similarity search
    let bestMatch = null;
    let highestSimilarity = 0;
    
    for (const hash in this.cache) {
      const entry = this.cache[hash];
      const similarity = this.calculateSimilarity(question, entry.question);
      
      if (similarity >= SIMILARITY_THRESHOLD && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = { ...entry, similarity };
      }
    }
    
    if (bestMatch) {
      // Update access statistics for the similar match
      const originalEntry = this.cache[bestMatch.questionHash];
      originalEntry.accessCount = (originalEntry.accessCount || 0) + 1;
      originalEntry.lastAccessed = Date.now();
      this.isDirty = true;
      
      // Update metrics
      this.metrics.hits++;
      this.metrics.similarityMatches++;
      
      return bestMatch;
    }
    
    // No match found
    this.metrics.misses++;
    return null;
  }

  /**
   * Add a question-answer pair to the cache
   * @param {string} question - The question
   * @param {string} answer - The answer
   * @param {Object} options - Additional options
   * @returns {Object} - The cached entry
   */
  async addToCache(question, answer, options = {}) {
    if (!this.enabled || !this.initialized) {
      return null;
    }
    
    // Validate inputs
    if (!question || !answer || typeof question !== 'string' || typeof answer !== 'string') {
      logger.warn('Invalid question or answer provided to addToCache');
      throw new CacheValueError('Invalid question or answer');
    }
    
    // Use mutex to prevent concurrent modifications
    return await this.addToCacheMutex.runExclusive(async () => {
      try {
        const questionHash = this.generateHash(question);
        
        // Create cache entry
        const entry = {
          questionHash,
          question,
          answer,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccessed: Date.now(),
          gameContext: options.gameContext || null
        };
        
        // Add to cache
        this.cache[questionHash] = entry;
        
        // Add to memory cache
        this.memoryCache.set(question, entry);
        
        // Update cache state
        this.size = Object.keys(this.cache).length;
        this.isDirty = true;
        
        // Prune cache if necessary
        if (this.size > this.LRU_PRUNE_THRESHOLD) {
          await this.pruneCache();
        }
        
        // Save cache to disk
        await this.saveCache();
        
        return entry;
      } catch (error) {
        logger.error('Error adding to cache', error);
        this.metrics.errors++;
        throw new CacheError('Failed to add to cache: ' + error.message);
      }
    });
  }

  /**
   * Save the cache to disk
   */
  async saveCache() {
    if (!this.enabled) return;
    
    try {
      // Create tmp file path
      const tmpPath = `${this.cachePath}.tmp`;
      
      // Write to temp file first to avoid corrupting the cache
      await fs.promises.writeFile(tmpPath, JSON.stringify(this.cache), 'utf8');
      
      // Rename temp file to cache file (atomic operation)
      await fs.promises.rename(tmpPath, this.cachePath);
      
      this.isDirty = false;
      logger.debug('Cache saved to disk');
    } catch (error) {
      logger.error('Error saving cache: ' + error.message);
      this.metrics.errors++;
      throw new CacheSaveError('Failed to save cache: ' + error.message);
    }
  }

  /**
   * Save cache to disk synchronously
   */
  saveCache_sync() {
    if (!this.enabled) return;
    
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache), 'utf8');
      this.isDirty = false;
    } catch (error) {
      logger.error('Error saving cache: ' + error.message);
      this.metrics.errors++;
      throw new CacheSaveError('Failed to save cache: ' + error.message);
    }
  }

  /**
   * Prune the cache by removing least recently used entries
   */
  async pruneCache() {
    if (!this.enabled || !this.initialized || this.size <= this.LRU_PRUNE_TARGET) {
      return;
    }
    
    try {
      // Get all entries sorted by lastAccessed (oldest first)
      const entries = Object.values(this.cache)
        .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      
      // Calculate how many entries to remove
      const removeCount = this.size - this.LRU_PRUNE_TARGET;
      
      // Remove oldest entries
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        const entry = entries[i];
        delete this.cache[entry.questionHash];
        this.memoryCache.delete(entry.question);
      }
      
      // Update cache state
      this.size = Object.keys(this.cache).length;
      this.isDirty = true;
      
      logger.info(`Pruned total of ${removeCount} entries from cache, new size: ${this.size}/${this.maxSize}`);
    } catch (error) {
      logger.error('Error pruning cache', error);
      this.metrics.errors++;
    }
  }

  /**
   * Ensure the cached size is consistent with the actual number of entries
   */
  ensureSizeConsistency() {
    if (!this.enabled || !this.initialized) return;
    
    const actualSize = Object.keys(this.cache).length;
    if (this.size !== actualSize) {
      logger.warn(`Correcting cache size inconsistency: tracked=${this.size}, actual=${actualSize}`);
      this.size = actualSize;
    }
    return actualSize;
  }

  /**
   * Save the cache if it has been modified
   */
  async saveIfDirtyAsync() {
    if (!this.enabled || !this.isDirty) return;
    
    try {
      await this.saveCache();
    } catch (error) {
      logger.warn('Failed to save cache during routine save: ' + error.message);
      this.metrics.errors++;
    }
  }

  /**
   * Save the cache if it has been modified (synchronous version)
   */
  saveIfDirty() {
    if (!this.enabled || !this.isDirty) return;
    
    try {
      this.saveCache_sync();
    } catch (error) {
      logger.warn('Failed to save cache during routine save: ' + error.message);
      this.metrics.errors++;
    }
  }

  /**
   * Perform maintenance tasks on the cache
   */
  async maintain() {
    if (!this.enabled || !this.initialized) return;
    
    // Save if dirty
    await this.saveIfDirtyAsync();
    
    // Prune if necessary
    if (this.size > this.LRU_PRUNE_THRESHOLD) {
      await this.pruneCache();
    }
  }

  /**
   * LRU Pruning
   */
  async pruneLRU(targetSize = this.LRU_PRUNE_TARGET) {
    if (!this.enabled || !this.initialized) return;
    
    this.ensureSizeConsistency();
    
    if (this.size <= targetSize) return;
    
    // Calculate how many entries to remove
    const removeCount = this.size - targetSize;
    
    // Get all entries sorted by lastAccessed (oldest first)
    const entries = Object.values(this.cache)
      .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
    
    // Remove oldest entries
    let removedCount = 0;
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const entry = entries[i];
      delete this.cache[entry.questionHash];
      this.memoryCache.delete(entry.question);
      removedCount++;
    }
    
    // Update cache state
    this.size = Object.keys(this.cache).length;
    this.isDirty = true;
    
    logger.info(`LRU eviction: removed ${removedCount} least recently used entries from cache (target: ${targetSize})`);
  }

  /**
   * Clear the cache
   */
  clear() {
    if (!this.enabled) return;
    
    this.cache = {};
    this.memoryCache.clear();
    this.size = 0;
    this.isDirty = true;
    logger.info('Cache cleared');
    
    // Save empty cache to disk
    this.saveIfDirtyAsync().catch(err => {
      logger.error('Failed to save empty cache after clear', err);
    });
  }

  /**
   * Reset cache metrics
   */
  resetMetrics() {
    if (!this.enabled) return;
    
    this.metrics = {
      hits: 0,
      misses: 0,
      exactMatches: 0,
      similarityMatches: 0,
      memoryHits: 0,
      errors: 0,
      lastReset: Date.now()
    };
    
    logger.info('Cache metrics have been reset');
  }

  /**
   * Get cache hit rate statistics
   * @returns {Object} Hit rate statistics
   */
  getHitRateStats() {
    if (!this.enabled) {
      return { disabled: true };
    }
    
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? this.metrics.hits / total : 0;
    const exactRate = this.metrics.hits > 0 ? this.metrics.exactMatches / this.metrics.hits : 0;
    const similarityRate = this.metrics.hits > 0 ? this.metrics.similarityMatches / this.metrics.hits : 0;
    const memoryRate = this.metrics.hits > 0 ? this.metrics.memoryHits / this.metrics.hits : 0;
    
    return {
      hitRate,
      exactRate,
      similarityRate,
      memoryRate,
      total,
      hits: this.metrics.hits,
      misses: this.metrics.misses
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    if (!this.enabled) {
      return { disabled: true };
    }
    
    return {
      size: this.size,
      maxSize: this.maxSize,
      memorySize: this.memoryCache.size,
      isDirty: this.isDirty,
      hitRates: this.getHitRateStats(),
      metrics: { ...this.metrics }
    };
  }

  /**
   * Reset the cache (for testing)
   */
  resetCache() {
    this.cache = {};
    this.memoryCache.clear();
    this.initialized = false;
    this.isDirty = false;
    this.size = 0;
    this._initializeMetrics();
  }

  /**
   * Cleanup resources before shutdown
   */
  async cleanup() {
    if (!this.enabled) return;
    
    // Save any pending changes
    if (this.isDirty) {
      try {
        await this.saveCache();
      } catch (error) {
        logger.error('Failed to save cache during cleanup', error);
      }
    }
  }

  /**
   * Method to refresh a stale cache entry
   * @param {string} questionHash - Hash of the question to refresh
   * @param {string} newAnswer - New answer to store
   * @returns {Object} Updated cache entry
   */
  async refreshCacheEntry(questionHash, newAnswer) {
    if (!this.enabled || !this.initialized) {
      return null;
    }
    
    if (!this.cache[questionHash]) {
      throw new CacheError(`Cannot refresh non-existent cache entry: ${questionHash}`);
    }
    
    const entry = this.cache[questionHash];
    entry.answer = newAnswer;
    entry.timestamp = Date.now();
    delete entry.needsRefresh;
    this.isDirty = true;
    
    // Update memory cache
    this.memoryCache.set(entry.question, entry);
    
    // Save the updated cache
    await this.saveCache();
    
    return entry;
  }

  /**
   * For compatibility with the complex implementation
   */
  setupInvertedIndex() {
    // No-op in this simplified implementation
  }

  /**
   * For compatibility with the complex implementation
   */
  setupInMemoryCache() {
    // No-op in this simplified implementation
  }
}

// Export the singleton instance
const cacheServiceInstance = new CacheService();
module.exports = cacheServiceInstance;

// Also export the class and errors
module.exports.CacheService = CacheService;
module.exports.CacheSaveError = CacheSaveError;
module.exports.CacheReadError = CacheReadError;
module.exports.CacheError = CacheError;
module.exports.CacheInitializationError = CacheInitializationError;
module.exports.CacheValueError = CacheValueError;
