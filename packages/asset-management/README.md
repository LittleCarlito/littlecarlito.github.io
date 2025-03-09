# Asset Management Package

This package provides core asset management utilities for 3D scenes built with Three.js and Rapier physics.

## Features

- Asset loading and storage system
- Asset spawning mechanisms
- Asset activation and interaction handling
- Material caching and management
- Physics body integration

## Installation

```bash
npm install asset-management
```

## Usage

```javascript
import { 
  AssetStorage, 
  AssetSpawner, 
  AssetActivator, 
  ASSET_TYPE, 
  ASSET_CONFIGS 
} from 'asset-management';

// Initialize storage
const assetStorage = AssetStorage.get_instance();

// Load assets
await assetStorage.load_asset_type(ASSET_TYPE.SOME_MODEL);

// Create spawner with scene and physics world
const spawner = AssetSpawner.get_instance(scene, world);

// Spawn an asset
const { mesh, body, instance_id } = await spawner.spawn_asset(
  ASSET_TYPE.SOME_MODEL,
  new THREE.Vector3(0, 0, 0),
  new THREE.Quaternion()
);

// Handle activation
const activator = AssetActivator.get_instance(camera, renderer);
activator.activate_object('object_name');
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`

## License

MIT 