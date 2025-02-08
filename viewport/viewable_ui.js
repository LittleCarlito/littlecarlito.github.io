import * as THREE from 'three';
import { OverlayContainer } from "./overlay/overlay_container";
import { MouseBall } from '../background/mouse_ball';
import { extract_type, get_intersect_list, TYPES, WEST} from './overlay/common';
import { CameraController } from './camera_controller';

export const UI_Z_DIST = 15;

export class ViewableUI {
    detect_rotation = false;
    overlay_container;
    mouse_ball;
    leftMouseDown = false;
    rightMouseDown = false;
    camera_controller;

    constructor(incoming_parent, incoming_world, RAPIER) {
        this.viewable_ui_container = new THREE.Object3D();
        this.parent = incoming_parent;
        this.world = incoming_world;
        this.camera = new THREE.PerspectiveCamera(
            // FOV
            75,
            // Aspect ratio
            window.innerWidth/window.innerHeight,
            // Near clipping
            0.1,
            // Far clipping
            1000
        );
        
        // Initialize camera controller
        this.camera_controller = new CameraController(this.camera, UI_Z_DIST);
        
        // Create overlay and connect it to camera controller
        this.overlay_container = new OverlayContainer(this.viewable_ui_container, this.get_camera());
        this.camera_controller.setOverlayContainer(this.overlay_container);
        
        // Add callback for camera updates
        this.camera_controller.addUpdateCallback(() => {
            if (this.overlay_container) {
                this.overlay_container.resize_reposition();
            }
        });
        
        this.mouse_ball = new MouseBall(this.viewable_ui_container, this.world, RAPIER);
        this.viewable_ui_container.add(this.camera);
        // this.viewable_ui_container.rotation.x = -0.261799;
        this.parent.add(this.viewable_ui_container);
        // Add mouse button event listeners
        window.addEventListener('mousedown', this.handle_mouse_down.bind(this));
        // Add event listener for lifting the mouse button
        window.addEventListener('mouseup', this.handle_mouse_up.bind(this));
        // Prevent context menu from appearing on right click
        window.addEventListener('contextmenu', this.handle_context_menu.bind(this));
        window.addEventListener('mousemove', this.handle_mouse_move.bind(this));
    }

    // ----- Functions

    handle_context_menu = (e) => {
        e.preventDefault();
    }

    handle_mouse_up = (e) => {
        // Intersection detection and handling
        const found_intersections = get_intersect_list(e, this.get_camera(), this.parent);
        if( this.is_column_left_side()){
            if(found_intersections.length > 0){
                const intersected_object = found_intersections[0].object;
                if(intersected_object.name != null) {
                    (console.log(`${intersected_object.name} clicked up`));
                }
                const split_intersected_name = intersected_object.name.split("_");
                const name_type = extract_type(intersected_object);
                switch(name_type) {
                    case TYPES.LABEL:
                        this.reset_hover();
                        this.swap_sides();
                        this.focus_text_box(intersected_object.name);
                        break;
                    case TYPES.HIDE:
                        this.trigger_overlay();
                        break;
                    case TYPES.LINK:
                        this.open_link(split_intersected_name[1].trim());
                        break;
                }
            }
        // Column is right
        } else {
            if(found_intersections.length > 0) {
                const intersected_object = found_intersections[0].object;
                const name_type = extract_type(intersected_object);
                const split_intersected_name = intersected_object.name.split("_");
                switch(name_type) {
                    case TYPES.LABEL:
                        this.focus_text_box(intersected_object.name);
                        break;
                    case TYPES.LINK:
                        this.open_link(split_intersected_name[1].trim());
                        break;
                    default:
                        this.swap_sides();
                        this.lose_focus_text_box(WEST);
                }
            } else {
                this.swap_sides();
                this.lose_focus_text_box(WEST);
            }
        }
        // Camera rotation detection
        if (e.button === 0) {
            this.detect_rotation = false;
            this.leftMouseDown = false;
        };
        if (e.button === 2) {
            this.detect_rotation = false;
            this.rightMouseDown = false;
        };
    }

    handle_mouse_down = (e) => {
        if (e.button === 0) this.leftMouseDown = true;
        if (e.button === 2) this.rightMouseDown = true;
        // If left and right mouse button held down while overlay is hidden
        if (this.leftMouseDown && this.rightMouseDown && this.mouse_ball.enabled) {
            this.detect_rotation = true;
        }
    }

    handle_mouse_move = (e) => {
        if(this.detect_rotation) {
            const sensitivity = 0.02;  // Reduced sensitivity since we're not dividing by 1000 anymore
            this.camera_controller.rotate(
                e.movementX * sensitivity,
                e.movementY * sensitivity
            );
        }
        // Handle mouseball
        this.mouse_ball.handle_movement(e, this.camera);
        // Handle UI
        const found_intersections = get_intersect_list(e, this.camera, this.parent);
        if(found_intersections.length > 0 && ! this.get_overlay().is_swapping_sides()) {
            const intersected_object = found_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = object_name.split("_")[0] + "_";
            // Handle label hover
            switch(name_type) {
                case TYPES.LABEL:
                    this.get_overlay().handle_hover(intersected_object);
                    break;
                case TYPES.FLOOR:
                    this.get_overlay().reset_hover();
                    break;
                default:
                    break;
            }
        } else {
            this.get_overlay().reset_hover();
        }
    }

    swap_sides() {
        this.get_overlay().swap_column_sides();
    }

    is_column_left_side() {
        return this.get_overlay().is_label_column_left_side();
    }

    reset_hover() {
        this.get_overlay().reset_hover();
    }

    focus_text_box(incoming_name) {
        this.get_overlay().focus_text_box(incoming_name);
    }

    open_link(incoming_url) {
        this.get_overlay().open_link(incoming_url);
    }

    lose_focus_text_box(incoming_direction = null) {
        this.get_overlay().lose_focus_text_box(incoming_direction);
    }

    reset_camera() {
        this.get_camera().aspect = window.innerWidth / window.innerHeight;
        this.get_camera().updateProjectionMatrix();
    }

    update_mouse_ball() {
        this.mouse_ball.update();
    }

    increase_mouse_ball_z() {
        this.mouse_ball.increase_z();
    }

    decrease_mouse_ball_z() {
        this.mouse_ball.decrease_z();
    }

    toggle_mouse_ball(enabled) {
        if (enabled) {
            this.camera.layers.enable(2);
            this.mouse_ball.toggle_physics(true);
        } else {
            this.camera.layers.disable(2);
            this.mouse_ball.toggle_physics(false);
        }
    }

    resize_reposition() {
        this.get_overlay().resize_reposition();
    }

    trigger_overlay() {
        this.get_overlay().trigger_overlay();
        this.mouse_ball.enabled = !this.mouse_ball.enabled;
        this.toggle_mouse_ball(this.mouse_ball.enabled);
    }

    // ----- Getters

    get_camera() {
        return this.camera;
    }

    get_overlay() {
        return this.overlay_container;
    }

    is_text_active() {
        return this.overlay_container.is_text_active();
    }

    get_active_name() {
        return this.overlay_container.get_active_box().name;
    }

    get_viewable_container() {
        return this.viewable_ui_container;
    }

    get_intersected_name() {
        return this.get_overlay().intersected_name();
    }
}