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

// Initialize the application
function init() {
  console.log('Atlas UV Mapping Debug Tool initialized');
  
  // Setup the scene, renderer and camera (hidden initially)
  setupThreeJS();
  
  // Setup drag and drop functionality
  setupDragAndDrop();
  
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
  loadTextureFromFile(textureFile);
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
  const reader = new FileReader();
  reader.onload = function(e) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(e.target.result, (texture) => {
      textureObject = texture;
      texture.flipY = false; // Often needed for GLB textures
      
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
  
  // Find all materials in the model
  modelObject.traverse((child) => {
    if (child.isMesh && child.material) {
      // Store original material for later use
      child.userData.originalMaterial = child.material.clone();
      
      // If it's a screen-like mesh (could be based on name or other properties)
      if (child.name.toLowerCase().includes('screen') || 
          child.name.toLowerCase().includes('display') ||
          child.name.toLowerCase().includes('monitor')) {
        
        console.log(`Found screen mesh: ${child.name}`);
        
        // Apply texture as emissive map for screen objects
        if (child.material.emissive) {
          child.material.emissiveMap = textureObject;
          child.material.emissive.set(1, 1, 1); // Full emissive intensity
          child.material.needsUpdate = true;
        }
      }
      
      // Always apply as regular map too
      child.material.map = textureObject;
      child.material.needsUpdate = true;
    }
  });
  
  // After applying the texture, switch to the current UV channel to ensure proper display
  if (availableUvSets.length > 0) {
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
  
  modelObject.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child);
      
      // Check for UV sets on each mesh
      if (child.geometry) {
        // Look for standard UV attributes
        if (child.geometry.attributes.uv && !availableUvSets.includes('uv')) {
          availableUvSets.push('uv');
          uvSetNames.push('uv (UV0)');
        }
        
        // Look for additional UV sets (uv2, uv3, etc.)
        for (let i = 2; i <= 8; i++) {
          const uvName = `uv${i}`;
          if (child.geometry.attributes[uvName] && !availableUvSets.includes(uvName)) {
            availableUvSets.push(uvName);
            uvSetNames.push(`${uvName} (UV${i-1})`);
          }
        }
      }
    }
  });
  
  // Create mesh toggle buttons
  createMeshToggles();
  
  // Set up UV switcher if there are multiple UV sets
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
  
  modelObject.traverse((child) => {
    if (child.isMesh && child.geometry) {
      // Check if this mesh has the requested UV channel
      const hasRequestedUvChannel = child.geometry.attributes[uvChannel] !== undefined;
      
      // Make a copy of the material to avoid affecting other meshes
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material.clone();
      }
      
      // Always work with a fresh clone of the original material
      const newMaterial = child.userData.originalMaterial.clone();
      
      if (hasRequestedUvChannel && textureObject) {
        // Apply texture to the new material
        newMaterial.map = textureObject.clone();
        
        // Now we need to set up the material to use the correct UV channel
        if (uvChannel === 'uv') {
          // Default UV channel (UV0) doesn't need special handling in Three.js
          newMaterial.map.channel = 0;
        } else if (uvChannel === 'uv2') {
          // For uv2 (UV1) - Three.js uses 0-based indexing
          newMaterial.map.channel = 1;
        } else if (uvChannel === 'uv3') {
          // For uv3 (UV2)
          newMaterial.map.channel = 2;
        } else if (uvChannel === 'uv4') {
          // For uv4 (UV3)
          newMaterial.map.channel = 3;
        }
        
        // Apply emissive map for screen meshes
        if (child.name.toLowerCase().includes('screen') || 
            child.name.toLowerCase().includes('display') ||
            child.name.toLowerCase().includes('monitor')) {
          newMaterial.emissiveMap = newMaterial.map;
          newMaterial.emissive.set(1, 1, 1);
        }
        
        // Apply the material
        child.material = newMaterial;
        child.material.needsUpdate = true;
        
        // Log the mapping for debugging
        console.log(`Applied UV channel ${uvChannel} to mesh: ${child.name}`);
      }
    }
  });
  
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
      if (!sampleMesh) {
        sampleMesh = child;
        sampleUvs = uvArray;
      }
    }
  });
  
  // Create info text
  let infoHTML = `
    <b>Current UV Channel:</b> ${uvSetNames[currentUvSet]}<br>
    <b>Meshes with this UV:</b> ${meshCount} of ${meshes.length}<br>
    <b>Total Vertices:</b> ${totalVertices}<br>
    <b>UV Range:</b> U: ${minUCoord.toFixed(4)} to ${maxUCoord.toFixed(4)}, V: ${minVCoord.toFixed(4)} to ${maxVCoord.toFixed(4)}<br>
  `;
  
  // Display sample UV coordinates if available
  if (sampleMesh && sampleUvs) {
    infoHTML += `<b>Sample Coordinates (from ${sampleMesh.name || 'unnamed mesh'}):</b><br>`;
    
    const maxSamples = 5;
    for (let i = 0; i < Math.min(maxSamples, sampleMesh.geometry.attributes[currentChannel].count); i++) {
      const u = sampleUvs[i * 2].toFixed(4);
      const v = sampleUvs[i * 2 + 1].toFixed(4);
      infoHTML += `[${i}]: (${u}, ${v})<br>`;
    }
    
    if (sampleMesh.geometry.attributes[currentChannel].count > maxSamples) {
      infoHTML += `... and ${sampleMesh.geometry.attributes[currentChannel].count - maxSamples} more`;
    }
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

// Initialize the application and start animation loop
init(); 
animate(); 