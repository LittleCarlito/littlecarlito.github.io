import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Main variables
let scene, camera, renderer, controls;
let monitorModel, displayScreenMesh;
let atlasTexture;
let debugInfo = {};
let meshGroups = {
  collision: [],
  display: [],
  other: []
};

// Initialize the scene
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // Set up camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 0.7;
  camera.position.y = 0.2;

  // Set up renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  // Load the monitor model and atlas texture
  loadMonitorAndAtlas();

  // Add UI for switching UVs and controlling visibility
  createUI();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
}

// Load the monitor model and atlas texture
function loadMonitorAndAtlas() {
  updateStatus("Loading atlas texture and monitor model...");
  
  // Create texture loader
  const textureLoader = new THREE.TextureLoader();
  
  // Load the atlas texture - try different potential paths
  const potentialTexturePaths = [
    '../public/images/atlas-test.jpg',
    'public/images/atlas-test.jpg',
    '/public/images/atlas-test.jpg',
    'atlas-test.jpg',
    '/images/atlas-test.jpg'
  ];
  
  // Try each path until one works
  let textureLoaded = false;
  
  function tryLoadTexture(pathIndex) {
    if (pathIndex >= potentialTexturePaths.length) {
      updateStatus("Failed to load atlas texture. Please check path and ensure file exists.", "error");
      // Continue with model loading anyway
      loadModel();
      return;
    }
    
    const path = potentialTexturePaths[pathIndex];
    updateStatus(`Trying to load texture from: ${path}`);
    
    textureLoader.load(
      path,
      (texture) => {
        // Texture loaded successfully
        updateStatus(`Atlas texture loaded successfully from ${path}`);
        atlasTexture = texture;
        textureLoaded = true;
        
        // Now load the model
        loadModel();
      },
      undefined,
      (error) => {
        // Error loading texture, try next path
        console.warn(`Failed to load texture from ${path}: ${error.message}`);
        tryLoadTexture(pathIndex + 1);
      }
    );
  }
  
  // Start trying to load the texture
  tryLoadTexture(0);
  
  // Function to load the model
  function loadModel() {
    // Create GLTFLoader
    const gltfLoader = new GLTFLoader();
    
    // Potential model paths to try
    const potentialModelPaths = [
      '../public/assets/monitor.glb',
      'public/assets/monitor.glb',
      '/public/assets/monitor.glb',
      'monitor.glb',
      '/assets/monitor.glb'
    ];
    
    // Try each path until one works
    function tryLoadModel(pathIndex) {
      if (pathIndex >= potentialModelPaths.length) {
        updateStatus("Failed to load monitor model. Please check path and ensure file exists.", "error");
        if (window.showModelNotFoundError) {
          window.showModelNotFoundError();
        }
        return;
      }
      
      const path = potentialModelPaths[pathIndex];
      updateStatus(`Trying to load model from: ${path}`);
      
      gltfLoader.load(
        path,
        (gltf) => {
          // Model loaded successfully
          updateStatus(`Monitor model loaded successfully from ${path}`);
          monitorModel = gltf.scene;
          
          // Clear mesh groups
          meshGroups.collision = [];
          meshGroups.display = [];
          meshGroups.other = [];
          
          // Debug model structure
          debugModelStructure(monitorModel);
          
          // Categorize meshes and prepare materials
          categorizeMeshes();
          
          // Find and store the display screen mesh
          findDisplayScreen();
          
          // Apply atlas texture if it was loaded
          if (textureLoaded) {
            applyAtlasTexture();
          } else {
            updateStatus("Atlas texture wasn't loaded. Can't apply texture to model.", "warning");
          }
          
          // Add model to scene
          scene.add(monitorModel);
          
          // Adjust camera to focus on model
          fitCameraToModel();
          
          // Update visibility toggle buttons
          updateVisibilityControls();
        },
        (progress) => {
          const percent = (progress.loaded / progress.total * 100).toFixed(1);
          updateStatus(`Loading model: ${percent}%`);
        },
        (error) => {
          // Error loading model, try next path
          console.warn(`Failed to load model from ${path}: ${error.message}`);
          tryLoadModel(pathIndex + 1);
        }
      );
    }
    
    // Start trying to load the model
    tryLoadModel(0);
  }
}

