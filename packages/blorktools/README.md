# Blorktools - 3D Asset Development Toolset

A collection of development and debugging tools for 3D assets in Three.js applications.

## Features

- **Asset Debugger**: Interactive tool for debugging 3D models and textures
  - UV mapping visualization
  - Multi-texture support with different UV channels
  - Atlas visualization for texture mapping
  - Detailed model information
  - Texture management and blending

## Architecture

The codebase has been refactored into a modular architecture for better maintainability and extensibility:

### Core Modules
- `index.js` - Application entry point and state management
- `scene.js` - Three.js scene and rendering setup
- `loader.js` - Model and texture loading
- `analyzer.js` - Model structure analysis and UV handling

### UI Modules
- `debugPanel.js` - Information panel and controls
- `textureEditor.js` - Texture editor with multi-texture support
- `atlasVisualization.js` - UV mapping visualization
- `dragdrop.js` - Drag and drop interface for file uploading

### Material Modules
- `textureManager.js` - Texture loading and application
- `multiTextureMaterial.js` - Custom shader-based material for blending multiple textures 

### Utility Modules
- `helpers.js` - Common utility functions
- `events.js` - Event listeners and keyboard shortcuts

## Usage

### Running the Asset Debugger

Standard version:
```bash
npm run tools
```

Modular version (new architecture):
```bash
npm run tools:modular
```

## Browser Support

Requires a modern browser with WebGL support.

## Dependencies

- Three.js
- Vite (for development server) 