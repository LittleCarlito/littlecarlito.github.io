import { get_screen_size, get_associated_position, WEST } from "./overlay_common/screen";
import { CATEGORIES } from './overlay_common/categories';
import { TEXTURE_LOADER, TYPES, PAN_SPEED, ROTATE_SPEED, FOCUS_ROTATION } from './overlay_common/index'
import { Easing, FLAGS, THREE, Tween } from '../../common';

export class LabelContainer {
    in_tween_map = new Map();
    swapping_column_sides = false;
    is_column_left = true;
    current_intersected = null;
    wireframe_boxes = [];

    // Define colors for wireframes - high visibility versions of category colors
    wireframe_colors = {
        contact: 0xffff55,    // bright yellow
        project: 0xff55ff,    // bright purple
        work: 0xff5555,       // bright red
        education: 0x55ff55,  // bright green
        about: 0x5555ff       // bright blue
    };

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
            button_container.simple_name = category.value;
            button_container.name = `${TYPES.CONATINER}${category.value}`
            this.container_column.add(button_container);
            const button_texture = TEXTURE_LOADER.load(category.icon);
            button_texture.colorSpace = THREE.SRGBColorSpace;
            const button_option = new THREE.Mesh(
                // TODO Get demensions to constants
                new THREE.BoxGeometry(5, 3, 0),
                new THREE.MeshBasicMaterial({
                    map: button_texture,
                    transparent: true,
                    depthTest: false
                }));
            button_option.simple_name = category.value;
            button_option.name = `${TYPES.LABEL}${category.value}`
            button_option.position.y = i * 3;
            button_container.add(button_option);

            // Add wireframe box for visual debugging
            if (FLAGS.LABEL_VISUAL_DEBUG) {
                const wireframe_geometry = new THREE.BoxGeometry(5, 3, 0.2); // Added depth for 3D visualization
                const wireframe_material = new THREE.MeshBasicMaterial({
                    color: this.wireframe_colors[category.value] || 0xffffff, // fallback to white if category not found
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7,
                    depthTest: false
                });
                const wireframe_box = new THREE.Mesh(wireframe_geometry, wireframe_material);
                wireframe_box.raycast = () => null; // Disable raycasting
                button_option.add(wireframe_box);
                this.wireframe_boxes.push(wireframe_box);
            }
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
        if (!intersected_object || !intersected_object.rotation) {
            if (FLAGS.ROTATION_TWEEN_LOGS) {
                console.log('[RotationTween] Invalid hover object received');
            }
            return;
        }

        if (FLAGS.ROTATION_TWEEN_LOGS) {
            console.log(`[RotationTween] Hover detected on object: ${intersected_object.name}`);
            console.log(`[RotationTween] Current rotation: ${JSON.stringify(intersected_object.rotation)}`);
            console.log(`[RotationTween] Swapping sides status: ${this.swapping_column_sides}`);
        }

        // Don't process hovers while swapping sides
        if (this.swapping_column_sides) {
            if (FLAGS.ROTATION_TWEEN_LOGS) {
                console.log('[RotationTween] Ignoring hover while swapping sides');
            }
            return;
        }

        // Check if tween exists for this object already
        const object_name = intersected_object.name;
        let in_tween = this.in_tween_map.get(object_name);
        
