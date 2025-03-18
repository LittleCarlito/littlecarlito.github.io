// Export dependencies for external use
import * as THREE from 'three';
import { clone as cloneSkinnedMesh } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
import { createRapierProxy } from './rapier_proxy.js';

// Create the proxy that will lazy-load RAPIER when init() is called
export const RAPIER = createRapierProxy();

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

export { THREE, Easing, Tween };

// Re-export asset management components
export * from './asset_storage.js';
export * from './asset_activator.js';
export * from './asset_spawner/asset_spawner.js'
export * from './manifest_manager.js';
export * from './loaders.js';
export * from './app_renderer.js';

import { AssetStorage } from './asset_storage.js';
import { AssetSpawner } from './asset_spawner/asset_spawner.js';
import { AssetActivator } from './asset_activator.js';
import { ManifestManager } from './manifest_manager.js';
import { AppRenderer } from './app_renderer.js';
import CustomTypeManager from './custom_type_manager.js';
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';
import { MANIFEST_TYPES } from './manifest_types.js';

// Export the components
export {
    ManifestManager,
    MANIFEST_TYPES,
    AssetSpawner,
    AssetStorage,
    AssetActivator,
    AppRenderer,
    CustomTypeManager,
    BLORKPACK_FLAGS
}; 