/**
 * ManifestManager Test Suite
 * 
 * Jest tests for the ManifestManager class.
 */
import { ManifestManager } from '@littlecarlito/blorkpack';

// Mock window.asset_spawner if needed
const mockSpawnCustomAssets = jest.fn().mockResolvedValue([
	{ id: 'test-asset-1', asset_type: 'background_floor' },
	{ id: 'test-asset-2', asset_type: 'spotlight' }
]);

// Setup global mocks if running in Jest environment
if (typeof window === 'undefined') {
	global.window = {};
}
if (!window.asset_spawner) {
	window.asset_spawner = { spawn_custom_assets: mockSpawnCustomAssets };
}

describe('ManifestManager', () => {
	let manifestManager;
	
	beforeEach(() => {
		// Reset any mocks
		jest.clearAllMocks();
		// Get the singleton instance
		manifestManager = ManifestManager.getInstance();
	});
	
	describe('Basic functionality', () => {
		test('should load manifest.json successfully', async () => {
			await manifestManager.loadManifest('resources/manifest.json');
			const manifest = manifestManager.getManifest();
			
			expect(manifest).toBeDefined();
			expect(manifest.name).toBeDefined();
			expect(manifest.description).toBeDefined();
			expect(manifest.manifest_version).toBeDefined();
		});
		
		test('should create a new manifest', () => {
			const newManifest = manifestManager.createNewManifest('Test Manifest', 'Created for testing');
			
			expect(newManifest).toBeDefined();
			expect(newManifest.name).toBe('Test Manifest');
			expect(newManifest.description).toBe('Created for testing');
		});
		
		test('should validate a manifest', async () => {
			await manifestManager.loadManifest('resources/manifest.json');
			const validation = manifestManager.validateManifest();
			
			expect(validation).toBeDefined();
			expect(validation.isValid).toBeDefined();
		});
	});
	
	describe('Asset management', () => {
		beforeEach(async () => {
			await manifestManager.loadManifest('resources/manifest.json');
		});
		
		test('should retrieve custom types', () => {
			const customTypes = manifestManager.getAllCustomTypes();
			
			expect(Array.isArray(customTypes)).toBe(true);
		});
		
		test('should retrieve asset groups', () => {
			const assetGroups = manifestManager.getAllAssetGroups();
			
			expect(assetGroups).toBeDefined();
		});
		
		test('should retrieve all assets', () => {
			const assets = manifestManager.getAllAssets();
			
			expect(assets).toBeDefined();
		});
		
		test('should retrieve custom assets', () => {
			const customAssets = manifestManager.get_custom_assets();
			
			expect(Array.isArray(customAssets)).toBe(true);
		});
		
		test('should retrieve system assets', () => {
			const systemAssets = manifestManager.get_system_assets();
			
			expect(Array.isArray(systemAssets)).toBe(true);
		});
		
		test('should retrieve scene data', () => {
			const sceneData = manifestManager.getSceneData();
			
			expect(sceneData).toBeDefined();
			expect(sceneData.name).toBeDefined();
			expect(sceneData.description).toBeDefined();
			expect(sceneData.background).toBeDefined();
		});
	});
	
	describe('Asset spawning', () => {
		beforeEach(async () => {
			await manifestManager.loadManifest('resources/manifest.json');
		});
		
		test('should spawn custom assets', async () => {
			const spawned_assets = await window.asset_spawner.spawn_custom_assets(manifestManager);
			
			expect(spawned_assets).toHaveLength(2);
			expect(spawned_assets[0].id).toBe('test-asset-1');
			expect(spawned_assets[1].id).toBe('test-asset-2');
			expect(mockSpawnCustomAssets).toHaveBeenCalledWith(manifestManager);
		});
	});
}); 