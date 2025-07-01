import { THREE } from "./index.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import CustomTypeManager from "./custom_type_manager.js";
import { BLORKPACK_FLAGS } from "./blorkpack_flags.js";

/**
 * Class responsible for managing asset loading, storage, and caching.
 * Handles GLB models, materials, and maintains references to both static and dynamic objects.
 */
export class AssetStorage {
	static instance = null;
	stored_info = new Map();
	cached_models = new Map();
	loader;
	#assetConfigs = null;

	constructor() {
		if (AssetStorage.instance) {
			return AssetStorage.instance;
		}
		this.stored_info = new Map();
		this.cached_models = new Map();
		this.loader = new GLTFLoader();
		this.#assetConfigs = CustomTypeManager.getConfigs();
		this.loaded_assets = new Map();
		this.dynamic_bodies = new Map();
		this.static_meshes = new Map();
		this.loading_promises = new Map();
		this.material_cache = new Map();
		this.emission_states = new Map();
		this.currently_activated_name = "";
		this.instance_counter = 0;
		AssetStorage.instance = this;
	}

	static get_instance() {
		if (!AssetStorage.instance) {
			AssetStorage.instance = new AssetStorage();
		}
		return AssetStorage.instance;
	}

	async load_asset_type(asset_type) {
		if (this.cached_models.has(asset_type)) {
			return this.cached_models.get(asset_type);
		}
		try {
			const asset_config = this.#assetConfigs[asset_type];
			if (!asset_config) {
				console.error(`No configuration found for asset type: ${asset_type}`);
				return null;
			}

			const gltf = await this.loader.loadAsync(asset_config.PATH);
			this.cached_models.set(asset_type, gltf);
			return gltf;
		} catch (error) {
			console.error(`Error loading asset type: ${asset_type}`, error);
			return null;
		}
	}

	add_object(incoming_mesh, incoming_body) {
		const instance_id = this.get_new_instance_id();
		if (incoming_body) {
			this.store_dynamic_body(instance_id, [incoming_mesh, incoming_body]);
			incoming_mesh.userData.physicsBody = incoming_body;
			incoming_mesh.userData.instanceId = instance_id;

			const position = incoming_body.translation();
			incoming_mesh.position.set(position.x, position.y, position.z);
			const rotation = incoming_body.rotation();
			incoming_mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
		} else {
			this.store_static_mesh(instance_id, incoming_mesh);
			incoming_mesh.userData.instanceId = instance_id;
		}
		return instance_id;
	}

