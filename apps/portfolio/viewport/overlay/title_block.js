import { clamp } from "three/src/math/MathUtils.js";
import { get_screen_size, get_associated_position, NORTH } from './overlay_common';
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { Text } from 'troika-three-text';

export const TITLE = "title_"
const TITLE_HEIGHT = 2.75;
const TITLE_Y = 9;
const TITLE_X = -4;

export class TitleBlock {
	constructor(incoming_parent, incoming_camera, overlay_container) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.overlay_container = overlay_container;
		
		this.title_container = new THREE.Group();
		this.title_container.name = `${TITLE}`;
		this.title_container.position.y = TITLE_Y;
		this.title_container.position.x = TITLE_X;
		this.parent.add(this.title_container);
		
		this.letter_containers = [];
		this.create_letter_containers();
	}

	get_title_font_size() {
		return clamp(get_screen_size(this.camera).x * 0.15, 1.5, 2.5);
	}

	get_title_y() {
		return get_associated_position(NORTH, this.camera);
	}

	create_letter_containers() {
		const colors = this.overlay_container.get_text_colors();
		const text = 'Steven Meier';
		const font_size = this.get_title_font_size();
		const char_width = font_size * 0.8;
		const total_width = text.length * char_width;
		const start_x = -(total_width / 2);
		
		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			
			const letter_container = new THREE.Group();
			letter_container.name = `${TITLE}letter_${i}`;
			letter_container.position.x = start_x + (i * char_width);
			
			const solid_letter = new Text();
			solid_letter.text = char;
			solid_letter.font = 'fonts/Dubtronic-Solid.woff';
			solid_letter.fontSize = font_size;
			solid_letter.color = colors.PRIMARY;
			solid_letter.anchorX = 'center';
			solid_letter.anchorY = 'middle';
			solid_letter.name = `${TITLE}solid_${i}`;
			solid_letter.sync();
			letter_container.add(solid_letter);
			
			if (char !== ' ') {
				const inline_letter = new Text();
				inline_letter.text = char;
				inline_letter.font = 'fonts/Dubtronic-Inline.woff';
				inline_letter.fontSize = font_size;
				inline_letter.color = colors.SECONDARY;
				inline_letter.anchorX = 'center';
				inline_letter.anchorY = 'middle';
				inline_letter.name = `${TITLE}inline_${i}`;
				inline_letter.position.z = 0.01;
				inline_letter.sync();
				letter_container.add(inline_letter);
			}
			
			this.title_container.add(letter_container);
			this.letter_containers.push(letter_container);
		}
	}

	trigger_overlay(is_overlay_hidden, tween_map) {
		const current_pos = this.title_container.position.clone();
		const title_y = is_overlay_hidden ? get_associated_position(NORTH, this.camera) : TITLE_Y;
		
		if(!is_overlay_hidden && FLAGS.LAYER) {
			this.title_container.layers.set(0);
		}
		
		const new_tween = new Tween(this.title_container.position)
			.to({ y: title_y })
			.easing(Easing.Elastic.InOut)
			.start()
			.onComplete(() => {
				if(is_overlay_hidden && FLAGS.LAYER) {
					this.title_container.layers.set(1);
				}
				tween_map.delete(this.title_container.name);
			});
		tween_map.set(this.title_container.name, new_tween);
	}

	resize() {
		this.title_container.clear();
		this.letter_containers = [];
		this.create_letter_containers();
	}

	reposition() {
		new Tween(this.title_container.position)
			.to({ y: TITLE_Y })
			.easing(Easing.Elastic.Out)
			.start();
	}

	offscreen_reposition() {
		this.title_container.position.y = get_associated_position(NORTH, this.camera);
	}
}