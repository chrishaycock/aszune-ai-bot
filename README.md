# Aszune AI Bot

![CI/CD](https://github.com/chrishaycock/aszune-ai-bot/actions/workflows/unified-ci.yml/badge.svg)
[![Codecov](https://codecov.io/gh/chrishaycock/aszune-ai-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/chrishaycock/aszune-ai-bot)
[![Maintainability](https://qlty.sh/badges/89f58366-59f3-43bb-8a8a-6b02c47c7ad9/maintainability.svg)](https://qlty.sh/gh/chrishaycock/projects/aszune-ai-bot)

**Aszune AI Bot** is a Discord bot designed to provide gaming lore, game logic, guides, and advice using the Perplexity API with the **sonar** model. It maintains a short conversation history for each user and adds fun emoji reactions based on keywords found in messages. Now supports both traditional `!` commands and modern Discord slash commands.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup Steps](#setup-steps)
- [Usage](#usage)
  - [Running the Bot Manually](#running-the-bot-manually)
  - [Running with PM2 (for Production)](#running-with-pm2-for-production)
- [Bot Commands](#bot-commands)
- [Project Structure](#project-structure)
- [Testing & Coverage](#testing--coverage)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- 🤖 **Chat Completions:** Uses Perplexity API's `chat/completions` endpoint with the **sonar** model.
- 🧠 **Context Awareness:** Remembers recent user messages with a configurable history length.
- 🔁 **Command Support:** Users can clear their history at any time.
- 😄 **Emoji Reactions:** Adds reactions based on keywords like "hello", "funny", "love", etc.
- 🔒 **Secure Configuration:** `.env` based token and key management (keeps secrets out of code).
- 🕒 **Rate Limiting:** Prevents users from spamming the bot by enforcing a short cooldown between messages.
- 📝 **Help Command:** `!help` and `/help` commands list all available commands and usage.
- 🧾 **Conversation Summary:** `!summary` and `/summary` commands generate a summary of your current conversation using UK English. (Now robust to API requirements: last message must be from user/tool)
- 📝 **Text Summarisation:** `!summarise <text>` or `!summerise <text>` command generates a summary of any provided text using UK English.
- 🇬🇧 **UK English Responses:** All bot replies and summaries use UK English spelling and phrasing.
- 🗂️ **Improved Performance:** Uses JavaScript `Map` for conversation history and rate limiting for better efficiency and reliability.
- 🛠️ **Cleaner Codebase:** Refactored command handling for easier maintenance and extension.
- 🆕 **Stats Tracking:** `!stats` and `/stats` commands show per-user message and summary counts.
- 🆕 **Slash Command Support:** All major commands are available as Discord slash commands for a modern user experience.
- 🆕 **Comprehensive Testing:** 125 automated tests covering all key functionality.
- 🆕 **Enhanced Error Handling:** Robust error handling for API failures and edge cases.

---

## Installation

### Prerequisites

- Node.js (v14 or later)
- A Discord bot token (from the [Discord Developer Portal](https://discord.com/developers/applications))
- A valid [Perplexity AI API key](https://www.perplexity.ai/)

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/chrishaycock/aszune-ai-bot.git
   cd aszune-ai-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a `.env` file**

   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   ```

---

## Usage

### Running the Bot Manually

```bash
node src/index.js
```

You should see:

```
Discord bot is online!
```

Your bot should now appear online in your Discord server.

---

### Running with PM2 (for Production)

PM2 keeps the bot alive in the background and restarts it on crashes or reboots.

#### Option A: Using an Ecosystem File

1. Create a file called `ecosystem.config.js`:

   ```js
   module.exports = {
     apps: [
       {
         name: "aszune-ai",
         script: "src/index.js",
         env: {
           DISCORD_BOT_TOKEN: "your_discord_bot_token_here",
           PERPLEXITY_API_KEY: "your_perplexity_api_key_here",
         },
       },
     ],
   };
   ```

2. Start your bot:

   ```bash
   pm2 start ecosystem.config.js
   pm2 logs aszune-ai
   ```

#### Option B: Inline Environment Variables

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here PERPLEXITY_API_KEY=your_perplexity_api_key_here pm2 start src/index.js --name aszune-ai
```

---

## Bot Commands

| Command                                  | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| `!help` / `/help`                        | Shows a list of available commands and usage                |
| `!clearhistory` / `/clearhistory`        | Clears your conversation history                            |
| `!summary` / `/summary`                  | Summarises your current conversation in UK English          |
| `!summarise <text>` / `!summerise <text>` | Summarises any provided text in UK English                  |
| `!stats` / `/stats`                      | Shows your usage stats (messages sent, summaries requested) |

> **Note:** While `!summarise` and `!summerise` exist as text commands, the `/summarise` slash command equivalent may not be fully implemented yet.

---

## Project Structure

```
aszune-ai-bot/
├── src/
│   ├── index.js           # Main entry point
│   ├── commands/          # Command handlers
│   ├── config/            # Configuration settings
│   ├── services/          # API and core services
│   └── utils/             # Utility functions and helpers
├── package.json           # Project metadata
├── package-lock.json      # Dependency lock file
├── ecosystem.config.js    # PM2 deployment config
├── .env                   # Environment secrets (not committed)
├── .gitignore             # Ignored files
├── __tests__/             # Unit and integration tests
├── __mocks__/             # Test mocks
├── jest.config.js         # Jest test configuration
├── jest.setup.js          # Jest setup file
└── coverage/              # Code coverage output (Codecov)
```

---

## Testing & Coverage

The project includes comprehensive testing with Jest. To run tests:

```bash
# Run tests
npm test

# Run tests with coverage report
npm run test:coverage
```

The test suite includes:
- Unit tests for all service modules
- Integration tests for bot functionality
- Edge case handling tests
- Mocks for external dependencies

Current test coverage: 100% of critical paths with 125 tests.

---

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment. The pipeline:

1. **Builds** the application
2. **Runs all tests** with coverage reporting
3. **Performs security checks** using npm audit
4. **Uploads coverage data** to Codecov and QLTY
5. **Prepares for deployment** when merging to main branch

View the CI/CD workflow in `.github/workflows/unified-ci.yml`

---

## Troubleshooting

### 🔴 Bot Offline or Invalid Token

- Double-check your `DISCORD_BOT_TOKEN` in `.env`
- Confirm the token has not been regenerated or revoked
- Ensure your bot has permission to join and read messages in your server

### 🔴 Perplexity API Errors (400 / 401)

- Validate your API key is current and supports the `chat/completions` endpoint
- Ensure model name is `"sonar"` and the format of your payload is correct
- Test the same key using a tool like Postman or curl

---

## Future Enhancements

- [ ] Add clickable sources and reference links from Perplexity results
- [ ] Enhance error handling with retry/backoff logic for API rate limits
- [ ] Web dashboard for usage monitoring and conversation history
- [ ] Implement AI-powered content moderation for safer interactions

---

## Contributing

Pull requests and ideas are always welcome! Please:

1. Fork the repository
2. Create a new branch
3. Submit a PR with your changes

---

## License

MIT — feel free to use, modify, and share ✨

---

**Made for the Aszune community. Powered by Discord, Perplexity, and Node.js.**

## Notes

- The codebase has been completely refactored to use a modular structure under the `src/` directory.
- The bot uses a robust command handler for easier extension and maintenance.
- Conversation history and rate limiting are managed using JavaScript `Map` objects for better performance and reliability.
- The `!summarise <text>` command is available for summarising arbitrary text.
- Error handling and environment variable checks have been improved and centralised.
- The bot's system prompt instructs it to say "I don't know" if it cannot answer a question, rather than making up an answer.
