import * as THREE from 'three';
import { OverlayContainer } from "./overlay/overlay_container";

export const UI_Z_DIST = 15;

export class ViewableUI {
    overlay_container;

    constructor(incoming_parent) {
        this.viewable_ui_container = new THREE.Object3D();
        this.parent = incoming_parent;
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
        this.viewable_ui_container.add(this.camera);
        this.viewable_ui_container.position.z = UI_Z_DIST;
        // this.viewable_ui_container.rotation.x = -0.261799;
        incoming_parent.add(this.viewable_ui_container);
        // Overlay creation
        this.overlay_container = new OverlayContainer(this.viewable_ui_container, this.get_camera());
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