// Debug the model structure
function debugModelStructure(model) {
  if (!model) return;
  
  // Create the debug info
  debugInfo.allMeshes = [];
  debugInfo.uvMaps = {};
  
  // Traverse all objects in the model
  model.traverse((child) => {
    if (child.isMesh) {
      // Store mesh info
      const meshInfo = {
        name: child.name,
        visible: child.visible,
        materialType: child.material ? child.material.type : 'none',
        hasUV: !!(child.geometry && child.geometry.attributes.uv),
        hasUV2: !!(child.geometry && child.geometry.attributes.uv2),
        hasUV3: !!(child.geometry && child.geometry.attributes.uv3),
        attributeNames: child.geometry ? Object.keys(child.geometry.attributes) : []
      };
      
      debugInfo.allMeshes.push(meshInfo);
      
      // Dump info to console
      console.log(`Mesh: ${child.name}`, meshInfo);
    }
  });
  
  // Update the UI with model info
  updateDebugUI();
}

// Categorize meshes into different groups
function categorizeMeshes() {
  if (!monitorModel) return;
  
  updateStatus("Categorizing meshes...");
  
  monitorModel.traverse((child) => {
    if (child.isMesh) {
      // Store the original material for later use
      child.userData.originalMaterial = child.material.clone();
      
      // Categorize based on name
      if (child.name.startsWith('col_')) {
        // This is a collision mesh
        meshGroups.collision.push(child);
        
        // Create wireframe material for collision meshes
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          wireframe: true,
          transparent: true,
          opacity: 0.7
        });
        
        // Store wireframe material
        child.userData.wireframeMaterial = wireframeMaterial;
        
        // Hide collision meshes by default
        child.visible = false;
        
        updateStatus(`Found collision mesh: ${child.name}`);
      } else if (child.name.includes('display') || child.name.includes('screen')) {
        // This is a display mesh
        meshGroups.display.push(child);
        updateStatus(`Found display mesh: ${child.name}`);
      } else {
        // Other mesh
        meshGroups.other.push(child);
        updateStatus(`Found other mesh: ${child.name}`);
      }
    }
  });
  
  updateStatus(`Categorized ${meshGroups.collision.length} collision meshes, ${meshGroups.display.length} display meshes, and ${meshGroups.other.length} other meshes`);
}

// Toggle visibility for a specific mesh group
function toggleMeshGroupVisibility(groupName, visible = null) {
  if (!meshGroups[groupName]) {
    updateStatus(`Mesh group '${groupName}' not found`, "error");
    return;
  }
  
  const meshes = meshGroups[groupName];
  const newVisibility = visible !== null ? visible : !meshes[0]?.visible;
  
  updateStatus(`${newVisibility ? 'Showing' : 'Hiding'} ${groupName} meshes (${meshes.length} meshes)`);
  
  meshes.forEach(mesh => {
    mesh.visible = newVisibility;
    
    // Special handling for collision meshes
    if (groupName === 'collision' && newVisibility) {
      // Apply wireframe material when showing collision meshes
      if (mesh.userData.wireframeMaterial) {
        mesh.material = mesh.userData.wireframeMaterial;
      }
    } else if (groupName === 'collision' && !newVisibility) {
      // Restore original material when hiding
      if (mesh.userData.originalMaterial) {
        mesh.material = mesh.userData.originalMaterial;
      }
    }
  });
  
  // Update visibility toggle buttons
  updateVisibilityControls();
}

// Check visibility status for a mesh group
function getMeshGroupVisibility(groupName) {
  if (!meshGroups[groupName] || meshGroups[groupName].length === 0) return false;
  return meshGroups[groupName][0].visible;
}

// Update the visibility control buttons to reflect current state
function updateVisibilityControls() {
  // Update collision toggle button
  const collisionToggle = document.getElementById('toggle-collision');
  if (collisionToggle) {
    const isVisible = getMeshGroupVisibility('collision');
    collisionToggle.textContent = isVisible ? 'Hide Collision Meshes' : 'Show Collision Meshes';
    collisionToggle.style.backgroundColor = isVisible ? '#ff6b6b' : '#4b4b4b';
  }
  
  // Update display toggle button
  const displayToggle = document.getElementById('toggle-display');
  if (displayToggle) {
    const isVisible = getMeshGroupVisibility('display');
    displayToggle.textContent = isVisible ? 'Hide Display Meshes' : 'Show Display Meshes';
    displayToggle.style.backgroundColor = isVisible ? '#6bff6b' : '#4b4b4b';
  }
  
  // Update other toggle button
  const otherToggle = document.getElementById('toggle-other');
  if (otherToggle) {
    const isVisible = getMeshGroupVisibility('other');
    otherToggle.textContent = isVisible ? 'Hide Other Meshes' : 'Show Other Meshes';
    otherToggle.style.backgroundColor = isVisible ? '#6b6bff' : '#4b4b4b';
  }
}

