import { clamp } from "three/src/math/MathUtils.js";
import { get_screen_size, get_associated_position, NORTH } from './overlay_common';
import { Easing, FLAGS, THREE, Tween } from '../../common';
export const TITLE = "title_"
const TITLE_HEIGHT = 2.75;
const TITLE_Y = 9;
const TITLE_X = -4;
const TITLE_THICKNESS = .2
/**
 *
 */
export class TitleBlock {
	/**
	 *
	 */
	constructor(incoming_parent, incoming_camera) {
		// Set variables
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.title_width = this.get_title_width();
		this.title_height = TITLE_HEIGHT;
		// Set shape and material
		const title_geometry = new THREE.BoxGeometry(this.title_width, this.title_height, TITLE_THICKNESS);
		const title_material = new THREE.MeshBasicMaterial({ 
			color: 0xffffff,
			wireframe: true
		});
		this.title_box = new THREE.Mesh(title_geometry, title_material);
		// Set name and position
		this.title_box.name = `${TITLE}`;
		this.title_box.position.y = TITLE_Y;
		this.title_box.position.x = TITLE_X;
		this.parent.add(this.title_box);
	}
	/** Calculates the titles width given the camera position and window size*/
	get_title_width() {
		return clamp(get_screen_size(this.camera).x * .5, 12, 18);
	}
	/**
     * Gets the correct title Y position based on overlay state
     * @returns {number} The Y position for the title
     */
	get_title_y() {
		return get_associated_position(NORTH, this.camera);
	}
	/** Hides/reveals the title block based off overlay status */
	trigger_overlay(is_overlay_hidden, tween_map) {
		const current_pos = this.title_box.position.clone();
		const title_y = is_overlay_hidden ? get_associated_position(NORTH, this.camera) : TITLE_Y;
		if(FLAGS.TWEEN_LOGS) {
			console.log(`Title Block - Starting overlay animation:
                Hidden: ${is_overlay_hidden}
                Current Position: (${current_pos.x.toFixed(2)}, ${current_pos.y.toFixed(2)}, ${current_pos.z.toFixed(2)})
                Target Y: ${title_y.toFixed(2)}
                Map Size: ${tween_map.size}`);
		}
		if(!is_overlay_hidden && FLAGS.LAYER) {
			this.title_box.layers.set(0);
		}
		const new_tween = new Tween(this.title_box.position)
			.to({ y: title_y })
			.easing(Easing.Elastic.InOut)
			.start()
			.onComplete(() => {
				const final_pos = this.title_box.position.clone();
				if(FLAGS.TWEEN_LOGS) {
					console.log(`Title Block - Completed overlay animation:
                        Hidden: ${is_overlay_hidden}
                        Final Position: (${final_pos.x.toFixed(2)}, ${final_pos.y.toFixed(2)}, ${final_pos.z.toFixed(2)})`);
				}
				if(is_overlay_hidden && FLAGS.LAYER) {
					this.title_box.layers.set(1);
				}
				tween_map.delete(this.title_box.name);
			});
		tween_map.set(this.title_box.name, new_tween);
	}
	/** Resizes title box based off camera position and window size */
	resize(){
		// Move/resize title
		this.title_box.geometry.dispose();
		this.title_box.geometry = new THREE.BoxGeometry(this.get_title_width(this.camera), TITLE_HEIGHT, TITLE_THICKNESS);            
	}
	/**
	 *
	 */
	reposition() {
		new Tween(this.title_box.position)
			.to({ y: TITLE_Y})
			.easing(Easing.Elastic.Out)
			.start();
	}
	/**
	 *
	 */
	offscreen_reposition() {
		this.title_box.position.y = get_associated_position(NORTH, this.camera)
	}
}
