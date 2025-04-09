# Blorktools - 3D Asset Development Toolset

A comprehensive development and debugging toolkit for Three.js applications, designed to streamline asset optimization, scene debugging, and performance tuning. Essential companion to the BlorkPack asset management system.

<p align="center">
  <img src="https://via.placeholder.com/800x200?text=BlorkTools+Interface" alt="BlorkTools Interface" width="800"/>
</p>

## Installation

```bash
# From npm registry
npm install @littlecarlito/blorktools

# Within monorepo
pnpm install @littlecarlito/blorktools
```

## Key Features

### Performance Monitoring Suite

<p align="center">
  <img src="https://via.placeholder.com/600x300?text=Performance+Monitor+Screenshot" alt="Performance Monitor" width="600"/>
</p>

The Performance Monitor helps identify and resolve bottlenecks:

- **Real-time Metrics**
  - FPS counter with history graph
  - Frame time breakdown (CPU vs GPU)
  - Memory usage tracking
  - Draw call counter
  - GPU utilization metrics

- **Performance Analysis**
  - WebGL call profiling
  - Shader compilation time tracking
  - Asset loading time analysis
  - Physics performance metrics
  - Animation system overhead tracking

- **Optimization Suggestions**
  - Intelligent bottleneck identification
  - Batching opportunities detection
  - Texture optimization recommendations
  - LOD implementation suggestions
  - Memory leak detection

### Scene Inspector

<p align="center">
  <img src="https://via.placeholder.com/600x300?text=Scene+Inspector+Screenshot" alt="Scene Inspector" width="600"/>
</p>

The Scene Inspector provides a deep dive into your Three.js scene:

- **Hierarchical Scene View**
  - Complete object tree visualization
  - Object filtering and search
  - Selection and isolation modes
  - Visibility toggles
  - Transform gizmos and manipulation

- **Property Editor**
  - Material property inspection and editing
  - Transform manipulation with precision controls
  - Object property modification in real-time
  - Shader uniform tweaking
  - Animation timeline editor

- **Scene Analysis**
  - Lighting optimization suggestions
  - Shadow rendering analysis
  - Occlusion culling visualization
  - Render order optimization
  - Frustum culling debugging

### Shader and Material Workshop

<p align="center">
  <img src="https://via.placeholder.com/600x300?text=Material+Workshop+Screenshot" alt="Material Workshop" width="600"/>
</p>

The Material Workshop aids in creating and optimizing materials:

- **Shader Development**
  - Live GLSL shader editing
  - Real-time compilation and error reporting
  - Uniform control panel
  - Shader performance analysis
  - Preset shader library

- **Material Creation**
  - PBR material designer
  - Texture channel mixing tools
  - Material variant creator
  - Environment map testing
  - Material performance analysis

### Asset Debugger

<p align="center">
  <img src="https://via.placeholder.com/600x300?text=Asset+Debugger+Screenshot" alt="Asset Debugger" width="600"/>
</p>

The Asset Debugger helps test and debug PBR texture sets:

- **Atlas Texture Testing**
  - Drag and drop interface for quick testing
  - Support for Base Color, ORM, and Normal map atlases
  - Real-time rendering on 3D cube for validation
  - Orbit controls for easy inspection

- **Material Visualization**
  - PBR material visualization with proper lighting
  - Individual channel inspection
  - Texture resolution and quality assessment
  - Format compatibility testing

## Usage

### As a Development Tool

When used within the monorepo, the tools can be started with:
```bash
# Start tools for all projects
pnpm dev

# Start tools specifically
pnpm turbo run tools --filter=@littlecarlito/blorktools
```

The tools will start on the next available port after the main application.

### Standalone Usage

Run the tools independently:
```bash
pnpm tools
```

Run the modular version (new architecture):
```bash
pnpm tools:modular
```

### Integration with Three.js Applications