// Find the display screen mesh in the model
function findDisplayScreen() {
  if (!monitorModel) return;
  
  // Reset info
  displayScreenMesh = null;
  
  // Find the display_monitor_screen mesh
  monitorModel.traverse((child) => {
    if (child.isMesh && child.name === 'display_monitor_screen') {
      displayScreenMesh = child;
      updateStatus(`Found display screen mesh: ${child.name}`);
      
      // Log available attributes
      if (child.geometry && child.geometry.attributes) {
        const attributeNames = Object.keys(child.geometry.attributes);
        updateStatus(`Available attributes: ${attributeNames.join(', ')}`);
        
        // Store UV information for debugging
        attributeNames.forEach(name => {
          if (name.startsWith('uv') || name.includes('texcoord')) {
            const data = child.geometry.attributes[name];
            debugInfo.uvMaps[name] = {
              itemSize: data.itemSize,
              count: data.count,
              array: Array.from(data.array).slice(0, 20) // Show first 20 values
            };
          }
        });
      }
    }
  });
  
  // If we didn't find the specific screen mesh, look for alternatives
  if (!displayScreenMesh) {
    updateStatus("Could not find 'display_monitor_screen' mesh, looking for alternatives...", "warning");
    
    monitorModel.traverse((child) => {
      if (child.isMesh && !child.name.startsWith('col_') && 
          (child.name.includes('screen') || child.name.includes('display'))) {
        displayScreenMesh = child;
        updateStatus(`Found alternative display screen mesh: ${child.name}`);
      }
    });
    
    // If still no luck, use any non-collision mesh
    if (!displayScreenMesh) {
      monitorModel.traverse((child) => {
        if (child.isMesh && !child.name.startsWith('col_') && !displayScreenMesh) {
          displayScreenMesh = child;
          updateStatus(`Using fallback mesh for display: ${child.name}`, "warning");
        }
      });
    }
  }
  
  // Update UI
  updateDebugUI();
}

// Apply the atlas texture to the model
function applyAtlasTexture() {
  if (!monitorModel || !atlasTexture) return;
  
  updateStatus("Applying atlas texture to model...");
  
  // Apply atlas texture to all visible meshes
  monitorModel.traverse((child) => {
    if (child.isMesh && !child.name.startsWith('col_')) {
      // Skip collision meshes
      if (child.material) {
        // Clone the material to avoid affecting other instances
        child.material = child.material.clone();
        
        // Apply the atlas texture
        child.material.map = atlasTexture;
        child.material.needsUpdate = true;
        
        // Store the textured material as the original
        child.userData.originalMaterial = child.material.clone();
        
        updateStatus(`Applied atlas texture to mesh: ${child.name}`);
      }
    }
  });
  
  // Set initial UV map
  switchUVMap(0); // Start with UV0
}

