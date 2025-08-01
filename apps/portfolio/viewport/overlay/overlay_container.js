import { TitleBlock } from './title_block';
import { TextContainer } from './text_container';
import { LabelContainer } from './label_container';
import { LinkContainer } from './link_container';
import { HideButton } from './hide_button';
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { ArtistBlock } from './artist_block';
import { CATEGORIES } from './overlay_common';

const PARTICLE_COUNT = 200;
const COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
const PARTICLE_SIZE = 0.05;
const GRAVITY = 0.004;
const DRAG = 0.995;
const LEFT_BURST_ANGLE = -80;
const RIGHT_BURST_ANGLE = -100; 
const SPREAD_ANGLE = 45;

export const TEXT_COLORS = {
	PRIMARY: 0xffffff,
	SECONDARY: 0x000000,
	TERTIARY: 0x000000
};

export class OverlayContainer {
	overlay_container;
	title_block;
	text_box_container;
	label_container;
	link_container;
	hide_button;
	hide_transition_map = new Map();
	party_popped = false;
	particles = [];
	primary_control_trigger = false;
	secondary_control_trigger = false;
	artist_block;

	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.overlay_container = new THREE.Object3D();
		this.overlay_container.renderOrder = 1000;
		this.overlay_container.traverse((child) => {
			child.renderOrder = 1000;
			if (child.isMesh && child.material) {
				const materials = Array.isArray(child.material) ? child.material : [child.material];
				materials.forEach(material => {
					material.depthTest = false;
					material.depthWrite = false;
					material.transparent = true;
				});
			}
		});
		this.title_block = new TitleBlock(this.overlay_container, this.camera, this);
		this.text_box_container = new TextContainer(this.overlay_container, this.camera);
		this.label_container = new LabelContainer(this.overlay_container, this.camera, this);
		this.link_container = new LinkContainer(this.overlay_container, this.camera);
		this.artist_block = new ArtistBlock(this.overlay_container, this.camera, this);
		this.hide_button = new HideButton(this.overlay_container, this.camera);
		this.applyOverlayRenderingSettings();
		this.overlay_container.position.z = this.camera.position.z - 15;
		this.parent.add(this.overlay_container);
	}

	applyOverlayRenderingSettings() {
		const components = [
			this.title_block,
			this.text_box_container,
			this.label_container,
			this.link_container,
			this.artist_block,
			this.hide_button
		];
		components.forEach(component => {
			if (component && component.traverse) {
				component.traverse((child) => {
					child.renderOrder = 1000;
					if (child.isMesh && child.material) {
						this.setMaterialOverlayProperties(child.material);
					}
				});
			} else if (component) {
				this.traverseComponentProperties(component);
			}
		});
	}

	setMaterialOverlayProperties(material) {
		const materials = Array.isArray(material) ? material : [material];
		materials.forEach(mat => {
			mat.depthTest = false;
			mat.depthWrite = false;
			mat.transparent = true;
			if (mat.opacity === undefined) {
				mat.opacity = 1.0;
			}
		});
	}

	traverseComponentProperties(component) {
		Object.keys(component).forEach(key => {
			const prop = component[key];
			if (prop && prop.isObject3D) {
				prop.renderOrder = 1000;
				prop.traverse((child) => {
					child.renderOrder = 1000;
					if (child.isMesh && child.material) {
						this.setMaterialOverlayProperties(child.material);
					}
				});
			}
		});
	}

	get_text_colors() {
		return TEXT_COLORS;
	}

	create_confetti_burst() {
		if(FLAGS.PHYSICS_LOGS) {
			const cam_pos = this.camera.position;
			const overlay_pos = this.overlay_container.position;
		}
		const forward = new THREE.Vector3(0, 0, -3);
		forward.applyQuaternion(this.camera.quaternion);
		const burst_position = this.camera.position.clone().add(forward);
		if(FLAGS.PHYSICS_LOGS) {
		}
		const burst_angles = [
			LEFT_BURST_ANGLE * Math.PI / 180,
			RIGHT_BURST_ANGLE * Math.PI / 180
		];
		burst_angles.forEach((base_angle, index) => {
			const xOffset = index === 0 ? -1 : 1;
			for (let i = 0; i < PARTICLE_COUNT / 2; i++) {
				const geometry = new THREE.PlaneGeometry(PARTICLE_SIZE, PARTICLE_SIZE);
				const material = new THREE.MeshBasicMaterial({
					color: COLORS[Math.floor(Math.random() * COLORS.length)],
					side: THREE.DoubleSide,
					depthTest: false,
					transparent: true,
					opacity: 1
				});
				const particle = new THREE.Mesh(geometry, material);
				const offset_position = burst_position.clone().add(
					new THREE.Vector3(
						(Math.random() - 0.5) * 0.2 - xOffset * 0.5,
						(Math.random() - 0.5) * 0.2,
						(Math.random() - 0.5) * 0.2
					)
				);
				particle.position.copy(offset_position);
				this.parent.add(particle);
				particle.renderOrder = 1001;
				const spread = (Math.random() - 0.5) * SPREAD_ANGLE * Math.PI / 180;
				const angle = base_angle + spread;
				const direction = new THREE.Vector3();
				const camera_right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
				const camera_up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
				direction.addScaledVector(camera_right, Math.cos(angle));
				direction.addScaledVector(camera_up, Math.sin(angle));
				const speed = 0.08 + Math.random() * 0.12;
				const upward_force = 0.15 + Math.random() * 0.1;
				particle.velocity = new THREE.Vector3(
					direction.x * speed,
					direction.y * speed + upward_force,
					direction.z * speed
				);
				particle.lookAt(this.camera.position);
				particle.rotation.z = Math.random() * Math.PI * 2;
				particle.rotationSpeed = (Math.random() - 0.5) * 0.2;
				this.particles.push(particle);
				new Tween(particle.material)
					.to({ opacity: 0 }, 2000)
					.easing(Easing.Quadratic.Out)
					.start()
					.onComplete(() => {
						this.parent.remove(particle);
						particle.geometry.dispose();
						particle.material.dispose();
						const index = this.particles.indexOf(particle);
						if (index > -1) {
							this.particles.splice(index, 1);
						}
					});
			}
		});
	}

	update_confetti() {
		if (this.particles.length > 0 && FLAGS.PHYSICS_LOGS) {
			if (Math.random() < 0.1) {
				const particle = this.particles[0];
			}
		}
		for (const particle of this.particles) {
			const local_velocity = particle.velocity.clone();
			local_velocity.applyQuaternion(this.overlay_container.quaternion.clone().invert());
			local_velocity.y -= GRAVITY;
			local_velocity.multiplyScalar(DRAG);
			particle.velocity.copy(local_velocity);
			particle.velocity.applyQuaternion(this.overlay_container.quaternion);
			particle.position.add(particle.velocity);
			particle.rotation.z += particle.rotationSpeed;
		}
	}

	trigger_overlay() {
		if(FLAGS.TWEEN_LOGS) {
		}
		if(this.hide_transition_map.size == 0) {
			this.hide_button.swap_hide_status();
			if(FLAGS.TWEEN_LOGS) {
			}
			const cleanup_callback = (tween_name) => {
				this.hide_transition_map.delete(tween_name);
				if(FLAGS.TWEEN_LOGS) {
				}
			};
			this.title_block.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map, cleanup_callback);
			this.label_container.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map, cleanup_callback);
			this.link_container.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map, cleanup_callback);
			this.artist_block.trigger_overlay(this.hide_button.is_overlay_hidden, this.hide_transition_map, cleanup_callback);
			if(this.primary_control_trigger && !this.secondary_control_trigger && this.hide_button.is_overlay_hidden) {
				this.secondary_control_trigger = true;
			}
			this.primary_control_trigger = true;
			if(FLAGS.TWEEN_LOGS) {
			}
		} else {
			if(FLAGS.TWEEN_LOGS) {
			}
		}
	}

	swap_column_sides() {
		this.label_container.swap_sides();
		this.hide_button.swap_sides(this.label_container.is_column_left);
	}

	resize_reposition() {
		this.text_box_container.resize();
		this.text_box_container.reposition(this.label_container.is_column_left);
		this.label_container.reposition();
		this.link_container.reposition();
		this.title_block.resize();
		this.title_block.reposition();
		this.hide_button.reposition(this.label_container.is_column_left);
		this.artist_block.resize();
		this.artist_block.reposition();
	}

	resize_reposition_offscreen() {
		this.text_box_container.resize();
		this.text_box_container.offscreen_reposition();
		this.label_container.offscreen_reposition();
		this.link_container.offscreen_reposition();
		this.title_block.resize();
		this.title_block.offscreen_reposition();
		this.artist_block.resize();
	}

	handle_hover(intersected_object) {
		this.label_container.handle_hover(intersected_object);
	}

	reset_hover() {
		if(FLAGS.SELECT_LOGS) {
		}
		this.label_container.reset_previous_intersected();
	}

	focus_text_box(incoming_name) {
		const simple_name = incoming_name.split('_')[1];
		if(simple_name == CATEGORIES.EDUCATION.value && !this.party_popped) {
			const dummy = { value: 0 };
			new Tween(dummy)
				.to({ value: 1 }, 200)
				.easing(Easing.Sinusoidal.Out)
				.start()
				.onComplete(() => {
					this.create_confetti_burst();
				});
			this.party_popped = true;
		}
		this.text_box_container.focus_text_box(simple_name, this.label_container.is_column_left);
	}

	lose_focus_text_box(incoming_direction) {
		this.text_box_container.lose_focus_text_box(incoming_direction);
	}

	open_link(incoming_name) {
		this.link_container.open_link(incoming_name);
	}

	is_label_container_left_side() {
		return this.label_container.is_column_left;
	}

	is_intersected() {
		return this.label_container.current_intersected;
	}

	intersected_name() {
		return this.label_container.current_intersected.name;
	}

	is_swapping_sides() {
		return this.label_container.swapping_column_sides;
	}

	is_text_active() {
		return this.text_box_container.is_text_box_active();
	}

	get_active_box() {
		if(this.is_text_active()) {
			return this.text_box_container.get_active_text_box();
		}
	}

	is_overlay_hidden() {
		return this.hide_button.is_overlay_hidden;
	}

	is_animating() {
		return this.hide_transition_map.size > 0;
	}

	update_tween_targets() {
		if (this.hide_transition_map.size === 0) {
			return;
		}
		if(FLAGS.TWEEN_LOGS) {
		}
		if (this.hide_button.is_overlay_hidden) {
			if (this.hide_transition_map.has(this.label_container.container_column.name)) {
				const tween = this.hide_transition_map.get(this.label_container.container_column.name);
				const target_x = this.label_container.get_column_x_position(false);
				
				tween.stop();
				tween.to({ x: target_x }, tween.duration - tween.elapsed);
				tween.start();
				
				if(FLAGS.TWEEN_LOGS) {
				}
			}
			if (this.text_box_container.text_box_container && 
                this.hide_transition_map.has(this.text_box_container.text_box_container.name)) {
				const tween = this.hide_transition_map.get(this.text_box_container.text_box_container.name);
				const target_y = this.text_box_container.get_text_box_y();
				
				tween.stop();
				tween.to({ y: target_y }, tween.duration - tween.elapsed);
				tween.start();
				
				if(FLAGS.TWEEN_LOGS) {
				}
			}
			if (this.title_block.title_box && 
                this.hide_transition_map.has(this.title_block.title_box.name)) {
				const tween = this.hide_transition_map.get(this.title_block.title_box.name);
				const target_y = this.title_block.get_title_y();
				
				tween.stop();
				tween.to({ y: target_y }, tween.duration - tween.elapsed);
				tween.start();
				
				if(FLAGS.TWEEN_LOGS) {
				}
			}
			if (this.link_container.link_container && 
                this.hide_transition_map.has(this.link_container.link_container.name)) {
				const tween = this.hide_transition_map.get(this.link_container.link_container.name);
				const target_y = this.link_container.get_link_container_y();
				
				tween.stop();
				tween.to({ y: target_y }, tween.duration - tween.elapsed);
				tween.start();
				
				if(FLAGS.TWEEN_LOGS) {
				}
			}
			if (this.artist_block.artist_box && 
                this.hide_transition_map.has(this.artist_block.artist_box.name)) {
				const tween = this.hide_transition_map.get(this.artist_block.artist_box.name);
				const target_y = this.artist_block.get_artist_y();
				
				tween.stop();
				tween.to({ y: target_y }, tween.duration - tween.elapsed);
				tween.start();
				
				if(FLAGS.TWEEN_LOGS) {
				}
			}
		}
	}
}