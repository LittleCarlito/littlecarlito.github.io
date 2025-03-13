import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Main variables
let scene, camera, renderer, controls;
let modelFile, textureFile;
let modelObject, textureObject;
let meshes = [];
let isDebugMode = false;
let currentUvSet = 0; // Track which UV set is currently displayed
let availableUvSets = []; // Available UV sets across all meshes
let uvSetNames = []; // Names of UV sets
let originalUvData = new WeakMap(); // Store original UV data for each mesh

// New variables for multi-texture material editor
let textures = []; // Array to store multiple textures
let activeTextures = {}; // Map of UV channel to texture index
let blendModes = {}; // Map of UV channel to blend mode
let textureIntensities = {}; // Map of UV channel to intensity
let isMultiTextureMode = false; // Toggle for multi-texture mode

// Initialize the application
function init() {
  console.log('Atlas UV Mapping Debug Tool initialized');
  
  // Setup the scene, renderer and camera (hidden initially)
  setupThreeJS();
  
  // Setup drag and drop functionality
  setupDragAndDrop();
  
  // Create the atlas visualization
  createAtlasVisualization();
  
  // Hide loading screen
  setTimeout(() => {
    document.getElementById('loading').style.display = 'none';
  }, 500);
}

// Setup Three.js scene, camera, renderer
function setupThreeJS() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // Set up camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 1;
  camera.position.y = 0.5;

  // Set up renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'none'; // Hide canvas initially

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  controls.update();
  renderer.render(scene, camera);
}

// Setup drag and drop functionality
function setupDragAndDrop() {
  const dropZoneModel = document.getElementById('drop-zone-model');
  const dropZoneTexture = document.getElementById('drop-zone-texture');
  const startButton = document.getElementById('start-button');
  const modelFileInfo = document.getElementById('model-file-info');
  const textureFileInfo = document.getElementById('texture-file-info');
  
  // Drag events - prevent defaults to allow dropping
  [dropZoneModel, dropZoneTexture].forEach(dropZone => {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Highlight drop zone on drag over
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZoneModel.addEventListener(eventName, () => {
      dropZoneModel.classList.add('active');
    }, false);
    
    dropZoneTexture.addEventListener(eventName, () => {
      dropZoneTexture.classList.add('active');
    }, false);
  });
  
  // Remove highlight on drag leave
  ['dragleave', 'drop'].forEach(eventName => {
    dropZoneModel.addEventListener(eventName, () => {
      dropZoneModel.classList.remove('active');
    }, false);
    
    dropZoneTexture.addEventListener(eventName, () => {
      dropZoneTexture.classList.remove('active');
    }, false);
  });
  
  // Handle model file drop
  dropZoneModel.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Check if it's a GLB file
      if (file.name.toLowerCase().endsWith('.glb')) {
        modelFile = file;
        modelFileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        dropZoneModel.classList.add('has-file');
        checkFilesReady();
          } else {
        alert('Please drop a valid GLB file.');
      }
    }
  }, false);
  
  // Handle texture file drop
  dropZoneTexture.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Check if it's an image file
      if (file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/)) {
        textureFile = file;
        textureFileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        dropZoneTexture.classList.add('has-file');
        checkFilesReady();
      } else {
        alert('Please drop a valid image file (JPG, PNG, WEBP).');
      }
    }
  }, false);
  
  // Check if both files are ready and enable start button
  function checkFilesReady() {
    if (modelFile && textureFile) {
      startButton.disabled = false;
      startButton.style.display = 'inline-block';
    }
  }
  
  // Handle click on start button
  startButton.addEventListener('click', () => {
    startDebugging();
  });
  
  // Also allow clicking on drop zones to select files
  dropZoneModel.addEventListener('click', () => {
    triggerFileInput('glb');
  });
  
  dropZoneTexture.addEventListener('click', () => {
    triggerFileInput('image');
  });
  
  // Create temporary file input for clicks
  function triggerFileInput(type) {
    const input = document.createElement('input');
    input.type = 'file';
    
    if (type === 'glb') {
      input.accept = '.glb';
      input.onchange = e => {
        if (e.target.files.length) {
          const file = e.target.files[0];
          modelFile = file;
          modelFileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
          dropZoneModel.classList.add('has-file');
          checkFilesReady();
        }
      };
    } else {
      input.accept = 'image/jpeg, image/png, image/webp';
      input.onchange = e => {
        if (e.target.files.length) {
          const file = e.target.files[0];
          textureFile = file;
          textureFileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
          dropZoneTexture.classList.add('has-file');
          checkFilesReady();
        }
      };
    }
    
    input.click();
  }
}

// Format file size in KB or MB
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' bytes';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
          } else {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Get file extension
function getFileExtension(filename) {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

// Start debugging with the loaded files
function startDebugging() {
  isDebugMode = true;
  
  // Hide drop container and show scene
  document.getElementById('drop-container').style.display = 'none';
  renderer.domElement.style.display = 'block';
  
  // Show loading screen again while loading files
  document.getElementById('loading').style.display = 'flex';
  document.querySelector('#loading div:last-child').textContent = 'Loading your files...';
  
  // Load model and texture
  loadModelFromFile(modelFile);
  
  // Use the user's actual texture, not the procedural one
  if (textureFile) {
    loadTextureFromFile(textureFile);
  } else {
    // Only use procedural texture if no user texture is provided
    loadNumberAtlasTexture();
  }
  
  // Add a button to toggle multi-texture editor
  const debugPanel = document.getElementById('debug-panel');
  if (debugPanel) {
    const multiTextureButton = document.createElement('button');
    multiTextureButton.textContent = 'Multi-Texture Editor';
    multiTextureButton.className = 'debug-button';
    multiTextureButton.style.marginTop = '10px';
    multiTextureButton.style.width = '100%';
    multiTextureButton.style.padding = '8px';
    multiTextureButton.style.backgroundColor = '#3498db';
    
    multiTextureButton.addEventListener('click', () => {
      const editor = document.getElementById('multi-texture-editor');
      if (editor) {
        // Toggle visibility
        if (editor.style.display === 'none') {
          editor.style.display = 'block';
          updateMultiTextureEditor();
          multiTextureButton.textContent = 'Hide Multi-Texture Editor';
        } else {
          editor.style.display = 'none';
          multiTextureButton.textContent = 'Multi-Texture Editor';
        }
      }
    });
    
    // Add the button to the top of the debug panel
    debugPanel.insertBefore(multiTextureButton, debugPanel.firstChild);
  }
}

// Load model from dropped file
function loadModelFromFile(file) {
  const loader = new GLTFLoader();
  
  // Convert file to array buffer
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    
    // Load the model from array buffer
    loader.parse(arrayBuffer, '', (gltf) => {
      modelObject = gltf.scene;
      scene.add(modelObject);
      
      // Center model
      const box = new THREE.Box3().setFromObject(modelObject);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Reset model position to center
      modelObject.position.x = -center.x;
      modelObject.position.y = -center.y;
      modelObject.position.z = -center.z;
      
      // Set camera position based on model size
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // Add some extra space
      camera.position.z = cameraZ;
  
      // Set camera target to model center
      controls.target.set(0, 0, 0);
  controls.update();
      
      // Process model structure
      analyzeModelStructure();
      
      // Update model info in the debug panel
      updateModelInfo();
      
      // Show debug panel
      document.getElementById('debug-panel').style.display = 'block';
      
      // Check if both model and texture are loaded
      checkLoadingComplete();
    }, undefined, (error) => {
      console.error('Error loading model:', error);
      alert('Error loading the model file. Please try a different file.');
      resetToDropZone();
    });
  };
  
  reader.readAsArrayBuffer(file);
}

// Load texture from dropped file
function loadTextureFromFile(file) {
  console.log('Loading user-provided texture file:', file.name);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(e.target.result, (texture) => {
      textureObject = texture;
      texture.flipY = false; // Often needed for GLB textures
      
      // Important - ensure proper texture settings for consistent behavior
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter; 
      texture.magFilter = THREE.LinearFilter;

      console.log('Successfully loaded user texture:', texture);
      
      // Update texture info in the debug panel
      updateTextureInfo();
      
      // If model is already loaded, apply texture
      if (modelObject) {
        applyTextureToModel();
      }
      
      // Check if both model and texture are loaded
      checkLoadingComplete();
    }, undefined, (error) => {
      console.error('Error loading texture:', error);
      alert('Error loading the texture file. Please try a different file.');
      resetToDropZone();
    });
  };
  
  reader.readAsDataURL(file);
}

