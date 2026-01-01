#!/bin/bash
set -e

echo "🔐 Logging into GitHub Container Registry..."

if [ -z "$GHCR_TOKEN" ]; then
  echo "❌ Error: GHCR_TOKEN environment variable is not set"
  exit 1
fi

if [ -z "$GHCR_USER" ]; then
  echo "❌ Error: GHCR_USER environment variable is not set"
  exit 1
fi

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

echo "✅ Successfully logged into GHCR"
