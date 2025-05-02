# Versioning Workflow

This project uses [Lerna](https://lerna.js.org/) with [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning of packages.

## How It Works

The versioning system follows these steps:

1. **Local Development**:
   - Make changes to code
   - Commit with conventional commit messages:
     - `fix:` for bug fixes (patch version ↑)
     - `feat:` for new features (minor version ↑)
     - `feat!:` or `BREAKING CHANGE:` for breaking changes (major version ↑)

2. **When Pushing Changes**:
   - The pre-push hook detects uncommitted package version changes
   - If changes are found:
     - It runs `pnpm version:local-tags` to create full versioning with git tags
     - These changes and tags are automatically committed
     - Your branch is pushed with `--follow-tags` to include the tags

3. **GitHub Actions Workflow**:
   - The `push-create-pr.yml` workflow runs when you push a branch
   - It creates a PR to merge your branch (with its tags) into main
   - When the PR is merged, the tags from your branch go to main

4. **Main Pipeline**:
   - When changes are merged to main, the pipeline triggers the create-releases-and-publish action
   - The create-releases-and-publish action handles:
     - Creating GitHub releases for existing tags
     - Publishing packages to GitHub npm registry if new releases were created

## Available Commands

- `pnpm version:check` - Check if packages have changes that need versioning
- `pnpm version:update` - Update package versions without creating Git tags (manual use only)
- `pnpm version:local-tags` - Run full versioning including Git tag creation
- `pnpm lerna:publish` - Publish packages from existing tags

## Example Workflow

1. Make changes to a package
2. Commit with a message like `feat: add new button component`
3. Push your feature branch
   - Pre-push hook detects package changes
   - Lerna versions the packages and creates tags
   - Branch is pushed with tags
4. GitHub Actions creates a PR to merge your branch to main
5. When the PR is merged, the tags go to main
6. The create-releases-and-publish action runs as part of the main pipeline:
   - It creates GitHub releases for existing tags
   - Publishes packages to GitHub npm registry

## Important Notes

- **Don't manually update version numbers** in package.json files
- Always use conventional commit messages to trigger proper versioning
- Git tags are created locally on your branch before pushing
- The create-releases-and-publish action is designed to:
  - Create GitHub releases for existing tags
  - Publish packages to GitHub npm registry 