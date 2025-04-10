import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Scene setup
let scene, camera, renderer;
let orbitControls;
let bones = [];
let boneLengths = [];
let rootBone, lastBone;
let tipBall;
let isDragging = false;
let isHovering = false;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let dragPlane = new THREE.Plane();
let dragPoint = new THREE.Vector3();
let wasLowPosition = false; // Track if we were previously in a low position
let loadedGlb = null;
let glbDetails = null;

// Options configuration
let options = {
  wireframe: true,  // Default is wireframe on
  boneColor: 0x156289,
  segmentCount: 4
};

// Colors
const normalColor = 0xff0000; // Red
const hoverColor = 0x00ff00;  // Green
const dragColor = 0x00ff00;   // Green

// Material references
let boneMaterial;

// Setup loading screen handlers
document.addEventListener('DOMContentLoaded', setupLoadingScreen);

function setupLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  const dropZone = document.getElementById('dropZone');
  const startButton = document.getElementById('startButton');
  const returnButton = document.getElementById('returnButton');
  
  // Return to Toolbox button
  returnButton.addEventListener('click', () => {
    // Navigate back to the blorktools main page
    window.location.href = '../../index.html';
  });
  
  // Drag and drop events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('highlight');
    
    // Check if dragged files contain GLB
    if (e.dataTransfer.items && e.dataTransfer.items.length) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile();
          if (file && file.name.toLowerCase().endsWith('.glb')) {
            dropZone.classList.add('valid-file');
            break;
          }
        }
      }
    }
  });
  
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('highlight');
    dropZone.classList.remove('valid-file');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('highlight');
    
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.glb')) {
        // For GLB files, keep the valid-file class to show green glow
        dropZone.classList.add('valid-file');
        // Show loading message
        dropZone.innerHTML = `<p>Loading ${file.name}...</p><p>Please wait</p>`;
        
        // Store the file for later use
        loadedGlb = file;
        
        // Create a URL for the file
        const fileURL = URL.createObjectURL(file);
        
        // Load and parse the GLB file
        const loader = new GLTFLoader();
        loader.load(
          fileURL,
          (gltf) => {
            // Parse successful
            analyzeGltfModel(gltf);
            dropZone.innerHTML = `<p>File loaded: ${file.name}</p><p>Click "Start Debugging" to continue</p>`;
          },
          (xhr) => {
            // Progress callback
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            dropZone.innerHTML = `<p>Loading ${file.name}: ${percent}%</p>`;
          },
          (error) => {
            // Error callback
            console.error('Error loading GLB:', error);
            dropZone.classList.remove('valid-file'); // Remove on error
            dropZone.innerHTML = `<p>Error loading file</p><p>${error.message}</p>`;
            setTimeout(() => {
              dropZone.innerHTML = `<p>Drag & drop a GLB file here</p><p>or continue without a model</p>`;
            }, 3000);
            loadedGlb = null;
          }
        );
      } else {
        dropZone.classList.remove('valid-file');
        dropZone.innerHTML = `<p>Please drop a GLB file</p><p>The file you dropped is not supported</p>`;
        setTimeout(() => {
          dropZone.innerHTML = `<p>Drag & drop a GLB file here</p><p>or continue without a model</p>`;
        }, 3000);
      }
    }
  });
  
  // Start button
  startButton.addEventListener('click', () => {
    loadingScreen.classList.add('hidden');
    init();
    animate();
  });
}

