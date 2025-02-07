import * as THREE from 'three';
import { OverlayContainer } from "./overlay/overlay_container";
import { MouseBall } from '../background/mouse_ball';
import { get_intersect_list, TYPES } from './overlay/common';
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
                this.overlay_container.reposition(this.overlay_container.is_label_column_left_side());
            }
        });
        
        this.mouse_ball = new MouseBall(this.viewable_ui_container, this.world, RAPIER);
        this.viewable_ui_container.add(this.camera);
        // this.viewable_ui_container.rotation.x = -0.261799;
        this.parent.add(this.viewable_ui_container);
        // Add mouse button event listeners
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.leftMouseDown = true;
            if (e.button === 2) this.rightMouseDown = true;
            // If left and right mouse button held down while overlay is hidden
            if (this.leftMouseDown && this.rightMouseDown && this.mouse_ball.enabled) {
                this.detect_rotation = true;
            }
        });
        // Add event listener for lifting the mouse button
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.detect_rotation = false;
                this.leftMouseDown = false;
            };
            if (e.button === 2) {
                this.detect_rotation = false;
                this.rightMouseDown = false;
            };
        });
        // Prevent context menu from appearing on right click
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if(this.detect_rotation) {
                const sensitivity = 0.02;  // Reduced sensitivity since we're not dividing by 1000 anymore
                this.camera_controller.rotate(
                    e.movementX * sensitivity,
                    e.movementY * sensitivity
                );
            }
        });
    }

    handle_movement(e, incoming_camera = null) {
        const used_camera = incoming_camera == null ? this.get_camera() : incoming_camera;
        // Handle mouseball
        this.mouse_ball.handle_movement(e, used_camera);
        // Handle UI
        const found_intersections = get_intersect_list(e, used_camera, this.parent);
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

    trigger_overlay() {
        this.get_overlay().trigger_overlay();
        this.mouse_ball.enabled = !this.mouse_ball.enabled;
        this.toggle_mouse_ball(this.mouse_ball.enabled);
    }

    // ViewableUI getters
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
}