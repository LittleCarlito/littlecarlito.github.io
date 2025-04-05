#!/bin/bash
set -e

# Script to prepare packages for release
# Usage: prepare-for-releases.sh --package-paths "path1,path2" --package-names "name1,name2" [--debug true]

PACKAGE_PATHS=""
PACKAGE_NAMES=""
DEBUG="false"

# Parse command-line arguments
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
    --debug)
      DEBUG="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$PACKAGE_PATHS" ] || [ -z "$PACKAGE_NAMES" ]; then
  echo "ERROR: package-paths and package-names are required arguments"
  echo "Usage: prepare-for-releases.sh --package-paths 'path1,path2' --package-names 'name1,name2' [--debug true]"
  exit 1
fi

# Debug information
if [ "$DEBUG" == "true" ]; then
  echo "DEBUG MODE ENABLED"
  echo "Package paths: $PACKAGE_PATHS"
  echo "Package names: $PACKAGE_NAMES"
  echo "Current directory: $(pwd)"
fi

# Convert comma-separated lists to arrays
IFS=',' read -ra PATHS <<< "$PACKAGE_PATHS"
IFS=',' read -ra NAMES <<< "$PACKAGE_NAMES"

# Check if arrays have the same length
if [ ${#PATHS[@]} -ne ${#NAMES[@]} ]; then
  echo "ERROR: package-paths and package-names must have the same number of elements"
  exit 1
fi

# Prepare packages for release
for i in "${!PATHS[@]}"; do
  path="${PATHS[$i]}"
  name="${NAMES[$i]}"
  
  if [ ! -f "$path/package.json" ]; then
    echo "ERROR: package.json not found at $path"
    echo "ready_for_release=false"
    exit 1
  fi
  
  if [ "$DEBUG" == "true" ]; then
    echo "Preparing package: $name at $path"
  fi
done

echo "ready_for_release=true"
echo "packages_checked=${#PATHS[@]}" 