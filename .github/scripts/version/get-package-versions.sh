#!/bin/bash
set -e

# Help text
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: get-package-versions.sh [options]"
  echo ""
  echo "Options:"
  echo "  --package-paths <paths>   Comma-separated list of package paths relative to root"
  echo "  --package-names <names>   Optional comma-separated list of package names to use in output"
  echo ""
  exit 0
fi

# Default values
PACKAGE_PATHS=""
PACKAGE_NAMES=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --package-paths)
      PACKAGE_PATHS="$2"
      shift
      shift
      ;;
    --package-names)
      PACKAGE_NAMES="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$PACKAGE_PATHS" ]; then
  echo "Error: package-paths is required"
  exit 1
fi

# Convert comma-separated paths to arrays
IFS=',' read -ra PATH_ARRAY <<< "$PACKAGE_PATHS"

# If package names provided, convert them to array
if [ -n "$PACKAGE_NAMES" ]; then
  IFS=',' read -ra NAME_ARRAY <<< "$PACKAGE_NAMES"
  # Check if arrays have same length
  if [ ${#PATH_ARRAY[@]} -ne ${#NAME_ARRAY[@]} ]; then
    echo "Error: Number of package paths and names do not match"
    exit 1
  fi
fi

# Initialize output text
OUTPUT=""
OUTPUT_VARS=""

# Get versions for each package
for i in "${!PATH_ARRAY[@]}"; do
  PKG_PATH="${PATH_ARRAY[$i]}"
  
  # Derive package name from path if not provided
  if [ -n "$PACKAGE_NAMES" ]; then
    PKG_NAME="${NAME_ARRAY[$i]}"
  else
    # Extract name from the last part of the path
    PKG_NAME=$(basename "$PKG_PATH")
  fi
  
  # Remove any special characters for variable name
  VAR_NAME=$(echo "$PKG_NAME" | tr -cd '[:alnum:]_' | tr '[:upper:]' '[:lower:]')
  
  # Get version from package.json
  if [ -f "$PKG_PATH/package.json" ]; then
    VERSION=$(node -p "require('./$PKG_PATH/package.json').version")
    echo "$PKG_NAME version: $VERSION"
    
    # Add to outputs
    echo "${VAR_NAME}_version=$VERSION" >> $GITHUB_OUTPUT
    OUTPUT="${OUTPUT}${PKG_NAME}: ${VERSION}\n"
    OUTPUT_VARS="${OUTPUT_VARS}${VAR_NAME}_version,"
  else
    echo "Warning: package.json not found at $PKG_PATH"
    echo "${VAR_NAME}_version=unknown" >> $GITHUB_OUTPUT
    OUTPUT="${OUTPUT}${PKG_NAME}: unknown (package.json not found)\n"
    OUTPUT_VARS="${OUTPUT_VARS}${VAR_NAME}_version,"
  fi
done

# Output the list of variable names we created
OUTPUT_VARS=${OUTPUT_VARS%,} # Remove trailing comma
echo "output_vars=$OUTPUT_VARS" >> $GITHUB_OUTPUT

echo -e "Package versions:\n$OUTPUT" 