	update() {
		this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
			if (body && mesh) {
				if (body.isSleeping() && !body.isKinematic()) {
					return;
				}

				const position = body.translation();
				mesh.position.set(position.x, position.y, position.z);
				const rotation = body.rotation();
				mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

				if (mesh.userData.isMoving && body.isSleeping()) {
					body.wakeUp();
				}
			}
		});
	}

	cleanup() {
		this.get_all_dynamic_bodies().forEach(([mesh, body]) => {
			if (mesh) {
				if (mesh.parent) {
					mesh.parent.remove(mesh);
				}
				if (mesh.geometry) {
					mesh.geometry.dispose();
				}
				if (mesh.material) {
					if (Array.isArray(mesh.material)) {
						mesh.material.forEach(material => {
							if (material.map) material.map.dispose();
							material.dispose();
						});
					} else {
						if (mesh.material.map) mesh.material.map.dispose();
						mesh.material.dispose();
					}
				}
			}
		});

		this.get_all_static_meshes().forEach(mesh => {
			if (mesh) {
				if (mesh.parent) {
					mesh.parent.remove(mesh);
				}
				if (mesh.geometry) {
					mesh.geometry.dispose();
				}
				if (mesh.material) {
					if (Array.isArray(mesh.material)) {
						mesh.material.forEach(material => {
							if (material.map) material.map.dispose();
							material.dispose();
						});
					} else {
						if (mesh.material.map) mesh.material.map.dispose();
						mesh.material.dispose();
					}
				}
			}
		});

		this.dynamic_bodies.clear();
		this.static_meshes.clear();
		this.emission_states.clear();
		this.material_cache.clear();
		this.instance_counter = 0;
		this.currently_activated_name = "";
	}

	get_new_instance_id() {
		return `instance_${this.instance_counter++}`;
	}

	store_loaded_asset(asset_type, gltf) {
		this.loaded_assets.set(asset_type, gltf);
	}

	get_loaded_asset(asset_type) {
		return this.loaded_assets.get(asset_type);
	}

	has_loaded_asset(asset_type) {
		return this.loaded_assets.has(asset_type);
	}

	set_loading_promise(asset_type, promise) {
		this.loading_promises.set(asset_type, promise);
	}

	get_loading_promise(asset_type) {
		return this.loading_promises.get(asset_type);
	}

	has_loading_promise(asset_type) {
		return this.loading_promises.has(asset_type);
	}

	delete_loading_promise(asset_type) {
		this.loading_promises.delete(asset_type);
	}

	store_dynamic_body(instance_id, body_pair) {
		this.dynamic_bodies.set(instance_id, body_pair);
	}

	get_dynamic_body(instance_id) {
		return this.dynamic_bodies.get(instance_id);
	}

	get_all_dynamic_bodies() {
		return Array.from(this.dynamic_bodies.values());
	}

	get_body_pair_by_mesh(mesh) {
		for (const [id, [object_mesh, body]] of this.dynamic_bodies.entries()) {
			if (object_mesh === mesh) {
				return [object_mesh, body];
			}

			if (object_mesh.children && object_mesh.children.includes(mesh)) {
				return [object_mesh, body];
			}

			let foundInHierarchy = false;
			object_mesh.traverse((child) => {
				if (child === mesh) {
					foundInHierarchy = true;
				}
			});
			if (foundInHierarchy) {
				return [object_mesh, body];
			}
		}

		const meshName = mesh.name;
		for (const [id, [object_mesh, body]] of this.dynamic_bodies.entries()) {
			if (object_mesh.name === meshName) {
				return [object_mesh, body];
			}
		}
		return null;
	}

	store_static_mesh(instance_id, mesh) {
		this.static_meshes.set(instance_id, mesh);
	}

	get_static_mesh(instance_id) {
		return this.static_meshes.get(instance_id);
	}

	get_all_static_meshes() {
		return Array.from(this.static_meshes.values());
	}

	store_material(key, material) {
		this.material_cache.set(key, material);
	}

	get_material(key, originalMaterial) {
		if (this.has_material(key)) {
			return this.material_cache.get(key);
		}
		if (originalMaterial) {
			const material = originalMaterial.clone();
			this.store_material(key, material);
			return material;
		}
		const material = new THREE.MeshStandardMaterial();
		this.store_material(key, material);
		return material;
	}

	has_material(key) {
		return this.material_cache.has(key);
	}

	set_emission_state(object_name, state) {
		this.emission_states.set(object_name, state);
	}

	get_emission_state(object_name) {
		return this.emission_states.get(object_name);
	}

	delete_emission_state(object_name) {
		this.emission_states.delete(object_name);
	}

	set_currently_activated_name(name) {
		this.currently_activated_name = name;
	}

	get_currently_activated_name() {
		return this.currently_activated_name;
	}

	contains_object(object_name) {
		return this.emission_states.has(object_name);
	}

	get_all_assets() {
		const dynamic = this.get_all_dynamic_bodies().map(([mesh, body]) => {
			return {
				mesh: mesh,
				body: body,
				type: mesh.userData?.type || 'unknown'
			};
		});

		const static_meshes = this.get_all_static_meshes().map(mesh => {
			return {
				mesh: mesh,
				body: null,
				type: mesh.userData?.type || 'unknown'
			};
		});

		return [...dynamic, ...static_meshes];
	}
}