// Function to analyze the GLTF model and extract rig information
function analyzeGltfModel(gltf) {
  const rawDetails = {
    bones: [],
    rigs: [],
    roots: [],
    controls: [] // Handles/Controls
  };
  
  // Extract scene information
  const scene = gltf.scene;
  
  // Helper function to traverse the scene
  const traverseNode = (node, parentType = null) => {
    // Check if the node is a bone
    if (node.isBone || node.name.toLowerCase().includes('bone')) {
      rawDetails.bones.push({
        name: node.name,
        position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
        rotation: node.rotation ? [node.rotation.x, node.rotation.y, node.rotation.z] : null,
        parentName: parentType === 'bone' ? node.parent.name : null
      });
      parentType = 'bone';
    }
    
    // Check if the node is a rig
    if (node.name.toLowerCase().includes('rig') || node.name.toLowerCase().includes('armature')) {
      rawDetails.rigs.push({
        name: node.name,
        position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
        childCount: node.children ? node.children.length : 0
      });
      parentType = 'rig';
    }
    
    // Check if the node is a root
    if (node.name.toLowerCase().includes('root')) {
      rawDetails.roots.push({
        name: node.name,
        position: node.position ? [node.position.x, node.position.y, node.position.z] : null
      });
      parentType = 'root';
    }
    
    // Check if the node is a control/handle
    if (node.name.toLowerCase().includes('control') || 
        node.name.toLowerCase().includes('ctrl') || 
        node.name.toLowerCase().includes('handle')) {
      rawDetails.controls.push({
        name: node.name,
        position: node.position ? [node.position.x, node.position.y, node.position.z] : null,
        type: node.name.toLowerCase().includes('control') ? 'control' : 
              node.name.toLowerCase().includes('ctrl') ? 'ctrl' : 'handle'
      });
      parentType = 'control';
    }
    
    // Traverse children
    if (node.children) {
      node.children.forEach(child => traverseNode(child, parentType));
    }
  };
  
  // Start traversal from the scene
  scene.traverse(node => traverseNode(node));
  
  // Process raw details to deduplicate items
  glbDetails = {
    bones: deduplicateItems(rawDetails.bones),
    rigs: deduplicateItems(rawDetails.rigs),
    roots: deduplicateItems(rawDetails.roots),
    controls: deduplicateItems(rawDetails.controls)
  };
  
  console.log('GLB Analysis Results:', glbDetails);
}

// Function to deduplicate items and add count
function deduplicateItems(items) {
  const uniqueMap = new Map();
  
  items.forEach(item => {
    // Create a key by stringifying the relevant properties
    const key = JSON.stringify({
      name: item.name,
      position: item.position ? item.position.map(p => Math.round(p * 100) / 100) : null,
      type: item.type
    });
    
    if (uniqueMap.has(key)) {
      uniqueMap.get(key).count += 1;
    } else {
      uniqueMap.set(key, { ...item, count: 1 });
    }
  });
  
  return Array.from(uniqueMap.values());
}

function init() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333);
  
  // Grid
  const gridHelper = new THREE.GridHelper(100, 10);
  scene.add(gridHelper);

  // Axes helper
  const axesHelper = new THREE.AxesHelper(60);
  scene.add(axesHelper);
  
  // Add axis labels
  addAxisLabels();

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(30, 60, 90);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  
  // Lighting
  scene.add(new THREE.AmbientLight(0x444444));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(3, 10, 4);
  light.castShadow = true;
  scene.add(light);
  
  // Camera controls
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  
  // Create bone chain
  createBoneChain();
  
  // Add event listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  
  // Instructions
  const instructions = document.createElement('div');
  instructions.style.position = 'absolute';
  instructions.style.top = '10px';
  instructions.style.left = '10px';
  instructions.style.color = 'white';
  instructions.style.fontSize = '14px';
  instructions.style.background = 'rgba(0,0,0,0.5)';
  instructions.style.padding = '10px';
  instructions.innerHTML = 'Hover over the red ball to make it green<br>Click and drag the green ball to move it<br>Right-click and drag to rotate view<br>Red=X, Yellow=Y, Blue=Z axes';
  document.body.appendChild(instructions);
  
  // Create options panel
  createOptionsPanel();
}

