// Three.js scene management: setup, rendering, and animation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Setup the Three.js scene, camera, renderer
export function setupScene(state) {
	// Create scene
	state.scene = new THREE.Scene();
	state.scene.background = new THREE.Color(0x222222);
	// Set up camera
	state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	state.camera.position.z = 1;
	state.camera.position.y = 0.5;
	// Set up renderer
	state.renderer = initRenderer();
	// Add lights
	addLights(state.scene);
	// Add controls
	state.controls = new OrbitControls(state.camera, state.renderer.domElement);
	state.controls.enableDamping = true;
	state.controls.dampingFactor = 0.05;
	state.controls.target.set(0, 0, 0);
	// Handle window resize
	window.addEventListener('resize', () => onWindowResize(state));
	return state;
}
// Initialize renderer with proper settings
export function initRenderer() {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.outputEncoding = THREE.sRGBEncoding;
	document.body.appendChild(renderer.domElement);
	renderer.domElement.style.display = 'none'; // Hide canvas initially
	return renderer;
}
// Add standard lights to the scene
function addLights(scene) {
	const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
	scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
	directionalLight.position.set(1, 1, 1);
	scene.add(directionalLight);
	// Add a second directional light from another angle
	const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
	directionalLight2.position.set(-1, 0.5, -1);
	scene.add(directionalLight2);
}
// Handle window resize
function onWindowResize(state) {
	state.camera.aspect = window.innerWidth / window.innerHeight;
	state.camera.updateProjectionMatrix();
	state.renderer.setSize(window.innerWidth, window.innerHeight);
}
// Animation loop
export function animate(state) {
	requestAnimationFrame(() => animate(state));
	// Update controls
	if (state.controls) {
		state.controls.update();
	}
	// Update shader materials if any
	updateShaderMaterials(state);
	// Render the scene
	if (state.renderer && state.scene && state.camera) {
		state.renderer.render(state.scene, state.camera);
	}
}
// Update shader time uniforms for animated materials
function updateShaderMaterials(state) {
	const time = performance.now() * 0.001; // Time in seconds
	if (state.modelObject) {
		state.modelObject.traverse((child) => {
			if (child.isMesh && 
          child.material instanceof THREE.ShaderMaterial && 
          child.material.uniforms && 
          child.material.uniforms.u_time) {
				child.material.uniforms.u_time.value = time;
			}
		});
	}
} 