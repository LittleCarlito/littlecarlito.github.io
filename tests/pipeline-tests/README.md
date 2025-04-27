# Pipeline Tests

This directory contains tests for pipeline-related functionality including versioning, workflow validation, and other CI/CD components.

## Versioning Tests

### Existing Tests (`version-packages.test.js`)

The `version-packages.test.js` file contains integration tests for the versioning system, but creates a modified version of the original script by:

1. Replacing the original implementation with test-specific code
2. Setting up a test directory structure
3. Testing basic behavior but not all edge cases

This approach doesn't catch certain types of errors like the reference error with `packageCommits` because it replaces the original implementation with a simplified one.

### Unit Tests (`version-packages-unit.test.js`)

The new `version-packages-unit.test.js` file:

- Directly tests the original implementation without replacement
- Mocks dependencies instead of creating test files
- Tests edge cases explicitly
- Would catch issues like undefined variables
- Specifically tests parameter passing between functions

## Why Proper Unit Testing Matters

The reference error in `updatePackageVersion` was not caught by the existing tests because:

1. The tests replaced the original implementation rather than testing it directly
2. No test verified that all required parameters were being passed to functions
3. Integration tests ran common paths but not edge cases

Proper unit tests should:

- Test functions in isolation to identify bugs in specific components
- Verify parameter handling including missing/invalid inputs
- Check core functionality while mocking external dependencies
- Test error conditions in addition to happy paths

## Running the Tests

Run all tests in this directory:

```
npm test -- tests/pipeline-tests
```

Run specific test file:

```
npm test -- tests/pipeline-tests/version-packages-unit.test.js
```

## Best Practices

When adding new functionality:

1. Write unit tests that verify core behavior
2. Test edge cases and error conditions explicitly
3. Verify parameters are passed correctly between functions
4. Don't replace the original implementation in tests when possible
5. Use mocks for external dependencies
6. Run tests before submitting PRs 