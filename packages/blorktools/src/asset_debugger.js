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
          window.uvChannelMapping.forEach(mapping => {
            if (child.geometry.attributes[mapping.threejsName]) {
              uvSetInfo += `${mapping.displayName}, `;
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
  
  // Create a detailed mapping to eliminate naming confusion
  const uvMappings = [
    { threejsName: 'uv', artistName: 'UV0', displayName: 'UV0 (Atlas Section 1)', atlasSection: 1 },
    { threejsName: 'uv2', artistName: 'UV1', displayName: 'UV1 - Lightmap', atlasSection: 1 },
    { threejsName: 'uv3', artistName: 'UV2', displayName: 'UV2 (Atlas Section 2)', atlasSection: 2 },
    { threejsName: 'uv4', artistName: 'UV3', displayName: 'UV3 (Atlas Section 3)', atlasSection: 3 }
  ];
  
  // Store the mapping globally for other functions to use
  window.uvChannelMapping = uvMappings;
  
  console.log('UV Channel Mapping Table:', uvMappings);
  
  // Count how many meshes have each UV channel
  const uvChannelStats = {};
  uvMappings.forEach(mapping => {
    uvChannelStats[mapping.threejsName] = 0;
  });
  
  // Now check which UV channels actually exist in the model
  modelObject.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child);
      
      // Debug info for this specific mesh
      if (child.name.toLowerCase().includes('screen') || 
          child.name.toLowerCase().includes('display') || 
          child.name.toLowerCase().includes('monitor')) {
        console.log(`Found screen mesh: ${child.name}`);
        
        // Log which UV channels this mesh has
        const meshUvChannels = [];
        uvMappings.forEach(mapping => {
          if (child.geometry && child.geometry.attributes[mapping.threejsName]) {
            meshUvChannels.push(mapping.displayName);
          }
        });
        console.log(`Screen mesh ${child.name} has UV channels:`, meshUvChannels);
      }
      
      // Check for all possible UV channels
      if (child.geometry) {
        uvMappings.forEach(mapping => {
          if (child.geometry.attributes[mapping.threejsName] && 
              !availableUvSets.includes(mapping.threejsName)) {
            availableUvSets.push(mapping.threejsName);
            uvSetNames.push(mapping.displayName);
            uvChannelStats[mapping.threejsName]++;
          }
        });
      }
    }
  });
  
  // Log which UV channels were found across all meshes
  console.log('UV Channel Stats:', uvChannelStats);
  console.log('Available UV channels:', availableUvSets);
  console.log('UV channel display names:', uvSetNames);
  
  // Always add all UV channels for testing with screens
  const hasScreenMeshes = meshes.some(mesh => 
    mesh.name.toLowerCase().includes('screen') || 
    mesh.name.toLowerCase().includes('display') || 
    mesh.name.toLowerCase().includes('monitor')
  );
  
  if (hasScreenMeshes) {
    console.log('Screen meshes found - ensuring all UV channels are available for testing');
    
    uvMappings.forEach(mapping => {
      if (!availableUvSets.includes(mapping.threejsName)) {
        availableUvSets.push(mapping.threejsName);
        uvSetNames.push(mapping.displayName + ' (Not in model)');
        console.log(`Added missing UV channel for testing: ${mapping.displayName}`);
      }
    });
  }
  
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
  
  // Find the mapping info for this channel
  const mapping = window.uvChannelMapping.find(m => m.threejsName === uvChannel);
  if (!mapping) {
    console.error(`No mapping information found for UV channel: ${uvChannel}`);
    return;
  }
  
  console.log(`Using artist's UV channel ${mapping.artistName}`);
  
  // Track how many meshes were affected
  let meshesWithThisUV = 0;
  let screenMeshesProcessed = 0;
  
  // Special case for UV3/uv4 - if we're trying to show the 3rd atlas section
  const isUv3Selection = uvChannel === 'uv4';
  
  // Store the current offset and repeat for visualization
  let currentOffset = new THREE.Vector2(0, 0);
  let currentRepeat = new THREE.Vector2(1, 1);
  
  // Special case for UV3 - set the atlas section 3 coordinates (last third of the atlas)
  if (isUv3Selection) {
    // For a 3-section atlas, section 3 starts at 2/3 of the width
    currentOffset.set(0.66, 0);
    currentRepeat.set(0.34, 1);
  }
  
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
        const hasUv0 = child.geometry && child.geometry.attributes['uv'] !== undefined;
        
        // Log for debugging
        console.log(`Processing screen mesh: ${child.name}, has ${mapping.displayName}: ${hasUvChannel}, has UV0: ${hasUv0}`);
        
        // Special case for UV3 when it's missing but UV0 exists
        if (isUv3Selection && !hasUvChannel && hasUv0 && textureObject) {
          console.log(`*** SPECIAL CASE *** Using UV0 with offset for UV3 on ${child.name}`);
          meshesWithThisUV++;
          
          // Create new material based on original
          const newMaterial = new THREE.MeshStandardMaterial();
          newMaterial.roughness = 0.1;
          newMaterial.metalness = 0.2;
          
          // Clone texture and apply offset to show the third section
          const tex = textureObject.clone();
          
          // Set offset to show the third section (assuming 3 equal parts)
          tex.offset.copy(currentOffset);
          tex.repeat.copy(currentRepeat);
          
          // Use UV0 channel
          tex.channel = 0;
          
          // Apply the texture
          newMaterial.map = tex;
          newMaterial.emissiveMap = tex;
          newMaterial.emissive.set(1, 1, 1);
          
          // Apply material
          child.material = newMaterial;
          child.material.needsUpdate = true;
          tex.needsUpdate = true;
          
          console.log(`Applied special case UV3 material to ${child.name} using UV0 with offset`);
        }
        // Regular case: mesh has the UV channel
        else if (textureObject && hasUvChannel) {
          meshesWithThisUV++;
          
          // Create a fresh material
          const newMaterial = new THREE.MeshStandardMaterial();
          newMaterial.roughness = 0.1;
          newMaterial.metalness = 0.2;
          
          // Clone the texture to avoid affecting other materials
          const tex = textureObject.clone();
          
          // Reset offset/repeat for normal case
          tex.offset.set(0, 0);
          tex.repeat.set(1, 1);
          
          // Update current offset/repeat for visualization
          if (!isUv3Selection) {
            currentOffset.set(0, 0);
            currentRepeat.set(1, 1);
          }
          
          // Set which UV channel the texture should use
          const uvIndex = parseInt(uvChannel.replace('uv', '')) || 0;
          
          // Only set channel for supported UV channels
          if (uvChannel === 'uv' || uvChannel === 'uv2' || uvChannel === 'uv3') {
            tex.channel = uvIndex > 0 ? uvIndex - 1 : 0;
            console.log(`Set UV channel ${tex.channel} for ${mapping.displayName}`);
          } else {
            console.log(`Skipping channel setting for ${mapping.displayName} (shader doesn't support ${uvChannel})`);
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
        else if (isScreenMesh && !hasUvChannel && (!isUv3Selection || !hasUv0)) {
          console.log(`Applying fallback material for ${child.name} - missing ${mapping.displayName}`);
          // Apply a simple colored material for channels that don't exist
          const fallbackMaterial = new THREE.MeshStandardMaterial({
            emissive: new THREE.Color(0.5, 0.5, 0.5),
            color: new THREE.Color(0.8, 0.8, 0.8)
          });
          child.material = fallbackMaterial;
        }
      } 
      // Regular non-screen mesh handling with special case for UV3
      else if (child.geometry && textureObject) {
        const hasUvChannel = child.geometry.attributes[uvChannel] !== undefined;
        const hasUv0 = child.geometry.attributes['uv'] !== undefined;
        
        // Special case for UV3
        if (isUv3Selection && !hasUvChannel && hasUv0) {
          meshesWithThisUV++;
          
          // Apply texture with offset for section 3
          const newMaterial = child.userData.originalMaterial.clone();
          newMaterial.map = textureObject.clone();
          newMaterial.map.offset.copy(currentOffset);
          newMaterial.map.repeat.copy(currentRepeat);
          newMaterial.map.channel = 0; // Use UV0
          
          // Apply material
          child.material = newMaterial;
          child.material.needsUpdate = true;
        }
        // Regular case
        else if (hasUvChannel) {
          meshesWithThisUV++;
          
          // Only apply UV channel switching for supported channels
          if (uvChannel === 'uv' || uvChannel === 'uv2' || uvChannel === 'uv3') {
            // Apply texture with the correct UV channel
            const newMaterial = child.userData.originalMaterial.clone();
            newMaterial.map = textureObject.clone();
            
            // Reset texture transform
            newMaterial.map.offset.set(0, 0);
            newMaterial.map.repeat.set(1, 1);
            
            // Set the UV channel
            const uvIndex = parseInt(uvChannel.replace('uv', '')) || 0;
            newMaterial.map.channel = uvIndex > 0 ? uvIndex - 1 : 0;
            
            // Apply material
            child.material = newMaterial;
            child.material.needsUpdate = true;
          }
        }
      }
    }
  });
  
  console.log(`Applied ${mapping.displayName} to ${meshesWithThisUV} meshes (${screenMeshesProcessed} screen meshes)`);
  
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
  
  // Find the mapping info for this channel
  const mapping = window.uvChannelMapping.find(m => m.threejsName === currentChannel);
  if (!mapping) {
    uvInfo.innerHTML = `<div style="color: #ff5555;">No mapping information found for ${currentChannel}</div>`;
    return;
  }
  
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
  
  // Create info text
  let infoHTML = `
    <div style="margin-bottom: 10px; padding: 8px; background-color: #333; border-radius: 4px;">
      <div style="font-weight: bold; color: #ffcc00; margin-bottom: 5px;">UV Channel Info:</div>
      <div><b>Three.js Name:</b> ${mapping.threejsName}</div>
      <div><b>Artist Convention:</b> ${mapping.artistName}</div>
      <div><b>Atlas Section:</b> ${mapping.atlasSection}</div>
      <div><b>Current Display:</b> ${mapping.displayName}</div>
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

// Initialize the application and start animation loop
init(); 
animate(); 