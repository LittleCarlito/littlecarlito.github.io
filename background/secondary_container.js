import { THREE } from "../common";

export class SecondaryClass {
    parent;
    camera;
    world;
    object_container;
    dynamic_bodies = [];

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
    }
}