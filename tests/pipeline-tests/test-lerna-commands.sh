#!/bin/bash
set -e

# Test script for Lerna commands
echo "🔍 Testing Lerna commands..."

# Display Lerna version
echo "Lerna version:"
pnpm lerna --version

# List all packages
echo "Listing all packages:"
pnpm lerna list --loglevel=info

# List packages that have changed
echo "Changed packages:"
pnpm lerna changed --loglevel=info || echo "No changed packages detected"

# Try to get help for diff command
echo "Diff command help:"
pnpm lerna diff --help --loglevel=info || echo "Help command failed"

# Try diff command with a package (if any exists)
FIRST_PACKAGE=$(pnpm lerna list --json --loglevel=info | jq -r '.[0].name' 2>/dev/null || echo "")
if [ -n "$FIRST_PACKAGE" ]; then
  echo "Testing diff on package: $FIRST_PACKAGE"
  pnpm lerna diff "$FIRST_PACKAGE" --loglevel=info | head -5 || echo "Diff command failed"
  echo "... (output truncated)"
fi

echo "✅ Lerna command test completed" 