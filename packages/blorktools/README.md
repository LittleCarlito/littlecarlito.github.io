# Blorktools

Development tools for 3D assets and debugging in Three.js projects.

## Installation

```bash
npm install @littlecarlito/blorktools
```

## Tools Included

### Asset Debugger

The Asset Debugger is a powerful tool for debugging 3D models and textures. It provides a graphical interface to:

- Visualize and debug UV mappings
- Toggle visibility of different mesh groups
- Visualize texture atlases with UV grid overlays
- Display detailed information about meshes and materials

## Usage

### Running the Tools

You can run the tools directly from the main project:

```bash
# From the main project root
npm run tools
```

Or from within the package directory:

```bash
# From within the packages/blorktools directory
npm run tools
```

This will start a development server with the tools available at:
- Asset Debugger: http://localhost:5173/asset_debugger.html

### Using the Asset Debugger in Your Code

```javascript
import { AssetDebugger } from '@littlecarlito/blorktools';

// Create a new debugger instance
const assetDebugger = new AssetDebugger({
  modelPath: 'path/to/your/model.glb',
  texturePath: 'path/to/your/texture.jpg'
});

// Initialize the debugger in a container element
assetDebugger.init(document.getElementById('container'));

// Toggle visibility of mesh groups
assetDebugger.toggleMeshVisibility('collision', true);

// Switch UV maps
assetDebugger.switchUVMap(2); // Switch to UV2
```

## Examples

Example usage can be found in the `examples` directory:

```bash
# Run the asset debugger example
npm run example:asset-debugger
``` 