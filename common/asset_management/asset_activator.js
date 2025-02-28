import { THREE, FLAGS, Easing, Tween } from "..";
import { AssetStorage } from "./asset_storage";
import { CATEGORIES } from "../../viewport/overlay/overlay_common";

/**
 * Class responsible for managing the activation and deactivation of 3D objects in the scene.
 * Handles emission effects, material management, and state tracking for interactive objects.
 */
export class AssetActivator {
    static instance = null;
    name = "[AssetActivator]";

    constructor() {
        if (AssetActivator.instance) {
            return AssetActivator.instance;
        }
        this.storage = AssetStorage.get_instance();
        AssetActivator.instance = this;
    }

    /**
     * Gets or creates the singleton instance of AssetActivator.
     * @returns {AssetActivator} The singleton instance.
     */
    static get_instance() {
        if (!AssetActivator.instance) {
            AssetActivator.instance = new AssetActivator();
        }
        return AssetActivator.instance;
    }

    /**
     * Checks if a mesh has active emission properties.
     * @param {THREE.Mesh|THREE.Object3D} mesh - The mesh to check for emission.
     * @returns {boolean} True if the mesh has active emission properties.
     */
    is_mesh_emissive(mesh) {
        if (!mesh) return false;
        let has_emissive = false;
        const check_material = (material) => {
            return material && 
                   material.emissive && 
                   material.emissiveIntensity > 0 &&
                   material.emissiveIntensity === 9; // Our target intensity
        };
        if (mesh.isGroup || mesh.isObject3D) {
            mesh.traverse((child) => {
                if (child.isMesh && !child.name.startsWith('col_')) {
                    if (check_material(child.material)) {
                        has_emissive = true;
                    }
                }
            });
        } else if (mesh.isMesh) {
            has_emissive = check_material(mesh.material);
        }
        return has_emissive;
    }

