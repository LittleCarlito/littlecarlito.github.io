// Renderer module
// Handles setup and configuration of THREE.js renderer

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Setup the Three.js renderer
 * @param {Object} state - Global state object
 * @returns {THREE.WebGLRenderer} - The created renderer
 */
export function setupRenderer(state) {
  // Create renderer if it doesn't exist
  if (!state.renderer) {
    // Create WebGL renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    
    // Configure renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    
    // Add to DOM
    document.body.appendChild(renderer.domElement);
    
    // Initially hide the renderer
    renderer.domElement.style.display = 'none';
    
    // Store in state
    state.renderer = renderer;
    
    // Create scene if it doesn't exist
    if (!state.scene) {
      const scene = new THREE.Scene();
      state.scene = scene;
    }
    
    // Setup camera if it doesn't exist
    if (!state.camera) {
      setupCamera(state);
    }
    
    // Setup animation loop
    setupAnimationLoop(state);
    
    // Setup window resize handler
    setupResizeHandler(state);
    
    console.log('Renderer initialized');
  }
  
  return state.renderer;
}

/**
 * Setup the camera
 * @param {Object} state - Global state object
 * @returns {THREE.PerspectiveCamera} - The created camera
 */
function setupCamera(state) {
  if (!state.camera) {
    // Create perspective camera
    const camera = new THREE.PerspectiveCamera(
      45, // FOV
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near plane
      1000 // Far plane
    );
    
    // Set initial position
    camera.position.z = 5;
    
    // Store in state
    state.camera = camera;
    
    // Setup orbit controls
    setupOrbitControls(state);
  }
  
  return state.camera;
}

/**
 * Setup orbit controls for camera
 * @param {Object} state - Global state object
 * @returns {OrbitControls} - The created controls
 */
function setupOrbitControls(state) {
  if (!state.controls && state.camera && state.renderer) {
    // Create orbit controls
    const controls = new OrbitControls(state.camera, state.renderer.domElement);
    
    // Configure controls
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    
    // Store in state
    state.controls = controls;
  }
  
  return state.controls;
}

/**
 * Setup animation loop for continuous rendering
 * @param {Object} state - Global state object
 */
function setupAnimationLoop(state) {
  if (!state.renderer || !state.scene || !state.camera) return;
  
  // Animation loop function
  const animate = () => {
    requestAnimationFrame(animate);
    
    // Update orbit controls if they exist
    if (state.controls) {
      state.controls.update();
    }
    
    // Only render if in debug mode
    if (state.isDebugMode) {
      state.renderer.render(state.scene, state.camera);
    }
  };
  
  // Start animation loop
  animate();
}

/**
 * Setup window resize handler
 * @param {Object} state - Global state object
 */
function setupResizeHandler(state) {
  window.addEventListener('resize', () => {
    if (!state.renderer || !state.camera) return;
    
    // Update camera aspect ratio
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    
    // Update renderer size
    state.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/**
 * Setup scene lighting
 * @param {Object} state - Global state object
 */
export function setupSceneLighting(state) {
  if (!state.scene) return;
  
  // Clear existing lights - collect them first, then remove them
  const lightsToRemove = [];
  state.scene.traverse((obj) => {
    if (obj.isLight) {
      lightsToRemove.push(obj);
    }
  });
  
  // Now remove the lights
  lightsToRemove.forEach(light => {
    light.parent.remove(light);
  });
  
  // Create ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  state.scene.add(ambientLight);
  
  // Create directional lights
  const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
  frontLight.position.set(0, 0, 10);
  state.scene.add(frontLight);
  
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(0, 0, -10);
  state.scene.add(backLight);
  
  const topLight = new THREE.DirectionalLight(0xffffff, 0.3);
  topLight.position.set(0, 10, 0);
  state.scene.add(topLight);
} 