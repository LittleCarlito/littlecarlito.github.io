# @littlecarlito/blorkboard

## 1.2.0

### Minor Changes

- 35e96b6: Forcing test release

## 1.1.0

### Minor Changes

- 726bdfd: Switch from semantic-release to changesets for version management and GitHub releases

### Patch Changes

- 726bdfd: Remove semantic-release dependencies and configurations, completing migration to changesets
- 726bdfd: Migrated CI/CD workflows from semantic-release to changesets.

  This change:

  - Adds workflows for changesets (dryrun, unified-pipeline, release, prerelease)
  - Removes legacy semantic-release files and configurations
  - Updates Git identity configuration to use GitHub Actions bot
  - Simplifies publishing process with unified workflows
