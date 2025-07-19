import { get_screen_size, get_associated_position, EAST, TYPES, HIDE_HEIGHT, HIDE_WIDTH } from './overlay_common';
import { Easing, THREE, Tween } from '../../common';
import { CustomTypeManager } from '@littlecarlito/blorkpack';
import { FLAGS } from '../../common';

const HIDE_BUTTON_IMAGE_ENABLED = 'images/moon_broke.png';
const HIDE_BUTTON_IMAGE_DISABLED = 'images/moon.png';
const HIDE_BUTTON_SCALE = 1.0;

export class HideButton {
	is_overlay_hidden = false;
	#ASSET_TYPE = CustomTypeManager.getTypes();
	#texture_loader = new THREE.TextureLoader();
	#enabled_texture = null;
	#disabled_texture = null;
	#base_width = 1.0;
	#base_height = 1.0;

	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.#load_textures();
	}

	#load_textures() {
		this.#enabled_texture = this.#texture_loader.load(HIDE_BUTTON_IMAGE_ENABLED, (texture) => {
			this.#calculate_dimensions(texture);
			this.#create_button();
		});
		this.#disabled_texture = this.#texture_loader.load(HIDE_BUTTON_IMAGE_DISABLED, (texture) => {
			if (!this.hide_button) {
				this.#calculate_dimensions(texture);
				this.#create_button();
			}
		});
	}

	#calculate_dimensions(texture) {
		const aspect_ratio = texture.image.width / texture.image.height;
		if (aspect_ratio > 1) {
			this.#base_width = HIDE_BUTTON_SCALE;
			this.#base_height = HIDE_BUTTON_SCALE / aspect_ratio;
		} else {
			this.#base_width = HIDE_BUTTON_SCALE * aspect_ratio;
			this.#base_height = HIDE_BUTTON_SCALE;
		}
	}

	#create_button() {
		const hide_button_geometry = new THREE.PlaneGeometry(this.#base_width, this.#base_height);
		const hide_button_material = this.get_hide_button_material();
		this.hide_button = new THREE.Mesh(hide_button_geometry, hide_button_material);
		this.hide_button.position.y = this.get_hide_button_y(this.camera);
		this.hide_button.position.x = this.get_hide_button_x(true, this.camera);
		this.hide_button.name = `${TYPES.HIDE}${this.#ASSET_TYPE.UNIQUE}`;
		this.hide_button.renderOrder = 1000;
		this.hide_button.layers.set(0);
		this.parent.add(this.hide_button);
	}

	get_hide_button_material() {
		const texture = this.is_overlay_hidden ? this.#enabled_texture : this.#disabled_texture;
		const material = new THREE.MeshBasicMaterial({ 
			map: texture,
			toneMapped: false,
			depthTest: false,
			depthWrite: false,
			transparent: true
		});
		return material;
	}

	get_hide_button_x(is_column_left) {
		return is_column_left ? (get_screen_size(this.camera).x / 2) - 2.5 : get_associated_position(EAST, this.camera);
	}

	get_hide_button_y() {
		return (get_screen_size(this.camera).y / 2) - 2.5;
	}

	update_material() {
		if (this.hide_button.material) {
			this.hide_button.material.dispose();
		}
		this.hide_button.material = this.get_hide_button_material();
	}

	swap_sides(is_column_left) {
		const target_layer = is_column_left ? 0 : 1;
		this.hide_button.layers.set(target_layer);
		
		const hide_x = this.get_hide_button_x(is_column_left, this.camera);
		new Tween(this.hide_button.position)
			.to({ x: hide_x }, 250)
			.easing(Easing.Sinusoidal.Out)
			.start();
	}

	reposition(is_column_left) {
		new Tween(this.hide_button.position)
			.to({ 
				x: this.get_hide_button_x(is_column_left),
				y: this.get_hide_button_y()
			})
			.easing(Easing.Elastic.Out)
			.start();
	}

	offscreen_reposition() {
		this.hide_button.position.y = this.get_hide_button_y();
		this.hide_button.position.x = this.get_hide_button_x(false);
	}

	swap_hide_status() {
		this.is_overlay_hidden = !this.is_overlay_hidden;
		this.update_material();
	}
}