// Function to switch between UV maps
function switchUVMap(uvIndex) {
  if (!displayScreenMesh) {
    updateStatus("Display screen mesh not found! Can't switch UV maps.", "error");
    return;
  }
  
  // Get the geometry
  const geometry = displayScreenMesh.geometry;
  if (!geometry) {
    updateStatus("Geometry not found on display screen mesh!", "error");
    return;
  }
  
  updateStatus(`Attempting to switch to UV index: ${uvIndex}`);
  
  // Check if the geometry has the requested UV attributes
  let sourceUV;
  let uvName;
  
  // List of potential UV attribute names
  const uvAttributeNames = {
    0: ['uv', 'texcoord', 'texcoord_0', 'UV', 'TEXCOORD_0'],
    1: ['uv1', 'texcoord_1', 'UV1', 'TEXCOORD_1'],
    2: ['uv2', 'texcoord_2', 'UV2', 'TEXCOORD_2'], 
    3: ['uv3', 'texcoord_3', 'UV3', 'TEXCOORD_3']
  };
  
  // Try to find the appropriate UV attribute
  const potentialNames = uvAttributeNames[uvIndex === 1 ? 2 : uvIndex] || uvAttributeNames[0];
  
  for (const name of potentialNames) {
    if (geometry.attributes[name]) {
      sourceUV = geometry.attributes[name];
      uvName = name;
      updateStatus(`Found UV attribute: ${name}`);
      break;
    }
  }
  
  // If we didn't find the UV attribute, use UV0
  if (!sourceUV) {
    if (uvIndex !== 0) {
      updateStatus(`Could not find UV${uvIndex} attribute, falling back to UV0`, "warning");
      sourceUV = geometry.attributes.uv;
      uvName = 'uv';
    } else {
      updateStatus("Could not find any UV attribute!", "error");
      return;
    }
  }
  
  updateStatus(`Using UV attribute: ${uvName}`);
  
  // Apply the selected UV map to the active texture coordinates
  try {
    // Create a copy of the UV data
    const newUVArray = new Float32Array(sourceUV.array);
    
    // Create a new attribute
    const newUVAttribute = new THREE.BufferAttribute(newUVArray, sourceUV.itemSize);
    
    // Update the primary UV attribute (used for rendering)
    geometry.setAttribute('uv', newUVAttribute);
    geometry.attributes.uv.needsUpdate = true;
    
    // Force material update
    if (displayScreenMesh.material) {
      displayScreenMesh.material.needsUpdate = true;
      updateStatus(`Successfully switched to ${uvName}, showing display ${uvIndex + 1}`);
    } else {
      updateStatus("Material not found on display screen mesh!", "error");
    }
  } catch (error) {
    updateStatus(`Error switching UV maps: ${error.message}`, "error");
  }
  
  // Update the UI
  updateDebugUI();
}

// Adjust camera to fit the model
function fitCameraToModel() {
  if (!monitorModel) return;
  
  // Create a bounding box for the model
  const boundingBox = new THREE.Box3().setFromObject(monitorModel);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  
  // Set camera position based on bounding box
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;
  
  camera.position.set(center.x, center.y + size.y * 0.2, center.z + cameraZ);
  controls.target.copy(center);
  camera.updateProjectionMatrix();
  controls.update();
}

// Update status message in the UI
function updateStatus(message, type = "info") {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;
  
  // Create a new status message
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  messageElement.className = `status-message ${type}`;
  
  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  const timeElement = document.createElement('span');
  timeElement.textContent = `[${timestamp}] `;
  timeElement.className = 'timestamp';
  messageElement.prepend(timeElement);
  
  // Add to the status container
  statusElement.appendChild(messageElement);
  
  // Scroll to the bottom
  statusElement.scrollTop = statusElement.scrollHeight;
  
  // Limit number of messages
  while (statusElement.childElementCount > 100) {
    statusElement.removeChild(statusElement.firstChild);
  }
  
  // Also log to console
  console[type === "error" ? "error" : type === "warning" ? "warn" : "log"](message);
}

