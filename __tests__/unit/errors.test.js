/**
 * Tests for custom error classes
 */
const { 
  AszaiBotError,
  CacheError,
  CacheInitializationError,
  CacheSaveError,
  CacheReadError,
  CacheValueError,
  ApiError,
  RateLimitError
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('AszaiBotError', () => {
    it('creates a base error with proper name', () => {
      const error = new AszaiBotError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AszaiBotError');
      expect(error.message).toBe('Test error');
    });
  });
  
  describe('CacheError', () => {
    it('creates a cache error with details', () => {
      const details = { key: 'value' };
      const error = new CacheError('Cache failed', details);
      expect(error).toBeInstanceOf(AszaiBotError);
      expect(error.name).toBe('CacheError');
      expect(error.message).toBe('Cache failed');
      expect(error.details).toEqual(details);
    });
    
    it('handles missing details', () => {
      const error = new CacheError('Cache failed');
      expect(error.details).toEqual({});
    });
  });
  
  describe('Specific Cache Errors', () => {
    it('creates a CacheInitializationError', () => {
      const error = new CacheInitializationError('Init failed', { path: '/temp' });
      expect(error).toBeInstanceOf(CacheError);
      expect(error.name).toBe('CacheInitializationError');
      expect(error.details).toEqual({ path: '/temp' });
    });
    
    it('creates a CacheSaveError', () => {
      const error = new CacheSaveError('Save failed', { path: '/temp' });
      expect(error).toBeInstanceOf(CacheError);
      expect(error.name).toBe('CacheSaveError');
    });
    
    it('creates a CacheReadError', () => {
      const error = new CacheReadError('Read failed', { path: '/temp' });
      expect(error).toBeInstanceOf(CacheError);
      expect(error.name).toBe('CacheReadError');
    });
    
    it('creates a CacheValueError', () => {
      const error = new CacheValueError('Invalid value', { value: null });
      expect(error).toBeInstanceOf(CacheError);
      expect(error.name).toBe('CacheValueError');
    });
  });
  
  describe('ApiError', () => {
    it('creates an API error with status code and response', () => {
      const response = { error: 'Not found' };
      const error = new ApiError('API error', 404, response);
      expect(error).toBeInstanceOf(AszaiBotError);
      expect(error.name).toBe('ApiError');
      expect(error.statusCode).toBe(404);
      expect(error.response).toEqual(response);
    });
    
    it('handles missing response', () => {
      const error = new ApiError('API error', 500);
      expect(error.statusCode).toBe(500);
      expect(error.response).toBeNull();
    });
  });
  
  describe('RateLimitError', () => {
    it('creates a rate limit error with retry-after value', () => {
      const error = new RateLimitError('Too many requests', 30);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(30);
    });
    
    it('handles missing retry-after value', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.retryAfter).toBeNull();
    });
  });
});
