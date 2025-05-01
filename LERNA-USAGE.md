# Lerna Usage Documentation

This project uses [Lerna](https://lerna.js.org/) for managing versioning and publishing packages. We've configured a custom setup that includes conventional commits and automated version bumping based on commit message formatting.

## Custom Configuration

We've implemented two key customizations:

1. **`slice` commit type**: A commit type for small, incremental changes that should trigger a patch version bump
2. **`pipeline` scope**: A specially designated scope that's ignored by the versioning system

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification with our custom extensions. The format is:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

Besides the standard conventional commit types (feat, fix, chore, etc.), we've added:

- `slice(<scope>)`: For incremental changes that should result in a patch version bump.

Examples of valid commit messages:

```
feat(ui): add new button component
fix(api): resolve timeout issue
slice(docs): improve API documentation
chore: update dependencies
```

### Scopes

Scopes are optional and can represent anything specific to your commit. However, we have a special rule:

#### Ignored Scope: `pipeline`

The `pipeline` scope is ignored for version bumping. This is useful for changes that only affect CI/CD or build processes and don't warrant a version bump.

Example of a commit that won't trigger a version bump:

```
feat(pipeline): add new GitHub Action workflow
fix(pipeline): update CI build steps
```

## Version Bumping Rules

The version bumping follows these rules:

1. `feat`: Triggers a **minor** version bump (0.x.0)
2. `fix`, `refactor`, `perf`, and `slice`: Trigger a **patch** version bump (0.0.x)
3. Any commit with a `BREAKING CHANGE` footer: Triggers a **major** version bump (x.0.0)
4. Any commit with a `pipeline` scope: **No version bump**

## Lerna Commands

### Checking Changes

```bash
pnpm lerna:changed
```

This command shows which packages have changes since the last release.

### Version Bump

```bash
pnpm lerna:version
```

This command:
1. Analyzes commit messages since the last release
2. Determines the appropriate version bump
3. Updates all package.json files
4. Creates a CHANGELOG.md entry
5. Creates a git tag
6. Commits the changes

### Publishing Packages

```bash
pnpm lerna:publish
```

This command publishes packages that have been versioned to the npm registry.

## Examples

Here are examples of how different commits would affect versioning:

| Commit Message | Version Bump | Explanation |
|----------------|--------------|-------------|
| `feat(ui): add new component` | Minor (0.x.0) | Adding a new feature |
| `fix(api): resolve timeout bug` | Patch (0.0.x) | Fixing a bug |
| `slice(docs): improve documentation` | Patch (0.0.x) | Small improvement |
| `chore: update dependencies` | No bump | Maintenance task |
| `feat(pipeline): add new CI job` | No bump | Pipeline scope is ignored |
| `feat!: redesign API` | Major (x.0.0) | Breaking change |

## Test it Out

To see how this works, make a change and commit it using one of the formats above, then run:

```bash
pnpm lerna:version --no-push
```

This will show you how Lerna would bump the version without actually pushing the changes. 