function createOptionsPanel() {
  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.top = '10px';
  panel.style.right = '10px';
  panel.style.width = '200px';
  panel.style.maxHeight = '80vh'; // Set max height to 80% of viewport height
  panel.style.padding = '15px';
  panel.style.backgroundColor = 'rgba(0,0,0,0.7)';
  panel.style.color = 'white';
  panel.style.borderRadius = '5px';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.zIndex = '1000';
  panel.style.overflowY = 'auto'; // Enable vertical scrolling when needed
  
  // Panel title
  const title = document.createElement('h3');
  title.textContent = 'Rig Options';
  title.style.margin = '0 0 15px 0';
  title.style.textAlign = 'center';
  title.style.position = 'sticky';
  title.style.top = '0';
  title.style.backgroundColor = 'rgba(0,0,0,0.7)';
  title.style.zIndex = '1';
  title.style.padding = '5px 0';
  panel.appendChild(title);
  
  // Create tab buttons if we have GLB details
  if (glbDetails) {
    const tabContainer = document.createElement('div');
    tabContainer.style.display = 'flex';
    tabContainer.style.marginBottom = '15px';
    tabContainer.style.borderBottom = '1px solid #555';
    tabContainer.style.position = 'sticky';
    tabContainer.style.top = '40px';
    tabContainer.style.backgroundColor = 'rgba(0,0,0,0.7)';
    tabContainer.style.zIndex = '1';
    tabContainer.style.padding = '5px 0';
    
    const optionsTab = document.createElement('button');
    optionsTab.textContent = 'Options';
    optionsTab.style.flex = '1';
    optionsTab.style.padding = '8px';
    optionsTab.style.backgroundColor = 'rgba(0,0,0,0.3)';
    optionsTab.style.color = 'white';
    optionsTab.style.border = 'none';
    optionsTab.style.borderBottom = '2px solid #4CAF50';
    optionsTab.style.cursor = 'pointer';
    
    const detailsTab = document.createElement('button');
    detailsTab.textContent = 'Rig Details';
    detailsTab.style.flex = '1';
    detailsTab.style.padding = '8px';
    detailsTab.style.backgroundColor = 'transparent';
    detailsTab.style.color = '#aaa';
    detailsTab.style.border = 'none';
    detailsTab.style.cursor = 'pointer';
    
    const optionsContent = document.createElement('div');
    optionsContent.id = 'optionsContent';
    
    const detailsContent = document.createElement('div');
    detailsContent.id = 'detailsContent';
    detailsContent.style.display = 'none';
    detailsContent.style.maxHeight = 'calc(80vh - 100px)'; // Max height minus headers
    detailsContent.style.overflowY = 'auto';
    
    // Add the rig details content
    createRigDetailsContent(detailsContent);
    
    // Tab switching functionality
    optionsTab.addEventListener('click', () => {
      optionsTab.style.backgroundColor = 'rgba(0,0,0,0.3)';
      optionsTab.style.color = 'white';
      optionsTab.style.borderBottom = '2px solid #4CAF50';
      detailsTab.style.backgroundColor = 'transparent';
      detailsTab.style.color = '#aaa';
      detailsTab.style.borderBottom = 'none';
      optionsContent.style.display = 'block';
      detailsContent.style.display = 'none';
    });
    
    detailsTab.addEventListener('click', () => {
      detailsTab.style.backgroundColor = 'rgba(0,0,0,0.3)';
      detailsTab.style.color = 'white';
      detailsTab.style.borderBottom = '2px solid #4CAF50';
      optionsTab.style.backgroundColor = 'transparent';
      optionsTab.style.color = '#aaa';
      optionsTab.style.borderBottom = 'none';
      detailsContent.style.display = 'block';
      optionsContent.style.display = 'none';
    });
    
    tabContainer.appendChild(optionsTab);
    tabContainer.appendChild(detailsTab);
    panel.appendChild(tabContainer);
    panel.appendChild(optionsContent);
    panel.appendChild(detailsContent);
    
    // Add the standard options to the options content
    addStandardOptions(optionsContent);
  } else {
    // No GLB details, just add the standard options directly to the panel
    addStandardOptions(panel);
  }
  
  document.body.appendChild(panel);
}

