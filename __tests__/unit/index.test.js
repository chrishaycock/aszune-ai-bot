// To keep a single client instance that can be referenced across the test file
const { EventEmitter } = require('events');
const mockClientInstance = new EventEmitter();
mockClientInstance.user = { id: 'test-user-id', tag: 'test-user#1234' };
mockClientInstance.login = jest.fn().mockResolvedValue('Logged in');
mockClientInstance.destroy = jest.fn().mockResolvedValue();

// This will hold the mock `put` function from the REST instance, allowing us to track its usage
let mockPutMethod;

jest.mock('discord.js', () => {
  const mockPut = jest.fn().mockResolvedValue([]);
  mockPutMethod = mockPut; // Assign the mock function to the outer variable so the test can access it

  const REST = jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: mockPut,
  }));

  return {
    Client: jest.fn(() => mockClientInstance),
    GatewayIntentBits: {
      Guilds: 'GUILDS',
      GuildMessages: 'GUILD_MESSAGES',
      MessageContent: 'MESSAGE_CONTENT',
    },
    REST,
    Routes: {
      applicationCommands: jest.fn(() => '/application-commands'),
    },
  };
});

jest.mock('@discordjs/builders', () => ({
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({ name: 'test', description: 'a test command' }),
  })),
}));

jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
    },
  },
  COMMAND_PREFIX: '!',
  RATE_LIMIT_SECONDS: 30,
  MAX_CONVERSATION_LENGTH: 20,
  GUILD_ID: 'test-guild-id',
}));
jest.mock('../../src/services/chat');
jest.mock('../../src/commands', () => ({
  getSlashCommandsData: jest.fn(),
  handleSlashCommand: jest.fn(),
}));
jest.mock('../../src/utils/conversation', () => ({
  destroy: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/utils/logger');


describe('Bot Main Entry Point (index.js)', () => {
  let Client, GatewayIntentBits, REST;
  let chatService;
  let commandHandler;
  let conversationManager;
  let logger;
  let originalProcessOn;
  let processHandlers;

  beforeAll(() => {
    originalProcessOn = process.on;
    processHandlers = new Map();
    process.on = jest.fn((event, handler) => {
      processHandlers.set(event, handler);
    });
    process.exit = jest.fn();
  });

  afterAll(() => {
    process.on = originalProcessOn;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    mockClientInstance.removeAllListeners();
    
    ({ Client, GatewayIntentBits, REST } = require('discord.js'));
    chatService = require('../../src/services/chat');
    commandHandler = require('../../src/commands');
    conversationManager = require('../../src/utils/conversation');
    logger = require('../../src/utils/logger');

    commandHandler.getSlashCommandsData.mockReturnValue([{ name: 'test', description: 'a test command' }]);

    require('../../src/index');
  });

  it('should create a Discord client with the correct intents', () => {
    expect(Client).toHaveBeenCalledWith({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  });

  it('should log in the client', () => {
    expect(mockClientInstance.login).toHaveBeenCalledWith('test-token');
  });

  describe('Event Handlers', () => {
    it('should handle the "ready" event and register slash commands', async () => {
      await mockClientInstance.emit('ready');

      expect(logger.info).toHaveBeenCalledWith('Discord bot is online as test-user#1234!');
      expect(commandHandler.getSlashCommandsData).toHaveBeenCalled();
      expect(mockPutMethod).toHaveBeenCalled();
    });

    it('should handle the "messageCreate" event', () => {
      const message = { content: 'hello' };
      mockClientInstance.emit('messageCreate', message);
      expect(chatService.handleChatMessage).toHaveBeenCalledWith(message);
    });

    it('should handle the "interactionCreate" event for a slash command', async () => {
      const interaction = { isChatInputCommand: () => true };
      await mockClientInstance.emit('interactionCreate', interaction);
      expect(commandHandler.handleSlashCommand).toHaveBeenCalledWith(interaction);
    });

    it('should ignore non-slash command interactions', async () => {
      const interaction = { isChatInputCommand: () => false };
      await mockClientInstance.emit('interactionCreate', interaction);
      expect(commandHandler.handleSlashCommand).not.toHaveBeenCalled();
    });

    it('should handle the "error" event', () => {
      const error = new Error('Test Error');
      mockClientInstance.emit('error', error);
      expect(logger.error).toHaveBeenCalledWith('Discord client error:', error);
    });

    it('should handle the "warn" event', () => {
      const info = 'Test Warning';
      mockClientInstance.emit('warn', info);
      expect(logger.warn).toHaveBeenCalledWith('Discord client warning:', info);
    });
  });

  describe('Process Signal Handlers', () => {
    it('should handle SIGINT', async () => {
      const sigintHandler = processHandlers.get('SIGINT');
      expect(sigintHandler).toBeDefined();
      await sigintHandler();
      expect(logger.info).toHaveBeenCalledWith('Shutting down...');
      expect(mockClientInstance.destroy).toHaveBeenCalled();
      expect(conversationManager.destroy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGTERM', async () => {
      const sigtermHandler = processHandlers.get('SIGTERM');
      expect(sigtermHandler).toBeDefined();
      await sigtermHandler();
      expect(logger.info).toHaveBeenCalledWith('Shutting down...');
      expect(mockClientInstance.destroy).toHaveBeenCalled();
      expect(conversationManager.destroy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle errors during shutdown for SIGINT', async () => {
      const error = new Error('Shutdown error');
      mockClientInstance.destroy.mockRejectedValueOnce(error);
      
      const sigintHandler = processHandlers.get('SIGINT');
      expect(sigintHandler).toBeDefined();
      await sigintHandler();
      
      expect(logger.error).toHaveBeenCalledWith('Error during shutdown:', error);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle unhandledRejection', () => {
      const error = new Error('Unhandled Rejection');
      const unhandledRejectionHandler = processHandlers.get('unhandledRejection');
      expect(unhandledRejectionHandler).toBeDefined();
      unhandledRejectionHandler(error);
      expect(logger.error).toHaveBeenCalledWith('Unhandled promise rejection:', error);
    });
  });
});
