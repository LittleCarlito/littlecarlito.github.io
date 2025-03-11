import { THREE } from "../common";
import { FLAGS } from "../common/flags";
import { BLORKPACK_FLAGS } from "../packages/blorkpack/src/blorkpack_flags.js";

export const SPOTLIGHT_HEIGHT = 50;
export const SPOTLIGHT_DISTANCE = 0; // Light position on z-axis
export const SPOTLIGHT_OFFSET = 0;
export const SPOTLIGHT_COLOR = 0xffffff;
export const SPOTLIGHT_INTENSITY = 5;
export const SPOTLIGHT_ANGLE = Math.PI / 16; // Even narrower angle
export const SPOTLIGHT_PENUMBRA = 0.05; // Sharper edge
export const SPOTLIGHT_SHARPNESS = 0.5;

export class BackgroundLighting {
    static instance = null;

    static getInstance(parent) {
        if (!BackgroundLighting.instance) {
            BackgroundLighting.instance = new BackgroundLighting(parent);
        } else if (parent && BackgroundLighting.instance.parent !== parent) {
            // If parent is different, update the parent and re-add the lighting container
            BackgroundLighting.instance.parent.remove(BackgroundLighting.instance.lighting_container);
            BackgroundLighting.instance.parent = parent;
            BackgroundLighting.instance.parent.add(BackgroundLighting.instance.lighting_container);
        }
        return BackgroundLighting.instance;
    }

    constructor(incoming_parent) {
        // Prevent direct construction
        if (BackgroundLighting.instance) {
            return BackgroundLighting.instance;
        }
        
        this.parent = incoming_parent;
        this.lighting_container = new THREE.Object3D();
        this.parent.add(this.lighting_container);

        // Create shared materials for debug visualization with a single static color
        this.sharedDebugMaterials = {
            helper: new THREE.LineBasicMaterial({ color: 0x00FF00 }), // Green for visibility
            cone: new THREE.MeshBasicMaterial({ 
                color: 0x00FF00,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            })
        };
    }

    // Add debug colors array
    DEBUG_COLORS = [
        0xFF0000, // Red
        0x00FF00, // Green
        0x0000FF, // Blue
        0xFF00FF, // Magenta
        0xFFFF00, // Yellow
        0x00FFFF, // Cyan
        0xFF8000, // Orange
        0x8000FF  // Purple
    ];

    async create_spotlight(id, position, rotation, options, asset_data) {
        // Unpack parameters from the new signature to maintain compatibility
        const origin = position || new THREE.Vector3();
        const rotation_x = rotation?.x || 0;
        const rotation_y = rotation?.y || 0;
        
        // Extract values from options or asset_data
        const circle_radius = options?.circle_radius || asset_data?.additional_properties?.circle_radius || 0;
        const max_distance = options?.max_distance || asset_data?.additional_properties?.max_distance || 0;
        const color = options?.color || asset_data?.additional_properties?.color || SPOTLIGHT_COLOR;
        const intensity = options?.intensity || asset_data?.additional_properties?.intensity || SPOTLIGHT_INTENSITY;
        
        // Calculate angle from circle radius if provided, otherwise use constant
        const angle = circle_radius > 0 
            ? Math.atan2(circle_radius, SPOTLIGHT_HEIGHT)
            : SPOTLIGHT_ANGLE;
        
        const spotlight = new THREE.SpotLight(
            color,  // Use provided color or fall back to constant
            intensity,
            max_distance,
            angle,
            SPOTLIGHT_PENUMBRA,
            SPOTLIGHT_SHARPNESS
        );
        // Set the spotlight's position to the origin
        spotlight.position.copy(origin);
        spotlight.castShadow = true;
        // Shadow quality settings
        spotlight.shadow.blurSamples = 32;
        spotlight.shadow.radius = 4;
        spotlight.shadow.mapSize.width = 2048;
        spotlight.shadow.mapSize.height = 2048;
        // Camera settings
        spotlight.shadow.camera.near = 10;
        spotlight.shadow.camera.far = 100;
        spotlight.shadow.camera.fov = 30;
        // Shadow bias settings
        spotlight.shadow.bias = -0.002;
        spotlight.shadow.normalBias = 0.02;
        // Create target at a point in the direction specified by the rotation angles
        const targetDistance = 100; // Use a fixed distance for the target
        const target = new THREE.Object3D();
        // Calculate target position based on spherical coordinates
        const x = Math.sin(rotation_y) * Math.cos(rotation_x) * targetDistance;
        const y = Math.sin(rotation_x) * targetDistance;
        const z = Math.cos(rotation_y) * Math.cos(rotation_x) * targetDistance;
        target.position.set(
            origin.x + x,
            origin.y + y,
            origin.z + z
        );
        spotlight.target = target;
        
        // Add objects to scene in next frame to prevent stuttering
        await new Promise(resolve => setTimeout(resolve, 0));
        this.lighting_container.add(target);
        this.lighting_container.add(spotlight);

        // Create debug visualization if enabled
        if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
            const helpers = await this.create_spotlight_helper(spotlight);
            // Store helpers reference on the spotlight for cleanup
            spotlight.userData.debugHelpers = helpers;
        }

