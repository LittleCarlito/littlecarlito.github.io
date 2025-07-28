import { FLAGS, THREE } from "../common";
import { AssetHandler }  from '@littlecarlito/blorkpack';
import { BLORKPACK_FLAGS } from "@littlecarlito/blorkpack";
import { SystemAssetType } from "@littlecarlito/blorkpack";

// Initial camera rotation constants (in degrees)
const INITIAL_PHI_DEGREES = 18;     // Vertical rotation (polar angle)
const INITIAL_THETA_DEGREES = 30;   // Horizontal rotation (azimuthal angle)

const ANGLES = {
	toRadians: degrees => degrees * (Math.PI / 180),
	toDegrees: radians => radians * (180 / Math.PI)
};

const PAN_SENSITIVITY = 0.1;

export class CameraManager {
	constructor(incoming_parent, incoming_camera, distance = 15) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.spawner = AssetHandler.get_instance(this.parent);
		this.distance = distance;
		this.target = new THREE.Vector3(0, 0, 0);
		
		const camera_config = window.manifest_manager.get_camera_config();
		const controls_config = camera_config.controls;
		
		// Initialize angles to 0 first
		this.phi = 0;
		this.theta = 0;
		
		this.min_phi = controls_config.min_polar_angle;
		this.max_phi = controls_config.max_polar_angle;
		this.min_dist = controls_config.min_distance;
		this.max_dist = controls_config.max_distance;
		
		if (camera_config.target) {
			this.target.set(
				camera_config.target.x,
				camera_config.target.y,
				camera_config.target.z
			);
		}
		
		this.on_update_callbacks = new Set();
		this.overlay_container = null;
		
		// Apply initial rotation using the proper rotation method
		if (INITIAL_PHI_DEGREES !== 0 || INITIAL_THETA_DEGREES !== 0) {
			this.phi = INITIAL_PHI_DEGREES;
			this.theta = INITIAL_THETA_DEGREES;
		}
		
		// Initial camera update with rotation applied - but overlay_container is null at this point
		this.update_camera();
		