// Update the debug UI with model info
function updateDebugUI() {
  const meshListElement = document.getElementById('mesh-list');
  if (!meshListElement) return;
  
  // Clear existing content
  meshListElement.innerHTML = '';
  
  // Add header
  const header = document.createElement('div');
  header.className = 'debug-header';
  header.textContent = 'Model Meshes:';
  meshListElement.appendChild(header);
  
  // Add each mesh
  if (debugInfo.allMeshes && debugInfo.allMeshes.length > 0) {
    debugInfo.allMeshes.forEach(mesh => {
      const meshElement = document.createElement('div');
      meshElement.className = 'debug-item';
      
      // Determine mesh type for styling
      let meshTypeClass = '';
      if (mesh.name.startsWith('col_')) {
        meshTypeClass = 'collision-mesh';
      } else if (mesh.name.includes('display') || mesh.name.includes('screen')) {
        meshTypeClass = 'display-mesh';
      }
      
      // Format content
      meshElement.innerHTML = `
        <div class="${meshTypeClass}">${mesh.name}</div>
        <div class="debug-details">
          <div>Visible: ${mesh.visible}</div>
          <div>Material: ${mesh.materialType}</div>
          <div>UVs: ${mesh.hasUV ? 'UV0' : ''}${mesh.hasUV2 ? ', UV2' : ''}${mesh.hasUV3 ? ', UV3' : ''}</div>
          <div>Attributes: ${mesh.attributeNames.join(', ')}</div>
        </div>
      `;
      
      // Highlight the display screen mesh
      if (displayScreenMesh && mesh.name === displayScreenMesh.name) {
        meshElement.classList.add('active-mesh');
      }
      
      meshListElement.appendChild(meshElement);
    });
  } else {
    // No meshes found
    const noMeshes = document.createElement('div');
    noMeshes.textContent = 'No meshes found in model.';
    noMeshes.className = 'debug-item';
    meshListElement.appendChild(noMeshes);
  }
  
  // Update UV data if available
  const uvDataElement = document.getElementById('uv-data');
  if (uvDataElement) {
    uvDataElement.innerHTML = '';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'debug-header';
    header.textContent = 'UV Maps:';
    uvDataElement.appendChild(header);
    
    // Add UV data
    if (debugInfo.uvMaps && Object.keys(debugInfo.uvMaps).length > 0) {
      for (const [name, data] of Object.entries(debugInfo.uvMaps)) {
        const uvElement = document.createElement('div');
        uvElement.className = 'debug-item';
        
        // Format content
        uvElement.innerHTML = `
          <div>${name}</div>
          <div class="debug-details">
            <div>Item Size: ${data.itemSize}</div>
            <div>Count: ${data.count}</div>
            <div>Sample: ${data.array.map(v => v.toFixed(2)).join(', ')}</div>
          </div>
        `;
        
        uvDataElement.appendChild(uvElement);
      }
    } else {
      // No UV data found
      const noUVs = document.createElement('div');
      noUVs.textContent = 'No UV maps found.';
      noUVs.className = 'debug-item';
      uvDataElement.appendChild(noUVs);
    }
  }
  
  // Update mesh counts
  const meshCountElement = document.getElementById('mesh-counts');
  if (meshCountElement) {
    meshCountElement.innerHTML = `
      <span class="mesh-count-item">Display: <strong>${meshGroups.display.length}</strong></span>
      <span class="mesh-count-item">Collision: <strong>${meshGroups.collision.length}</strong></span>
      <span class="mesh-count-item">Other: <strong>${meshGroups.other.length}</strong></span>
      <span class="mesh-count-item">Total: <strong>${debugInfo.allMeshes ? debugInfo.allMeshes.length : 0}</strong></span>
    `;
  }
  
  // Update atlas visualization
  updateAtlasVisualization();
}

// Function to create and update the atlas visualization
function updateAtlasVisualization() {
  if (!atlasTexture) return;
  
  const atlasContainer = document.getElementById('atlas-container');
  if (!atlasContainer) return;
  
  // Clear existing content
  atlasContainer.innerHTML = '';
  
  // Add header
  const header = document.createElement('div');
  header.className = 'debug-header';
  header.textContent = 'Atlas Texture Visualization:';
  atlasContainer.appendChild(header);
  
  // Create a container for the atlas image
  const atlasImageContainer = document.createElement('div');
  atlasImageContainer.className = 'atlas-image-container';
  atlasContainer.appendChild(atlasImageContainer);
  
  // Create canvas to display the texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  canvas.className = 'atlas-canvas';
  atlasImageContainer.appendChild(canvas);
  
  // Get the canvas context
  const ctx = canvas.getContext('2d');
  
  // Create an image from the texture
  const image = new Image();
  image.onload = () => {
    // Draw the image on the canvas
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Draw UV grid overlay
    drawUVGrid(ctx, canvas.width, canvas.height);
    
    // Highlight the active UV region if we have UV data
    highlightActiveUVRegion(ctx, canvas.width, canvas.height);
    
    // Add explanation
    const explanation = document.createElement('div');
    explanation.className = 'atlas-explanation';
    explanation.innerHTML = `
      <p><strong>Atlas Explanation:</strong></p>
      <p>This is the atlas texture used by the model. The texture contains different display images (numbers 1, 2, 3) 
      in different regions. When you switch between UV maps, the model selects different parts of this texture.</p>
      <p>The grid overlay shows UV coordinates (0-1). The highlighted region shows the approximate area
      being used by the current UV mapping.</p>
    `;
    atlasContainer.appendChild(explanation);
  };
  
  // Set image source - since atlasTexture is a Three.js texture, we need to get its image source
  if (atlasTexture.image && atlasTexture.image.src) {
    image.src = atlasTexture.image.src;
  } else {
    // If we can't get the src directly, try to use a Canvas to extract the image data
    // This is a bit of a hack since we don't have direct access to the texture data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = atlasTexture.image ? atlasTexture.image.width : 256;
    tempCanvas.height = atlasTexture.image ? atlasTexture.image.height : 256;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (atlasTexture.image) {
      tempCtx.drawImage(atlasTexture.image, 0, 0);
      image.src = tempCanvas.toDataURL();
    } else {
      // If we can't get the image at all, just show a message
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Unable to display texture', canvas.width / 2, canvas.height / 2);
    }
  }
}

