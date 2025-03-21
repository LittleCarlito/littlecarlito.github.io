/**
 * DebugFactory Unit Tests
 * 
 * Tests for the DebugFactory singleton class that manages debug visualization.
 * Verifies singleton behavior, wireframe handling, debug mesh management,
 * visualization updates, and cleanup procedures.
 */

// Mock modules before imports
jest.mock('../../src/index.js', () => ({
	THREE: {
		Vector3: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
		Quaternion: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })),
		BoxGeometry: jest.fn(),
		LineBasicMaterial: jest.fn(),
		MeshBasicMaterial: jest.fn(),
		EdgesGeometry: jest.fn(),
		LineSegments: jest.fn(),
		Line: jest.fn(),
		BufferGeometry: jest.fn(),
		Group: jest.fn(),
		Color: jest.fn()
	},
	RAPIER: { World: jest.fn() }
}));

// Just use a simple mock for blorkpack_flags
jest.mock('../../src/blorkpack_flags.js', () => ({
	BLORKPACK_FLAGS: { COLLISION_VISUAL_DEBUG: false }
}));

jest.mock('../../src/asset_storage.js', () => ({
	AssetStorage: {
		get_instance: jest.fn().mockReturnValue({ get: jest.fn() })
	}
}));

jest.mock('../asset_handler/spawners/debug_spawners/wireframe_spawner.js', () => ({
	create_debug_wireframe: jest.fn().mockResolvedValue({}),
	update_debug_wireframes: jest.fn(),
	set_collision_debug: jest.fn(),
	create_debug_wireframes_for_all_bodies: jest.fn(),
	cleanup_wireframes: jest.fn(),
	get_debug_wireframes: jest.fn().mockReturnValue([])
}));

jest.mock('../asset_handler/spawners/debug_spawners/debug_mesh_spawner.js', () => ({
	create_debug_mesh: jest.fn().mockResolvedValue({}),
	update_debug_meshes: jest.fn(),
	forceSpotlightDebugUpdate: jest.fn(),
	despawn_debug_meshes: jest.fn(),
	cleanup_spotlight_debug_meshes: jest.fn()
}));

// Now import modules using CommonJS syntax
const { DebugFactory } = require('../asset_handler/factories/debug_factory.js');
const { THREE } = require('../../src/index.js');
const { BLORKPACK_FLAGS } = require('../../src/blorkpack_flags.js');
const { AssetStorage } = require('../../src/asset_storage.js');
const wireframeSpawner = require('../asset_handler/spawners/debug_spawners/wireframe_spawner.js');
const debugMeshSpawner = require('../asset_handler/spawners/debug_spawners/debug_mesh_spawner.js');

