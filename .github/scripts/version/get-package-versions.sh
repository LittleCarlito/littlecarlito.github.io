#!/bin/bash
set -e

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script retrieves package versions from package.json files.

Options:
  --package-paths <paths>   Comma-separated list of package paths relative to root
  --package-names <names>   Optional comma-separated list of package names to use in output
  --help                    Display this help and exit

Example:
  $(basename "$0") --package-paths "packages/pkg1,packages/pkg2" --package-names "@org/pkg1,@org/pkg2"
EOF
}

# Default values
PACKAGE_PATHS=""
PACKAGE_NAMES=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --package-paths)
      PACKAGE_PATHS="$2"
      shift 2
      ;;
    --package-names)
      PACKAGE_NAMES="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$PACKAGE_PATHS" ]]; then
  echo "Error: package-paths is required" >&2
  show_help
  exit 1
fi

# Convert comma-separated paths to arrays
IFS=',' read -ra PATH_ARRAY <<< "$PACKAGE_PATHS"

# If package names provided, convert them to array
if [[ -n "$PACKAGE_NAMES" ]]; then
  IFS=',' read -ra NAME_ARRAY <<< "$PACKAGE_NAMES"
  # Check if arrays have same length
  if [[ ${#PATH_ARRAY[@]} -ne ${#NAME_ARRAY[@]} ]]; then
    echo "Error: Number of package paths and names do not match" >&2
    exit 1
  fi
fi

# Get versions for each package
echo "Retrieving versions for packages..." >&2
OUTPUT_VARS=""

for i in "${!PATH_ARRAY[@]}"; do
  PKG_PATH="${PATH_ARRAY[$i]}"
  
  # Derive package name from path if not provided
  if [[ -n "$PACKAGE_NAMES" ]]; then
    PKG_NAME="${NAME_ARRAY[$i]}"
  else
    # Extract name from the last part of the path
    PKG_NAME=$(basename "$PKG_PATH")
  fi
  
  # Remove any special characters for variable name
  VAR_NAME=$(echo "$PKG_NAME" | tr -cd '[:alnum:]_' | tr '[:upper:]' '[:lower:]')
  
  # Get version from package.json
  if [[ -f "$PKG_PATH/package.json" ]]; then
    # Use command substitution with redirection to avoid unintended output
    VERSION=$(node -p "require('./$PKG_PATH/package.json').version" 2>/dev/null || echo "unknown")
    echo "$PKG_NAME version: $VERSION" >&2
    
    # Output the version as a GitHub output variable
    echo "${VAR_NAME}_version=$VERSION"
    OUTPUT_VARS="${OUTPUT_VARS}${VAR_NAME}_version,"
  else
    echo "Warning: package.json not found at $PKG_PATH" >&2
    echo "${VAR_NAME}_version=unknown"
    OUTPUT_VARS="${OUTPUT_VARS}${VAR_NAME}_version,"
  fi
done

# Output the list of variable names we created (trimming trailing comma)
OUTPUT_VARS=${OUTPUT_VARS%,}
echo "output_vars=$OUTPUT_VARS"

echo "Version retrieval completed" >&2 