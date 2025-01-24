import * as THREE from 'three';
import { Easing, Tween, update as updateTween } from 'tween';

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
]

// Setup

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

const texture_loader = new THREE.TextureLoader();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const container_column = new THREE.Object3D();
container_column.name = `container_column`
scene.add(container_column);

for (let i = 0; i < icon_paths.length; i++) {
    const button_container = new THREE.Object3D();
    button_container.name = `container_${icon_labels[i]}`
    container_column.add(button_container);
    const button_texture = texture_loader.load(icon_paths[i]);
    button_texture.colorSpace = THREE.SRGBColorSpace;
    const button_option = new THREE.Mesh(
        new THREE.BoxGeometry(5, 3, 0),
        new THREE.MeshBasicMaterial({
            map: button_texture,
            transparent: true
        }));
    button_option.name = `label_${icon_labels[i]}`
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

// Functions

/*** Swaps the container column sides */
let is_column_left = true;
function swap_column_sides() {
    const determined_size = new THREE.Vector2();
    camera.getViewSize(15, determined_size);
    is_column_left = !is_column_left;
    let x_position = (is_column_left ? -1 : 1) * 0.33 * determined_size.x;
    // TODO Move up when on right and down when left
    let y_position = (is_column_left ? -1 : 1.2) * (.3 * determined_size.y);
    let y_rotation = (is_column_left ? 1 : 0);
    let x_scale = (is_column_left ? 1 : .2);
    let y_scale = (is_column_left ? 1 : .05);


    // TODO Keep Elastic for when it comes left
    //          Make it smoother going out to the right

    // Move column across the screen
    new Tween(container_column.position)
    .to({ x: x_position, y: y_position}, is_column_left ? 600 : 330)
    .easing(is_column_left ? Easing.Elastic.Out : Easing.Exponential.Out)
    .start();
    // Rotate the column as it moves
    new Tween(container_column.rotation)
    .to({ y: y_rotation}, is_column_left ? 1000 : 330)
    .easing(is_column_left ? Easing.Elastic.Out : Easing.Exponential.Out)
    .start();
    // Shrink/Expand from depending on side
    new Tween(container_column.scale)
    .to({x: x_scale, y: y_scale}, is_column_left ? 500 : 330)
    .easing(Easing.Exponential.Out)
    .start();
}

let resize_move = false;
function animate() {
    updateTween();
    if(resize_move){
        const found_size = new THREE.Vector2();
        camera.getViewSize(15, found_size);

        let x_position = (is_column_left ? -1 : 1) * 0.33 * found_size.x;
        let y_rotation = (is_column_left ? 1 : -1);
    
        // Move column across the screen
        new Tween.Tween(container_column.position)
        .to({ x: x_position})
        .easing(Easing.Elastic.Out)
        .start();
        // Rotate the column as it moves
        new Tween(container_column.rotation)
        .to({ y: y_rotation})
        .easing(Easing.Exponential.Out)
        .start();

        resize_move = false;
    }
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resize_move = true;
});

// TODO Handle mouse down
window.addEventListener('mousedown', (e) => {
    const raycaster = new THREE.Raycaster();
    const mouse_location = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse_location, camera);
    const found_intersections = raycaster.intersectObject(container_column, true);
    found_intersections.forEach(i => (console.log(`${i.object.name} clicked down`)));
    // TODO Do something with the intersections
});

// TODO Handle mouse up
window.addEventListener('mouseup', (e) => {
    const raycaster = new THREE.Raycaster();
    const mouse_location = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse_location, camera);
    const found_intersections = raycaster.intersectObject(container_column, true);
    found_intersections.forEach(i => (console.log(`${i.object.name} clicked up`)));
    // TODO Temporary (though will want to include doing this when info pops up)
    swap_column_sides();
});
