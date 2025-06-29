/**
 * Cache service for storing and retrieving frequently asked questions
 * Reduces API token usage by serving cached responses when possible
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config/config');

// Cache settings
const CACHE_REFRESH_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const SIMILARITY_THRESHOLD = 0.85; // Minimum similarity score to consider a cache hit
const DEFAULT_CACHE_PATH = path.join(process.cwd(), 'data', 'question_cache.json');

class CacheService {
  constructor() {
    this.cache = {};
    this.initialized = false;
    this.cachePath = DEFAULT_CACHE_PATH;
  }

  /**
   * Initialize the cache from disk
   * @param {string} customPath - Optional custom path for the cache file (used for testing)
   */
  init(customPath) {
    if (this.initialized) return;
    
    // Allow using a custom path for testing
    if (customPath) {
      this.cachePath = customPath;
    }
    
    try {
      // Create cache file if it doesn't exist
      if (!fs.existsSync(this.cachePath)) {
        this.saveCache();
      } else {
        const cacheData = fs.readFileSync(this.cachePath, 'utf8');
        this.cache = JSON.parse(cacheData);
      }
      this.initialized = true;
      logger.info(`Cache initialized with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      logger.error('Error initializing cache:', error);
      // Create an empty cache if there was an error
      this.cache = {};
      this.saveCache();
      this.initialized = true; // Make sure to set initialized to true even after an error
    }
  }

  /**
   * Save the cache to disk
   */
  saveCache() {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
      logger.debug('Cache saved successfully');
    } catch (error) {
      logger.error('Error saving cache:', error);
    }
  }

  /**
   * Generate a hash for a question to use as a cache key
   * @param {string} question - The question text
   * @returns {string} - A hash of the question
   */
  generateHash(question) {
    // Normalize the question: lowercase, trim whitespace, remove punctuation
    const normalizedQuestion = question.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    return crypto.createHash('md5').update(normalizedQuestion).digest('hex');
  }

  /**
   * Calculate text similarity between two strings
   * Simple implementation based on word overlap
   * @param {string} str1 - First string to compare
   * @param {string} str2 - Second string to compare
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateSimilarity(str1, str2) {
    // Normalize and tokenize
    const tokens1 = str1.toLowerCase().trim().split(/\s+/);
    const tokens2 = str2.toLowerCase().trim().split(/\s+/);
    
    // Create sets for more efficient comparison
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    // Count common words
    let commonCount = 0;
    for (const word of set1) {
      if (set2.has(word)) commonCount++;
    }
    
    // Calculate Jaccard similarity coefficient
    const uniqueCount = set1.size + set2.size - commonCount;
    return uniqueCount > 0 ? commonCount / uniqueCount : 0;
  }

  /**
   * Check if a cache entry is stale and needs refreshing
   * @param {Object} cacheEntry - The cache entry to check
   * @returns {boolean} - True if the entry is stale, false otherwise
   */
  isStale(cacheEntry) {
    const now = Date.now();
    return now - cacheEntry.timestamp > CACHE_REFRESH_THRESHOLD;
  }

  /**
   * Try to find a cached response for a question
   * @param {string} question - The question to look for
   * @param {string} gameContext - Optional game context to improve matching
   * @returns {Object|null} - The cache hit or null if no match found
   */
  findInCache(question, gameContext = null) {
    if (!this.initialized) this.init();
    
    // First try direct hash lookup
    const hash = this.generateHash(question);
    if (this.cache[hash]) {
      const entry = this.cache[hash];
      // Update access metrics
      entry.accessCount += 1;
      entry.lastAccessed = Date.now();
      this.saveCache();
      
      // If the entry is stale, return it but mark for refresh
      if (this.isStale(entry)) {
        return { 
          ...entry, 
          needsRefresh: true 
        };
      }
      return entry;
    }
    
    // If no direct hit, try similarity matching
    for (const key of Object.keys(this.cache)) {
      const entry = this.cache[key];
      const similarity = this.calculateSimilarity(question, entry.question);
      
      // Check similarity and game context if provided
      if (similarity > SIMILARITY_THRESHOLD && 
          (!gameContext || !entry.gameContext || entry.gameContext === gameContext)) {
        
        // Update access metrics
        entry.accessCount += 1;
        entry.lastAccessed = Date.now();
        this.saveCache();
        
        // If the entry is stale, return it but mark for refresh
        if (this.isStale(entry)) {
          return { 
            ...entry, 
            needsRefresh: true,
            similarity 
          };
        }
        return { ...entry, similarity };
      }
    }
    
    // No match found
    return null;
  }

  /**
   * Add or update a question-answer pair in the cache
   * @param {string} question - The question
   * @param {string} answer - The answer
   * @param {string} gameContext - Optional game context
   */
  addToCache(question, answer, gameContext = null) {
    if (!this.initialized) this.init();
    
    const hash = this.generateHash(question);
    const now = Date.now();
    
    this.cache[hash] = {
      questionHash: hash,
      question,
      answer,
      gameContext,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    };
    
    this.saveCache();
    logger.debug(`Added new entry to cache: "${question.substring(0, 30)}..."`);
  }

  /**
   * Get cache statistics
   * @returns {Object} - Statistics about the cache
   */
  getStats() {
    if (!this.initialized) this.init();
    
    const entryCount = Object.keys(this.cache).length;
    let totalAccesses = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let mostAccessedCount = 0;
    let mostAccessedQuestion = '';
    
    for (const key in this.cache) {
      const entry = this.cache[key];
      totalAccesses += entry.accessCount;
      
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
      
      if (entry.accessCount > mostAccessedCount) {
        mostAccessedCount = entry.accessCount;
        mostAccessedQuestion = entry.question;
      }
    }
    
    return {
      entryCount,
      totalAccesses,
      averageAccessesPerEntry: entryCount > 0 ? totalAccesses / entryCount : 0,
      oldestEntry: new Date(oldestTimestamp).toISOString(),
      newestEntry: new Date(newestTimestamp).toISOString(),
      mostAccessedQuestion: mostAccessedQuestion.substring(0, 50) + '...',
      mostAccessedCount
    };
  }

  /**
   * Prune old, rarely accessed entries from the cache
   * @param {number} maxAge - Maximum age in days to keep entries
   * @param {number} minAccesses - Minimum access count to keep entries regardless of age
   * @returns {number} - Number of entries removed
   */
  pruneCache(maxAge = 90, minAccesses = 5) {
    if (!this.initialized) this.init();
    
    const now = Date.now();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const key in this.cache) {
      const entry = this.cache[key];
      const age = now - entry.timestamp;
      
      // Remove if older than maxAge and accessed less than minAccesses times
      if (age > maxAgeMs && entry.accessCount < minAccesses) {
        delete this.cache[key];
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.saveCache();
      logger.info(`Pruned ${removedCount} entries from cache`);
    }
    
    return removedCount;
  }
}

module.exports = new CacheService();
