import { get_screen_size, get_associated_position, WEST } from "./overlay_common/screen";
import { CATEGORIES } from './overlay_common/categories';
import { TEXTURE_LOADER, TYPES, PAN_SPEED, ROTATE_SPEED, FOCUS_ROTATION } from './overlay_common/index'
import { Easing, FLAGS, THREE, Tween } from '../../common';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { getFontPath } from '../../common/utils/fontUtils.js';

export class LabelContainer {
    in_tween_map = new Map();
    swapping_column_sides = false;
    is_column_left = true;
    current_intersected = null;
    wireframe_boxes = [];
    font_loader = new FontLoader();
    font = null;

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
        
        // Load font first, then create labels
        this.loadFont().then(() => {
            this.createLabels();
        }).catch(error => {
            console.error("Error loading font:", error);
            // Create labels without font if there's an error
            this.createLabels();
        });
        
        this.container_column.position.x = this.get_column_x_position(true);
        this.container_column.position.y = this.get_column_y_position(true);
        this.container_column.rotation.y = this.get_column_y_rotation(true);
    }

    async loadFont() {
        try {
            // Use the utility to determine the correct font path
            const fontPath = getFontPath('quicksand_regular.json');
                
            if (FLAGS.ASSET_LOGS) console.log(`Attempting to load font from: ${fontPath}`);
            
            this.font = await this.font_loader.loadAsync(fontPath);
            if (FLAGS.ASSET_LOGS) console.log('Font loaded successfully');
            return this.font;
        } catch (error) {
            console.error("Error loading font:", error);
            // If font fails to load, we'll fall back to canvas-based text rendering
            return null;
        }
    }

    createLabels() {
        // Create section labels
        Object.values(CATEGORIES).forEach((category, i) => {
            if (typeof category === 'function') return; // Skip helper methods
            
            const button_container = new THREE.Object3D();
            button_container.simple_name = category.value;
            button_container.name = `${TYPES.CONATINER}${category.value}`;
            this.container_column.add(button_container);
            button_container.position.y = i * 3;
            
            // Create text first to measure its width
            let textWidth = 5; // Default width
            if (this.font) {
                // Create temporary geometry just to measure width
                const measureGeometry = new TextGeometry(category.value.toUpperCase(), {
                    font: this.font,
                    size: 1.0,
                    height: 0.1,
                    curveSegments: 12,
                    bevelEnabled: false
                });
                measureGeometry.computeBoundingBox();
                textWidth = Math.max(5, measureGeometry.boundingBox.max.x - measureGeometry.boundingBox.min.x + 1);
                measureGeometry.dispose(); // Clean up temporary geometry
            }
            
            // Create invisible collision box with width matching the text
            const boxGeometry = new THREE.BoxGeometry(textWidth, 3, 0.2);
            const collisionMaterial = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                colorWrite: false,
                depthWrite: false,
                depthTest: false
            });
            
            const collisionBox = new THREE.Mesh(boxGeometry, collisionMaterial);
            collisionBox.simple_name = category.value;
            collisionBox.name = `${TYPES.LABEL}${category.value}_collision`;
            button_container.add(collisionBox);
            
            // Add wireframe box for visual debugging
            if (FLAGS.COLLISION_VISUAL_DEBUG) {
                const wireframe_material = new THREE.MeshBasicMaterial({
                    color: this.wireframe_colors[category.value] || 0xffffff,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7,
                    depthTest: false
                });
                // Use the same geometry instance for perfect alignment
                const wireframe_box = new THREE.Mesh(boxGeometry, wireframe_material);
                wireframe_box.raycast = () => null; // Disable raycasting
                wireframe_box.visible = true;
                button_container.add(wireframe_box);
                this.wireframe_boxes.push(wireframe_box);
            }
            
            // Create text if font is loaded
            if (this.font) {
                // Create text geometry for the category name
                const textGeometry = new TextGeometry(category.value.toUpperCase(), {
                    font: this.font,
                    size: 1.0,
                    height: 0.1,
                    curveSegments: 12,
                    bevelEnabled: false
                });
                
                // Center the text geometry
                textGeometry.computeBoundingBox();
                const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
                const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
                
                // Create material with the category color
                const textMaterial = new THREE.MeshBasicMaterial({
                    color: category.color,
                    transparent: true,
                    depthTest: false
                });
                
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.simple_name = category.value;
                textMesh.name = `${TYPES.LABEL}${category.value}`;
                
                // Center the text
                textMesh.position.set(-textWidth/2, -textHeight/2, 0.1);
                textMesh.renderOrder = 2; // Ensure text renders on top
                button_container.add(textMesh);
            } else {
                // Fallback to using a text canvas if font failed to load
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 64;
                context.font = 'Bold 40px Arial';
                context.fillStyle = '#' + category.color.toString(16).padStart(6, '0');
                context.textAlign = 'center';
                context.fillText(category.value.toUpperCase(), 128, 44);
                
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    depthTest: false
                });
                
                const geometry = new THREE.PlaneGeometry(4, 1);
                const textMesh = new THREE.Mesh(geometry, material);
                textMesh.simple_name = category.value;
                textMesh.name = `${TYPES.LABEL}${category.value}`;
                textMesh.position.z = 0.1;
                textMesh.renderOrder = 2;
                button_container.add(textMesh);
            }
        });
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
        // Reset any hover state when swapping sides to prevent hover issues
        this.reset_previous_intersected();
        
        this.is_column_left = !this.is_column_left;
        const x_position = this.get_column_x_position(this.is_column_left);
        const y_position = this.get_column_y_position(this.is_column_left);
        const y_rotation = this.get_column_y_rotation(this.is_column_left);
        
        if (FLAGS.ROTATION_TWEEN_LOGS) {
            console.log(`[RotationTween] Swapping sides to ${this.is_column_left ? 'left' : 'right'}`);
        }
        
        // Move column across the screen
        this.swapping_column_sides = true;
        new Tween(this.container_column.position)
        .to({ x: x_position, y: y_position}, PAN_SPEED)
        .easing(Easing.Elastic.Out)
        .start()
        .onComplete(() => {
            this.swapping_column_sides = false;
            if (FLAGS.ROTATION_TWEEN_LOGS) {
                console.log('[RotationTween] Swap sides complete');
            }
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
        const x_position = get_associated_position(WEST, this.camera);
        // Move button column across the screen with animation
        new Tween(this.container_column.position)
            .to({ x: x_position })
            .easing(Easing.Elastic.Out)
            .start();
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
            console.log(`[RotationTween] Is column left: ${this.is_column_left}`);
        }

        // Don't process hovers while swapping sides
        if (this.swapping_column_sides) {
            if (FLAGS.ROTATION_TWEEN_LOGS) {
                console.log('[RotationTween] Ignoring hover while swapping sides');
            }
            return;
        }

        // Check if this is a collision box
        let target_object = intersected_object;
        let container = intersected_object.parent;
        
        if (intersected_object.name.includes('_collision')) {
            // Find the actual label in the same container
            container.children.forEach(child => {
                if (child.name && child.name.startsWith(TYPES.LABEL) && !child.name.includes('_collision')) {
                    target_object = child;
                }
            });
        }
        
        // Check if tween exists for this object already
        const object_name = target_object.name;
        let in_tween = this.in_tween_map.get(object_name);
        
        if(in_tween == null) {
            // Only change hover if we're hovering over a different element
            // This prevents hover state from being reset on the same element
            if(this.current_intersected !== target_object) {
                // Reset previously intersected object if one existed
                this.reset_previous_intersected();
                
                // Set intersected object to current
                this.current_intersected = target_object;
                
                // Show the corresponding wireframe
                if (FLAGS.COLLISION_VISUAL_DEBUG) {
                    container.children.forEach(child => {
                        if (child.material && child.material.wireframe) {
                            // Don't change visibility here since they should always be visible when debug is on
                        }
                    });
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
                        console.log(`[RotationTween] Tween complete for ${object_name}. Final rotation:`, target_object.rotation.y);
                    }
                    // Explicitly set the rotation to ensure it reached the target value
                    target_object.rotation.y = final_rotation;
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
            
            // Hide the corresponding wireframe
            if (FLAGS.COLLISION_VISUAL_DEBUG) {
                // Find the parent container
                const container = object_to_reset.parent;
                if (container) {
                    // Don't hide wireframes anymore - they should stay visible
                }
            }
            
            // Stop any existing animation
            const existing_tween = this.in_tween_map.get(object_to_reset.name);
            if (existing_tween) {
                existing_tween.stop();
                this.in_tween_map.delete(object_to_reset.name);
            }
            
            // Reset to default rotation
            let deselected_rotation = 0;
            const reset_tween = new Tween(object_to_reset.rotation)
            .to({ y: deselected_rotation}, 400)
            .easing(Easing.Elastic.Out)
            .start()
            .onComplete(() => {
                if (FLAGS.ROTATION_TWEEN_LOGS) {
                    console.log(`[RotationTween] Reset complete for ${object_to_reset.name}. Final rotation:`, object_to_reset.rotation.y);
                }
                // Explicitly set rotation to ensure it reached the target value
                object_to_reset.rotation.y = deselected_rotation;
            });
            
            // Clear the current intersected reference
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
        if (FLAGS.COLLISION_VISUAL_DEBUG) {
            // If we have no wireframe boxes and debug is enabled, create them
            if (this.wireframe_boxes.length === 0) {
                // Create wireframes for each category container
                this.container_column.children.forEach(button_container => {
                    if (!button_container.name.startsWith(TYPES.CONATINER)) return;
                    
                    // Find the collision box to match its dimensions
                    const collisionBox = button_container.children.find(child => 
                        child.name && child.name.includes('_collision')
                    );
                    
                    if (collisionBox) {
                        const wireframe_material = new THREE.MeshBasicMaterial({
                            color: this.wireframe_colors[button_container.simple_name] || 0xffffff,
                            wireframe: true,
                            transparent: true,
                            opacity: 0.7,
                            depthTest: false
                        });
                        // Use the collision box's geometry for perfect matching
                        const wireframe_box = new THREE.Mesh(collisionBox.geometry, wireframe_material);
                        wireframe_box.raycast = () => null; // Disable raycasting
                        wireframe_box.visible = true;
                        button_container.add(wireframe_box);
                        this.wireframe_boxes.push(wireframe_box);
                    }
                });
            }
        }

        // Update visibility of existing wireframes
        if (this.wireframe_boxes.length > 0) {
            // Set visibility based on debug flag
            this.wireframe_boxes.forEach(box => {
                box.visible = FLAGS.COLLISION_VISUAL_DEBUG;
            });
        }
    }
}