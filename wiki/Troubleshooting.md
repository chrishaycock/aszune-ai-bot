# Troubleshooting

This guide covers common issues you might encounter while setting up and running the Aszune AI Bot, along with their solutions.

## Connection Issues

### Bot Not Coming Online

**Symptoms:**

- Bot appears offline in Discord
- No "Discord bot is online!" message in console

**Possible Causes and Solutions:**

1. **Invalid Discord Token**
   - Double-check that your Discord bot token in the `.env` file or environment variables is correct
   - Ensure there are no extra spaces or quotation marks around the token
   - Verify the token is for the correct bot in the Discord Developer Portal

2. **Network Connectivity**
   - Check your server's internet connection
   - Ensure outbound connections to Discord API endpoints are not blocked by firewalls

3. **Discord API Issues**
   - Check Discord's status page: https://discordstatus.com/
   - Wait for Discord to resolve any ongoing API issues

4. **Incorrect Permissions**
   - Ensure your bot has been invited to the server with the correct permissions
   - Re-invite the bot using the method described in the [Getting Started](Getting-Started) guide

### Bot Connects but Doesn't Respond to Commands

**Symptoms:**

- Bot shows online, but doesn't respond to commands

**Possible Causes and Solutions:**

1. **Missing Intents**
   - Ensure the bot has the required intents enabled in the Discord Developer Portal
   - Message Content intent is required and must be specifically enabled

2. **Missing Channel Permissions**
   - Check if the bot has permission to read and send messages in the channel
   - Try using commands in a different channel

3. **Command Prefix Issue**
   - Make sure you're using the correct prefix (default is `!`)
   - Try with both capitalizations (e.g., `!Help` and `!help`)

## API Issues

### Perplexity API Errors

**Symptoms:**

- Messages like "Error communicating with Perplexity API" in the console
- Bot replies with error messages instead of AI responses

**Possible Causes and Solutions:**

1. **Invalid API Key**
   - Verify your Perplexity API key in the `.env` file
   - Make sure it's correctly formatted with no extra spaces

2. **API Usage Limits**
   - Check if you've reached your API usage limits
   - Consider upgrading your Perplexity API plan if necessary

3. **Rate Limiting**
   - If you're seeing rate limit errors, implement a delay between requests
   - Adjust the rate limiter settings in the bot configuration

4. **Network Issues**
   - Ensure your server can connect to Perplexity's API endpoints
   - Check for any proxy or firewall settings that might block connections

## Performance Issues

### Bot Responds Slowly

**Possible Causes and Solutions:**

1. **Server Resources**
   - Check if your server has sufficient CPU and memory
   - Consider upgrading your server if it's consistently at high utilization

2. **High Traffic**
   - If many users are using the bot simultaneously, consider:
     - Increasing rate limits
     - Optimizing code for performance
     - Scaling horizontally with multiple bot instances

3. **API Latency**
   - Monitor the response time from Perplexity's API
   - Consider caching responses for common queries

### Memory Leaks

**Symptoms:**

- Bot memory usage grows over time
- Bot becomes unresponsive after running for a while

**Solutions:**

- Restart the bot regularly using a cron job or PM2's restart feature
- Check the conversation history size and consider reducing the maximum history length
- Look for memory leaks in the code, especially with event listeners or timers

## Cache Issues

### Smart Cache Not Working

**Symptoms:**

- Bot always queries the API even for repeated questions
- Error messages about cache in the logs

**Possible Causes and Solutions:**

1. **Missing `lru-cache` Package**
   - Run `npm install lru-cache` to install the required package
   - Restart the bot after installation

2. **Incorrect Cache Configuration**
   - Ensure environment variables are set properly in your `.env` file
   - Check that the values are within reasonable ranges (not set to 0)

3. **Permission Issues with Cache File**
   - Ensure the bot has write permissions to the `data` directory
   - Check ownership and permissions of the cache file:
     ```bash
     ls -la data/question_cache.json
     ```
   - Fix permissions if needed:
     ```bash
     chmod 664 data/question_cache.json
     ```

4. **Disk Space Issues**
   - Verify there's enough disk space for the cache file to grow
   - Run `df -h` to check available space

### Performance Issues on Raspberry Pi

**Symptoms:**

- Bot responds slowly
- High CPU usage
- Device running hot

**Possible Causes and Solutions:**

1. **Cache Too Large for Available Memory**
   - Reduce the cache settings further in your `.env` file:
     ```
     ASZUNE_MEMORY_CACHE_SIZE=50
     ASZUNE_MAX_CACHE_SIZE=1000
     ```

2. **Thermal Throttling**
   - Add a cooling solution (heatsink, fan)
   - Ensure good ventilation around the device
   - Monitor temperature with `vcgencmd measure_temp`

3. **SD Card I/O Bottlenecks**
   - Move the application to an external USB SSD for better performance
   - Increase the cache save interval to reduce writes:
     ```
     ASZUNE_CACHE_SAVE_INTERVAL_MS=1200000  # 20 minutes
     ```

4. **Memory Leaks**
   - Schedule periodic restarts with cron or PM2
   - Set up PM2 with memory monitoring:
     ```bash
     pm2 start src/index.js --name aszune-ai --max-memory-restart 300M
     ```

### Resource Constraints on Raspberry Pi

**Symptoms:**

- High memory usage
- System running slow
- Bot becoming unresponsive
- Pi-hole or other services affected

**Solution:**

1. **Disable the Smart Cache Feature**
   - Edit your `.env` file and set:
     ```
     ASZUNE_ENABLE_SMART_CACHE=false
     ```
   - Restart the bot
   - This will completely disable the caching system while keeping all other bot functionality

2. **Monitor Resource Usage**
   - Run `htop` to see real-time memory usage
   - If the bot is still using too many resources even with cache disabled, consider:
     - Running on a separate Raspberry Pi
     - Using PM2's memory limit: `pm2 start src/index.js --name aszune-ai --max-memory-restart 300M`
     - Setting up a cron job to restart the bot daily

## Common Error Messages

### "Cannot find module 'xyz'"

```bash
Error: Cannot find module 'xyz'
```

**Solution:**

- Run `npm install` to install all dependencies
- If targeting a specific missing module: `npm install xyz`

### "Error: Disallowed intents specified"

```bash
Error [DisallowedIntents]: Privileged intent provided is not enabled or whitelisted.
```

**Solution:**

- Go to the [Discord Developer Portal](https://discord.com/developers/applications)
- Select your application
- Go to "Bot" section
- Enable the "Message Content Intent" under "Privileged Gateway Intents"

### "DiscordAPIError: Missing Permissions"

```bash
DiscordAPIError: Missing Permissions
```

**Solution:**

- Ensure the bot has proper permissions in the channel
- Re-invite the bot with the correct permissions

## Logging and Debugging

For more detailed troubleshooting:

1. **Enable Debug Mode**

   Add to your `.env` file: ```env
   DEBUG=true

   ```

2. **Check Logs**

   If using PM2:

   ```bash
   pm2 logs aszune-ai
   ```

3. **Increase Log Verbosity**

   Modify your logging level in the code or configuration.

## Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/chrishaycock/aszune-ai-bot/issues) for similar problems
2. Search the [Discord.js Guide](https://discordjs.guide/) for common Discord bot issues
3. Post a new GitHub issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Error messages/logs
   - Environment information (Node.js version, OS, etc.)
   - Any relevant code snippets
