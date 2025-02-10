import * as THREE from 'three';
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
import { get_screen_size, get_associated_position, WEST } from "./common/screen";
import { CATEGORIES } from './common/categories';
import { TEXTURE_LOADER, TYPES, PAN_SPEED, ROTATE_SPEED, FOCUS_ROTATION, FLAGS } from './common/index'

export class LabelColumn {
    in_tween_map = new Map();
    swapping_column_sides = false;
    is_column_left = true;
    current_intersected = null;

    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.container_column = new THREE.Object3D();
        this.container_column.name = `${TYPES.CONATINER}column`
        this.parent.add(this.container_column);
        // Create section labels
        Object.values(CATEGORIES).forEach((category, i) => {
            if (typeof category === 'function') return; // Skip helper methods
            const button_container = new THREE.Object3D();
            button_container.name = `${TYPES.CONATINER}${category.value}`
            this.container_column.add(button_container);
            const button_texture = TEXTURE_LOADER.load(category.icon);
            button_texture.colorSpace = THREE.SRGBColorSpace;
            const button_option = new THREE.Mesh(
                // TODO Get demensions to constants
                new THREE.BoxGeometry(5, 3, 0),
                new THREE.MeshBasicMaterial({
                    map: button_texture,
                    transparent: true
                }));
            button_option.name = `${TYPES.LABEL}${category.value}`
            button_option.position.y = i * 3;
            button_container.add(button_option);
        });
        this.container_column.position.x = this.get_column_x_position(true);
        this.container_column.position.y = this.get_column_y_position(true);
        this.container_column.rotation.y = this.get_column_y_rotation(true);
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
        this.is_column_left = !this.is_column_left;
        const x_position = this.get_column_x_position(this.is_column_left);
        const y_position = this.get_column_y_position(this.is_column_left);
        const y_rotation = this.get_column_y_rotation(this.is_column_left);
        // Move column across the screen
        this.swapping_column_sides = true;
        new Tween(this.container_column.position)
        .to({ x: x_position, y: y_position}, PAN_SPEED)
        .easing(Easing.Elastic.Out)
        .start()
        .onComplete(() => {
            this.swapping_column_sides = false;
        });
        // Rotate the column as it moves
        new Tween(this.container_column.rotation)
        .to({ y: y_rotation}, ROTATE_SPEED)
        .easing(Easing.Exponential.Out)
        .start();
    }

    reposition() {
            let x_position = this.get_column_x_position(this.is_column_left);
            // Move button column across the screen
            new Tween(this.container_column.position)
            .to({ x: x_position})
            .easing(Easing.Elastic.Out)
            .start();
    }

    offscreen_reposition() {
        this.container_column.position.x = get_associated_position(WEST, this.camera);        
    }

    handle_hover(intersected_object) {
        // Check if tween exists for this object already
        const object_name = intersected_object.name;
        let in_tween = this.in_tween_map.get(object_name);
        if(in_tween == null) {
            if(this.current_intersected !== intersected_object) {
                // Reset previously inersected object if one existed
                this.reset_previous_intersected();
                // Set intersected object to current
                this.current_intersected = intersected_object;
            }
            // Apply rotation to current
            let final_rotation = this.is_column_left ? -(FOCUS_ROTATION) : (FOCUS_ROTATION);
            // Create rotation tween and set it in the map
            in_tween = new Tween(this.current_intersected.rotation)
            .to({ y: final_rotation}, 400)
            .easing(Easing.Sinusoidal.In)
            .start()
            .onComplete(() => this.in_tween_map.delete(object_name));
            this.in_tween_map.set(object_name, in_tween);
        }
    }

    /** Resets the previous intersetcted objects orientation */
    reset_previous_intersected() {
        if(this.current_intersected) {
            // Reset rotation
            let deselected_rotation = 0;
            new Tween(this.current_intersected.rotation)
            .to({ y: deselected_rotation})
            .easing(Easing.Elastic.Out)
            .start();
            this.current_intersected = null;
        }
    }

    // Column setters
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

    // Column getters
    /** Calculates the x position of the container column given it and the cameras position along with window size */
    get_column_x_position(is_column_left) {
        return (is_column_left ? -1 : 1) * (get_screen_size(this.camera).x / 2) * 0.6;
    }
    
    /** Calculates the y position of the container column given it and the cameras position along with window size */
    get_column_y_position(is_column_left) {
        return (is_column_left ? -1 : -.6) * (get_screen_size(this.camera).y / 2) * 0.6;
    }
    
    /** Calculates the y rotation of the container column given its position along with window size */
    get_column_y_rotation(is_column_left) {
        return (is_column_left ? 1 : -1);
    }
}