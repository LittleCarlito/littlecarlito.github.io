#!/usr/bin/env node
/**
 * ManifestManager Test Script
 * 
 * A simple Node.js script to test the ManifestManager functionality.
 * Run with: node examples/manifest-test.js
 */
// We need to import from the package
import { ManifestManager } from '@littlecarlito/blorkpack';
import fs from 'fs';
import path from 'path';
// Override fetch for Node.js environment
globalThis.fetch = async (url) => {
	try {
		const content = fs.readFileSync(url, 'utf8');
		return {
			ok: true,
			json: async () => JSON.parse(content)
		};
	} catch (error) {
		return {
			ok: false,
			status: 404,
			statusText: error.message
		};
	}
};
// Path to the manifest.json file to test with
const MANIFEST_PATH = '../../resources/manifest.json';

/**
 *
 */
async function test_manifest_manager() {
	console.log('🚀 Testing ManifestManager in Node.js environment...');
	// Get the singleton instance
	const manifest_manager = ManifestManager.get_instance();
	try {
		// Check if the manifest file exists
		if (!fs.existsSync(MANIFEST_PATH)) {
			console.error(`❌ Manifest file not found at: ${MANIFEST_PATH}`);
			return;
		}
		// Load the manifest
		console.log(`📄 Loading manifest from: ${MANIFEST_PATH}`);
		await manifest_manager.load_manifest(MANIFEST_PATH);
		console.log('✅ Manifest loaded successfully.');
		// Print basic information
		const manifest = manifest_manager.get_manifest();
		console.log(`\n📋 Manifest Information:`);
		console.log(`- Name: ${manifest.name}`);
		console.log(`- Description: ${manifest.description}`);
		console.log(`- Version: ${manifest.manifest_version}`);
		console.log(`- Author: ${manifest.author}`);
		console.log(`- Created: ${manifest.created_date}`);
		console.log(`- Updated: ${manifest.updated_date}`);
		// List custom types
		const custom_types = manifest_manager.get_all_custom_types();
		console.log(`\n📦 Custom Types (${custom_types?.length || 0}):`);
		if (custom_types && custom_types.length > 0) {
			custom_types.forEach(type => {
				console.log(`- ${type.name} (v${type.version})`);
			});
			// Display first custom type in detail
			const first_type = custom_types[0];
			console.log(`\n🔍 Details for Custom Type '${first_type.name}':`);
			console.log(JSON.stringify(first_type, null, 2));
		} else {
			console.log('- No custom types found.');
		}
		// List asset groups
		const asset_groups = manifest_manager.get_all_asset_groups();
		console.log(`\n🗃️ Asset Groups (${asset_groups?.length || 0}):`);
		if (asset_groups && asset_groups.length > 0) {
			asset_groups.forEach(group => {
				console.log(`- ${group.id} (${group.name}): ${group.assets?.length || 0} assets`);
			});
		} else {
			console.log('- No asset groups found.');
		}
		// Display assets
		const assets = manifest_manager.get_all_assets();
		let asset_count = 0;
		if (assets) {
			asset_count = Array.isArray(assets) ? assets.length : Object.keys(assets).length;
			console.log(`\n🧩 Assets (${asset_count}):`);
			if (Array.isArray(assets)) {
				assets.forEach(asset => {
					console.log(`- ${asset.id}: ${asset.type} (${asset.asset_type})`);
					// Check for spotlight assets and print their shadow details
					if (asset.asset_type === 'spotlight') {
						console.log(`  Spotlight Details:`);
						console.log(`  - Position: (${asset.position.x}, ${asset.position.y}, ${asset.position.z})`);
						console.log(`  - Color: ${asset.additional_properties?.color || 'N/A'}`);
						console.log(`  - Intensity: ${asset.additional_properties?.intensity || 'N/A'}`);
						console.log(`  - Angle: ${asset.additional_properties?.angle || 'N/A'}`);
						console.log(`  - Cast Shadows: ${asset.additional_properties?.cast_shadows ? 'Yes' : 'No'}`);
						// If there are shadow settings, show them
						if (asset.additional_properties?.shadow) {
							const shadow = asset.additional_properties.shadow;
							console.log(`  - Shadow Configuration:`);
							console.log(`    - Blur Samples: ${shadow.blur_samples || 'N/A'}`);
							console.log(`    - Radius: ${shadow.radius || 'N/A'}`);
							console.log(`    - Map Size: ${shadow.map_size?.width || 'N/A'} x ${shadow.map_size?.height || 'N/A'}`);
							console.log(`    - Bias: ${shadow.bias || 'N/A'}`);
							console.log(`    - Normal Bias: ${shadow.normal_bias || 'N/A'}`);
						}
					}
				});
			} else if (typeof assets === 'object') {
				Object.keys(assets).forEach(asset_id => {
					const asset = assets[asset_id];
					console.log(`- ${asset_id}: ${asset.type} (${asset.asset_type})`);
					// Check for spotlight assets and print their shadow details
					if (asset.asset_type === 'spotlight') {
						console.log(`  Spotlight Details:`);
						console.log(`  - Position: (${asset.position.x}, ${asset.position.y}, ${asset.position.z})`);
						console.log(`  - Color: ${asset.additional_properties?.color || 'N/A'}`);
						console.log(`  - Intensity: ${asset.additional_properties?.intensity || 'N/A'}`);
						console.log(`  - Angle: ${asset.additional_properties?.angle || 'N/A'}`);
						console.log(`  - Cast Shadows: ${asset.additional_properties?.cast_shadows ? 'Yes' : 'No'}`);
						// If there are shadow settings, show them
						if (asset.additional_properties?.shadow) {
							const shadow = asset.additional_properties.shadow;
							console.log(`  - Shadow Configuration:`);
							console.log(`    - Blur Samples: ${shadow.blur_samples || 'N/A'}`);
							console.log(`    - Radius: ${shadow.radius || 'N/A'}`);
							console.log(`    - Map Size: ${shadow.map_size?.width || 'N/A'} x ${shadow.map_size?.height || 'N/A'}`);
							console.log(`    - Bias: ${shadow.bias || 'N/A'}`);
							console.log(`    - Normal Bias: ${shadow.normal_bias || 'N/A'}`);
						}
					}
				});
			}
			if (asset_count === 0) {
				console.log('- No assets found.');
			}
		} else {
			console.log('- No assets defined in the manifest.');
		}
		// Display scene data
		const scene_data = manifest_manager.get_scene_data();
		if (scene_data) {
			console.log(`\n🌎 Scene Data:`);
			console.log(`- Name: ${scene_data.name}`);
			console.log(`- Description: ${scene_data.description}`);
			console.log(`- Version: ${scene_data.version}`);
			// Use the getter methods for environment settings
			const gravity = manifest_manager.get_gravity();
			console.log(`- Gravity: x=${gravity.x}, y=${gravity.y}, z=${gravity.z}`);
			const ambient_light = manifest_manager.get_ambient_light();
			console.log(`- Ambient Light: ${ambient_light.color} (intensity: ${ambient_light.intensity})`);
			// Get physics config using the getter method
			const physics_config = manifest_manager.get_physics_config();
			if (physics_config) {
				console.log(`- Physics Enabled: ${physics_config.enabled}`);
				console.log(`- Physics Update Rate: ${physics_config.update_rate}`);
			}
		} else {
			console.log('\n🌎 No scene data found in the manifest.');
		}
		// Validate the manifest
		const validation = manifest_manager.validate_manifest();
		if (validation.is_valid) {
			console.log('\n✅ Manifest validation passed.');
		} else {
			console.error('\n❌ Manifest validation failed:');
			validation.errors.forEach(error => console.error(`- ${error}`));
		}
		// Test creating a new manifest
		console.log('\n🆕 Creating a new manifest...');
		const new_manifest = manifest_manager.create_new_manifest('Test Manifest', 'Created for testing');
		console.log('✅ New manifest created.');
		// Test saving the manifest to a temporary file
		const temp_path = path.join('examples', 'temp-manifest.json');
		console.log(`🔄 Saving manifest to: ${temp_path}`);
		try {
			// Call save_manifest which should handle Node.js file saving internally now
			const save_result = await manifest_manager.save_manifest(temp_path, new_manifest);
			if (save_result) {
				console.log(`✅ New manifest saved successfully.`);
			} else {
				// If direct saving wasn't possible, check if the _save_data field was populated
				if (manifest_manager._save_data) {
					console.log(`ℹ️ ManifestManager prepared data for saving but couldn't write directly.`);
					console.log(`ℹ️ Save path: ${manifest_manager._save_data.path}`);
					console.log(`ℹ️ Data keys: ${Object.keys(manifest_manager._save_data.data).join(', ')}`);
					// Manually save it for testing purpose
					fs.writeFileSync(temp_path, JSON.stringify(manifest_manager._save_data.data, null, 2));
					console.log(`✅ Manually saved the data for test validation.`);
				}
			}
			// Verify the file was created
			if (fs.existsSync(temp_path)) {
				console.log(`🔎 Verifying saved manifest... `);
				const saved_content = JSON.parse(fs.readFileSync(temp_path, 'utf8'));
				console.log(`✅ Manifest file verified (${Object.keys(saved_content).length} keys)`);
				// Clean up the temporary file
				fs.unlinkSync(temp_path);
				console.log('🧹 Temporary manifest file cleaned up.');
			} else {
				console.error(`❌ Expected file ${temp_path} was not created.`);
			}
		} catch (error) {
			console.error(`❌ Error during save manifest test: ${error.message}`);
		}
	} catch (error) {
		console.error('❌ Error testing ManifestManager:', error);
	}
}

// Run the test
test_manifest_manager().then(() => {
	console.log('\n✨ ManifestManager test completed.');
}); 