import * as THREE from 'three';
import { Easing, Tween } from 'tween';
import { get_screen_size, get_associated_position, WEST } from "./screen";

const texture_loader = new THREE.TextureLoader();
export const CONATINER = "container_";
export const LABEL = "label_";
const ROTATE_SPEED = 300;
// TODO Get this to shared variable with text_container
export const PAN_SPEED = 800;
// Icons
const icon_paths = [
    "contact_raised.svg",
    "projects_raised.svg",
    "work_raised.svg",
    "education_raised.svg",
    "about_raised.svg",
];
export const icon_labels = [
    "contact",
    "projects",
    "work",
    "education",
    "about"
];
export const icon_colors = [
    0xe5ce38,
    0x834eb4,
    0xb44444,
    0x25973a,
    0x3851e5
];

export class LabelColumn {
    swapping_column_sides = false;
    is_column_left = true;

    constructor(incoming_scene, incoming_camera) {
        this.scene = incoming_scene;
        this.camera = incoming_camera;

        this.container_column = new THREE.Object3D();
        this.container_column.name = `${CONATINER}column`
        this.scene.add(this.container_column);
        // Create section labels
        for (let i = 0; i < icon_paths.length; i++) {
            const button_container = new THREE.Object3D();
            button_container.name = `${CONATINER}${icon_labels[i]}`
            this.container_column.add(button_container);
            const button_texture = texture_loader.load(icon_paths[i]);
            button_texture.colorSpace = THREE.SRGBColorSpace;
            const button_option = new THREE.Mesh(
                // TODO Get demensions to constants
                new THREE.BoxGeometry(5, 3, 0),
                new THREE.MeshBasicMaterial({
                    map: button_texture,
                    transparent: true
                }));
            button_option.name = `${LABEL}${icon_labels[i]}`
            button_option.position.y = i * 3;
            button_container.add(button_option);
        }
        this.container_column.position.x = this.get_column_x_position(incoming_camera, true);
        this.container_column.position.y = this.get_column_y_position(incoming_camera, true);
        this.container_column.rotation.y = this.get_column_y_rotation(true);
    }

    trigger_overlay(is_overlay_hidden, incoming_camera) {
        const container_column_x = is_overlay_hidden ? get_associated_position(WEST, incoming_camera) : this.get_column_x_position(incoming_camera, true);
        new Tween(this.container_column.position)
        .to({ x: container_column_x })
        .easing(Easing.Elastic.InOut)
        .start();  
    }

    swap_sides(incoming_camera) {
        this.is_column_left = !this.is_column_left;
        const x_position = this.get_column_x_position(incoming_camera, this.is_column_left);
        const y_position = this.get_column_y_position(incoming_camera, this.is_column_left);
        const y_rotation = this.get_column_y_rotation(this.is_column_left);
        // Move column across the screen
        this.swapping_column_sides = true;
        new Tween(this.container_column.position)
        .to({ x: x_position, y: y_position}, PAN_SPEED)
        .easing(Easing.Elastic.Out)
        .start()
        .onComplete(() => {
            this.swapping_column_sides = false;
        });
        // Rotate the column as it moves
        new Tween(this.container_column.rotation)
        .to({ y: y_rotation}, ROTATE_SPEED)
        .easing(Easing.Exponential.Out)
        .start();
    }

    reposition(incoming_camera) {
            let x_position = this.get_column_x_position(incoming_camera, this.is_column_left);
            // Move button column across the screen
            new Tween(this.container_column.position)
            .to({ x: x_position})
            .easing(Easing.Elastic.Out)
            .start();
    }

    // Column getters
    /** Calculates the x position of the container column given it and the cameras position along with window size */
    get_column_x_position(incoming_camera, is_column_left) {
        return (is_column_left ? -1 : 1) * (get_screen_size(incoming_camera).x / 2) * 0.6;
    }
    
    /** Calculates the y position of the container column given it and the cameras position along with window size */
    get_column_y_position(incoming_camera, is_column_left) {
        return (is_column_left ? -1 : -.6) * (get_screen_size(incoming_camera).y / 2) * 0.6;
    }
    
    /** Calculates the y rotation of the container column given its position along with window size */
    get_column_y_rotation(is_column_left) {
        return (is_column_left ? 1 : -1);
    }
}