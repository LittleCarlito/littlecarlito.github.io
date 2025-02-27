import * as THREE from 'three';

// Advanced Lighting System
export class LightingSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.container = new THREE.Object3D();
        this.scene.add(this.container);
        
        this.options = {
            debug: false,
            shadowMapSize: 2048,
            ...options
        };

        // Shared materials for debug visualization
        this.debugMaterials = {
            helper: new THREE.LineBasicMaterial({ color: 0x00ff00 }),
            cone: new THREE.MeshBasicMaterial({ 
                color: 0x00ff00,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            })
        };

        // Track all lights for easy management
        this.lights = new Map();
    }

    createSpotlight(options = {}) {
        const {
            position = new THREE.Vector3(0, 50, 0),
            target = new THREE.Vector3(0, 0, 0),
            color = 0xffffff,
            intensity = 1,
            angle = Math.PI / 6,
            penumbra = 0.1,
            distance = 0,
            castShadow = true,
            debug = this.options.debug
        } = options;

        // Create spotlight
        const spotlight = new THREE.SpotLight(color, intensity);
        spotlight.position.copy(position);
        spotlight.angle = angle;
        spotlight.penumbra = penumbra;
        spotlight.distance = distance;

        // Shadow setup
        if (castShadow) {
            spotlight.castShadow = true;
            spotlight.shadow.mapSize.width = this.options.shadowMapSize;
            spotlight.shadow.mapSize.height = this.options.shadowMapSize;
            spotlight.shadow.camera.near = 0.5;
            spotlight.shadow.camera.far = distance || 500;
            spotlight.shadow.bias = -0.001;
            spotlight.shadow.radius = 2;
        }

        // Target setup
        const targetObject = new THREE.Object3D();
        targetObject.position.copy(target);
        this.container.add(targetObject);
        spotlight.target = targetObject;

        // Add to scene
        this.container.add(spotlight);
        
        // Create debug helpers if enabled
        if (debug) {
            this.createDebugHelpers(spotlight);
        }

        // Store reference
        const id = THREE.MathUtils.generateUUID();
        this.lights.set(id, { light: spotlight, debug: debug });

        return {
            id,
            light: spotlight,
            setPosition: (pos) => {
                spotlight.position.copy(pos);
                this.updateDebugHelpers(id);
            },
            setTarget: (pos) => {
                targetObject.position.copy(pos);
                this.updateDebugHelpers(id);
            },
            setIntensity: (value) => {
                spotlight.intensity = value;
            },
            setColor: (color) => {
                spotlight.color.set(color);
            },
            setAngle: (angle) => {
                spotlight.angle = angle;
                this.updateDebugHelpers(id);
            }
        };
    }

    createDebugHelpers(spotlight) {
        // Create standard helper
        const helper = new THREE.SpotLightHelper(spotlight);
        helper.material = this.debugMaterials.helper;
        
        // Create cone visualization
        const distance = spotlight.distance || 
            spotlight.position.distanceTo(spotlight.target.position);
        const radius = Math.tan(spotlight.angle) * distance;
        const geometry = new THREE.ConeGeometry(radius, distance, 32, 32, true);
        geometry.translate(0, -distance/2, 0);
        
        const cone = new THREE.Mesh(geometry, this.debugMaterials.cone);
        cone.position.copy(spotlight.position);
        
        // Make helpers non-interactive
        helper.raycast = () => null;
        cone.raycast = () => null;
        
        // Store helpers with the light
        spotlight.userData.debugHelpers = { helper, cone };
        
        // Add to scene
        this.container.add(helper);
        this.container.add(cone);
        
        // Update cone orientation
        this.updateDebugHelpers(spotlight);
    }

    updateDebugHelpers(id) {
        const lightData = this.lights.get(id);
        if (!lightData || !lightData.debug) return;

        const spotlight = lightData.light;
        const { helper, cone } = spotlight.userData.debugHelpers;

        // Update standard helper
        helper.update();

        // Update cone position and orientation
        cone.position.copy(spotlight.position);
        const direction = new THREE.Vector3()
            .subVectors(spotlight.target.position, spotlight.position)
            .normalize();
        const quaternion = new THREE.Quaternion()
            .setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
        cone.quaternion.copy(quaternion);

        // Update cone geometry if angle changed
        const distance = spotlight.distance || 
            spotlight.position.distanceTo(spotlight.target.position);
        const radius = Math.tan(spotlight.angle) * distance;
        cone.geometry.dispose();
        cone.geometry = new THREE.ConeGeometry(radius, distance, 32, 32, true);
        cone.geometry.translate(0, -distance/2, 0);
    }

    removeLight(id) {
        const lightData = this.lights.get(id);
        if (!lightData) return;

        const { light } = lightData;

        // Remove debug helpers if they exist
        if (light.userData.debugHelpers) {
            const { helper, cone } = light.userData.debugHelpers;
            this.container.remove(helper);
            this.container.remove(cone);
            helper.geometry.dispose();
            cone.geometry.dispose();
        }

        // Remove light and target
        this.container.remove(light.target);
        this.container.remove(light);
        
        // Clear from tracking
        this.lights.delete(id);
    }

    setDebug(enabled) {
        this.options.debug = enabled;
        
        this.lights.forEach((lightData, id) => {
            const { light } = lightData;
            
            if (enabled && !light.userData.debugHelpers) {
                this.createDebugHelpers(light);
                lightData.debug = true;
            } else if (!enabled && light.userData.debugHelpers) {
                const { helper, cone } = light.userData.debugHelpers;
                this.container.remove(helper);
                this.container.remove(cone);
                helper.geometry.dispose();
                cone.geometry.dispose();
                light.userData.debugHelpers = null;
                lightData.debug = false;
            }
        });
    }

    dispose() {
        // Remove and dispose all lights
        this.lights.forEach((lightData, id) => {
            this.removeLight(id);
        });

        // Dispose debug materials
        Object.values(this.debugMaterials).forEach(material => {
            material.dispose();
        });

        // Remove container
        this.scene.remove(this.container);
    }
} 