# @blooooork/three-lighting

Professional lighting system for Three.js applications. This package provides advanced spotlight management, debug visualization, and shadow optimization.

## Features

### 🔦 Advanced Spotlight System
Create and manage spotlights with precise control:
```javascript
import { LightingSystem } from '@blooooork/three-lighting';

const lighting = new LightingSystem(scene, {
    debug: true,              // Enable debug visualization
    shadowMapSize: 2048       // High-quality shadows
});

const spotlight = lighting.createSpotlight({
    position: new THREE.Vector3(0, 50, 0),
    target: new THREE.Vector3(0, 0, 0),
    color: 0xffffff,
    intensity: 1,
    angle: Math.PI / 6,
    penumbra: 0.1,
    castShadow: true
});

// Dynamic control
spotlight.setPosition(new THREE.Vector3(10, 50, 10));
spotlight.setTarget(new THREE.Vector3(0, 0, 0));
spotlight.setIntensity(1.5);
spotlight.setAngle(Math.PI / 4);
```

### 🎯 Debug Visualization
Professional debug tools for light setup:
```javascript
// Toggle debug visualization at runtime
lighting.setDebug(true);  // Show debug helpers
lighting.setDebug(false); // Hide debug helpers

// Debug features include:
// - Spotlight direction indicators
// - Light cone visualization
// - Shadow camera frustum
// - Interactive adjustments
```

### ⚡ Optimized Performance
Built with performance in mind:
- Shared materials for debug visualization
- Efficient memory management
- Automatic resource cleanup
- Smart shadow map configuration

## Benefits

- **Professional Lighting**: Create cinematic lighting setups
- **Visual Debugging**: Intuitive tools for light positioning
- **Memory Efficient**: Automatic resource management
- **Shadow Optimization**: High-quality shadows with performance
- **Easy to Use**: Simple API with powerful features

## Installation

```bash
npm install @blooooork/three-lighting
```

## Requirements
- three.js ^0.160.0

## License
MIT 