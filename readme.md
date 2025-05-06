# ThreeJS Tooling Suite Monorepo

A monorepo containing advanced Three.js tooling libraries and interactive 3D applications built with these tools. This project includes physics-based 3D environments, asset management systems, and development tools for creating immersive web experiences with industry-leading performance optimization.

[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Visit-blue)](https://littlecarlito.github.io/threejs_site/)
![Deployment Status](https://github.com/LittleCarlito/threejs_site/actions/workflows/main-pipeline.yml/badge.svg)
![Under Construction](https://img.shields.io/badge/status-under%20construction-yellow)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier-Physics-blue)
![Version](https://img.shields.io/github/v/release/LittleCarlito/threejs_site?include_prereleases)
![Lerna](https://img.shields.io/badge/Lerna-9333EA?logo=lerna&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)

## 📋 Overview

This monorepo houses a collection of high-performance tools and applications for Three.js development. It's designed with a focus on:

- **Performance Optimization** - Advanced techniques for achieving smooth 60+ FPS even with complex scenes
- **Asset Management** - Intelligent loading, caching, and lifecycle management for 3D assets
- **Physics Integration** - Seamless integration with Rapier3D for realistic physical interactions
- **Developer Experience** - Comprehensive tooling for debugging and analyzing 3D applications

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
├── lerna.json         # Lerna configuration
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

The monorepo is powered by Lerna for package versioning/publishing and PNPM for fast, disk-space efficient package management.

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
pnpm fmt

# Run tests
pnpm test
```

## 📝 Versioning System

This project uses [Lerna](https://lerna.js.org/) and [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and publishing.

### Commit Message Format

We follow the conventional commits specification with some custom extensions:

```
<type>([scope]): <description>

[optional body]

[optional footer(s)]
```

### Commit Types

We support the following commit types:

- `feat`: A new feature (minor version bump)
- `fix`: A bug fix (patch version bump)
- `refactor`: Code changes that neither fix bugs nor add features (patch version bump)
- `perf`: Performance improvements (patch version bump)
- `docs`: Documentation only changes (no version bump)
- `style`: Changes that don't affect code functionality (no version bump)
- `test`: Adding or correcting tests (no version bump)
- `chore`: Changes to build process or auxiliary tools (no version bump)
- `ci`: Changes to CI configuration files and scripts (no version bump)
- `build`: Changes that affect the build system (no version bump)
- `revert`: Reverts a previous commit (depends on the reverted commit)
- `slice`: Small, incremental changes (patch version bump)

### Special Scopes

- `(pipeline)`: When this scope is used, the commit is ignored for version bumping regardless of type

### Version Bumping Rules

- **Major (x.0.0)**: Any commit with a `BREAKING CHANGE` footer
- **Minor (0.x.0)**: `feat` type commits
- **Patch (0.0.x)**: `fix`, `refactor`, `perf`, and `slice` type commits

### Versioning Mode

This project uses **independent versioning** mode in Lerna, which means:

- Each package maintains its own version number
- Only packages explicitly mentioned in commit scopes or those that depend on changed packages get bumped
- Different packages can have different version numbers

To change to fixed/lockstep versioning (where all packages share the same version), you would change `"version": "independent"` to a specific version number in lerna.json.

### Lerna Commands

```bash
# Check which packages have changed since the last release
pnpm lerna:changed

# Bump versions based on commit messages
pnpm lerna:version [--no-push]

# Publish packages to npm registry
pnpm lerna:publish

# Show differences between packages
pnpm lerna:diff
```

## 🚀 Deployment

The site is automatically deployed to GitHub Pages through a sophisticated CI/CD pipeline:

- **Build Optimization** - Advanced bundling and tree-shaking
- **Asset Processing** - Automatic compression and optimization
- **Parallel Deployment** - Multiple environments for testing
- **Performance Regression Testing** - Automated benchmarks
- **Lighthouse Integration** - Score tracking and improvement suggestions

## 📝 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

- You are free to use, modify, and distribute this software.
- If you modify the software, you must distribute your modifications under the same license.
- You must disclose the source code when distributing the software.
- There is no warranty for this software.

For the full license text, see the [LICENSE](LICENSE) file.

## 📧 Contact

- Email: info@blorkfield.com
- Discord: "Blooooork"

---

Built by Blorkfield LLC
