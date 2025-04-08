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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Initialize or modify global state object
if (!window.textureDebuggerState) {
    window.textureDebuggerState = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        cube: null,
        model: null,
        
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
        
        // Model file (File object)
        modelFile: null,
        
        // Animation ID for cancelAnimationFrame
        animationId: null,
        
        // Mesh management
        meshes: [],
        meshGroups: {},
        
        // Status flags
        isDebugStarted: false,
        useCustomModel: false
    };
}

// Use the global state
const state = window.textureDebuggerState;

// DOM Elements
const baseColorDropzone = document.getElementById('basecolor-dropzone');
const ormDropzone = document.getElementById('orm-dropzone');
const normalDropzone = document.getElementById('normal-dropzone');
const modelDropzone = document.getElementById('model-dropzone');
const startButton = document.getElementById('start-debug');
const viewport = document.getElementById('viewport');
const meshPanel = document.getElementById('mesh-panel');
const meshGroupsContainer = document.getElementById('mesh-groups');

// File info elements
const baseColorInfo = document.getElementById('basecolor-info');
const ormInfo = document.getElementById('orm-info');
const normalInfo = document.getElementById('normal-info');
const modelInfo = document.getElementById('model-info');

// Preview elements
const baseColorPreview = document.getElementById('basecolor-preview');
const ormPreview = document.getElementById('orm-preview');
const normalPreview = document.getElementById('normal-preview');

// Setup event listeners for drag and drop
function setupDropzone(dropzone, fileType, infoElement, previewElement) {
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
        if (fileType === 'model') {
            if (file && file.name.toLowerCase().endsWith('.glb')) {
                handleModelUpload(file, infoElement, dropzone);
            } else {
                alert('Please upload a GLB file for the model');
            }
        } else {
            if (file && file.type.startsWith('image/')) {
                handleTextureUpload(file, fileType, infoElement, previewElement, dropzone);
            }
        }
    }, false);

    // Handle file upload via click
    dropzone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        
        if (fileType === 'model') {
            input.accept = '.glb';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (file && file.name.toLowerCase().endsWith('.glb')) {
                    handleModelUpload(file, infoElement, dropzone);
                } else {
                    alert('Please upload a GLB file for the model');
                }
            };
        } else {
            input.accept = 'image/*';
            
            input.onchange = e => {
                const file = e.target.files[0];
                if (file) {
                    handleTextureUpload(file, fileType, infoElement, previewElement, dropzone);
                }
            };
        }
        
        input.click();
    });
}

