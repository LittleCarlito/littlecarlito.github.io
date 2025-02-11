import * as THREE from 'three';
import { OverlayContainer } from "./overlay/overlay_container";
// import { MouseBall } from '../background/mouse_ball';
import { extract_type, FLAGS, get_intersect_list, TYPES, WEST} from './overlay/common';
import { CameraController } from './camera_controller';

export const UI_Z_DIST = 25;

export class ViewableUI {
    detect_rotation = false;
    overlay_container;
    // mouse_ball;
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
        this.camera_controller.set_overlay_container(this.overlay_container);
        
        // Add callback for camera updates
        this.camera_controller.add_update_callback(() => {
            if (this.overlay_container) {
                this.overlay_container.resize_reposition_offscreen();
            }
        });
        // Create mouse ball for world interaction
        // this.mouse_ball = new MouseBall(this.camera, this.world, RAPIER, this.camera);
        this.viewable_ui_container.add(this.camera);
        // this.viewable_ui_container.rotation.x = -0.261799;
        this.parent.add(this.viewable_ui_container);
        // Add mouse button event listeners
    }

    // ----- Functions

    swap_sides() {
        this.get_overlay().swap_column_sides();
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

    /** Resets the MouseBall size and intersection plane according to window size */
    // reset_mouseball() {
        // if (this.mouse_ball && this.mouse_ball.mouse_mesh) {
            // Store current position
            // const last_position = this.mouse_ball.mouse_mesh.position.clone();
            // Update position directly without triggering physics
            // this.mouse_ball.mouse_mesh.position.copy(last_position);
            // if (this.mouse_ball.mouse_rigid) {
            //     this.mouse_ball.mouse_rigid.setTranslation(last_position);
            // }
        // }
    // }

    // update_mouse_ball() {
    //     this.mouse_ball.update();
    // }

    // increase_mouse_ball_z() {
    //     this.mouse_ball.increase_z();
    // }

    // decrease_mouse_ball_z() {
    //     this.mouse_ball.decrease_z();
    // }

    // toggle_mouse_ball(enabled) {
    //     if(FLAGS.LAYER){
    //         if (enabled) {
    //             this.mouse_ball.enabled = true;
    //             this.camera.layers.enable(2);
    //             this.mouse_ball.toggle_physics(true);
    //         } else {
    //             this.mouse_ball.enabled = false;
    //             this.camera.layers.disable(2);
    //             this.mouse_ball.toggle_physics(false);
    //         }
    //     }
    // }

    resize_reposition() {
        if(this.is_overlay_hidden()){
            this.get_overlay().resize_reposition_offscreen();
        } else {
            this.get_overlay().resize_reposition();
        }
    }

    trigger_overlay() {
        this.get_overlay().trigger_overlay();
        // this.mouse_ball.enabled = !this.mouse_ball.enabled;
        // this.toggle_mouse_ball(this.mouse_ball.enabled);
    }

    // ----- Getters

    is_column_left_side() {
        return this.get_overlay().is_label_column_left_side();
    }

    is_text_active() {
        return this.overlay_container.is_text_active();
    }

    is_overlay_hidden() {
        return this.get_overlay().hide_button.is_overlay_hidden;
    }

    get_hide_transition_map() {
        return this.get_overlay().hide_transition_map;
    }

    get_camera() {
        return this.camera;
    }

    get_camera_controller() {
        return this.camera_controller;
    }

    get_overlay() {
        return this.overlay_container;
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

    // get_mouse_ball() {
    //     return this.mouse_ball;
    // }
}