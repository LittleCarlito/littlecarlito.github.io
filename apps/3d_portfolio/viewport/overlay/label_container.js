import { get_screen_size, get_associated_position, WEST } from "./overlay_common/screen";
import { CATEGORIES } from '../../common/categories';
import { TYPES, PAN_SPEED, ROTATE_SPEED, FOCUS_ROTATION } from './overlay_common/index'
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { Text } from 'troika-three-text';

const LABEL_SPACING = 2.7;

export class LabelContainer {
	in_tween_map = new Map();
	swapping_column_sides = false;
	is_column_left = true;
	current_intersected = null;
	wireframe_boxes = [];
	wireframe_colors = {
		contact: 0xffff55,
		project: 0xff55ff,
		work: 0xff5555,
		education: 0x55ff55,
		about: 0x5555ff
	};

	constructor(incoming_parent, incoming_camera, overlay_container) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.overlay_container = overlay_container;
		this.container_column = new THREE.Object3D();
		this.container_column.name = `${TYPES.CONATINER}column`
		this.container_column.renderOrder = 1000;
		this.parent.add(this.container_column);
		this.createLabels();
		this.container_column.position.x = this.get_column_x_position(true);
		this.container_column.position.y = this.get_column_y_position(true);
		this.container_column.rotation.y = this.get_column_y_rotation(true);
	}

	createLabels() {
		const colors = this.overlay_container.get_text_colors();
		const categories = Object.values(CATEGORIES).filter(category => typeof category !== 'function');
		const aboutIndex = categories.findIndex(category => category.value === 'about');
		const aboutOriginalPosition = aboutIndex * 3;
		
		categories.forEach((category, i) => {
			const button_container = new THREE.Object3D();
			button_container.simple_name = category.value;
			button_container.name = `${TYPES.CONATINER}${category.value}`;
			button_container.renderOrder = 1000;
			this.container_column.add(button_container);
			button_container.position.y = aboutOriginalPosition + (i - aboutIndex) * LABEL_SPACING;

			const textGroup = new THREE.Group();
			textGroup.simple_name = category.value;
			textGroup.name = `${TYPES.LABEL}${category.value}`;
			textGroup.renderOrder = 1000;

			const outerTextMesh = new Text();
			outerTextMesh.text = category.value.toUpperCase();
			outerTextMesh.fontSize = 1.0;
			outerTextMesh.color = colors.TERTIARY;
			outerTextMesh.strokeColor = colors.SECONDARY;
			outerTextMesh.strokeWidth = 0.1;
			outerTextMesh.anchorX = 'center';
			outerTextMesh.anchorY = 'middle';
			outerTextMesh.position.set(0.02, -0.02, -0.01);
			outerTextMesh.renderOrder = 1000;
			outerTextMesh.material.depthTest = false;
			outerTextMesh.material.depthWrite = false;
			outerTextMesh.material.transparent = true;
			
			const fontPath = '/fonts/russo-one.woff';
			outerTextMesh.font = fontPath;

			const textMesh = new Text();
			textMesh.text = category.value.toUpperCase();
			textMesh.fontSize = 1.0;
			textMesh.color = colors.PRIMARY;
			textMesh.strokeColor = colors.TERTIARY;
			textMesh.strokeWidth = 0.02;
			textMesh.anchorX = 'center';
			textMesh.anchorY = 'middle';
			textMesh.position.z = 0.1;
			textMesh.renderOrder = 1001;
			textMesh.material.depthTest = false;
			textMesh.material.depthWrite = false;
			textMesh.material.transparent = true;
			textMesh.simple_name = category.value;
			textMesh.name = `${TYPES.LABEL}${category.value}`;
			textMesh.font = fontPath;
			
			textGroup.add(outerTextMesh);
			textGroup.add(textMesh);
			button_container.add(textGroup);
			textMesh.sync(() => {
				const textWidth = Math.max(5, textMesh.textRenderInfo.blockBounds[2] - textMesh.textRenderInfo.blockBounds[0] + 1);
				
				const boxGeometry = new THREE.BoxGeometry(textWidth, LABEL_SPACING, 0.2);
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
				collisionBox.renderOrder = 999;
				button_container.add(collisionBox);

				if (FLAGS.COLLISION_VISUAL_DEBUG) {
					const wireframe_material = new THREE.MeshBasicMaterial({
						color: this.wireframe_colors[category.value] || 0xffffff,
						wireframe: true,
						transparent: true,
						opacity: 0.7,
						depthTest: false
					});
					const wireframe_box = new THREE.Mesh(boxGeometry, wireframe_material);
					wireframe_box.raycast = () => null;
					wireframe_box.visible = true;
					wireframe_box.renderOrder = 1002;
					button_container.add(wireframe_box);
					this.wireframe_boxes.push(wireframe_box);
				}
			});
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
		this.swapping_column_sides = true;
		new Tween(this.container_column.position)
			.to({ x: x_position, y: y_position}, PAN_SPEED)
			.easing(Easing.Elastic.Out)
			.start()
			.onComplete(() => {
				this.swapping_column_sides = false;
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
			return;
		}
		if (this.swapping_column_sides) {
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
		const simple_name = target_object.simple_name;
		
		// Check if we're already hovering this same label (by simple_name, not object reference)
		const current_simple_name = this.current_intersected?.simple_name;
		if (current_simple_name === simple_name) {
			return; // Already hovering this label, don't restart animation
		}
		
		let in_tween = this.in_tween_map.get(object_name);
		if(in_tween == null) {
			// Reset previous intersection before setting new one
			this.reset_previous_intersected();
			this.current_intersected = target_object;
			
			if (FLAGS.COLLISION_VISUAL_DEBUG) {
				container.children.forEach(child => {
					if (child.material && child.material.wireframe) {
						// Visual debug code here if needed
					}
				});
			}
			
			let final_rotation = this.is_column_left ? -(FOCUS_ROTATION) : (FOCUS_ROTATION);
			in_tween = new Tween(this.current_intersected.rotation)
				.to({ y: final_rotation}, 400)
				.easing(Easing.Sinusoidal.In)
				.start()
				.onComplete(() => {
					target_object.rotation.y = final_rotation;
					this.in_tween_map.delete(object_name);
				});
			this.in_tween_map.set(object_name, in_tween);
		}
	}

	reset_previous_intersected() {
		if(this.current_intersected) {
			const object_to_reset = this.current_intersected;
			if (FLAGS.COLLISION_VISUAL_DEBUG) {
				const container = object_to_reset.parent;
				if (container) {
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
					object_to_reset.rotation.y = deselected_rotation;
				});
			this.current_intersected = null;
		}
	}

	set_content_layer(incoming_layer) {
		this.container_column.layers.set(0);
		Object.values(CATEGORIES).forEach(category => {
			if (typeof category === 'function') return;
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
					wireframe_box.raycast = () => null;
					wireframe_box.visible = FLAGS.COLLISION_VISUAL_DEBUG;
					wireframe_box.renderOrder = 1002;
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