# @blooooork/three-effects

A professional-grade collection of visual effects for Three.js applications. This package provides high-performance, reusable effect systems including bloom post-processing, particle systems, and advanced material management.

## Features

### 🌟 Bloom Effect System
Advanced post-processing bloom effects with configurable parameters:
```javascript
import { BloomEffectSystem } from '@blooooork/three-effects';

const bloomSystem = new BloomEffectSystem(renderer, scene, camera);
// In your render loop:
bloomSystem.render();
```

### 🎉 Particle System
Sophisticated particle system with physics and automatic cleanup:
```javascript
import { ParticleSystem } from '@blooooork/three-effects';

const particles = new ParticleSystem(scene, camera);
// Create a confetti burst
particles.createConfettiBurst(
    new THREE.Vector3(0, 0, 0),  // position
    50,                          // particle count
    [0xff0000, 0x00ff00]        // colors
);
// In your render loop:
particles.update();
```

### ✨ Emission Material System
Efficient material management with automatic caching:
```javascript
import { EmissionMaterialSystem } from '@blooooork/three-effects';

const materials = new EmissionMaterialSystem();
const glowingMaterial = materials.createEmissiveMaterial(
    new THREE.Color(0xff0000),
    {
        emissiveIntensity: 2,
        roughness: 0.5
    }
);
```

## Installation

```bash
npm install @blooooork/three-effects
```

## Requirements
- three.js ^0.160.0

## License
MIT 