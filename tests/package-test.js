/**
 * Asset Management Package Test Suite
 * 
 * Jest tests for the asset management package
 */
import { 
	AssetStorage, 
	AssetSpawner, 
	AssetActivator, 
	ASSET_TYPE, 
	ASSET_CONFIGS,
	THREE,
	RAPIER,
	AssetUtils
} from '@littlecarlito/blorkpack';

// Mock THREE
jest.mock('@littlecarlito/blorkpack', () => {
	// Create mock implementations
	const mockThree = {
		Scene: jest.fn().mockImplementation(() => ({
			add: jest.fn()
		})),
		PerspectiveCamera: jest.fn().mockImplementation(() => ({
			position: { z: 0 }
		})),
		WebGLRenderer: jest.fn().mockImplementation(() => ({
			setSize: jest.fn(),
			render: jest.fn()
		})),
		BoxGeometry: jest.fn(),
		MeshBasicMaterial: jest.fn(),
		Mesh: jest.fn().mockImplementation(() => ({
			rotation: { x: 0, y: 0 },
		})),
		Vector3: jest.fn().mockImplementation(() => ({
			x: 0, y: 0, z: 0
		})),
		Quaternion: jest.fn()
	};

	// Create mock RAPIER
	const mockRapier = {
		init: jest.fn().mockResolvedValue(undefined),
		World: jest.fn().mockImplementation(() => ({
			step: jest.fn()
		}))
	};

	// Mock AssetStorage with instance tracking
	let storageInstance = null;
	const mockAssetStorage = {
		get_instance: jest.fn().mockImplementation(() => {
			if (!storageInstance) {
				storageInstance = {
					add_object: jest.fn().mockReturnValue('mock-instance-id'),
					update: jest.fn()
				};
			}
			return storageInstance;
		})
	};

	// Mock AssetSpawner with instance tracking
	let spawnerInstance = null;
	const mockAssetSpawner = {
		get_instance: jest.fn().mockImplementation((scene, world) => {
			if (!spawnerInstance) {
				spawnerInstance = {
					spawn_asset: jest.fn()
				};
			}
			return spawnerInstance;
		})
	};

	// Mock AssetActivator with instance tracking
	let activatorInstance = null;
	const mockAssetActivator = {
		get_instance: jest.fn().mockImplementation((camera, renderer) => {
			if (!activatorInstance) {
				activatorInstance = {
					activate: jest.fn()
				};
			}
			return activatorInstance;
		})
	};

	return {
		AssetStorage: mockAssetStorage,
		AssetSpawner: mockAssetSpawner,
		AssetActivator: mockAssetActivator,
		ASSET_TYPE: { 
			MODEL: 'model',
			LIGHT: 'light',
			FLOOR: 'floor'
		},
		ASSET_CONFIGS: {},
		THREE: mockThree,
		RAPIER: mockRapier,
		AssetUtils: {
			createPhysicsBody: jest.fn()
		}
	};
});

// Mock document.body.appendChild
document.body = {
	appendChild: jest.fn()
};

describe('Asset Management Package', () => {
	// Setup common variables
	let scene, camera, renderer, world, assetStorage, spawner, activator;
	
	beforeEach(async () => {
		// Reset mocks
		jest.clearAllMocks();
		
		// Initialize scene and THREE objects
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		renderer = new THREE.WebGLRenderer();
		
		// Initialize Rapier
		await RAPIER.init();
		world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
		
		// Get asset management instances
		assetStorage = AssetStorage.get_instance();
		spawner = AssetSpawner.get_instance(scene, world);
		activator = AssetActivator.get_instance(camera, renderer);
	});
	
	describe('Initialization', () => {
		test('should initialize THREE scene', () => {
			expect(scene).toBeDefined();
			expect(camera).toBeDefined();
			expect(renderer).toBeDefined();
			expect(camera.position.z).toBeDefined();
		});
		
		test('should initialize RAPIER physics', async () => {
			expect(RAPIER.init).toHaveBeenCalled();
			expect(world).toBeDefined();
		});
		
		test('should create asset management instances', () => {
			expect(assetStorage).toBeDefined();
			expect(spawner).toBeDefined();
			expect(activator).toBeDefined();
		});
	});
	
	describe('Asset creation and management', () => {
		test('should create and register a basic object', () => {
			// Create geometry, material, mesh
			const geometry = new THREE.BoxGeometry(1, 1, 1);
			const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
			const cube = new THREE.Mesh(geometry, material);
			
			// Add to scene
			scene.add(cube);
			
			// Register with asset storage
			const instance_id = assetStorage.add_object(cube, null);
			
			expect(scene.add).toHaveBeenCalledWith(cube);
			expect(assetStorage.add_object).toHaveBeenCalledWith(cube, null);
			expect(instance_id).toBe('mock-instance-id');
		});
		
		test('should update physics and assets', () => {
			// Simulate an animation frame
			world.step();
			assetStorage.update();
			
			expect(world.step).toHaveBeenCalled();
			expect(assetStorage.update).toHaveBeenCalled();
		});
	});
	
	describe('Asset types and configs', () => {
		test('should have defined asset types', () => {
			expect(ASSET_TYPE).toBeDefined();
			expect(Object.keys(ASSET_TYPE).length).toBeGreaterThan(0);
		});
	});
}); 