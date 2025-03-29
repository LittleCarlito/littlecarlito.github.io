#!/bin/bash

# Script to validate that PR workflow (dryrun.yml) and main workflow (unified-pipeline.yml) 
# are properly aligned to catch issues before they reach production

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "🔍 Validating workflow alignment between PR workflow and main pipeline..."

# Define paths
DRYRUN_WORKFLOW=".github/workflows/dryrun.yml"
MAIN_WORKFLOW=".github/workflows/unified-pipeline.yml"

# Check if files exist
if [ ! -f "$DRYRUN_WORKFLOW" ]; then
  echo -e "${RED}Error: $DRYRUN_WORKFLOW does not exist${NC}"
  exit 1
fi

if [ ! -f "$MAIN_WORKFLOW" ]; then
  echo -e "${RED}Error: $MAIN_WORKFLOW does not exist${NC}"
  exit 1
fi

# Arrays to track validation results
FAILURES=()
WARNINGS=()

# Validate environment variables
echo -e "\n${YELLOW}Validating environment variables...${NC}"
echo "Debug: Let's see what variables are in each file:"
echo "PR variables:"
grep -A 5 "env:" "$DRYRUN_WORKFLOW" || echo "No top-level env section found"
echo "Main variables:"
grep -A 5 "env:" "$MAIN_WORKFLOW" || echo "No top-level env section found"

# Just check that both files have the BUILD_ARTIFACT_NAME variable
PR_HAS_BUILD_VAR=$(grep -c "BUILD_ARTIFACT_NAME:" "$DRYRUN_WORKFLOW")
MAIN_HAS_BUILD_VAR=$(grep -c "BUILD_ARTIFACT_NAME:" "$MAIN_WORKFLOW")

if [ "$PR_HAS_BUILD_VAR" -eq 0 ] || [ "$MAIN_HAS_BUILD_VAR" -eq 0 ]; then
  FAILURES+=("BUILD_ARTIFACT_NAME variable missing in one or both workflows")
else
  echo -e "${GREEN}✓ Both workflows define BUILD_ARTIFACT_NAME variable${NC}"
fi

# Check for PACKAGES_ARTIFACT_NAME too
PR_HAS_PACKAGE_VAR=$(grep -c "PACKAGES_ARTIFACT_NAME:" "$DRYRUN_WORKFLOW")
MAIN_HAS_PACKAGE_VAR=$(grep -c "PACKAGES_ARTIFACT_NAME:" "$MAIN_WORKFLOW")

if [ "$PR_HAS_PACKAGE_VAR" -eq 0 ] || [ "$MAIN_HAS_PACKAGE_VAR" -eq 0 ]; then
  FAILURES+=("PACKAGES_ARTIFACT_NAME variable missing in one or both workflows")
else
  echo -e "${GREEN}✓ Both workflows define PACKAGES_ARTIFACT_NAME variable${NC}"
fi

# Validate job outputs
echo -e "\n${YELLOW}Validating job outputs...${NC}"
PR_JOB_OUTPUT=$(grep -A 3 "outputs:" "$DRYRUN_WORKFLOW" | grep "build_artifact_name:")
MAIN_JOB_OUTPUT=$(grep -A 3 "outputs:" "$MAIN_WORKFLOW" | grep "build_artifact_name:")

if [ -z "$PR_JOB_OUTPUT" ] || [ -z "$MAIN_JOB_OUTPUT" ]; then
  FAILURES+=("Job output structure missing in one or both workflows")
else
  echo -e "${GREEN}✓ Both workflows define job outputs${NC}"
fi

# Validate artifact usage pattern
echo -e "\n${YELLOW}Validating artifact usage pattern...${NC}"
PR_ARTIFACT_UPLOAD=$(grep -c "upload-artifact@v4" "$DRYRUN_WORKFLOW")
MAIN_ARTIFACT_UPLOAD=$(grep -c "upload-artifact@v4" "$MAIN_WORKFLOW")

PR_ARTIFACT_DOWNLOAD=$(grep -c "download-artifact@v4" "$DRYRUN_WORKFLOW")
MAIN_ARTIFACT_DOWNLOAD=$(grep -c "download-artifact@v4" "$MAIN_WORKFLOW")

if [ "$PR_ARTIFACT_UPLOAD" -lt "$MAIN_ARTIFACT_UPLOAD" ]; then
  WARNINGS+=("PR workflow has fewer artifact upload steps ($PR_ARTIFACT_UPLOAD) than main workflow ($MAIN_ARTIFACT_UPLOAD)")
else
  echo -e "${GREEN}✓ PR workflow has adequate artifact upload steps${NC}"
fi

if [ "$PR_ARTIFACT_DOWNLOAD" -lt "$MAIN_ARTIFACT_DOWNLOAD" ]; then
  WARNINGS+=("PR workflow has fewer artifact download steps ($PR_ARTIFACT_DOWNLOAD) than main workflow ($MAIN_ARTIFACT_DOWNLOAD)")
else
  echo -e "${GREEN}✓ PR workflow has adequate artifact download steps${NC}"
fi

# Validate validation steps
echo -e "\n${YELLOW}Validating artifact validation steps...${NC}"
PR_VALIDATION=$(grep -c "Validating.*artifacts" "$DRYRUN_WORKFLOW")
MAIN_VALIDATION=$(grep -c "Validating.*artifacts" "$MAIN_WORKFLOW")

if [ "$PR_VALIDATION" -lt 1 ]; then
  FAILURES+=("PR workflow is missing artifact validation steps")
else
  echo -e "${GREEN}✓ PR workflow has $PR_VALIDATION artifact validation steps${NC}"
fi

# Validate if-no-files-found error settings
echo -e "\n${YELLOW}Validating if-no-files-found settings...${NC}"
PR_ERROR_CHECK=$(grep -c "if-no-files-found: error" "$DRYRUN_WORKFLOW")
MAIN_ERROR_CHECK=$(grep -c "if-no-files-found: error" "$MAIN_WORKFLOW")

if [ "$PR_ERROR_CHECK" -lt "$MAIN_ERROR_CHECK" ]; then
  FAILURES+=("PR workflow has fewer if-no-files-found: error checks ($PR_ERROR_CHECK) than main workflow ($MAIN_ERROR_CHECK)")
else
  echo -e "${GREEN}✓ PR workflow has adequate error checks${NC}"
fi

# Output results
echo -e "\n${YELLOW}Validation Results:${NC}"

if [ ${#FAILURES[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Workflows are properly aligned.${NC}"
  exit 0
else
  if [ ${#FAILURES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failures found:${NC}"
    for failure in "${FAILURES[@]}"; do
      echo -e "${RED}- $failure${NC}"
    done
  fi
  
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️ Warnings found:${NC}"
    for warning in "${WARNINGS[@]}"; do
      echo -e "${YELLOW}- $warning${NC}"
    done
  fi
  
  if [ ${#FAILURES[@]} -gt 0 ]; then
    echo -e "\n${RED}❌ Validation failed. Please fix the issues before continuing.${NC}"
    exit 1
  else
    echo -e "\n${YELLOW}⚠️ Validation completed with warnings. Review recommended.${NC}"
    exit 0
  fi
fi 