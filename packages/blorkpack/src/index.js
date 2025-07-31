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
export * from './asset_handler/asset_handler.js';
export * from './btype_helper.js';
export * from './manifest_manager.js';
export * from './loader.js';
export * from './app_renderer.js';
export * from './physics/index.js'; // Export physics utilities
import { AppRenderer } from './app_renderer.js';
import { AssetStorage } from './asset_storage.js';
import { AssetHandler } from './asset_handler/asset_handler.js';
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';
import { BTYPES } from './BTYPES.js';
import { CSS3DFactory } from './asset_handler/index.js';
import { CustomTypeManager } from './custom_type_manager.js';
import { InteractionManager } from './interaction/interaction_manager.js';
import { initPhysicsUtil } from './physics/physics_util.js';
import { MaterialFactory } from './asset_handler/index.js';
import { ManifestManager } from './manifest_manager.js';
import { MANIFEST_TYPES } from './manifest_types.js';
import { MemoryAnalyzer } from './memory_analyzer.js';
import { SystemAssetType } from './asset_handler/common/system_asset_types.js';
import { TextureOptimizer } from '../texture_optimizer.js';
import { UniversalMemoryManager } from './universal_memory_manager.js';
// Export the components
export {
	BTYPES,
	ManifestManager,
	MANIFEST_TYPES,
	InteractionManager,
	AssetHandler,
	MaterialFactory,
	CSS3DFactory,
	AssetStorage,
	AppRenderer,
	CustomTypeManager,
	MemoryAnalyzer,
	BLORKPACK_FLAGS,
	initPhysicsUtil,
	SystemAssetType,
	TextureOptimizer,
	UniversalMemoryManager
}; 