```javascript
import { 
  PerformanceMonitor,
  SceneInspector, 
  MaterialWorkshop 
} from '@littlecarlito/blorktools';

// Initialize the Three.js scene
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const camera = new THREE.PerspectiveCamera();

// Initialize the tools with your Three.js environment
const perfMonitor = new PerformanceMonitor({ renderer });
const inspector = new SceneInspector({ scene, domElement: document.body });
const workshop = new MaterialWorkshop();

// Start monitoring performance
perfMonitor.start();

// Add custom metrics to track
perfMonitor.addCustomMetric('Physics', () => physicsTime);
perfMonitor.addCustomMetric('Animations', () => animationTime);

// Hook into render loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update tools before rendering
  perfMonitor.beginFrame();
  renderer.render(scene, camera);
  perfMonitor.endFrame();
  
  // Update other tools
  inspector.update();
}
animate();

// Toggle tools visibility with keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') perfMonitor.toggle();
  if (e.key === 'F2') inspector.toggle();
  if (e.key === 'F3') workshop.toggle();
});
```

### Advanced API Examples

#### Model Optimization

```javascript
import { ModelOptimizer } from '@littlecarlito/blorktools';

// Load model for optimization
const model = await THREE.GLTFLoader().loadAsync('model.glb');

// Initialize optimizer
const optimizer = new ModelOptimizer(model);

// Analyze model
const analysis = await optimizer.analyze();
console.log(`Triangles: ${analysis.triangles}, Vertices: ${analysis.vertices}`);
console.log(`Overdraw: ${analysis.overdrawFactor}`);
console.log(`Texture Memory: ${analysis.textureMemory} MB`);

// Get optimization suggestions
const suggestions = optimizer.getSuggestions();
for (const suggestion of suggestions) {
  console.log(`${suggestion.priority}: ${suggestion.description}`);
}

// Apply automatic optimizations
const optimizedModel = await optimizer.optimize({
  decimation: {
    enabled: true,
    targetTriangles: 10000,
    preserveUVs: true
  },
  textures: {
    maxSize: 1024,
    compressFormat: 'ktx2',
    mipmap: true
  },
  meshes: {
    mergeByMaterial: true,
    removeHidden: true
  }
});

// Export optimized model
await optimizer.export(optimizedModel, 'optimized.glb');
```

#### Performance Profiling

```javascript
import { PerformanceProfiler } from '@littlecarlito/blorktools';

// Create profiler
const profiler = new PerformanceProfiler();

// Start recording session
profiler.startRecording({
  duration: 30, // seconds
  markers: ['loading', 'rendering', 'physics'],
  captureTraces: true
});

// Add markers during app execution
function gameLoop() {
  profiler.markStart('physics');
  updatePhysics();
  profiler.markEnd('physics');
  
  profiler.markStart('rendering');
  render();
  profiler.markEnd('rendering');
  
  requestAnimationFrame(gameLoop);
}

// After recording completes
profiler.onRecordingComplete((report) => {
  console.log(`Average FPS: ${report.averageFps}`);
  console.log(`Frame time breakdown:`, report.frameTimeBreakdown);
  console.log(`Memory usage peak: ${report.memoryPeak} MB`);
  
  // Generate visual report
  const reportElement = profiler.generateVisualReport();
  document.body.appendChild(reportElement);
  
  // Export data for further analysis
  const jsonData = profiler.exportData();
  downloadJSON(jsonData, 'performance-report.json');
});
```

#### Shader Debugging

```javascript
import { ShaderDebugger } from '@littlecarlito/blorktools';

// Create shader debugger for a specific material
const material = new THREE.ShaderMaterial({
  vertexShader: myVertexShader,
  fragmentShader: myFragmentShader,
  uniforms: myUniforms
});

const debugger = new ShaderDebugger(material);

// Visualize specific shader outputs
debugger.visualizeOutput({
  normals: true,
  depth: true,
  uvs: true
});

// Add breakpoint to fragment shader (when pixel value meets condition)
debugger.addBreakpoint('fragColor.r > 0.9');

// Display uniform values over time
debugger.monitorUniform('time');

// Get shader complexity analysis
const complexity = debugger.analyzeComplexity();
console.log(`Instruction count: ${complexity.instructionCount}`);
console.log(`Register usage: ${complexity.registerUsage}`);
console.log(`Texture reads: ${complexity.textureReads}`);
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

MIT 