// Function to create the rig details content - update the styling of the count indicator
function createRigDetailsContent(container) {
  if (!glbDetails) return;
  
  const createSection = (title, items) => {
    const section = document.createElement('div');
    section.style.marginBottom = '15px';
    
    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = title;
    sectionTitle.style.margin = '5px 0';
    sectionTitle.style.fontSize = '14px';
    sectionTitle.style.borderBottom = '1px solid #555';
    section.appendChild(sectionTitle);
    
    if (items.length === 0) {
      const noItems = document.createElement('p');
      noItems.textContent = 'None found';
      noItems.style.fontSize = '12px';
      noItems.style.color = '#aaa';
      noItems.style.margin = '5px 0';
      section.appendChild(noItems);
    } else {
      items.forEach(item => {
        const itemElem = document.createElement('div');
        itemElem.style.fontSize = '12px';
        itemElem.style.margin = '5px 0';
        itemElem.style.padding = '3px';
        itemElem.style.backgroundColor = 'rgba(255,255,255,0.1)';
        itemElem.style.borderRadius = '3px';
        itemElem.style.position = 'relative'; // For absolute positioning of the count
        
        // Create name element without the count
        const nameElem = document.createElement('div');
        nameElem.textContent = `Name: ${item.name}`;
        nameElem.style.paddingRight = item.count > 1 ? '40px' : '0'; // Make room for count
        itemElem.appendChild(nameElem);
        
        // Add count as a separate styled element if more than one
        if (item.count > 1) {
          const countElem = document.createElement('div');
          countElem.textContent = `x${item.count}`;
          countElem.style.position = 'absolute';
          countElem.style.right = '5px';
          countElem.style.top = '50%';
          countElem.style.transform = 'translateY(-50%)';
          countElem.style.fontSize = '14px';
          countElem.style.fontWeight = '600';
          countElem.style.color = '#4CAF50'; // Green color to make it stand out
          countElem.style.backgroundColor = 'rgba(0,0,0,0.2)';
          countElem.style.borderRadius = '3px';
          countElem.style.padding = '0 4px';
          itemElem.appendChild(countElem);
        }
        
        if (item.position) {
          const posElem = document.createElement('div');
          posElem.style.fontSize = '10px';
          posElem.style.color = '#ccc';
          posElem.textContent = `Pos: [${item.position.map(p => p.toFixed(2)).join(', ')}]`;
          itemElem.appendChild(posElem);
        }
        
        if (item.type) {
          const typeElem = document.createElement('div');
          typeElem.style.fontSize = '10px';
          typeElem.style.color = '#ccc';
          typeElem.textContent = `Type: ${item.type}`;
          itemElem.appendChild(typeElem);
        }
        
        section.appendChild(itemElem);
      });
    }
    
    return section;
  };
  
  // Create sections for each type of element
  container.appendChild(createSection('Bones', glbDetails.bones));
  container.appendChild(createSection('Rigs', glbDetails.rigs));
  container.appendChild(createSection('Roots', glbDetails.roots));
  container.appendChild(createSection('Controls/Handles', glbDetails.controls));
}