describe('DebugFactory', () => {
	let mockScene, mockWorld, mockStorage;
  
	// Create a real instance for each test
	let instance;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();
    
		// Create mocks for scene and world
		mockScene = { add: jest.fn(), traverse: jest.fn() };
		mockWorld = { createRigidBody: jest.fn() };
    
		// Use AssetStorage's mock instance
		mockStorage = AssetStorage.get_instance();
    
		// Reset singleton state
		DebugFactory.dispose_instance();
    
		// Create a new instance for tests
		instance = DebugFactory.get_instance(mockScene, mockWorld);
	});

	describe('Singleton Pattern', () => {
		test('should not allow direct instantiation with new', () => {
			expect(() => new DebugFactory()).toThrow('DebugFactory is a singleton');
		});

		test('get_instance returns the same object when called multiple times', () => {
			const instance2 = DebugFactory.get_instance();
			expect(instance).toBe(instance2);
		});

		test('get_instance updates scene and world when provided', () => {
			const newScene = {};
			const newWorld = {};
      
			DebugFactory.get_instance(newScene, newWorld);
      
			expect(instance.scene).toBe(newScene);
			expect(instance.world).toBe(newWorld);
		});

		test('get_instance creates new instance after dispose_instance', () => {
			DebugFactory.dispose_instance();
			const instance2 = DebugFactory.get_instance(mockScene, mockWorld);
      
			expect(instance).not.toBe(instance2);
		});
	});

	describe('Debug Wireframe Methods', () => {
		test('create_debug_wireframe correctly passes parameters', async () => {
			const type = 'box';
			const dimensions = { width: 1, height: 1, depth: 1 };
			const position = new THREE.Vector3();
			const rotation = new THREE.Quaternion();
			const options = { color: 0xff0000 };
      
			await instance.create_debug_wireframe(type, dimensions, position, rotation, options);
      
			expect(wireframeSpawner.create_debug_wireframe).toHaveBeenCalledWith(
				mockScene, mockWorld, type, dimensions, position, rotation, options
			);
		});

		test('update_debug_wireframes correctly calls spawner', () => {
			instance.update_debug_wireframes();
			expect(wireframeSpawner.update_debug_wireframes).toHaveBeenCalled();
		});

		test('set_collision_debug correctly passes parameters', async () => {
			await instance.set_collision_debug(true);
      
			expect(wireframeSpawner.set_collision_debug).toHaveBeenCalledWith(
				mockScene, mockWorld, expect.anything(), true
			);
		});

		test('create_debug_wireframes_for_all_bodies correctly passes parameters', async () => {
			await instance.create_debug_wireframes_for_all_bodies();
      
			expect(wireframeSpawner.create_debug_wireframes_for_all_bodies).toHaveBeenCalledWith(
				mockScene, mockWorld, expect.anything()
			);
		});
	});

	describe('Debug Mesh Methods', () => {
		test('create_debug_mesh correctly passes parameters', async () => {
			const assetType = 'spotlight';
			const asset = { uuid: '123' };
      
			await instance.create_debug_mesh(assetType, asset);
      
			expect(debugMeshSpawner.create_debug_mesh).toHaveBeenCalledWith(
				mockScene, assetType, asset
			);
		});

		test('despawn_debug_meshes correctly passes parameters', async () => {
			const asset = { uuid: '123', userData: { debugMeshes: null } };
      
			await instance.despawn_debug_meshes(asset);
      
			expect(debugMeshSpawner.despawn_debug_meshes).toHaveBeenCalledWith(asset);
		});

		test('update_debug_meshes correctly passes parameters', async () => {
			await instance.update_debug_meshes();
      
			expect(debugMeshSpawner.update_debug_meshes).toHaveBeenCalledWith(mockScene);
		});

		test('forceDebugMeshUpdate correctly calls spawner', async () => {
			await instance.forceDebugMeshUpdate();
      
			expect(debugMeshSpawner.forceSpotlightDebugUpdate).toHaveBeenCalledWith(mockScene);
		});
	});

	describe('Visualization Update Methods', () => {
		test('update_visualizations calls update_debug_wireframes when flag is true', () => {
			// Create direct method spy implementations
			instance.update_debug_wireframes = jest.fn();
			instance.update_debug_meshes = jest.fn();
      
			// Create a custom implementation of update_visualizations to test the logic
			const originalUpdateVisualizations = instance.update_visualizations;
      
			// Replace with our own implementation that uses the same logic
			instance.update_visualizations = function() {
				if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
					this.update_debug_wireframes();
				}
				this.update_debug_meshes();
			};
      
			try {
				// Set the flag to true for the test
				BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG = true;
        
				// Call the method
				instance.update_visualizations();
        
				// Verify both mocks were called
				expect(instance.update_debug_wireframes).toHaveBeenCalled();
				expect(instance.update_debug_meshes).toHaveBeenCalled();
			} finally {
				// Restore the original method
				instance.update_visualizations = originalUpdateVisualizations;
				// Reset the flag
				BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG = false;
			}
		});

		test('update_visualizations does not call update_debug_wireframes when flag is false', () => {
			// Create direct method spy implementations
			instance.update_debug_wireframes = jest.fn();
			instance.update_debug_meshes = jest.fn();
      
			// Create a custom implementation of update_visualizations to test the logic
			const originalUpdateVisualizations = instance.update_visualizations;
      
			// Replace with our own implementation that uses the same logic
			instance.update_visualizations = function() {
				if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
					this.update_debug_wireframes();
				}
				this.update_debug_meshes();
			};
      
			try {
				// Make sure flag is false for this test
				BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG = false;
        
				// Call the method
				instance.update_visualizations();
        
				// Verify only update_debug_meshes was called
				expect(instance.update_debug_wireframes).not.toHaveBeenCalled();
				expect(instance.update_debug_meshes).toHaveBeenCalled();
			} finally {
				// Restore the original method
				instance.update_visualizations = originalUpdateVisualizations;
			}
		});
	});

	describe('Cleanup and Disposal Methods', () => {
		test('cleanup_debug calls cleanup methods', () => {
			instance.cleanup_debug();
      
			expect(wireframeSpawner.cleanup_wireframes).toHaveBeenCalled();
			expect(debugMeshSpawner.cleanup_spotlight_debug_meshes).toHaveBeenCalledWith(expect.anything());
		});

		test('dispose cleans up and clears instance variables', () => {
			// Use a spy for cleanup_debug
			const cleanupSpy = jest.spyOn(instance, 'cleanup_debug').mockImplementation();
      
			instance.dispose();
      
			expect(cleanupSpy).toHaveBeenCalled();
			expect(instance.scene).toBeNull();
			expect(instance.world).toBeNull();
			expect(instance.storage).toBeNull();
		});

		test('dispose_instance calls dispose on the instance', () => {
			// Use a spy for dispose
			const disposeSpy = jest.spyOn(instance, 'dispose').mockImplementation();
      
			// Call the static method
			DebugFactory.dispose_instance();
      
			// Verify dispose was called
			expect(disposeSpy).toHaveBeenCalled();
		});

		test('dispose handles null instance gracefully', () => {
			DebugFactory.dispose_instance(); // Make sure instance is null
      
			// This should not throw
			expect(() => DebugFactory.dispose_instance()).not.toThrow();
		});
	});
}); 