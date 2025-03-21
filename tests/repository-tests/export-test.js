// Test importing THREE and RAPIER from the blorkpack package
import { THREE, RAPIER } from '../../packages/blorkpack/dist/index.js';

// Basic validation tests that don't directly access THREE objects
test('THREE object is available', () => {
	expect(THREE).toBeDefined();
});

test('RAPIER object is available', () => {
	expect(RAPIER).toBeDefined();
}); 