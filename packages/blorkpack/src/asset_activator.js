import { THREE } from "./index.js";
import CustomTypeManager from "./custom_type_manager.js";
import { BLORKPACK_FLAGS } from "./blorkpack_flags.js";
import { AssetStorage } from "./asset_storage.js";

/**
 * Class responsible for handling asset activation and interaction.
 */
export class AssetActivator {
	static instance = null;
	name = "[AssetActivator]";
	activations = new Map();
    
	// Cache the CustomTypeManager types
	#assetTypes = null;

	constructor(camera, renderer) {
		if (AssetActivator.instance) {
			return AssetActivator.instance;
		}
		this.camera = camera;
		this.renderer = renderer;
		this.storage = AssetStorage.get_instance();
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.active_objects = new Set();
        
		// Cache the asset types
		this.#assetTypes = CustomTypeManager.getTypes();
        
		AssetActivator.instance = this;
	}

	/**
     * Gets or creates the singleton instance of AssetActivator.
     * @param {THREE.Camera} camera - The camera for raycasting.
     * @param {THREE.WebGLRenderer} renderer - The renderer.
     * @returns {AssetActivator} The singleton instance.
     */
	static get_instance(camera, renderer) {
		if (!AssetActivator.instance) {
			AssetActivator.instance = new AssetActivator(camera, renderer);
		} else {
			// Update camera and renderer if provided
			if (camera) AssetActivator.instance.camera = camera;
			if (renderer) AssetActivator.instance.renderer = renderer;
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
     * Activates an object in the scene, applying emission effects.
     * @param {string} object_name - The name of the object to activate.
     * @returns {boolean} True if activation was successful.
     */
	activate_object(object_name) {
		if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Activating: ${object_name}`);
        
		// Check if object exists
		if (!this.storage.contains_object(object_name)) {
			if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object not found: ${object_name}`);
			return false;
		}
        
		// Check if already activated
		if (this.storage.get_currently_activated_name() === object_name) {
			if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Object already activated: ${object_name}`);
			return true;
		}
        
		// Get the mesh from storage
		const mesh = this.storage.get_static_mesh(object_name);
		if (!mesh) {
			if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Mesh not found for: ${object_name}`);
			return false;
		}
        
		// Apply emission effect to the mesh
		mesh.traverse((child) => {
			if (child.isMesh && !child.name.startsWith('col_')) {
				if (child.material) {
					const materials = Array.isArray(child.material) ? child.material : [child.material];
                    
					materials.forEach((material) => {
						if (material.emissive) {
							// Store original emission color if not already stored
							if (!material._originalEmissive) {
								material._originalEmissive = material.emissive.clone();
								material._originalEmissiveIntensity = material.emissiveIntensity;
							}
                            
							// Set emission properties
							material.emissive.set(0xffffff);
							material.emissiveIntensity = 9;
						}
					});
				}
			}
		});
        
		// Store activation state
		this.storage.set_emission_state(object_name, true);
		this.storage.set_currently_activated_name(object_name);
		this.active_objects.add(object_name);
        
		return true;
	}

	/**
     * Deactivates an object, removing emission effects.
     * @param {string} object_name - The name of the object to deactivate.
     * @returns {boolean} True if deactivation was successful.
     */
	deactivate_object(object_name) {
		if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating: ${object_name}`);
        
		if (!this.storage.contains_object(object_name)) {
			return false;
		}
        
		// Get the mesh from storage
		const mesh = this.storage.get_static_mesh(object_name);
		if (!mesh) {
			return false;
		}
        
		// Remove emission effect
		mesh.traverse((child) => {
			if (child.isMesh && !child.name.startsWith('col_')) {
				if (child.material) {
					const materials = Array.isArray(child.material) ? child.material : [child.material];
                    
					materials.forEach((material) => {
						if (material.emissive && material._originalEmissive) {
							// Restore original emission properties
							material.emissive.copy(material._originalEmissive);
							material.emissiveIntensity = material._originalEmissiveIntensity || 0;
						}
					});
				}
			}
		});
        
		// Update state
		this.storage.set_emission_state(object_name, false);
		if (this.storage.get_currently_activated_name() === object_name) {
			this.storage.set_currently_activated_name("");
		}
		this.active_objects.delete(object_name);
        
		return true;
	}

	/**
     * Deactivates all currently active objects.
     * @returns {void}
     */
	deactivate_all_objects() {
		if (BLORKPACK_FLAGS.ACTIVATE_LOGS) console.log(`${this.name} Deactivating all objects`);
        
		// Create a copy of the active objects set to avoid modification during iteration
		const activeObjectsCopy = new Set(this.active_objects);
        
		// Deactivate each object
		activeObjectsCopy.forEach(object_name => {
			this.deactivate_object(object_name);
		});
	}

	/**
     * Handles mouse movement for interaction.
     * @param {MouseEvent} event - The mouse event.
     */
	onMouseMove(event) {
		// Calculate normalized device coordinates from the event
		const canvas = this.renderer.domElement;
		const rect = canvas.getBoundingClientRect();
		this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
	}

	/**
     * Performs a raycast to find intersected objects.
     * @param {THREE.Scene} scene - The scene to raycast against.
     * @returns {Array} Array of intersected objects.
     */
	raycast(scene) {
		this.raycaster.setFromCamera(this.mouse, this.camera);
		return this.raycaster.intersectObjects(scene.children, true);
	}

	/**
     * Cleans up resources and resets state.
     */
	cleanup() {
		this.deactivate_all_objects();
		this.active_objects.clear();
		AssetActivator.instance = null;
	}
} 