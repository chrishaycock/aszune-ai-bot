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
const LRUCache = require('lru-cache');

class CacheService {
  constructor() {
    this.cache = {};
    this.initialized = false;
    this.memoryCache = new LRUCache({ max: 500 }); // In-memory LRU cache
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
      return this.cache[hash];
    }
    
    // If no direct match, try similarity matching
    return this.findSimilar(question);
  }
  
  // Add a question-answer pair to the cache
  addToCache(question, answer) {
    const hash = this.generateHash(question);
    this.cache[hash] = {
      question,
      answer,
      timestamp: Date.now()
    };
    this.saveCache();
  }
}
```

#### Cache Features

- **Two-level caching**: Fast in-memory LRU cache backed by persistent disk storage
- **Similarity matching**: Finds answers to questions that are worded differently but mean the same thing
- **Automatic pruning**: Removes old or rarely accessed entries to keep the cache size manageable
- **Stale entry refreshing**: Automatically refreshes cached answers that are older than a configured threshold
- **Configurable thresholds**: Adjustable settings for memory usage, disk usage, similarity threshold, etc.
- **Optional feature**: Can be completely disabled via environment variable `ASZUNE_ENABLE_SMART_CACHE=false`

#### Raspberry Pi Optimization

For users running the bot on Raspberry Pi devices with limited resources, we provide optimized settings in the `raspberry-pi-cache-config.md` file. These settings reduce memory usage and disk I/O:

- Reduced memory cache size (100 items instead of 500)
- Smaller maximum cache size (2,000 entries instead of 10,000)
- More aggressive LRU pruning thresholds
- Increased save interval to reduce disk writes
