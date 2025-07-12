# Release Notes

## Latest Updates

### Cache Service Improvements - June 30, 2025

- Enhanced input validation in the `generateHash` function:
  - Added explicit checks for null, undefined, non-string, and empty string inputs
  - Now throws specific error messages for each invalid input type
- Improved question normalization before hashing:
  - Case normalization (lowercase)
  - Whitespace normalization (trim and replace multiple spaces)
  - Punctuation removal (sentence marks and quotes)
- Increased robustness for edge cases:
  - Unicode characters and special symbols
  - Extremely long questions
  - Improved error handling throughout the cache service
- Updated technical documentation to reflect these changes
- All unit and integration tests now pass, including edge cases

### Smart Cache and Raspberry Pi Optimization - July 7, 2025

- Added Smart Answer Cache feature:
  - Reduces API token usage by caching frequent question-answer pairs
  - Two-level caching with in-memory LRU cache and persistent disk storage
  - Similarity matching for finding answers to similarly worded questions
  - Automatic pruning of old or rarely accessed entries
  - Configurable thresholds for memory usage, disk storage, and similarity
  - Stale entry detection and background refreshing
- Added Raspberry Pi optimization:
  - Created `raspberry-pi-cache-config.md` with optimized settings
  - Reduced memory usage for running on resource-constrained devices
  - Configured LRU pruning for more aggressive memory management
  - Adjusted disk write frequency to extend SD card lifespan
  - Added documentation for different Raspberry Pi models
- Improved error handling throughout the cache service:
  - Better input validation and normalization
  - Graceful degradation on disk errors
  - Improved logging and error reporting

---

## Initial Release

### Initial Release

- First public release of Aszune AI Bot.
- Features:
  - Discord bot using Perplexity API (sonar model).
  - Maintains per-user conversation history.
  - Emoji reactions based on keywords.
  - Rate limiting to prevent spam.
  - `.env`-based configuration for secrets.
  - Basic commands: `!help`, `!clearhistory`, `!summary`.

---

## Enhancements

- Added `!summarise <text>` command for summarising arbitrary text.
- Improved help command output.
- All bot replies and summaries use UK English spelling and phrasing.
- Improved error handling and environment variable checks.
- Refactored command handling for easier extension.
- Switched conversation history and rate limiting to use JavaScript `Map` for better performance.

---

## CI/CD & Testing

- Added Jest unit and integration tests for core utilities and bot logic.
- Added Codecov integration for code coverage reporting.
- Improved test coverage to 100% for utility modules.
- Added GitHub Actions workflow for CI:
  - Runs tests and uploads coverage to Codecov.
  - Uses Node.js 18.
  - Improved reliability by updating to `codecov/codecov-action@v4`.
  - Added `persist-credentials: false` to checkout step.
  - Enabled `fail_ci_if_error: true` for Codecov upload.
- **Workflow Maintenance:**
  - Addressed warnings and errors in the GitHub Actions workflow by upgrading the Codecov action and following new setup recommendations.
  - Reduced retry/backoff issues and improved CI reliability.
- **Additional Tests Added:**
  - Emoji utility: tested multiple keywords, order, empty strings, and keywords inside other words.
  - Command handling: tested unknown commands and summary with no conversation history.
  - Error handling: tested summary API failure and main API failure.
  - Ensured all new tests are included in Codecov coverage reporting.

---

## Bugfixes & Maintenance

- Fixed 504 Gateway Timeout errors in Codecov GitHub Action by upgrading to v4 and following new setup recommendations.
- Updated documentation and README for new features and troubleshooting.
- Added rollback script for production safety.
- Improved PM2 ecosystem config and deployment instructions.

---
