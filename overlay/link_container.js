import * as THREE from 'three';
import { get_screen_size, get_associated_position } from "./screen";
import { clamp } from 'three/src/math/MathUtils.js';

export const LINK = "link_"
const LINK_RADIUS = .44;
const texture_loader = new THREE.TextureLoader();

// Links
const link_paths = [
    "github_link.svg",
    "twitch_link.svg",
    "linkedin_link.svg",
    "tiktok_link.svg"
]

const GITHUB = "github";
const TWITCH = "twitch";
const LINKEDIN = "linkedin";
const TIKTOK = "tiktok";
const link_labels = [
    GITHUB,
    TWITCH,
    LINKEDIN,
    TIKTOK
];

const link_urls = new Map();
link_urls.set(GITHUB, "https://github.com/blooooork");
link_urls.set(TWITCH, "https://www.twitch.tv/blooooork");
link_urls.set(LINKEDIN, "https://www.linkedin.com/in/meiersteven");
link_urls.set(TIKTOK, "https://www.tiktok.com/@blooooork");

export class LinkContainer {
    constructor(incoming_scene, incoming_camera) {
        this.scene = incoming_scene;
        this.camera = incoming_camera;
        this.link_container = new THREE.Object3D();
        this.link_container.position.x =  this.get_link_container_x(incoming_camera);
        this.link_container.position.y = this.get_link_container_y(incoming_camera);
        this.scene.add(this.link_container);
        // Create the link icons
        const calced_radius = this.get_link_radius(incoming_camera);
        for(let l = 0; l < link_paths.length; l++) {
            const circle_geometry = new THREE.CircleGeometry(calced_radius);
            const circle_texture = texture_loader.load(link_paths[l]);
            circle_texture.colorSpace = THREE.SRGBColorSpace;
            const link_button = new THREE.Mesh(
                circle_geometry,
                new THREE.MeshBasicMaterial({
                    map: circle_texture,
                    transparent: true
                }));
            link_button.name = `${LINK}${link_labels[l]}`;
            link_button.position.x += calced_radius * (3.5 * l);
            this.link_container.add(link_button);
        }
    }

    /** Open a new tab of the associated link */
    open_link(new_link) {
        if(link_urls.has(new_link)) {
            const hyperlink_path = link_urls.get(new_link);
            window.open(hyperlink_path, "_blank");
        } else {
            console.log(`Given label \"${new_link}\" does not have a stored path`);
        }
    }

    trigger_overlay(is_overlay_hidden, incoming_camera) {
        const link_y = is_overlay_hidden ? get_associated_position(SOUTH, incoming_camera) : this.get_link_container_y(incoming_camera);
        new Tween(this.link_container.position)
        .to({ y: link_y }, 680)
        .easing(Easing.Elastic.InOut)
        .start();
    }

    reposition(incoming_camera) {
        new Tween(this.link_container.position)
        .to({ 
            x: get_link_container_x(incoming_camera),
            y: get_link_container_y(incoming_camera)
        })
        .easing(Easing.Elastic.Out)
        .start();
    }

    // Link getters
    /** Calculates the link containers x position based off camera position and window size*/
    get_link_container_x(incoming_camera) {
        return (get_screen_size(incoming_camera).x / 2) - (7);
    }
    
    /** Calculates the link containers y position based off camera position and window size*/
    get_link_container_y(incoming_camera) {
        return -(.4 * get_screen_size(incoming_camera).y);
    }
    
    /** Calculates the links radius based off camera position and window size*/
    get_link_radius(incoming_camera) {
        return clamp(get_screen_size(incoming_camera).x * .02, Number.MIN_SAFE_INTEGER, LINK_RADIUS);
    }
}