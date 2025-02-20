# Interactive 3D Portfolio Website

A dynamic, physics-based portfolio website built with Three.js, featuring interactive 3D elements, real-time physics simulations, and engaging user interfaces.

![Under Construction](https://img.shields.io/badge/status-under%20construction-yellow)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier-Physics-blue)

## 🌟 Features

- **Interactive 3D Environment**: Fully navigable 3D space built with Three.js
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

## 🛠️ Technology Stack

- **Frontend Framework**: Three.js
- **Build Tool**: Vite
- **Physics Engine**: Rapier3D
- **3D Assets**: GLTF/GLB models
- **Animation**: Custom tweening system

## 🚀 Getting Started

1. Clone the repository
    ```bash
    git clone https://github.com/YourUsername/threejs_site.git
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

## 🏗️ Project Structure

```
├── public/
│   ├── assets/         # 3D models and textures
│   ├── fonts/         # Custom fonts
│   ├── images/        # Image assets
│   └── pages/         # HTML templates
├── src/
│   ├── background/    # 3D environment components
│   ├── viewport/      # Camera and view management
│   ├── common/        # Shared utilities
│   └── main.js        # Application entry point
```

## 🎨 Features in Detail

### Physics-Based Interactions
- Real-time physics simulation for all 3D objects
- Customizable physical properties (mass, restitution, friction)
- Chain physics for menu systems

### Dynamic Asset Management
- Efficient 3D model loading and caching
- Automatic physics collider generation
- Instance management for multiple object copies

### Interactive UI Elements
- Animated text reveals
- Particle effects
- Physics-based menu systems
- Responsive overlay system

## 🤝 Contributing

This project is currently under active development. Feel free to open issues or submit pull requests.

## 📝 License

[MIT License](LICENSE)

## 📧 Contact

- Email: steven.meier77@gmail.com
- Discord: "Blooooork"

---

Built with 💻 by Steven Meier
