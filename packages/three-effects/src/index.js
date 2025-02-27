import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import * as THREE from 'three';

// Bloom Effect System
export class BloomEffectSystem {
    constructor(renderer, scene, camera) {
        this.composer = new EffectComposer(renderer);
        
        // Setup passes
        const renderPass = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,  // Strength
            0.4,  // Radius
            0.85  // Threshold
        );
        const outputPass = new OutputPass();

        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
        this.composer.addPass(outputPass);
    }

    render() {
        this.composer.render();
    }

    resize(width, height) {
        this.composer.setSize(width, height);
    }
}

// Particle System
export class ParticleSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.particles = [];
    }

    createConfettiBurst(position, count = 50, colors = [0xff0000, 0x00ff00, 0x0000ff]) {
        const particleSize = 0.1;
        const burstRadius = 2;

        for (let i = 0; i < count; i++) {
            const geometry = new THREE.PlaneGeometry(particleSize, particleSize);
            const material = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                side: THREE.DoubleSide,
                transparent: true
            });

            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);

            // Random burst direction
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 0.1 + Math.random() * 0.2;

            particle.velocity = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.cos(phi) * speed + 0.15, // Add upward bias
                Math.sin(phi) * Math.sin(theta) * speed
            );

            particle.rotationSpeed = (Math.random() - 0.5) * 0.2;
            particle.lookAt(this.camera.position);

            this.scene.add(particle);
            this.particles.push(particle);

            // Fade out and remove
            setTimeout(() => {
                const fadeOut = setInterval(() => {
                    particle.material.opacity -= 0.02;
                    if (particle.material.opacity <= 0) {
                        clearInterval(fadeOut);
                        this.scene.remove(particle);
                        particle.geometry.dispose();
                        particle.material.dispose();
                        const index = this.particles.indexOf(particle);
                        if (index > -1) {
                            this.particles.splice(index, 1);
                        }
                    }
                }, 50);
            }, 1000);
        }
    }

    update() {
        for (const particle of this.particles) {
            particle.position.add(particle.velocity);
            particle.rotation.z += particle.rotationSpeed;
            particle.velocity.y -= 0.001; // Gravity
        }
    }
}

// Emission Material System
export class EmissionMaterialSystem {
    constructor() {
        this.materialCache = new Map();
    }

    createEmissiveMaterial(color, options = {}) {
        const key = `${color.getHex()}-${JSON.stringify(options)}`;
        
        if (!this.materialCache.has(key)) {
            const material = new THREE.MeshStandardMaterial({ 
                color: color,
                emissive: color,
                emissiveIntensity: options.emissiveIntensity || 2,
                roughness: options.roughness || 0.5,
                metalness: options.metalness || 0.0,
                transparent: options.transparent || false,
                opacity: options.opacity || 1.0,
                side: options.side || THREE.FrontSide
            });
            this.materialCache.set(key, material);
        }
        
        return this.materialCache.get(key).clone();
    }

    dispose() {
        this.materialCache.forEach(material => {
            material.dispose();
        });
        this.materialCache.clear();
    }
} 