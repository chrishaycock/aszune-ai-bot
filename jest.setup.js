/**
 * Jest setup file - runs before tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = 'test-key';
process.env.DISCORD_BOT_TOKEN = 'test-token';

// Set log level for tests - override with DEBUG for verbose output
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

// Set cache-related environment variables for tests
process.env.ASZUNE_ENABLE_SMART_CACHE = 'true';
process.env.ASZUNE_CACHE_SAVE_INTERVAL_MS = '10000';
process.env.ASZUNE_CACHE_REFRESH_THRESHOLD_MS = '86400000'; // 1 day in ms
process.env.ASZUNE_CACHE_SIMILARITY_THRESHOLD = '0.85';
process.env.ASZUNE_MAX_CACHE_SIZE = '100';
process.env.ASZUNE_LRU_PRUNE_THRESHOLD = '90';
process.env.ASZUNE_LRU_PRUNE_TARGET = '75';
process.env.ASZUNE_MEMORY_CACHE_SIZE = '50';

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Reset modules between tests
beforeEach(() => {
  jest.resetModules();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Global test timeouts
jest.setTimeout(10000);

// Create output directory for JUnit test results
const fs = require('fs');

// Define JUnit output directory
const junitOutputDir = process.env.JEST_JUNIT_OUTPUT_DIR || './test-results';

// Create the directory if it doesn't exist
try {
  if (!fs.existsSync(junitOutputDir)) {
    fs.mkdirSync(junitOutputDir, { recursive: true });
    // eslint-disable-next-line no-console
    console.log(`Created JUnit output directory: ${junitOutputDir}`);
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`Error creating JUnit output directory: ${error.message}`);
}
