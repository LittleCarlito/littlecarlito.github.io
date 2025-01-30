import * as THREE from 'three';
import { clamp } from 'three/src/math/MathUtils.js';
import { Easing, Tween, update as updateTween } from 'tween';
import {get_screen_size, get_associated_position, WEST, EAST, NORTH, SOUTH, VALID_DIRECTIONS} from "./overlay/screen"
import { TitleBlock } from './overlay/title_block';
import { HIDE, HideButton } from './overlay/hide_button';
import { LINK, LinkContainer } from './overlay/link_container';

// Constants
const PAN_SPEED = 800;
const ROTATE_SPEED = 300;

// Name types
const CONATINER = "container_";
const LABEL = "label_";
const TEXT = "text_";

// Icons
const icon_paths = [
    "contact_raised.svg",
    "projects_raised.svg",
    "work_raised.svg",
    "education_raised.svg",
    "about_raised.svg",
];
const icon_labels = [
    "contact",
    "projects",
    "work",
    "education",
    "about"
];
const icon_colors = [
    0xe5ce38,
    0x834eb4,
    0xb44444,
    0x25973a,
    0x3851e5
];

// Setup
// Mouse detection
const raycaster = new THREE.Raycaster();
const mouse_location = new THREE.Vector2();
// Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    // FOV
    75,
    // Aspect ratio
    window.innerWidth/window.innerHeight,
    // Near clipping
    0.1,
    // Far clipping
    1000
);
// Rendering
const texture_loader = new THREE.TextureLoader();
const renderer = new THREE.WebGLRenderer();
// Function variables
let focused_text_name = "";
const focus_rotation = .7;
let swapping_column_sides = false;
let is_column_left = true;
let resize_move = false;
let zoom_event = false;
let current_intersected = null;
let in_tween_map = new Map();
const container_column = new THREE.Object3D();
const text_box_container = new THREE.Object3D();

// Setup
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

container_column.name = `${CONATINER}column`
scene.add(container_column);

for (let i = 0; i < icon_paths.length; i++) {
    const button_container = new THREE.Object3D();
    button_container.name = `${CONATINER}${icon_labels[i]}`
    container_column.add(button_container);
    const button_texture = texture_loader.load(icon_paths[i]);
    button_texture.colorSpace = THREE.SRGBColorSpace;
    const button_option = new THREE.Mesh(
        new THREE.BoxGeometry(5, 3, 0),
        new THREE.MeshBasicMaterial({
            map: button_texture,
            transparent: true
        }));
    button_option.name = `${LABEL}${icon_labels[i]}`
    button_option.position.y = i * 3;
    button_container.add(button_option);
}

const camera_distance = 15;
camera.position.z = camera_distance;


container_column.position.x = get_column_x_position();
container_column.position.y = get_column_y_position();
container_column.rotation.y = get_column_y_rotation();

const da_sun = new THREE.DirectionalLight(0xffffff, 10);
da_sun.position.set(0, 3, -2);
scene.add(da_sun);

const title_block = new TitleBlock(scene, camera);

// TODO Stop calculating text box by screen size and just make it a size so it scales like icon_buttons above
// Text displays
scene.add(text_box_container);
for (let c = 0; c < icon_paths.length; c++) {
    const found_width = get_text_box_width();
    const found_height = get_text_box_height();
    const box_geometry = new THREE.BoxGeometry(found_width, found_height, .01);
    const box_material = new THREE.MeshBasicMaterial({ color: icon_colors[c] });
    const text_box = new THREE.Mesh(box_geometry, box_material);
    text_box.name = `${TEXT}${icon_labels[c]}`;
    text_box.position.x = get_associated_position(WEST, camera);
    text_box.position.y = get_text_box_y();
    text_box_container.add(text_box);
}

const link_container = new LinkContainer(scene, camera);
const hide_button = new HideButton(scene, camera);

// Functions

// Text box getters
/** Calculates the selected text boxes x position based off camera position and window size */
function get_focused_text_x() {
   return -(get_screen_size(camera).x / 2 * .36)
}

/** Calculates the text boxes y position based off camera position and window size */
function get_text_box_y() {
    return -(get_screen_size(camera).y * 0.05);
}
/** Calculates the text boxes height based off camera position and window size */
function get_text_box_height() {
    return get_screen_size(camera).y * .6;
}

/** Calculates the text boxes width based off camera position and window size */
function get_text_box_width() {
    return clamp(get_screen_size(camera).x * .5, 12, 18);
}

// Column getters
/** Calculates the x position of the container column given it and the cameras position along with window size */
function get_column_x_position() {
    return (is_column_left ? -1 : 1) * (get_screen_size(camera).x / 2) * 0.6;
}

