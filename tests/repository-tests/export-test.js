// Test importing THREE and RAPIER from the blorkpack package
const { THREE, RAPIER } = require('@littlecarlito/blorkpack');

// Basic validation tests that don't directly access THREE objects
test('THREE object is available', () => {
	expect(THREE).toBeDefined();
});

test('RAPIER object is available', () => {
	expect(RAPIER).toBeDefined();
}); 