// Draw a UV grid on the atlas texture visualization
function drawUVGrid(ctx, width, height) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  
  // Draw vertical grid lines
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    
    // Add labels for 0, 0.5, and 1
    if (i === 0 || i === 5 || i === 10) {
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText((i / 10).toFixed(1), x + 5, 15);
    }
  }
  
  // Draw horizontal grid lines
  for (let i = 0; i <= 10; i++) {
    const y = (i / 10) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    
    // Add labels for 0, 0.5, and 1
    if (i === 0 || i === 5 || i === 10) {
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText((i / 10).toFixed(1), 5, y + 15);
    }
  }
}

// Highlight the active UV region
function highlightActiveUVRegion(ctx, width, height) {
  // Only proceed if we have the display screen mesh and it has geometry
  if (!displayScreenMesh || !displayScreenMesh.geometry) return;
  
  // Get the UV attribute
  const uvAttribute = displayScreenMesh.geometry.attributes.uv;
  if (!uvAttribute) return;
  
  // Extract UV data
  const uv = uvAttribute.array;
  let minU = 1, minV = 1, maxU = 0, maxV = 0;
  
  // Find the UV bounds
  for (let i = 0; i < uv.length; i += 2) {
    const u = uv[i];
    const v = uv[i + 1];
    
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }
  
  // Draw the UV region
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(minU * width, (1 - maxV) * height, (maxU - minU) * width, (maxV - minV) * height);
  ctx.stroke();
  
  // Add a label
  ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.font = '14px Arial';
  ctx.fillText('Current UV Region', minU * width + 5, (1 - maxV) * height - 5);
  
  // Store the UV bounds for debugging
  debugInfo.currentUVBounds = { minU, minV, maxU, maxV };
  
  // Check for potential issues
  checkUVIssues(minU, minV, maxU, maxV);
}

// Check for common UV mapping issues
function checkUVIssues(minU, minV, maxU, maxV) {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;
  
  // Issue 1: UV coordinates outside the 0-1 range
  if (minU < 0 || minV < 0 || maxU > 1 || maxV > 1) {
    updateStatus("WARNING: UV coordinates are outside the 0-1 range. This may cause texture issues.", "warning");
  }
  
  // Issue 2: Very small UV region (might indicate wrong mapping)
  const uvWidth = maxU - minU;
  const uvHeight = maxV - minV;
  if (uvWidth < 0.1 || uvHeight < 0.1) {
    updateStatus("WARNING: UV region is very small. The texture may appear stretched or compressed.", "warning");
  }
  
  // Issue 3: UV region covers most/all of the texture (might be using the whole texture instead of part of the atlas)
  if (uvWidth > 0.9 && uvHeight > 0.9) {
    updateStatus("NOTE: UV region covers almost the entire texture. If this is an atlas, you may not be using the correct part.", "info");
  }
  
  // Print the UV bounds to the status for debugging
  updateStatus(`Current UV bounds: U(${minU.toFixed(3)}-${maxU.toFixed(3)}), V(${minV.toFixed(3)}-${maxV.toFixed(3)})`, "info");
}

