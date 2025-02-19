import { clamp } from 'three/src/math/MathUtils.js';
import { TextFrame, IFRAME } from './text_frame';
import { get_screen_size, get_associated_position, NORTH, SOUTH, EAST, WEST, CATEGORIES, extract_type, PAN_SPEED, TYPES, VALID_DIRECTIONS } from './overlay_common';
import { Easing, FLAGS, NAMES, THREE, Tween } from '../../common';
import { GLTF_LOADER } from '../../background/background_common';

export class TextContainer {
    container_width;
    container_height;
    text_frames = new Map();
    focused_text_name = "";
    particles = [];

    DIPLOMA = {
        scale: 10,
        mass: 1,
        restitution: .2,
        position: new THREE.Vector3(10, 0, 4),
        rotation: new THREE.Euler(-Math.PI/  2, 0, Math.PI)
    }

    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.text_box_container = new THREE.Object3D();
        // Create text displays
        this.parent.add(this.text_box_container);
        Object.values(CATEGORIES).forEach((category, i) => {
            if (typeof category === 'function') return; // Skip helper methods
            const text_box = new THREE.Object3D();
            text_box.position.x = get_associated_position(WEST, this.camera) * 2;
            text_box.position.y = this.get_text_box_y();
            text_box.simple_name = category.value;
            text_box.name = `${TYPES.TEXT}${category.value}`;
            if(FLAGS.LAYER){
                text_box.layers.set(1);
            }
            this.text_box_container.add(text_box);

            const create_background = (incoming_category, incoming_box) => {
                this.container_width = this.get_text_box_width();
                this.container_height = this.get_text_box_height();
                const box_geometry = new THREE.BoxGeometry(this.container_width, this.container_height, .01);
                const box_material = new THREE.MeshBasicMaterial({ 
                    color: incoming_category.color,
                    depthTest: false,
                    transparent: true
                });
                const text_box_background = new THREE.Mesh(box_geometry, box_material);
                text_box_background.name = `${TYPES.BACKGROUND}${incoming_category.value}`;
                text_box_background.renderOrder = 999;
                incoming_box.add(text_box_background);
            };

            const create_text_frame = (incoming_category, incoming_box) => {
                const new_frame = new TextFrame(incoming_box, this.camera, this.container_width, this.container_height);
                new_frame.simple_name = incoming_category.value;
                new_frame.name = `${TYPES.TEXT_BLOCK}${incoming_category.value}`;
                this.text_frames.set(new_frame.name, new_frame);
            };

            // TODO OOOOOO
            switch(category.value) {
                case CATEGORIES.EDUCATION.value:
                    GLTF_LOADER.load("assets/diploma.glb", (loaded_diploma) => {
                        let diploma_asset = loaded_diploma.scene;
                        diploma_asset.position.copy(this.DIPLOMA.position);
                        diploma_asset.rotation.copy(this.DIPLOMA.rotation);
                        diploma_asset.name = `${TYPES.GLTF_MESH}${NAMES.DIPLOMA}`;
                        diploma_asset.scale.set(this.DIPLOMA.scale, this.DIPLOMA.scale, this.DIPLOMA.scale);
                        diploma_asset.renderOrder = 999;
                        diploma_asset.traverse((child) => {
                            if (child.isMesh) {
                                child.name = `${TYPES.INTERACTABLE}${NAMES.DIPLOMA}`;
                                child.material.depthTest = false;
                                child.material.transparent = true;
                            }
                        });
                        text_box.add(diploma_asset);
                    });
                    create_background(category, text_box);
                    break;
                case CATEGORIES.ABOUT.value:
                    // About doesn't want any background asset or box
                    create_text_frame(category, text_box);
                    break;
                default:
                    create_background(category, text_box);
                    create_text_frame(category, text_box);
                    break;
            }
        });
    }

    /** Brings the text box associated with the given name into focus
     ** container column MUST be on the right side
    */
    focus_text_box(incoming_name, is_column_left) {
        if(!is_column_left) {
            // Get text box name
            const found_index = incoming_name.indexOf('_');
            const new_name = TYPES.TEXT + incoming_name.substring(found_index + 1);
            if(FLAGS.SELECT_LOGS) {
                console.log('Focusing text box:', {
                    incoming_name,
                    new_name,
                    category: incoming_name.substring(found_index + 1),
                    available_frames: Array.from(this.text_frames.keys())
                });
            }

            if(new_name != this.focused_text_name) {
                // If existing focus text box move it
                if(this.focused_text_name != "") {
                    // Stop any running animations in the current frame before switching
                    const currentCategory = this.focused_text_name.replace(TYPES.TEXT, '');
                    const currentFrame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${currentCategory}`);
                    if (currentFrame && currentFrame.iframe.contentWindow) {
                        // Only trigger visibility change for education page
                        if (currentFrame.simple_name === CATEGORIES.EDUCATION.value) {
                            const visibilityEvent = new Event('visibilitychange');
                            Object.defineProperty(currentFrame.iframe.contentDocument, 'hidden', {
                                value: true,
                                writable: false
                            });
                            currentFrame.iframe.contentDocument.dispatchEvent(visibilityEvent);
                        }
                    }
                    this.lose_focus_text_box(SOUTH);
                }
                this.focused_text_name = new_name;
                
                // Get the category and find corresponding frame
                const category = incoming_name.substring(found_index + 1);
                const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${category}`);
                
                if(FLAGS.SELECT_LOGS) {
                    console.log('Frame lookup:', {
                        category,
                        frameKey: `${TYPES.TEXT_BLOCK}${category}`,
                        frameFound: !!frame,
                        frameWindow: frame?.iframe?.contentWindow ? 'exists' : 'missing',
                        hasAnimation: frame?.iframe?.contentWindow?.trigger_frame_animation ? 'yes' : 'no'
                    });
                }

                // Trigger frame animation
                if (frame && frame.iframe.contentWindow && 
                    typeof frame.iframe.contentWindow.trigger_frame_animation === 'function') {
                    frame.iframe.contentWindow.trigger_frame_animation();
                }
            }
            // Get and move text box
            const selected_text_box = this.text_box_container.getObjectByName(this.focused_text_name);
            if(FLAGS.LAYER){
                this.set_content_layer(this.focused_text_name, 0);
            }
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
                    const determined_speed = PAN_SPEED * .2;
                    switch(move_direction) {
                        case NORTH:
                            new Tween(existing_focus_box.position)
                            .to({ y: move_position }, determined_speed)
                            .easing(Easing.Sinusoidal.Out)
                            .start()
                            .onComplete(() => {
                                if(FLAGS.LAYER){
                                    this.set_content_layer(existing_focus_box.name, 1);
                                }
                                existing_focus_box.position.y = this.get_text_box_y();
                                existing_focus_box.position.x = get_associated_position(WEST, this.camera);
                            });
                            break;
                        case SOUTH:
                            new Tween(existing_focus_box.position)
                            .to({ y: move_position }, determined_speed)
                            .easing(Easing.Sinusoidal.Out)
                            .start()
                            .onComplete(() => {
                                if(FLAGS.LAYER){
                                    this.set_content_layer(existing_focus_box.name, 1);
                                }
                                existing_focus_box.position.y = this.get_text_box_y();
                                existing_focus_box.position.x = 2 * get_associated_position(WEST, this.camera);
                            });
                            break;
                        case EAST:
                            new Tween(existing_focus_box.position)
                            .to({ x: move_position }, determined_speed)
                            .easing(Easing.Sinusoidal.Out)
                            .start()
                            .onComplete(() => {
                                if(FLAGS.LAYER){
                                    this.set_content_layer(existing_focus_box.name, 1);
                                }
                                existing_focus_box.position.x = (get_associated_position(WEST, this.camera))
                            });
                            break;
                        case WEST:
                            new Tween(existing_focus_box.position)
                            .to({ x: move_position }, determined_speed)
                            .easing(Easing.Sinusoidal.Out)
                            .start().onComplete(() => {
                                if(FLAGS.LAYER){
                                    this.set_content_layer(existing_focus_box.name, 1);
                                }
                            });                        
                            break;
                    }
                }
                // Lose focus on box
                this.focused_text_name = "";
            }
        }
    }

    resize() {
        this.container_width = this.get_text_box_width(this.camera);
        this.container_height = this.get_text_box_height(this.camera);
        const new_text_geometry = new THREE.BoxGeometry(this.container_width, this.container_height, 0);
        this.text_box_container.children.forEach(c => {
            c.children.forEach(inner_c => {
                if (!inner_c || !inner_c.name) return;
                const type = extract_type(inner_c);
                switch(type) {
                    case TYPES.BACKGROUND:
                        inner_c.geometry.dispose();
                        inner_c.geometry = new_text_geometry;
                        break;
                    case IFRAME:
                        if (inner_c.simple_name) {
                            this.update_iframe_size(inner_c.simple_name, this.container_width, this.container_height);
                        }
                        break;
                }
            })
        });
    }

    update_iframe_size(incoming_simple_name, incoming_width, incoming_height) {
        const matched_frame = Array.from(this.text_frames.values()).find(frame => (frame.simple_name == incoming_simple_name));
        if(matched_frame) {
            matched_frame.update_size(incoming_width, incoming_height);
        }
    }

    reposition(is_column_left) {
        if(this.focused_text_name != ""){
            this.focus_text_box(this.focused_text_name, is_column_left);
        }
        this.text_box_container.children.forEach(c => {
            if(c.name != this.focused_text_name) {
                c.position.x = get_associated_position(WEST, this.camera) * 2;
                c.position.y = this.get_text_box_y(this.camera);
            }
        });
    }

    offscreen_reposition() {
        this.text_box_container.children.forEach(c => {
            c.position.x = -(this.container_width * 3);
            c.position.y = this.get_text_box_y(this.camera);
        })
    }

    set_content_layer(incoming_object_name, incoming_layer) {
        const existing_object = this.text_box_container.getObjectByName(incoming_object_name);
        existing_object.children.forEach(c => {
            c.layers.set(incoming_layer);
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

    /** Returns if there is an active text box or not */
    is_text_box_active() {
        return this.focused_text_name != "";
    }

    /** Returns active text box */
    get_active_text_box() {
        return this.text_box_container.getObjectByName(this.focused_text_name);
    }

    trigger_overlay(is_overlay_hidden, tween_map) {
        const current_pos = this.text_box_container.position.clone();
        const target_y = is_overlay_hidden ? get_associated_position(SOUTH, this.camera) : this.get_text_box_y();
        
        if(FLAGS.TWEEN_LOGS) {
            console.log(`Text Container - Starting overlay animation:
                Hidden: ${is_overlay_hidden}
                Current Position: (${current_pos.x.toFixed(2)}, ${current_pos.y.toFixed(2)}, ${current_pos.z.toFixed(2)})
                Target Y: ${target_y.toFixed(2)}
                Map Size: ${tween_map.size}`);
        }
        
        if(!is_overlay_hidden && FLAGS.LAYER) {
            this.set_content_layer(0);
        }
        
        const new_tween = new Tween(this.text_box_container.position)
            .to({ y: target_y }, 680)
            .easing(Easing.Elastic.InOut)
            .start()
            .onComplete(() => {
                const final_pos = this.text_box_container.position.clone();
                if(FLAGS.TWEEN_LOGS) {
                    console.log(`Text Container - Completed overlay animation:
                        Hidden: ${is_overlay_hidden}
                        Final Position: (${final_pos.x.toFixed(2)}, ${final_pos.y.toFixed(2)}, ${final_pos.z.toFixed(2)})`);
                }
                this.current_tween = null;
                if(is_overlay_hidden && FLAGS.LAYER) {
                    this.set_content_layer(1);
                }
                tween_map.delete(this.text_box_container.name);
            });
        tween_map.set(this.text_box_container.name, new_tween); 
    }
}