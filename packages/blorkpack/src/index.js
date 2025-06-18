// Export dependencies for external use
import { clone as cloneSkinnedMesh } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
import { createRapierProxy } from './rapier_proxy.js';
import { createThreeProxy } from './three_proxy.js';
// Create the proxies that will lazy-load modules when init() is called
export const RAPIER = createRapierProxy();
export const THREE = createThreeProxy();
// Create utilities that we will export
export const AssetUtils = {
	cloneSkinnedMesh
};
/**
 * Initialize Rapier physics engine. Must be called before using RAPIER.
 * @returns {Promise<void>}
 */
export async function initRapier() {
	return RAPIER.init();
}
/**
 * Initialize Three.js. Must be called before using THREE.
 * @returns {Promise<void>}
 */
export async function initThree() {
	return THREE.init();
}
export { Easing, Tween };
// Re-export asset management components
export * from './asset_storage.js';
export * from './asset_activator.js';
export * from './asset_handler/asset_handler.js';
export * from './manifest_manager.js';
export * from './loader.js';
export * from './app_renderer.js';
export * from './physics/index.js'; // Export physics utilities
import { AssetStorage } from './asset_storage.js';
import { AssetHandler } from './asset_handler/asset_handler.js';
import { MaterialFactory } from './asset_handler/index.js';
import { AssetActivator } from './asset_activator.js';
import { ManifestManager } from './manifest_manager.js';
import { AppRenderer } from './app_renderer.js';
import CustomTypeManager from './custom_type_manager.js';
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';
import { MANIFEST_TYPES } from './manifest_types.js';
import { initPhysicsUtil } from './physics/physics_util.js';
import { SystemAssetType } from './asset_handler/common/system_asset_types.js';
// Export the components
export {
	ManifestManager,
	MANIFEST_TYPES,
	AssetHandler,
	MaterialFactory,
	AssetStorage,
	AssetActivator,
	AppRenderer,
	CustomTypeManager,
	BLORKPACK_FLAGS,
	initPhysicsUtil,
	SystemAssetType
}; 