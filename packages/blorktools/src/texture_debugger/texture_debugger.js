/**
 * Texture Debugger Tool
 * 
 * A tool to debug textures by loading three atlas types:
 * - Base Color Atlas
 * - ORM (Occlusion, Roughness, Metalness) Atlas
 * - Normal Map Atlas
 * 
 * The tool allows viewing these textures on a 3D cube with proper PBR rendering.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize or modify global state object
if (!window.textureDebuggerState) {
    window.textureDebuggerState = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        cube: null,
        
        // Texture files (File objects)
        textureFiles: {
            baseColor: null,
            orm: null,
            normal: null
        },
        
        // Texture objects (THREE.Texture objects)
        textureObjects: {
            baseColor: null,
            orm: null,
            normal: null
        },
        
        // Animation ID for cancelAnimationFrame
        animationId: null,
        
        // Status flags
        isDebugStarted: false
    };
}

// Use the global state
const state = window.textureDebuggerState;

// DOM Elements
const baseColorDropzone = document.getElementById('basecolor-dropzone');
const ormDropzone = document.getElementById('orm-dropzone');
const normalDropzone = document.getElementById('normal-dropzone');
const startButton = document.getElementById('start-debug');
const viewport = document.getElementById('viewport');

// File info elements
const baseColorInfo = document.getElementById('basecolor-info');
const ormInfo = document.getElementById('orm-info');
const normalInfo = document.getElementById('normal-info');

// Preview elements
const baseColorPreview = document.getElementById('basecolor-preview');
const ormPreview = document.getElementById('orm-preview');
const normalPreview = document.getElementById('normal-preview');

// Setup event listeners for drag and drop
function setupDropzone(dropzone, textureType, infoElement, previewElement) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight dropzone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('active');
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', event => {
        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileUpload(file, textureType, infoElement, previewElement, dropzone);
        }
    }, false);

    // Handle file upload via click
    dropzone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file, textureType, infoElement, previewElement, dropzone);
            }
        };
        
        input.click();
    });
}

// Prevent default drag behaviors
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Handle file upload
function handleFileUpload(file, textureType, infoElement, previewElement, dropzone) {
    // Store the file in the state
    state.textureFiles[textureType] = file;
    
    // Show file info
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // Create an image preview
    const reader = new FileReader();
    reader.onload = e => {
        // Create preview image
        const img = document.createElement('img');
        img.src = e.target.result;
        
        // Clear previous preview
        previewElement.innerHTML = '';
        previewElement.appendChild(img);
        
        // Create a texture object
        const texture = new THREE.TextureLoader().load(e.target.result);
        texture.encoding = textureType === 'baseColor' 
            ? THREE.sRGBEncoding 
            : THREE.LinearEncoding;
            
        // Store the texture
        state.textureObjects[textureType] = texture;
        
        // Check if all textures are loaded to enable the start button
        checkStartButton();
    };
    
    reader.readAsDataURL(file);
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Check if all textures are loaded and enable start button if they are
function checkStartButton() {
    if (state.textureObjects.baseColor && 
        state.textureObjects.orm && 
        state.textureObjects.normal) {
        startButton.disabled = false;
    }
}

// Initialize Three.js scene
function initScene() {
    // Create scene
    state.scene = new THREE.Scene();
    
    // Create camera
    state.camera = new THREE.PerspectiveCamera(
        75, 
        viewport.clientWidth / viewport.clientHeight, 
        0.1, 
        1000
    );
    state.camera.position.z = 3;
    
    // Create renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    state.renderer.outputEncoding = THREE.sRGBEncoding;
    
    // Clear viewport and add renderer
    viewport.innerHTML = '';
    viewport.appendChild(state.renderer.domElement);
    viewport.style.display = 'block';
    
    // Create orbit controls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    state.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    state.scene.add(directionalLight);
    
    // Create cube with the textures
    createCube();
    
    // Start animation loop
    animate();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// Create cube with textures
function createCube() {
    // Create cube geometry with UV2 for aoMap
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.attributes.uv2 = geometry.attributes.uv;
    
    // Create standard material with the loaded textures
    const material = new THREE.MeshStandardMaterial({
        map: state.textureObjects.baseColor,
        normalMap: state.textureObjects.normal,
        aoMap: state.textureObjects.orm,
        roughnessMap: state.textureObjects.orm,
        metalnessMap: state.textureObjects.orm,
        roughness: 1.0,
        metalness: 1.0
    });
    
    // Create mesh and add to scene
    state.cube = new THREE.Mesh(geometry, material);
    state.scene.add(state.cube);
}

// Animation loop
function animate() {
    state.animationId = requestAnimationFrame(animate);
    
    // Rotate the cube
    if (state.cube) {
        state.cube.rotation.y += 0.01;
    }
    
    // Update controls
    state.controls.update();
    
    // Render the scene
    state.renderer.render(state.scene, state.camera);
}

// Handle window resize
function onWindowResize() {
    if (state.camera && state.renderer) {
        state.camera.aspect = viewport.clientWidth / viewport.clientHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
}

// Initialize the app
function init() {
    // Setup dropzones
    setupDropzone(baseColorDropzone, 'baseColor', baseColorInfo, baseColorPreview);
    setupDropzone(ormDropzone, 'orm', ormInfo, ormPreview);
    setupDropzone(normalDropzone, 'normal', normalInfo, normalPreview);
    
    // Setup start button
    startButton.addEventListener('click', () => {
        if (!state.isDebugStarted) {
            initScene();
            state.isDebugStarted = true;
            startButton.textContent = 'Restart Debugging';
        } else {
            // Clean up previous scene
            if (state.animationId) {
                cancelAnimationFrame(state.animationId);
            }
            
            // Restart scene
            initScene();
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for external use
export {
    init
}; 