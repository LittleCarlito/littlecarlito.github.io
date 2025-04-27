# Testing Guidelines

This directory contains tests for the threejs_site project, organized by category.

## Test Directory Structure

- `pipeline-tests` - Tests for CI/CD pipelines and build processes
- `repository-tests` - Tests related to repo structure and configuration
- `lint-tests` - Tests for linting rules and code style
- `apps` - Tests for applications
- `packages` - Tests for individual packages

## Testing Best Practices

### Write Isolated Unit Tests

Good unit tests:
- Test a single function or component in isolation
- Mock external dependencies
- Have clear assertions
- Test both happy paths and error conditions
- Check edge cases

### Preventing Reference Errors

Reference errors like `packageCommits is not defined` can be prevented by:

1. Testing functions in isolation
2. Testing with both valid and missing parameters
3. Using TypeScript or JSDoc for type checking
4. Testing parameter passing between functions 

### Testing Functions That Call Other Functions

When testing functions that call other functions:

1. Create a specific test for each function in isolation
2. Mock the dependencies
3. Verify function calls with proper parameters

Example:
```javascript
// Test that function A passes correct parameters to function B
test('function A calls function B with correct parameters', () => {
  const mockB = jest.fn();
  const functionA = () => mockB('paramValue');
  
  functionA();
  
  expect(mockB).toHaveBeenCalledWith('paramValue');
});
```

### Integration Tests

Integration tests verify that modules work together correctly. For our versioning system:

1. Test the entire versioning flow end-to-end
2. Use real package files or realistic mocks
3. Verify final package versions are correct

### Running Tests

To run all tests:
```
npm test
```

To run tests for a specific directory:
```
npm test -- tests/pipeline-tests
```

To run a specific test file:
```
npm test -- tests/pipeline-tests/version-packages-unit.test.js
```

## Preventing Future Issues

1. Add tests for all new functionality
2. Test parameter passing between functions
3. Run tests before merging PRs
4. Consider using TypeScript for better type safety
5. Add integration tests for critical paths 