// Create UI for debugging and controls
function createUI() {
  // Create main container
  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui-container';
  uiContainer.className = 'ui-container';
  document.body.appendChild(uiContainer);
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  uiContainer.appendChild(buttonContainer);
  
  // Add title
  const titleElement = document.createElement('div');
  titleElement.textContent = '3D Asset Debugger';
  titleElement.className = 'title';
  buttonContainer.appendChild(titleElement);
  
  // Create UV control section
  const uvControlsSection = document.createElement('div');
  uvControlsSection.className = 'control-section';
  buttonContainer.appendChild(uvControlsSection);
  
  // Add section header
  const uvSectionHeader = document.createElement('div');
  uvSectionHeader.textContent = 'UV Maps';
  uvSectionHeader.className = 'section-header';
  uvControlsSection.appendChild(uvSectionHeader);
  
  // Add buttons for switching UV maps
  ['Display 1 (UV0)', 'Display 2 (UV2)', 'Display 3 (UV3)'].forEach((label, index) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'control-button';
    button.addEventListener('click', () => {
      updateStatus(`${label} button clicked`);
      switchUVMap(index);
    });
    uvControlsSection.appendChild(button);
  });
  
  // Create mesh visibility section
  const visibilitySection = document.createElement('div');
  visibilitySection.className = 'control-section';
  buttonContainer.appendChild(visibilitySection);
  
  // Add section header
  const visibilitySectionHeader = document.createElement('div');
  visibilitySectionHeader.textContent = 'Mesh Visibility';
  visibilitySectionHeader.className = 'section-header';
  visibilitySection.appendChild(visibilitySectionHeader);
  
  // Add mesh counts
  const meshCountsElement = document.createElement('div');
  meshCountsElement.id = 'mesh-counts';
  meshCountsElement.className = 'mesh-counts';
  visibilitySection.appendChild(meshCountsElement);
  
  // Add buttons for toggling mesh visibility
  // Display meshes
  const toggleDisplayButton = document.createElement('button');
  toggleDisplayButton.id = 'toggle-display';
  toggleDisplayButton.textContent = 'Hide Display Meshes';
  toggleDisplayButton.className = 'control-button visibility-toggle';
  toggleDisplayButton.addEventListener('click', () => {
    toggleMeshGroupVisibility('display');
  });
  visibilitySection.appendChild(toggleDisplayButton);
  
  // Collision meshes
  const toggleCollisionButton = document.createElement('button');
  toggleCollisionButton.id = 'toggle-collision';
  toggleCollisionButton.textContent = 'Show Collision Meshes';
  toggleCollisionButton.className = 'control-button visibility-toggle';
  toggleCollisionButton.addEventListener('click', () => {
    toggleMeshGroupVisibility('collision');
  });
  visibilitySection.appendChild(toggleCollisionButton);
  
  // Other meshes
  const toggleOtherButton = document.createElement('button');
  toggleOtherButton.id = 'toggle-other';
  toggleOtherButton.textContent = 'Hide Other Meshes';
  toggleOtherButton.className = 'control-button visibility-toggle';
  toggleOtherButton.addEventListener('click', () => {
    toggleMeshGroupVisibility('other');
  });
  visibilitySection.appendChild(toggleOtherButton);
  
  // Add reload button
  const reloadButton = document.createElement('button');
  reloadButton.textContent = 'Reload Model & Texture';
  reloadButton.className = 'control-button reload';
  reloadButton.addEventListener('click', () => {
    updateStatus('Reloading model and texture...');
    // Remove current model from scene
    if (monitorModel) {
      scene.remove(monitorModel);
      monitorModel = null;
      displayScreenMesh = null;
    }
    // Clear debug info
    debugInfo = {};
    // Reset mesh groups
    meshGroups = {
      collision: [],
      display: [],
      other: []
    };
    // Reload
    loadMonitorAndAtlas();
  });
  buttonContainer.appendChild(reloadButton);
  
  // Create status container
  const statusContainer = document.createElement('div');
  statusContainer.className = 'status-container';
  statusContainer.innerHTML = '<div class="panel-title">Status Log</div>';
  
  const statusElement = document.createElement('div');
  statusElement.id = 'status';
  statusElement.className = 'status';
  statusContainer.appendChild(statusElement);
  uiContainer.appendChild(statusContainer);
  
  // Create debug info container
  const debugContainer = document.createElement('div');
  debugContainer.className = 'debug-container';
  
  // Atlas texture visualization
  const atlasContainer = document.createElement('div');
  atlasContainer.className = 'debug-panel';
  atlasContainer.id = 'atlas-container';
  atlasContainer.innerHTML = '<div class="panel-title">Atlas Texture</div>';
  debugContainer.appendChild(atlasContainer);
  
  // Mesh list
  const meshListContainer = document.createElement('div');
  meshListContainer.className = 'debug-panel';
  meshListContainer.innerHTML = '<div class="panel-title">Model Structure</div>';
  
  const meshListElement = document.createElement('div');
  meshListElement.id = 'mesh-list';
  meshListElement.className = 'mesh-list';
  meshListContainer.appendChild(meshListElement);
  debugContainer.appendChild(meshListContainer);
  
  // UV data
  const uvDataContainer = document.createElement('div');
  uvDataContainer.className = 'debug-panel';
  uvDataContainer.innerHTML = '<div class="panel-title">UV Data</div>';
  
  const uvDataElement = document.createElement('div');
  uvDataElement.id = 'uv-data';
  uvDataElement.className = 'uv-data';
  uvDataContainer.appendChild(uvDataElement);
  debugContainer.appendChild(uvDataContainer);
  
  uiContainer.appendChild(debugContainer);
  
  // Add toggle button for debug panel
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Toggle Debug Panel';
  toggleButton.className = 'toggle-button';
  toggleButton.addEventListener('click', () => {
    debugContainer.classList.toggle('hidden');
    statusContainer.classList.toggle('hidden');
  });
  buttonContainer.appendChild(toggleButton);
  
  // Initial status
  updateStatus('Atlas UV Mapping Debug Tool initialized');
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

