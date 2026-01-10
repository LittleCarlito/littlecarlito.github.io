# 3D Portfolio Site

An interactive 3D portfolio website built with Three.js and modern web technologies. Features physics-based 3D environments, asset management, and immersive web experiences with industry-leading performance optimization.

[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Visit-blue)](https://littlecarlito.github.io/)
![Deployment Status](https://github.com/LittleCarlito/littlecarlito.github.io/actions/workflows/main-pipeline.yml/badge.svg)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier-Physics-blue)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)

## 📋 Overview

This repository contains interactive 3D portfolio applications designed with a focus on:

- **Performance Optimization** - Advanced techniques for achieving smooth 60+ FPS even with complex scenes
- **Asset Management** - Intelligent loading, caching, and lifecycle management for 3D assets
- **Physics Integration** - Seamless integration with Rapier3D for realistic physical interactions

## 🏗️ Project Structure

```
littlecarlito.github.io/
├── apps/
│   ├── portfolio/        # Main portfolio website
│   │   ├── src/          # Application source code
│   │   ├── public/       # Static assets and resources
│   │   └── ...           # Configuration files
│   └── 3d_portfolio/     # Interactive 3D portfolio experience
│       ├── src/          # Application source code
│       ├── public/       # Static assets and resources
│       └── ...           # Configuration files
├── tests/                # Test suites
├── .github/              # CI/CD workflows
├── package.json          # Root package configuration
└── pnpm-workspace.yaml   # Workspace definition
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.15.4

### Installation

1. Install pnpm if you don't have it already:
   ```bash
   npm install -g pnpm
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/LittleCarlito/littlecarlito.github.io.git
   cd littlecarlito.github.io
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Start development server:
   ```bash
   pnpm dev
   ```

5. Build for production:
   ```bash
   pnpm build
   ```

## 🎮 Features

- **3D Environment Architecture**:
  - Multi-threaded rendering pipeline
  - Optimized WebGL state management
  - Dynamic batching and instancing

- **Physics Simulation**:
  - Rapier3D physics integration
  - Continuous collision detection
  - Physics-based animations and transitions

- **Advanced Rendering**:
  - Physically-based rendering (PBR)
  - Custom post-processing pipeline
  - Optimized shader management

## 🛠️ Development

### Common Commands

```bash
# Start development server
pnpm dev

# Build all apps
pnpm build

# Clean all build outputs
pnpm clean

# Run linting
pnpm lint

# Format code with Prettier
pnpm fmt

# Run tests
pnpm test
```

## 🚀 Deployment

The site is automatically deployed to GitHub Pages through a CI/CD pipeline:

- **Build Optimization** - Advanced bundling and tree-shaking
- **Asset Processing** - Automatic compression and optimization
- **Automated Testing** - Tests run on every push

## 📝 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

For the full license text, see the [LICENSE](LICENSE) file.

## 📧 Contact

- Email: info@blorkfield.com
- Discord: "Blooooork"

---

Built by Blorkfield LLC
