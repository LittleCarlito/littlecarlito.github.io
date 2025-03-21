// Basic validation tests that check for global THREE and RAPIER objects
// These are set up in the jest.setup.cjs file

test('THREE object is available globally', () => {
	expect(global.THREE).toBeDefined();
	// Add additional validation
	expect(global.THREE.REVISION).toBeDefined();
});

test('RAPIER object is available globally', () => {
	expect(global.RAPIER).toBeDefined();
	// Add additional validation
	expect(global.RAPIER.World).toBeDefined();
}); 