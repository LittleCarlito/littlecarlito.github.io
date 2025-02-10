import * as THREE from 'three';
import { Easing, Tween } from 'three/examples/jsm/libs/tween.module.js';
import { clamp } from 'three/src/math/MathUtils.js';
import { get_screen_size, get_associated_position, SOUTH, TYPES, LINK_RADIUS, 
    LINKS, TEXTURE_LOADER } from './common';


export class LinkContainer {
    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.link_container = new THREE.Object3D();
        
        // Store initial positions in overlay space
        this.initial_y = -(.4 * get_screen_size(this.camera).y);
        
        this.link_container.position.x = this.get_link_container_x(this.camera);
        this.link_container.position.y = this.initial_y;
        this.parent.add(this.link_container);
        // Create the link icons
        const calced_radius = this.get_link_radius(this.camera);
        Object.values(LINKS).forEach((link, l) => {
            const circle_geometry = new THREE.CircleGeometry(calced_radius);
            const circle_texture = TEXTURE_LOADER.load(link.icon_path);
            circle_texture.colorSpace = THREE.SRGBColorSpace;
            const link_button = new THREE.Mesh(
                circle_geometry,
                new THREE.MeshBasicMaterial({
                    map: circle_texture,
                    transparent: true
                }));
            link_button.name = `${TYPES.LINK}${link.value}`;
            link_button.position.x += calced_radius * (3.5 * l);
            this.link_container.add(link_button);
        });
        this.current_tween = null;
        this.tween_update_count = 0;
    }

    /** Open a new tab of the associated link */
    open_link(new_link) {
        const found_url = LINKS.get_link(new_link);
        if(found_url) {
            window.open(found_url, "_blank");
        } else {
            console.log(`Given label \"${new_link}\" does not have a stored path`);
        }
    }

    trigger_overlay(is_overlay_hidden) {
        if(!is_overlay_hidden) {
            this.set_content_layers(0);
        }
        const target_y = is_overlay_hidden ? get_associated_position(SOUTH, this.camera) : this.initial_y;
        this.current_tween = new Tween(this.link_container.position)
            .to({ y: target_y }, 680)
            .easing(Easing.Elastic.InOut)
            .onComplete(() => {
                this.current_tween = null;
                if(is_overlay_hidden) {
                    this.set_content_layers(1);
                }
            })
            .start();
    }

    reposition() {
        new Tween(this.link_container.position)
        .to({ 
            x: this.get_link_container_x(),
            y: this.get_link_container_y()
        })
        .easing(Easing.Elastic.Out)
        .start();
    }

    offscreen_reposition() {
        this.link_container.position.y = get_associated_position(SOUTH, this.camera)
        this.link_container.position.x = this.get_link_container_x();      
    }

    // Link setters
    set_content_layers(incoming_layer) {
        this.link_container.layers.set(incoming_layer);
        Object.values(LINKS).forEach(link => {
            const link_name = `${TYPES.LINK}${link.value}`;
            const existing_link = this.link_container.getObjectByName(link_name);
            existing_link.layers.set(incoming_layer);
        });
    }

    // Link getters
    /** Calculates the link containers x position based off camera position and window size*/
    get_link_container_x() {
        return (get_screen_size(this.camera).x / 2) - (7);
    }
    
    /** Calculates the link containers y position based off camera position and window size*/
    get_link_container_y() {
        return -(.4 * get_screen_size(this.camera).y);
    }
    
    /** Calculates the links radius based off camera position and window size*/
    get_link_radius() {
        return clamp(get_screen_size(this.camera).x * .02, Number.MIN_SAFE_INTEGER, LINK_RADIUS);
    }
}