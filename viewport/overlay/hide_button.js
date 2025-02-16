import * as THREE from 'three';
import { get_screen_size, get_associated_position, EAST, TYPES, HIDE_HEIGHT, HIDE_WIDTH } from './common';
import { Tween, Easing } from 'three/examples/jsm/libs/tween.module.js';
import { NAMES } from '../../common';

export class HideButton {
    is_overlay_hidden = false;

    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        const hide_button_width = HIDE_WIDTH;
        const hide_button_height = HIDE_HEIGHT;
        const hide_button_geometry = new THREE.BoxGeometry(hide_button_width, hide_button_height, 0);
        const hide_button_material = this.get_hide_button_material();
        this.hide_button = new THREE.Mesh(hide_button_geometry, hide_button_material);
        this.hide_button.position.y = this.get_hide_button_y(this.camera);
        this.hide_button.position.x = this.get_hide_button_x(true, this.camera);
        this.hide_button.name = `${TYPES.HIDE}${NAMES.UNIQUE}`;
        this.parent.add(this.hide_button);
    }

    // Hide button getters
    /** Determines the material for the hide button based off scene state */
    get_hide_button_material() {
        return new THREE.MeshBasicMaterial({ 
            color: this.is_overlay_hidden ? 0x689f38 : 0x777981,
            toneMapped: false
        });
    }
    
    /** Calculates hide button x position based off camera position and window size*/
    get_hide_button_x(is_column_left) {
        return is_column_left ? (get_screen_size(this.camera).x / 2) - 2.5 : get_associated_position(EAST, this.camera);
    }
    
    /** Calculates hide button y position based off camera position and window size */
    get_hide_button_y() {
        return (get_screen_size(this.camera).y / 2) - 2.5;
    }

    /** Resets the internal material based off the buttons state */
    update_material() {
        if (this.hide_button.material) {
            this.hide_button.material.dispose();
        }
        this.hide_button.material = this.get_hide_button_material();
    }

    swap_sides(is_column_left) {
        if(is_column_left) {
            this.hide_button.layers.set(0);
        }
        const hide_x = this.get_hide_button_x(is_column_left, this.camera);
        new Tween(this.hide_button.position)
        .to({ x: hide_x }, 250)
        .easing(Easing.Sinusoidal.Out)
        .start()
        .onComplete(() => {
            if(!is_column_left) {
                this.hide_button.layers.set(1);
            }
        });
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