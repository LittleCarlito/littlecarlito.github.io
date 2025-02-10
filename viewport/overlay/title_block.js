import * as THREE from 'three';
import { clamp } from "three/src/math/MathUtils.js";
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
import { get_screen_size, get_associated_position, NORTH } from './common';

export const TITLE = "title_"
const TITLE_HEIGHT = 2.75;
const TITLE_Y = 9;
const TITLE_X = -4;
const TITLE_THICKNESS = .2

export class TitleBlock {
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

    /** Hides/reveals the title block based off overlay status */
    trigger_overlay(is_overlay_hidden) {
        if(!is_overlay_hidden) {
            // this.title_box.layers.set(0);
        }
        const title_y = is_overlay_hidden ? get_associated_position(NORTH, this.camera) : TITLE_Y;
        new Tween(this.title_box.position)
        .to({ y: title_y })
        .easing(Easing.Elastic.InOut)
        .start()
        .onComplete(() => {
            if(is_overlay_hidden) {
                // this.title_box.layers.set(1);
            }
        });
    }

    /** Resizes title box based off camera position and window size */
    resize(){
        // Move/resize title
        this.title_box.geometry.dispose();
        this.title_box.geometry = new THREE.BoxGeometry(this.get_title_width(this.camera), TITLE_HEIGHT, TITLE_THICKNESS);            
        new Tween(this.title_box.position)
        .to({ y: TITLE_Y})
        .easing(Easing.Elastic.Out)
        .start();
    }

    reposition() {
        new Tween(this.title_box.position)
        .to({ y: TITLE_Y})
        .easing(Easing.Elastic.Out)
        .start();
    }
}
