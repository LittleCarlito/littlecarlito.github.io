import * as THREE from 'three';

// Base UI Component class
export class UIComponent {
    constructor(parent, camera) {
        this.parent = parent;
        this.camera = camera;
        this.object = new THREE.Object3D();
        this.parent.add(this.object);
    }

    dispose() {
        this.parent.remove(this.object);
        this.object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    update() {
        // Override in child classes
    }
}

// Title Block Component
export class TitleBlock extends UIComponent {
    constructor(parent, camera, options = {}) {
        super(parent, camera);
        
        const {
            width = 10,
            height = 2.75,
            depth = 0.2,
            color = 0xffffff,
            wireframe = true,
            position = new THREE.Vector3(0, 9, 0)
        } = options;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshBasicMaterial({ 
            color,
            wireframe,
            transparent: true,
            opacity: wireframe ? 1 : 0.8
        });

        this.titleMesh = new THREE.Mesh(geometry, material);
        this.titleMesh.position.copy(position);
        this.object.add(this.titleMesh);
    }

    setTitle(text) {
        // Future enhancement: Add text rendering
        console.log('Title set to:', text);
    }

    resize(width) {
        this.titleMesh.geometry.dispose();
        this.titleMesh.geometry = new THREE.BoxGeometry(width, this.titleMesh.geometry.parameters.height, this.titleMesh.geometry.parameters.depth);
    }
}

// Link Container Component
export class LinkContainer extends UIComponent {
    constructor(parent, camera, options = {}) {
        super(parent, camera);
        
        const {
            radius = 0.44,
            spacing = 3.5,
            links = []
        } = options;

        this.links = new Map();
        
        links.forEach((link, index) => {
            const geometry = new THREE.CircleGeometry(radius);
            const material = new THREE.MeshBasicMaterial({
                map: link.texture,
                transparent: true,
                depthTest: false
            });

            const linkMesh = new THREE.Mesh(geometry, material);
            linkMesh.position.x = radius * (spacing * index);
            linkMesh.userData.url = link.url;
            
            this.links.set(link.id, linkMesh);
            this.object.add(linkMesh);
        });
    }

    setPosition(x, y, z) {
        this.object.position.set(x, y, z);
    }

    onClick(point) {
        // Implement raycasting for click detection
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(point, this.camera);
        
        const intersects = raycaster.intersectObjects(Array.from(this.links.values()));
        if (intersects.length > 0) {
            const url = intersects[0].object.userData.url;
            if (url) window.open(url, '_blank');
        }
    }
}

// Text Frame Component
export class TextFrame extends UIComponent {
    constructor(parent, camera, options = {}) {
        super(parent, camera);
        
        const {
            width = 10,
            height = 5,
            color = 0xffffff,
            opacity = 0.8
        } = options;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthTest: false
        });

        this.frameMesh = new THREE.Mesh(geometry, material);
        this.object.add(this.frameMesh);
    }

    setText(text) {
        // Future enhancement: Add HTML/CSS overlay for text
        console.log('Text set to:', text);
    }

    setSize(width, height) {
        this.frameMesh.geometry.dispose();
        this.frameMesh.geometry = new THREE.PlaneGeometry(width, height);
    }

    animate(targetPosition, duration = 1000) {
        const startPosition = this.object.position.clone();
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            
            this.object.position.lerpVectors(startPosition, targetPosition, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }
}

// Hide Button Component
export class HideButton extends UIComponent {
    constructor(parent, camera, options = {}) {
        super(parent, camera);
        
        const {
            width = 1,
            height = 1,
            color = 0xffffff,
            hoverColor = 0x00ff00
        } = options;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            depthTest: false
        });

        this.buttonMesh = new THREE.Mesh(geometry, material);
        this.object.add(this.buttonMesh);

        this.originalColor = color;
        this.hoverColor = hoverColor;
        this.isHidden = false;
    }

    onHover(isHovering) {
        this.buttonMesh.material.color.setHex(isHovering ? this.hoverColor : this.originalColor);
    }

    onClick(callback) {
        this.isHidden = !this.isHidden;
        if (callback) callback(this.isHidden);
    }

    setPosition(x, y, z) {
        this.object.position.set(x, y, z);
    }
} 