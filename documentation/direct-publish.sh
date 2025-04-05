#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔑 Setting up SSH for direct publishing...${NC}"

# Start SSH agent and add the key
eval "$(ssh-agent -s)"
ssh-add /Users/stevenmeier/.ssh/id_ed25519

# Verify SSH connection to GitHub
echo -e "${YELLOW}🔍 Verifying GitHub SSH connection...${NC}"
ssh -T git@github.com -o StrictHostKeyChecking=no || true

# Configure Git remote to use SSH instead of HTTPS
echo -e "${YELLOW}🔧 Configuring Git remote to use SSH...${NC}"
CURRENT_REMOTE=$(git remote get-url origin)

if [[ $CURRENT_REMOTE != git@github.com* ]]; then
  echo -e "${YELLOW}Changing remote from HTTPS to SSH...${NC}"
  git remote set-url origin git@github.com:LittleCarlito/threejs_site.git
  echo -e "${GREEN}✅ Remote URL updated to SSH${NC}"
else
  echo -e "${GREEN}✅ Remote URL already using SSH${NC}"
fi

# Make sure we're on main branch
echo -e "${YELLOW}📋 Switching to main branch...${NC}"
git checkout main

# Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
git pull origin main

# Run version script
echo -e "${YELLOW}🔢 Running version script...${NC}"
pnpm version

echo -e "${YELLOW}📤 Pushing version changes to main branch...${NC}"
git push origin main

# Publish packages
echo -e "${YELLOW}📦 Publishing packages...${NC}"
pnpm release

echo -e "${GREEN}✅ Versioning and publishing completed successfully!${NC}" 