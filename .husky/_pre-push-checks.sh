#!/usr/bin/env bash
# Pre-push checks without handling the actual push

# Shell environment debug info
echo "Shell: $SHELL"
echo "Bash version: $BASH_VERSION"

# Parse command-line arguments and capture the original git arguments
DRY_RUN=false
PUSH_TAGS=true
ORIGINAL_REMOTE=""
ORIGINAL_BRANCH=""

# Store the original git arguments
# The first two arguments passed to pre-push are the remote name and URL
ORIGINAL_REMOTE="$1"
ORIGINAL_REMOTE_URL="$2"

# Capture the ref information from STDIN (what git provides to pre-push hooks)
# Format: local_ref local_sha remote_ref remote_sha
# But when called directly, don't wait for stdin input
if [ -t 0 ]; then
  # Terminal is interactive, don't try to read stdin
  REF_INFO=""
else
  # Read from stdin when it has data (like when Git calls the hook)
  REF_INFO=$(cat)
fi

# Extract the branch name from the ref (assuming format refs/heads/branch-name)
if [ -n "$REF_INFO" ]; then
  LOCAL_REF=$(echo "$REF_INFO" | cut -d' ' -f1)
  REMOTE_REF=$(echo "$REF_INFO" | cut -d' ' -f3)
  ORIGINAL_BRANCH=$(echo "$LOCAL_REF" | sed 's|refs/heads/||')
  REMOTE_BRANCH=$(echo "$REMOTE_REF" | sed 's|refs/heads/||')
  echo "Pushing branch $ORIGINAL_BRANCH to $REMOTE_BRANCH on $ORIGINAL_REMOTE"
else
  echo "No ref information provided, will use current branch"
  ORIGINAL_BRANCH=$(git symbolic-ref --short HEAD)
  REMOTE_BRANCH="$ORIGINAL_BRANCH"
  echo "Using current branch: $ORIGINAL_BRANCH"
fi

# Check for command-line arguments
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=true
    echo "🔬 DRY RUN MODE ENABLED - No changes will be committed or pushed"
  fi
  if [ "$arg" = "--no-tags" ]; then
    PUSH_TAGS=false
    echo "🏷️ TAGS WILL NOT BE PUSHED"
  fi
done

# Check if we should skip tests
SKIP_TESTS=${SKIP_TESTS:-false}
if [ "$SKIP_TESTS" = "true" ]; then
  echo "⏩ SKIPPING TESTS"
fi

# Change to repository root directory to ensure commands work correctly
cd "$(git rev-parse --show-toplevel)" || {
    echo "❌ Failed to change to repository root directory"
    exit 1
}

echo "🔍 Running pre-push checks..."

# First, verify the lockfile is in sync with package.json
echo "Verifying lockfile integrity..."
# Check if lockfile is out of sync using pnpm's lockfile-report
pnpm install --frozen-lockfile --prefer-offline --lockfile-only > /dev/null 2>&1
LOCKFILE_STATUS=$?

if [ $LOCKFILE_STATUS -ne 0 ]; then
    echo "⚠️ Lockfile is out of sync with package.json."
    if [ "$DRY_RUN" = true ]; then
        echo "🔬 [DRY RUN] Would update lockfile and commit changes"
    else
        echo "🔧 Automatically updating lockfile..."
        
        # Update lockfile
        pnpm install --no-frozen-lockfile
        
        # Commit the changes
        git add pnpm-lock.yaml
        git commit -m "chore: update lockfile to match package.json"
        
        echo "✅ Lockfile updated and changes committed! Continuing with push..."
    fi
else
    echo "✅ Lockfile is in sync with package.json"
fi