// Function to add the standard options to a container
function addStandardOptions(container) {
  // Fill rig toggle (inverse of wireframe)
  const wireframeContainer = document.createElement('div');
  wireframeContainer.style.marginBottom = '15px';
  
  const wireframeLabel = document.createElement('label');
  wireframeLabel.textContent = 'Fill Rig: ';
  wireframeLabel.style.display = 'inline-block';
  wireframeLabel.style.width = '60%';
  
  const wireframeCheckbox = document.createElement('input');
  wireframeCheckbox.type = 'checkbox';
  wireframeCheckbox.checked = !options.wireframe;  // Invert the logic
  wireframeCheckbox.style.cursor = 'pointer';
  wireframeCheckbox.addEventListener('change', (e) => {
    options.wireframe = !e.target.checked;  // Invert the logic
    updateBoneMaterial();
  });
  
  wireframeContainer.appendChild(wireframeLabel);
  wireframeContainer.appendChild(wireframeCheckbox);
  container.appendChild(wireframeContainer);
  
  // Color picker
  const colorContainer = document.createElement('div');
  colorContainer.style.marginBottom = '15px';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Rig Color: ';
  colorLabel.style.display = 'inline-block';
  colorLabel.style.width = '60%';
  
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.value = '#' + options.boneColor.toString(16).padStart(6, '0');
  colorPicker.style.cursor = 'pointer';
  colorPicker.addEventListener('input', (e) => {
    // Convert hex string to integer
    options.boneColor = parseInt(e.target.value.substring(1), 16);
    updateBoneMaterial();
  });
  
  colorContainer.appendChild(colorLabel);
  colorContainer.appendChild(colorPicker);
  container.appendChild(colorContainer);
  
  // Bone count adjustment - updated to have controls on the same line
  const boneCountContainer = document.createElement('div');
  boneCountContainer.style.marginBottom = '15px';
  boneCountContainer.style.display = 'flex';
  boneCountContainer.style.alignItems = 'center';
  
  const boneCountLabel = document.createElement('label');
  boneCountLabel.textContent = 'Bone Count: ';
  boneCountLabel.style.display = 'inline-block';
  boneCountLabel.style.width = '60%';
  
  const controlsContainer = document.createElement('div');
  controlsContainer.style.display = 'flex';
  controlsContainer.style.alignItems = 'center';
  controlsContainer.style.width = '40%';
  controlsContainer.style.justifyContent = 'space-between';
  
  const decreaseButton = document.createElement('button');
  decreaseButton.textContent = '-';
  decreaseButton.style.width = '30px';
  decreaseButton.style.cursor = 'pointer';
  decreaseButton.style.height = '30px';
  decreaseButton.style.lineHeight = '1';
  decreaseButton.addEventListener('click', () => {
    if (options.segmentCount > 1) {
      options.segmentCount--;
      boneCountValue.textContent = options.segmentCount;
      rebuildBoneChain();
    }
  });
  
  const boneCountValue = document.createElement('span');
  boneCountValue.textContent = options.segmentCount;
  boneCountValue.style.display = 'inline-block';
  boneCountValue.style.textAlign = 'center';
  boneCountValue.style.minWidth = '20px';
  
  const increaseButton = document.createElement('button');
  increaseButton.textContent = '+';
  increaseButton.style.width = '30px';
  increaseButton.style.cursor = 'pointer';
  increaseButton.style.height = '30px';
  increaseButton.style.lineHeight = '1';
  increaseButton.addEventListener('click', () => {
    if (options.segmentCount < 8) {
      options.segmentCount++;
      boneCountValue.textContent = options.segmentCount;
      rebuildBoneChain();
    }
  });
  
  controlsContainer.appendChild(decreaseButton);
  controlsContainer.appendChild(boneCountValue);
  controlsContainer.appendChild(increaseButton);
  
  boneCountContainer.appendChild(boneCountLabel);
  boneCountContainer.appendChild(controlsContainer);
  container.appendChild(boneCountContainer);
  
  // Add restart button
  const restartContainer = document.createElement('div');
  restartContainer.style.marginTop = '20px';
  restartContainer.style.display = 'flex';
  restartContainer.style.justifyContent = 'center';
  
  const restartButton = document.createElement('button');
  restartButton.textContent = 'Restart';
  restartButton.style.padding = '8px 16px';
  restartButton.style.backgroundColor = '#f44336';
  restartButton.style.color = 'white';
  restartButton.style.border = 'none';
  restartButton.style.borderRadius = '4px';
  restartButton.style.cursor = 'pointer';
  restartButton.style.transition = 'background-color 0.3s';
  restartButton.style.fontSize = '14px';
  
  restartButton.addEventListener('mouseover', () => {
    restartButton.style.backgroundColor = '#d32f2f';
  });
  
  restartButton.addEventListener('mouseout', () => {
    restartButton.style.backgroundColor = '#f44336';
  });
  
  restartButton.addEventListener('click', () => {
    window.location.reload();
  });
  
  restartContainer.appendChild(restartButton);
  container.appendChild(restartContainer);
}

