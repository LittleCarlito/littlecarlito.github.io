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
        
        // Atlas visualization
        currentTextureType: 'baseColor',
        currentUvRegion: { min: [0, 0], max: [1, 1] },
        
        // UV data
        availableUvSets: [],
        uvSetNames: [],
        currentUvSet: 0,
        
        // Rig data
        bones: [],
        skeleton: null,
        boneVisualization: null,
        isBoneVisualizationVisible: false,
        
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
const tabContainer = document.getElementById('tab-container');

// Tab buttons
const meshTabButton = document.getElementById('mesh-tab-button');
const atlasTabButton = document.getElementById('atlas-tab-button');
const uvTabButton = document.getElementById('uv-tab-button');
const rigTabButton = document.getElementById('rig-tab-button');

// Tab content
const meshTab = document.getElementById('mesh-tab');
const atlasTab = document.getElementById('atlas-tab');
const uvTab = document.getElementById('uv-tab');
const rigTab = document.getElementById('rig-tab');

// Mesh tab elements
const meshGroupsContainer = document.getElementById('mesh-groups');

// Atlas tab elements
const atlasCanvas = document.getElementById('atlas-canvas');
const coordsText = document.getElementById('coords-text');
const segmentInfo = document.getElementById('segment-info');
const textureTypeButtons = document.querySelectorAll('.texture-type-button');

// UV tab elements
const uvInfoContainer = document.getElementById('uv-info-container');
const uvManualControls = document.getElementById('uv-manual-controls');
const uvOffsetX = document.getElementById('uv-offset-x');
const uvOffsetY = document.getElementById('uv-offset-y');
const uvScaleW = document.getElementById('uv-scale-w');
const uvScaleH = document.getElementById('uv-scale-h');
const uvPredefinedSegments = document.getElementById('uv-predefined-segments');

// Rig tab elements
const rigStatus = document.getElementById('rig-status');
const rigVisualizationControls = document.getElementById('rig-visualization-controls');
const toggleRigButton = document.getElementById('toggle-rig-button');
const boneHierarchy = document.getElementById('bone-hierarchy');

// File info elements
const baseColorInfo = document.getElementById('basecolor-info');
const ormInfo = document.getElementById('orm-info');
const normalInfo = document.getElementById('normal-info');
const modelInfo = document.getElementById('model-info');

// Preview elements
const baseColorPreview = document.getElementById('basecolor-preview');
const ormPreview = document.getElementById('orm-preview');
const normalPreview = document.getElementById('normal-preview');

// Setup tab switching
function setupTabs() {
    // Create a function to handle tab activation
    const activateTab = (tabButton, tabContent) => {
        // Deactivate all tabs
        [meshTabButton, atlasTabButton, uvTabButton, rigTabButton].forEach(btn => {
            btn.classList.remove('active');
        });
        [meshTab, atlasTab, uvTab, rigTab].forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Activate the selected tab
        tabButton.classList.add('active');
        tabContent.classList.add('active');
    };
    
    // Tab button click handlers
    meshTabButton.addEventListener('click', () => {
        activateTab(meshTabButton, meshTab);
    });
    
    atlasTabButton.addEventListener('click', () => {
        activateTab(atlasTabButton, atlasTab);
        updateAtlasVisualization();
    });
    
    uvTabButton.addEventListener('click', () => {
        activateTab(uvTabButton, uvTab);
        updateUvPanel();
    });
    
    rigTabButton.addEventListener('click', () => {
        activateTab(rigTabButton, rigTab);
        updateRigVisualization();
    });
    
    // Texture type button click handlers
    textureTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            textureTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update current texture type
            state.currentTextureType = button.dataset.textureType;
            
            // Update visualization
            updateAtlasVisualization();
        });
    });
}

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
        
        // Set texture parameters based on type
        if (textureType === 'baseColor') {
            texture.encoding = THREE.sRGBEncoding;
        } else {
            texture.encoding = THREE.LinearEncoding;
        }
        
        // Common texture settings for all types
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false; // Don't flip Y for GLB compatibility
        
        // Store the texture
        state.textureObjects[textureType] = texture;
        
        // Check if all textures are loaded to enable the start button
        checkStartButton();
        
        // Update atlas visualization if atlas tab is active
        if (atlasTab.classList.contains('active')) {
            updateAtlasVisualization();
        }
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
    
    // Make tab container visible as it will be populated later
    tabContainer.style.display = 'flex';
    
    // Force a reflow to ensure dimensions are calculated correctly
    void viewport.offsetWidth;
    
    // Hide loading indicator if it's visible
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
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
        // Hide loading indicator in case it's visible
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
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
    
    // Update all panels based on active tab
    if (atlasTab.classList.contains('active')) {
        updateAtlasVisualization();
    }
    if (uvTab.classList.contains('active')) {
        updateUvPanel();
    }
    if (rigTab.classList.contains('active')) {
        updateRigVisualization();
    }
}