# Check if there are uncommitted package version changes
echo "Checking for uncommitted package version changes..."
UNCOMMITTED_VERSIONS=$(git diff --name-only --diff-filter=M -- "**/package.json" | wc -l)
if [ "$UNCOMMITTED_VERSIONS" -gt 0 ]; then
    echo "⚠️ Found uncommitted package version changes in package.json file(s)"
    git diff --name-only --diff-filter=M -- "**/package.json"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        echo "🔬 [DRY RUN] Would run automatic versioning"
    else
        # Check for existing remote tags before creating new ones
        echo "🔍 Checking for existing remote tags..."
        git fetch --tags
        
        # Get a list of packages with version changes
        CHANGED_PACKAGES=$(git diff --name-only --diff-filter=M -- "**/package.json" | xargs dirname)
        WILL_CREATE_TAGS=false
        
        for pkg_dir in $CHANGED_PACKAGES; do
            PKG_NAME=$(node -e "console.log(require('./$pkg_dir/package.json').name)")
            PKG_VERSION=$(node -e "console.log(require('./$pkg_dir/package.json').version)")
            POTENTIAL_TAG="$PKG_NAME@$PKG_VERSION"
            
            # Check if this tag already exists remotely
            if git ls-remote --tags origin "refs/tags/$POTENTIAL_TAG" | grep -q "$POTENTIAL_TAG"; then
                echo "⚠️ Tag $POTENTIAL_TAG already exists on the remote repository. Skipping version creation."
            else
                echo "✅ No existing tag found for $POTENTIAL_TAG. Will proceed with version creation."
                WILL_CREATE_TAGS=true
            fi
        done
        
        if [ "$WILL_CREATE_TAGS" = "true" ]; then
            echo "🏷️ Running full versioning with tag creation..."
            # Run lerna version with tag creation for all branches
            # Use the ignore-scripts flag to avoid running the version script from package.json
            pnpm version:local-tags
            
            # Re-stage any changes made by lerna
            git add .
            git commit -m "chore(release): publish [skip ci]" || echo "No changes to commit"
            
            echo "✅ Versioning completed! Tags created before push."
            
            # Set flag to push with tags
            PUSH_WITH_TAGS="true"
        else
            echo "⏩ Skipping versioning since all necessary tags already exist."
        fi
    fi
else
    # Check for version-worthy commits since last tag
    echo "Checking for version-worthy commits since last tag..."
    
    # Get the latest tag
    LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [ -n "$LATEST_TAG" ]; then
        # Check for feat: or fix: commits since the last tag
        VERSION_WORTHY=$(git log $LATEST_TAG..HEAD --grep="^feat\|^fix" --oneline | wc -l | tr -d '[:space:]')
        
        if [ "$VERSION_WORTHY" -gt 0 ]; then
            echo "🔍 Found $VERSION_WORTHY version-worthy commits since last tag:"
            git log $LATEST_TAG..HEAD --grep="^feat\|^fix" --oneline
            
            if [ "$DRY_RUN" = true ]; then
                echo "🔬 [DRY RUN] Would run version:by-message"
            else
                echo "🏷️ Running versioning based on commit messages..."
                pnpm version:by-message
                
                # Re-stage any changes made by lerna
                git add .
                git commit -m "chore(release): publish [skip ci]" || echo "No changes to commit"
                
                echo "✅ Versioning completed! Tags created before push."
                
                # Set flag to push with tags
                PUSH_WITH_TAGS="true"
            fi
        else
            echo "✅ No version-worthy commits found since last tag"
        fi
    else
        echo "⚠️ No tags found. To create initial tags, run 'pnpm version:by-message' manually."
    fi
fi

# Check if we should push tags with this branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
PUSH_WITH_TAGS=""

if [ "$PUSH_TAGS" = true ]; then
    # First check if there are any local tags that point to HEAD
    LOCAL_HEAD_TAGS=$(git tag -l --points-at HEAD | wc -l | tr -d '[:space:]')
    
    if [ "$LOCAL_HEAD_TAGS" -gt 0 ]; then
        echo "🏷️ Found $LOCAL_HEAD_TAGS local tag(s) for the current commit"
        git tag -l --points-at HEAD
        PUSH_WITH_TAGS="true"
    else
        echo "✅ No new tags pointing to current HEAD"
        
        # If no HEAD tags, check for any local tags that don't exist on remote
        echo "🔍 Checking for historical local tags not on remote..."
        # Fetch all remote tags for comparison
        git fetch --tags origin
        
        # Get count of local tags that don't exist on remote
        git tag | sort > /tmp/local_tags
        git ls-remote --tags origin | grep -v '\^{}' | awk '{print $2}' | sed 's|refs/tags/||' | sort > /tmp/remote_tags
        LOCAL_ONLY_HISTORICAL_TAGS=$(comm -23 /tmp/local_tags /tmp/remote_tags | wc -l | tr -d '[:space:]')
        
        if [ "$LOCAL_ONLY_HISTORICAL_TAGS" -gt 0 ]; then
            echo "🏷️ Found $LOCAL_ONLY_HISTORICAL_TAGS local tag(s) not on remote"
            # List the tags for visibility
            comm -23 /tmp/local_tags /tmp/remote_tags
            PUSH_WITH_TAGS="true"
        else
            echo "✅ No local tags ahead of remote"
        fi
    fi
