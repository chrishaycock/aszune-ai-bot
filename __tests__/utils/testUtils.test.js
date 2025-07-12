const {
  createMockMessage,
  createMockInteraction,
  resetMocks,
  mockReply,
  mockReact,
  mockSendTyping,
} = require('../../src/utils/testUtils');

describe('Test Utilities', () => {
  afterEach(() => {
    resetMocks();
  });

  describe('createMockMessage', () => {
    it('should create a default mock message', () => {
      const message = createMockMessage();
      expect(message.content).toBe('');
      expect(message.author.bot).toBe(false);
      expect(message.author.id).toBe('12345');
      expect(message.reply).toBeDefined();
      expect(message.react).toBeDefined();
      expect(message.channel.sendTyping).toBeDefined();
    });

    it('should create a mock message with custom content', () => {
      const message = createMockMessage({ content: 'hello' });
      expect(message.content).toBe('hello');
    });

    it('should create a mock message from a bot', () => {
      const message = createMockMessage({ isBot: true });
      expect(message.author.bot).toBe(true);
    });

    it('should create a mock message with a custom user ID', () => {
      const message = createMockMessage({ userId: '67890' });
      expect(message.author.id).toBe('67890');
    });
  });

  describe('createMockInteraction', () => {
    it('should create a default mock interaction', () => {
      const interaction = createMockInteraction();
      expect(interaction.user.id).toBe('12345');
      expect(interaction.commandName).toBe('help');
      expect(interaction.isChatInputCommand()).toBe(true);
      expect(interaction.reply).toBeDefined();
      expect(interaction.deferReply).toBeDefined();
      expect(interaction.editReply).toBeDefined();
    });

    it('should create a mock interaction with a custom user ID', () => {
      const interaction = createMockInteraction({ userId: '67890' });
      expect(interaction.user.id).toBe('67890');
    });

    it('should create a mock interaction with a custom command name', () => {
      const interaction = createMockInteraction({ commandName: 'ping' });
      expect(interaction.commandName).toBe('ping');
    });
  });

  describe('resetMocks', () => {
    it('should reset all mocks', () => {
      const message = createMockMessage({ content: 'test' });
      message.reply('a reply');
      message.react('👍');
      message.channel.sendTyping();

      expect(mockReply).toHaveBeenCalledWith('a reply');
      expect(mockReact).toHaveBeenCalledWith('👍');
      expect(mockSendTyping).toHaveBeenCalled();

      resetMocks();

      expect(mockReply).not.toHaveBeenCalled();
      expect(mockReact).not.toHaveBeenCalled();
      expect(mockSendTyping).not.toHaveBeenCalled();
    });
  });
});