// Apply loaded texture to model, prioritizing emissive maps for screen surfaces
function applyTextureToModel() {
  if (!modelObject || !textureObject) return;
  
  console.log('Applying texture to model...');
  console.log('Texture object:', textureObject);
  
  // Find all screen meshes and store their original materials
  modelObject.traverse((child) => {
    if (child.isMesh && child.material) {
      // Store original material for later reference
      child.userData.originalMaterial = child.material.clone();
      
      const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                         child.name.toLowerCase().includes('display') ||
                         child.name.toLowerCase().includes('monitor');
      
      if (isScreenMesh) {
        console.log(`Setting up screen mesh: ${child.name}`);
        
        // Log available UV sets on this mesh
        if (child.geometry) {
          let uvSetInfo = 'UV Sets: ';
          // Check for any UV attributes directly instead of using the mapping
          const potentialUvAttributes = [];
          for (let i = 0; i < 8; i++) {
            potentialUvAttributes.push(i === 0 ? 'uv' : `uv${i+1}`);
          }
          
          potentialUvAttributes.forEach(attrName => {
            if (child.geometry.attributes[attrName]) {
              uvSetInfo += `${attrName}, `;
            }
          });
          console.log(uvSetInfo);
        }
        
        // Create a fresh material to avoid affecting other meshes
        const material = new THREE.MeshStandardMaterial();
        
        // Copy important properties from original material
        material.roughness = 0.1; // Make it slightly glossy
        material.metalness = 0.2;
        
        // Apply the texture - IMPORTANT: Clone to avoid cross-mesh references
        material.map = textureObject.clone();
        
        // Make sure screen is visible with emissive
        material.emissiveMap = material.map;
        material.emissive.set(1, 1, 1); // Full emissive intensity
        
        // Start with no offset/repeat modification
        material.map.offset.set(0, 0);
        material.map.repeat.set(1, 1);
        
        // Make sure texture settings are applied
        material.map.needsUpdate = true;
        material.needsUpdate = true;
        
        // Apply to mesh
        child.material = material;
      }
    }
  });
  
  // Draw or update the atlas visualization with default offset/repeat
  updateAtlasVisualization(new THREE.Vector2(0, 0), new THREE.Vector2(1, 1));
  
  // After applying the texture, switch to the current UV channel to ensure proper display
  if (currentUvSet < availableUvSets.length) {
    switchUvChannel(availableUvSets[currentUvSet]);
  }
  
  console.log('Texture applied to model');
}

// Analyze model structure and collect meshes
function analyzeModelStructure() {
  meshes = [];
  
  // Reset UV sets
  availableUvSets = [];
  uvSetNames = [];
  
  // Create a list of potential UV attributes to check for in the model
  // In Three.js, UV channels follow the pattern: uv, uv2, uv3, etc.
  const potentialUvAttributes = [];
  for (let i = 0; i < 8; i++) { // Check up to 8 possible UV channels (arbitrary limit)
    potentialUvAttributes.push(i === 0 ? 'uv' : `uv${i+1}`);
  }
  
  // Track which channels exist in the model
  const detectedUvChannels = new Map();
  
  // First pass: collect all meshes and detect UV channels
  modelObject.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child);
      
      // Check which UV channels this mesh has
      if (child.geometry) {
        const meshUvChannels = [];
        
        potentialUvAttributes.forEach(attrName => {
          if (child.geometry.attributes[attrName]) {
            // If this channel wasn't detected before, add it
            if (!detectedUvChannels.has(attrName)) {
              detectedUvChannels.set(attrName, {
                count: 0,
                minU: Infinity,
                maxU: -Infinity,
                minV: Infinity,
                maxV: -Infinity,
                sampleUVs: null, // Store sample UVs for analysis
                sampleMesh: null
              });
            }
            
            // Track this channel for the current mesh
            meshUvChannels.push(attrName);
            
            // Analyze UV data to understand its characteristics
            const attr = child.geometry.attributes[attrName];
            const info = detectedUvChannels.get(attrName);
            info.count++;
            
            // Store sample UVs for analysis
            if (!info.sampleUVs && child.name.toLowerCase().includes('screen')) {
              info.sampleUVs = attr.array;
              info.sampleMesh = child;
            }
            
            // Analyze UV bounds
            for (let i = 0; i < attr.count; i++) {
              const u = attr.array[i * 2];
              const v = attr.array[i * 2 + 1];
              
              info.minU = Math.min(info.minU, u);
              info.maxU = Math.max(info.maxU, u);
              info.minV = Math.min(info.minV, v);
              info.maxV = Math.max(info.maxV, v);
      }
    }
  });
  
        // Log detailed information for screen meshes
        if (child.name.toLowerCase().includes('screen') || 
            child.name.toLowerCase().includes('display') || 
            child.name.toLowerCase().includes('monitor')) {
          console.log(`Found screen mesh: ${child.name}`);
          console.log(`Screen mesh UV channels:`, meshUvChannels);
        }
      }
    }
  });
  
  // Analyze detected UV channels to determine potential roles
  detectedUvChannels.forEach((info, channelName) => {
    // Guess if this might be a tiling/repeating UV channel
    const isTiling = info.minU < 0 || info.maxU > 1 || info.minV < 0 || info.maxV > 1;
    
    // Guess if this might be using a specific section of a texture atlas
    // This is just a heuristic - we look for UV coordinates concentrated in a specific region
    const uRange = info.maxU - info.minU;
    const vRange = info.maxV - info.minV;
    const isPotentiallyAtlasSection = !isTiling && (uRange < 0.5 || vRange < 0.5);

    // Generate a friendly name based on what we've detected
    let displayName = `${channelName.toUpperCase()} - `;
    
    // Add channel characteristics to the name for better understanding
    if (isTiling) {
      displayName += "Tiling";
    } else if (isPotentiallyAtlasSection) {
      displayName += "Partial Texture Region";
    } else {
      displayName += "Full Texture";
    }
    
    // Add range information
    displayName += ` (U: ${info.minU.toFixed(2)}-${info.maxU.toFixed(2)}, V: ${info.minV.toFixed(2)}-${info.maxV.toFixed(2)})`;
    
    console.log(`Detected ${channelName}: ${displayName} on ${info.count} meshes`);
    
    // Store channel information
    if (!availableUvSets.includes(channelName)) {
      availableUvSets.push(channelName);
      uvSetNames.push(displayName);
    }
  });
  
  // Log information about detected channels
  console.log('Detected UV channels:', availableUvSets);
  console.log('UV channel display names:', uvSetNames);
  
  // Create mesh toggle buttons
  createMeshToggles();
  
  // Set up UV switcher
  setupUvSwitcher();
}

// Create toggle buttons for all meshes
function createMeshToggles() {
  const meshTogglesContainer = document.getElementById('mesh-toggles');
  meshTogglesContainer.innerHTML = '';
  
  // Group meshes by parent name for better organization
  const meshGroups = {};
  
  meshes.forEach(mesh => {
    const parentName = mesh.parent ? (mesh.parent.name || 'unnamed_parent') : 'root';
    
    if (!meshGroups[parentName]) {
      meshGroups[parentName] = [];
    }
    
    meshGroups[parentName].push(mesh);
  });
  
  // Create toggle for each mesh group
  for (const groupName in meshGroups) {
    const group = meshGroups[groupName];
    
    const groupDiv = document.createElement('div');
    groupDiv.style.marginBottom = '10px';
    
    const groupLabel = document.createElement('div');
    groupLabel.textContent = `Group: ${groupName} (${group.length} mesh${group.length > 1 ? 'es' : ''})`;
    groupLabel.style.marginBottom = '5px';
    groupLabel.style.fontWeight = 'bold';
    groupDiv.appendChild(groupLabel);
    
    // Toggle button for the entire group
    const groupToggle = document.createElement('button');
    groupToggle.textContent = 'Toggle Group';
    groupToggle.className = 'debug-button';
    groupToggle.addEventListener('click', () => {
      const someVisible = group.some(mesh => mesh.visible);
      group.forEach(mesh => {
        // Toggle opposite of current state
        mesh.visible = !someVisible;
      });
    });
    groupDiv.appendChild(groupToggle);
    
    // Show all meshes in group
    const meshList = document.createElement('div');
    meshList.style.marginLeft = '10px';
    
    group.forEach(mesh => {
      const meshDiv = document.createElement('div');
      meshDiv.style.margin = '5px 0';
      
      const toggle = document.createElement('button');
      toggle.textContent = mesh.name || 'Unnamed Mesh';
      toggle.className = 'debug-button';
      toggle.style.backgroundColor = mesh.visible ? '#3498db' : '#95a5a6';
      
      toggle.addEventListener('click', () => {
        mesh.visible = !mesh.visible;
        toggle.style.backgroundColor = mesh.visible ? '#3498db' : '#95a5a6';
      });
      
      meshDiv.appendChild(toggle);
      meshList.appendChild(meshDiv);
    });
    
    groupDiv.appendChild(meshList);
    meshTogglesContainer.appendChild(groupDiv);
  }
}

