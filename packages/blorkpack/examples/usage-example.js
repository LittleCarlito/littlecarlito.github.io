/**
 * Asset Management Package Usage Examples
 * 
 * This file demonstrates how to use the asset-management package in your application.
 * Run with: node examples/usage-example.js
 */
// Import from the package
import { 
	AssetStorage, 
	AssetHandler, 
	ASSET_TYPE, 
	ASSET_CONFIGS,
	ManifestManager
} from '@littlecarlito/blorkpack';
// Import Three.js and RAPIER directly since we're in Node
// In a browser context, these would be imported from the package
import * as THREE from 'three';
// RAPIER needs initialization in a real environment
// For this example, we'll just simulate it
const RAPIER = {
	World: class {
		/**
		 *
		 */
		constructor(gravity) {
			this.gravity = gravity;
			console.log(`Created physics world with gravity: ${JSON.stringify(gravity)}`);
		}
		/**
		 *
		 */
		step() {
			// Simulate stepping the physics world
		}
	},
	Vector3: class {
		/**
		 *
		 */
		constructor(x, y, z) {
			this.x = x;
			this.y = y;
			this.z = z;
		}
	}
};

/**
 * Example 1: Asset Management Basics
 * 
 * Demonstrates the core asset management functionality:
 * - Loading assets
 * - Spawning objects
 * - Activating objects
 */
async function asset_management_example() {
	console.log('🚀 EXAMPLE 1: Asset Management Basics');
	console.log('====================================');
	// Create a simulated scene and camera
	const scene = { add: obj => console.log(`Added ${obj.type || 'object'} to scene`) };
	const camera = { position: { x: 0, y: 5, z: 10 } };
	const renderer = { domElement: {}, render: () => {} };
	// Create a physics world
	const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
	try {
		// Initialize asset storage
		console.log('Initializing asset storage...');
		const asset_storage = AssetStorage.get_instance();
		// Simulate loading an asset
		console.log('Loading assets...');
		// In a real app, this would load actual 3D models
		// await asset_storage.load_asset_type(ASSET_TYPE.ROOM);
		console.log('✅ Assets loaded successfully');
		// Initialize asset spawner
		console.log('Initializing asset spawner...');
		const spawner = AssetHandler.get_instance(scene, world);
		// Spawn an asset (simulated)
		console.log('Spawning assets in the scene...');
		// In a real app, this would create actual 3D objects
		// const { mesh, body, instance_id } = await spawner.spawn_asset(
		//   ASSET_TYPE.ROOM,
		//   new THREE.Vector3(0, 0, 0),
		//   new THREE.Quaternion()
		// );
		console.log('✅ Assets spawned successfully');
		// Simulate activation
		console.log('Activating an object...');
		// activator.activate_object('example_object');
		console.log('✅ Object activation simulated');
		console.log('Example 1 completed successfully\n');
	} catch (error) {
		console.error('❌ Error in asset management example:', error);
	}
}

/**
 * Example 2: Using ManifestManager
 * 
 * Demonstrates how to use the ManifestManager to:
 * - Load manifest.json files
 * - Access manifest data
 * - Configure scenes based on manifest data
 */
