#!/usr/bin/env node

// This script is a pre-upload hook for Codecov to force the correct repository path
const fs = require('fs');
const path = require('path');

// Force the repository to always be the organization repository
process.env.GITHUB_REPOSITORY = 'powerfulqa/aszune-ai-bot';
process.env.GITHUB_REPOSITORY_OWNER = 'powerfulqa';
process.env.CODECOV_SLUG = 'powerfulqa/aszune-ai-bot';
process.env.CODECOV_NAME = 'powerfulqa/aszune-ai-bot';

// Write this info to a file that will be read by the GitHub Actions workflow
fs.writeFileSync(
  path.join(process.cwd(), 'codecov-fix.env'),
  `GITHUB_REPOSITORY=powerfulqa/aszune-ai-bot
GITHUB_REPOSITORY_OWNER=powerfulqa
CODECOV_SLUG=powerfulqa/aszune-ai-bot
CODECOV_NAME=powerfulqa/aszune-ai-bot`
);

console.log('Codecov environment variables have been set to use the organization repository.');