function addAxisLabels() {
  // Function to create an axis marker
  function createAxisMarker(text, position, color) {
    // Create large spherical marker
    const markerGeometry = new THREE.SphereGeometry(3, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: color });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    scene.add(marker);
    
    // Create text label
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.font = 'Bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.copy(position).add(new THREE.Vector3(0, 7, 0));
    label.scale.set(10, 10, 1);
    scene.add(label);
  }
  
  // X axis (red)
  createAxisMarker('+X', new THREE.Vector3(60, 0, 0), 0xff0000);
  createAxisMarker('-X', new THREE.Vector3(-60, 0, 0), 0xff0000);
  
  // Y axis (yellow instead of green)
  createAxisMarker('+Y', new THREE.Vector3(0, 60, 0), 0xffff00);
  createAxisMarker('-Y', new THREE.Vector3(0, -10, 0), 0xffff00);
  
  // Z axis (blue)
  createAxisMarker('+Z', new THREE.Vector3(0, 0, 60), 0x0000ff);
  createAxisMarker('-Z', new THREE.Vector3(0, 0, -60), 0x0000ff);
}

function updateBoneMaterial() {
  if (!boneMaterial) return;
  
  boneMaterial.wireframe = options.wireframe;
  boneMaterial.color.setHex(options.boneColor);
  
  // If there are any mesh bones, update them
  bones.forEach(bone => {
    if (bone.children && bone.children.length > 0) {
      bone.children.forEach(child => {
        if (child.isMesh && child !== tipBall) {
          child.material = boneMaterial;
        }
      });
    }
  });
  
  // Also update the base cylinder if it exists
  if (rootBone && rootBone.children && rootBone.children.length > 0) {
    rootBone.children.forEach(child => {
      if (child.isMesh) {
        child.material = boneMaterial;
      }
    });
  }
}

function rebuildBoneChain() {
  // Remove the old bone chain
  if (rootBone) {
    scene.remove(rootBone);
  }
  
  // Clear arrays
  bones = [];
  boneLengths = [];
  
  // Create a new bone chain
  createBoneChain();
  
  // Update the scene
  updateAllBoneMatrices();
}

function createBoneChain() {
  // Constants
  const segmentHeight = 15;
  const segmentCount = options.segmentCount;
  const boneSize = 4;
  
  // Material
  boneMaterial = new THREE.MeshPhongMaterial({
    color: options.boneColor,
    emissive: 0x072534,
    side: THREE.DoubleSide,
    flatShading: true,
    wireframe: options.wireframe
  });
  
  // Create arrays
  bones = [];
  boneLengths = [];
  
  // Root
  rootBone = new THREE.Object3D();
  rootBone.position.set(0, 0, 0);
  scene.add(rootBone);
  
  // Base cylinder
  const baseGeometry = new THREE.CylinderGeometry(7, 7, 5, 16);
  const baseMesh = new THREE.Mesh(baseGeometry, boneMaterial);
  baseMesh.position.y = 2.5;
  rootBone.add(baseMesh);
  
  // Create chain
  let prevBone = rootBone;
  for (let i = 0; i < segmentCount; i++) {
    const bone = new THREE.Object3D();
    bone.position.y = i === 0 ? 5 : segmentHeight;
    
    const segmentGeo = new THREE.CylinderGeometry(
      boneSize - (i * 0.5),
      boneSize - ((i + 1) * 0.5),
      segmentHeight, 8
    );
    segmentGeo.translate(0, segmentHeight/2, 0);
    const segment = new THREE.Mesh(segmentGeo, boneMaterial);
    
    bone.add(segment);
    prevBone.add(bone);
    bones.push(bone);
    boneLengths.push(segmentHeight);
    prevBone = bone;
  }
  
  // Store last bone reference
  lastBone = bones[bones.length - 1];
  
  // Add ball at tip
  tipBall = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 16),
    new THREE.MeshPhongMaterial({ color: normalColor })
  );
  tipBall.position.y = segmentHeight;
  lastBone.add(tipBall);
  
  // Force matrix update
  scene.updateMatrixWorld(true);
}