// Load and setup the custom model
function loadAndSetupModel() {
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    // Load model file with appropriate loader
    const loader = new GLTFLoader();
    
    // Create a FileReader to read the selected file
    const reader = new FileReader();
    reader.onload = function(event) {
        // Parse the model data after reading
        const modelData = event.target.result;
        
        // Ensure we hide the loading indicator even if there's an error during parse
        try {
            loader.parse(modelData, '', (gltf) => {
                try {
                    // Clear existing model and meshes
                    clearScene();
                    
                    // Extract model from loaded gltf
                    state.model = gltf.scene;
                    
                    // Create base material with loaded textures
                    const baseMaterial = createMaterial();
                    
                    // Process all meshes in the model
                    state.model.traverse(node => {
                        if (node.isMesh) {
                            // Store original material to copy properties
                            const originalMaterial = node.material;
                            
                            // Create a new material for this mesh
                            const material = baseMaterial.clone();
                            
                            // Apply UV transformations from original material
                            if (originalMaterial.map && material.map) {
                                material.map.offset.copy(originalMaterial.map.offset);
                                material.map.repeat.copy(originalMaterial.map.repeat);
                                material.map.rotation = originalMaterial.map.rotation;
                            }
                            
                            // Check if the original material was transparent
                            if (originalMaterial.transparent || 
                                (originalMaterial.map && originalMaterial.map.image && 
                                 hasTransparentPixels(originalMaterial.map.image))) {
                                material.transparent = true;
                                material.alphaTest = 0.1;
                                // Only set alphaMap if we actually need transparency
                                material.alphaMap = state.textureObjects.baseColor;
                            }
                            
                            // Apply new material to mesh
                            node.material = material;
                            
                            // Create UV2 attribute if needed for aoMap
                            if (!node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                                node.geometry.attributes.uv2 = node.geometry.attributes.uv;
                            }
                            
                            // Add to meshes array for visibility control
                            state.meshes.push(node);
                        }
                    });
                    
                    // Add model to scene
                    state.scene.add(state.model);
                    
                    // Set up mesh visibility panel
                    createMeshVisibilityPanel();
                    
                    // Fit camera to model
                    fitCameraToObject(state.camera, state.model, state.controls);
                    
                    // Update UI panels based on active tab
                    if (atlasTab.classList.contains('active')) {
                        updateAtlasVisualization();
                    }
                    if (uvTab.classList.contains('active')) {
                        updateUvPanel();
                    }
                    if (rigTab.classList.contains('active')) {
                        updateRigVisualization();
                    }
                } catch (processError) {
                    console.error('Error processing model:', processError);
                    alert('Error processing model: ' + processError.message);
                }
                
                // Always hide loading indicator when finished
                const loadingIndicator = document.getElementById('loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
            }, undefined, function(error) {
                console.error('Error loading model:', error);
                alert('Error loading model. Please make sure it is a valid glTF/GLB file.');
                
                // Hide loading indicator on error
                const loadingIndicator = document.getElementById('loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
            });
        } catch (parseError) {
            console.error('Error parsing model data:', parseError);
            alert('Error parsing model data: ' + parseError.message);
            
            // Hide loading indicator on catch
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        alert('Error reading model file: ' + error);
        
        // Hide loading indicator on read error
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    };
    
    // Read the file as ArrayBuffer
    reader.readAsArrayBuffer(state.modelFile);
}

// Helper function to check if a texture has transparent pixels
function hasTransparentPixels(image) {
    // Create a canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    
    // Draw the image on the canvas
    ctx.drawImage(image, 0, 0);
    
    // Get the image data to check for transparency
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // Check if any pixel has alpha < 1.0
    for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] < 255) {
            return true;
        }
    }
    
    return false;
}

