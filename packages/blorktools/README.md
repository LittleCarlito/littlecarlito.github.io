# BlorkTools

A toolkit of utilities for Three.js development with an emphasis on debugging, visualization, and development tools.

## Key Features

- Asset Debugger: Visualize and debug 3D assets with a powerful UI
- Rig Debugger: Debug animation rigs and skeletal animations 
- Performance Tools: Monitor and optimize rendering performance

## Installation

```bash
npm install @littlecarlito/blorktools
```

## Usage

```javascript
import { AssetDebugger } from '@littlecarlito/blorktools';

// Initialize the asset debugger
const debugger = new AssetDebugger({
  container: document.getElementById('debug-container'),
  options: {
    showGrid: true,
    showAxes: true
  }
});

// Load a model for debugging
debugger.loadModel('path/to/model.glb');
```

## Architecture

The codebase follows a modular architecture for better maintainability and extensibility:

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

## Development

Within the monorepo, you can build and test the package using Turborepo:

```bash
# Build only blorktools
pnpm turbo run build --filter=@littlecarlito/blorktools

# Run tests
pnpm turbo run test --filter=@littlecarlito/blorktools

# Start in development mode with hot reloading
pnpm turbo run dev --filter=@littlecarlito/blorktools
```

## Extensions

Blorktools supports custom extensions and plugins:

```javascript
import { registerPlugin } from '@littlecarlito/blorktools';

// Create custom plugin
const myPlugin = {
  name: 'AI-OptimizationSuggester',
  version: '1.0.0',
  initialize(context) {
    // Setup plugin with context
    this.api = context.api;
    this.scene = context.scene;
    
    // Register custom UI panel
    this.api.registerPanel('AI Suggestions', this.renderPanel.bind(this));
  },
  renderPanel(container) {
    // Create UI elements
    const button = document.createElement('button');
    button.textContent = 'Analyze Scene';
    button.onclick = this.analyzeScene.bind(this);
    container.appendChild(button);
  },
  analyzeScene() {
    // Custom analysis logic
    const suggestions = this.runAnalysis(this.scene);
    this.api.showResults(suggestions);
  },
  runAnalysis(scene) {
    // AI-based scene analysis
    return ['Suggestion 1', 'Suggestion 2'];
  }
};

// Register plugin
registerPlugin(myPlugin);
```

## Browser Support

| Browser | Support Level | Notes |
|---------|--------------|-------|
| Chrome  | Full | Best experience with DevTools integration |
| Firefox | Full | WebGL Inspector integration available |
| Safari  | Full | Performance may vary |
| Edge    | Full | Same as Chrome |
| iOS     | Limited | Basic functionality only |
| Android | Limited | Basic functionality only |

## Dependencies

- Three.js (^0.172.0)
- Express (^4.18.3)
- Vite (for development server)
- dat.GUI (for control interfaces)
- gl-matrix (for math operations)

## Contributing

This package is part of the [threejs_site](https://github.com/littlecarlito/threejs_site) monorepo. Please refer to the main repository for contribution guidelines.

## License

GNU General Public License v3.0 (GPL-3.0) 