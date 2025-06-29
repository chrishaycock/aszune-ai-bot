#!/bin/bash

# This script is a wrapper for the codecov CLI that forces it to use the correct repository
# To use it, make it executable with `chmod +x codecov-wrapper.sh` and use it instead of calling codecov directly

# Force environment variables
export GITHUB_REPOSITORY="powerfulqa/aszune-ai-bot"
export GITHUB_REPOSITORY_OWNER="powerfulqa"
export CODECOV_NAME="powerfulqa/aszune-ai-bot"
export CODECOV_SLUG="powerfulqa/aszune-ai-bot"

# Print debug info
echo "GITHUB_REPOSITORY=$GITHUB_REPOSITORY"
echo "GITHUB_REPOSITORY_OWNER=$GITHUB_REPOSITORY_OWNER"
echo "CODECOV_NAME=$CODECOV_NAME"
echo "CODECOV_SLUG=$CODECOV_SLUG"

# Execute with all arguments passed to this script
exec "$@"
