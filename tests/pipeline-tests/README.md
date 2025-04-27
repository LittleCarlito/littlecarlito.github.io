# Pipeline Tests

This directory contains tests for pipeline-related functionality including workflow validation and other CI/CD components.

## Workflow Validation Tests

These tests help ensure that our GitHub Actions workflow files are properly structured and aligned with our standards.

Tests verify that:
- Workflows use consistent job definitions
- Artifact naming follows standardized patterns
- Required steps are included in all workflows

## Running the Tests

Run all tests in this directory:

```
npm test -- tests/pipeline-tests
```

Run specific test file:

```
npm test -- tests/pipeline-tests/workflow-validation.test.js
```

## Best Practices

When adding new functionality:

1. Write unit tests that verify core behavior
2. Test edge cases and error conditions explicitly
3. Verify parameters are passed correctly between functions
4. Don't replace the original implementation in tests when possible
5. Use mocks for external dependencies
6. Run tests before submitting PRs 