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
        logger.error('Failed to read cache file, creating new empty cache', readError);
        this.cache = {};
        fs.writeFileSync(this.cachePath, '{}', 'utf8');
      }
      
      this.initialized = true;
    } catch (error) {
      logger.error('Cache initialization error', error);
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
   * @returns {Object} - The cached entry
   */
  async addToCache(question, answer) {
    if (!this.enabled || !this.initialized) {
      return null;
    }
    
    // Validate inputs
    if (!question || !answer || typeof question !== 'string' || typeof answer !== 'string') {
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
          lastAccessed: Date.now()
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
   * Prune cache by removing least recently used entries
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
      
      logger.info(`Pruned ${removeCount} entries from cache. New size: ${this.size}`);
    } catch (error) {
      logger.error('Error pruning cache', error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Save cache to disk
   */
  async saveCache() {
    if (!this.enabled || !this.isDirty) {
      return;
    }
    
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
      logger.error('Failed to save cache to disk', error);
      this.metrics.errors++;
      throw new CacheSaveError('Failed to save cache: ' + error.message);
    }
  }
  
  /**
   * Reset cache metrics
   */
  resetMetrics() {
    if (!this.enabled) {
      return;
    }
    
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
   * Get cache metrics
   * @returns {Object} - Cache metrics
   */
  getMetrics() {
    if (!this.enabled) {
      return { disabled: true };
    }
    
    return {
      ...this.metrics,
      size: this.size,
      memorySize: this.memoryCache.size,
      hitRatio: this.metrics.hits / (this.metrics.hits + this.metrics.misses || 1)
    };
  }
  
  /**
   * Clear the cache (for testing purposes)
   */
  clear() {
    if (!this.enabled) {
      return;
    }
    
    this.cache = {};
    this.memoryCache.clear();
    this.size = 0;
    this.isDirty = true;
    
    // Save empty cache to disk
    this.saveCache().catch(err => {
      logger.error('Failed to save empty cache after clear', err);
    });
  }
}

module.exports = {
  CacheService,
  CacheSaveError,
  CacheReadError,
  CacheError,
  CacheInitializationError,
  CacheValueError
};
