#!/bin/bash

# This script cleans up temporary Codecov debug files that are no longer needed
# Run this script after you've connected your repository to Codecov correctly

echo "Cleaning up temporary Codecov debug files..."

# List of files to remove
FILES_TO_REMOVE=(
  "codecov-wrapper.sh"
  "codecov-force-org.js"
  "debug-codecov.js"
  "workflow-test-trigger.js"
)

for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    echo "Removing $file"
    rm "$file"
  else
    echo "File $file not found, skipping"
  fi
done

# Check for any other temporary files
if [ -f "codecov-fix.env" ]; then
  echo "Removing codecov-fix.env"
  rm codecov-fix.env
fi

if [ -f "codecov-local-override.yml" ]; then
  echo "Removing codecov-local-override.yml"
  rm codecov-local-override.yml
fi

if [ -f "debug-output.json" ]; then
  echo "Removing debug-output.json"
  rm debug-output.json
fi

if [ -f "codecov-debug-output.txt" ]; then
  echo "Removing codecov-debug-output.txt"
  rm codecov-debug-output.txt
fi

echo "Cleanup complete!"