// Setup UV set switcher
function setupUvSwitcher() {
  const uvInfoSection = document.getElementById('uv-info-section');
  
  // Clear previous content
  uvInfoSection.innerHTML = '';
  
  // Create label
  const uvLabel = document.createElement('div');
  uvLabel.className = 'debug-label';
  uvLabel.textContent = 'UV Information:';
  uvInfoSection.appendChild(uvLabel);
  
  // If no UV sets found
  if (availableUvSets.length === 0) {
    const noUvInfo = document.createElement('div');
    noUvInfo.className = 'debug-value';
    noUvInfo.textContent = 'No UV data found in this model.';
    uvInfoSection.appendChild(noUvInfo);
    return;
  }
  
  // Create UV controls
  const uvControls = document.createElement('div');
  uvControls.id = 'uv-controls';
  uvControls.style.marginBottom = '10px';
  
  // Create a label for the dropdown
  const dropdownLabel = document.createElement('div');
  dropdownLabel.textContent = 'Select UV Channel:';
  dropdownLabel.style.marginBottom = '5px';
  uvControls.appendChild(dropdownLabel);
  
  // Create select dropdown
  const select = document.createElement('select');
  select.style.backgroundColor = '#333';
  select.style.color = 'white';
  select.style.padding = '5px';
  select.style.border = '1px solid #555';
  select.style.borderRadius = '3px';
  select.style.marginBottom = '10px';
  select.style.width = '100%';
  
  // Add options for each UV set
  uvSetNames.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = name;
    select.appendChild(option);
  });
  
  // Set current value
  select.value = currentUvSet;
  
  // Add change event
  select.addEventListener('change', function() {
    currentUvSet = parseInt(this.value);
    switchUvChannel(availableUvSets[currentUvSet]);
    updateUvInfo();
  });
  
  uvControls.appendChild(select);
  uvInfoSection.appendChild(uvControls);
  
  // Add UV info container
  const uvInfoContainer = document.createElement('div');
  uvInfoContainer.id = 'uv-info';
  uvInfoContainer.className = 'debug-value';
  uvInfoSection.appendChild(uvInfoContainer);
  
  // Update the UV info display
  updateUvInfo();
}

// Switch UV channel for all meshes
function switchUvChannel(uvChannel) {
  console.log(`Switching to UV channel: ${uvChannel}`);
  
  // Track how many meshes were affected
  let meshesWithThisUV = 0;
  let screenMeshesProcessed = 0;
  
  // Default offset and repeat for visualization (always show full texture)
  let currentOffset = new THREE.Vector2(0, 0);
  let currentRepeat = new THREE.Vector2(1, 1);
  
  modelObject.traverse((child) => {
    if (child.isMesh) {
      // Store original material if not already done
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material.clone();
      }
      
      // Check if this is a screen/display mesh
      const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                          child.name.toLowerCase().includes('display') || 
                          child.name.toLowerCase().includes('monitor');
      
      // Special handling for screen meshes
      if (isScreenMesh) {
        screenMeshesProcessed++;
        
        // Check if this mesh has this UV channel
        const hasUvChannel = child.geometry && child.geometry.attributes[uvChannel] !== undefined;
        
        // Log for debugging
        console.log(`Processing screen mesh: ${child.name}, has ${uvChannel}: ${hasUvChannel}`);
        
        // Only apply texture if the mesh has this UV channel
        if (textureObject && hasUvChannel) {
          meshesWithThisUV++;
          
          // Create a fresh material
          const newMaterial = new THREE.MeshStandardMaterial();
          newMaterial.roughness = 0.1;
          newMaterial.metalness = 0.2;
          
          // Clone the texture to avoid affecting other materials
          const tex = textureObject.clone();
          
          // Reset offset/repeat - we're using the actual UV coordinates
          tex.offset.set(0, 0);
          tex.repeat.set(1, 1);
          
          // Set which UV channel the texture should use
          const uvIndex = parseInt(uvChannel.replace('uv', '')) || 0;
          
          // Important change: Define UV transform for materials
          // We need to modify the material to use the specific UV channel
          if (uvIndex === 0) {
            // For default UV (uv), restore original UV data if we stored it
            if (originalUvData.has(child)) {
              // Restore the original UV data
              child.geometry.attributes.uv = originalUvData.get(child);
              console.log(`Restored original UV data for ${child.name}`);
            } else {
              console.log(`Using default UV mapping for ${child.name} (no stored original)`);
            }
          } else {
            // For non-default UV channels, store original UV data if we haven't already
            if (!originalUvData.has(child) && child.geometry.attributes.uv) {
              // Store a clone of the original UV attribute
              originalUvData.set(child, child.geometry.attributes.uv.clone());
              console.log(`Stored original UV data for ${child.name}`);
            }
            
            if (uvIndex === 2) {
              // For uv2, use THREE.UVMapping and set uvTransform
              newMaterial.defines = newMaterial.defines || {};
              newMaterial.defines.USE_UV = '';
              newMaterial.defines.USE_UV2 = '';
              
              // Force material to use uv2
              child.geometry.attributes.uv = child.geometry.attributes.uv2;
              console.log(`Mapped UV2 to UV for ${child.name}`);
            } else if (uvIndex === 3) {
              // For uv3, use THREE.UVMapping and set uvTransform
              newMaterial.defines = newMaterial.defines || {};
              newMaterial.defines.USE_UV = '';
              newMaterial.defines.USE_UV3 = '';
              
              // Force material to use uv3
              child.geometry.attributes.uv = child.geometry.attributes.uv3;
              console.log(`Mapped UV3 to UV for ${child.name}`);
            } else if (uvIndex > 3) {
              console.log(`Warning: ${uvChannel} (index ${uvIndex}) exceeds Three.js support`);
              // For higher UV indices, we need a custom approach
              child.geometry.attributes.uv = child.geometry.attributes[uvChannel];
              console.log(`Mapped ${uvChannel} to UV for ${child.name}`);
            }
          }
          
          // Apply the texture
          newMaterial.map = tex;
          newMaterial.emissiveMap = tex;
          newMaterial.emissive.set(1, 1, 1);
          
          // Apply the material
          child.material = newMaterial;
          child.material.needsUpdate = true;
          tex.needsUpdate = true;
        }
        // Fallback for missing UV channel
        else if (isScreenMesh && !hasUvChannel) {
          console.log(`Applying fallback material for ${child.name} - missing ${uvChannel}`);
          // Apply a simple colored material for channels that don't exist
          const fallbackMaterial = new THREE.MeshStandardMaterial({
            emissive: new THREE.Color(0.5, 0.5, 0.5),
            color: new THREE.Color(0.8, 0.8, 0.8)
          });
          child.material = fallbackMaterial;
        }
      } 
      // Regular non-screen mesh handling
      else if (child.geometry && textureObject) {
        const hasUvChannel = child.geometry.attributes[uvChannel] !== undefined;
        
        // Only apply if this mesh has this UV channel
        if (hasUvChannel) {
          meshesWithThisUV++;
          
          // Get UV index (0 for uv, 1 for uv2, etc.)
          const uvIndex = parseInt(uvChannel.replace('uv', '')) || 0;
          
          // Only apply UV channel switching for supported channels
          if (uvIndex <= 8) {
            // Apply texture with the correct UV channel
            const newMaterial = child.userData.originalMaterial.clone();
            newMaterial.map = textureObject.clone();
            
            // Reset texture transform - use the actual UV coordinates
            newMaterial.map.offset.set(0, 0);
            newMaterial.map.repeat.set(1, 1);
            
            // Important change: Use the same UV mapping approach as for screen meshes
            if (uvIndex === 0) {
              // For default UV, restore original data if available
              if (originalUvData.has(child)) {
                child.geometry.attributes.uv = originalUvData.get(child);
                console.log(`Restored original UV data for ${child.name}`);
              }
            } else {
              // For non-default UV channels, store original UV data if not already stored
              if (!originalUvData.has(child) && child.geometry.attributes.uv) {
                originalUvData.set(child, child.geometry.attributes.uv.clone());
                console.log(`Stored original UV data for ${child.name}`);
              }
              
              // For higher UV indices, temporarily map to the first UV channel
              child.geometry.attributes.uv = child.geometry.attributes[uvChannel];
              console.log(`Mapped ${uvChannel} to UV for ${child.name}`);
            }
            
            // Apply material
            child.material = newMaterial;
            child.material.needsUpdate = true;
          }
        }
      }
    }
  });
  
  console.log(`Applied ${uvChannel} to ${meshesWithThisUV} meshes (${screenMeshesProcessed} screen meshes)`);
  
  // Update the atlas visualization with current offset/repeat
  updateAtlasVisualization(currentOffset, currentRepeat);
  
  // Force a re-render
  renderer.render(scene, camera);
}

