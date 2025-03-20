import { FLAGS, THREE } from "../common";
import { AssetSpawner }  from '@littlecarlito/blorkpack';
import { BLORKPACK_FLAGS } from "@littlecarlito/blorkpack";
import { SystemAssetType } from "@littlecarlito/blorkpack";
// Utility functions for angle conversion
const ANGLES = {
	toRadians: degrees => degrees * (Math.PI / 180),
	toDegrees: radians => radians * (180 / Math.PI)
};
/**
 *
 */
export class CameraManager {
	/**
	 *
	 */
	constructor(incoming_parent, incoming_camera, distance = 15) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.spawner = AssetSpawner.get_instance(this.parent);
		this.distance = distance;
		this.target = new THREE.Vector3(0, 0, 0);
		// Get camera configuration from manifest
		const camera_config = window.manifest_manager.get_camera_config();
		const controls_config = camera_config.controls;
		// Spherical coordinates (starting position)
		this.phi = 0;    // vertical angle (degrees)
		this.theta = 0;  // horizontal angle (degrees)
		// Add constraints from manifest
		this.min_phi = controls_config.min_polar_angle;  // minimum vertical angle
		this.max_phi = controls_config.max_polar_angle;  // maximum vertical angle
		this.min_dist = controls_config.min_distance;
		this.max_dist = controls_config.max_distance;
		// Set initial target from manifest
		if (camera_config.target) {
			this.target.set(
				camera_config.target.x,
				camera_config.target.y,
				camera_config.target.z
			);
		}
		// Add callback for position updates
		this.on_update_callbacks = new Set();
		// Add reference to overlay container
		this.overlay_container = null;
		// Update the camera
		this.update_camera();
		// Create shoulder lights if enabled in manifest
		if (camera_config.shoulder_lights && camera_config.shoulder_lights.enabled) {
			this.create_shoulder_lights(camera_config.shoulder_lights);
		}
	}
	/**
	 *
	 */
	async create_shoulder_lights(lights_config) {
		// Create left shoulder spotlight if configuration exists
		if (lights_config.left) {
			// Clean up any existing helpers first
			if (this.left_shoulder_light) {
				await this.spawner.despawn_helpers(this.left_shoulder_light.mesh);
			}
			const leftPos = new THREE.Vector3(
				lights_config.left.position.x,
				lights_config.left.position.y,
				lights_config.left.position.z
			);
			leftPos.applyQuaternion(this.camera.quaternion);
			leftPos.add(this.camera.position);
			// Calculate target using forward direction
			const forward = new THREE.Vector3(0, 0, -100);
			forward.applyQuaternion(this.camera.quaternion);
			const target = new THREE.Vector3().copy(leftPos).add(forward);
			// Calculate angles for spotlight based on direction
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
					asset_data: {} // empty asset_data
				}
			);
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log("Left shoulder light created:", this.left_shoulder_light ? "success" : "failed");
			}
			this.left_shoulder_light.mesh.target.position.copy(target);
		}
		// Create right shoulder spotlight if configuration exists
		if (lights_config.right) {
			// Clean up any existing helpers first
			if (this.right_shoulder_light) {
				await this.spawner.despawn_helpers(this.right_shoulder_light.mesh);
			}
			const rightPos = new THREE.Vector3(
				lights_config.right.position.x,
				lights_config.right.position.y,
				lights_config.right.position.z
			);
			rightPos.applyQuaternion(this.camera.quaternion);
			rightPos.add(this.camera.position);
			// Calculate target using forward direction
			const forward = new THREE.Vector3(0, 0, -100);
			forward.applyQuaternion(this.camera.quaternion);
			const target = new THREE.Vector3().copy(rightPos).add(forward);
			// Calculate angles for spotlight based on direction
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
					asset_data: {} // empty asset_data
				}
			);
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log("Right shoulder light created:", this.right_shoulder_light ? "success" : "failed");
			}
			this.right_shoulder_light.mesh.target.position.copy(target);
		}
	}
	/**
	 *
	 */
	add_update_callback(callback) {
		this.on_update_callbacks.add(callback);
	}
	/**
	 *
	 */
	remove_update_callback(callback) {
		this.on_update_callbacks.delete(callback);
	}
	/**
	 *
	 */
	rotate(delta_x, delta_y) {
		// Convert the input to degrees (assuming input is in screen pixels)
		this.theta -= delta_x;
		this.phi = Math.max(this.min_phi, Math.min(this.max_phi, this.phi + delta_y));
		this.update_camera();
	}
	// Add zoom capability
	/**
	 *
	 */
	zoom(delta) {
		this.distance = Math.max(
			this.min_dist,
			Math.min(this.max_dist, this.distance + delta)
		);
		this.update_camera();
	}
	/**
	 *
	 */
	set_overlay_container(container) {
		this.overlay_container = container;
	}
	/**
	 *
	 */
	async cleanupDebugMeshes() {
		if (this.left_shoulder_light) {
			await this.spawner.despawn_helpers(this.left_shoulder_light.mesh);
		}
		if (this.right_shoulder_light) {
			await this.spawner.despawn_helpers(this.right_shoulder_light.mesh);
		}
	}
	/**
	 *
	 */
	update_camera() {
		// Convert spherical coordinates to Cartesian
		const phi_rad = THREE.MathUtils.degToRad(this.phi);
		const theta_rad = THREE.MathUtils.degToRad(this.theta);
		// Update camera position
		this.camera.position.x = this.distance * Math.cos(phi_rad) * Math.sin(theta_rad);
		this.camera.position.y = this.distance * Math.sin(phi_rad);
		this.camera.position.z = this.distance * Math.cos(phi_rad) * Math.cos(theta_rad);
		if(FLAGS.PHYSICS_LOGS) {
			console.log('Camera Update:');
			console.log(`Position: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
			console.log(`Angles: phi=${this.phi.toFixed(2)}°, theta=${this.theta.toFixed(2)}°`);
		}
		// Set camera target and update
		this.camera.lookAt(this.target);
		this.camera.updateMatrix();
		// Get camera configuration from manifest
		const camera_config = window.manifest_manager.get_camera_config();
		const lights_config = camera_config.shoulder_lights;
		// Update spotlight positions relative to camera
		if (this.left_shoulder_light && lights_config && lights_config.left) {
			const leftPos = new THREE.Vector3(
				lights_config.left.position.x,
				lights_config.left.position.y,
				lights_config.left.position.z
			);
			// Transform the offset by camera's rotation
			leftPos.applyQuaternion(this.camera.quaternion);
			// Add camera's position
			leftPos.add(this.camera.position);
			if (!this.left_shoulder_light.mesh) {
				console.warn("Left shoulder light exists but has no mesh property!");
			} else {
				this.left_shoulder_light.mesh.position.copy(leftPos);
				// Update target to point forward
				const forward = new THREE.Vector3(0, 0, -100);
				forward.applyQuaternion(this.camera.quaternion);
				this.left_shoulder_light.mesh.target.position.copy(leftPos).add(forward);
				// Update matrices
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
			// Transform the offset by camera's rotation
			rightPos.applyQuaternion(this.camera.quaternion);
			// Add camera's position
			rightPos.add(this.camera.position);
			if (!this.right_shoulder_light.mesh) {
				console.warn("Right shoulder light exists but has no mesh property!");
			} else {
				this.right_shoulder_light.mesh.position.copy(rightPos);
				// Update target to point forward
				const forward = new THREE.Vector3(0, 0, -100);
				forward.applyQuaternion(this.camera.quaternion);
				this.right_shoulder_light.mesh.target.position.copy(rightPos).add(forward);
				// Update matrices
				this.right_shoulder_light.mesh.updateMatrixWorld(true);
				this.right_shoulder_light.mesh.target.updateMatrixWorld(true);
			}
		}
		// Let AssetSpawner handle debug mesh updates
		this.spawner.update_helpers();
		// Update overlay position
		if (this.overlay_container) {
			// Calculate the position in front of the camera
			const forward = new THREE.Vector3(0, 0, -15);
			forward.applyQuaternion(this.camera.quaternion);
			// Position overlay at camera position + forward vector
			this.overlay_container.overlay_container.position.copy(this.camera.position);
			this.overlay_container.overlay_container.position.add(forward);
			// Make the overlay face the camera by copying the camera's quaternion
			this.overlay_container.overlay_container.quaternion.copy(this.camera.quaternion);
			// Update tween targets if animations are active
			if (this.overlay_container.is_animating()) {
				this.overlay_container.update_tween_targets();
			}
		}
		// Call update callbacks
		this.on_update_callbacks.forEach(callback => callback(this.camera.position, this.camera.quaternion));
	}
} 