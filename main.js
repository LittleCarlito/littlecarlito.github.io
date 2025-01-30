import * as THREE from 'three';
import { clamp } from 'three/src/math/MathUtils.js';
import { Easing, Tween, update as updateTween } from 'tween';
import { TitleBlock } from './overlay/title_block';

// Constants
const PAN_SPEED = 800;
const ROTATE_SPEED = 300;
const LINK_RADIUS = .44;

// TODO Get these to modular class for POC
const TITLE_HEIGHT = 2.75;
const TITLE_Y = 9;
const TITLE_X = -4;
const TITLE_THICKNESS = .2;


const HIDE_WIDTH = 1;
const HIDE_HEIGHT = 1;
// Name types
const CONATINER = "container_";
const LABEL = "label_";
const TEXT = "text_";
const LINK = "link_"
export const TITLE = "title_"
const HIDE = "hide_"
// Directions
const NORTH = "north";
const SOUTH = "south";
const EAST = "east";
const WEST = "west";
const DIRECTIONS =[
    NORTH,
    SOUTH,
    EAST,
    WEST
]
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
// Links
const link_paths = [
    "github_link.svg",
    "twitch_link.svg",
    "linkedin_link.svg",
    "tiktok_link.svg"
]
// TODO get profiles in link paths
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
let is_overlay_hidden = false;
let is_column_left = true;
let resize_move = false;
let zoom_event = false;
let current_intersected = null;
let in_tween_map = new Map();
const container_column = new THREE.Object3D();
const text_box_container = new THREE.Object3D();
const link_container = new THREE.Object3D();
let hide_button;
let title_box;

// Functions

/** Initializes the main scene */
function init() {
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

    // TODO OOOOOO
    // TODO newTitleBlock is breaking because you need to structure this with an init() setup
    //          Maybe even a SceneManager class for better structure/readability
    // const title_block = new TitleBlock(scene, camera);
    // TODO Get this to modular class for POC
    // Title block
    const title_width = get_title_width();
    const title_geometry = new THREE.BoxGeometry(title_width, TITLE_HEIGHT, TITLE_THICKNESS);
    const title_material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    title_box = new THREE.Mesh(title_geometry, title_material);
    title_box.name = `${TITLE}`;
    title_box.position.y = TITLE_Y;
    title_box.position.x = TITLE_X;
    scene.add(title_box);




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
        text_box.position.x = get_associated_position(WEST);
        text_box.position.y = get_text_box_y();
        text_box_container.add(text_box);
    }

    link_container.position.x =  get_link_container_x();
    link_container.position.y = get_link_container_y();
    scene.add(link_container);
    const calced_radius = get_link_radius();
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
        link_container.add(link_button);
    }

    const hide_button_width = HIDE_WIDTH;
    const hide_button_height = HIDE_HEIGHT;
    const hide_button_geometry = new THREE.BoxGeometry(hide_button_width, hide_button_height, 0);
    const hide_button_material = get_hide_button_material();
    hide_button = new THREE.Mesh(hide_button_geometry, hide_button_material);
    hide_button.position.y = get_hide_button_y();
    hide_button.position.x = get_hide_button_x();
    hide_button.name = HIDE;
    scene.add(hide_button);
}

/** Calculates screen size based off a distance of 15 */
function get_screen_size() {
    const screen_size = new THREE.Vector2();
    camera.getViewSize(15, screen_size);
    return screen_size;
}

// Hide button getters
/** Determines the material for the hide button based off scene state */
function get_hide_button_material() {
    return is_overlay_hidden 
    ? new THREE.MeshBasicMaterial({ color: 0x689f38 }) 
    : new THREE.MeshBasicMaterial({ color: 0x777981 });
}

/** Calculates hide button x position based off camera position and window size*/
function get_hide_button_x() {
    return is_column_left ? (get_screen_size().x / 2) - 2.5 : get_associated_position(EAST);
}

/** Calculates hide button y position based off camera position and window size */
function get_hide_button_y() {
    return (get_screen_size().y / 2) - 2.5;
}

// Link getters
/** Calculates the link containers x position based off camera position and window size*/
function get_link_container_x() {
    return (get_screen_size().x / 2) - (7);
}

/** Calculates the link containers y position based off camera position and window size*/
function get_link_container_y() {
    return -(.4 * get_screen_size().y);
}

/** Calculates the links radius based off camera position and window size*/
function get_link_radius() {
    return clamp(get_screen_size().x * .02, Number.MIN_SAFE_INTEGER, LINK_RADIUS);
}

// Text box getters
/** Calculates the selected text boxes x position based off camera position and window size */
function get_focused_text_x() {
   return -(get_screen_size().x / 2 * .36)
}

/** Calculates the text boxes y position based off camera position and window size */
function get_text_box_y() {
    return -(get_screen_size().y * 0.05);
}
/** Calculates the text boxes height based off camera position and window size */
function get_text_box_height() {
    return get_screen_size().y * .6;
}

/** Calculates the text boxes width based off camera position and window size */
function get_text_box_width() {
    return clamp(get_screen_size().x * .5, 12, 18);
}

// TODO Move to modular class for POC
// Title getters
/** Calculates the titles width given the camera position and window size*/
function get_title_width() {
    return clamp(get_screen_size().x * .5, 12, 18);
}

