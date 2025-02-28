# Interactive 3D Portfolio Website

A dynamic, physics-based portfolio website built with Three.js, featuring interactive 3D elements, real-time physics simulations, and engaging user interfaces.

[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Visit-blue)](https://littlecarlito.github.io/threejs_site/)
![Deployment Status](https://github.com/LittleCarlito/threejs_site/actions/workflows/deploy.yml/badge.svg)
![Under Construction](https://img.shields.io/badge/status-under%20construction-yellow)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier-Physics-blue)
![Version](https://img.shields.io/github/v/release/LittleCarlito/threejs_site?include_prereleases)

## 🌟 Features

- **Interactive 3D Environment**: Fully navigable 3D space built with Three.js
- **Dynamic Lighting System**:
  - Real-time spotlight interactions
  - Dynamic shadows and ambient lighting
  - Interactive light controls
- **Automated Version Management**:
  - Semantic versioning with automated releases
  - Changelog generation
  - Version tracking and deployment history
- **Physics Simulations**: Real-time physics using Rapier3D
- **Dynamic Asset Loading**: Efficient asset management system for 3D models and textures
- **Interactive UI Elements**: 
  - Draggable 3D objects
  - Physics-based chains and signs
  - Particle effects and animations
- **Responsive Design**: Adapts to different screen sizes and device pixel ratios
- **Multiple View Sections**:
  - Projects showcase
  - Education history
  - Work experience
  - Contact information

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

The site will be available at `http://127.0.0.1:5173`

## 🎮 Controls

- **Left Click**: Grab and move objects
- **Right Click**: Push objects
- **Both Mouse Buttons**: Rotate camera
- **Mouse Wheel**: Zoom grabbed objects
- **Mouse Movement**: Hover over interactive elements
- **L Key**: Toggle spotlight controls
- **Arrow Keys**: When in spotlight mode, adjust spotlight position

## 🏗️ Project Structure

```
├── public/
│   ├── assets/         # 3D models and textures
│   ├── fonts/         # Custom fonts
│   ├── images/        # Image assets
│   └── pages/         # HTML templates
├── development/       # Source files for assets (not included in build)
│   └── blender/      # Original Blender files
├── src/
│   ├── background/    # 3D environment components
│   ├── viewport/      # Camera and view management
│   ├── common/        # Shared utilities
│   ├── lights/        # Lighting system components
│   └── main.js        # Application entry point
```

### Development Assets
The `development` folder contains source files for assets used in the project:
- Original Blender (.blend) files
- Work-in-progress assets
- Asset documentation
- Source files for textures and models

This folder is tracked in git for collaboration but excluded from the production build.

### Dynamic Lighting System
- Real-time spotlight manipulation
- Dynamic shadow mapping
- Performance-optimized light calculations
- Interactive light controls for user engagement

### Automated Version Management
- Semantic versioning following SemVer 2.0.0
- Automated changelog generation
- Version tracking across deployments
- Release tagging and documentation

### Performance Optimizations

- Efficient asset loading with caching
- Physics engine optimizations
- Responsive image loading
- Dynamic import of heavy components
- Optimized lighting calculations and shadow mapping
- Intelligent asset instancing

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