// Create a cube with textures
function createCube() {
    // Create cube geometry with UV2 for aoMap
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.attributes.uv2 = geometry.attributes.uv;
    
    // Create material with the loaded textures
    const material = createMaterial();
    
    // For the default cube, conditionally enable transparency
    if (state.textureObjects.baseColor && 
        state.textureObjects.baseColor.image && 
        hasTransparentPixels(state.textureObjects.baseColor.image)) {
        material.transparent = true;
        material.alphaTest = 0.1;
        material.alphaMap = state.textureObjects.baseColor;
    }
    
    // Create mesh and add to scene
    state.cube = new THREE.Mesh(geometry, material);
    state.cube.name = "Cube";
    state.scene.add(state.cube);
    
    // Add to meshes array for visibility control
    state.meshes = [state.cube];
    
    // Set up mesh visibility panel
    createMeshVisibilityPanel();
    
    // Update all panels based on active tab
    if (atlasTab.classList.contains('active')) {
        updateAtlasVisualization();
    }
    if (uvTab.classList.contains('active')) {
        updateUvPanel();
    }
    if (rigTab.classList.contains('active')) {
        updateRigVisualization();
    }
}

// Create a standard material with the loaded textures
function createMaterial() {
    // Set proper texture parameters for all textures
    if (state.textureObjects.baseColor) {
        state.textureObjects.baseColor.encoding = THREE.sRGBEncoding;
        state.textureObjects.baseColor.wrapS = THREE.RepeatWrapping;
        state.textureObjects.baseColor.wrapT = THREE.RepeatWrapping;
    }
    
    if (state.textureObjects.normal) {
        state.textureObjects.normal.encoding = THREE.LinearEncoding;
        state.textureObjects.normal.wrapS = THREE.RepeatWrapping;
        state.textureObjects.normal.wrapT = THREE.RepeatWrapping;
    }
    
    if (state.textureObjects.orm) {
        state.textureObjects.orm.encoding = THREE.LinearEncoding;
        state.textureObjects.orm.wrapS = THREE.RepeatWrapping;
        state.textureObjects.orm.wrapT = THREE.RepeatWrapping;
    }
    
    // Create material with properly configured textures - without transparency by default
    return new THREE.MeshStandardMaterial({
        map: state.textureObjects.baseColor,
        normalMap: state.textureObjects.normal,
        aoMap: state.textureObjects.orm,
        roughnessMap: state.textureObjects.orm,
        metalnessMap: state.textureObjects.orm,
        roughness: 1.0,
        metalness: 1.0,
        normalScale: new THREE.Vector2(1, 1),
        side: THREE.DoubleSide // Make material double-sided
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

// Clear the scene of existing model and meshes
function clearScene() {
    // Remove existing model from scene if it exists
    if (state.model) {
        state.scene.remove(state.model);
        state.model = null;
    }
    
    // Remove existing cube if it exists
    if (state.cube) {
        state.scene.remove(state.cube);
        state.cube = null;
    }
    
    // Clear meshes array
    state.meshes = [];
    
    // Clear mesh groups
    state.meshGroups = {};
}

// Handle window resize
function onWindowResize() {
    if (state.camera && state.renderer) {
        state.camera.aspect = viewport.clientWidth / viewport.clientHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
}

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

// Update the atlas visualization
function updateAtlasVisualization() {
    // Get the current texture type
    const textureType = state.currentTextureType;
    
    // Get the texture for the current type
    const texture = state.textureObjects[textureType];
    
    // Update the canvas with the texture
    if (texture && texture.image) {
        updateCanvasWithTexture(texture, state.currentUvRegion);
    } else {
        showNoTextureState();
    }
    
    // Update active state of texture type buttons
    textureTypeButtons.forEach(button => {
        if (button.dataset.textureType === textureType) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
        
        // Indicate which texture types have data available
        if (state.textureObjects[button.dataset.textureType]) {
            button.style.opacity = '1.0';
            button.style.fontWeight = 'bold';
        } else {
            button.style.opacity = '0.7';
            button.style.fontWeight = 'normal';
        }
    });
}

// Show "No texture loaded" message in the canvas
function showNoTextureState() {
    if (!atlasCanvas) return;
    
    const ctx = atlasCanvas.getContext('2d');
    
    // Clear canvas with dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    
    // Draw a border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, atlasCanvas.width - 2, atlasCanvas.height - 2);
    
    // Draw "No texture loaded" text
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No texture loaded', atlasCanvas.width / 2, atlasCanvas.height / 2 - 15);
    
    // Add additional help text
    ctx.font = '12px monospace';
    ctx.fillText('Drag and drop a texture to view', atlasCanvas.width / 2, atlasCanvas.height / 2 + 15);
    
    // Update the coordinates text
    if (coordsText) {
        coordsText.textContent = `No ${state.currentTextureType} texture loaded. Drag and drop a texture file to view.`;
    }
}

// Update the canvas with the texture
function updateCanvasWithTexture(texture, currentRegion = { min: [0, 0], max: [1, 1] }) {
    if (!atlasCanvas || !texture || !texture.image) return;
    
    const ctx = atlasCanvas.getContext('2d');
    
    // Set canvas size to match texture, with reasonable limits
    const maxWidth = 260; // Max width within container
    const maxHeight = 260; // Max height to prevent overly tall visualizations
    const ratio = texture.image.height / texture.image.width;
    
    // Clear canvas
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    
    // Draw the texture with proper scaling
    try {
        ctx.drawImage(texture.image, 0, 0, atlasCanvas.width, atlasCanvas.height);
    } catch (error) {
        console.error('Error drawing texture to canvas:', error);
    }
    
    // Add overlay grid for UV coordinates
    drawUvGrid(ctx, atlasCanvas.width, atlasCanvas.height);
    
    // Draw red highlight to show current region used on the model
    drawHighlightRegion(ctx, currentRegion, atlasCanvas.width, atlasCanvas.height);
    
    // Update coordinates text
    const isFullTexture = (currentRegion.min[0] === 0 && currentRegion.min[1] === 0 && 
                          currentRegion.max[0] === 1 && currentRegion.max[1] === 1);
                          
    if (isFullTexture) {
        coordsText.textContent = `${state.currentTextureType}: Full texture (0,0) to (1,1)`;
    } else {
        coordsText.textContent = `${state.currentTextureType}: (${currentRegion.min[0].toFixed(2)},${currentRegion.min[1].toFixed(2)}) to (${currentRegion.max[0].toFixed(2)},${currentRegion.max[1].toFixed(2)})`;
    }
}

// Draw a UV coordinate grid on the canvas
function drawUvGrid(ctx, width, height) {
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    // Draw vertical grid lines
    for (let i = 1; i < 10; i++) {
        const x = width * i / 10;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw horizontal grid lines
    for (let i = 1; i < 10; i++) {
        const y = height * i / 10;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Draw coordinate labels
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    
    // 0,0 at bottom left
    ctx.fillText('0,0', 2, height - 2);
    
    // 1,0 at bottom right
    ctx.fillText('1,0', width - 20, height - 2);
    
    // 0,1 at top left
    ctx.fillText('0,1', 2, 10);
    
    // 1,1 at top right
    ctx.fillText('1,1', width - 20, 10);
}

// Draw a highlight region on the canvas
function drawHighlightRegion(ctx, region, width, height) {
    // Draw highlight box
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Calculate rect coordinates (remember Y needs to be flipped)
    const x = width * region.min[0];
    const y = height * (1 - region.max[1]); // Flip Y because canvas coordinates are top-down
    const w = width * (region.max[0] - region.min[0]);
    const h = height * (region.max[1] - region.min[1]);
    
    ctx.rect(x, y, w, h);
    ctx.stroke();
    
    // Add semi-transparent fill
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fill();
}

// Update UV panel
function updateUvPanel() {
    if (!state.model || state.meshes.length === 0) {
        // Hide manual controls and show no data message
        uvManualControls.style.display = 'none';
        uvInfoContainer.innerHTML = `
            <p>No model loaded or no UV data available.</p>
            <p>Load a model to view UV information.</p>
        `;
        return;
    }
    
    // Analyze UV sets in the model
    analyzeUvSets();
    
    // If we have UV data, show controls and update info
    if (state.availableUvSets.length > 0) {
        uvManualControls.style.display = 'block';
        updateUvInfo();
        
        // Setup UV manual control handlers if not already done
        setupUvControls();
    } else {
        uvManualControls.style.display = 'none';
        uvInfoContainer.innerHTML = `
            <p>No UV data found in this model.</p>
            <p>The model doesn't contain any UV mapping information.</p>
        `;
    }
}

// Analyze UV sets available in the model
function analyzeUvSets() {
    state.availableUvSets = [];
    state.uvSetNames = [];
    
    // Return if no meshes
    if (!state.meshes || state.meshes.length === 0) return;
    
    // Collect all available UV sets from all meshes
    const uvSets = new Set();
    state.meshes.forEach(mesh => {
        if (mesh.geometry && mesh.geometry.attributes) {
            Object.keys(mesh.geometry.attributes).forEach(key => {
                if (key === 'uv' || key.startsWith('uv')) {
                    uvSets.add(key);
                }
            });
        }
    });
    
    // Convert to array and sort
    state.availableUvSets = Array.from(uvSets);
    state.availableUvSets.sort(); // Sort for consistent order
    
    // Create friendly names
    state.uvSetNames = state.availableUvSets.map(name => {
        if (name === 'uv') return 'UV Channel 0 (Default)';
        if (name === 'uv2') return 'UV Channel 1 (Secondary)';
        // Extract number for other UV channels
        const match = name.match(/uv(\d+)/);
        if (match) {
            return `UV Channel ${match[1]} (Custom)`;
        }
        return name;
    });
    
    // If we don't have a current set but have available sets, select the first
    if ((state.currentUvSet === undefined || state.currentUvSet >= state.availableUvSets.length) && 
        state.availableUvSets.length > 0) {
        state.currentUvSet = 0;
    }
}

// Update UV info display
function updateUvInfo() {
    // Exit if no UV sets
    if (state.availableUvSets.length === 0) return;
    
    // Get current UV set
    const currentSetName = state.availableUvSets[state.currentUvSet] || 'uv';
    
    // Build HTML content
    let content = '<div style="color: #f1c40f; font-weight: bold;">UV Channel Info:</div>';
    content += `<div>Channel Name: <span style="color: #3498db">${currentSetName}</span></div>`;
    
    // Get a sample mesh that has this UV set
    const sampleMesh = state.meshes.find(mesh => 
        mesh.geometry && mesh.geometry.attributes && 
        mesh.geometry.attributes[currentSetName]);
        
    if (sampleMesh) {
        // Get UV attribute
        const uvAttr = sampleMesh.geometry.attributes[currentSetName];
        
        // Add sample UV coordinates
        content += '<div style="margin-top: 5px; color: #f1c40f;">Sample UV Coordinates:</div>';
        content += `<div>From: <span style="color: #3498db">${sampleMesh.name || 'Unnamed mesh'}</span></div>`;
        
        // Get a few sample vertices
        const sampleCount = Math.min(5, uvAttr.count);
        let minU = 1, minV = 1, maxU = 0, maxV = 0;
        
        for (let i = 0; i < sampleCount; i++) {
            const u = uvAttr.getX(i);
            const v = uvAttr.getY(i);
            minU = Math.min(minU, u);
            minV = Math.min(minV, v);
            maxU = Math.max(maxU, u);
            maxV = Math.max(maxV, v);
            content += `<div>Vertex ${i}: <span style="color: #3498db">(${u.toFixed(4)}, ${v.toFixed(4)})</span></div>`;
        }
        
        if (uvAttr.count > sampleCount) {
            content += `<div>... and ${uvAttr.count - sampleCount} more vertices</div>`;
        }
        
        // Add UV range
        content += '<div style="margin-top: 5px; color: #f1c40f;">UV Range:</div>';
        content += `<div>U: <span style="color: #3498db">${minU.toFixed(4)} to ${maxU.toFixed(4)}</span></div>`;
        content += `<div>V: <span style="color: #3498db">${minV.toFixed(4)} to ${maxV.toFixed(4)}</span></div>`;
        
        // Add mesh statistics
        const meshesWithUv = state.meshes.filter(mesh => 
            mesh.geometry && mesh.geometry.attributes && 
            mesh.geometry.attributes[currentSetName]);
            
        content += '<div style="margin-top: 5px; color: #f1c40f;">Mesh Statistics:</div>';
        content += `<div>Meshes with this UV: <span style="color: #3498db">${meshesWithUv.length} of ${state.meshes.length}</span></div>`;
    } else {
        content += '<div style="color: #e74c3c;">No meshes use this UV channel</div>';
    }
    
    uvInfoContainer.innerHTML = content;
}

// Setup UV manual controls
function setupUvControls() {
    // Define common segment options
    const segments = [
        { name: 'Full texture (1×1)', u: 0, v: 0, w: 1, h: 1 },
        { name: 'Top-left quarter (1/2×1/2)', u: 0, v: 0, w: 0.5, h: 0.5 },
        { name: 'Top-right quarter (1/2×1/2)', u: 0.5, v: 0, w: 0.5, h: 0.5 },
        { name: 'Bottom-left quarter (1/2×1/2)', u: 0, v: 0.5, w: 0.5, h: 0.5 },
        { name: 'Bottom-right quarter (1/2×1/2)', u: 0.5, v: 0.5, w: 0.5, h: 0.5 },
        { name: 'Top-left ninth (1/3×1/3)', u: 0, v: 0, w: 0.33, h: 0.33 },
        { name: 'Top-center ninth (1/3×1/3)', u: 0.33, v: 0, w: 0.33, h: 0.33 },
        { name: 'Top-right ninth (1/3×1/3)', u: 0.66, v: 0, w: 0.33, h: 0.33 },
        { name: 'Middle-left ninth (1/3×1/3)', u: 0, v: 0.33, w: 0.33, h: 0.33 }
    ];
    
    // Function to apply mapping changes
    const applyMapping = () => {
        // Get values
        const offsetX = parseFloat(uvOffsetX.value) || 0;
        const offsetY = parseFloat(uvOffsetY.value) || 0;
        const scaleW = parseFloat(uvScaleW.value) || 1;
        const scaleH = parseFloat(uvScaleH.value) || 1;
        
        // Check if all values are valid
        if (offsetX < 0 || offsetX > 1 || 
            offsetY < 0 || offsetY > 1 || 
            scaleW <= 0 || scaleW > 1 || 
            scaleH <= 0 || scaleH > 1) {
            return;
        }
        
        // Apply mapping to all meshes
        state.meshes.forEach(mesh => {
            if (mesh.material) {
                // Apply to all texture maps
                const textureMaps = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'alphaMap'];
                
                textureMaps.forEach(mapName => {
                    if (mesh.material[mapName]) {
                        mesh.material[mapName].offset.set(offsetX, offsetY);
                        mesh.material[mapName].repeat.set(scaleW, scaleH);
                        mesh.material[mapName].needsUpdate = true;
                    }
                });
                
                mesh.material.needsUpdate = true;
            }
        });
        
        // Update the current UV region for visualization
        state.currentUvRegion = { 
            min: [offsetX, offsetY], 
            max: [offsetX + scaleW, offsetY + scaleH] 
        };
        
        // Update atlas visualization if active
        if (atlasTab.classList.contains('active')) {
            updateAtlasVisualization();
        }
    };
    
    // Set up event listeners if not already done
    uvOffsetX.addEventListener('input', applyMapping);
    uvOffsetY.addEventListener('input', applyMapping);
    uvScaleW.addEventListener('input', applyMapping);
    uvScaleH.addEventListener('input', applyMapping);
    
    // Set up predefined segments
    uvPredefinedSegments.addEventListener('change', function() {
        const selectedSegment = segments[this.value];
        
        // Update input fields
        uvOffsetX.value = selectedSegment.u;
        uvOffsetY.value = selectedSegment.v;
        uvScaleW.value = selectedSegment.w;
        uvScaleH.value = selectedSegment.h;
        
        // Apply the mapping immediately
        applyMapping();
    });
}

// Update rig visualization
function updateRigVisualization() {
    // Exit if no model
    if (!state.model) {
        rigStatus.textContent = 'No model loaded.';
        rigVisualizationControls.style.display = 'none';
        return;
    }
    
    // Extract rig data from the model
    const rigData = extractRigData();
    
    if (rigData.bones.length === 0) {
        // No rig data available
        rigStatus.textContent = 'No rig data available in the model.';
        rigVisualizationControls.style.display = 'none';
        return;
    }
    
    // We have rig data, show controls
    rigStatus.textContent = `Rig found: ${rigData.bones.length} bones`;
    rigVisualizationControls.style.display = 'block';
    
    // Display bone hierarchy
    displayBoneHierarchy(rigData);
    
    // Set up toggle button if not already done
    toggleRigButton.onclick = () => toggleRigVisualization();
}

// Extract rig data from the model
function extractRigData() {
    state.bones = [];
    state.skeleton = null;
    
    // Find skeletons and bones
    if (state.model) {
        state.model.traverse(object => {
            // Find skeleton
            if (object.isSkinnedMesh && object.skeleton && !state.skeleton) {
                state.skeleton = object.skeleton;
            }
            
            // Collect bones
            if (object.isBone) {
                state.bones.push(object);
            }
        });
    }
    
    return {
        bones: state.bones,
        skeleton: state.skeleton
    };
}

// Display bone hierarchy in the UI
function displayBoneHierarchy(rigData) {
    // Clear existing content
    boneHierarchy.innerHTML = '';
    
    if (rigData.bones.length === 0) {
        boneHierarchy.innerHTML = '<p>No bones found in the model.</p>';
        return;
    }
    
    // Find root bones (bones with no parent or parent outside our bone list)
    const rootBones = rigData.bones.filter(bone => {
        return !bone.parent || !rigData.bones.includes(bone.parent);
    });
    
    // If no root bones found, just display all bones in a flat list
    if (rootBones.length === 0) {
        rigData.bones.forEach(bone => {
            const boneItem = document.createElement('div');
            boneItem.className = 'bone-item';
            boneItem.textContent = bone.name || 'Unnamed bone';
            boneHierarchy.appendChild(boneItem);
        });
        return;
    }
    
    // Build hierarchy for each root bone
    rootBones.forEach(rootBone => {
        const rootItem = createBoneItem(rootBone);
        boneHierarchy.appendChild(rootItem);
    });
}

// Create a bone item with its children
function createBoneItem(bone, depth = 0) {
    const boneItem = document.createElement('div');
    boneItem.className = 'bone-item';
    
    // Create toggle for expandable items
    const toggle = document.createElement('span');
    toggle.className = 'bone-toggle';
    toggle.innerHTML = bone.children.length > 0 ? '&#9660; ' : '&#9642; ';
    
    // Create name element
    const nameSpan = document.createElement('span');
    nameSpan.textContent = bone.name || 'Unnamed bone';
    
    // Add to bone item
    boneItem.appendChild(toggle);
    boneItem.appendChild(nameSpan);
    
    // If bone has children, create a container for them
    if (bone.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'bone-children';
        childrenContainer.style.display = 'block'; // Start expanded
        
        // Create items for children
        bone.children.forEach(childBone => {
            // Only process actual bone objects
            if (childBone.isBone) {
                const childItem = createBoneItem(childBone, depth + 1);
                childrenContainer.appendChild(childItem);
            }
        });
        
        // Add click handler to toggle
        toggle.style.cursor = 'pointer';
        toggle.onclick = () => {
            if (childrenContainer.style.display === 'none') {
                childrenContainer.style.display = 'block';
                toggle.innerHTML = '&#9660; ';
            } else {
                childrenContainer.style.display = 'none';
                toggle.innerHTML = '&#9654; ';
            }
        };
        
        // Add children container
        boneItem.appendChild(childrenContainer);
    }
    
    return boneItem;
}

// Toggle bone visualization
function toggleRigVisualization() {
    if (state.isBoneVisualizationVisible) {
        // Hide visualization
        if (state.boneVisualization) {
            state.boneVisualization.traverse(obj => {
                if (obj.visible !== undefined) {
                    obj.visible = false;
                }
            });
        }
        state.isBoneVisualizationVisible = false;
        toggleRigButton.textContent = 'Show Rig Visualization';
    } else {
        // Show or create visualization
        if (!state.boneVisualization) {
            createBoneVisualization();
        } else {
            state.boneVisualization.traverse(obj => {
                if (obj.visible !== undefined) {
                    obj.visible = true;
                }
            });
        }
        state.isBoneVisualizationVisible = true;
        toggleRigButton.textContent = 'Hide Rig Visualization';
    }
}

// Create bone visualization
function createBoneVisualization() {
    // Exit if no bones
    if (!state.bones || state.bones.length === 0) return;
    
    // Create a group to hold all bone visualizations
    const boneGroup = new THREE.Group();
    boneGroup.name = 'BoneVisualization';
    
    // Calculate a reasonable size for bone visualization
    let modelSize = 1;
    const box = new THREE.Box3().setFromObject(state.model);
    modelSize = box.getSize(new THREE.Vector3()).length() / 100;
    
    // Create a visualization for each bone
    state.bones.forEach(bone => {
        // Create a bone representation
        const boneVisual = createBoneVisual(bone, modelSize);
        if (boneVisual) {
            boneGroup.add(boneVisual);
        }
    });
    
    // Add the group to the scene
    state.scene.add(boneGroup);
    state.boneVisualization = boneGroup;
}

// Create a visual representation of a bone
function createBoneVisual(bone, baseSize) {
    if (!bone) return null;
    
    // Create a group for this bone
    const boneGroup = new THREE.Group();
    boneGroup.name = `BoneVisual_${bone.name || 'unnamed'}`;
    
    // Position at the bone's world position
    bone.updateWorldMatrix(true, false);
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(bone.matrixWorld);
    boneGroup.position.copy(position);
    
    // Create a sphere to represent the bone joint
    const sphereGeometry = new THREE.SphereGeometry(baseSize, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff9900,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    boneGroup.add(sphere);
    
    // If bone has a parent, create a line to it
    if (bone.parent && bone.parent.isBone) {
        bone.parent.updateWorldMatrix(true, false);
        const parentPosition = new THREE.Vector3();
        parentPosition.setFromMatrixPosition(bone.parent.matrixWorld);
        
        // Create line geometry
        const points = [
            new THREE.Vector3(0, 0, 0), // Local origin
            new THREE.Vector3().subVectors(parentPosition, position) // Vector to parent
        ];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Create line material
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 1,
            transparent: true,
            opacity: 0.6
        });
        
        // Create line
        const line = new THREE.Line(lineGeometry, lineMaterial);
        boneGroup.add(line);
    }
    
    return boneGroup;
}

// Initialize the app
function init() {
    // Setup tabs
    setupTabs();
    
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
            startButton.textContent = 'Restart';
        } else {
            // Clean up previous scene
            if (state.animationId) {
                cancelAnimationFrame(state.animationId);
            }
            
            // Restart scene
            initScene();
        }
    });
    
    // Setup restart button (new)
    const restartButton = document.getElementById('restart-debug');
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // Reload the entire page to completely restart the tool
            window.location.reload();
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for external use
export {
    init
}; 