# Versioning with Changesets

This project uses [changesets](https://github.com/changesets/changesets) for versioning packages and generating changelogs.

## Overview

Changesets provides a simple way to manage versioning in a monorepo, with these key features:

- **Automated version bumping** based on semantic versioning principles
- **Changelog generation** for each package
- **GitHub integration** with automatic PR creation for version bumps
- **Fixed versioning** for related packages to ensure consistent version numbers
- **Workspace-aware** for managing monorepo dependencies

## Getting Started

When you make changes that should result in a version bump, you need to create a changeset:

```bash
pnpm change
```

This will guide you through selecting:
1. Which packages are affected
2. What type of change it is (major, minor, patch)
3. A description of the changes

## Workflow

1. **Make your changes** to the codebase
2. **Add a changeset** with `pnpm change`
3. **Commit the changeset** with your changes
4. **Create a PR** with your changes
5. When your PR is **merged to main**:
   - By default, packages are automatically versioned and published directly
   - GitHub releases and tags are created automatically
   - No additional PR steps are required (unless you've explicitly requested PR-based publishing)

You can optionally request PR-based publishing by including `create-pr: true` in your commit message footer (see Direct vs. PR-Based Publishing section for details).

## Understanding Version Types

- **major** (1.0.0 → 2.0.0): Breaking changes
- **minor** (1.0.0 → 1.1.0): New features (backward compatible)
- **patch** (1.0.0 → 1.0.1): Bug fixes and small improvements (backward compatible)

## Repository Configuration

Our changeset configuration is in `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [
    ["@littlecarlito/blorkpack", "@littlecarlito/blorktools", "@littlecarlito/blorkboard"]
  ],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@littlecarlito/portfolio"]
}
```

### Configuration Options Explained

- **changelog**: The module to generate changelogs
- **commit**: Whether to create a commit when versioning
- **fixed**: Groups of packages that always have the same version number
- **linked**: Groups of packages where a major version in one necessitates a major version in all
- **access**: Whether packages are public or restricted (applies to npm)
- **baseBranch**: The branch that PRs are created against
- **updateInternalDependencies**: How to update versions for internal dependencies
- **ignore**: Packages to ignore when versioning

## Package Groups

Our packages are configured to have "fixed versioning" which means they always have the same version:
- `@littlecarlito/blorkpack`
- `@littlecarlito/blorktools`
- `@littlecarlito/blorkboard`

## Ignored Packages

Some packages don't participate in versioning:
- `@littlecarlito/portfolio` (the main app)

## Automated Publishing

This repository is configured for fully automated versioning and publishing:

1. When a PR with changesets is merged to main, the unified pipeline will:
   - Detect the changesets
   - Automatically version the packages
   - **Directly publish to the GitHub registry** (default behavior)
   - Create GitHub releases with appropriate tags

This process happens completely automatically with no manual intervention required. The `PACKAGE_TOKEN` GitHub secret has the necessary permissions to handle this entire flow.

### Direct vs. PR-Based Publishing

By default, the pipeline uses **direct publishing**, which means:
- Version changes are committed directly to `main`
- Releases are created immediately
- No intermediate PR review step

If you want your changes to go through a PR review process before publishing, you can request this by adding a special footer to your commit message:

```
feat(scope): add new feature description

Detailed explanation of the feature...

create-pr: true
```

When this footer is detected, the pipeline will:
1. Create a PR with versioning changes
2. Wait for review and approval
3. Publish packages after the PR is merged

#### Commit Footer Format

The footer must:
- Appear after a blank line following the commit message body
- Use the exact format `create-pr: true`

#### Example Commit Messages

Direct Publishing (default):
```
feat(auth): add new login mechanism

Implement OAuth2 authentication flow with Google provider.
```

PR-Based Publishing:
```
feat(auth): add new login mechanism

Implement OAuth2 authentication flow with Google provider.

BREAKING CHANGE: Previous session tokens will be invalidated
Refs: #123
create-pr: true
```

#### When to Use PR-Based Publishing

Consider requesting PR-based publishing for:
- Complex version changes
- Breaking changes
- When you need to verify the exact version numbers
- When you're unsure about the versioning impact

## Workflow Organization

The repository uses several GitHub Actions workflows for different purposes:

1. **Unified Pipeline** - The primary workflow that runs on every push to main
   - Builds and tests packages
   - Automatically versions and publishes packages when changesets are present
   - Handles deployments to GitHub Pages
   - Runs automatically on merges to main
   - **Fully automated** - No manual intervention required

2. **Changesets** - Manual workflow for creating releases
   - Only runs when manually triggered
   - Should NOT run automatically on pushes to main
   - Not needed for normal workflow as unified pipeline handles publishing

3. **Prerelease** - For creating beta/alpha releases
   - Only runs when manually triggered

4. **Release** - For specific package releases
   - Only runs when manually triggered

When making changes to the main branch, only the Unified Pipeline should run automatically, which handles both versioning, publishing and deploying to GitHub Pages.

## GitHub Pages Deployment

This repository uses GitHub's official Pages deployment process:

1. The unified pipeline builds the site with the correct base URL (`GITHUB_PAGES=true` environment variable)
2. The site is uploaded as a GitHub Pages artifact
3. GitHub's official deployment action handles the deployment

Benefits of this approach:
- Uses GitHub's official Pages deployment action
- Avoids duplicate/competing deployments
- Shows proper deployment status in GitHub UI
- Creates a proper deployment environment with URL

## Manual Commands (if needed)

For advanced use cases, you can use these commands:

- Preview changes: `pnpm changeset status`
- Apply version updates: `pnpm version`
- Publish packages: `pnpm release`

## Benefits Over Previous Solution

Changesets offers significant advantages over our previous semantic-release setup:

- **More intuitive workflow** for developers
- **Better monorepo support** with proper handling of workspace dependencies
- **Simpler configuration** with less boilerplate
- **Improved PR workflow** with automatic version PR creation
- **More visibility** into upcoming version changes
- **Reduced CI complexity** with standardized workflows

When making changes to the main branch, only the Unified Pipeline should run automatically, which handles both versioning, publishing and deploying to GitHub Pages. 