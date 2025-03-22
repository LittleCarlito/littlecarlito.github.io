# Changesets

This project uses [changesets](https://github.com/changesets/changesets) for versioning and changelog management.

## Adding a Changeset

When you're making changes that should result in a version bump, you need to add a changeset:

```bash
pnpm change
```

This will:
1. Ask you which packages are affected by your changes
2. Ask what type of change it is (major, minor, patch)
3. Ask for a summary of the changes
4. Create a markdown file in the `.changeset` directory

Commit this file along with your changes. When your PR is merged to main, a new PR will be automatically created with version bumps.

## Types of Changes

- **major**: Breaking changes (incompatible API changes)
- **minor**: New features (backwards-compatible)
- **patch**: Bug fixes and small improvements (backwards-compatible)

## How Changesets Work

1. You make changes and add a changeset describing them
2. When your PR is merged to main, a "Version Packages" PR is created
3. When that PR is merged, packages are published automatically

## Release Process

The release process is automated:
1. Changesets bot creates a PR with version bumps and updated changelogs
2. When merged, packages are published to GitHub Packages
3. The website is automatically deployed if packages are published

## Fixed Versions

Our core packages are configured to use "fixed versioning", meaning they will always have the same version number:
- `@littlecarlito/blorkpack`
- `@littlecarlito/blorktools`
- `@littlecarlito/blorkboard`

## Ignored Packages

Some packages are ignored from the versioning process:
- `@littlecarlito/portfolio` (the main app)
