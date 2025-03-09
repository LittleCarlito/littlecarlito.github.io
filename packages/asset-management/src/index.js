// Export dependencies for external use
import * as THREE from 'three';
import { clone as cloneSkinnedMesh } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Create utilities that we will export
export const AssetUtils = {
    cloneSkinnedMesh
};

export { THREE, RAPIER };

// Re-export all asset management components
export * from './asset_type.js';
export * from './asset_storage.js';
export * from './asset_activator.js';
export * from './asset_spawner.js';
export * from './flags.js'; 