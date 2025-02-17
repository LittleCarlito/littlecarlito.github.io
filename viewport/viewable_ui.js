import { OverlayContainer } from "./overlay/overlay_container";
import { extract_type, TYPES, WEST} from './overlay/overlay_common';
import { CameraController } from './camera_controller';
import { THREE } from "../common";

export const UI_Z_DIST = 25;

export class ViewableUI {
    detect_rotation = false;
    overlay_container;
    leftMouseDown = false;
    rightMouseDown = false;
    camera_controller;

    constructor(incoming_parent, incoming_world) {
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

    resize_reposition() {
        if(this.is_overlay_hidden()){
            this.get_overlay().resize_reposition_offscreen();
        } else {
            this.get_overlay().resize_reposition();
        }
    }

    trigger_overlay() {
        this.get_overlay().trigger_overlay();
    }
    
    handle_mouse_up(found_intersections){
        if(this.is_column_left_side()){
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
    }

    // ----- Getters

    is_primary_triggered() {
        return this.get_overlay().primary_control_trigger;
    }

    is_secondary_triggered() {
        return this.get_overlay().secondary_control_trigger;
    }

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
}