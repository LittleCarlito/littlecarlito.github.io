import { get_screen_size, get_associated_position, SOUTH } from './overlay_common';
import { Easing, FLAGS, THREE, Tween, TYPES } from '../../common';
import { clamp } from 'three/src/math/MathUtils.js';
import { Text } from 'troika-three-text';

const ARTIST_URL = "https://www.artgram.co/bennettmeier";
const artist_name = "Bennett Meier";
export const ARTIST = "artist_"
const ARTIST_BLOCK = {
	POSITION: {
		X_OFFSET: 2,
		Y_SCALE: 0.45,
		Z: 0,
		MIN_PADDING: 3
	}
};

export class ArtistBlock {
	constructor(incoming_parent, incoming_camera, overlay_container) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.overlay_container = overlay_container;
		
		this.artist_container = new THREE.Group();
		this.artist_container.name = `${ARTIST}`;
		this.artist_container.renderOrder = 1000;
		this.parent.add(this.artist_container);
		
		this.letter_containers = [];
		this.create_letter_containers();
		this.reposition();
	}

	get_text_width() {
		const font_size = this.get_artist_font_size();
		const char_width = font_size * 0.8;
		return artist_name.length * char_width;
	}

	get_artist_font_size() {
		return clamp(get_screen_size(this.camera).x * 0.08, 0.3, 0.8);
	}

	create_letter_containers() {
		const colors = this.overlay_container.get_text_colors();
		const font_size = this.get_artist_font_size();
		const char_width = font_size * 0.8;
		const total_width = artist_name.length * char_width;
		const start_x = -(total_width / 2);
		
		for (let i = 0; i < artist_name.length; i++) {
			const char = artist_name[i];
			
			const letter_container = new THREE.Group();
			letter_container.name = `${ARTIST}letter_${i}`;
			letter_container.position.x = start_x + (i * char_width);
			letter_container.renderOrder = 1000;
			
			const solid_letter = new Text();
			solid_letter.text = char;
			solid_letter.font = 'fonts/Dubtronic-Solid.woff';
			solid_letter.fontSize = font_size;
			solid_letter.color = colors.SECONDARY;
			solid_letter.anchorX = 'center';
			solid_letter.anchorY = 'middle';
			solid_letter.name = `${ARTIST}solid_${i}`;
			solid_letter.renderOrder = 1000;
			solid_letter.material.depthTest = false;
			solid_letter.material.depthWrite = false;
			solid_letter.material.transparent = true;
			solid_letter.sync();
			letter_container.add(solid_letter);
			
			if (char !== ' ') {
				const inline_letter = new Text();
				inline_letter.text = char;
				inline_letter.font = 'fonts/Dubtronic-Inline.woff';
				inline_letter.fontSize = font_size;
				inline_letter.color = colors.PRIMARY;
				inline_letter.anchorX = 'center';
				inline_letter.anchorY = 'middle';
				inline_letter.name = `${ARTIST}inline_${i}`;
				inline_letter.position.z = 0.01;
				inline_letter.renderOrder = 1000;
				inline_letter.material.depthTest = false;
				inline_letter.material.depthWrite = false;
				inline_letter.material.transparent = true;
				inline_letter.sync();
				letter_container.add(inline_letter);
			}
			
			this.artist_container.add(letter_container);
			this.letter_containers.push(letter_container);
		}
	}

	handle_click() {
		window.open(ARTIST_URL, '_blank');
	}

	get_artist_y() {
		return get_associated_position(SOUTH, this.camera);
	}

	trigger_overlay(is_overlay_hidden, tween_map) {
		const target_y = is_overlay_hidden ? 
			get_associated_position(SOUTH, this.camera) : 
			-(ARTIST_BLOCK.POSITION.Y_SCALE * get_screen_size(this.camera).y);
		
		if(!is_overlay_hidden && FLAGS.LAYER) {
			this.artist_container.layers.set(0);
		}
		
		const new_tween = new Tween(this.artist_container.position)
			.to({ y: target_y }, 680)
			.easing(Easing.Elastic.InOut)
			.start()
			.onComplete(() => {
				if(is_overlay_hidden && FLAGS.LAYER) {
					this.artist_container.layers.set(1);
				}
				tween_map.delete(this.artist_container.name);
			});
		tween_map.set(this.artist_container.name, new_tween);
	}

	resize() {
		this.artist_container.clear();
		this.letter_containers = [];
		this.create_letter_containers();
	}

	reposition() {
		const screen_size = get_screen_size(this.camera);
		const link_x = (screen_size.x / 2) - 7;
		const text_width = this.get_text_width();
		const max_x = link_x - ARTIST_BLOCK.POSITION.MIN_PADDING - (text_width / 2);
		const desired_x = Math.min(
			max_x,
			-(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET + (text_width / 2)
		);
		
		new Tween(this.artist_container.position)
			.to({ 
				x: desired_x,
				y: -(ARTIST_BLOCK.POSITION.Y_SCALE * screen_size.y)
			})
			.easing(Easing.Elastic.Out)
			.start();
	}

	offscreen_reposition() {
		const screen_size = get_screen_size(this.camera);
		const text_width = this.get_text_width();
		this.artist_container.position.y = get_associated_position(SOUTH, this.camera);
		this.artist_container.position.x = -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET + (text_width / 2);
	}
}