// Column getters
/** Calculates the x position of the container column given it and the cameras position along with window size */
function get_column_x_position() {
    return (is_column_left ? -1 : 1) * (get_screen_size().x / 2) * 0.6;
}

/** Calculates the y position of the container column given it and the cameras position along with window size */
function get_column_y_position() {
    return (is_column_left ? -1 : -.6) * (get_screen_size().y / 2) * 0.6;
}

/** Calculates the y rotation of the container column given its position along with window size */
function get_column_y_rotation() {
    return (is_column_left ? 1 : -1);
}

/** Open a new tab of the associated link */
function open_link(new_link) {
    if(link_urls.has(new_link)) {
        const hyperlink_path = link_urls.get(new_link);
        window.open(hyperlink_path, "_blank");
    } else {
        console.log(`Given label \"${new_link}\" does not have a stored path`);
    }
}

/** Hides/reveals overlay elements and swaps hide buttons display sprite */
function trigger_overlay() {
    is_overlay_hidden = !is_overlay_hidden;
    console.log(`is overlay hidden \"${is_overlay_hidden}\"`);
    const container_column_x = is_overlay_hidden ? get_associated_position(WEST) : get_column_x_position();
    const link_y = is_overlay_hidden ? get_associated_position(SOUTH) : get_link_container_y();
    // Hide the overlay

    // TODO Get this to modular object for POC
    const title_y = is_overlay_hidden ? get_associated_position(NORTH) : TITLE_Y;
    new Tween(title_box.position)
    .to({ y: title_y })
    .easing(Easing.Elastic.InOut)
    .start();


    new Tween(container_column.position)
    .to({ x: container_column_x })
    .easing(Easing.Elastic.InOut)
    .start();
    new Tween(link_container.position)
    .to({ y: link_y }, 680)
    .easing(Easing.Elastic.InOut)
    .start();
    // Change how hide button looks based off value
    hide_button.material = get_hide_button_material();
}

/** Gets final location of assicated direction given current camera 
 ** incoming_direction must be a member of DIRECTIONS
*/
function get_associated_position(incoming_direction) {
    if(DIRECTIONS.includes(incoming_direction)) {
        const screen_size = new THREE.Vector2();
        camera.getViewSize(15, screen_size);
        switch(incoming_direction) {
            case NORTH:
                return screen_size.y;
            case SOUTH:
                return -screen_size.y;
            case EAST:
                return screen_size.x;
            case WEST:
                return -screen_size.x;
        }
    }
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
    const hide_x = get_hide_button_x();
    new Tween(hide_button.position)
    .to({ x: hide_x }, 250)
    .easing(Easing.Sinusoidal.Out)
    .start();
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
        if(move_direction == "" || DIRECTIONS.includes(move_direction)) {
            const existing_focus_box = text_box_container.getObjectByName(focused_text_name);
            if(move_direction == "") {
                existing_focus_box.position.x = get_associated_position(WEST);
            } else {
                // Tween in given direction off screen
                const previous_position = existing_focus_box.position;
                const move_position = get_associated_position(move_direction);
                switch(move_direction) {
                    case NORTH:
                        new Tween(existing_focus_box.position)
                        .to({ y: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => {
                            existing_focus_box.position.y = get_text_box_y();
                            existing_focus_box.position.x = get_associated_position(WEST);
                        });
                        break;
                    case SOUTH:
                        new Tween(existing_focus_box.position)
                        .to({ y: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => {
                            existing_focus_box.position.y = get_text_box_y();
                            existing_focus_box.position.x = 2 * get_associated_position(WEST);
                        });
                        break;
                    case EAST:
                        new Tween(existing_focus_box.position)
                        .to({ x: move_position }, PAN_SPEED * .2)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => (
                            existing_focus_box.position.x = (get_associated_position(WEST))
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
                    c.position.x = get_associated_position(WEST);
                    c.position.y = get_text_box_y();
                }
                c.geometry.dispose;
                c.geometry = new_text_geometry;
            });
            // Link moving
            new Tween(link_container.position)
            .to({ 
                x: get_link_container_x(),
                y: get_link_container_y()
            })
            .easing(Easing.Elastic.Out)
            .start();

            // TODO Get this to modular object for POC
            // Move/resize title
            title_box.geometry.dispose();
            title_box.geometry = new THREE.BoxGeometry(get_title_width(), TITLE_HEIGHT, TITLE_THICKNESS);            
           
            new Tween(title_box.position)
            .to({ y: TITLE_Y})
            .easing(Easing.Elastic.Out)
            .start();

            // Move hide button
            new Tween(hide_button.position)
            .to({ 
                x: get_hide_button_x(),
                y: get_hide_button_y()
            })
            .easing(Easing.Elastic.Out)
            .start();
            // Overlay is always redisplayed
            if(is_overlay_hidden) {
                is_overlay_hidden = false;
                hide_button.material.dispose();
                hide_button.material = get_hide_button_material();
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
                    open_link(split_intersected_name[1].trim());
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
                    open_link(split_intersected_name[1].trim());
                    break;
            }
        } else {
            swap_column_sides();
            lose_focus_text_box(WEST);
        }
    }

});

window.addEventListener('mousemove', handle_hover);

init();