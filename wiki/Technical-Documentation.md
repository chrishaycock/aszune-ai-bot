# Technical Documentation

This page provides technical details about the architecture, code structure, and implementation of the Aszune AI Bot.

## Architecture Overview

Aszune AI Bot is built using Node.js and the Discord.js library, with the Perplexity API serving as the AI backend. The bot uses a modular architecture to separate concerns and make the codebase more maintainable.

### Core Components

1. **Discord Interface** - Handles interactions with Discord's API
2. **Command Handler** - Processes and routes commands
3. **Perplexity API Client** - Manages communication with Perplexity's API
4. **Conversation Manager** - Tracks and stores user conversations
5. **Rate Limiter** - Prevents spam and excessive API usage
6. **Emoji Manager** - Handles emoji reactions based on keywords
7. **Smart Answer Cache** - Caches frequent questions and answers to reduce API usage

## Project Structure

```
aszune-ai-bot/
├── src/
│   ├── index.js           # Main entry point
│   ├── commands/          # Command handlers
│   │   ├── clearHistory.js
│   │   ├── help.js
│   │   ├── stats.js
│   │   ├── summarise.js
│   │   └── summary.js
│   ├── config/            # Configuration settings
│   │   └── config.js      # Global configuration
│   ├── services/          # API and core services
│   │   ├── perplexityService.js
│   │   └── conversationService.js
│   └── utils/             # Utility functions and helpers
│       ├── emojiUtils.js
│       ├── rateLimiter.js
│       └── stringUtils.js
├── package.json           # Project metadata
├── package-lock.json      # Dependency lock file
├── ecosystem.config.js    # PM2 deployment config
├── .env                   # Environment secrets (not committed)
├── .gitignore             # Ignored files
├── __tests__/             # Unit and integration tests
├── __mocks__/             # Test mocks
├── jest.config.js         # Jest test configuration
├── jest.setup.js          # Jest setup file
└── coverage/              # Code coverage output
```

## Core Modules

### 1. Discord Interface (index.js)

The main entry point initializes the Discord client, sets up event handlers, and connects the bot to Discord's API.

```javascript
// Simplified example
const { Client, IntentsBitField } = require("discord.js");
const commandHandler = require("./commands");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.on("ready", () => {
  console.log("Discord bot is online!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle command or send to conversation handler
  if (message.content.startsWith("!")) {
    commandHandler.handleCommand(message);
  } else if (message.mentions.has(client.user)) {
    // Handle mention
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

### 2. Command Handler

Processes user commands and routes them to the appropriate handler function.

```javascript
// Simplified example of command handler
const commands = {
  help: require("./commands/help"),
  clearhistory: require("./commands/clearHistory"),
  summary: require("./commands/summary"),
  summarise: require("./commands/summarise"),
  stats: require("./commands/stats"),
};

function handleCommand(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (commands[command]) {
    commands[command].execute(message, args);
  } else {
    message.reply("Unknown command. Use !help to see available commands.");
  }
}
```

### 3. Perplexity API Client

Manages communication with the Perplexity AI API.

```javascript
// Simplified example
const axios = require("axios");

async function sendChatCompletion(messages) {
  try {
    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar",
        messages: messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling Perplexity API:", error);
    throw error;
  }
}
```

### 4. Conversation Manager

Tracks and manages user conversation history.

```javascript
// Simplified example
const userConversations = new Map();
const MAX_HISTORY_LENGTH = 10;

function addMessageToHistory(userId, role, content) {
  if (!userConversations.has(userId)) {
    userConversations.set(userId, []);
  }

  const history = userConversations.get(userId);
  history.push({ role, content });

  // Trim history if it exceeds maximum length
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
}

function getConversationHistory(userId) {
  return userConversations.get(userId) || [];
}

function clearConversationHistory(userId) {
  userConversations.set(userId, []);
}
```

### 5. Rate Limiter

Prevents spam by enforcing a cooldown between user messages.

```javascript
// Simplified example
const userCooldowns = new Map();
const COOLDOWN_PERIOD = 3000; // 3 seconds

