// Test importing THREE and RAPIER from the blorkpack package
const { THREE, RAPIER } = require('../../packages/blorkpack/dist/index');

// Basic validation tests that don't directly access THREE objects
test('THREE object is available', () => {
	expect(THREE).toBeDefined();
});

test('RAPIER object is available', () => {
	expect(RAPIER).toBeDefined();
}); 