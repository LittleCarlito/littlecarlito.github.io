# ThreeJS Tooling Suite Monorepo

A monorepo containing advanced Three.js tooling libraries and interactive 3D applications built with these tools. This project includes physics-based 3D environments, asset management systems, and development tools for creating immersive web experiences with industry-leading performance optimization.

[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Visit-blue)](https://littlecarlito.github.io/threejs_site/)
![Deployment Status](https://github.com/LittleCarlito/threejs_site/actions/workflows/unified-pipeline.yml/badge.svg)
![Under Construction](https://img.shields.io/badge/status-under%20construction-yellow)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier-Physics-blue)
![Version](https://img.shields.io/github/v/release/LittleCarlito/threejs_site?include_prereleases)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)

## 📋 Overview

This monorepo houses a collection of high-performance tools and applications for Three.js development. It's designed with a focus on:

- **Performance Optimization** - Advanced techniques for achieving smooth 60+ FPS even with complex scenes
- **Asset Management** - Intelligent loading, caching, and lifecycle management for 3D assets
- **Physics Integration** - Seamless integration with Rapier3D for realistic physical interactions
- **Developer Experience** - Comprehensive tooling for debugging and analyzing 3D applications

## 🌐 GitHub Pages Deployment

This project is deployed to GitHub Pages at [https://littlecarlito.github.io/threejs_site/](https://littlecarlito.github.io/threejs_site/).

For information on how the GitHub Pages deployment works and how to test it locally, see the [GitHub Pages documentation](documentation/github-pages.md).

## 🏗️ Project Structure

```
threejs_site/
├── apps/
│   ├── portfolio/     # Interactive 3D portfolio website
│   │   ├── src/       # Application source code
│   │   ├── public/    # Static assets and resources
│   │   └── ...        # Configuration files
│   └── web/           # Main web application showcase
│       ├── src/       # Application source code
│       ├── public/    # Static assets and resources
│       └── ...        # Configuration files
├── packages/
│   ├── blorkpack/     # Asset and physics management system
│   │   ├── src/       # Core library source code
│   │   ├── examples/  # Example implementations
│   │   └── ...        # Configuration and build files
│   └── blorktools/    # Development and debugging toolkit
│       ├── src/       # Toolkit source code
│       ├── ui/        # User interface components
│       └── ...        # Configuration and build files
├── package.json       # Root package configuration
├── turbo.json         # Turborepo configuration
└── pnpm-workspace.yaml # Workspace definition
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
   git clone https://github.com/LittleCarlito/threejs_site.git
   cd threejs_site
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

## 📦 Core Packages

### @littlecarlito/blorkpack
Advanced asset and physics management system that provides:

- **High-Performance Asset Pipeline**
  - Smart loading strategies with prioritization
  - Memory-efficient instance reuse and pooling
  - Automatic LOD (Level of Detail) management
  - Background loading and progressive enhancement
  - Scene graph optimization and culling

- **Physics Integration**
  - Rapier3D physics world management
  - Automatic collision shape generation from geometry
  - Specialized collision groups and filters
  - Physics body pooling and reuse
  - High-performance collision detection

- **Scene Management**
  - Declarative scene configuration
  - Component-based scene hierarchy
  - State persistence and serialization
  - Dynamic scene updates with minimal performance impact
  - Automated cleanup and garbage collection

- **Material System**
  - Smart shader compilation and reuse
  - Material variants with minimal memory overhead
  - Texture atlasing and management
  - Custom shader integration with simplified API
  - Material state caching for quick switching

### @littlecarlito/blorktools
Comprehensive development and debugging toolkit with:

- **Visual Debugging**
  - Interactive scene inspector
  - Realtime performance metrics
  - Memory usage visualization
  - Draw call optimization tools
  - Shader complexity analysis

- **Asset Optimization**
  - Texture analysis and compression suggestions
  - Mesh optimization tools
  - Animation data inspection
  - UV mapping visualization
  - Material property editor

- **Developer UX**
  - Hot module replacement for 3D scenes
  - In-context editing tools
  - Asset comparison utilities
  - Export optimization suggestions
  - Integration with browser dev tools

## 🎮 Interactive Features

- **3D Environment Architecture**:
  - Multi-threaded rendering pipeline
  - Optimized WebGL state management
  - Custom frustum culling
  - Occlusion culling for complex scenes
  - Dynamic batching and instancing

- **Physics Simulation**:
  - Distributed physics calculation
  - Custom collision resolution
  - Continuous collision detection
  - Constraint systems for complex interactions
  - Physics-based animations and transitions

- **Advanced Rendering**:
  - Physically-based rendering (PBR)
  - Screen-space reflections
  - Ambient occlusion techniques
  - Volumetric lighting effects
  - Custom post-processing pipeline

- **Interactive Interface System**:
  - Physics-driven UI components
  - 3D spatial interfaces
  - Context-aware interaction system
  - Hybrid 2D/3D UI architecture
  - Accessibility considerations for 3D UIs

## 🛠️ Development Workflow

The monorepo is powered by Turborepo for efficient build orchestration and PNPM for fast, disk-space efficient package management.

### Common Commands

```bash
# Start development server for all apps and packages
pnpm dev

# Build all packages and apps
pnpm build

# Clean all build outputs
pnpm clean

# Run linting
pnpm lint

# Format code with Prettier
pnpm format

# Run tests
pnpm test
```

### Turborepo Advanced Commands

```bash
# Build all packages with maximum concurrency
pnpm turbo run build --concurrency=10

# Build specific package with verbose output
pnpm turbo run build --filter=@littlecarlito/blorkpack --verbose

# Run tools in specific package with custom environment
pnpm turbo run tools --filter=@littlecarlito/blorktools --env=development

# Run with cache disabled during development
pnpm turbo run dev --no-cache

# Build only affected packages 
pnpm turbo run build --filter=...[origin/main]
```

## 🔍 Architecture Deep Dive

### Performance Optimization

The tooling suite implements several advanced techniques for performance:

- **Custom WebGL State Management** - Minimizes expensive state changes
- **Geometry Instancing** - Reduces draw calls for repeated objects
- **Worker Thread Processing** - Offloads heavy calculations
- **GPU-Accelerated Physics** - Utilizes compute shaders where available
- **Texture Streaming** - Progressive loading of high-resolution textures
- **Shader Permutation Management** - Optimizes shader variants

### Memory Management

Careful attention to memory usage ensures stable performance:

- **Asset Reference Counting** - Automatic cleanup of unused resources
- **Texture Compression** - Automatic format selection based on support
- **Geometry Simplification** - Dynamic LOD based on camera distance
- **Deferred Asset Loading** - Only load what's needed when it's needed
- **Memory Pool Allocation** - Reduces garbage collection pauses

## 🚀 Deployment

The site is automatically deployed to GitHub Pages through a sophisticated CI/CD pipeline:

- **Build Optimization** - Advanced bundling and tree-shaking
- **Asset Processing** - Automatic compression and optimization
- **Parallel Deployment** - Multiple environments for testing
- **Performance Regression Testing** - Automated benchmarks
- **Lighthouse Integration** - Score tracking and improvement suggestions

## 🤝 Contributing

This project welcomes contributions. See our [contributing guide](CONTRIBUTING.md) for more information.

## 📝 License

This project is licensed under a custom dual-license:

### Non-Commercial License
- Free for non-commercial use
- Allows modification, distribution, and use in non-commercial projects
- Must maintain these same license terms in derivative works

### Commercial License
Commercial use requires explicit written permission from the copyright holder (Steven Meier). This includes:
- Using the software to generate revenue
- Including in commercial products
- Using in for-profit businesses
- Creating derivative works for commercial purposes

For commercial licensing inquiries, contact: steven.meier77@gmail.com

See the [LICENSE](LICENSE) file for full terms and conditions.

## 📧 Contact

- Email: steven.meier77@gmail.com
- Discord: "Blooooork"

## Versioning

This project uses [Changesets](https://github.com/changesets/changesets) for version management. When making changes that should result in a version bump:

1. Make your changes
2. Run `pnpm change` to create a changeset
3. Commit the generated changeset file along with your changes
4. Create a PR with your changes

When your PR is merged to main, a "Version Packages" PR will be automatically created. When that PR is merged, packages will be automatically published to GitHub Packages.

See [Changesets Documentation](./documentation/changesets.md) for more details.

## GitHub Actions Workflows

This repository uses several GitHub Actions workflows:

1. **Unified Pipeline** (primary) - Runs on every push to main
   - Builds and tests packages
   - Automatically versions and publishes packages when changesets are present
   - Handles GitHub Pages deployments
   - Fully automated - no manual intervention required

2. **Changesets** - Manual workflow for creating releases
   - Only runs when manually triggered 
   - Not needed for normal workflow as unified pipeline handles publishing

3. **Release/Prerelease** - For specific/beta releases
   - Only run when manually triggered
   - For special release scenarios

**Note:** If you see multiple workflows running in parallel after a merge to main, it may include GitHub's default Pages deployment alongside our custom workflow. This is expected behavior.

For more details, see [documentation/changesets.md](documentation/changesets.md).

---

Built with passion and precision by Steven & Bennett Meier