/** Calculates the y position of the container column given it and the cameras position along with window size */
function get_column_y_position() {
    return (is_column_left ? -1 : -.6) * (get_screen_size(camera).y / 2) * 0.6;
}

/** Calculates the y rotation of the container column given its position along with window size */
function get_column_y_rotation() {
    return (is_column_left ? 1 : -1);
}

/** Hides/reveals overlay elements and swaps hide buttons display sprite */
function trigger_overlay() {
    hide_button.swap_hide_status();
    console.log(`is overlay hidden \"${hide_button.is_overlay_hidden}\"`);
    const container_column_x = hide_button.is_overlay_hidden ? get_associated_position(WEST, camera) : get_column_x_position();
    // Hide the overlay
    title_block.trigger_overlay(hide_button.is_overlay_hidden, camera);
    new Tween(container_column.position)
    .to({ x: container_column_x })
    .easing(Easing.Elastic.InOut)
    .start();

    link_container.trigger_overlay(hide_button.is_overlay_hidden, camera);
}

/*** Swaps the container column sides */
function swap_column_sides() {
    is_column_left = !is_column_left;
    let x_position = get_column_x_position();
    let y_position = get_column_y_position();
    let y_rotation = get_column_y_rotation();
    // Move column across the screen
    swapping_column_sides = true;
    new Tween(container_column.position)
    .to({ x: x_position, y: y_position}, PAN_SPEED)
    .easing(Easing.Elastic.Out)
    .start()
    .onComplete(() => {
        swapping_column_sides = false;
    });
    // Rotate the column as it moves
    new Tween(container_column.rotation)
    .to({ y: y_rotation}, ROTATE_SPEED)
    .easing(Easing.Exponential.Out)
    .start();

    // Handle hide button
    hide_button.swap_sides(is_column_left, camera);
}

/** Brings the text box associated with the given name into focus
 ** container column MUST be on the right side
 */
// TODO Get the focused position based off right side of the screen not the left
//          Can tell when resizing that it favors left; Should favor right
function focus_text_box(incoming_name) {
    if(!is_column_left) {
        // Get text box name
        const found_index = incoming_name.indexOf('_');
        const new_name = TEXT + incoming_name.substring(found_index + 1);
        if(new_name != focused_text_name) {
            // If existing focus text box move it
            if(focused_text_name != "") {
                lose_focus_text_box(SOUTH);
            }
            focused_text_name =  new_name;
        }
        // Get and move text box
        const selected_text_box = text_box_container.getObjectByName(focused_text_name);
        new Tween(selected_text_box.position)
        .to({ x: get_focused_text_x() }, 285)
        .easing(Easing.Sinusoidal.Out)
        .start()
    } else {
        lose_focus_text_box(WEST);
    }
}

