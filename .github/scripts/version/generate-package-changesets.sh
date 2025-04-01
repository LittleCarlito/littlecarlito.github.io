#!/bin/bash
# generate-package-changesets.sh
# Generates precise package-specific changesets based on actual changes since last release

set -e

# Parse command line arguments
AUTO_CHANGESET_PREFIX="auto-"
FORCE_GENERATE=false

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --auto-changeset-prefix)
      AUTO_CHANGESET_PREFIX="$2"
      shift
      shift
      ;;
    --force-generate)
      FORCE_GENERATE="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--auto-changeset-prefix <prefix>] [--force-generate true|false]"
      exit 1
      ;;
  esac
done

# Find all packages in the repo
PACKAGES=$(find . -type f -name "package.json" -not -path "*/node_modules/*" -exec jq -r 'select(.name != null) | .name' {} \; | sort -u)
echo "Found packages: $PACKAGES"

CHANGES_MADE=false

# Process each package individually
for PACKAGE in $PACKAGES; do
  echo "Processing package: $PACKAGE"
  
  # Get the latest tag for this specific package
  LATEST_TAG=$(git tag -l "${PACKAGE}@*" --sort=-creatordate | head -1)
  
  if [ -n "$LATEST_TAG" ]; then
    echo "Latest tag for $PACKAGE: $LATEST_TAG"
    
    # Identify commits that affect this specific package
    # Clean package name for use in grep
    PKG_NAME=$(echo "$PACKAGE" | sed 's|@.*/||')
    
    # Look for conventional commits with relevant scope or affecting package files
    COMMITS=$(git log $LATEST_TAG..HEAD --format="%H" -- "packages/$PKG_NAME/" "apps/$PKG_NAME/" || true)
    SCOPED_COMMITS=$(git log $LATEST_TAG..HEAD --grep="$PKG_NAME" --format="%H" || true)
    FEAT_COMMITS=$(git log $LATEST_TAG..HEAD --grep="^feat" --format="%H" || true)
    
    # Combine and make unique
    ALL_COMMITS=$(echo -e "$COMMITS\n$SCOPED_COMMITS\n$FEAT_COMMITS" | sort -u | grep -v "^$" || true)
    
    if [ -n "$ALL_COMMITS" ] || [ "$FORCE_GENERATE" == "true" ]; then
      # Determine version bump type (minor for features, patch for fixes)
      BUMP_TYPE="patch"
      FEATURE_CHECK=$(git log $LATEST_TAG..HEAD --format="%s" -- "packages/$PKG_NAME/" "apps/$PKG_NAME/" | grep -E "^feat" || true)
      if [ -n "$FEATURE_CHECK" ]; then
        BUMP_TYPE="minor"
      fi
      
      # Create a targeted changeset for just this package
      CHANGESET_FILE=".changeset/${AUTO_CHANGESET_PREFIX}$(echo $PKG_NAME | tr '/' '-')-$BUMP_TYPE-$(date +%s | md5sum | head -c 6).md"
      echo "---" > $CHANGESET_FILE
      echo "\"$PACKAGE\": $BUMP_TYPE" >> $CHANGESET_FILE 
      echo "---" >> $CHANGESET_FILE
      echo "" >> $CHANGESET_FILE
      echo "Changes for $PACKAGE since $LATEST_TAG" >> $CHANGESET_FILE
      
      # Add a few commit messages as summary
      git log $LATEST_TAG..HEAD --format="- %s" -- "packages/$PKG_NAME/" "apps/$PKG_NAME/" | head -5 >> $CHANGESET_FILE
      
      echo "Created changeset for $PACKAGE with $BUMP_TYPE bump"
      CHANGES_MADE=true
    else
      echo "No significant changes detected for $PACKAGE since $LATEST_TAG"
    fi
  else
    echo "No tags found for $PACKAGE. First release?"
    
    # Check if package directory exists and has code
    PKG_NAME=$(echo "$PACKAGE" | sed 's|@.*/||')
    PKG_DIR=""
    if [ -d "packages/$PKG_NAME" ]; then
      PKG_DIR="packages/$PKG_NAME"
    elif [ -d "apps/$PKG_NAME" ]; then
      PKG_DIR="apps/$PKG_NAME"
    fi
    
    if [ -n "$PKG_DIR" ]; then
      # For first releases, check if it has code
      FILE_COUNT=$(find "$PKG_DIR" -type f | wc -l)
      if [ $FILE_COUNT -gt 5 ]; then  # Arbitrary threshold for "real" package
        # Create a minor bump for first release
        CHANGESET_FILE=".changeset/${AUTO_CHANGESET_PREFIX}$(echo $PKG_NAME | tr '/' '-')-first-$(date +%s | md5sum | head -c 6).md"
        echo "---" > $CHANGESET_FILE
        echo "\"$PACKAGE\": minor" >> $CHANGESET_FILE
        echo "---" >> $CHANGESET_FILE
        echo "" >> $CHANGESET_FILE
        echo "First release of $PACKAGE" >> $CHANGESET_FILE
        
        echo "Created first-release changeset for $PACKAGE"
        CHANGES_MADE=true
      else
        echo "Package $PACKAGE seems empty or incomplete. Skipping."
      fi
    else
      echo "No package directory found for $PACKAGE. Skipping."
    fi
  fi
done

# Report results
echo "changes_made=$CHANGES_MADE" >> $GITHUB_OUTPUT
if [ "$CHANGES_MADE" == "true" ]; then
  echo "Status: Changes were made"
else
  echo "Status: No changes were necessary"
fi 