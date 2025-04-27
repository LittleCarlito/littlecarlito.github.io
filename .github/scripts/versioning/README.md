# Commit-based Versioning System

This system automatically generates version updates for packages and apps based on commit messages when merging to `main`.

## How It Works

1. When a pull request is made to `main`, the PR Dry Run workflow:
   - Analyzes all commit messages in the PR
   - Shows version bumps that will occur in the PR description

2. When a pull request is merged to `main`, the Version and Release workflow:
   - Analyzes all commit messages in the PR
   - Creates changesets based on these commits
   - Updates versions in package.json files
   - Creates a version git tag
   - Pushes the changes back to the repository
   - Creates a GitHub release

## Commit Message Format

The system uses [Conventional Commits](https://www.conventionalcommits.org/) to determine version bumps:

```
<type>[(scope)]: <description>

[optional body]

[optional footer(s)]
```

### Types that affect versioning

- `feat`: New feature (minor bump)
- `fix`: Bug fix (patch bump)
- `perf`: Performance improvement (patch bump)
- `feat!`, `fix!` or any commit with `BREAKING CHANGE:` in the body: Breaking change (major bump)

### Scopes

- If no scope is specified, all packages and apps are bumped
- If a scope is specified (e.g., `feat(blorkpack): add cool feature`), only that package is bumped
- A scope of `pipeline` is ignored and doesn't trigger any version changes

### Available Scopes

- Packages: `blorkpack`, `blorktools`, `blorkboard`
- Apps: `portfolio`

## Examples

- `feat: add new awesome feature` - Minor bump for all packages/apps
- `fix(blorkpack): fix rendering issue` - Patch bump for blorkpack only
- `feat(blorktools)!: completely redesign API` - Major bump for blorktools only
- `chore(pipeline): update GitHub Actions` - No version changes (pipeline scope is ignored)
- `docs: update README` - No version changes (docs type doesn't affect versioning)

## Manual Triggering

You can manually trigger the versioning workflow:

1. Go to Actions > Version and Release > Run workflow
2. Set "Run in dry-run mode" to true to see what would happen without making changes

## How to Modify the Versioning System

The system consists of:

- `.changeset/config.json` - Changesets configuration
- `.github/scripts/versioning/version-from-commits.js` - Script to analyze commits and create changesets  
- `.github/scripts/pr/check-version-changes.js` - Script to analyze PR commits and update PR description
- `.github/workflows/version-and-release.yml` - Workflow that runs after merging to main
- `.github/workflows/pr-dryrun.yml` - Modified to show version bumps in PR descriptions

If you need to modify the versioning logic, start by editing the `version-from-commits.js` script. 