        if(in_tween == null) {
            if(this.current_intersected !== intersected_object) {
                // Reset previously intersected object if one existed
                this.reset_previous_intersected();
                
                // Set intersected object to current
                this.current_intersected = intersected_object;
                
                // Show the corresponding static wireframe
                if (FLAGS.LABEL_VISUAL_DEBUG) {
                    const index = parseInt(object_name.replace(/[^0-9]/g, '')) - 1;
                    if (this.wireframe_boxes[index]) {
                        this.wireframe_boxes[index].visible = true;
                    }
                }
                
                // Apply rotation to current
                let final_rotation = this.is_column_left ? -(FOCUS_ROTATION) : (FOCUS_ROTATION);
                
                // Create rotation tween and set it in the map
                in_tween = new Tween(this.current_intersected.rotation)
                .to({ y: final_rotation}, 400)
                .easing(Easing.Sinusoidal.In)
                .start()
                .onComplete(() => {
                    if (FLAGS.ROTATION_TWEEN_LOGS) {
                        console.log(`[RotationTween] Tween complete for ${object_name}. Final rotation:`, intersected_object.rotation.y);
                    }
                    intersected_object.rotation.y = final_rotation;
                    this.in_tween_map.delete(object_name);
                });
                this.in_tween_map.set(object_name, in_tween);
            }
        }
    }

    /** Resets the previous intersected objects orientation */
    reset_previous_intersected() {
        if(this.current_intersected) {
            if (FLAGS.ROTATION_TWEEN_LOGS) {
                console.log(`[RotationTween] Resetting rotation for ${this.current_intersected.name}. Current rotation:`, this.current_intersected.rotation.y);
            }
            const object_to_reset = this.current_intersected;
            
            // Hide the corresponding static wireframe
            if (FLAGS.LABEL_VISUAL_DEBUG) {
                const index = parseInt(object_to_reset.name.replace(/[^0-9]/g, '')) - 1;
                if (this.wireframe_boxes[index]) {
                    this.wireframe_boxes[index].visible = false;
                }
            }
            
            const existing_tween = this.in_tween_map.get(object_to_reset.name);
            if (existing_tween) {
                existing_tween.stop();
                this.in_tween_map.delete(object_to_reset.name);
            }
            
            let deselected_rotation = 0;
            const reset_tween = new Tween(object_to_reset.rotation)
            .to({ y: deselected_rotation}, 400)
            .easing(Easing.Elastic.Out)
            .start()
            .onComplete(() => {
                if (FLAGS.ROTATION_TWEEN_LOGS) {
                    console.log(`[RotationTween] Reset complete for ${object_to_reset.name}. Final rotation:`, object_to_reset.rotation.y);
                }
                object_to_reset.rotation.y = 0;
            });
            
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

    /**
     * Updates the debug visualizations based on the current flag state
     * This ensures wireframes are created if they don't exist and their visibility is updated
     */
    updateDebugVisualizations() {
        // If wireframes don't exist but should be visible, create them
        if (this.wireframe_boxes.length === 0 && FLAGS.LABEL_VISUAL_DEBUG) {
            // Find all button options
            const buttons = [];
            this.container_column.traverse(child => {
                if (child.name && child.name.startsWith(TYPES.LABEL)) {
                    buttons.push(child);
                }
            });
            
            // Create wireframes for each button
            buttons.forEach(button => {
                const wireframe_geometry = new THREE.BoxGeometry(5, 3, 0.2);
                const category = button.simple_name;
                const wireframe_material = new THREE.MeshBasicMaterial({
                    color: this.wireframe_colors[category] || 0xffffff,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7,
                    depthTest: false
                });
                const wireframe_box = new THREE.Mesh(wireframe_geometry, wireframe_material);
                wireframe_box.raycast = () => null; // Disable raycasting
                button.add(wireframe_box);
                this.wireframe_boxes.push(wireframe_box);
            });
            
            console.log(`Created ${this.wireframe_boxes.length} label wireframes`);
        }
        
        // Update visibility of existing wireframes
        if (this.wireframe_boxes.length > 0) {
            // By default, all wireframes are hidden
            this.wireframe_boxes.forEach(box => {
                box.visible = FLAGS.LABEL_VISUAL_DEBUG;
            });
            
            // If we have a current intersected object, make its wireframe visible
            if (FLAGS.LABEL_VISUAL_DEBUG && this.current_intersected) {
                const index = parseInt(this.current_intersected.name.replace(/[^0-9]/g, '')) - 1;
                if (this.wireframe_boxes[index]) {
                    this.wireframe_boxes[index].visible = true;
                }
            }
            
            console.log(`Updated visibility of ${this.wireframe_boxes.length} label wireframes to ${FLAGS.LABEL_VISUAL_DEBUG}`);
        }
    }
}