function getTipPosition(outVector) {
  const tipPos = new THREE.Vector3(0, lastBone.children[1].position.y, 0);
  lastBone.updateWorldMatrix(true, false);
  return outVector.copy(tipPos).applyMatrix4(lastBone.matrixWorld);
}

function checkTipHover(clientX, clientY) {
  // Normalized device coordinates
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  
  // Update ray
  raycaster.setFromCamera(mouse, camera);
  
  // Check for intersection with tip ball
  const intersects = raycaster.intersectObject(tipBall);
  
  // Update hover state
  const wasHovering = isHovering;
  isHovering = intersects.length > 0;
  
  // Update color only if state changed
  if (isHovering !== wasHovering) {
    tipBall.material.color.setHex(isHovering ? hoverColor : normalColor);
  }
  
  return isHovering;
}

function setupDragPlane(clientX, clientY, origin) {
  // Create a plane perpendicular to the camera view
  const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  dragPlane.setFromNormalAndCoplanarPoint(planeNormal, origin);
  
  // Get the 3D point where the user initially clicked
  dragPoint.copy(getMouseIntersection(clientX, clientY, dragPlane));
}

function getMouseIntersection(clientX, clientY, plane) {
  // Convert to normalized device coordinates
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  
  // Update the picking ray
  raycaster.setFromCamera(mouse, camera);
  
  // Find intersection with the plane
  const intersection = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, intersection)) {
    // If no intersection, create a point at a reasonable distance along the ray
    intersection.copy(raycaster.ray.origin).add(
      raycaster.ray.direction.clone().multiplyScalar(100)
    );
  }
  
  return intersection;
}

function onMouseDown(event) {
  if (event.button !== 0) return; // Only handle left button
  
  // Check if hovering over the tip ball
  if (checkTipHover(event.clientX, event.clientY)) {
    isDragging = true;
    orbitControls.enabled = false;
    
    // Set the drag color
    tipBall.material.color.setHex(dragColor);
  }
}

function onMouseMove(event) {
  if (isDragging) {
    // Get normalized device coordinates (NDC)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Create ray from camera through mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Get the root position
    const rootPos = new THREE.Vector3();
    rootBone.getWorldPosition(rootPos);
    
    // Calculate total arm length
    let totalLength = 0;
    boneLengths.forEach(length => totalLength += length);
    
    // Create ray from camera and get the direction vector
    const rayOrigin = raycaster.ray.origin.clone();
    const rayDirection = raycaster.ray.direction.clone();
    
    // Create a target plane that always faces the camera
    const targetPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      rayDirection.clone().negate(),
      rootPos
    );
    
    // Find intersection point with this plane
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(targetPlane, targetPoint);
    
    // If this fails for some reason, just use a point along the ray
    if (!targetPoint.x && !targetPoint.y && !targetPoint.z) {
      targetPoint.copy(rayOrigin).add(rayDirection.multiplyScalar(100));
    }
    
    // Always use the actual intersection point for better directional accuracy
    const targetPosition = targetPoint.clone();
    
    // Direct position-based IK
    positionBones(targetPosition);
  } else {
    // Just check hover state
    checkTipHover(event.clientX, event.clientY);
  }
}

function onMouseUp() {
  if (isDragging) {
    isDragging = false;
    orbitControls.enabled = true;
  }
}

