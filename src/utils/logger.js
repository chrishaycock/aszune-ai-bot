/**
 * Utility for logging and error handling
 */
class Logger {
  constructor() {
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      SILENT: 4, // Added SILENT level for tests
    };
    
    // Set log level based on environment
    if (process.env.LOG_LEVEL) {
      // Use explicit log level if provided
      const level = this.levels[process.env.LOG_LEVEL.toUpperCase()];
      this.logLevel = level !== undefined ? level : this.levels.INFO;
    } else if (process.env.NODE_ENV === 'test') {
      // Use INFO level in tests by default but allow override through LOG_LEVEL
      this.logLevel = this.levels.INFO;
    } else if (process.env.NODE_ENV === 'production') {
      this.logLevel = this.levels.INFO;
    } else {
      this.logLevel = this.levels.DEBUG;
    }
  }
  
  /**
   * Format a log message with timestamp
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @returns {string} - Formatted log message
   */
  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }
  
  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  debug(message, data) {
    if (this.logLevel <= this.levels.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(this._formatMessage('DEBUG', message));
      // eslint-disable-next-line no-console
      if (data) console.log(data);
    }
  }
  
  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  info(message, data) {
    if (this.logLevel <= this.levels.INFO) {
      // eslint-disable-next-line no-console
      console.log(this._formatMessage('INFO', message));
      // eslint-disable-next-line no-console
      if (data) console.log(data);
    }
  }
  
  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  warn(message, data) {
    if (this.logLevel <= this.levels.WARN) {
      // eslint-disable-next-line no-console
      console.warn(this._formatMessage('WARN', message));
      // eslint-disable-next-line no-console
      if (data) console.warn(data);
    }
  }
  
  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   */
  error(message, error) {
    if (this.logLevel <= this.levels.ERROR) {
      // eslint-disable-next-line no-console
      console.error(this._formatMessage('ERROR', message));
      
      if (error) {
        if (error.response) {
          // API error with response
          // eslint-disable-next-line no-console
          console.error('API Error Response:', {
            status: error.response.status,
            data: error.response.data,
          });
        } else if (error.request) {
          // No response received
          // eslint-disable-next-line no-console
          console.error('No response received from API:', error.request);
        } else {
          // General error
          // eslint-disable-next-line no-console
          console.error('Error:', error.message || error);
          // eslint-disable-next-line no-console
          if (error.stack) console.error('Stack:', error.stack);
        }
      }
    }
  }
  
  /**
   * Handle an error and return a user-friendly message
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @returns {string} - User-friendly error message
   */
  handleError(error, context = '') {
    let userMessage = 'There was an error processing your request. Please try again later.';
    
    // Log the error
    this.error(`Error in ${context}:`, error);
    
    // Customize message based on error type
    if (error.message.includes('429')) {
      userMessage = 'The service is currently busy. Please try again in a few moments.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
      userMessage = 'Authentication error. Please contact an administrator.';
    } else if (error.message.includes('504') || error.message.includes('timeout')) {
      userMessage = 'The request timed out. Please try again with a shorter message.';
    }
    
    return userMessage;
  }
}

module.exports = new Logger();