// Prevent default drag behaviors
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Handle texture file upload
function handleTextureUpload(file, textureType, infoElement, previewElement, dropzone) {
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

// Handle model file upload
function handleModelUpload(file, infoElement, dropzone) {
    // Store the file in the state
    state.modelFile = file;
    state.useCustomModel = true;
    
    // Show file info
    infoElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
    
    // Mark dropzone as having a file
    dropzone.classList.add('has-file');
    
    // No need for a preview for the model file
    
    // Check if all required textures are loaded to enable the start button
    checkStartButton();
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Check if all required textures are loaded and enable start button if they are
function checkStartButton() {
    if (state.textureObjects.baseColor && 
        state.textureObjects.orm && 
        state.textureObjects.normal) {
        startButton.disabled = false;
    }
}

// Initialize Three.js scene
function initScene() {
    // Make the viewport visible first, before creating the renderer
    viewport.style.display = 'block';
    
    // Make mesh panel visible as it will be populated later
    meshPanel.style.display = 'block';
    
    // Force a reflow to ensure dimensions are calculated correctly
    void viewport.offsetWidth;
    
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
    
    // Create orbit controls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    state.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    state.scene.add(directionalLight);
    
    // Create 3D object based on whether a model was uploaded
    if (state.useCustomModel && state.modelFile) {
        loadAndSetupModel();
    } else {
        createCube();
    }
    
    // Start animation loop
    animate();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Force a resize event to ensure everything renders correctly
    window.dispatchEvent(new Event('resize'));
    
    // Render once immediately to ensure content is visible
    if (state.renderer && state.scene && state.camera) {
        state.renderer.render(state.scene, state.camera);
    }
}

// Load and setup the custom model
function loadAndSetupModel() {
    // Convert the File to a URL
    const modelUrl = URL.createObjectURL(state.modelFile);
    
    // Create GLTFLoader
    const loader = new GLTFLoader();
    
    // Load the model
    loader.load(
        modelUrl,
        (gltf) => {
            // Handle successful load
            state.model = gltf.scene;
            
            // Clear previous meshes array
            state.meshes = [];
            
            // Apply textures to the model and collect meshes
            state.model.traverse((child) => {
                if (child.isMesh) {
                    // Add to meshes array
                    state.meshes.push(child);
                    
                    // Apply same material to all meshes in the model
                    child.material = createMaterial();
                    
                    // Create UV2 for aoMap if it doesn't exist
                    if (!child.geometry.attributes.uv2) {
                        child.geometry.attributes.uv2 = child.geometry.attributes.uv;
                    }
                }
            });
            
            // Add the model to the scene
            state.scene.add(state.model);
            
            // Adjust camera position based on model size
            fitCameraToObject(state.camera, state.model, state.controls);
            
            // Revoke URL to free memory
            URL.revokeObjectURL(modelUrl);
            
            // Set up mesh visibility panel
            createMeshVisibilityPanel();
            
            // Show the mesh panel
            meshPanel.style.display = 'block';
        },
        (xhr) => {
            // Handle progress
            console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
            // Handle error
            console.error('Error loading model:', error);
            
            // Fallback to cube if model loading fails
            console.log('Falling back to cube model');
            createCube();
        }
    );
}

// Create a cube with textures
function createCube() {
    // Create cube geometry with UV2 for aoMap
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.attributes.uv2 = geometry.attributes.uv;
    
    // Create material with the loaded textures
    const material = createMaterial();
    
    // Create mesh and add to scene
    state.cube = new THREE.Mesh(geometry, material);
    state.cube.name = "Cube";
    state.scene.add(state.cube);
    
    // Add to meshes array for visibility control
    state.meshes = [state.cube];
    
    // Set up mesh visibility panel
    createMeshVisibilityPanel();
    
    // Show the mesh panel
    meshPanel.style.display = 'block';
}

// Create a standard material with the loaded textures
function createMaterial() {
    return new THREE.MeshStandardMaterial({
        map: state.textureObjects.baseColor,
        normalMap: state.textureObjects.normal,
        aoMap: state.textureObjects.orm,
        roughnessMap: state.textureObjects.orm,
        metalnessMap: state.textureObjects.orm,
        roughness: 1.0,
        metalness: 1.0
    });
}

// Fit camera to object
function fitCameraToObject(camera, object, controls, offset = 1.5) {
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Get the max side of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * offset;
    
    // Update camera position
    camera.position.z = cameraZ;
    
    // Update the target of the controls
    controls.target = center;
    controls.update();
}

// Animation loop
function animate() {
    state.animationId = requestAnimationFrame(animate);
    
    // Rotate the cube if it exists
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
    setupDropzone(modelDropzone, 'model', modelInfo, null);
    
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

// Create mesh visibility panel
function createMeshVisibilityPanel() {
    // Organize meshes into groups based on name prefixes
    groupMeshesByName();
    
    // Clear previous content
    meshGroupsContainer.innerHTML = '';
    
    // Create elements for each mesh group
    for (const groupName in state.meshGroups) {
        const groupMeshes = state.meshGroups[groupName];
        
        // Create group container
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mesh-group';
        
        // Create group header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'mesh-group-header';
        
        // Create group toggle checkbox
        const groupToggle = document.createElement('input');
        groupToggle.type = 'checkbox';
        groupToggle.className = 'mesh-group-toggle';
        groupToggle.checked = true;
        groupToggle.dataset.group = groupName;
        
        // Add event listener for group toggle
        groupToggle.addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            toggleMeshGroupVisibility(groupName, isVisible);
            
            // Update individual mesh checkboxes
            const meshToggles = groupDiv.querySelectorAll('.mesh-toggle');
            meshToggles.forEach(toggle => {
                toggle.checked = isVisible;
            });
        });
        
        // Create group name element
        const groupNameSpan = document.createElement('span');
        groupNameSpan.className = 'mesh-group-name';
        groupNameSpan.textContent = groupName;
        
        // Create group count element
        const groupCountSpan = document.createElement('span');
        groupCountSpan.className = 'mesh-group-count';
        groupCountSpan.textContent = `(${groupMeshes.length})`;
        
        // Assemble header
        headerDiv.appendChild(groupToggle);
        headerDiv.appendChild(groupNameSpan);
        headerDiv.appendChild(groupCountSpan);
        
        // Create container for mesh items
        const meshItemsDiv = document.createElement('div');
        meshItemsDiv.className = 'mesh-items';
        
        // Create elements for each mesh in the group
        groupMeshes.forEach(mesh => {
            const meshDiv = document.createElement('div');
            meshDiv.className = 'mesh-item';
            
            // Create mesh toggle checkbox
            const meshToggle = document.createElement('input');
            meshToggle.type = 'checkbox';
            meshToggle.className = 'mesh-toggle';
            meshToggle.checked = mesh.visible;
            meshToggle.dataset.meshIndex = state.meshes.indexOf(mesh);
            
            // Add event listener for mesh toggle
            meshToggle.addEventListener('change', (e) => {
                const isVisible = e.target.checked;
                const meshIndex = parseInt(e.target.dataset.meshIndex);
                
                if (!isNaN(meshIndex) && meshIndex >= 0 && meshIndex < state.meshes.length) {
                    state.meshes[meshIndex].visible = isVisible;
                    
                    // Update group checkbox if needed
                    updateGroupToggleState(groupName);
                }
            });
            
            // Create mesh name element
            const meshNameSpan = document.createElement('span');
            meshNameSpan.className = 'mesh-name';
            meshNameSpan.textContent = getMeshDisplayName(mesh);
            meshNameSpan.title = mesh.name || "Unnamed mesh";
            
            // Assemble mesh item
            meshDiv.appendChild(meshToggle);
            meshDiv.appendChild(meshNameSpan);
            
            // Add to mesh items container
            meshItemsDiv.appendChild(meshDiv);
        });
        
        // Assemble group
        groupDiv.appendChild(headerDiv);
        groupDiv.appendChild(meshItemsDiv);
        
        // Add to groups container
        meshGroupsContainer.appendChild(groupDiv);
    }
}

// Group meshes by name prefix
function groupMeshesByName() {
    state.meshGroups = {};
    
    state.meshes.forEach(mesh => {
        const groupName = getGroupName(mesh);
        
        if (!state.meshGroups[groupName]) {
            state.meshGroups[groupName] = [];
        }
        
        state.meshGroups[groupName].push(mesh);
    });
}

// Get group name from mesh based on naming pattern
function getGroupName(mesh) {
    const name = mesh.name || 'Unnamed';
    
    // Common patterns to detect groups by prefixes
    // Example patterns: "Body_part", "Head_1", "Head_2" etc.
    const patterns = [
        /^([^_]+)_.*$/,  // Anything before first underscore
        /^([^.]+)\..*$/, // Anything before first period
        /^([^0-9]+).*$/  // Anything before first number
    ];
    
    for (const pattern of patterns) {
        const match = name.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // If no pattern matches or no name, use default group
    if (name === 'Unnamed' || name === 'Cube') {
        return 'Default';
    }
    
    // If nothing matches, use first 4 characters as group
    return name.substring(0, 4);
}

// Get display name for mesh
function getMeshDisplayName(mesh) {
    return mesh.name || "Unnamed mesh";
}

// Toggle visibility of all meshes in a group
function toggleMeshGroupVisibility(groupName, isVisible) {
    if (state.meshGroups[groupName]) {
        state.meshGroups[groupName].forEach(mesh => {
            mesh.visible = isVisible;
        });
    }
}

// Update group toggle state based on individual mesh visibility
function updateGroupToggleState(groupName) {
    const groupToggle = document.querySelector(`.mesh-group-toggle[data-group="${groupName}"]`);
    if (!groupToggle || !state.meshGroups[groupName]) return;
    
    // Check if all meshes in the group are visible
    const allVisible = state.meshGroups[groupName].every(mesh => mesh.visible);
    const anyVisible = state.meshGroups[groupName].some(mesh => mesh.visible);
    
    // Set the indeterminate state if some but not all are visible
    if (anyVisible && !allVisible) {
        groupToggle.indeterminate = true;
    } else {
        groupToggle.indeterminate = false;
        groupToggle.checked = allVisible;
    }
} 