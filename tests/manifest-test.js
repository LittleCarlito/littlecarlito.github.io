/**
 * ManifestManager Test/Demo
 * 
 * This file demonstrates the usage of the ManifestManager class in isolation.
 * Run this file to test the ManifestManager functionality.
 */

import { ManifestManager } from 'asset-management';

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
        
        // Display scene data
        const sceneData = manifestManager.getSceneData();
        console.log(`\nScene Data:`, sceneData);
        
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