# Deployment Guide

This guide provides instructions for deploying the Aszune AI Bot to a production environment.

## Recommended Deployment Methods

### Method 1: PM2 (Process Manager)

PM2 is a production process manager for Node.js applications that helps keep your bot running continuously, even after system reboots.

#### Installation

```bash
npm install pm2 -g
```

#### Basic Deployment

Run the bot with PM2:

```bash
DISCORD_BOT_TOKEN=your_token PERPLEXITY_API_KEY=your_key pm2 start src/index.js --name aszune-ai
```

#### Using Ecosystem Configuration (Recommended)

For better management, create an ecosystem configuration file:

1. The repository includes a `ecosystem.config.js` file:

```javascript
module.exports = {
  apps: [
    {
      name: "aszune-ai",
      script: "src/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        DISCORD_BOT_TOKEN: "your_discord_bot_token_here",
        PERPLEXITY_API_KEY: "your_perplexity_api_key_here",
      },
    },
  ],
};
```

2. Edit the `ecosystem.config.js` file to include your actual tokens and API keys.

3. Start the bot using PM2 with the ecosystem file:

```bash
pm2 start ecosystem.config.js
```

#### PM2 Commands

- **Start**: `pm2 start aszune-ai`
- **Stop**: `pm2 stop aszune-ai`
- **Restart**: `pm2 restart aszune-ai`
- **Check Status**: `pm2 status`
- **View Logs**: `pm2 logs aszune-ai`
- **Setup Startup Script**: `pm2 startup` (followed by the command it provides)
- **Save Current Process List**: `pm2 save` (after running the startup script)

### Method 2: Docker

Docker provides an isolated environment for running your bot.

#### Create a Dockerfile

Create a file named `Dockerfile` in the project root:

```dockerfile
FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "src/index.js"]
```

#### Create a docker-compose.yml file

