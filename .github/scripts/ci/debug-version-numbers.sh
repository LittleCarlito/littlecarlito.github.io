#!/bin/bash
# Debugging script for versioning in CI
# This script helps identify discrepancies between expected version numbers
# and what's actually in package.json files

set -e

echo "=== VERSION DIAGNOSTIC TOOL ==="
echo "This script helps debug versioning issues in CI pipelines"
echo ""

# Check if we're running in a GitHub Actions environment
if [[ -n "${GITHUB_ACTIONS}" ]]; then
  echo "Running in GitHub Actions"
  echo "Workflow: ${GITHUB_WORKFLOW}"
  echo "Event: ${GITHUB_EVENT_NAME}"
  echo "Ref: ${GITHUB_REF}"
  echo "SHA: ${GITHUB_SHA}"
fi

echo ""
echo "=== CURRENT BRANCH INFO ==="
git branch
CURRENT_BRANCH="$(git branch --show-current || echo "detached HEAD")"
echo "Current branch: ${CURRENT_BRANCH}"

echo ""
echo "=== PACKAGE VERSIONS ==="
# Find all package.json files in apps and packages
PACKAGE_JSONS="$(find apps packages -name "package.json" -not -path "*/node_modules/*" 2>/dev/null || echo "No packages found")"

for PKG_JSON in ${PACKAGE_JSONS}; do
  PKG_NAME="$(node -p "try { require('./${PKG_JSON}').name } catch(e) { 'ERROR' }")"
  PKG_VERSION="$(node -p "try { require('./${PKG_JSON}').version } catch(e) { 'ERROR' }")"
  echo "${PKG_NAME}: ${PKG_VERSION} (from ${PKG_JSON})"
done

echo ""
echo "=== CUSTOM VERSIONING OUTPUT ==="
echo "Running test-version to see what versions SHOULD be..."
pnpm test-version --branch="${CURRENT_BRANCH}" || echo "test-version command failed"

echo ""
echo "=== GIT TAGS ==="
echo "Existing version tags:"
git tag -l | grep -E '@[0-9]+\.[0-9]+\.[0-9]+' | sort

echo ""
echo "=== VERSION SCRIPTS ==="
echo "version-from-commits.js exists: $(test -f .github/scripts/versioning/version-from-commits.js && echo 'YES' || echo 'NO')"
echo "apply-custom-versions.js exists: $(test -f .github/scripts/versioning/apply-custom-versions.js && echo 'YES' || echo 'NO')"

echo ""
echo "=== CHANGESETS INFO ==="
echo "Changesets exist: $(test -d .changeset && echo 'YES' || echo 'NO')"
if [[ -d ".changeset" ]]; then
  echo "Changeset files:"
  ls -la .changeset
fi

echo ""
echo "=== VERSION DIAGNOSTIC COMPLETE ===" 