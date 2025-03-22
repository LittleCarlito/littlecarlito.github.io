---
"@littlecarlito/blorkpack": patch
"@littlecarlito/blorktools": patch
"@littlecarlito/blorkboard": patch
---

Migrated CI/CD workflows from semantic-release to changesets.

This change:
- Adds workflows for changesets (dryrun, unified-pipeline, release, prerelease)
- Removes legacy semantic-release files and configurations
- Updates Git identity configuration to use GitHub Actions bot
- Simplifies publishing process with unified workflows
