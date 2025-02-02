import * as THREE from 'three';
import { OverlayContainer } from "./overlay/overlay_container";

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
        this.viewable_ui_container.position.z = 15;
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

    get_viewable_container() {
        return this.viewable_ui_container;
    }
}