/**
 * Tests for logger utility
 */

describe('Logger', () => {
  // Save and restore console methods
  // eslint-disable-next-line no-console
  const originalConsoleLog = console.log;
  // eslint-disable-next-line no-console
  const originalConsoleWarn = console.warn;
  // eslint-disable-next-line no-console
  const originalConsoleError = console.error;
  
  // Save original log level
  let originalLogLevel;
  let originalNodeEnv;
  let logger;
  
  beforeEach(() => {
    // Mock console methods
    // eslint-disable-next-line no-console
    console.log = jest.fn();
    // eslint-disable-next-line no-console
    console.warn = jest.fn();
    // eslint-disable-next-line no-console
    console.error = jest.fn();
    
    // Save original environment
    originalLogLevel = process.env.LOG_LEVEL;
    originalNodeEnv = process.env.NODE_ENV;
    
    // Default for most tests
    process.env.LOG_LEVEL = 'DEBUG';
    
    // Reset logger module to pick up new environment
    jest.resetModules();
    
    // Import logger after setting environment
    logger = require('../../src/utils/logger');
  });
  
  afterEach(() => {
    // Restore console methods
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
    // eslint-disable-next-line no-console
    console.warn = originalConsoleWarn;
    // eslint-disable-next-line no-console
    console.error = originalConsoleError;
    
    // Restore original environment
    process.env.LOG_LEVEL = originalLogLevel;
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  // Test different log level initializations
  describe('Constructor log level initialization', () => {
    it('uses explicit LOG_LEVEL when provided', () => {
      delete process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'ERROR';
      jest.resetModules();
      const testLogger = require('../../src/utils/logger');
      
      testLogger.debug('Should not log');
      testLogger.info('Should not log');
      testLogger.warn('Should not log');
      testLogger.error('Should log');
      
      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.warn).not.toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
    });
    
    it('uses INFO level for test environment by default', () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = 'test';
      jest.resetModules();
      const testLogger = require('../../src/utils/logger');
      
      testLogger.debug('Should not log');
      testLogger.info('Should log');
      
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(1);
      // First call should be info, not debug
      // eslint-disable-next-line no-console
      expect(console.log.mock.calls[0][0]).toContain('[INFO]');
    });
    
    it('uses INFO level for production environment by default', () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      const testLogger = require('../../src/utils/logger');
      
      testLogger.debug('Should not log');
      testLogger.info('Should log');
      
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(1);
      // First call should be info, not debug
      // eslint-disable-next-line no-console
      expect(console.log.mock.calls[0][0]).toContain('[INFO]');
    });
    
    it('uses DEBUG level for development (default) environment', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.NODE_ENV; // Default to development
      jest.resetModules();
      const testLogger = require('../../src/utils/logger');
      
      testLogger.debug('Should log');
      
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
    });
    
    it('handles invalid LOG_LEVEL by defaulting to INFO', () => {
      process.env.LOG_LEVEL = 'INVALID_LEVEL';
      jest.resetModules();
      const testLogger = require('../../src/utils/logger');
      
      testLogger.debug('Should not log');
      testLogger.info('Should log');
      
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-console
      expect(console.log.mock.calls[0][0]).toContain('[INFO]');
    });
  });
  
  it('logs debug messages', () => {
    logger.debug('Test debug message');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Test debug message');
  });
  
  it('logs debug messages with data', () => {
    const testData = { test: 'data' };
    logger.debug('Test debug message', testData);
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Test debug message');
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[1][0]).toEqual(testData);
  });
  
  it('logs info messages', () => {
    logger.info('Test info message');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[0][0]).toContain('[INFO] Test info message');
  });
  
  it('logs warning messages', () => {
    logger.warn('Test warning message');
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.warn.mock.calls[0][0]).toContain('[WARN] Test warning message');
  });
  
  it('logs error messages', () => {
    logger.error('Test error message');
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Test error message');
  });
  
  it('logs error messages with error object', () => {
    const testError = new Error('Test error');
    logger.error('Test error message', testError);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Test error message');
  });
  
  it('handles API errors', () => {
    const apiError = {
      response: {
        status: 404,
        data: { error: 'Not found' }
      }
    };
    logger.error('API error', apiError);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][0]).toBe('API Error Response:');
  });
  
  it('handles request errors with no response', () => {
    const requestError = {
      request: {
        path: '/api/test'
      },
      message: 'Request failed'
    };
    logger.error('Request error', requestError);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][0]).toBe('No response received from API:');
  });
  
  it('handles general errors with stack trace', () => {
    const generalError = new Error('General error');
    logger.error('General error', generalError);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledTimes(3);
    // Check error message logged
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][0]).toBe('Error:');
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][1]).toBe('General error');
    // Check stack trace logged
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[2][0]).toBe('Stack:');
  });
  
  it('handles general errors without stack trace', () => {
    const errorWithoutStack = { message: 'Error without stack' };
    logger.error('No stack error', errorWithoutStack);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][0]).toBe('Error:');
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][1]).toBe('Error without stack');
  });
  
  it('provides user-friendly error messages', () => {
    const message = logger.handleError(new Error('Some error'), 'test context');
    expect(message).toContain('There was an error');
  });
  
  it('customizes error messages based on error type', () => {
    // All errors should return a user-friendly message
    const error429 = new Error('429 error');
    error429.message = 'Request failed with status code 429';
    let message = logger.handleError(error429, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    expect(message).toContain('busy');
    
    // Auth error
    const error401 = new Error('401 error');
    error401.message = 'Request failed with status code 401';
    message = logger.handleError(error401, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    expect(message).toContain('Authentication');
    
    // Auth error with 403
    const error403 = new Error('403 error');
    error403.message = 'Request failed with status code 403';
    message = logger.handleError(error403, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    expect(message).toContain('Authentication');
    
    // Timeout error - check the actual string in the logger.js file
    const errorTimeout = new Error('timeout');
    errorTimeout.message = 'Request failed with status code 504';
    message = logger.handleError(errorTimeout, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    expect(message).toContain('timed out');
    
    // Gateway timeout error
    const error504 = new Error('504 error');
    error504.message = 'Request failed with status code 504';
    message = logger.handleError(error504, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    // This is the actual message from the logger.js implementation
    expect(message).toContain('timed out');

    // Generic error case
    const genericError = new Error('Some other error');
    message = logger.handleError(genericError, 'test');
    expect(typeof message).toBe('string');
    expect(message).toContain('There was an error');
  });
  
  // Test log level filtering
  describe('Log level filtering', () => {
    beforeEach(() => {
      // Set log level to WARN
      process.env.LOG_LEVEL = 'WARN';
      jest.resetModules();
      logger = require('../../src/utils/logger');
    });
    
    it('does not log debug messages when log level is WARN', () => {
      logger.debug('Debug message should not be logged');
      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled();
    });
    
    it('does not log info messages when log level is WARN', () => {
      logger.info('Info message should not be logged');
      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled();
    });
    
    it('logs warn messages when log level is WARN', () => {
      logger.warn('Warn message should be logged');
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalled();
    });
    
    it('logs error messages when log level is WARN', () => {
      logger.error('Error message should be logged');
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  // Test SILENT log level
  describe('SILENT log level', () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = 'SILENT';
      jest.resetModules();
      logger = require('../../src/utils/logger');
    });
    
    it('does not log any messages when log level is SILENT', () => {
      logger.debug('Should not log');
      logger.info('Should not log');
      logger.warn('Should not log');
      logger.error('Should not log');
      
      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.warn).not.toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.error).not.toHaveBeenCalled();
    });
  });
  
  // Test handleError with no parameters
  it('handles errors with default context', () => {
    jest.resetAllMocks(); // Reset mocks to start with clean state

    const error = new Error('Generic error');
    const message = logger.handleError(error); // No context provided
    expect(message).toContain('There was an error');
    
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Error in :');
  });

  // Test additional error handling branches
  describe('Additional error logging branches', () => {
    it('handles API errors with missing data property', () => {
      jest.resetAllMocks(); // Reset mocks to start with clean state
      
      const apiErrorNoData = {
        response: {
          status: 500
          // No data property
        }
      };
      logger.error('API error no data', apiErrorNoData);
      
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
      // eslint-disable-next-line no-console
      expect(console.error.mock.calls[1][0]).toBe('API Error Response:');
      // The logged object should contain status but undefined data
      // eslint-disable-next-line no-console
      expect(console.error.mock.calls[1][1].status).toBe(500);
    });
    
    it('handles null error objects', () => {
      // Some code might pass null as the error
      logger.error('Null error test', null);
      
      // Should only log the main error message, not attempt to access properties
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-console
      expect(console.error.mock.calls[0][0]).toContain('[ERROR] Null error test');
    });
    
    it('handles undefined error objects', () => {
      // Some code might call error without the second parameter
      logger.error('Undefined error test');
      
      // Should only log the main error message, not attempt to access properties
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-console
      expect(console.error.mock.calls[0][0]).toContain('[ERROR] Undefined error test');
    });
    
    it('handles error objects without message property', () => {
      const errorNoMessage = { code: 'ERR_UNKNOWN' };
      logger.error('Error without message', errorNoMessage);
      
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledTimes(2);
      // Should log the entire error object since no message property exists
      // eslint-disable-next-line no-console
      expect(console.error.mock.calls[1][1]).toEqual(errorNoMessage);
    });
  });
  
  // Test timeout errors specifically
  it('handles timeout error messages correctly', () => {
    // Test error with timeout in message - actual implementation matches timeout
    const timeoutError = new Error('timeout');
    const message1 = logger.handleError(timeoutError, 'test');
    expect(message1).toContain('timed out');
    
    // Test error with 504 status code - should trigger timeout message
    const gatewayTimeoutError = new Error('Request failed with status code 504');
    const message3 = logger.handleError(gatewayTimeoutError, 'test');
    expect(message3).toContain('timed out');
  });
  
  // Test network error detection - Currently generic error messages are returned
  it('handles network errors correctly', () => {
    // ENOTFOUND error (DNS resolution failure)
    const dnsError = new Error('getaddrinfo ENOTFOUND api.example.com');
    dnsError.code = 'ENOTFOUND';
    const message1 = logger.handleError(dnsError, 'test');
    expect(message1).toEqual('There was an error processing your request. Please try again later.');
    
    // ECONNREFUSED error
    const connRefusedError = new Error('connect ECONNREFUSED');
    connRefusedError.code = 'ECONNREFUSED';
    const message2 = logger.handleError(connRefusedError, 'test');
    expect(message2).toEqual('There was an error processing your request. Please try again later.');
    
    // ECONNRESET error
    const connResetError = new Error('socket hang up');
    connResetError.code = 'ECONNRESET';
    const message3 = logger.handleError(connResetError, 'test');
    expect(message3).toEqual('There was an error processing your request. Please try again later.');
    
    // Network error in message
    const networkMsgError = new Error('Network Error');
    const message4 = logger.handleError(networkMsgError, 'test');
    expect(message4).toEqual('There was an error processing your request. Please try again later.');
  });
  
  // Test error message formatting with error codes
  it('formats errors with status codes correctly', () => {
    // 400 error
    const error400 = new Error('400 error');
    error400.message = 'Request failed with status code 400';
    const message400 = logger.handleError(error400, 'test');
    expect(message400).toEqual('There was an error processing your request. Please try again later.');
    
    // 500 error
    const error500 = new Error('500 error');
    error500.message = 'Request failed with status code 500';
    const message500 = logger.handleError(error500, 'test');
    expect(message500).toEqual('There was an error processing your request. Please try again later.');
    
    // 502 error
    const error502 = new Error('502 error');
    error502.message = 'Request failed with status code 502';
    const message502 = logger.handleError(error502, 'test');
    expect(message502).toEqual('There was an error processing your request. Please try again later.');
  });
  
  // Test the _formatMessage method by checking timestamp format
  it('formats log messages with timestamp and level', () => {
    // Access the private method through the instance
    // eslint-disable-next-line no-underscore-dangle
    const formatted = logger._formatMessage('TEST', 'Test message');
    
    // Check timestamp format [YYYY-MM-DDThh:mm:ss.sssZ]
    expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[TEST\] Test message$/);
  });
  
  // Test handling errors with response but no status
  it('handles API errors with response but no status', () => {
    const apiErrorNoStatus = {
      response: {
        // No status property
        data: { message: 'Error message from API' }
      }
    };
    logger.error('API error no status', apiErrorNoStatus);
    
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][0]).toBe('API Error Response:');
  });
});
