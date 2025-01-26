import * as THREE from 'three';
import { Easing, Tween, update as updateTween } from 'tween';

// Constants
const PAN_SPEED = 600;
const ROTATE_SPEED = 300;
const CONATINER = "container_";
const LABEL = "label_";
const TEXT = "text_";
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

// Values
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
const icon_text_boxes = [
    0xe5ce38,
    0x834eb4,
    0xb44444,
    0x25973a,
    0x3851e5
];
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
const focus_rotation = .7;
let is_column_left = true;
let resize_move = false;
let current_intersected = null;
let in_tween_map = new Map();

// Setup
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const container_column = new THREE.Object3D();
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

const screen_size = new THREE.Vector2();
camera.getViewSize(15, screen_size);
container_column.position.x = -(.33 * screen_size.x);
container_column.position.y = -(.3 * screen_size.y);
container_column.rotation.y = 1;

const da_sun = new THREE.DirectionalLight(0xffffff, 10);
da_sun.position.set(0, 3, -2);
scene.add(da_sun);

// Text displays
const text_box_container = new THREE.Object3D();
scene.add(text_box_container);
for (let c = 0; c < icon_text_boxes.length; c++) {
    const box_geometry = new THREE.BoxGeometry(1, 1, .01);
    const box_material = new THREE.MeshBasicMaterial({ color: icon_text_boxes[c] });
    const text_box = new THREE.Mesh(box_geometry, box_material);
    text_box.name = `${TEXT}${icon_labels[c]}`
    text_box.position.x = -window.innerWidth;
    text_box.position.y = -(.05 * screen_size.y);
    text_box_container.add(text_box);
}


// Functions

/** TODO Gets final location of assicated direction given current camera 
 ** incoming_direction must be a member of DIRECTIONS
*/
function get_associated_position(incoming_direction) {
    if(DIRECTIONS.includes(incoming_direction)){
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
    } else {
        // TODO Log that given direction is not supported
    }
}

/*** Swaps the container column sides */
function swap_column_sides() {
    const determined_size = new THREE.Vector2();
    camera.getViewSize(15, determined_size);
    is_column_left = !is_column_left;
    let x_position = (is_column_left ? -1 : 1) * 0.33 * determined_size.x;
    let y_position = (is_column_left ? -1 : -.4) * (.3 * screen_size.y);
    let y_rotation = (is_column_left ? 1 : -1);

    // Move column across the screen
    new Tween(container_column.position)
    .to({ x: x_position, y: y_position}, PAN_SPEED)
    .easing(Easing.Elastic.Out)
    .start();
    // Rotate the column as it moves
    new Tween(container_column.rotation)
    .to({ y: y_rotation}, ROTATE_SPEED)
    .easing(Easing.Exponential.Out)
    .start();
}

// TODO Change swap_column calling logic
//          Should require selection to move left
//          No selection click when right
//              Moves column back left
//              Moves active text box left off screen
//          Selection while right
//              Keeps column on the right
//              Moves active text box down off screen
//              Moves selected text box to active spot

let focused_text_name = "";
/** Brings the text box associated with the given name into focus
 ** container column MUST be on the right side
 */
function focus_text_box(incoming_name) {
    if(!is_column_left) {
        // Get screen size
        const new_size = new THREE.Vector2();
        camera.getViewSize(15, new_size);
        // Get text box name
        const found_index = incoming_name.indexOf('_');
        const sub_name = incoming_name.substring(found_index + 1);
        // If existing focus text box move it
        if(focused_text_name != "") {
            lose_focus_text_box(SOUTH);
        }
        focused_text_name = TEXT + sub_name;
        // Get and move text box
        const selected_text_box = text_box_container.getObjectByName(focused_text_name);
        new Tween(selected_text_box.position)
        .to({ x: -(new_size.x * .2) }, 285)
        .easing(Easing.Sinusoidal.Out)
        .start()
    } else {
        lose_focus_text_box(WEST);
        // TODO Log that container_column MUST be right side for focus text box
    }
}

//  Method to tween focused_text_name to offscreen and set to empty string
function lose_focus_text_box(move_direction = "") {
    if(focused_text_name != "") {
        if(move_direction == "" || DIRECTIONS.includes(move_direction)) {
            const new_size = new THREE.Vector2();
            camera.getViewSize(15, new_size);
            const existing_focus_box = text_box_container.getObjectByName(focused_text_name);
            if(move_direction == "") {
                existing_focus_box.position.x = -(new_size.x);
            } else {
                // Tween in given direction off screen
                const previous_position = existing_focus_box.position;
                const move_position = get_associated_position(move_direction);
                switch(move_direction) {
                    case NORTH, SOUTH:
                        new Tween(existing_focus_box.position)
                        .to({ y: move_position }, PAN_SPEED)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => {
                            existing_focus_box.position.x = -new_size.x;
                            existing_focus_box.position.y = previous_position.y;
                        });
                        break;
                    case EAST, WEST:
                        new Tween(existing_focus_box.position)
                        .to({ x: move_position }, PAN_SPEED)
                        .easing(Easing.Sinusoidal.Out)
                        .start()
                        .onComplete(() => {
                            existing_focus_box.position.x = -new_size.x;
                        });
                        break;
                }
            }
            // Lose focus on box
            focused_text_name = "";
        } else {
            // TODO Log passed in move direction isn't supported
        }
    } else {
        // TODO Log that there is no focused text box to lose focus on
    }

}

function animate() {
    updateTween();
    if(resize_move){
        const found_size = new THREE.Vector2();
        camera.getViewSize(15, found_size);

        let x_position = (is_column_left ? -1 : 1) * 0.33 * found_size.x;
        let y_rotation = (is_column_left ? 1 : -1);
    
        // Move column across the screen
        new Tween(container_column.position)
        .to({ x: x_position})
        .easing(Easing.Elastic.Out)
        .start();
        // Rotate the column as it moves
        new Tween(container_column.rotation)
        .to({ y: y_rotation})
        .easing(Easing.Exponential.Out)
        .start();

        // TODO Move text boxes out of window
        text_box.position.x = - found_size.x;

        resize_move = false;
    }
    renderer.render(scene, camera);
}

function get_intersect_list(e) {
    mouse_location.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse_location.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse_location, camera);
    return raycaster.intersectObject(container_column, true);
}

function handle_hover(e) {
    const found_intersections = get_intersect_list(e);
    if(found_intersections.length > 0) {
        const intersected_object = found_intersections[0].object;
        const object_name = intersected_object.name;
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
    } else {
        reset_previous_intersected();
    }
}

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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resize_move = true;
});

// TODO Handle mouse down
window.addEventListener('mousedown', (e) => {
    const found_intersections = get_intersect_list(e, "clicked down");
    found_intersections.forEach(i => (console.log(`${i.object.name} clicked down`)));
    // TODO Do something with the intersections
});

// TODO Handle mouse up
window.addEventListener('mouseup', (e) => {
    const found_intersections = get_intersect_list(e, "clicked up");
    if(found_intersections.length > 0){
        const intersected_object = found_intersections[0].object;
        (console.log(`${intersected_object.name} clicked up`))
        reset_previous_intersected();
        // TODO Provide label nameto focus_text_box
        swap_column_sides();
        focus_text_box(intersected_object.name);
    }
});

window.addEventListener('mousemove', handle_hover)