// Update UV information display
function updateUvInfo() {
  if (!modelObject || availableUvSets.length === 0) return;
  
  const uvInfo = document.getElementById('uv-info');
  const currentChannel = availableUvSets[currentUvSet];
  
  // Count the number of meshes that have this UV channel
  let meshCount = 0;
  let screenMeshCount = 0;
  let totalVertices = 0;
  let maxUCoord = -Infinity;
  let minUCoord = Infinity;
  let maxVCoord = -Infinity;
  let minVCoord = Infinity;
  
  // Sample mesh with this UV channel
  let sampleMesh = null;
  let sampleUvs = null;
  
  modelObject.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes[currentChannel]) {
      meshCount++;
      
      // Track screen meshes separately
      const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                          child.name.toLowerCase().includes('display') ||
                          child.name.toLowerCase().includes('monitor');
      if (isScreenMesh) {
        screenMeshCount++;
      }
      
      const uvAttribute = child.geometry.attributes[currentChannel];
      totalVertices += uvAttribute.count;
      
      // Find the min/max U/V values
      const uvArray = uvAttribute.array;
      for (let i = 0; i < uvAttribute.count; i++) {
        const u = uvArray[i * 2];
        const v = uvArray[i * 2 + 1];
        
        maxUCoord = Math.max(maxUCoord, u);
        minUCoord = Math.min(minUCoord, u);
        maxVCoord = Math.max(maxVCoord, v);
        minVCoord = Math.min(minVCoord, v);
      }
      
      // Save a sample mesh for displaying UV coordinates
      if (!sampleMesh && isScreenMesh) {
        sampleMesh = child;
        sampleUvs = uvArray;
      }
    }
  });
  
  // Analyze UV data to classify what kind of mapping this might be
  let mappingType = "Unknown";
  let atlasRegion = "Full Texture";
  
  if (maxUCoord > 1 || minUCoord < 0 || maxVCoord > 1 || minVCoord < 0) {
    mappingType = "Tiling / Repeating";
  } else {
    mappingType = "Standard (0-1 Range)";
    
    // Check if it's using a small portion of the texture
    const uRange = maxUCoord - minUCoord;
    const vRange = maxVCoord - minVCoord;
    
    if (uRange < 0.5 || vRange < 0.5) {
      // Estimate which region of the texture is being used
      const uCenter = (minUCoord + maxUCoord) / 2;
      const vCenter = (minVCoord + maxVCoord) / 2;
      
      if (uCenter < 0.33) atlasRegion = "Left";
      else if (uCenter > 0.66) atlasRegion = "Right";
      else atlasRegion = "Center";
      
      if (vCenter < 0.33) atlasRegion += " Top";
      else if (vCenter > 0.66) atlasRegion += " Bottom";
      else atlasRegion += " Middle";
      
      atlasRegion += ` (${(uRange * 100).toFixed(0)}% × ${(vRange * 100).toFixed(0)}% of texture)`;
    }
  }
  
  // Create info text
  let infoHTML = `
    <div style="margin-bottom: 10px; padding: 8px; background-color: #333; border-radius: 4px;">
      <div style="font-weight: bold; color: #ffcc00; margin-bottom: 5px;">UV Channel Info:</div>
      <div><b>Channel Name:</b> ${currentChannel}</div>
      <div><b>Mapping Type:</b> ${mappingType}</div>
      <div><b>Texture Usage:</b> ${atlasRegion}</div>
    </div>
    
    <div style="margin-bottom: 10px; padding: 8px; background-color: #333; border-radius: 4px;">
      <div style="font-weight: bold; color: #ffcc00; margin-bottom: 5px;">Mesh Statistics:</div>
      <div><b>Meshes with this UV:</b> ${meshCount} of ${meshes.length}</div>
      <div><b>Screen Meshes:</b> ${screenMeshCount}</div>
      <div><b>Total Vertices:</b> ${totalVertices.toLocaleString()}</div>
      <div><b>UV Range:</b> U: ${minUCoord.toFixed(4)} to ${maxUCoord.toFixed(4)}, V: ${minVCoord.toFixed(4)} to ${maxVCoord.toFixed(4)}</div>
        </div>
      `;
      
  // Display sample UV coordinates if available
  if (sampleMesh && sampleUvs) {
    infoHTML += `
      <div style="padding: 8px; background-color: #333; border-radius: 4px;">
        <div style="font-weight: bold; color: #ffcc00; margin-bottom: 5px;">
          Sample UV Coordinates from ${sampleMesh.name || 'unnamed mesh'}:
        </div>
    `;
    
    const maxSamples = 5;
    for (let i = 0; i < Math.min(maxSamples, sampleMesh.geometry.attributes[currentChannel].count); i++) {
      const u = sampleUvs[i * 2].toFixed(4);
      const v = sampleUvs[i * 2 + 1].toFixed(4);
      infoHTML += `<div>Vertex ${i}: (${u}, ${v})</div>`;
    }
    
    if (sampleMesh.geometry.attributes[currentChannel].count > maxSamples) {
      infoHTML += `<div>... and ${sampleMesh.geometry.attributes[currentChannel].count - maxSamples} more vertices</div>`;
    }
    
    infoHTML += `</div>`;
  }
  
  uvInfo.innerHTML = infoHTML;
}

// Update model info in the debug panel
function updateModelInfo() {
  if (!modelObject) return;
  
  const modelInfo = document.getElementById('model-info');
  
  // Count materials, meshes, and vertices
  let materialCount = 0;
  let meshCount = 0;
  let vertexCount = 0;
  
  modelObject.traverse((child) => {
    if (child.isMesh) {
      meshCount++;
      vertexCount += child.geometry.attributes.position.count;
      
      if (Array.isArray(child.material)) {
        materialCount += child.material.length;
    } else {
        materialCount++;
      }
    }
  });
  
  modelInfo.innerHTML = `
    <b>File:</b> ${modelFile.name}<br>
    <b>Size:</b> ${formatFileSize(modelFile.size)}<br>
    <b>Meshes:</b> ${meshCount}<br>
    <b>Materials:</b> ${materialCount}<br>
    <b>Vertices:</b> ${vertexCount.toLocaleString()}<br>
  `;
}

// Update texture info in the debug panel
function updateTextureInfo() {
  if (!textureObject) return;
  
  const textureInfo = document.getElementById('texture-info');
  
  // Handle procedurally generated texture
  if (!textureFile) {
    textureInfo.innerHTML = `
      <b>Texture:</b> Procedural Atlas (1, 2, 3)<br>
      <b>Size:</b> 600 × 200 px<br>
      <b>Type:</b> Canvas Texture<br>
      <b>Sections:</b> 3 (each 200px wide)<br>
    `;
    return;
  }
  
  // Handle file-based texture
  textureInfo.innerHTML = `
    <b>File:</b> ${textureFile.name}<br>
    <b>Size:</b> ${formatFileSize(textureFile.size)}<br>
    <b>Dimensions:</b> ${textureObject.image.width} × ${textureObject.image.height}<br>
    <b>Type:</b> ${getFileExtension(textureFile.name).toUpperCase()}<br>
  `;
}

// Check if both model and texture are loaded and remove loading screen
function checkLoadingComplete() {
  if (modelObject && textureObject) {
    document.getElementById('loading').style.display = 'none';
  }
}

// Reset to drop zone UI
function resetToDropZone() {
  document.getElementById('drop-container').style.display = 'flex';
  document.getElementById('loading').style.display = 'none';
  renderer.domElement.style.display = 'none';
  document.getElementById('debug-panel').style.display = 'none';
  
  // Clear scene
  if (modelObject) {
    scene.remove(modelObject);
    modelObject = null;
  }
  
  // Reset selected mesh
  selectedMesh = null;
  
  // Reset model and texture files
  modelFile = null;
  textureFile = null;
  
  // Reset UI
  document.getElementById('drop-zone-model').classList.remove('has-file');
  document.getElementById('drop-zone-texture').classList.remove('has-file');
  document.getElementById('model-file-info').textContent = '';
  document.getElementById('texture-file-info').textContent = '';
  document.getElementById('start-button').style.display = 'none';
  document.getElementById('start-button').disabled = true;
  
  isDebugMode = false;
}