else
    echo "⏩ Tag pushing is disabled, only pushing branch"
fi

export PUSH_WITH_TAGS

# Check for changes outside development/ and public/ directories
echo "Checking for relevant file changes..."

# Get files changed between base commit and HEAD
CHANGED_FILES=$(git diff --name-only HEAD^ HEAD)
if [ $? -ne 0 ]; then
    echo "❌ Error getting changed files. This might happen if you're pushing a new branch."
    echo "Proceeding with tests to be safe..."
    RUN_TESTS=true
else
    # Flag to indicate if we need to run tests
    RUN_TESTS=false

    # Use a different approach to avoid subshell issues
    for file in $CHANGED_FILES; do
        # Skip empty lines
        [ -z "$file" ] && continue
        
        # Check if file is NOT in development/ or public/ directories
        if ! [[ "$file" =~ ^(development/|public/) ]]; then
            echo "🔍 Found change in $file - will run pipeline tests"
            RUN_TESTS=true
        fi
    done
fi

# Set RUN_TESTS to false if SKIP_TESTS is true
if [ "$SKIP_TESTS" = "true" ]; then
    RUN_TESTS=false
    echo "⏩ Test execution has been skipped due to SKIP_TESTS=true flag"
fi

if [ "$RUN_TESTS" = true ]; then
    # Check if .github directory has changes
    GITHUB_DIR_CHANGES=$(git diff --name-only HEAD^ HEAD 2>/dev/null | grep -c "^\.github/" || echo "0")
    
    # Only run workflow validation if .github directory has changes
    if [ "${GITHUB_DIR_CHANGES:-0}" -gt 0 ]; then
        echo "🔍 Changes detected in .github directory, validating workflows..."
        
        # Run the new validation script
        if [ -f "tests/pipeline-tests/validate-github-actions.sh" ]; then
            echo "Running GitHub Actions validator..."
            ./tests/pipeline-tests/validate-github-actions.sh || {
                echo "❌ GitHub Actions validation failed."
                echo "Please fix workflow syntax issues before pushing."
                exit 1
            }
        fi
        
        # Also run existing workflow alignment validator if available
        if [ -f ".github/scripts/pr/validate-workflow-alignment.sh" ]; then
            echo "Running workflow alignment validation..."
            ./.github/scripts/pr/validate-workflow-alignment.sh || {
                echo "❌ Workflow alignment validation failed."
                echo "Please fix workflow alignment issues before pushing."
                exit 1
            }
        else
            echo "⚠️ Workflow alignment script not found at .github/scripts/pr/validate-workflow-alignment.sh"
            echo "Skipping workflow alignment validation."
        fi
    else
        echo "✅ No changes in .github directory, skipping workflow validation."
    fi
    
    # Run build to ensure it succeeds - MOVED HERE BEFORE TESTS
    echo "🏗️ Running build..."
    pnpm build
    BUILD_STATUS=$?
    echo "Build command exited with status: $BUILD_STATUS"
    
    if [ $BUILD_STATUS -ne 0 ]; then
        echo "❌ Build failed. Please fix build issues before pushing."
        exit 1
    fi
    echo "✅ Build passed!"
    
    # Run unified pipeline with logging
    echo "🚀 Running unified pipeline test with full logging..."
    pnpm test
    TEST_STATUS=$?
    echo "Test command exited with status: $TEST_STATUS"
    
    if [ $TEST_STATUS -ne 0 ]; then
        echo "❌ Pipeline test failed. See output above for details."
        exit 1
    fi
    
    # Explicitly indicate tests passed
    echo "✅ Pipeline tests passed!"
fi

# Everything is good to go - exit with success
exit 0 