function positionBones(targetPosition) {
  // Calculate total length of the arm
  let totalLength = 0;
  boneLengths.forEach(length => totalLength += length);
  
  // Get the root position
  const rootPos = new THREE.Vector3();
  rootBone.getWorldPosition(rootPos);
  
  // Reset all bone rotations first - start from a clear state
  bones.forEach(bone => bone.rotation.set(0, 0, 0));
  updateAllBoneMatrices();
  
  // Use simple CCD - no special handling for max extension or vertical cases
  const iterations = 10;
  
  for (let iteration = 0; iteration < iterations; iteration++) {
    // Work backwards from the tip to root
    for (let i = bones.length - 1; i >= 0; i--) {
      const bone = bones[i];
      
      // Get current tip position
      const tipPos = new THREE.Vector3();
      getTipPosition(tipPos);
      
      // Get current bone position in world space
      const bonePos = new THREE.Vector3();
      bone.getWorldPosition(bonePos);
      
      // Direction from bone to tip
      const dirToTip = new THREE.Vector3().subVectors(tipPos, bonePos).normalize();
      
      // Direction from bone to target
      const dirToTarget = new THREE.Vector3().subVectors(targetPosition, bonePos).normalize();
      
      // Calculate the angle between these directions
      let rotAngle = Math.acos(Math.min(1, Math.max(-1, dirToTip.dot(dirToTarget))));
      
      // If the angle is very small, skip this bone
      if (rotAngle < 0.01) continue;
      
      // Limit rotation angle per iteration for smoother movement
      rotAngle = Math.min(rotAngle, 0.2);
      
      // Calculate rotation axis (perpendicular to both directions)
      const rotAxis = new THREE.Vector3().crossVectors(dirToTip, dirToTarget).normalize();
      
      // Skip if we can't determine rotation axis
      if (rotAxis.lengthSq() < 0.01) continue;
      
      // Convert world rotation axis to bone local space
      const boneWorldQuat = new THREE.Quaternion();
      bone.getWorldQuaternion(boneWorldQuat);
      const localRotAxis = rotAxis.clone().applyQuaternion(boneWorldQuat.clone().invert()).normalize();
      
      // Apply rotation around local axis
      bone.rotateOnAxis(localRotAxis, rotAngle);
      
      // Update world matrices
      updateAllBoneMatrices();
      
      // If we're close enough to the target, we can stop
      if (tipPos.distanceTo(targetPosition) < 0.5) {
        break;
      }
    }
  }
}

// Unused now but kept for compatibility
function forceUprightPosition(mousePosition) {
  positionBones(mousePosition);
}

function blendedGroundPosition(mousePosition, rootPos, blendFactor) {
  positionBones(mousePosition);
}

function handleStandardPosition(mousePosition, rootPos) {
  positionBones(mousePosition);
}

function fineAdjustToTarget(targetPosition) {
  // Get current tip position
  const tipPos = new THREE.Vector3();
  getTipPosition(tipPos);
  
  // If we're already close enough, no adjustment needed
  if (tipPos.distanceTo(targetPosition) < 0.1) return;
  
  // Otherwise, just make a small adjustment to the last bone
  if (bones.length > 0) {
    const lastBone = bones[bones.length - 1];
    
    // Get current bone position
    const bonePos = new THREE.Vector3();
    lastBone.getWorldPosition(bonePos);
    
    // Calculate directions
    const dirToTip = new THREE.Vector3().subVectors(tipPos, bonePos).normalize();
    const dirToTarget = new THREE.Vector3().subVectors(targetPosition, bonePos).normalize();
    
    // Calculate rotation axis
    const rotAxis = new THREE.Vector3().crossVectors(dirToTip, dirToTarget).normalize();
    
    // If we can determine a rotation axis
    if (rotAxis.lengthSq() > 0.01) {
      // Convert to local space
      const boneWorldQuat = new THREE.Quaternion();
      lastBone.getWorldQuaternion(boneWorldQuat);
      const localRotAxis = rotAxis.clone().applyQuaternion(boneWorldQuat.clone().invert()).normalize();
      
      // Calculate angle
      const angle = dirToTip.angleTo(dirToTarget);
      
      // Apply rotation
      lastBone.rotateOnAxis(localRotAxis, angle);
      updateAllBoneMatrices();
    }
  }
}

function updateAllBoneMatrices() {
  rootBone.updateMatrixWorld(true);
  bones.forEach(bone => bone.updateMatrixWorld(true));
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  renderer.render(scene, camera);
} 