// Create a procedural number atlas texture for testing - improved version
function createNumberAtlasTexture() {
  // Create a canvas to draw the texture
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  
  // Section 1: Number "1" - Bright Red
  ctx.fillStyle = '#FF5733';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', 100, 100);
  
  // Section 2: Number "2" - Bright Green
  ctx.fillStyle = '#33FF57';
  ctx.fillRect(200, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.fillText('2', 300, 100);
  
  // Section 3: Number "3" - Bright Blue 
  ctx.fillStyle = '#3357FF';
  ctx.fillRect(400, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.fillText('3', 500, 100);
  
  // Create a texture from the canvas
  const texture = new THREE.CanvasTexture(canvas);
  
  // Set the texture wrapping mode to allow proper offset/repeat
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  // Important: Set proper filtering for better display
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  
  // Add debugging to verify texture creation
  console.log('Created texture atlas:', texture);
  
  return texture;
}

// Load the test number atlas texture with logging
function loadNumberAtlasTexture() {
  // Create a texture from a canvas
  const texture = createNumberAtlasTexture();
  textureObject = texture;
  
  // Log that we created a test texture
  console.log('Created procedural number atlas texture for testing', texture);
  
  // Show texture info in the UI if textureFile is not available
  if (!textureFile) {
    textureFile = {
      name: "number_atlas.png",
      size: 1024 * 36 // Estimate
    };
    updateTextureInfo();
  }
  
  // Apply to model if it's loaded
  if (modelObject) {
    applyTextureToModel();
  }
}

// Create a visual representation of the atlas texture
function createAtlasVisualization() {
  // Create container for the atlas visualization
  const atlasVisContainer = document.createElement('div');
  atlasVisContainer.id = 'atlas-visualization';
  atlasVisContainer.style.position = 'absolute';
  atlasVisContainer.style.bottom = '20px';
  atlasVisContainer.style.left = '20px'; // Changed from right to left
  atlasVisContainer.style.width = '300px';
  atlasVisContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  atlasVisContainer.style.border = '1px solid #666';
  atlasVisContainer.style.borderRadius = '5px';
  atlasVisContainer.style.padding = '10px';
  atlasVisContainer.style.color = 'white';
  atlasVisContainer.style.fontFamily = 'monospace';
  atlasVisContainer.style.fontSize = '12px';
  atlasVisContainer.style.zIndex = '1000';
  atlasVisContainer.style.cursor = 'move'; // Cursor indicates draggable
  atlasVisContainer.style.transition = 'opacity 0.3s ease'; // Smooth transition for collapse
  
  // Create header with title and toggle button
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '10px';
  header.style.cursor = 'pointer'; // Make the whole header clickable
  
  // Add title
  const title = document.createElement('div');
  title.textContent = 'Atlas Texture Map';
  title.style.fontWeight = 'bold';
  header.appendChild(title);
  
  // Add toggle caret
  const caret = document.createElement('div');
  caret.textContent = '▼'; // Down caret (expanded)
  caret.style.marginLeft = '5px';
  caret.style.transition = 'transform 0.3s ease';
  header.appendChild(caret);
  
  atlasVisContainer.appendChild(header);
  
  // Create content container (for collapsing)
  const contentContainer = document.createElement('div');
  contentContainer.id = 'atlas-content';
  contentContainer.style.transition = 'height 0.3s ease, opacity 0.3s ease, max-height 0.4s cubic-bezier(0, 1, 0, 1)';
  contentContainer.style.overflow = 'hidden';
  atlasVisContainer.appendChild(contentContainer);
  
  // Create canvas for atlas visualization
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.id = 'atlas-canvas';
  atlasCanvas.width = 280;
  atlasCanvas.height = 280;
  atlasCanvas.style.border = '1px solid #333';
  atlasCanvas.style.backgroundColor = '#111';
  contentContainer.appendChild(atlasCanvas);
  
  // Add to body
  document.body.appendChild(atlasVisContainer);
  
  // Initially hide until the texture is loaded
  atlasVisContainer.style.display = 'none';
  
  // Track mouse movement to detect drag vs. click
  let mouseDownPosition = null;
  let hasDragged = false;
  const dragThreshold = 5; // pixels of movement to consider it a drag
  
  // Make the panel collapsible
  let isCollapsed = false;
  
  // Toggle collapse state
  function toggleCollapseState() {
    isCollapsed = !isCollapsed;
    
    if (isCollapsed) {
      // Get the current height for smooth animation
      const currentHeight = contentContainer.scrollHeight;
      contentContainer.style.height = currentHeight + 'px';
      
      // Trigger reflow
      contentContainer.offsetHeight;
      
      // Animate to collapsed state
      contentContainer.style.height = '0';
      contentContainer.style.opacity = '0';
      contentContainer.style.maxHeight = '0';
      caret.textContent = '►'; // Right caret (collapsed)
      caret.style.transform = 'rotate(0deg)';
    } else {
      // Get target height for animation
      const targetHeight = atlasCanvas.offsetHeight + 
                         parseInt(atlasCanvas.style.borderTopWidth || 0) + 
                         parseInt(atlasCanvas.style.borderBottomWidth || 0);
      
      // Start animation
      contentContainer.style.maxHeight = '1000px'; // Large enough value
      contentContainer.style.height = targetHeight + 'px';
      contentContainer.style.opacity = '1';
      caret.textContent = '▼'; // Down caret (expanded)
      caret.style.transform = 'rotate(0deg)';
      
      // Remove fixed height after animation completes
      setTimeout(() => {
        contentContainer.style.height = '';
      }, 400);
    }
  }
  
  // Handle header click for collapsing
  header.addEventListener('mousedown', (e) => {
    mouseDownPosition = { x: e.clientX, y: e.clientY };
    hasDragged = false;
  });
  
  header.addEventListener('mouseup', (e) => {
    if (!mouseDownPosition) return;
    
    // Calculate distance moved
    const dx = Math.abs(e.clientX - mouseDownPosition.x);
    const dy = Math.abs(e.clientY - mouseDownPosition.y);
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Only toggle if it's a clean click (minimal movement)
    if (distance < dragThreshold && !hasDragged) {
      toggleCollapseState();
    }
    
    // Reset tracking
    mouseDownPosition = null;
  });
  
  // Make the panel draggable
  let isDragging = false;
  let offsetX, offsetY;
  
  // Store original position for magnetic snapping
  const originalPosition = { left: '20px', bottom: '20px' };
  
  // Handle mouse events for dragging
  atlasVisContainer.addEventListener('mousedown', startDrag);
  
  function startDrag(e) {
    // Avoid dragging when clicking on canvas
    if (e.target === atlasCanvas) return;
    
    // Save initial position for drag detection
    mouseDownPosition = { x: e.clientX, y: e.clientY };
    
    // Calculate the offset from the mouse position to the panel's corner
    const rect = atlasVisContainer.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Add event listeners for dragging and drop
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    
    // Stop event propagation to prevent other handlers
    e.preventDefault();
    e.stopPropagation();
  }
  
  function dragMove(e) {
    // Check if we've moved enough to consider it a drag
    if (mouseDownPosition) {
      const dx = Math.abs(e.clientX - mouseDownPosition.x);
      const dy = Math.abs(e.clientY - mouseDownPosition.y);
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (distance >= dragThreshold) {
        isDragging = true;
        hasDragged = true;
        
        // When drag starts, switch from bottom-based to top-based positioning
        if (!atlasVisContainer.style.top) {
          const rect = atlasVisContainer.getBoundingClientRect();
          atlasVisContainer.style.bottom = 'auto';
          atlasVisContainer.style.top = `${window.innerHeight - rect.bottom}px`;
        }
      }
    }
    
    if (isDragging) {
      // Calculate new position
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      
      // Update panel position
      atlasVisContainer.style.left = `${x}px`;
      atlasVisContainer.style.top = `${y}px`;
    }
  }
  
  function dragEnd(e) {
    // Remove event listeners regardless
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    
    if (isDragging) {
      // Check if we should snap back to original position
      const rect = atlasVisContainer.getBoundingClientRect();
      const snapDistance = 50; // Distance in pixels to trigger snap
      
      // Calculate distance from original position (bottom left)
      const distanceToOriginal = Math.sqrt(
        Math.pow(rect.left - 20, 2) + 
        Math.pow((window.innerHeight - rect.bottom) - 20, 2)
      );
      
      // If close enough to original position, snap back
      if (distanceToOriginal < snapDistance) {
        atlasVisContainer.style.transition = 'left 0.3s ease, top 0.3s ease, bottom 0.3s ease';
        atlasVisContainer.style.left = originalPosition.left;
        atlasVisContainer.style.top = 'auto';
        atlasVisContainer.style.bottom = originalPosition.bottom;
        
        // Reset transition after animation
        setTimeout(() => {
          atlasVisContainer.style.transition = 'opacity 0.3s ease';
        }, 300);
      }
      
      // Reset state
      isDragging = false;
    }
    
    // Reset tracking
    mouseDownPosition = null;
    hasDragged = false;
  }
}

// Update the atlas visualization with the actual texture and UV mapping
function updateAtlasVisualization(currentOffset, currentRepeat) {
  // Get the container and show it
  const container = document.getElementById('atlas-visualization');
  if (!container) return;
  
  // Only show the visualization if we have both texture and model
  if (!textureObject || !modelObject) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  // Get the canvas and context
  const canvas = document.getElementById('atlas-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear the canvas
  ctx.clearRect(0, 0, width, height);
  
  // If we have a texture, draw it to fill the canvas
  if (textureObject) {
    // For procedural texture which is a CanvasTexture, we can access its source
    if (textureObject instanceof THREE.CanvasTexture && textureObject.image) {
      // Draw the entire texture to the canvas
      ctx.drawImage(textureObject.image, 0, 0, width, height);
    } 
    // For loaded image texture
    else if (textureObject.image) {
      // Draw the image texture to fit the canvas
      ctx.drawImage(textureObject.image, 0, 0, width, height);
    }
    
    // Draw grid overlay for reference (lighter and more subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    
    // Draw horizontal grid lines at 0.25, 0.5, 0.75
    for (let y = 0.25; y < 1; y += 0.25) {
      ctx.beginPath();
      ctx.moveTo(0, y * height);
      ctx.lineTo(width, y * height);
      ctx.stroke();
      
      // Add subtle coordinate label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(y.toFixed(2), 5, y * height - 3);
    }
    
    // Draw vertical grid lines at 0.25, 0.5, 0.75
    for (let x = 0.25; x < 1; x += 0.25) {
      ctx.beginPath();
      ctx.moveTo(x * width, 0);
      ctx.lineTo(x * width, height);
      ctx.stroke();
      
      // Add subtle coordinate label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(x.toFixed(2), x * width + 2, 10);
    }
    
    // Draw the current viewing area based on offset and repeat
    if (currentOffset !== undefined && currentRepeat !== undefined) {
      // Convert offset and repeat to canvas coordinates
      const x = currentOffset.x * width;
      const y = currentOffset.y * height;
      const w = currentRepeat.x * width;
      const h = currentRepeat.y * height;
      
      // Draw a highlighted box for the current view
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'red';
      ctx.strokeRect(x, y, w, h);
      
      // Add "Current View" label near the highlighted area if outside of canvas
      if (x < 0 || y < 0 || x + w > width || y + h > height) {
        ctx.fillStyle = 'red';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('View extends outside atlas', width/2, height-10);
      }
    }
    
    // Add coordinate info at the top if the texture is displayed
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, width, 20);
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Offset: (${currentOffset?.x.toFixed(2) || '0.00'}, ${currentOffset?.y.toFixed(2) || '0.00'})`, width/2, 12);
  } else {
    // If no texture, show placeholder text
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No texture loaded', width/2, height/2);
  }
}

// Create the multi-texture material editor UI
function createMultiTextureEditor() {
  // Create the main container
  const editorContainer = document.createElement('div');
  editorContainer.id = 'multi-texture-editor';
  editorContainer.style.position = 'absolute';
  editorContainer.style.top = '20px';
  editorContainer.style.right = '20px';
  editorContainer.style.width = '350px';
  editorContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  editorContainer.style.border = '1px solid #666';
  editorContainer.style.borderRadius = '5px';
  editorContainer.style.padding = '15px';
  editorContainer.style.color = 'white';
  editorContainer.style.fontFamily = 'sans-serif';
  editorContainer.style.fontSize = '14px';
  editorContainer.style.zIndex = '1000';
  editorContainer.style.maxHeight = '80vh';
  editorContainer.style.overflowY = 'auto';
  
  // Create header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '15px';
  header.style.borderBottom = '1px solid #555';
  header.style.paddingBottom = '10px';
  
  const title = document.createElement('div');
  title.textContent = 'Multi-Texture Material Editor';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '16px';
  header.appendChild(title);
  
  // Add toggle button for multi-texture mode
  const toggleButton = document.createElement('button');
  toggleButton.textContent = isMultiTextureMode ? 'Disable' : 'Enable';
  toggleButton.className = 'debug-button';
  toggleButton.style.backgroundColor = isMultiTextureMode ? '#e74c3c' : '#2ecc71';
  toggleButton.style.border = 'none';
  toggleButton.style.borderRadius = '4px';
  toggleButton.style.padding = '6px 12px';
  toggleButton.style.cursor = 'pointer';
  
  toggleButton.addEventListener('click', () => {
    isMultiTextureMode = !isMultiTextureMode;
    toggleButton.textContent = isMultiTextureMode ? 'Disable' : 'Enable';
    toggleButton.style.backgroundColor = isMultiTextureMode ? '#e74c3c' : '#2ecc71';
    
    // Apply the multi-texture material when mode is enabled
    if (isMultiTextureMode) {
      applyMultiTextureMaterial();
    } else {
      // When disabling multi-texture mode, ensure we restore original UV data
      if (modelObject) {
        modelObject.traverse((child) => {
          if (child.isMesh && originalUvData.has(child)) {
            // Restore original UV data when turning off multi-texture mode
            child.geometry.attributes.uv = originalUvData.get(child);
            console.log(`Restored original UV data for ${child.name} when disabling multi-texture mode`);
          }
        });
      }
      
      // Revert to single texture mode
      if (currentUvSet < availableUvSets.length) {
        switchUvChannel(availableUvSets[currentUvSet]);
      }
    }
    
    // Update the UI
    updateMultiTextureEditor();
  });
  
  header.appendChild(toggleButton);
  editorContainer.appendChild(header);
  
  // Create texture list section
  const textureSection = document.createElement('div');
  textureSection.id = 'texture-list-section';
  textureSection.style.marginBottom = '20px';
  
  const textureSectionTitle = document.createElement('div');
  textureSectionTitle.textContent = 'Available Textures';
  textureSectionTitle.style.fontWeight = 'bold';
  textureSectionTitle.style.marginBottom = '10px';
  textureSection.appendChild(textureSectionTitle);
  
  // Add upload button
  const uploadButton = document.createElement('button');
  uploadButton.textContent = 'Upload Texture';
  uploadButton.className = 'debug-button';
  uploadButton.style.width = '100%';
  uploadButton.style.marginBottom = '10px';
  uploadButton.style.padding = '8px';
  uploadButton.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png, image/webp';
    input.onchange = e => {
      if (e.target.files.length) {
        const file = e.target.files[0];
        loadAdditionalTexture(file);
      }
    };
    input.click();
  });
  
  textureSection.appendChild(uploadButton);
  
  // Container for texture list (will be populated dynamically)
  const textureList = document.createElement('div');
  textureList.id = 'texture-list';
  textureSection.appendChild(textureList);
  
  editorContainer.appendChild(textureSection);
  
  // Create UV channel mapping section
  const mappingSection = document.createElement('div');
  mappingSection.id = 'uv-mapping-section';
  
  const mappingSectionTitle = document.createElement('div');
  mappingSectionTitle.textContent = 'UV Channel Mappings';
  mappingSectionTitle.style.fontWeight = 'bold';
  mappingSectionTitle.style.marginBottom = '10px';
  mappingSection.appendChild(mappingSectionTitle);
  
  // Container for UV mapping controls (will be populated dynamically)
  const mappingControls = document.createElement('div');
  mappingControls.id = 'mapping-controls';
  mappingSection.appendChild(mappingControls);
  
  editorContainer.appendChild(mappingSection);
  
  // Add to body
  document.body.appendChild(editorContainer);
  
  // Initially hide until debug mode is activated
  editorContainer.style.display = 'none';
  
  // Return the container for later reference
  return editorContainer;
}

// Update the multi-texture editor UI based on current state
function updateMultiTextureEditor() {
  // Get containers
  const editor = document.getElementById('multi-texture-editor');
  const textureList = document.getElementById('texture-list');
  const mappingControls = document.getElementById('mapping-controls');
  
  if (!editor || !textureList || !mappingControls) return;
  
  // Only show if in debug mode
  if (!isDebugMode) {
    editor.style.display = 'none';
    return;
  }
  
  editor.style.display = 'block';
  
  // Update texture list
  textureList.innerHTML = '';
  
  // Always include the main texture first
  if (textureObject) {
    const textureItem = createTextureListItem(textureObject, 0, textureFile ? textureFile.name : 'Main Texture');
    textureList.appendChild(textureItem);
  }
  
  // Add other textures
  textures.forEach((texture, index) => {
    const textureItem = createTextureListItem(texture, index + 1, texture.userData?.fileName || `Texture ${index + 1}`);
    textureList.appendChild(textureItem);
  });
  
  if (textureList.children.length === 0) {
    const noTextures = document.createElement('div');
    noTextures.textContent = 'No textures available. Upload textures to begin.';
    noTextures.style.fontStyle = 'italic';
    noTextures.style.color = '#999';
    noTextures.style.padding = '10px 0';
    textureList.appendChild(noTextures);
  }
  
  // Update UV mapping controls
  mappingControls.innerHTML = '';
  
  if (availableUvSets.length === 0) {
    const noUvs = document.createElement('div');
    noUvs.textContent = 'No UV channels detected in model.';
    noUvs.style.fontStyle = 'italic';
    noUvs.style.color = '#999';
    noUvs.style.padding = '10px 0';
    mappingControls.appendChild(noUvs);
    return;
  }
  
  // Create controls for each UV channel
  availableUvSets.forEach((uvChannel, index) => {
    const channelControl = createUvChannelControl(uvChannel, uvSetNames[index]);
    mappingControls.appendChild(channelControl);
  });
}

// Create a texture list item for the editor
function createTextureListItem(texture, index, name) {
  const container = document.createElement('div');
  container.className = 'texture-item';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.marginBottom = '10px';
  container.style.padding = '8px';
  container.style.backgroundColor = '#333';
  container.style.borderRadius = '4px';
  
  // Create thumbnail
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 60;
  thumbnail.height = 60;
  thumbnail.style.border = '1px solid #555';
  thumbnail.style.marginRight = '10px';
  
  // Draw texture to thumbnail
  const ctx = thumbnail.getContext('2d');
  if (texture.image) {
    ctx.drawImage(texture.image, 0, 0, 60, 60);
  } else {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 60, 60);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No Image', 30, 30);
  }
  
  container.appendChild(thumbnail);
  
  // Create texture info
  const info = document.createElement('div');
  info.style.flex = '1';
  
  const textureName = document.createElement('div');
  textureName.textContent = name;
  textureName.style.fontWeight = 'bold';
  info.appendChild(textureName);
  
  if (texture.image) {
    const textureDimensions = document.createElement('div');
    textureDimensions.textContent = `${texture.image.width} × ${texture.image.height}`;
    textureDimensions.style.fontSize = '12px';
    textureDimensions.style.color = '#aaa';
    info.appendChild(textureDimensions);
  }
  
  container.appendChild(info);
  
  // Create remove button (not for main texture)
  if (index > 0) {
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.className = 'debug-button';
    removeButton.style.width = '30px';
    removeButton.style.height = '30px';
    removeButton.style.padding = '0';
    removeButton.style.borderRadius = '50%';
    removeButton.style.backgroundColor = '#e74c3c';
    removeButton.style.marginLeft = '10px';
    
    removeButton.addEventListener('click', () => {
      // Remove texture and update mappings
      removeTexture(index - 1);
    });
    
    container.appendChild(removeButton);
  }
  
  return container;
}

// Create UI controls for a single UV channel
function createUvChannelControl(uvChannel, displayName) {
  const container = document.createElement('div');
  container.className = 'uv-channel-control';
  container.style.marginBottom = '15px';
  container.style.padding = '10px';
  container.style.backgroundColor = '#333';
  container.style.borderRadius = '4px';
  
  // Channel name
  const channelName = document.createElement('div');
  channelName.textContent = displayName.split(' - ')[0]; // Just show the UV name, not the full description
  channelName.style.fontWeight = 'bold';
  channelName.style.marginBottom = '8px';
  container.appendChild(channelName);
  
  // Create controls row
  const controlsRow = document.createElement('div');
  controlsRow.style.display = 'flex';
  controlsRow.style.alignItems = 'center';
  controlsRow.style.gap = '10px';
  
  // Texture selector
  const textureSelect = document.createElement('select');
  textureSelect.style.flex = '1';
  textureSelect.style.padding = '5px';
  textureSelect.style.backgroundColor = '#444';
  textureSelect.style.color = 'white';
  textureSelect.style.border = '1px solid #555';
  textureSelect.style.borderRadius = '3px';
  
  // Add disabled option
  const disabledOption = document.createElement('option');
  disabledOption.value = '-1';
  disabledOption.textContent = 'None';
  textureSelect.appendChild(disabledOption);
  
  // Add main texture
  if (textureObject) {
    const mainOption = document.createElement('option');
    mainOption.value = '0';
    mainOption.textContent = textureFile ? textureFile.name : 'Main Texture';
    textureSelect.appendChild(mainOption);
  }
  
  // Add other textures
  textures.forEach((texture, index) => {
    const option = document.createElement('option');
    option.value = (index + 1).toString();
    option.textContent = texture.userData?.fileName || `Texture ${index + 1}`;
    textureSelect.appendChild(option);
  });
  
  // Set current value
  textureSelect.value = activeTextures[uvChannel] !== undefined ? activeTextures[uvChannel].toString() : '-1';
  
  // Add change event
  textureSelect.addEventListener('change', function() {
    const value = parseInt(this.value);
    if (value >= 0) {
      activeTextures[uvChannel] = value;
    } else {
      delete activeTextures[uvChannel];
    }
    
    // Update material if in multi-texture mode
    if (isMultiTextureMode) {
      applyMultiTextureMaterial();
    }
  });
  
  controlsRow.appendChild(textureSelect);
  
  // Blend mode selector
  const blendSelect = document.createElement('select');
  blendSelect.style.width = '100px';
  blendSelect.style.padding = '5px';
  blendSelect.style.backgroundColor = '#444';
  blendSelect.style.color = 'white';
  blendSelect.style.border = '1px solid #555';
  blendSelect.style.borderRadius = '3px';
  
  // Add blend modes
  const blendModeOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'add', label: 'Add' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' }
  ];
  
  blendModeOptions.forEach(mode => {
    const option = document.createElement('option');
    option.value = mode.value;
    option.textContent = mode.label;
    blendSelect.appendChild(option);
  });
  
  // Set current value
  blendSelect.value = blendModes[uvChannel] || 'normal';
  
  // Add change event
  blendSelect.addEventListener('change', function() {
    blendModes[uvChannel] = this.value;
    
    // Update material if in multi-texture mode
    if (isMultiTextureMode) {
      applyMultiTextureMaterial();
    }
  });
  
  controlsRow.appendChild(blendSelect);
  
  container.appendChild(controlsRow);
  
  // Intensity slider
  const intensityContainer = document.createElement('div');
  intensityContainer.style.marginTop = '10px';
  
  const intensityLabel = document.createElement('div');
  intensityLabel.textContent = 'Intensity:';
  intensityLabel.style.marginBottom = '5px';
  intensityLabel.style.fontSize = '12px';
  intensityContainer.appendChild(intensityLabel);
  
  const intensityControls = document.createElement('div');
  intensityControls.style.display = 'flex';
  intensityControls.style.alignItems = 'center';
  intensityControls.style.gap = '10px';
  
  const intensitySlider = document.createElement('input');
  intensitySlider.type = 'range';
  intensitySlider.min = '0';
  intensitySlider.max = '100';
  intensitySlider.step = '1';
  intensitySlider.style.flex = '1';
  
  // Set current value
  intensitySlider.value = Math.round((textureIntensities[uvChannel] || 1) * 100);
  
  const intensityValue = document.createElement('div');
  intensityValue.textContent = `${intensitySlider.value}%`;
  intensityValue.style.width = '40px';
  intensityValue.style.textAlign = 'right';
  
  // Add change event
  intensitySlider.addEventListener('input', function() {
    const value = parseInt(this.value) / 100;
    textureIntensities[uvChannel] = value;
    intensityValue.textContent = `${this.value}%`;
    
    // Update material if in multi-texture mode
    if (isMultiTextureMode) {
      applyMultiTextureMaterial();
    }
  });
  
  intensityControls.appendChild(intensitySlider);
  intensityControls.appendChild(intensityValue);
  intensityContainer.appendChild(intensityControls);
  
  container.appendChild(intensityContainer);
  
  return container;
}

// Load additional texture
function loadAdditionalTexture(file) {
  console.log('Loading additional texture:', file.name);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(e.target.result, (texture) => {
      texture.flipY = false; // Often needed for GLB textures
      
      // Set proper texture settings
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter; 
      texture.magFilter = THREE.LinearFilter;
      
      // Store metadata
      texture.userData = {
        fileName: file.name,
        fileSize: file.size
      };
      
      // Add to textures array
      textures.push(texture);
      console.log(`Added texture ${file.name} to library (index ${textures.length})`);
      
      // Update editor UI
      updateMultiTextureEditor();
      
      // If multi-texture mode is active, update the material
      if (isMultiTextureMode) {
        applyMultiTextureMaterial();
      }
    }, undefined, (error) => {
      console.error('Error loading texture:', error);
      alert('Error loading the texture file. Please try a different file.');
    });
  };
  
  reader.readAsDataURL(file);
}

// Remove a texture from the library
function removeTexture(index) {
  if (index < 0 || index >= textures.length) return;
  
  // Remove texture
  const removedTexture = textures.splice(index, 1)[0];
  console.log(`Removed texture ${removedTexture.userData?.fileName || 'unknown'}`);
  
  // Update any mappings that used this texture
  Object.keys(activeTextures).forEach(channel => {
    const textureIndex = activeTextures[channel];
    if (textureIndex === index + 1) {
      // Texture was removed, so remove mapping
      delete activeTextures[channel];
    } else if (textureIndex > index + 1) {
      // Texture was after the removed one, decrement index
      activeTextures[channel] = textureIndex - 1;
    }
  });
  
  // Update editor UI
  updateMultiTextureEditor();
  
  // If multi-texture mode is active, update the material
  if (isMultiTextureMode) {
    applyMultiTextureMaterial();
  }
}

// Apply the multi-texture material to all screen meshes
function applyMultiTextureMaterial() {
  if (!modelObject) return;
  
  console.log('Applying multi-texture material...');
  
  // Check if we have any active texture mappings
  const activeChannels = Object.keys(activeTextures);
  if (activeChannels.length === 0) {
    console.log('No active texture mappings defined');
    return;
  }
  
  // First, find all screen meshes
  modelObject.traverse((child) => {
    if (child.isMesh) {
      const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                          child.name.toLowerCase().includes('display') || 
                          child.name.toLowerCase().includes('monitor');
      
      if (isScreenMesh) {
        console.log(`Setting up multi-texture material for: ${child.name}`);
        
        // Find which UV channels this mesh has
        const meshUvChannels = [];
        
        // Check which active UV channels are present on this mesh
        activeChannels.forEach(channel => {
          if (child.geometry.attributes[channel]) {
            meshUvChannels.push(channel);
          }
        });
        
        if (meshUvChannels.length === 0) {
          console.log(`No mapped UV channels found on mesh: ${child.name}`);
          return;
        }
        
        // Create a custom multi-texture material
        createMultiTextureMaterial(child, meshUvChannels);
      }
    }
  });
  
  // Force a re-render
  renderer.render(scene, camera);
}

// Create a custom multi-texture material for a mesh
function createMultiTextureMaterial(mesh, uvChannels) {
  // Collect textures for each channel
  const textureInfos = [];
  
  uvChannels.forEach(channel => {
    const textureIndex = activeTextures[channel];
    if (textureIndex !== undefined) {
      // Get the texture
      const texture = textureIndex === 0 ? textureObject : textures[textureIndex - 1];
      if (!texture) return;
      
      // Get blend mode and intensity
      const blendMode = blendModes[channel] || 'normal';
      const intensity = textureIntensities[channel] || 1.0;
      
      // Get UV index (0 for uv, 1 for uv2, etc.)
      const uvIndex = parseInt(channel.replace('uv', '')) || 0;
      
      textureInfos.push({
        texture: texture,
        uvChannel: channel,
        uvIndex: uvIndex,
        blendMode: blendMode,
        intensity: intensity
      });
    }
  });
  
  if (textureInfos.length === 0) {
    console.log(`No valid textures found for mesh: ${mesh.name}`);
    return;
  }
  
  console.log(`Creating material with ${textureInfos.length} textures for ${mesh.name}`);
  
  // For simple case with just one texture, use standard material
  if (textureInfos.length === 1 && textureInfos[0].blendMode === 'normal') {
    const info = textureInfos[0];
    
    // Create a standard material
    const material = new THREE.MeshStandardMaterial();
    material.roughness = 0.1;
    material.metalness = 0.2;
    
    // Clone the texture to avoid cross-references
    const tex = info.texture.clone();
    
    // If this is not the first UV channel, we need to map it
    if (info.uvIndex > 0) {
      // Store original UV data if we haven't already
      if (!originalUvData.has(mesh) && mesh.geometry.attributes.uv) {
        originalUvData.set(mesh, mesh.geometry.attributes.uv.clone());
        console.log(`Stored original UV data for ${mesh.name} in multi-texture mode`);
      }
      
      // Copy the UV data to the primary UV channel
      mesh.geometry.attributes.uv = mesh.geometry.attributes[info.uvChannel];
      console.log(`Mapped ${info.uvChannel} to UV for ${mesh.name}`);
    } else if (originalUvData.has(mesh)) {
      // For UV0, restore original data if needed
      mesh.geometry.attributes.uv = originalUvData.get(mesh);
      console.log(`Restored original UV data for ${mesh.name} in multi-texture mode`);
    }
    
    // Apply the texture
    material.map = tex;
    material.emissiveMap = tex;
    material.emissive.set(info.intensity, info.intensity, info.intensity);
    
    // Apply the material
    mesh.material = material;
    material.needsUpdate = true;
    
    console.log(`Applied single-texture material to ${mesh.name}`);
    return;
  }
  
  // For multiple textures, we need a custom shader material
  
  // Create uniforms and texture definitions for the shader
  const uniforms = {
    u_time: { value: 0 }
  };
  
  // Texture definitions for shader
  let textureUniforms = '';
  let uvDefinitions = '';
  let blendingCode = '';
  
  textureInfos.forEach((info, index) => {
    // Create uniform for this texture
    const texName = `u_texture${index}`;
    uniforms[texName] = { value: info.texture };
    
    // Create uniform for intensity
    const intensityName = `u_intensity${index}`;
    uniforms[intensityName] = { value: info.intensity };
    
    // Add texture sampler to shader
    textureUniforms += `uniform sampler2D ${texName};\n`;
    textureUniforms += `uniform float ${intensityName};\n`;
    
    // Get attribute name for UVs
    const uvAttributeName = info.uvIndex === 0 ? 'uv' : `uv${info.uvIndex + 1}`;
    
    // Add UV definition
    if (info.uvIndex === 0) {
      uvDefinitions += `vec2 texCoords${index} = vUv;\n`;
    } else {
      // Need to check if the vUv2, vUv3, etc. are already defined
      if (uvDefinitions.indexOf(`varying vec2 vUv${info.uvIndex}`) === -1) {
        // Add varying declaration to be used in vertex shader
        uvDefinitions = `varying vec2 vUv${info.uvIndex};\n` + uvDefinitions;
      }
      uvDefinitions += `vec2 texCoords${index} = vUv${info.uvIndex};\n`;
    }
    
    // Add blending code based on blend mode
    if (index === 0) {
      // First texture is base
      blendingCode += `vec4 finalColor = texture2D(${texName}, texCoords${index}) * ${intensityName};\n`;
    } else {
      // Additional textures are blended
      switch (info.blendMode) {
        case 'add':
          blendingCode += `finalColor += texture2D(${texName}, texCoords${index}) * ${intensityName};\n`;
          break;
        case 'multiply':
          blendingCode += `finalColor *= mix(vec4(1.0), texture2D(${texName}, texCoords${index}), ${intensityName});\n`;
          break;
        case 'screen':
          blendingCode += `{\n`;
          blendingCode += `  vec4 texColor = texture2D(${texName}, texCoords${index});\n`;
          blendingCode += `  finalColor = vec4(1.0) - (vec4(1.0) - finalColor) * (vec4(1.0) - texColor * ${intensityName});\n`;
          blendingCode += `}\n`;
          break;
        default: // 'normal'
          blendingCode += `{\n`;
          blendingCode += `  vec4 texColor = texture2D(${texName}, texCoords${index});\n`;
          blendingCode += `  finalColor = mix(finalColor, texColor, texColor.a * ${intensityName});\n`;
          blendingCode += `}\n`;
      }
    }
  });
  
  // Create the vertex shader
  let vertexShader = `
    varying vec2 vUv;
    ${textureInfos.some(info => info.uvIndex > 0) ? 'attribute vec2 uv2;\nattribute vec2 uv3;\nattribute vec2 uv4;' : ''}
    ${textureInfos.some(info => info.uvIndex === 1) ? 'varying vec2 vUv1;' : ''}
    ${textureInfos.some(info => info.uvIndex === 2) ? 'varying vec2 vUv2;' : ''}
    ${textureInfos.some(info => info.uvIndex === 3) ? 'varying vec2 vUv3;' : ''}
    
    void main() {
      vUv = uv;
      ${textureInfos.some(info => info.uvIndex === 1) ? 'vUv1 = uv2;' : ''}
      ${textureInfos.some(info => info.uvIndex === 2) ? 'vUv2 = uv3;' : ''}
      ${textureInfos.some(info => info.uvIndex === 3) ? 'vUv3 = uv4;' : ''}
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  // Create the fragment shader
  let fragmentShader = `
    uniform float u_time;
    varying vec2 vUv;
    ${textureUniforms}
    
    void main() {
      ${uvDefinitions}
      
      ${blendingCode}
      
      // Make sure alpha is not premultiplied for emissive
      finalColor.rgb *= finalColor.a;
      
      gl_FragColor = finalColor;
    }
  `;
  
  // Create the material
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 1
  });
  
  // Apply the material
  mesh.material = material;
  
  console.log(`Applied multi-texture shader material to ${mesh.name}`);
}

// Update function to animate the shader material
function updateShaderMaterials() {
  // Update shader time uniform
  const time = performance.now() * 0.001; // Time in seconds
  
  if (modelObject) {
    modelObject.traverse((child) => {
      if (child.isMesh && child.material instanceof THREE.ShaderMaterial && child.material.uniforms.u_time) {
        child.material.uniforms.u_time.value = time;
      }
    });
  }
}

// Add multi-texture editor initialization to main init function
const originalInit = init;
init = function() {
  originalInit();
  
  // Create and initialize the multi-texture editor
  createMultiTextureEditor();
  
  // Update animation function to include shader updates
  const originalAnimate = animate;
  animate = function() {
    updateShaderMaterials();
    originalAnimate();
  };
};

// Initialize the application and start animation loop
init(); 
animate(); 