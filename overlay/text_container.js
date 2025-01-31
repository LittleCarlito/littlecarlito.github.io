import * as THREE from 'three';
import { Easing, Tween } from 'tween';
import { get_screen_size, get_associated_position, NORTH, SOUTH, EAST, WEST, VALID_DIRECTIONS } from "./screen";
import { icon_colors, icon_labels } from "./label_column";
import { clamp } from 'three/src/math/MathUtils.js';

export const TEXT = "text_";
// TODO Get this to shared variable with label_column
export const PAN_SPEED = 800;

export class TextContainer {
    focused_text_name = "";

    constructor(incoming_scene, incoming_camera) {
        this.scene = incoming_scene;
        this.camera = incoming_camera;
        // TODO Get off camera position based off this object
        this.text_box_container = new THREE.Object3D();
        // TODO Stop calculating text box by screen size and just make it a size so it scales like icon_buttons above
        // Create text displays
        this.scene.add(this.text_box_container);
        for (let c = 0; c < icon_labels.length; c++) {
            const found_width = this.get_text_box_width();
            const found_height = this.get_text_box_height();
            const box_geometry = new THREE.BoxGeometry(found_width, found_height, .01);
            const box_material = new THREE.MeshBasicMaterial({ color: icon_colors[c] });
            const text_box = new THREE.Mesh(box_geometry, box_material);
            text_box.name = `${TEXT}${icon_labels[c]}`;
            text_box.position.x = get_associated_position(WEST, this.camera);
            text_box.position.y = this.get_text_box_y();
            this.text_box_container.add(text_box);
        }
    }

    /** Brings the text box associated with the given name into focus
     ** container column MUST be on the right side
    */
   // TODO Switch to using layers and switch layers off screen
   //           Bring into layer with camera when focused
   //           Put out of layer with camera affter tweening off screen on focus loss
    focus_text_box(incoming_name, is_column_left) {
        if(!is_column_left) {
            // Get text box name
            const found_index = incoming_name.indexOf('_');
            const new_name = TEXT + incoming_name.substring(found_index + 1);
            if(new_name != this.focused_text_name) {
                // If existing focus text box move it
                if(this.focused_text_name != "") {
                    this.lose_focus_text_box(SOUTH);
                }
                this.focused_text_name =  new_name;
            }
            // Get and move text box
            const selected_text_box = this.text_box_container.getObjectByName(this.focused_text_name);
            new Tween(selected_text_box.position)
            .to({ x: this.get_focused_text_x() }, 285)
            .easing(Easing.Sinusoidal.Out)
            .start()
        } else {
            this.lose_focus_text_box(WEST);
        }
    }

    // Method to tween focused_text_name to offscreen and set to empty string
    lose_focus_text_box(move_direction = "") {
        if(this.focused_text_name != "") {
            if(move_direction == "" || VALID_DIRECTIONS.includes(move_direction)) {
                const existing_focus_box = this.text_box_container.getObjectByName(this.focused_text_name);
                if(move_direction == "") {
                    existing_focus_box.position.x = get_associated_position(WEST, this.camera);
                } else {
                    // Tween in given direction off screen
                    const move_position = get_associated_position(move_direction, this.camera);
                    switch(move_direction) {
                        case NORTH:
                            new Tween(existing_focus_box.position)
                            .to({ y: move_position }, PAN_SPEED * .2)
                            .easing(Easing.Sinusoidal.Out)
                            .start()
                            .onComplete(() => {
                                existing_focus_box.position.y = this.get_text_box_y();
                                existing_focus_box.position.x = get_associated_position(WEST, this.camera);
                            });
                            break;
                        case SOUTH:
                            new Tween(existing_focus_box.position)
                            .to({ y: move_position }, PAN_SPEED * .2)
                            .easing(Easing.Sinusoidal.Out)
                            .start()
                            .onComplete(() => {
                                existing_focus_box.position.y = this.get_text_box_y();
                                existing_focus_box.position.x = 2 * get_associated_position(WEST, this.camera);
                            });
                            break;
                        case EAST:
                            new Tween(existing_focus_box.position)
                            .to({ x: move_position }, PAN_SPEED * .2)
                            .easing(Easing.Sinusoidal.Out)
                            .start()
                            .onComplete(() => (
                                existing_focus_box.position.x = (get_associated_position(WEST, this.camera))
                            ));
                            break;
                        case WEST:
                            new Tween(existing_focus_box.position)
                            .to({ x: move_position }, PAN_SPEED * .2)
                            .easing(Easing.Sinusoidal.Out)
                            .start();                        
                            break;
                    }
                }
                // Lose focus on box
                this.focused_text_name = "";
            }
        }
    }

    resize() {
        const new_text_geometry = new THREE.BoxGeometry(this.get_text_box_width(this.camera), this.get_text_box_height(this.camera), 0);
        this.text_box_container.children.forEach(c => {
            c.geometry.dispose;
            c.geometry = new_text_geometry;
        });
    }

    reposition(is_column_left) {
        if(this.focused_text_name != ""){
            this.focus_text_box(this.focused_text_name, is_column_left);
        }
        this.text_box_container.children.forEach(c => {
            if(c.name != this.focused_text_name) {
                c.position.x = get_associated_position(WEST, this.camera);
                c.position.y = this.get_text_box_y(this.camera);
            }
        });
    }

    // Text box getters
    /** Calculates the selected text boxes x position based off camera position and window size */
    get_focused_text_x() {
        return -(get_screen_size(this.camera).x / 2 * .36)
    }
    
    /** Calculates the text boxes y position based off camera position and window size */
    get_text_box_y() {
        return -(get_screen_size(this.camera).y * 0.05);
    }
    /** Calculates the text boxes height based off camera position and window size */
    get_text_box_height() {
        return get_screen_size(this.camera).y * .6;
    }
    
    /** Calculates the text boxes width based off camera position and window size */
    get_text_box_width() {
        return clamp(get_screen_size(this.camera).x * .5, 12, 18);
    }
}