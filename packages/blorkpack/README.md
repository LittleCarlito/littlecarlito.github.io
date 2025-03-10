# BlorkPack

This package provides core asset management utilities for 3D scenes built with Three.js and Rapier physics.

## Features

- Asset loading and storage system
- Asset spawning mechanisms
- Asset activation and interaction handling
- Material caching and management
- Physics body integration
- Manifest file management and parsing
- Direct exports of THREE and RAPIER libraries for convenience

## Installation

```bash
npm install blorkpack
```

## Usage

### Importing THREE and RAPIER

The package exports THREE and RAPIER directly for convenience:

```javascript
import { THREE, RAPIER } from 'blorkpack';

// Now you can use THREE and RAPIER directly
const scene = new THREE.Scene();

// Initialize RAPIER and create a world
RAPIER.init().then(() => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // Use the physics world...
});
```

```javascript
import { 
  AssetStorage, 
  AssetSpawner, 
  AssetActivator, 
  ASSET_TYPE, 
  ASSET_CONFIGS,
  ManifestManager 
} from 'blorkpack';

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

// Load and use manifest data
const manifestManager = ManifestManager.get_instance();
await manifestManager.load_manifest('path/to/manifest.json');

// Access manifest data
const sceneData = manifestManager.get_scene_data();
const customTypes = manifestManager.get_all_custom_types();
const assetGroups = manifestManager.get_all_asset_groups();
```

### Using the ManifestManager

The ManifestManager provides a convenient way to load, parse, and manage manifest.json configuration files:

```javascript
// Get the singleton instance
const manifest_manager = ManifestManager.get_instance();

// Load a manifest file
await manifest_manager.load_manifest('resources/manifest.json');

// Get specific sections of the manifest
const custom_type = manifest_manager.get_custom_type('example_type');
const asset_group = manifest_manager.get_asset_group('example_group');
const asset = manifest_manager.get_asset('example_asset');
const scene_data = manifest_manager.get_scene_data();

// Creating and editing manifests
const new_manifest = manifest_manager.create_new_manifest('My Project', 'A description');
manifest_manager.set_custom_type({
  name: 'new_type',
  version: '1.0',
  // ... other properties
});

// Save the manifest
await manifest_manager.save_manifest('path/to/save.json');

// Validate a manifest
const validation = manifest_manager.validate_manifest();
if (validation.is_valid) {
  console.log('Manifest is valid');
} else {
  console.error('Validation errors:', validation.errors);
}
```

## Examples

The package includes several examples to help you get started:

- **Basic Usage**: Check out the [usage-example.js](examples/usage-example.js) file for a complete demonstration of asset management and manifest handling.
- **Manifest Testing**: The [manifest-test.js](examples/manifest-test.js) file shows how to test manifest functionality in a Node.js environment.

To run the examples:

```bash
# Navigate to the package directory
cd packages/asset-management

# Build the package
npm run build

# Run the usage example
node examples/usage-example.js

# Run the manifest test
node examples/manifest-test.js
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`

## License

MIT 