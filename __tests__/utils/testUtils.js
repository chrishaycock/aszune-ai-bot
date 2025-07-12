/**
 * Test utilities and mocks
 * This file contains utility functions for testing the Discord bot
 * See __tests__/unit/testUtils.test.js for the consolidated tests of these utilities
 */
const mockReply = jest.fn().mockResolvedValue({});
const mockReact = jest.fn().mockResolvedValue({});
const mockSendTyping = jest.fn().mockResolvedValue({});

/**
 * Create a mock Discord message
 * @param {Object} options - Options for the mock message
 * @returns {Object} - Mock message object
 */
function createMockMessage(options = {}) {
  // Extract only expected properties to avoid overriding critical mock properties
  const { content, isBot, userId, ...safeOptions } = options;
  
  return {
    content: content || '',
    author: {
      bot: isBot || false,
      id: userId || '12345',
    },
    reply: mockReply,
    react: mockReact,
    channel: {
      sendTyping: mockSendTyping,
    },
    ...safeOptions, // Spread remaining safe properties
  };
}

/**
 * Reset all mocks
 */
function resetMocks() {
  mockReply.mockReset();
  mockReact.mockReset();
  mockSendTyping.mockReset();
}

/**
 * Create a mock interaction
 * @param {Object} options - Options for the mock interaction
 * @returns {Object} - Mock interaction object
 */
function createMockInteraction(options = {}) {
  return {
    user: {
      id: options.userId || '12345',
    },
    commandName: options.commandName || 'help',
    isChatInputCommand: () => true,
    reply: mockReply,
    deferReply: jest.fn(),
    editReply: jest.fn(),
    ...options,
  };
}

module.exports = {
  mockReply,
  mockReact,
  mockSendTyping,
  createMockMessage,
  createMockInteraction,
  resetMocks,
};