		if (camera_config.shoulder_lights && camera_config.shoulder_lights.enabled) {
			this.create_shoulder_lights(camera_config.shoulder_lights);
		}
	}

	async create_shoulder_lights(lights_config) {
		if (lights_config.left) {
			if (this.left_shoulder_light) {
				await this.spawner.despawn_debug_meshes(this.left_shoulder_light.mesh);
			}
			const leftPos = new THREE.Vector3(
				lights_config.left.position.x,
				lights_config.left.position.y,
				lights_config.left.position.z
			);
			leftPos.applyQuaternion(this.camera.quaternion);
			leftPos.add(this.camera.position);
			
			const forward = new THREE.Vector3(0, 0, -100);
			forward.applyQuaternion(this.camera.quaternion);
			const target = new THREE.Vector3().copy(leftPos).add(forward);
			
			const direction = new THREE.Vector3().subVectors(target, leftPos);
			const rotation_y = Math.atan2(direction.x, direction.z);
			const rotation_x = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
			
			this.left_shoulder_light = await this.spawner.spawn_asset(
				SystemAssetType.SPOTLIGHT,
				leftPos,
				new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation_x, rotation_y, 0)),
				{
					id: "left_shoulder_light",
					circle_radius: lights_config.left.position.y * Math.tan(ANGLES.toRadians(lights_config.left.angle)),
					max_distance: lights_config.left.max_distance,
					intensity: lights_config.left.intensity,
					asset_data: {}
				}
			);
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log("Left shoulder light created:", this.left_shoulder_light ? "success" : "failed");
			}
			this.left_shoulder_light.mesh.target.position.copy(target);
		}
		
		if (lights_config.right) {
			if (this.right_shoulder_light) {
				await this.spawner.despawn_debug_meshes(this.right_shoulder_light.mesh);
			}
			const rightPos = new THREE.Vector3(
				lights_config.right.position.x,
				lights_config.right.position.y,
				lights_config.right.position.z
			);
			rightPos.applyQuaternion(this.camera.quaternion);
			rightPos.add(this.camera.position);
			
			const forward = new THREE.Vector3(0, 0, -100);
			forward.applyQuaternion(this.camera.quaternion);
			const target = new THREE.Vector3().copy(rightPos).add(forward);
			
			const direction = new THREE.Vector3().subVectors(target, rightPos);
			const rotation_y = Math.atan2(direction.x, direction.z);
			const rotation_x = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
			
			this.right_shoulder_light = await this.spawner.spawn_asset(
				SystemAssetType.SPOTLIGHT,
				rightPos,
				new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation_x, rotation_y, 0)),
				{
					id: "right_shoulder_light",
					circle_radius: lights_config.right.position.y * Math.tan(ANGLES.toRadians(lights_config.right.angle)),
					max_distance: lights_config.right.max_distance,
					intensity: lights_config.right.intensity,
					asset_data: {}
				}
			);
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log("Right shoulder light created:", this.right_shoulder_light ? "success" : "failed");
			}
			this.right_shoulder_light.mesh.target.position.copy(target);
		}
	}

	add_update_callback(callback) {
		this.on_update_callbacks.add(callback);
	}

	remove_update_callback(callback) {
		this.on_update_callbacks.delete(callback);
	}

	rotate(delta_x, delta_y) {
		this.theta -= delta_x;
		this.phi = Math.max(this.min_phi, Math.min(this.max_phi, this.phi + delta_y));
		this.update_camera();
	}

	pan(delta_x, delta_y) {
		const camera_right = new THREE.Vector3();
		const camera_up = new THREE.Vector3();
		
		camera_right.setFromMatrixColumn(this.camera.matrix, 0);
		camera_up.setFromMatrixColumn(this.camera.matrix, 1);
		
		const pan_offset = new THREE.Vector3();
		pan_offset.addScaledVector(camera_right, -delta_x * PAN_SENSITIVITY);
		pan_offset.addScaledVector(camera_up, delta_y * PAN_SENSITIVITY);
		
		this.target.add(pan_offset);
		this.update_camera();
	}

	zoom(delta) {
		this.distance = Math.max(
			this.min_dist,
			Math.min(this.max_dist, this.distance + delta)
		);
		this.update_camera();
	}

	set_overlay_container(container) {
		this.overlay_container = container;
		// Apply initial rotation after overlay container is set
		if (INITIAL_PHI_DEGREES !== 0 || INITIAL_THETA_DEGREES !== 0) {
			this.update_camera();
		}
	}

	async cleanupDebugMeshes() {
		if (this.left_shoulder_light) {
			await this.spawner.despawn_debug_meshes(this.left_shoulder_light.mesh);
		}
		if (this.right_shoulder_light) {
			await this.spawner.despawn_debug_meshes(this.right_shoulder_light.mesh);
		}
	}

	update_camera() {
		const phi_rad = THREE.MathUtils.degToRad(this.phi);
		const theta_rad = THREE.MathUtils.degToRad(this.theta);
		
		this.camera.position.x = this.distance * Math.cos(phi_rad) * Math.sin(theta_rad);
		this.camera.position.y = this.distance * Math.sin(phi_rad);
		this.camera.position.z = this.distance * Math.cos(phi_rad) * Math.cos(theta_rad);
		
		this.camera.position.add(this.target);
		
		if(FLAGS.PHYSICS_LOGS) {
			console.log('Camera Update:');
			console.log(`Position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
			console.log(`Target: (${this.target.x.toFixed(2)}, ${this.target.y.toFixed(2)}, ${this.target.z.toFixed(2)})`);
			console.log(`Angles: phi=${this.phi.toFixed(2)}°, theta=${this.theta.toFixed(2)}°`);
		}
		
		this.camera.lookAt(this.target);
		this.camera.updateMatrix();
		
		const camera_config = window.manifest_manager.get_camera_config();
		const lights_config = camera_config.shoulder_lights;
		
		if (this.left_shoulder_light && lights_config && lights_config.left) {
			const leftPos = new THREE.Vector3(
				lights_config.left.position.x,
				lights_config.left.position.y,
				lights_config.left.position.z
			);
			leftPos.applyQuaternion(this.camera.quaternion);
			leftPos.add(this.camera.position);
			
			if (!this.left_shoulder_light.mesh) {
				console.warn("Left shoulder light exists but has no mesh property!");
			} else {
				this.left_shoulder_light.mesh.position.copy(leftPos);
				const forward = new THREE.Vector3(0, 0, -100);
				forward.applyQuaternion(this.camera.quaternion);
				this.left_shoulder_light.mesh.target.position.copy(leftPos).add(forward);
				this.left_shoulder_light.mesh.updateMatrixWorld(true);
				this.left_shoulder_light.mesh.target.updateMatrixWorld(true);
			}
		}
		
		if (this.right_shoulder_light && lights_config && lights_config.right) {
			const rightPos = new THREE.Vector3(
				lights_config.right.position.x,
				lights_config.right.position.y,
				lights_config.right.position.z
			);
			rightPos.applyQuaternion(this.camera.quaternion);
			rightPos.add(this.camera.position);
			
			if (!this.right_shoulder_light.mesh) {
				console.warn("Right shoulder light exists but has no mesh property!");
			} else {
				this.right_shoulder_light.mesh.position.copy(rightPos);
				const forward = new THREE.Vector3(0, 0, -100);
				forward.applyQuaternion(this.camera.quaternion);
				this.right_shoulder_light.mesh.target.position.copy(rightPos).add(forward);
				this.right_shoulder_light.mesh.updateMatrixWorld(true);
				this.right_shoulder_light.mesh.target.updateMatrixWorld(true);
			}
		}
		
		this.spawner.update_debug_meshes();
		
		if (this.overlay_container) {
			const forward = new THREE.Vector3(0, 0, -15);
			forward.applyQuaternion(this.camera.quaternion);
			
			this.overlay_container.overlay_container.position.copy(this.camera.position);
			this.overlay_container.overlay_container.position.add(forward);
			
			this.overlay_container.overlay_container.quaternion.copy(this.camera.quaternion);
			
			if (this.overlay_container.is_animating()) {
				this.overlay_container.update_tween_targets();
			}
		}
		
		this.on_update_callbacks.forEach(callback => callback(this.camera.position, this.camera.quaternion));
	}
}