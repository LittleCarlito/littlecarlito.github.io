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
export * from './asset_spawner.js';
export * from './blorkpack_flags.js';
export * from './manifest_manager.js';
export * from './manifest_types.js';
export * from './loaders.js'; 