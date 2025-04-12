#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Initialize variables with defaults
MERGE_BASE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --merge-base)
      MERGE_BASE="$2"
      shift # past argument
      shift # past value
      ;;
    *)
      # Unknown option
      echo "Unknown option: $key"
      shift # past argument
      ;;
  esac
done

echo -e "${YELLOW}🔑 Setting up SSH for direct publishing in pipeline...${NC}"

# Create SSH directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Write the SSH private key from DEPLOY_KEY secret to a file
echo -e "${YELLOW}Writing deploy key to file...${NC}"
echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key

# Configure SSH to use the deploy key for GitHub
cat > ~/.ssh/config << EOF
Host github.com
  IdentityFile ~/.ssh/deploy_key
  User git
  IdentitiesOnly yes
  StrictHostKeyChecking no
EOF

chmod 600 ~/.ssh/config

# Start SSH agent and add the key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/deploy_key

# Verify SSH connection to GitHub
echo -e "${YELLOW}🔍 Verifying GitHub SSH connection...${NC}"
ssh -T git@github.com || true

# Set Git identity for deployment
git config --global user.name "LittleCarlito"
git config --global user.email "LittleCarlito@users.noreply.github.com"

# Configure Git remote to use SSH instead of HTTPS
echo -e "${YELLOW}🔧 Configuring Git remote to use SSH...${NC}"
git remote set-url origin git@github.com:LittleCarlito/threejs_site.git
echo -e "${GREEN}✅ Remote URL updated to SSH${NC}"

# Make sure we're on main branch
echo -e "${YELLOW}📋 Switching to main branch...${NC}"
git fetch origin
git checkout main
git pull origin main

# Ensure NODE_AUTH_TOKEN is set in the environment
if [ -z "$NODE_AUTH_TOKEN" ]; then
  echo -e "${RED}⚠️ NODE_AUTH_TOKEN is not set! Publishing will likely fail.${NC}"
fi

# Create or update npmrc file with authentication
echo -e "${YELLOW}📝 Setting up npm authentication...${NC}"
echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" > ~/.npmrc
echo "registry=https://npm.pkg.github.com/" >> ~/.npmrc
echo -e "${GREEN}✅ npm authentication configured${NC}"

# Run version script with proper arguments if this is a PR merge
echo -e "${YELLOW}🔢 Running version script...${NC}"
if [ -n "$MERGE_BASE" ]; then
  echo -e "${YELLOW}📊 Using PR merge base for commit analysis: ${MERGE_BASE}${NC}"
  # Create temporary config for version script
  echo "{\"mergeBase\": \"$MERGE_BASE\"}" > .version-config.json
  
  # Pass the merge base to the version script as an environment variable
  VERSION_MERGE_BASE=$MERGE_BASE node scripts/version-packages.js
  
  # Clean up config file
  rm .version-config.json
else
  echo -e "${YELLOW}📊 Using standard version calculation${NC}"
  node scripts/version-packages.js
fi

# Check if any packages were versioned
HAS_CHANGES=$(git status --porcelain | grep -E "packages/|apps/" | wc -l)
if [ "$HAS_CHANGES" -gt 0 ]; then
  echo -e "${GREEN}✅ Changes detected in package versions${NC}"
  git config --global user.name "GitHub Actions"
  git config --global user.email "actions@github.com"
  git add .
  
  # Add more context to the commit message about the source of these changes
  if [ -n "$MERGE_BASE" ]; then
    git commit -m "chore: version packages from PR merge [skip ci]" -m "These versions were bumped based on commits in the merged PR."
  else
    git commit -m "chore: version packages [skip ci]"
  fi
  
  echo -e "${YELLOW}📤 Pushing version changes directly to main branch...${NC}"
  git push origin main

  # Publish packages with properly configured authentication
  echo -e "${YELLOW}📦 Publishing packages...${NC}"
  # Copy .npmrc to the project root to ensure it's used
  cp ~/.npmrc ./.npmrc
  pnpm release
  echo -e "${GREEN}✅ Packages published successfully${NC}"
else
  echo -e "${YELLOW}⚠️ No version changes detected${NC}"
fi

echo -e "${GREEN}✅ Versioning and publishing completed successfully!${NC}"

# Clean up credentials
rm -f ~/.ssh/deploy_key
rm -f ~/.ssh/config
rm -f ~/.npmrc
rm -f ./.npmrc 