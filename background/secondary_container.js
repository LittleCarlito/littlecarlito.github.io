import { NAMES, RAPIER, THREE, TYPES } from "../common";
import { GLTF_LOADER } from "./background_common";

export class SecondaryContainer {
    parent;
    camera;
    world;
    object_container;
    dynamic_bodies = [];

    AXE = {
        scale: 20,
        mass: 1,
        restitution: 1.1,
        position: new THREE.Vector3(0, 0, 0)
    }

    constructor(incoming_parent, incoming_camera, incoming_world) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.object_container = new THREE.Object3D();
        this.parent.add(this.object_container);
        // Axe with physics
        GLTF_LOADER.load("assets/Axe.glb", (loaded_axe) => {
            let created_asset = loaded_axe.scene;
            created_asset.position.z = this.AXE.position.z;
            // Scale up the axes
            created_asset.scale.set(this.AXE.scale, this.AXE.scale, this.AXE.scale);  
            this.parent.add(created_asset);
            // Get geometry for convex hull
            let geometry;
            created_asset.traverse((child) => {
                if (child.isMesh) {
                    child.name = `${TYPES.INTERACTABLE}${NAMES.AXE}`;
                    geometry = child.geometry;
                }
            });
            const points = geometry.attributes.position.array;
            const axe_body = this.world.createRigidBody(
                RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(this.AXE.position.x, this.AXE.position.y, this.AXE.position.z)
                .setCanSleep(false)
            );
            // Create convex hull collider
            const collider_desc = RAPIER.ColliderDesc.convexHull(points)
                .setMass(this.AXE.mass)
                .setRestitution(this.AXE.restitution);
            this.world.createCollider(collider_desc, axe_body);
            // Add axe to dynamic bodies
            this.dynamic_bodies.push([created_asset, axe_body]);
        });
    }

    update() {
        this.dynamic_bodies.forEach(([mesh, body]) => {
            if(body != null) {
                const position = body.translation();
                mesh.position.set(position.x, position.y, position.z);
                const rotation = body.rotation();
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }

    contains_object(incoming_name) {
        this.getNodeChildren().forEach(child => {
            if(child.name == incoming_name) return true;
        })
    }
}