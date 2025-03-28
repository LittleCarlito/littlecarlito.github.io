#!/bin/bash
# create-changeset-branch.sh
# Creates a new branch for changeset changes

set -e

# Generate branch name
BRANCH_NAME="changeset-release/auto-$(date +%s)"
echo "Creating branch: $BRANCH_NAME" >&2

# Create the branch but redirect all git output to stderr
git checkout -b "$BRANCH_NAME" >&2 2>&1

# Output only what we need
echo "branch_name=$BRANCH_NAME" 