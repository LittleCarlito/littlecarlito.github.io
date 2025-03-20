import { clamp } from 'three/src/math/MathUtils.js';
import { get_screen_size, get_associated_position, SOUTH, TYPES, LINKS, TEXTURE_LOADER } from './overlay_common';
import { Easing, FLAGS, THREE, Tween } from '../../common';
const LINK_CONTAINER = {
	DIMENSIONS: {
		RADIUS: 0.44,
		SPACING: 3.5 // Multiplier for horizontal spacing between links
	},
	POSITION: {
		X_OFFSET: 7, // Distance from right edge
		Y_SCALE: 0.45, // Percent based
		Z: 0
	}
};
/**
 *
 */
export class LinkContainer {
	/**
	 *
	 */
	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.link_container = new THREE.Object3D();       
		this.link_container.position.x = this.get_link_container_x();
		this.link_container.position.y = this.get_link_container_y();
		this.parent.add(this.link_container);
		// Create the link icons
		Object.values(LINKS).forEach((link, l) => {
			const circle_geometry = new THREE.CircleGeometry(LINK_CONTAINER.DIMENSIONS.RADIUS);
			const circle_texture = TEXTURE_LOADER.load(link.icon_path);
			circle_texture.colorSpace = THREE.SRGBColorSpace;
			const link_button = new THREE.Mesh(
				circle_geometry,
				new THREE.MeshBasicMaterial({
					map: circle_texture,
					transparent: true,
					depthTest: false
				}));
			link_button.name = `${TYPES.LINK}${link.value}`;
			link_button.position.x += LINK_CONTAINER.DIMENSIONS.RADIUS * (LINK_CONTAINER.DIMENSIONS.SPACING * l);
			this.link_container.add(link_button);
		});
	}
	/** Open a new tab of the associated link */
	open_link(new_link) {
		const found_url = LINKS.get_link(new_link);
		if(found_url) {
			window.open(found_url, "_blank");
		} else {
			console.log(`Given label \"${new_link}\" does not have a stored path`);
		}
	}
	/**
	 *
	 */
	trigger_overlay(is_overlay_hidden, tween_map) {
		const current_pos = this.link_container.position.clone();
		const target_y = is_overlay_hidden ? get_associated_position(SOUTH, this.camera) : this.get_link_container_y();
		if(FLAGS.TWEEN_LOGS) {
			console.log(`Link Container - Starting overlay animation:
                Hidden: ${is_overlay_hidden}
                Current Position: (${current_pos.x.toFixed(2)}, ${current_pos.y.toFixed(2)}, ${current_pos.z.toFixed(2)})
                Target Y: ${target_y.toFixed(2)}
                Map Size: ${tween_map.size}`);
		}
		if(!is_overlay_hidden && FLAGS.LAYER) {
			this.set_content_layers(0);
		}
		const new_tween = new Tween(this.link_container.position)
			.to({ y: target_y }, 680)
			.easing(Easing.Elastic.InOut)
			.start()
			.onComplete(() => {
				const final_pos = this.link_container.position.clone();
				if(FLAGS.TWEEN_LOGS) {
					console.log(`Link Container - Completed overlay animation:
                        Hidden: ${is_overlay_hidden}
                        Final Position: (${final_pos.x.toFixed(2)}, ${final_pos.y.toFixed(2)}, ${final_pos.z.toFixed(2)})`);
				}
				this.current_tween = null;
				if(is_overlay_hidden && FLAGS.LAYER) {
					this.set_content_layers(1);
				}
				tween_map.delete(this.link_container.name);
			});
		tween_map.set(this.link_container.name, new_tween);
	}
	/**
	 *
	 */
	reposition() {
		new Tween(this.link_container.position)
			.to({ 
				x: this.get_link_container_x(),
				y: this.get_link_container_y()
			})
			.easing(Easing.Elastic.Out)
			.start();
	}
	/**
	 *
	 */
	offscreen_reposition() {
		this.link_container.position.y = get_associated_position(SOUTH, this.camera)
		this.link_container.position.x = this.get_link_container_x();      
	}
	// Link setters
	/**
	 *
	 */
	set_content_layers(incoming_layer) {
		this.link_container.layers.set(incoming_layer);
		Object.values(LINKS).forEach(link => {
			const link_name = `${TYPES.LINK}${link.value}`;
			const existing_link = this.link_container.getObjectByName(link_name);
			existing_link.layers.set(incoming_layer);
		});
	}
	// Link getters
	/** Calculates the link containers x position based off camera position and window size*/
	get_link_container_x() {
		return (get_screen_size(this.camera).x / 2) - LINK_CONTAINER.POSITION.X_OFFSET;
	}
	/** Calculates the link containers y position based off camera position and window size*/
	get_link_container_y() {
		return -(LINK_CONTAINER.POSITION.Y_SCALE * get_screen_size(this.camera).y);
	}
	/** Calculates the links radius based off camera position and window size*/
	get_link_radius() {
		return clamp(get_screen_size(this.camera).x * .02, Number.MIN_SAFE_INTEGER, LINK_CONTAINER.DIMENSIONS.RADIUS);
	}
}