// Method to tween focused_text_name to offscreen and set to empty string
function lose_focus_text_box(move_direction = "") {
    if(focused_text_name != "") {
        if(move_direction == "" || VALID_DIRECTIONS.includes(move_direction)) {
            const existing_focus_box = text_box_container.getObjectByName(focused_text_name);
            if(move_direction == "") {
                existing_focus_box.position.x = get_associated_position(WEST, camera);
            } else {
                // Tween in given direction off screen
                const previous_position = existing_focus_box.position;
                const move_position = get_associated_position(move_direction, camera);
                switch(move_direction) {
                    case NORTH:
                        new Tween(existing_focus_box.position)
                        .to({ y: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => {
                            existing_focus_box.position.y = get_text_box_y();
                            existing_focus_box.position.x = get_associated_position(WEST, camera);
                        });
                        break;
                    case SOUTH:
                        new Tween(existing_focus_box.position)
                        .to({ y: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => {
                            existing_focus_box.position.y = get_text_box_y();
                            existing_focus_box.position.x = 2 * get_associated_position(WEST, camera);
                        });
                        break;
                    case EAST:
                        new Tween(existing_focus_box.position)
                        .to({ x: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => (
                            existing_focus_box.position.x = (get_associated_position(WEST, camera))
                        ));
                        break;
                    case WEST:
                        new Tween(existing_focus_box.position)
                        .to({ x: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start();                        
                        break;
                }
            }
            // Lose focus on box
            focused_text_name = "";
        }
    }
}

function animate() {
    updateTween();
    if(resize_move){
        if(!zoom_event) {
            let x_position = get_column_x_position();
            // Move button column across the screen
            new Tween(container_column.position)
            .to({ x: x_position})
            .easing(Easing.Elastic.Out)
            .start();
            // Move/resize text box
            const new_text_geometry = new THREE.BoxGeometry(get_text_box_width(), get_text_box_height(), 0);
            if(focused_text_name != ""){
                focus_text_box(focused_text_name);
            }
            text_box_container.children.forEach(c => {
                if(c.name != focused_text_name) {
                    c.position.x = get_associated_position(WEST, camera);
                    c.position.y = get_text_box_y();
                }
                c.geometry.dispose;
                c.geometry = new_text_geometry;
            });
            // Link moving
            link_container.reposition(camera);
            // Title block repositioning
            title_block.resize(camera);
            title_block.reposition();
            // Move hide button
            hide_button.reposition(is_column_left, camera);
            // Overlay is always redisplayed
            if(hide_button.is_overlay_hidden) {
                hide_button.swap_hide_status();
            }
        } else {
            zoom_event = false;
        }
        resize_move = false;
    }
    renderer.render(scene, camera);
}

/** Retrieves objects mouse is intersecting with from the given event */
function get_intersect_list(e) {
    mouse_location.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse_location.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse_location, camera);
    return raycaster.intersectObject(scene, true);
}

/** Handles mouse hovering events and raycasts to collide with scene objects */
function handle_hover(e) {
    const found_intersections = get_intersect_list(e);
    if(found_intersections.length > 0 && !swapping_column_sides) {
        const intersected_object = found_intersections[0].object;
        const object_name = intersected_object.name;
        const name_type = object_name.split("_")[0] + "_";
        if(name_type == LABEL){
            if(current_intersected !== intersected_object) {
                // Reset previously inersected object if one existed
                if(current_intersected){
                    let deselected_rotation = 0;
                    new Tween(current_intersected.rotation)
                    .to({ y: deselected_rotation})
                    .easing(Easing.Elastic.Out)
                    .start();
                }
                // Set intersected object to current
                current_intersected = intersected_object;
            }
            // Apply rotation to current
            let final_rotation = is_column_left ? -(focus_rotation) : (focus_rotation);
            // Determine if there is an existing in tween for this object
            let in_tween = in_tween_map.get(object_name);
            if(in_tween == null) {
                in_tween = new Tween(current_intersected.rotation)
                .to({ y: final_rotation}, 400)
                .easing(Easing.Sinusoidal.In)
                .start()
                .onComplete(() => in_tween_map.delete(object_name));
                in_tween_map.set(object_name, in_tween);
            }
        }
    } else {
        reset_previous_intersected();
    }
}

/** Resets the previous intersetcted objects orientation */
function reset_previous_intersected() {
    if(current_intersected) {
        let deselected_rotation = 0;
        new Tween(current_intersected.rotation)
        .to({ y: deselected_rotation})
        .easing(Easing.Elastic.Out)
        .start();
        current_intersected = null;
    }
}

// Window handlers
let last_pixel_ratio = window.devicePixelRatio;
window.addEventListener('resize', () => {
    const current_pixel_ratio = window.devicePixelRatio;
    if(last_pixel_ratio != current_pixel_ratio) {
        last_pixel_ratio = current_pixel_ratio;
        zoom_event = true;
    }
    // Set variables
    resize_move = true;
    // Resize application
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// TODO Handle mouse down
window.addEventListener('mousedown', (e) => {
    const found_intersections = get_intersect_list(e, "clicked down");
    found_intersections.forEach(i => (console.log(`${i.object.name} clicked down`)));
    // TODO Do something with the intersections
});

// Handle mouse up
window.addEventListener('mouseup', (e) => {
    const found_intersections = get_intersect_list(e, "clicked up");
    if(is_column_left){
        if(found_intersections.length > 0){
            const intersected_object = found_intersections[0].object;
            (console.log(`${intersected_object.name} clicked up`));
            const split_intersected_name = intersected_object.name.split("_");
            const name_type = split_intersected_name[0] + "_";
            switch(name_type) {
                case LABEL:
                    reset_previous_intersected();
                    swap_column_sides();
                    focus_text_box(intersected_object.name);
                    break;
                case HIDE:
                    trigger_overlay();
                    break;
                case LINK:
                    link_container.open_link(split_intersected_name[1].trim());
                    break;
            }
        }
    // Column is right
    } else {
        if(found_intersections.length > 0) {
            const intersected_object = found_intersections[0].object;
            const split_intersected_name = intersected_object.name.split("_");
            const name_type = split_intersected_name[0] + "_";
            switch(name_type) {
                case LABEL:
                    focus_text_box(intersected_object.name);
                    break;
                case LINK:
                    link_container.open_link(split_intersected_name[1].trim());
                    break;
            }
        } else {
            swap_column_sides();
            lose_focus_text_box(WEST);
        }
    }

});

window.addEventListener('mousemove', handle_hover);
