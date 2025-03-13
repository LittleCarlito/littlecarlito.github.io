# Interactive 3D Portfolio Website

A dynamic, physics-based portfolio website built with Three.js, featuring interactive 3D elements, real-time physics simulations, and engaging user interfaces. Built with a modular architecture and powerful development tools.

[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Visit-blue)](https://littlecarlito.github.io/threejs_site/)
![Deployment Status](https://github.com/LittleCarlito/threejs_site/actions/workflows/deploy.yml/badge.svg)
![Under Construction](https://img.shields.io/badge/status-under%20construction-yellow)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier-Physics-blue)
![Version](https://img.shields.io/github/v/release/LittleCarlito/threejs_site?include_prereleases)

## 🌟 Features

- **Interactive 3D Environment**:
  - Fully navigable 3D space with physics
  - Dynamic object interactions
  - Real-time physics simulations
  - Performance-optimized rendering

- **Asset Management System** (@littlecarlito/blorkpack):
  - Smart asset loading and caching
  - Instance pooling and optimization
  - Physics body management
  - Scene state persistence
  - Material system with custom shaders

- **Development Tools** (@littlecarlito/blorktools):
  - Real-time asset inspection
  - UV mapping visualization
  - Performance monitoring
  - Scene debugging
  - Asset optimization tools

- **Dynamic Lighting System**:
  - Real-time spotlight interactions
  - Dynamic shadow mapping
  - Performance-optimized calculations
  - Interactive light controls

- **Physics Integration**:
  - Real-time Rapier3D physics
  - Collision group management
  - Dynamic state handling
  - Custom collision shapes
  - Physics-based interactions

- **Interactive UI Elements**: 
  - Physics-based menus and signs
  - Particle systems and effects
  - Dynamic text animations
  - Responsive overlays

## 🚀 Getting Started

1. Clone the repository
    ```bash
    git clone https://github.com/LittleCarlito/threejs_site.git
    cd threejs_site
    ```

2. Install dependencies
    ```bash
    npm install
    ```

3. Start development server
    ```bash
    npm run dev
    ```

The development environment will start with:
- Main website at `http://localhost:5173`
- Development tools on the next available port

## 🎮 Controls

- **Left Click**: Grab and move objects
- **Right Click**: Push objects with physics
- **Both Mouse Buttons**: Orbit camera
- **Mouse Wheel**: Zoom grabbed objects
- **Mouse Movement**: Interact with UI elements
- **L Key**: Toggle spotlight controls
- **Arrow Keys**: Adjust spotlight in light mode
- **Space**: Reset physics state
- **Esc**: Toggle development tools

## 🏗️ Project Structure

```
├── packages/
│   ├── blorkpack/     # Asset and physics management
│   └── blorktools/    # Development and debugging tools
├── public/
│   ├── assets/        # 3D models and textures
│   ├── fonts/         # Custom fonts
│   ├── images/        # Image assets
│   └── pages/         # HTML templates
├── src/
│   ├── background/    # 3D environment components
│   ├── viewport/      # Camera and view management
│   ├── physics/       # Physics integration
│   ├── ui/           # User interface components
│   ├── effects/      # Visual effects and particles
│   ├── lights/       # Lighting system
│   └── main.js       # Application entry point
```

## 📦 Internal Packages

### @littlecarlito/blorkpack
Advanced asset and physics management system:
- Smart asset loading and caching
- Physics integration with Rapier3D
- Instance pooling and optimization
- Scene state management
- Material system with custom shaders

### @littlecarlito/blorktools
Comprehensive development and debugging toolkit:
- Asset inspection and optimization
- Performance monitoring
- Scene debugging
- UV mapping tools
- Material editor

## 🛠️ Development Tools

The project includes powerful development tools that start automatically with `npm run dev`:

1. **Main Website** (default port):
   - Live reloading
   - Error reporting
   - Performance metrics

2. **Development Tools** (auto-assigned port):
   - Asset debugger
   - Scene inspector
   - Performance monitor
   - Material editor
   - UV mapping tools

Additional commands:
```bash
# Run tools independently
npm run tools

# Run modular version with specific tools
npm run tools:modular
```

## 🚀 Live Demo

Visit the live site: [https://littlecarlito.github.io/threejs_site/](https://littlecarlito.github.io/threejs_site/)

## 🛠️ Technology Stack

- **Frontend Framework**: Three.js with custom physics integration
- **Build Tool**: Vite with automated GitHub Pages deployment
- **Physics Engine**: Rapier3D for realistic object interactions
- **Version Control**: Semantic versioning with automated changelog generation
- **Lighting System**: Advanced Three.js spotlight and shadow system
- **3D Assets**: GLTF/GLB models with dynamic loading
- **Animation**: Custom tweening system with particle effects
- **CI/CD**: GitHub Actions for automated deployment
- **Asset Management**: Dynamic loading with error handling
- **UI Components**: Physics-based interactive elements

## 🎨 Features in Detail

### Physics-Based Interactions
- Real-time physics simulation for all 3D objects
- Customizable physical properties (mass, restitution, friction)
- Chain physics for menu systems

### Dynamic Asset Management
- Efficient 3D model loading and caching
- Automatic physics collider generation
- Instance management for multiple object copies
- Error handling and fallback systems

### Interactive UI Elements
- Animated text reveals
- Particle effects
- Physics-based menu systems
- Responsive overlay system

## 🔄 Continuous Integration

This project uses GitHub Actions for automated deployment:
- Automatic builds on push to main branch
- Asset optimization during build
- Immediate deployment to GitHub Pages
- Status checks and deployment verification

## 🤝 Contributing

This project is currently under active development. Feel free to open issues or submit pull requests.

## 📝 License

[MIT License](LICENSE)

## 📧 Contact

- Email: steven.meier77@gmail.com
- Discord: "Blooooork"

---

Built with 💻 by Steven & Bennett Meier
