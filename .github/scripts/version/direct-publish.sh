#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# Run version script
echo -e "${YELLOW}🔢 Running version script...${NC}"
pnpm version

echo -e "${YELLOW}📤 Pushing version changes directly to main branch...${NC}"
git push origin main

# Publish packages
echo -e "${YELLOW}📦 Publishing packages...${NC}"
pnpm release

echo -e "${GREEN}✅ Versioning and publishing completed successfully!${NC}"

# Clean up credentials
rm -f ~/.ssh/deploy_key
rm -f ~/.ssh/config 