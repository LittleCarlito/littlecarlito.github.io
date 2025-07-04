import { get_screen_size, get_associated_position, WEST } from "./overlay_common/screen";
import { CATEGORIES } from '../../common/categories';
import { TYPES, PAN_SPEED, ROTATE_SPEED, FOCUS_ROTATION } from './overlay_common/index'
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { Text } from 'troika-three-text';

export class LabelContainer {
	in_tween_map = new Map();
	swapping_column_sides = false;
	is_column_left = true;
	current_intersected = null;
	wireframe_boxes = [];
	// Define colors for wireframes - high visibility versions of category colors
	wireframe_colors = {
		contact: 0xffff55,    // bright yellow
		project: 0xff55ff,    // bright purple
		work: 0xff5555,       // bright red
		education: 0x55ff55,  // bright green
		about: 0x5555ff       // bright blue
	};

	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.container_column = new THREE.Object3D();
		this.container_column.name = `${TYPES.CONATINER}column`
		this.parent.add(this.container_column);
		this.createLabels();
		this.container_column.position.x = this.get_column_x_position(true);
		this.container_column.position.y = this.get_column_y_position(true);
		this.container_column.rotation.y = this.get_column_y_rotation(true);
	}

	createLabels() {
		// Create section labels
		Object.values(CATEGORIES).forEach((category, i) => {
			if (typeof category === 'function') return; // Skip helper methods
			const button_container = new THREE.Object3D();
			button_container.simple_name = category.value;
			button_container.name = `${TYPES.CONATINER}${category.value}`;
			this.container_column.add(button_container);
			button_container.position.y = i * 3;

			// Create Troika Text
			const textMesh = new Text();
			textMesh.text = category.value.toUpperCase();
			textMesh.fontSize = 1.0;
			textMesh.color = category.color;
			textMesh.anchorX = 'center';
			textMesh.anchorY = 'middle';
			textMesh.position.z = 0.1;
			textMesh.renderOrder = 2;
			textMesh.depthTest = false;
			textMesh.simple_name = category.value;
			textMesh.name = `${TYPES.LABEL}${category.value}`;
			
			// Set font path to your downloaded Roboto font
			const fontPath = window.location.hostname === 'littlecarlito.github.io' 
				? '/threejs_site/fonts/Karnivore-Digit.woff'
				: '/fonts/Karnivore-Digit.woff';
			textMesh.font = fontPath;
			
			// Sync the text to ensure proper dimensions
			textMesh.sync(() => {
				// Get text width after sync for collision box sizing
				const textWidth = Math.max(5, textMesh.textRenderInfo.blockBounds[2] - textMesh.textRenderInfo.blockBounds[0] + 1);
				
				// Create invisible collision box with width matching the text
				const boxGeometry = new THREE.BoxGeometry(textWidth, 3, 0.2);
				const collisionMaterial = new THREE.MeshBasicMaterial({
					transparent: true,
					opacity: 0,
					colorWrite: false,
					depthWrite: false,
					depthTest: false
				});
				const collisionBox = new THREE.Mesh(boxGeometry, collisionMaterial);
				collisionBox.simple_name = category.value;
				collisionBox.name = `${TYPES.LABEL}${category.value}_collision`;
				button_container.add(collisionBox);

				// Add wireframe box for visual debugging
				if (FLAGS.COLLISION_VISUAL_DEBUG) {
					const wireframe_material = new THREE.MeshBasicMaterial({
						color: this.wireframe_colors[category.value] || 0xffffff,
						wireframe: true,
						transparent: true,
						opacity: 0.7,
						depthTest: false
					});
					const wireframe_box = new THREE.Mesh(boxGeometry, wireframe_material);
					wireframe_box.raycast = () => null; // Disable raycasting
					wireframe_box.visible = true;
					button_container.add(wireframe_box);
					this.wireframe_boxes.push(wireframe_box);
				}
			});
			
			button_container.add(textMesh);
		});
	}

	trigger_overlay(is_overlay_hidden, tween_map) {
		if(!is_overlay_hidden && FLAGS.LAYER) {
			this.set_content_layer(0);
		}
		const container_column_x = is_overlay_hidden ? get_associated_position(WEST, this.camera) : this.get_column_x_position(true);
		const new_tween = new Tween(this.container_column.position)
			.to({ x: container_column_x })
			.easing(Easing.Elastic.InOut)
			.start()
			.onComplete(() => {
				if(is_overlay_hidden && FLAGS.LAYER) {
					this.set_content_layer(1);
				}
				tween_map.delete(this.container_column.name);
			});
		tween_map.set(this.container_column.name, new_tween);
	}

	swap_sides() {
		this.reset_previous_intersected();
		this.is_column_left = !this.is_column_left;
		const x_position = this.get_column_x_position(this.is_column_left);
		const y_position = this.get_column_y_position(this.is_column_left);
		const y_rotation = this.get_column_y_rotation(this.is_column_left);
		if (FLAGS.ROTATION_TWEEN_LOGS) {
			console.log(`[RotationTween] Swapping sides to ${this.is_column_left ? 'left' : 'right'}`);
		}
		this.swapping_column_sides = true;
		new Tween(this.container_column.position)
			.to({ x: x_position, y: y_position}, PAN_SPEED)
			.easing(Easing.Elastic.Out)
			.start()
			.onComplete(() => {
				this.swapping_column_sides = false;
				if (FLAGS.ROTATION_TWEEN_LOGS) {
					console.log('[RotationTween] Swap sides complete');
				}
			});
		new Tween(this.container_column.rotation)
			.to({ y: y_rotation}, ROTATE_SPEED)
			.easing(Easing.Exponential.Out)
			.start();
	}

	reposition() {
		let x_position = this.get_column_x_position(this.is_column_left);
		new Tween(this.container_column.position)
			.to({ x: x_position})
			.easing(Easing.Elastic.Out)
			.start();
	}

	offscreen_reposition() {
		const x_position = get_associated_position(WEST, this.camera);
		new Tween(this.container_column.position)
			.to({ x: x_position })
			.easing(Easing.Elastic.Out)
			.start();
	}

	handle_hover(intersected_object) {
		if (!intersected_object || !intersected_object.rotation) {
			if (FLAGS.ROTATION_TWEEN_LOGS) {
				console.log('[RotationTween] Invalid hover object received');
			}
			return;
		}
		if (FLAGS.ROTATION_TWEEN_LOGS) {
			console.log(`[RotationTween] Hover detected on object: ${intersected_object.name}`);
			console.log(`[RotationTween] Current rotation: ${JSON.stringify(intersected_object.rotation)}`);
			console.log(`[RotationTween] Swapping sides status: ${this.swapping_column_sides}`);
			console.log(`[RotationTween] Is column left: ${this.is_column_left}`);
		}
		if (this.swapping_column_sides) {
			if (FLAGS.ROTATION_TWEEN_LOGS) {
				console.log('[RotationTween] Ignoring hover while swapping sides');
			}
			return;
		}
		let target_object = intersected_object;
		let container = intersected_object.parent;
		if (intersected_object.name.includes('_collision')) {
			container.children.forEach(child => {
				if (child.name && child.name.startsWith(TYPES.LABEL) && !child.name.includes('_collision')) {
					target_object = child;
				}
			});
		}
		const object_name = target_object.name;
		let in_tween = this.in_tween_map.get(object_name);
		if(in_tween == null) {
			if(this.current_intersected !== target_object) {
				this.reset_previous_intersected();
				this.current_intersected = target_object;
				if (FLAGS.COLLISION_VISUAL_DEBUG) {
					container.children.forEach(child => {
						if (child.material && child.material.wireframe) {
							// Don't change visibility here since they should always be visible when debug is on
						}
					});
				}
				let final_rotation = this.is_column_left ? -(FOCUS_ROTATION) : (FOCUS_ROTATION);
				in_tween = new Tween(this.current_intersected.rotation)
					.to({ y: final_rotation}, 400)
					.easing(Easing.Sinusoidal.In)
					.start()
					.onComplete(() => {
						if (FLAGS.ROTATION_TWEEN_LOGS) {
							console.log(`[RotationTween] Tween complete for ${object_name}. Final rotation:`, target_object.rotation.y);
						}
						target_object.rotation.y = final_rotation;
						this.in_tween_map.delete(object_name);
					});
				this.in_tween_map.set(object_name, in_tween);
			}
		}
	}

	reset_previous_intersected() {
		if(this.current_intersected) {
			if (FLAGS.ROTATION_TWEEN_LOGS) {
				console.log(`[RotationTween] Resetting rotation for ${this.current_intersected.name}. Current rotation:`, this.current_intersected.rotation.y);
			}
			const object_to_reset = this.current_intersected;
			if (FLAGS.COLLISION_VISUAL_DEBUG) {
				const container = object_to_reset.parent;
				if (container) {
					// Don't hide wireframes anymore - they should stay visible
				}
			}
			const existing_tween = this.in_tween_map.get(object_to_reset.name);
			if (existing_tween) {
				existing_tween.stop();
				this.in_tween_map.delete(object_to_reset.name);
			}
			let deselected_rotation = 0;
			const reset_tween = new Tween(object_to_reset.rotation)
				.to({ y: deselected_rotation}, 400)
				.easing(Easing.Elastic.Out)
				.start()
				.onComplete(() => {
					if (FLAGS.ROTATION_TWEEN_LOGS) {
						console.log(`[RotationTween] Reset complete for ${object_to_reset.name}. Final rotation:`, object_to_reset.rotation.y);
					}
					object_to_reset.rotation.y = deselected_rotation;
				});
			this.current_intersected = null;
		}
	}

	set_content_layer(incoming_layer) {
		this.container_column.layers.set(0);
		Object.values(CATEGORIES).forEach(category => {
			if (typeof category === 'function') return; // Skip helper methods
			const label_name = `${TYPES.CONATINER}${category.value}`;
			const button_name = `${TYPES.LABEL}${category.value}`;
			const existing_label_container = this.container_column.getObjectByName(label_name);
			const existing_label = existing_label_container.getObjectByName(button_name);
			existing_label.layers.set(incoming_layer);
		});
	}

	get_column_x_position(is_column_left) {
		return (is_column_left ? -1 : 1) * (get_screen_size(this.camera).x / 2) * 0.6;
	}

	get_column_y_position(is_column_left) {
		return (is_column_left ? -1 : -.6) * (get_screen_size(this.camera).y / 2) * 0.6;
	}

	get_column_y_rotation(is_column_left) {
		return (is_column_left ? 1 : -1);
	}

	updateDebugVisualizations() {
		if (this.wireframe_boxes.length === 0) {
			this.container_column.children.forEach(button_container => {
				if (!button_container.name.startsWith(TYPES.CONATINER)) return;
				const collisionBox = button_container.children.find(child => 
					child.name && child.name.includes('_collision')
				);
				if (collisionBox) {
					const wireframe_material = new THREE.MeshBasicMaterial({
						color: this.wireframe_colors[button_container.simple_name] || 0xffffff,
						wireframe: true,
						transparent: true,
						opacity: 0.7,
						depthTest: false
					});
					const wireframe_box = new THREE.Mesh(collisionBox.geometry, wireframe_material);
					wireframe_box.raycast = () => null; // Disable raycasting
					wireframe_box.visible = FLAGS.COLLISION_VISUAL_DEBUG; // Initial visibility based on flag
					button_container.add(wireframe_box);
					this.wireframe_boxes.push(wireframe_box);
				}
			});
		}
		if (this.wireframe_boxes.length > 0) {
			this.wireframe_boxes.forEach(box => {
				box.visible = FLAGS.COLLISION_VISUAL_DEBUG;
			});
		}
	}
}