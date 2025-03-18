# Portfolio

An interactive 3D portfolio website built with Three.js and the blorkpack asset management system, showcasing web development and creative coding projects in an immersive environment. This site features dynamic 3D rendering, physics-based interactions, real-time lighting effects, and a modern UI design to present my work in an engaging and interactive way.

## 🌟 Key Features

- **Immersive 3D Environment** - Navigate through a fully realized 3D space with custom physics-based interactions and dynamic lighting
- **Interactive Project Showcases** - Examine projects in 3D space with interactive elements that reveal project details
- **Physics-Driven UI** - Unique interface elements that respond to physics interactions and user input
- **Dynamic Lighting System** - Real-time lighting effects that enhance the visual experience and create atmosphere
- **Optimized Performance** - Carefully balanced visuals and performance for smooth experience across devices
- **Responsive Design** - Adapts to different screen sizes while maintaining immersive qualities

## 🛠️ Technical Implementation

### Core Technologies
- **Three.js** - Foundation for 3D rendering and scene management
- **@littlecarlito/blorkpack** - Asset management, physics integration, and scene optimization
- **Rapier3D** - Physics engine for realistic object interactions
- **Custom Shaders** - GLSL shaders for advanced visual effects and optimizations

### Physics System
- Real-time collision detection for interactive elements
- Physics-based animations and transitions
- Optimized collision shapes for performance
- Custom force application for user interactions

### Rendering Pipeline
- Deferred rendering for complex lighting scenarios
- Custom post-processing effects for visual enhancement
- Performance-optimized shadow mapping
- Dynamic LOD (Level of Detail) system for complex objects

### Asset Management
- Dynamic asset loading based on viewport and interaction
- Memory-optimized instance pooling
- Automatic texture compression and optimization
- Asset prefetching for seamless transitions

## 🎮 Controls & Interaction

- **Mouse/Touch Navigation** - Intuitive controls for exploring the 3D space
- **Physics Interactions** - Grab, push, and interact with 3D elements
- **Context-Sensitive UI** - Interface elements that respond to your current focus
- **Camera Transitions** - Smooth automated camera movements between focal points
- **Hotspots & Triggers** - Interactive elements that reveal additional content

## 📱 Responsive Adaptation

- **Desktop Experience** - Full 3D environment with advanced physics and lighting
- **Tablet Experience** - Optimized rendering with maintained interactivity
- **Mobile Experience** - Simplified yet immersive 3D showcase with touch controls
- **Performance Scaling** - Automatic quality adjustments based on device capability

## 🚀 Future Enhancements

- WebXR support for VR/AR experiences
- Advanced particle systems for environmental effects
- Interactive audio visualization
- Expanded project showcase capabilities
- Real-time collaboration features

## 🔄 Integration

This portfolio is built as part of the [threejs_site](https://github.com/littlecarlito/threejs_site) monorepo, leveraging shared packages for asset management and development tools.

## 🛠️ Development

```bash
# Start development server
pnpm dev --filter=portfolio

# Build for production
pnpm build --filter=portfolio
``` 