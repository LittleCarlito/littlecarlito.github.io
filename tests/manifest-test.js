/**
 * ManifestManager Test/Demo
 * 
 * This file demonstrates the usage of the ManifestManager class in isolation.
 * Run this file to test the ManifestManager functionality.
 */

import { ManifestManager }  from '@littlecarlito/blorkpack';

async function testManifestManager() {
    console.log('Testing ManifestManager...');
    
    // Get the singleton instance
    const manifestManager = ManifestManager.getInstance();
    
    try {
        // Load the manifest
        console.log('Loading manifest.json...');
        await manifestManager.loadManifest('resources/manifest.json');
        console.log('✅ Manifest loaded successfully.');
        
        // Print basic information
        const manifest = manifestManager.getManifest();
        console.log(`\nManifest Information:`);
        console.log(`- Name: ${manifest.name}`);
        console.log(`- Description: ${manifest.description}`);
        console.log(`- Version: ${manifest.manifest_version}`);
        console.log(`- Author: ${manifest.author}`);
        console.log(`- Created: ${manifest.created_date}`);
        console.log(`- Updated: ${manifest.updated_date}`);
        
        // List custom types
        const customTypes = manifestManager.getAllCustomTypes();
        console.log(`\nCustom Types (${customTypes.length}):`, customTypes);
        
        // Display first custom type in detail
        if (customTypes.length > 0) {
            const firstType = customTypes[0];
            console.log(`\nDetails for Custom Type '${firstType.name}':`);
            console.log(JSON.stringify(firstType, null, 2));
        }
        
        // List asset groups
        const assetGroups = manifestManager.getAllAssetGroups();
        console.log(`\nAsset Groups (${assetGroups?.length || 0}):`, assetGroups);
        
        // Display assets
        const assets = manifestManager.getAllAssets();
        if (assets) {
            const assetCount = Array.isArray(assets) ? assets.length : Object.keys(assets).length;
            console.log(`\nAssets (${assetCount}):`);
            
            if (Array.isArray(assets)) {
                assets.forEach(asset => {
                    console.log(`- ${asset.id}: ${asset.type} (${asset.asset_type})`);
                });
            } else {
                Object.keys(assets).forEach(assetId => {
                    const asset = assets[assetId];
                    console.log(`- ${assetId}: ${asset.type} (${asset.asset_type})`);
                });
            }
        }
        
        // Display application assets
        const applicationAssets = manifestManager.get_application_assets();
        console.log(`\nApplication Assets (${applicationAssets.length}):`);
        applicationAssets.forEach(asset => {
            console.log(`- ${asset.id}: ${asset.type} (${asset.asset_type})`);
            if (asset.asset_type === 'background_floor') {
                console.log(`  Background Floor Properties:`);
                console.log(`  - Position: (${asset.position.x}, ${asset.position.y}, ${asset.position.z})`);
                if (asset.additional_properties && asset.additional_properties.physical_dimensions) {
                    const dims = asset.additional_properties.physical_dimensions;
                    console.log(`  - Dimensions: ${dims.width} x ${dims.height} x ${dims.depth}`);
                }
            }
        });
        
        // Display system assets
        const systemAssets = manifestManager.get_system_assets();
        console.log(`\nSystem Assets (${systemAssets.length}):`);
        systemAssets.forEach(asset => {
            console.log(`- ${asset.id}: ${asset.type} (${asset.asset_type})`);
            
            // Check for spotlight assets
            if (asset.asset_type === 'spotlight') {
                console.log(`  Spotlight Properties:`);
                console.log(`  - Position: (${asset.position.x}, ${asset.position.y}, ${asset.position.z})`);
                console.log(`  - Rotation: (${asset.rotation.x}, ${asset.rotation.y}, ${asset.rotation.z})`);
                if (asset.target) {
                    console.log(`  - Target ID: ${asset.target.id || 'N/A'}`);
                    console.log(`  - Target Position: (${asset.target.position.x}, ${asset.target.position.y}, ${asset.target.position.z})`);
                }
                
                if (asset.additional_properties) {
                    const props = asset.additional_properties;
                    console.log(`  - Color: ${props.color || 'N/A'}`);
                    console.log(`  - Intensity: ${props.intensity || 'N/A'}`);
                    console.log(`  - Angle: ${props.angle || 'N/A'}`);
                    console.log(`  - Penumbra: ${props.penumbra || 'N/A'}`);
                    console.log(`  - Sharpness: ${props.sharpness || 'N/A'}`);
                    console.log(`  - Cast Shadows: ${props.cast_shadows ? 'Yes' : 'No'}`);
                    
                    // Shadow configuration
                    if (props.shadow) {
                        console.log(`  - Shadow Configuration:`);
                        console.log(`    - Blur Samples: ${props.shadow.blur_samples || 'N/A'}`);
                        console.log(`    - Radius: ${props.shadow.radius || 'N/A'}`);
                        
                        if (props.shadow.map_size) {
                            console.log(`    - Map Size: ${props.shadow.map_size.width} x ${props.shadow.map_size.height}`);
                        }
                        
                        if (props.shadow.camera) {
                            console.log(`    - Camera: near=${props.shadow.camera.near}, far=${props.shadow.camera.far}, fov=${props.shadow.camera.fov}`);
                        }
                        
                        console.log(`    - Bias: ${props.shadow.bias || 'N/A'}`);
                        console.log(`    - Normal Bias: ${props.shadow.normal_bias || 'N/A'}`);
                    }
                }
            }
        });
        
        // Test spawning application assets if in browser context
        if (typeof window !== 'undefined' && window.asset_spawner) {
            console.log('\nTesting application asset spawning...');
            try {
                const spawned_assets = await window.asset_spawner.spawn_application_assets(manifestManager);
                console.log(`✅ Successfully spawned ${spawned_assets.length} application assets`);
                spawned_assets.forEach(asset => {
                    console.log(`- Spawned ${asset.id} (${asset.asset_type})`);
                });
            } catch (error) {
                console.error('❌ Error spawning application assets:', error);
            }
        } else {
            console.log('\nSkipping asset spawning test in non-browser environment');
        }
        
        // Display scene data
        const sceneData = manifestManager.getSceneData();
        console.log(`\nScene Data:`);
        console.log(`- Name: ${sceneData.name}`);
        console.log(`- Description: ${sceneData.description}`);
        
        // Test background type
        console.log(`\nBackground Configuration:`);
        const background = sceneData.background;
        console.log(`- Type: ${background.type}`);
        
        switch (background.type) {
            case 'IMAGE':
                console.log(`- Image Path: ${background.image_path}`);
                break;
            case 'COLOR':
                console.log(`- Color Value: ${background.color_value}`);
                break;
            case 'SKYBOX':
                console.log(`- Skybox Enabled: ${background.skybox.enabled}`);
                console.log(`- Skybox Path: ${background.skybox.skybox_path}`);
                break;
            default:
                console.log(`- Unknown background type: ${background.type}`);
        }
        
        // Test camera configuration
        console.log(`\nCamera Configuration:`);
        const camera = sceneData.default_camera;
        if (camera) {
            console.log(`- Position: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
            console.log(`- FOV: ${camera.fov}`);
            console.log(`- Control Type: ${camera.controls.type}`);
            console.log(`- Min/Max Distance: ${camera.controls.min_distance}/${camera.controls.max_distance}`);
            
            if (camera.shoulder_lights) {
                console.log(`- Shoulder Lights: ${camera.shoulder_lights.enabled ? 'Enabled' : 'Disabled'}`);
                if (camera.shoulder_lights.enabled) {
                    console.log(`  - Left Light Position: (${camera.shoulder_lights.left.position.x}, ${camera.shoulder_lights.left.position.y}, ${camera.shoulder_lights.left.position.z})`);
                    console.log(`  - Right Light Position: (${camera.shoulder_lights.right.position.x}, ${camera.shoulder_lights.right.position.y}, ${camera.shoulder_lights.right.position.z})`);
                }
            }
            
            if (camera.ui_distance) {
                console.log(`- UI Distance: ${camera.ui_distance}`);
            }
        } else {
            console.log('- No camera configuration found');
        }
        
        // Validate the manifest
        const validation = manifestManager.validateManifest();
        if (validation.isValid) {
            console.log('\n✅ Manifest validation passed.');
        } else {
            console.error('\n❌ Manifest validation failed:');
            validation.errors.forEach(error => console.error(`- ${error}`));
        }
        
        // Test creating a new manifest
        console.log('\nCreating a new manifest...');
        const newManifest = manifestManager.createNewManifest('Test Manifest', 'Created for testing');
        console.log('✅ New manifest created.');
        
        // Try saving the manifest
        // Uncomment to test saving
        // await manifestManager.saveManifest('resources/test-manifest.json');
        // console.log('✅ Manifest saved.');
        
    } catch (error) {
        console.error('❌ Error testing ManifestManager:', error);
    }
}

// Run the test
testManifestManager().then(() => {
    console.log('\nManifestManager test completed.');
}); 