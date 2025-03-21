/**
 * Global Jest setup file
 * Provides necessary browser globals and common mocks for testing
 */

// Add TextEncoder/TextDecoder (required for THREE.js)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Ensure jest-canvas-mock is loaded
require('jest-canvas-mock');

// Mock window
global.window = {
	innerWidth: 800,
	innerHeight: 600
};

// Mock document
global.document = {
	body: {
		appendChild: jest.fn()
	}
};

// Mock performance
global.performance = {
	now: jest.fn(() => Date.now())
};

// Mock fetch
global.fetch = jest.fn(() => 
	Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve({
			name: 'Test Scene',
			description: 'Test Scene for Unit Tests',
			version: '1.0.0',
			custom_types: [],
			asset_groups: {
				environment: [],
				props: [],
				characters: []
			},
			scene: {
				background_color: '#000000',
				ambient_light: { intensity: 0.5, color: '#ffffff' }
			}
		})
	})
);

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(callback => setTimeout(callback, 0));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Set up common mocks for the blorkpack package
const mockThreeRapier = {
	THREE: {
		Vector3: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
		Quaternion: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })),
		Object3D: jest.fn(() => ({})),
		Scene: jest.fn(() => ({ 
			add: jest.fn(),
			traverse: jest.fn(callback => callback({})) 
		})),
		Mesh: jest.fn(() => ({})),
		BoxGeometry: jest.fn(),
		LineBasicMaterial: jest.fn(),
		MeshBasicMaterial: jest.fn(),
		EdgesGeometry: jest.fn(),
		LineSegments: jest.fn(),
		Line: jest.fn(),
		BufferGeometry: jest.fn(),
		Group: jest.fn(),
		Color: jest.fn(),
		REVISION: '149'
	},
	RAPIER: {
		World: jest.fn(() => ({ createRigidBody: jest.fn(), gravity: { y: -9.81 } })),
		init: jest.fn(() => Promise.resolve())
	}
};

// Register global mocks
jest.mock('packages/blorkpack/src/index.js', () => mockThreeRapier, { virtual: true });
jest.mock('packages/blorkpack/dist/index.js', () => mockThreeRapier, { virtual: true });

// Mock BLORKPACK_FLAGS
const mockFlags = {
	BLORKPACK_FLAGS: {
		COLLISION_VISUAL_DEBUG: false,
	}
};
jest.mock('packages/blorkpack/src/blorkpack_flags.js', () => mockFlags, { virtual: true });

// Mock AssetStorage
jest.mock('packages/blorkpack/src/asset_storage.js', () => ({
	AssetStorage: {
		get_instance: jest.fn(() => ({ get: jest.fn() })),
	}
}), { virtual: true });

// Mock wireframe_spawner
jest.mock('packages/blorkpack/src/asset_handler/spawners/debug_spawners/wireframe_spawner.js', () => ({
	create_debug_wireframe: jest.fn(() => Promise.resolve({})),
	update_debug_wireframes: jest.fn(),
	set_collision_debug: jest.fn(),
	create_debug_wireframes_for_all_bodies: jest.fn(),
	cleanup_wireframes: jest.fn(),
	get_debug_wireframes: jest.fn(() => []),
}), { virtual: true });

// Mock debug_mesh_spawner
jest.mock('packages/blorkpack/src/asset_handler/spawners/debug_spawners/debug_mesh_spawner.js', () => ({
	create_debug_mesh: jest.fn(() => Promise.resolve({})),
	update_debug_meshes: jest.fn(),
	forceSpotlightDebugUpdate: jest.fn(),
	despawn_debug_meshes: jest.fn(),
	cleanup_spotlight_debug_meshes: jest.fn(),
}), { virtual: true }); 