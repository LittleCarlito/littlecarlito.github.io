#!/bin/bash
set -e

echo "🐳 Starting blorktools Docker image publish check..."

dry_run=false
verbose=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
  --dry-run) dry_run=true ;;
  --verbose) verbose=true ;;
  *)
    echo "Unknown parameter: $1"
    exit 1
    ;;
  esac
  shift
done

PACKAGE_NAME="@littlecarlito/blorktools"
IMAGE_NAME="ghcr.io/littlecarlito/blorktools-debugger"
DOCKERFILE_PATH="packages/blorktools/Dockerfile"

echo "🔍 Finding latest blorktools tag..."
latest_tag=$(git tag | grep "^${PACKAGE_NAME}@" | sort -V | tail -n 1 || echo "")

if [ -z "$latest_tag" ]; then
  echo "⚠️ No blorktools tags found, skipping Docker publish"
  exit 0
fi

version=$(echo "$latest_tag" | sed "s|${PACKAGE_NAME}@||")
echo "📦 Latest blorktools version: $version"

echo "🔍 Checking if ${IMAGE_NAME}:${version} already exists..."
if docker manifest inspect "${IMAGE_NAME}:${version}" >/dev/null 2>&1; then
  echo "✅ Docker image ${IMAGE_NAME}:${version} already exists, skipping"
  exit 0
fi

echo "🆕 New version detected, building Docker image..."

if [ "$dry_run" = true ]; then
  echo "[DRY RUN] Would build: ${IMAGE_NAME}:${version}"
  echo "[DRY RUN] Would push: ${IMAGE_NAME}:${version}"
  echo "[DRY RUN] Would push: ${IMAGE_NAME}:latest"
  exit 0
fi

echo "🏗️ Building Docker image..."
docker build -f "$DOCKERFILE_PATH" -t "${IMAGE_NAME}:${version}" -t "${IMAGE_NAME}:latest" .

echo "📤 Pushing ${IMAGE_NAME}:${version}..."
docker push "${IMAGE_NAME}:${version}"

echo "📤 Pushing ${IMAGE_NAME}:latest..."
docker push "${IMAGE_NAME}:latest"

echo "✅ Docker image published successfully!"
echo "   - ${IMAGE_NAME}:${version}"
echo "   - ${IMAGE_NAME}:latest"
