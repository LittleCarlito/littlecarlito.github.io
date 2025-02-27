# @blooooork/three-ui

A professional 3D user interface component library for Three.js applications. Build beautiful, interactive 3D interfaces with ease using these high-performance, reusable components.

## Features

### 🎯 Title Block
Stylish 3D title component with wireframe effects:
```javascript
import { TitleBlock } from '@blooooork/three-ui';

const title = new TitleBlock(scene, camera, {
    width: 10,
    height: 2.75,
    color: 0xffffff,
    wireframe: true
});
```

### 🔗 Link Container
Interactive 3D link container with click detection:
```javascript
import { LinkContainer } from '@blooooork/three-ui';

const links = new LinkContainer(scene, camera, {
    links: [
        { id: 'github', texture: githubTexture, url: 'https://github.com' },
        { id: 'twitter', texture: twitterTexture, url: 'https://twitter.com' }
    ]
});

// Handle clicks
renderer.domElement.addEventListener('click', (event) => {
    const point = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
    };
    links.onClick(point);
});
```

### 📝 Text Frame
Animated text frame with smooth transitions:
```javascript
import { TextFrame } from '@blooooork/three-ui';

const frame = new TextFrame(scene, camera, {
    width: 10,
    height: 5,
    opacity: 0.8
});

// Animate to new position
frame.animate(new THREE.Vector3(5, 0, 0), 1000);
```

### 🔲 Hide Button
Interactive button with hover effects:
```javascript
import { HideButton } from '@blooooork/three-ui';

const button = new HideButton(scene, camera, {
    width: 1,
    height: 1,
    color: 0xffffff,
    hoverColor: 0x00ff00
});

button.onClick((isHidden) => {
    console.log('Button state:', isHidden ? 'hidden' : 'visible');
});
```

## Installation

```bash
npm install @blooooork/three-ui
```

## Requirements
- three.js ^0.160.0

## License
MIT 