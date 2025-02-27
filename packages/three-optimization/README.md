# @blooooork/three-optimization

High-performance optimization tools for Three.js applications. This package provides professional-grade solutions for texture management, asset loading, and memory optimization.

## Features

### 🎨 Texture Atlas Manager
Automatically pack multiple textures into a single atlas for optimal GPU performance:
```javascript
import { TextureAtlasManager } from '@blooooork/three-optimization';

const atlasManager = new TextureAtlasManager({
    maxAtlasSize: 4096,  // Max atlas dimension
    padding: 2           // Padding between textures
});

// Create an atlas from multiple textures
const atlas = await atlasManager.createAtlas([
    texture1, texture2, texture3
]);

// Get UV coordinates for a specific texture
const uvs = atlasManager.getTextureUVs(texture1.uuid);
```

### 📦 Asset Manager
Efficient asset loading and caching system:
```javascript
import { AssetManager } from '@blooooork/three-optimization';

const assets = new AssetManager();

// Load and cache a model
const model = await assets.loadModel('model.glb');

// Load and cache a texture
const texture = await assets.loadTexture('texture.jpg');

// Get a cached material with specific properties
const material = assets.getMaterial('key', {
    color: 0xff0000,
    roughness: 0.5,
    metalness: 0.0
});
```

### 🧮 Memory Manager
Track and optimize memory usage:
```javascript
import { MemoryManager } from '@blooooork/three-optimization';

const memory = new MemoryManager();

// Track object memory usage
memory.track(object3D);

// Get memory statistics
const stats = memory.getStats();
console.log('Memory usage:', stats);
// Output: { geometries: 10, textures: 5, materials: 8, objects: 20 }

// Clean up resources
memory.dispose(object3D);
```

## Benefits

- **Improved Performance**: Reduce draw calls and optimize GPU memory usage
- **Better Memory Management**: Track and manage 3D resources effectively
- **Efficient Asset Loading**: Smart caching and loading of models and textures
- **Professional-Grade**: Built for production applications
- **Easy to Use**: Simple API with powerful features

## Installation

```bash
npm install @blooooork/three-optimization
```

## Requirements
- three.js ^0.160.0

## License
MIT 