// Add CSS styles to the page
function addStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .ui-container {
      position: absolute;
      width: 300px;
      top: 10px;
      left: 10px;
      color: white;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 100;
    }
    
    .button-container {
      background-color: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 10px;
    }
    
    .title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      text-align: center;
    }
    
    .section-header {
      font-weight: bold;
      margin: 15px 0 5px 0;
      padding-bottom: 5px;
      border-bottom: 1px solid #555;
      color: #aaa;
    }
    
    .control-section {
      margin-bottom: 15px;
    }
    
    .mesh-counts {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 12px;
      flex-wrap: wrap;
    }
    
    .mesh-count-item {
      margin-right: 5px;
      margin-bottom: 5px;
      background-color: #333;
      padding: 3px 5px;
      border-radius: 3px;
    }
    
    .control-button {
      margin: 5px;
      padding: 8px;
      background-color: #2a2a2a;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    
    .control-button:hover {
      background-color: #3a3a3a;
    }
    
    .visibility-toggle {
      width: calc(100% - 10px);
      margin-bottom: 5px;
      text-align: left;
      position: relative;
      padding-left: 20px;
    }
    
    .visibility-toggle::before {
      content: "•";
      font-size: 24px;
      position: absolute;
      left: 8px;
      top: 2px;
    }
    
    #toggle-display::before {
      color: #6bff6b;
    }
    
    #toggle-collision::before {
      color: #00ffff;
    }
    
    #toggle-other::before {
      color: #6b6bff;
    }
    
    .toggle-button {
      margin-top: 10px;
      width: 100%;
      padding: 5px;
      background-color: #333;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    
    .reload {
      background-color: #474747;
      margin-top: 10px;
      width: calc(100% - 10px);
    }
    
    .status-container {
      background-color: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      max-height: 200px;
      margin-bottom: 10px;
    }
    
    .panel-title {
      font-weight: bold;
      margin-bottom: 5px;
      font-size: 14px;
      color: #aaa;
    }
    
    .status {
      max-height: 180px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
    }
    
    .status-message {
      margin: 2px 0;
      padding: 2px 0;
      border-bottom: 1px solid #333;
    }
    
    .timestamp {
      color: #888;
    }
    
    .info {
      color: #8bff7a;
    }
    
    .warning {
      color: #ffcf4a;
    }
    
    .error {
      color: #ff6b6b;
    }
    
    .debug-container {
      background-color: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .debug-panel {
      margin-bottom: 20px;
    }
    
    .debug-header {
      font-weight: bold;
      margin: 10px 0 5px 0;
    }
    
    .debug-item {
      padding: 5px;
      border-bottom: 1px solid #333;
      cursor: pointer;
    }
    
    .debug-item:hover {
      background-color: #2a2a2a;
    }
    
    .debug-details {
      padding-left: 10px;
      font-size: 12px;
      color: #bbb;
    }
    
    .active-mesh {
      color: #5dff8d;
      background-color: rgba(50, 150, 50, 0.2);
    }
    
    .collision-mesh {
      color: #00ffff;
    }
    
    .display-mesh {
      color: #6bff6b;
    }
    
    .hidden {
      display: none;
    }
    
    .atlas-image-container {
      text-align: center;
      margin: 10px 0;
    }
    
    .atlas-canvas {
      border: 2px solid #444;
      max-width: 100%;
    }
    
    .atlas-explanation {
      font-size: 12px;
      color: #bbb;
      margin-top: 10px;
      padding: 10px;
      background-color: rgba(50, 50, 50, 0.5);
      border-radius: 4px;
    }
  `;
  document.head.appendChild(styleElement);
}

// Initialize the application
addStyles();
init(); 