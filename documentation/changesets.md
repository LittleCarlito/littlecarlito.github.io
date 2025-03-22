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
5. When your PR is **merged to main**, a new PR will be created by the changesets bot with version bumps
6. When that PR is **merged**, packages will be automatically published

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

## GitHub Workflow

The GitHub workflow defined in `.github/workflows/changesets.yml` handles:

1. Running tests and building packages on PR and push to main
2. Creating a version PR when changesets are merged to main
3. Publishing packages when the version PR is merged
4. Deploying the website when new versions are published

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