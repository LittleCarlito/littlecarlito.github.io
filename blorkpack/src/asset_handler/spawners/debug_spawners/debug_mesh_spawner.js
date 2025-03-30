import { THREE } from "../../../index.js";
import { BLORKPACK_FLAGS } from "../../../blorkpack_flags.js";
import { SystemAssetType } from "../../common/system_asset_types.js";
import { create_spotlight_debug_mesh as create_spotlight_debug_mesh_original, 
	update_debug_meshes as update_debug_meshes_original,
	forceSpotlightDebugUpdate as forceSpotlightDebugUpdate_original } from "../system_spawners/index.js";

/**
 * Creates a debug mesh visualization for the specified asset type
 * 
 * @param {THREE.Scene} scene - The scene to add the debug mesh to
 * @param {string} asset_type - The type of asset to create a debug mesh for
 * @param {THREE.Object3D} asset - The asset to create debug meshes for
 * @returns {Promise<Object>} The created debug mesh objects
 */
export async function create_debug_mesh(scene, asset_type, asset) {
	if (!asset) return null;
    
	switch (asset_type) {
	case SystemAssetType.SPOTLIGHT.value:
		return create_spotlight_debug_mesh(scene, asset);
		// Add other asset type cases here as needed
	default:
		console.warn(`No debug mesh visualization available for asset type: ${asset_type}`);
		return null;
	}
}

/**
 * Creates a spotlight debug mesh for visualizing spotlight cone and target
 * This is a wrapper around the original function that adds scene as a parameter
 * 
 * @param {THREE.Scene} scene - The scene to add the debug mesh to
 * @param {THREE.Object3D} asset - The spotlight asset to visualize
 * @returns {Promise<Object>} The created debug mesh objects
 */
export async function create_spotlight_debug_mesh(scene, asset) {
	return create_spotlight_debug_mesh_original(scene, asset);
}

/**
 * Updates all debug mesh visualizations to match their associated assets
 * 
 * @param {THREE.Scene} scene - The scene containing the assets
 */
export async function update_debug_meshes(scene) {
	return update_debug_meshes_original(scene);
}

/**
 * Forces a full update of all debug mesh visualizations on next call
 * 
 * @param {THREE.Scene} scene - The scene containing the assets
 */
export async function forceSpotlightDebugUpdate(scene) {
	return forceSpotlightDebugUpdate_original(scene);
}

/**
 * Removes debug mesh visualizations for the specified asset
 * 
 * @param {THREE.Object3D} asset - The asset whose debug meshes should be removed
 */
export async function despawn_debug_meshes(asset) {
	if (!asset || !asset.userData.debugMeshes) return;
    
	const { debugMesh, cone } = asset.userData.debugMeshes;
	if (debugMesh && debugMesh.parent) debugMesh.parent.remove(debugMesh);
	if (cone && cone.parent) cone.parent.remove(cone);
    
	// Clear the debug meshes reference
	asset.userData.debugMeshes = null;
}

/**
 * Cleans up all spotlight debug meshes in the scene
 * 
 * @param {Object} storage - AssetStorage instance
 */
export function cleanup_spotlight_debug_meshes(storage) {
	const allAssets = storage.get_all_assets();
    
	allAssets.forEach(asset => {
		if (asset && asset.type === SystemAssetType.SPOTLIGHT.value) {
			// Remove spotlight debug meshes
			if (asset.mesh && asset.mesh.userData.debugMeshes) {
				const { debugMesh, cone } = asset.mesh.userData.debugMeshes;
				if (debugMesh && debugMesh.parent) debugMesh.parent.remove(debugMesh);
				if (cone && cone.parent) cone.parent.remove(cone);
				asset.mesh.userData.debugMeshes = null;
			}
		}
	});
} 