# BlorkPack

Advanced asset management and physics integration system for Three.js applications, with a focus on performance and ease of use.

## Installation

```bash
npm install @littlecarlito/blorkpack
```

## Features

- **Asset Management**:
  - Efficient loading and storage system
  - Smart caching and instance management
  - Automatic memory optimization
  - Asset state persistence
  - Dynamic loading and unloading

- **Physics Integration**:
  - Seamless Rapier3D physics integration
  - Automatic collision shape generation
  - Physics body management and optimization
  - Dynamic physics state handling
  - Collision group management

- **Scene Management**:
  - Asset spawning and lifecycle management
  - Instance pooling and reuse
  - Scene state persistence
  - Dynamic scene updates
  - Performance-optimized rendering

- **Material System**:
  - Advanced material caching
  - Dynamic texture loading
  - Material instance management
  - Custom shader support
  - Material state persistence

- **Configuration Management**:
  - JSON manifest system
  - Asset type definitions
  - Scene configuration
  - Dynamic configuration updates
  - Validation and error handling

## Usage

### Basic Setup

```javascript
import { 
  AssetStorage, 
  AssetSpawner, 
  AssetActivator,
  ManifestManager,
  THREE,
  RAPIER 
} from '@littlecarlito/blorkpack';

// Initialize the physics world
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// Set up Three.js scene
const scene = new THREE.Scene();

// Initialize core systems
const storage = AssetStorage.get_instance();
const spawner = AssetSpawner.get_instance(scene, world);
const activator = AssetActivator.get_instance(camera, renderer);
```

### Asset Management

```javascript
// Load assets from manifest
const manifest = ManifestManager.get_instance();
await manifest.load_manifest('assets/manifest.json');

// Load specific asset types
await storage.load_asset_type('character');
await storage.load_asset_type('environment');

// Spawn assets with physics
const { mesh, body, instance_id } = await spawner.spawn_asset(
  'character',
  new THREE.Vector3(0, 1, 0),
  new THREE.Quaternion()
);

// Handle asset activation
activator.activate_object(instance_id);
```

### Physics Integration

```javascript
// Create physics-enabled asset
const config = {
  mass: 1,
  restitution: 0.5,
  friction: 0.2,
  collisionGroups: ['dynamic', 'character']
};

const physicsObject = await spawner.spawn_physics_asset(
  'crate',
  position,
  rotation,
  config
);

// Update physics state
world.step();
spawner.update_physics_state();
```

### Scene Management

```javascript
// Load scene configuration
const sceneConfig = manifest.get_scene_data();

// Initialize scene with configuration
await spawner.init_scene(sceneConfig);

// Handle dynamic updates
spawner.update_scene_state();

// Clean up resources
spawner.cleanup_inactive_instances();
```

## Advanced Features

### Instance Pooling

```javascript
// Configure instance pool
spawner.configure_instance_pool('character', {
  poolSize: 10,
  preload: true
});

// Spawn from pool
const instance = await spawner.spawn_from_pool('character');

// Return to pool
spawner.return_to_pool(instance_id);
```

### Material Management

```javascript
// Create custom material
const material = storage.create_custom_material({
  type: 'physical',
  properties: {
    roughness: 0.5,
    metalness: 0.8
  }
});

// Apply to instance
spawner.update_instance_material(instance_id, material);
```

### Manifest Management

```javascript
// Create new manifest
const newManifest = manifest.create_new_manifest('Project Name', 'Description');

// Add asset types
manifest.add_asset_type({
  name: 'character',
  model: 'models/character.glb',
  physics: {
    type: 'dynamic',
    shape: 'capsule'
  }
});

// Validate and save
const isValid = manifest.validate();
if (isValid) {
  await manifest.save('assets/manifest.json');
}
```

## Examples

Check out the example files in the `examples` directory:
- `basic-usage.js`: Simple asset loading and spawning
- `physics-demo.js`: Physics integration example
- `scene-management.js`: Complete scene management demo

To run examples:
```bash
npm run example:basic
npm run example:physics
npm run example:scene
```

## Contributing

This package is part of the [threejs_site](https://github.com/littlecarlito/threejs_site) monorepo. Please refer to the main repository for contribution guidelines.

## License

MIT 