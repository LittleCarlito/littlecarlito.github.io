# Semantic Versioning Guide

This project uses semantic versioning to automatically manage version numbers and create releases based on commit messages.

## How It Works

When commits are pushed to the `main` branch, our CI/CD pipeline automatically:

1. Analyzes commit messages to determine if a new release is needed
2. Decides what type of version bump to make (major, minor, patch)
3. Updates version numbers in package.json files
4. Creates git tags for the new versions
5. Updates CHANGELOG.md files
6. Creates GitHub releases

## Commit Message Format

To trigger semantic versioning, your commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[(scope)]: <description>

[optional body]

[optional footer(s)]
```

Note: The scope is optional but helpful for organizing changes.

### Types

The commit type determines what kind of version change will happen:

| Type       | Description                                            | Release    |
|------------|--------------------------------------------------------|------------|
| `feat`     | A new feature                                          | minor      |
| `fix`      | A bug fix                                              | patch      |
| `perf`     | A performance improvement                              | patch      |
| `docs`     | Documentation updates                                  | patch      |
| `style`    | Code style changes (formatting, etc.)                  | patch      |
| `refactor` | Code changes that neither fix bugs nor add features    | patch      |
| `test`     | Adding or updating tests                               | patch      |
| `chore`    | Changes to build process, tools, etc.                  | patch      |
| `build`    | Changes to build system                                | patch      |

### Scopes

Scopes help identify which part of the codebase is affected:

- `blorkpack` - Changes to the blorkpack package
- `blorktools` - Changes to the blorktools package
- `common` - Changes to shared code
- `core` - Changes to core functionality
- `docs` - Documentation changes
- `release` - Release-related changes
- `no-release` - Changes that should NOT trigger a release

## Examples

```
feat: add new rendering system
```
This will trigger a minor version bump.

```
feat(blorkpack): add new rendering system
```
This will trigger a minor version bump for the blorkpack package.

```
fix(blorktools): resolve issue with config parser
```
This will trigger a patch version bump for the blorktools package.

```
fix: resolve issue with config parser
```
This will trigger a patch version bump.

```
docs(no-release): update README
```
This will NOT trigger a version bump due to the `no-release` scope.

## Tools to Help You

### Git Hooks

We've set up git hooks to help validate your commit messages:

- **pre-commit**: Runs linters and tests before allowing a commit
- **commit-msg**: Validates that your commit message follows the conventional format
- **pre-push**: Runs a dry run of semantic-release to show what would be released

### NPM Scripts

```bash
# Check what would be released without actually doing a release
pnpm run version-check
```

## Troubleshooting

If you're having issues with semantic versioning:

1. Make sure your commit messages follow the correct format
2. Check if you're using a valid type and scope
3. If you don't want to trigger a release, use the `no-release` scope
4. Run `pnpm run version-check` to see what would be released

## Further Reading

- [Semantic Versioning Specification](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/semantic-release/)