```yaml
version: "3"

services:
  bot:
    build: .
    restart: always
    environment:
      - DISCORD_BOT_TOKEN=your_discord_bot_token_here
      - PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

#### Deploy with Docker Compose

```bash
docker-compose up -d
```

### Method 3: Cloud Hosting

You can deploy the bot to various cloud platforms:

#### Heroku

1. Create a `Procfile` in the root directory:

   ```
   worker: node src/index.js
   ```

2. Set environment variables in Heroku dashboard or using Heroku CLI:

   ```bash
   heroku config:set DISCORD_BOT_TOKEN=your_token
   heroku config:set PERPLEXITY_API_KEY=your_key
   ```

3. Deploy to Heroku:
   ```bash
   git push heroku main
   ```

#### Railway.app

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Railway will automatically deploy your application

## Raspberry Pi Deployment

Aszune AI Bot can be deployed on a Raspberry Pi with some optimizations for better performance on limited resources.

### Hardware Recommendations

- **Recommended**: Raspberry Pi 4 (4GB or 8GB RAM)
- **Minimum**: Raspberry Pi 3 (1GB RAM)

### Setup Steps for Raspberry Pi

1. **Install Node.js**:

   ```bash
   # For Raspberry Pi OS (Debian-based)
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Verify installation
   node -v
   npm -v
   ```

2. **Clone the Repository**:

   ```bash
   git clone https://github.com/chrishaycock/aszune-ai-bot.git
   cd aszune-ai-bot
   ```

3. **Install Dependencies**:

   ```bash
   npm install
   # Make sure to install lru-cache for the smart-cache feature
   npm install lru-cache
   ```

4. **Create Optimized Configuration**:

   Create a `.env` file with the optimized Raspberry Pi settings:

   ```bash
   # Required API keys
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   
   # Enable/disable smart cache feature (set to "false" to disable)
   # Disabling is recommended for Raspberry Pi 3 running other services like Pi-hole
   ASZUNE_ENABLE_SMART_CACHE=true
   
   # Cache configuration optimized for Raspberry Pi (only used if smart cache is enabled)
   # For Pi 3 use these conservative settings:
   ASZUNE_MEMORY_CACHE_SIZE=100
   ASZUNE_MAX_CACHE_SIZE=2000
   ASZUNE_LRU_PRUNE_THRESHOLD=1800
   ASZUNE_LRU_PRUNE_TARGET=1500
   ASZUNE_CACHE_SAVE_INTERVAL_MS=600000
   
   # For Pi 4 (4GB/8GB), you can use higher values:
   # ASZUNE_MEMORY_CACHE_SIZE=250
   # ASZUNE_MAX_CACHE_SIZE=5000
   # ASZUNE_LRU_PRUNE_THRESHOLD=4500
   # ASZUNE_LRU_PRUNE_TARGET=3500
   # ASZUNE_CACHE_SAVE_INTERVAL_MS=300000
   ```

5. **Deploy with PM2** (recommended for auto-restart):

   ```bash
   # Install PM2
   sudo npm install -g pm2
   
   # Start the bot
   pm2 start src/index.js --name aszune-ai
   
   # Set PM2 to start on boot
   pm2 startup
   # Run the command PM2 gives you
   
   # Save the PM2 configuration
   pm2 save
   ```

### Performance Tips for Raspberry Pi

1. **Use External SSD** instead of SD card for better performance and longevity
2. **Add a cooling fan** to prevent thermal throttling
3. **Monitor system resources** with `htop` to ensure the bot isn't using too much memory
4. **Increase swap space** if memory usage is consistently high
5. **Restart periodically** using a cron job if you notice memory leaks over extended uptime

## Server Requirements

- Node.js 14.x or later
- Minimum 512MB RAM
- 1GB+ free disk space
- Stable internet connection
- (Optional) PM2 or Docker for process management

## Security Best Practices

1. **Environment Variables**: Never commit your `.env` file or any file containing secrets
2. **Regular Updates**: Keep all dependencies updated
   ```bash
   npm audit
   npm update
   ```
3. **Limited Permissions**: Your bot's Discord token should have only the required permissions
4. **Monitoring**: Set up monitoring and alerts for your bot's health

## Keeping Your Bot Online

If you're using PM2:

```bash
# Set up PM2 to start on boot
pm2 startup
# Save current processes to restore on reboot
pm2 save
```

## Updating Your Bot

1. Pull the latest code:

   ```bash
   git pull origin main
   ```

2. Install any new dependencies:

   ```bash
   npm install
   ```

3. Restart the bot:
   ```bash
   pm2 restart aszune-ai
   ```

## Backing Up

It's recommended to regularly backup your bot's data:

```bash
# If you're using file-based storage
cp -r data/ backup/data_$(date +%Y%m%d)/
```

## CI/CD Pipeline

The project includes a configured CI/CD pipeline using GitHub Actions. The pipeline is defined in `.github/workflows/unified-ci.yml`. For comprehensive technical details about the code architecture and implementation, please refer to the [Technical Documentation](Technical-Documentation.md).

### CI/CD Pipeline

1. **Automated Testing**:
   - Runs the full test suite with coverage on every push and pull request
   - Generates JUnit test reports for better visibility into test results

2. **Coverage Reporting**:
   - Uploads coverage data to Codecov
   - Shows coverage trends and changes over time
   - Provides a coverage badge for the README.md

3. **Codecov Integration**:
   - Uses Codecov AI Reviewer for automated code reviews on pull requests
   - Uploads test results for analysis

### Using GitHub Actions for Deployment

You can extend the existing GitHub Actions workflow to automatically deploy your bot when changes are pushed to the main branch:

1. Uncomment the deployment job in `.github/workflows/unified-ci.yml`
2. Add your specific deployment commands
3. Add any required secrets to your GitHub repository

```yaml
deploy:
  name: Deploy
  needs: build-and-test
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Deploy to production
      run: echo "Add your deployment steps here"
      env:
        DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```
