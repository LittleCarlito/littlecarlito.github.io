// Export dependencies for external use
import * as THREE from 'three';
import { clone as cloneSkinnedMesh } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';

// Create utilities that we will export
export const AssetUtils = {
    cloneSkinnedMesh
};

export { THREE, RAPIER, Easing, Tween };

// Re-export all asset management components
export * from './asset_type.js';
export * from './asset_storage.js';
export * from './asset_activator.js';
export * from './asset_spawner/asset_spawner.js'
export * from './manifest_manager.js';
export * from './manifest_types.js';
export * from './loaders.js';
export * from './app_renderer.js';

import { AssetStorage } from './asset_storage.js';
import { AssetSpawner } from './asset_spawner/asset_spawner.js';
import { AssetActivator } from './asset_activator.js';
import { ManifestManager } from './manifest_manager.js';
import { AppRenderer } from './app_renderer.js';
import { ASSET_TYPE } from './asset_type.js';
import { BLORKPACK_FLAGS } from './blorkpack_flags.js';

export {
    AssetStorage,
    AssetSpawner,
    AssetActivator,
    ManifestManager,
    AppRenderer,
    ASSET_TYPE,
    BLORKPACK_FLAGS
}; 