    /**
     * Activates an object by applying emission effects and updating its state.
     * @param {string} object_name - The name of the object to activate.
     */
    activate_object(object_name) {        
        // First check if any object with this category is already emissive
        const requested_category = object_name.split("_")[1];
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            const mesh_category = mesh.name.split("_")[1];
            if (mesh_category === requested_category && this.is_mesh_emissive(mesh)) {
                // Object is already emissive, just update the state if needed
                this.storage.set_currently_activated_name(object_name);
                this.storage.set_emission_state(object_name, 'active');
                return;
            }
        }
        // Deactivate previously activated object if it's different
        const current_activated = this.storage.get_currently_activated_name();
        if (current_activated !== object_name) {
            if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating previous: ${current_activated}`);
            this.deactivate_object(current_activated);
        }
        this.storage.set_currently_activated_name(object_name);
        if (FLAGS.ACTIVATE_LOGS) {
            console.log(`${this.name} Looking for category: ${requested_category}`);
            console.log(`${this.name} Available meshes:`, this.storage.get_all_dynamic_bodies().map(([mesh, _]) => mesh.name));
        }
        let found = false;
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            const mesh_category = mesh.name.split("_")[1];
            if (mesh_category === requested_category) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Found matching mesh by category: ${mesh_category}`);
                const category = Object.values(CATEGORIES).find(cat => 
                    typeof cat !== 'function' && cat.value === requested_category
                );
                if (category) {
                    if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Applying emission material with color: ${category.color}`);
                    // Set the emission state to 'applying'
                    this.storage.set_emission_state(object_name, 'applying');
                    // Create a single emission material for all meshes
                    let categoryColor;
                    if (category.color instanceof THREE.Color) {
                        categoryColor = category.color;
                    } else if (typeof category.color === 'number') {
                        categoryColor = new THREE.Color(category.color);
                    } else if (typeof category.color === 'string') {
                        categoryColor = new THREE.Color(category.color);
                    } else {
                        console.warn('Invalid category color:', category.color);
                        categoryColor = new THREE.Color(0xffffff);
                    }
                    // Create a single emission material for this category
                    const emissionKey = `emission_${categoryColor.getHex()}`;
                    const emissionMaterial = this.storage.get_material(emissionKey, {
                        map: null,
                        color: categoryColor,
                        transparent: false,
                        opacity: 1,
                        side: THREE.FrontSide
                    });
                    // Set emissive properties on the shared material
                    emissionMaterial.emissive = categoryColor;
                    emissionMaterial.emissiveIntensity = 9;
                    let meshesProcessed = 0;
                    let totalMeshes = 0;
                    // Count total meshes first
                    if (mesh.isGroup || mesh.isObject3D) {
                        mesh.traverse((child) => {
                            if (child.isMesh && !child.name.startsWith('col_')) totalMeshes++;
                        });
                    } else if (mesh.isMesh) {
                        totalMeshes = 1;
                    }
                    // For GLB models, we need to traverse all meshes
                    if (mesh.isGroup || mesh.isObject3D) {
                        mesh.traverse((child) => {
                            if (child.isMesh && !child.name.startsWith('col_')) {
                                // Store the original material for deactivation
                                if (!child.userData.originalMaterial) {
                                    child.userData.originalMaterial = child.material;
                                    if (FLAGS.ACTIVATE_LOGS) console.log("Stored original material for:", object_name);
                                }
                                // Apply shared emission material
                                if (child.material) child.material.dispose();
                                child.material = emissionMaterial;
                                if (FLAGS.ACTIVATE_LOGS) console.log("Applied shared emission material to:", object_name);
                                meshesProcessed++;
                                
                                // Check if all meshes are processed and verify emission
                                if (meshesProcessed === totalMeshes) {
                                    if (this.is_mesh_emissive(mesh)) {
                                        this.storage.set_emission_state(object_name, 'active');
                                        if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} is now fully activated and verified`);
                                    } else {
                                        if (FLAGS.ACTIVATE_LOGS) console.warn(`${this.name} Failed to apply emission to ${object_name}`);
                                        this.storage.delete_emission_state(object_name);
                                    }
                                }
                            }
                        });
                    } else if (mesh.isMesh) {
                        // For primitive objects like cubes
                        if (!mesh.userData.originalMaterial) {
                            mesh.userData.originalMaterial = mesh.material;
                            if (FLAGS.ACTIVATE_LOGS) console.log("Stored original material for cube:", object_name);
                        }
                        if (mesh.material) mesh.material.dispose();
                        mesh.material = emissionMaterial;
                        if (FLAGS.ACTIVATE_LOGS) console.log("Applied shared emission material to cube:", object_name);
                        // Verify emission for primitive mesh
                        if (this.is_mesh_emissive(mesh)) {
                            this.storage.set_emission_state(object_name, 'active');
                            if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} is now fully activated and verified`);
                        } else {
                            if (FLAGS.ACTIVATE_LOGS) console.warn(`${this.name} Failed to apply emission to ${object_name}`);
                            this.storage.delete_emission_state(object_name);
                        }
                    }
                }
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`${this.name} No mesh found for category: ${requested_category}`);
            this.storage.delete_emission_state(object_name);
        }
    }

    /**
     * Deactivates an object by removing emission effects and restoring original materials.
     * @param {string} object_name - The name of the object to deactivate.
     */
    deactivate_object(object_name) {
        if (!object_name) return;
        const requested_category = object_name.split("_")[1];
        let found = false;
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            const mesh_category = mesh.name.split("_")[1];
            if (mesh_category === requested_category) {
                found = true;
                if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Found mesh to deactivate: ${mesh.name}`);
                // Set deactivation state
                this.storage.set_emission_state(object_name, 'deactivating');
                let meshesProcessed = 0;
                let totalMeshes = 0;
                // Count total meshes first
                if (mesh.isGroup || mesh.isObject3D) {
                    mesh.traverse((child) => {
                        if (child.isMesh && !child.name.startsWith('col_')) totalMeshes++;
                    });
                } else if (mesh.isMesh) {
                    totalMeshes = 1;
                }
                const deactivate_mesh = (targetMesh) => {
                    // Only proceed if we have an original material to restore to
                    if (targetMesh.userData.originalMaterial) {
                        // Create a new tween for the emission fade out
                        if (targetMesh.material && targetMesh.material.emissiveIntensity > 0) {
                            // Clone the current material to avoid affecting other instances
                            const tweenMaterial = targetMesh.material.clone();
                            targetMesh.material = tweenMaterial;

                            new Tween(tweenMaterial)
                                .to({ emissiveIntensity: 0 }, 500) // 500ms duration for smooth transition
                                .easing(Easing.Quadratic.Out)
                                .onComplete(() => {
                                    // Cleanup the tween material
                                    if (tweenMaterial) tweenMaterial.dispose();
                                    
                                    // Restore the original material
                                    const restoredMaterial = targetMesh.userData.originalMaterial.clone();
                                    targetMesh.material = restoredMaterial;
                                    
                                    meshesProcessed++;
                                    if (meshesProcessed === totalMeshes) {
                                        this.storage.delete_emission_state(object_name);
                                        if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object ${object_name} is now fully deactivated`);
                                    }
                                    
                                    if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Restored original material for: ${targetMesh.name}`);
                                })
                                .start();
                        }
                    } else if (FLAGS.ACTIVATE_LOGS) {
                        console.warn(`${this.name} No original material found for: ${targetMesh.name}`);
                        meshesProcessed++;
                        if (meshesProcessed === totalMeshes) {
                            this.storage.delete_emission_state(object_name);
                        }
                    }
                };
                // Handle both GLB models and primitive objects
                if (mesh.isGroup || mesh.isObject3D) {
                    mesh.traverse((child) => {
                        if (child.isMesh && !child.name.startsWith('col_')) {
                            deactivate_mesh(child);
                        }
                    });
                } else if (mesh.isMesh) {
                    deactivate_mesh(mesh);
                }
                break;
            }
        }
        if (!found && FLAGS.ACTIVATE_LOGS) {
            console.warn(`${this.name} No active mesh found for category: ${requested_category}`);
            this.storage.delete_emission_state(object_name);
        }
    }

    /**
     * Deactivates all objects with optional type filtering.
     * @param {string|null} type_prefix - Optional prefix to filter which objects to deactivate.
     */
    deactivate_all_objects(type_prefix = null) {
        // Only proceed if we have an active object
        if (!this.storage.get_currently_activated_name()) return;
        // Check if any objects are actually emissive before proceeding
        let has_emissive_objects = false;
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            if (type_prefix && !mesh.name.startsWith(type_prefix)) continue;
            const checkEmissive = (targetMesh) => {
                if (targetMesh.material && 
                    targetMesh.material.emissive && 
                    targetMesh.material.emissiveIntensity > 0) {
                    has_emissive_objects = true;
                    return true;
                }
                return false;
            };
            if (mesh.isGroup || mesh.isObject3D) {
                mesh.traverse((child) => {
                    if (child.isMesh && !child.name.startsWith('col_')) {
                        if (checkEmissive(child)) return;
                    }
                });
                if (has_emissive_objects) break;
            } else if (mesh.isMesh) {
                if (checkEmissive(mesh)) break;
            }
        }
        // If no emissive objects found, just reset the currently_activated_name and return
        if (!has_emissive_objects) {
            this.storage.set_currently_activated_name("");
            return;
        }
        if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating all objects${type_prefix ? ` with prefix: ${type_prefix}` : ''}`);
        let deactivation_count = 0;
        const deactivate_mesh = (targetMesh) => {
            if (targetMesh.material && 
                targetMesh.material.emissive && 
                targetMesh.material.emissiveIntensity > 0) {
                if (FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating emissive mesh: ${targetMesh.name}`);
                // Clone the current material to avoid affecting other instances
                const tweenMaterial = targetMesh.material.clone();
                targetMesh.material = tweenMaterial;
                new Tween(tweenMaterial)
                    .to({ emissiveIntensity: 0 }, 500)
                    .easing(Easing.Quadratic.Out)
                    .onComplete(() => {
                        // Cleanup the tween material
                        if (tweenMaterial) tweenMaterial.dispose();
                        
                        // Restore the original material if it exists
                        if (targetMesh.userData.originalMaterial) {
                            const restoredMaterial = targetMesh.userData.originalMaterial.clone();
                            targetMesh.material = restoredMaterial;
                        }
                    })
                    .start();
                deactivation_count++;
            }
        };
        for (const [mesh, _body] of this.storage.get_all_dynamic_bodies()) {
            if (type_prefix && !mesh.name.startsWith(type_prefix)) {
                continue;
            }
            // Handle both GLB models and primitive objects
            if (mesh.isGroup || mesh.isObject3D) {
                mesh.traverse((child) => {
                    if (child.isMesh && !child.name.startsWith('col_')) {
                        deactivate_mesh(child);
                    }
                });
            } else if (mesh.isMesh) {
                deactivate_mesh(mesh);
            }
        }
        if (deactivation_count > 0 && FLAGS.ACTIVATE_LOGS) {
            console.log(`${this.name} Deactivated ${deactivation_count} objects`);
        }
        // Reset the currently activated name since we've deactivated everything
        this.storage.set_currently_activated_name("");
    }
}
