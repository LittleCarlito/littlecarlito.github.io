import { OverlayContainer } from "./overlay/overlay_container";
import { extract_type, TYPES, WEST} from './overlay/overlay_common';
import { CameraManager } from './camera_manager';
import { THREE } from "../common";
import { FLAGS } from "../common";

export const UI_Z_DIST = 25;

export class ViewableContainer {
    detect_rotation = false;
    overlay_container;
    leftMouseDown = false;
    rightMouseDown = false;
    camera_manager;

    constructor(incoming_parent, incoming_world) {
        this.viewable_container_container = new THREE.Object3D();
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
        
        // Initialize camera manager
        this.camera_manager = new CameraManager(this.camera, UI_Z_DIST);
        
        // Create overlay and connect it to camera manager
        this.overlay_container = new OverlayContainer(this.viewable_container_container, this.get_camera());
        this.camera_manager.set_overlay_container(this.overlay_container);
        
        // Add callback for camera updates
        this.camera_manager.add_update_callback(() => {
            if (this.overlay_container) {
                this.overlay_container.resize_reposition_offscreen();
            }
        });
        this.viewable_container_container.add(this.camera);
        // this.viewable_container_container.rotation.x = -0.261799;
        this.parent.add(this.viewable_container_container);
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
                const object_name = intersected_object.name;
                const name_type = extract_type(intersected_object);
                switch(name_type) {
                    case TYPES.LABEL:
                        if(FLAGS.SELECT_LOGS) {
                            console.log(object_name, "clicked up");
                        }
                        this.reset_hover();
                        this.swap_sides();
                        this.focus_text_box(object_name);
                        break;
                    case TYPES.HIDE:
                        this.trigger_overlay();
                        break;
                    case TYPES.LINK:
                        this.open_link(object_name.split("_")[1].trim());
                        break;
                }
            }
        // Column is right
        } else {
            if(found_intersections.length > 0) {
                const intersected_object = found_intersections[0].object;
                const object_name = intersected_object.name;
                const name_type = extract_type(intersected_object);
                switch(name_type) {
                    case TYPES.LABEL:
                        if(FLAGS.SELECT_LOGS) {
                            console.log(object_name, "clicked up");
                        }
                        this.focus_text_box(object_name);
                        break;
                    case TYPES.LINK:
                        this.open_link(object_name.split("_")[1].trim());
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

    handle_mouse_down(found_intersections) {
        if(found_intersections.length > 0) {
            const intersected_object = found_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = extract_type(intersected_object);
            switch(name_type) {
                case TYPES.LABEL:
                    if(FLAGS.SELECT_LOGS) {
                        console.log(object_name, "clicked down");
                    }
                    break;
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
        return this.get_overlay().is_label_container_left_side();
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

    get_camera_manager() {
        return this.camera_manager;
    }

    get_overlay() {
        return this.overlay_container;
    }

    get_active_name() {
        return this.overlay_container.get_active_box().name;
    }

    get_viewable_container() {
        return this.viewable_container_container;
    }

    get_intersected_name() {
        return this.get_overlay().intersected_name();
    }
}