function isRateLimited(userId) {
  const now = Date.now();
  const lastMessageTime = userCooldowns.get(userId) || 0;

  if (now - lastMessageTime < COOLDOWN_PERIOD) {
    return true;
  }

  userCooldowns.set(userId, now);
  return false;
}
```

### 6. Smart Answer Cache

The cache system is designed to store and retrieve frequent questions and answers to reduce API token usage.

```javascript
// Simplified example
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.cache = {};
    this.initialized = false;
  }
  
  // Initialize cache from disk storage
  init() {
    if (this.initialized) return;
    
    try {
      // Load cache from disk or create new
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
        this.cache = JSON.parse(cacheData);
      } else {
        this.saveCache();
      }
      this.initialized = true;
    } catch (error) {
      // Handle errors
      this.cache = {};
      this.saveCache();
    }
  }
  
  // Find a cached response for a question
  findInCache(question) {
    // Try direct hash lookup first
    const hash = this.generateHash(question);
    if (this.cache[hash]) {
      // Update access metrics
      const entry = this.cache[hash];
      entry.accessCount += 1;
      entry.lastAccessed = Date.now();
      
      // Check if entry is stale
      if (this.isStale(entry)) {
        return { ...entry, needsRefresh: true };
      }
      return entry;
    }
    
    // If no direct hit, try similarity matching
    for (const key of Object.keys(this.cache)) {
      const entry = this.cache[key];
      const similarity = this.calculateSimilarity(question, entry.question);
      
      if (similarity > SIMILARITY_THRESHOLD) {
        // Update access metrics
        entry.accessCount += 1;
        entry.lastAccessed = Date.now();
        
        // Check if entry is stale
        if (this.isStale(entry)) {
          return { ...entry, needsRefresh: true, similarity };
        }
        return { ...entry, similarity };
      }
    }
    
    // No match found
    return null;
  }
  
  // Add a new entry to the cache
  addToCache(question, answer, gameContext = null) {
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
  }
}
```

#### Cache Integration with Chat Flow

The cache is integrated into the chat message handling process:

```javascript
async function handleChatMessage(message) {
  // ... existing message handling ...
  
  try {
    // Extract the user's question
    const userQuestion = message.content;
    let reply;
    let fromCache = false;
    
    // Try to find the question in the cache first
    const cacheResult = cacheService.findInCache(userQuestion);
    
    if (cacheResult) {
      // Cache hit!
      reply = cacheResult.answer;
      fromCache = true;
      
      // If the entry needs a refresh (is stale), update it in the background
      if (cacheResult.needsRefresh) {
        // Don't await this to avoid delaying the response
        refreshCacheEntry(userQuestion, userId);
      }
    } else {
      // Cache miss - call the API
      const history = conversationManager.getHistory(userId);
      reply = await perplexityService.generateChatResponse(history);
      
      // Add the new Q&A pair to the cache
      cacheService.addToCache(userQuestion, reply);
    }
    
    // ... continue with response formatting and sending ...
  } catch (error) {
    // ... error handling ...
  }
}
```

#### Key Features of the Cache System:

1. **Hash-based Storage**: Questions are hashed for efficient lookup
2. **Similarity Matching**: Can find similar questions using word overlap algorithm
3. **Access Metrics**: Tracks usage patterns (frequency, last accessed)
4. **Automatic Refreshing**: Stale entries get refreshed in the background
5. **Pruning Capability**: Rarely accessed and old entries can be removed
6. **Persistent Storage**: Cache is saved to disk for use across bot restarts
7. **Performance First**: Cache hits are served immediately with background refreshing

This caching system significantly reduces API token usage for frequently asked questions while maintaining response freshness through background updates of stale entries.

## Environment Configuration

The bot uses environment variables for configuration, stored in a `.env` file:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

## Testing Framework

The project uses Jest for testing, with separate test files for each module:

```javascript
// Example test for the emoji utility
const { addEmojiReactions } = require("../src/utils/emojiUtils");

describe("Emoji Utilities", () => {
  test('should add correct emoji for keyword "hello"', async () => {
    const message = {
      content: "Hello everyone!",
      react: jest.fn().mockResolvedValue(true),
    };

    await addEmojiReactions(message);
    expect(message.react).toHaveBeenCalledWith("👋");
  });
});
```

## Performance Considerations

- Uses JavaScript `Map` for conversation history and rate limiting for efficient lookups
- Implements proper error handling for API calls
- Uses async/await for non-blocking operations

## Security Considerations

- Sensitive information is stored in environment variables, not in code
- API keys and tokens are never exposed in responses
- Rate limiting prevents abuse
- Input validation is performed before processing commands

## Future Technical Enhancements

- Database integration for persistent conversation storage
- Webhook support for external integrations
- Support for more complex conversation flows
- Enhanced error handling with automatic recovery
