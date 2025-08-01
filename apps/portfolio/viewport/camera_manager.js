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