        return spotlight;
    }

    async create_spotlight_helper(spotlight) {
        // Create the standard helper with shared material
        const helper = new THREE.SpotLightHelper(spotlight);
        helper.material = this.sharedDebugMaterials.helper;
        
        // Store original update method
        const originalUpdate = helper.update;
        helper.update = () => {
            // Call original update
            originalUpdate.call(helper);
            // After update, ensure all children use our shared material
            helper.traverse(child => {
                if (child.material && child !== helper) {
                    child.material = this.sharedDebugMaterials.helper;
                }
            });
        };
        
        // Make helper and all its children non-interactive
        helper.raycast = () => null;
        helper.traverse(child => {
            child.raycast = () => null;
        });
        
        // Add helper in next frame
        await new Promise(resolve => setTimeout(resolve, 0));
        this.lighting_container.add(helper);

        // Create the cone visualization with shared material
        const spotlightToTarget = new THREE.Vector3().subVectors(
            spotlight.target.position,
            spotlight.position
        );
        const distance = spotlightToTarget.length();
        const height = distance;
        const radius = Math.tan(spotlight.angle) * height;
        const geometry = new THREE.ConeGeometry(radius, height, 32, 32, true);
        geometry.translate(0, -height/2, 0);
        
        const cone = new THREE.Mesh(geometry, this.sharedDebugMaterials.cone);
        cone.raycast = () => null;
        cone.traverse(child => {
            child.raycast = () => null;
        });
        cone.position.copy(spotlight.position);
        
        const direction = spotlightToTarget.normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
        cone.quaternion.copy(quaternion);
        
        await new Promise(resolve => setTimeout(resolve, 0));
        this.lighting_container.add(cone);
        
        return {
            helper,
            cone
        };
    }

    async despawn_spotlight(spotlight) {
        if (!spotlight) return;
        
        // Remove the spotlight's target and the spotlight itself
        await new Promise(resolve => setTimeout(resolve, 0));
        this.lighting_container.remove(spotlight.target);
        this.lighting_container.remove(spotlight);

        // Remove debug helpers if they exist
        if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG && spotlight.userData.debugHelpers) {
            const { helper, cone } = spotlight.userData.debugHelpers;
            if (helper) {
                // Remove the helper and its children from the scene
                this.lighting_container.remove(helper);
                if (helper.children) {
                    helper.children.forEach(child => {
                        if (child.geometry) {
                            child.geometry.dispose();
                        }
                    });
                }
                if (helper.geometry) {
                    helper.geometry.dispose();
                }
            }
            if (cone) {
                this.lighting_container.remove(cone);
                if (cone.geometry) {
                    cone.geometry.dispose();
                }
            }
        }

        // Clean up any orphaned helpers that might have been missed
        const helpers = this.lighting_container.children.filter(child => {
            // Only match helpers that belong to this specific spotlight
            if (child.isSpotLightHelper) {
                return child.light === spotlight;
            }
            if (child.isMesh && child.material && child.material.wireframe && 
                child.geometry && child.geometry.type === 'ConeGeometry') {
                // Check if this cone belongs to our spotlight by checking position
                return child.position.equals(spotlight.position);
            }
            return false;
        });
        
        for (const helper of helpers) {
            // Remove from scene
            this.lighting_container.remove(helper);
            
            // Dispose geometries
            if (helper.children) {
                helper.children.forEach(child => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                });
            }
            if (helper.geometry) {
                helper.geometry.dispose();
            }
        }
    }

    async despawn_spotlight_helpers(spotlight) {
        if (!spotlight || !spotlight.userData.debugHelpers) return;

        const { helper, cone } = spotlight.userData.debugHelpers;
        
        // Remove and dispose helper
        if (helper) {
            this.lighting_container.remove(helper);
            if (helper.children) {
                helper.children.forEach(child => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                });
            }
            if (helper.geometry) {
                helper.geometry.dispose();
            }
        }
        
        // Remove and dispose cone
        if (cone) {
            this.lighting_container.remove(cone);
            if (cone.geometry) {
                cone.geometry.dispose();
            }
        }

        // Clear the debug helpers reference
        spotlight.userData.debugHelpers = null;
    }

    // Update method for spotlight movement
    updateHelpers() {
        this.lighting_container.children.forEach(child => {
            if (child.isSpotLight && child.userData.debugHelpers) {
                const { helper, cone } = child.userData.debugHelpers;
                
                // Update the standard helper
                if (helper) {
                    helper.update();
                }
                
                // Update the cone
                if (cone) {
                    // Update cone position
                    cone.position.copy(child.position);
                    
                    // Update cone orientation
                    const spotlightToTarget = new THREE.Vector3().subVectors(
                        child.target.position,
                        child.position
                    );
                    const direction = spotlightToTarget.normalize();
                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
                    cone.quaternion.copy(quaternion);
                }
            }
        });
    }

    /**
     * Updates the debug visualization for all spotlights based on the current flag state
     */
    async updateDebugVisualizations() {
        // Find all spotlights in the lighting container
        const spotlights = this.lighting_container.children.filter(child => child.isSpotLight);
        
        if (BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG) {
            // Create debug helpers for spotlights that don't have them
            for (const spotlight of spotlights) {
                if (!spotlight.userData.debugHelpers) {
                    const helpers = await this.create_spotlight_helper(spotlight);
                    spotlight.userData.debugHelpers = helpers;
                } else {
                    // Show existing helpers
                    if (spotlight.userData.debugHelpers.helper) {
                        spotlight.userData.debugHelpers.helper.visible = true;
                    }
                    if (spotlight.userData.debugHelpers.cone) {
                        spotlight.userData.debugHelpers.cone.visible = true;
                    }
                }
            }
        } else {
            // Hide all debug helpers
            for (const spotlight of spotlights) {
                if (spotlight.userData.debugHelpers) {
                    if (spotlight.userData.debugHelpers.helper) {
                        spotlight.userData.debugHelpers.helper.visible = false;
                    }
                    if (spotlight.userData.debugHelpers.cone) {
                        spotlight.userData.debugHelpers.cone.visible = false;
                    }
                }
            }
        }
    }
}