async function manifest_manager_example() {
	console.log('🚀 EXAMPLE 2: Manifest Manager');
	console.log('=============================');
	// Get the singleton instance
	const manifest_manager = ManifestManager.get_instance();
	try {
		// Simulate loading a manifest
		console.log('Creating a new manifest...');
		const new_manifest = manifest_manager.create_new_manifest(
			'Example Project', 
			'A demonstration of the ManifestManager'
		);
		console.log('✅ New manifest created');
		// Set the manifest data directly instead of loading from a file
		manifest_manager.set_manifest(new_manifest);
		// Add a custom type
		console.log('Adding a custom type...');
		manifest_manager.set_custom_type({
			name: "example_furniture",
			version: "1.0",
			load_layers: {
				viewable: true,
				collision: true,
				display: true
			},
			paths: {
				asset: "models/furniture/chair.glb",
				script: "scripts/furniture.js"
			},
			size: {
				radius: 0,
				width: 1.2,
				height: 1.8,
				depth: 1.2
			},
			scale: {
				x: 1,
				y: 1,
				z: 1
			},
			physics: {
				restitution: 0.5,
				sleep_timer: 1000,
				mass: 10,
				gravity_scale: 1,
				friction: 0.7,
				collision_groups: ["furniture"],
				collision_mask: ["floor", "walls"]
			},
			visual: {
				emitting: false,
				emission_color: "0x000000",
				emission_intensity: 0,
				opacity: 1,
				cast_shadow: true,
				receive_shadow: true,
				debug: {
					enabled: true,
					opacity: 0.5,
					color: "0x00ff00"
				}
			}
		});
		console.log('✅ Custom type added');
		// Get the custom type
		const custom_type = manifest_manager.get_custom_type("example_furniture");
		console.log('Retrieved custom type:', custom_type.name);
		// Add an asset group
		console.log('Adding an asset group...');
		manifest_manager.set_asset_group({
			id: "furniture_group",
			name: "Furniture",
			description: "Office furniture collection",
			tags: ["furniture", "office"],
			assets: ["chair1", "desk1"],
			active: true,
			toggle_behavior: "ALL"
		});
		console.log('✅ Asset group added');
		// Add an asset
		console.log('Adding an asset...');
		manifest_manager.set_asset("chair1", {
			id: "chair1",
			type: "CUSTOM",
			asset_type: "example_furniture",
			version: "1.0",
			config: {
				collidable: true,
				hidden: false,
				disabled: false,
				sleeping: false,
				gravity: true,
				interactable: true,
				selectable: true,
				highlightable: true
			},
			tags: ["chair", "furniture"],
			group_id: "furniture_group",
			position: {
				x: 1.5,
				y: 0,
				z: 2.0
			},
			rotation: {
				x: 0,
				y: 0.7,
				z: 0
			}
		});
		console.log('✅ Asset added');
		// Modify scene data
		console.log('Updating scene data...');
		manifest_manager.set_scene_data({
			version: "1.0",
			name: "Office Scene",
			description: "An office environment for the example",
			environment: {
				gravity: {
					x: 0.0,
					y: 9.81,
					z: 0.0
				},
				ambient_light: {
					color: "0xcccccc",
					intensity: 0.7
				},
				fog: {
					enabled: true,
					color: "0xeeeeee",
					near: 10,
					far: 50
				}
			},
			physics: {
				enabled: true,
				update_rate: 60,
				substeps: 2,
				debug_draw: false
			},
			rendering: {
				shadows: true,
				antialiasing: true,
				tone_mapping_exposure: 1.0
			}
		});
		console.log('✅ Scene data updated');
		// Access data to configure a scene
		console.log('\nRetrieving configuration data from manifest:');
		const scene_data = manifest_manager.get_scene_data();
		console.log(`- Scene name: ${scene_data.name}`);
		console.log(`- Scene description: ${scene_data.description}`);
		// Get all asset groups
		const asset_groups = manifest_manager.get_all_asset_groups();
		console.log(`- Asset groups: ${asset_groups.length}`);
		// Get all assets
		const assets = manifest_manager.get_all_assets();
		console.log(`- Assets: ${Object.keys(assets).length}`);
		// Simulate scene setup with manifest data
		console.log('\nConfiguring scene based on manifest data:');
		// Configure lighting
		if (scene_data.environment?.ambient_light) {
			const light_data = scene_data.environment.ambient_light;
			console.log(`- Adding ambient light (${light_data.color}, intensity: ${light_data.intensity})`);
			// In a real app: const ambientLight = new THREE.AmbientLight(light_data.color, light_data.intensity);
		}
		// Configure physics
		if (scene_data.physics?.enabled) {
			console.log(`- Setting up physics (update rate: ${scene_data.physics.update_rate})`);
			// In a real app:
			// const gravity = new RAPIER.Vector3(
			//   scene_data.environment.gravity.x,
			//   scene_data.environment.gravity.y,
			//   scene_data.environment.gravity.z
			// );
		}
		// Spawn assets from manifest
		for (const group of asset_groups) {
			console.log(`- Processing asset group: ${group.name}`);
			if (group.active) {
				for (const asset_id of group.assets) {
					const asset_data = manifest_manager.get_asset(asset_id);
					if (asset_data) {
						console.log(`  - Spawning asset: ${asset_id} (${asset_data.asset_type})`);
						// In a real app:
						// 1. Get position and rotation from asset_data
						// 2. Get custom type data
						// 3. Spawn the asset using AssetHandler
					} else {
						console.log(`  - Asset ${asset_id} not found in manifest`);
					}
				}
			}
		}
		console.log('Example 2 completed successfully\n');
	} catch (error) {
		console.error('❌ Error in manifest manager example:', error);
	}
}

// Run both examples
/**
 *
 */
async function run_examples() {
	console.log('=============================================');
	console.log('ASSET MANAGEMENT PACKAGE - USAGE EXAMPLES');
	console.log('=============================================\n');
	await asset_management_example();
	console.log('\n');
	await manifest_manager_example();
	console.log('\n=============================================');
	console.log('ALL EXAMPLES COMPLETED SUCCESSFULLY');
	console.log('=============================================');
}

// Execute the examples
run_examples().catch(error => {
	console.error('Error running examples:', error);
}); 