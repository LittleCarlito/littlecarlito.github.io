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
let loadedGltf = null; // Store the loaded GLTF model
let activeControlPoint = null; // The currently active control point for dragging
let armature = null; // The main armature in the loaded model
let controlPoints = []; // Array of control points in the model

// Options configuration
let options = {
  wireframe: true,  // Default is wireframe on
  boneColor: 0x156289,
  boneSideColor: 0x4c90c9, // Secondary color for sides
  segmentCount: 4
};

// Colors
const normalColor = 0xff0000; // Red
const hoverColor = 0x00ff00;  // Green
const dragColor = 0x00ff00;   // Green

// Material references
let boneMaterial;
let boneSideMaterial;

// Setup loading screen handlers
document.addEventListener('DOMContentLoaded', setupLoadingScreen);

function setupLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  const dropZone = document.getElementById('dropZone');
  const startButton = document.getElementById('startButton');
  const returnButton = document.getElementById('returnButton');
  
  // Return to Toolbox button - no need to reposition as it's already positioned in HTML
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
            loadedGltf = gltf; // Store the loaded GLTF model
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
            loadedGltf = null;
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
  
  // Create the rig - either from GLB or sample rig
  if (loadedGltf) {
    initializeRigFromGLB();
  } else {
    // Create the default bone chain if no GLB is loaded
    createBoneChain();
  }
  
  // Add event listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  
  // Add Restart button in upper left corner
  const restartButton = document.createElement('button');
  restartButton.textContent = 'Restart';
  restartButton.style.position = 'absolute';
  restartButton.style.top = '10px';
  restartButton.style.left = '10px';
  restartButton.style.padding = '8px 16px';
  restartButton.style.backgroundColor = '#f44336';
  restartButton.style.color = 'white';
  restartButton.style.border = 'none';
  restartButton.style.borderRadius = '4px';
  restartButton.style.cursor = 'pointer';
  restartButton.style.transition = 'background-color 0.3s';
  restartButton.style.fontSize = '14px';
  restartButton.style.zIndex = '100';
  
  restartButton.addEventListener('mouseover', () => {
    restartButton.style.backgroundColor = '#d32f2f';
  });
  
  restartButton.addEventListener('mouseout', () => {
    restartButton.style.backgroundColor = '#f44336';
  });
  
  restartButton.addEventListener('click', () => {
    window.location.reload();
  });
  
  document.body.appendChild(restartButton);
  
  // Instructions
  const instructions = document.createElement('div');
  instructions.style.position = 'absolute';
  instructions.style.top = '10px';
  instructions.style.left = '10px';
  instructions.style.color = 'white';
  instructions.style.fontSize = '14px';
  instructions.style.background = 'rgba(0,0,0,0.5)';
  instructions.style.padding = '10px';
  instructions.style.marginTop = '50px'; // Move below restart button
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
  
  // Panel title - Change to Rig Menu
  const title = document.createElement('h3');
  title.textContent = 'Rig Menu';
  title.style.margin = '0 0 15px 0';
  title.style.textAlign = 'center';
  title.style.position = 'sticky';
  title.style.top = '0';
  title.style.backgroundColor = 'rgba(0,0,0,0.7)';
  title.style.zIndex = '1';
  title.style.padding = '5px 0';
  panel.appendChild(title);
  
  // Create tab buttons (for both GLB and sample rig)
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
  if (glbDetails) {
    createRigDetailsContent(detailsContent);
  } else {
    // For sample rig, create sample rig details
    createSampleRigDetailsContent(detailsContent);
  }
  
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
  addStandardOptions(optionsContent, controlPoints.length > 0); // true if GLB loaded
  
  document.body.appendChild(panel);
}

// Global map to store locked bones
const lockedBones = new Map();

// Create the rig details content with bone locks
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
        
        // Add bone associations for control points
        if (title === 'Controls/Handles') {
          const associatedBone = findAssociatedBone(item.name);
          if (associatedBone) {
            const boneElem = document.createElement('div');
            boneElem.style.fontSize = '10px';
            boneElem.style.color = '#ffcc00';
            boneElem.textContent = `Controls bone: ${associatedBone.name}`;
            itemElem.appendChild(boneElem);
          }
        }
        
        // Add lock rotation toggle for bones
        if (title === 'Bones') {
          const lockContainer = document.createElement('div');
          lockContainer.style.display = 'flex';
          lockContainer.style.alignItems = 'center';
          lockContainer.style.marginTop = '5px';
          
          const lockLabel = document.createElement('label');
          lockLabel.textContent = 'Lock Rotation:';
          lockLabel.style.fontSize = '10px';
          lockLabel.style.marginRight = '5px';
          lockLabel.style.color = '#ccc';
          
          const lockCheckbox = document.createElement('input');
          lockCheckbox.type = 'checkbox';
          lockCheckbox.style.cursor = 'pointer';
          
          // Find the actual bone object by name for locking
          const boneName = item.name;
          const bone = findBoneByName(boneName);
          
          if (bone) {
            // Initialize checkbox state
            lockCheckbox.checked = lockedBones.has(bone.uuid);
            
            lockCheckbox.addEventListener('change', (e) => {
              if (e.target.checked) {
                // Store the bone's current rotation
                const rotationBackup = new THREE.Euler(
                  bone.rotation.x,
                  bone.rotation.y,
                  bone.rotation.z,
                  bone.rotation.order
                );
                lockedBones.set(bone.uuid, {
                  bone: bone,
                  rotation: rotationBackup
                });
                console.log(`Locked rotation for bone: ${bone.name}`);
              } else {
                lockedBones.delete(bone.uuid);
                console.log(`Unlocked rotation for bone: ${bone.name}`);
              }
            });
          }
          
          lockContainer.appendChild(lockLabel);
          lockContainer.appendChild(lockCheckbox);
          itemElem.appendChild(lockContainer);
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

// Helper function to find a bone by name
function findBoneByName(name) {
  let foundBone = null;
  bones.forEach(bone => {
    if (bone.name === name) {
      foundBone = bone;
    }
  });
  return foundBone;
}

// Helper function to find the bone associated with a control
function findAssociatedBone(controlName) {
  // Search for direct parent
  const control = controlPoints.find(cp => cp.name === controlName);
  if (control && control.parent && (control.parent.isBone || control.parent.name.toLowerCase().includes('bone'))) {
    return control.parent;
  }
  
  // Try matching by name
  const boneName = controlName.replace('control', 'bone')
                             .replace('ctrl', 'bone')
                             .replace('handle', 'bone');
  
  let matchedBone = null;
  bones.forEach(bone => {
    if (bone.name === boneName || bone.name.includes(boneName) || boneName.includes(bone.name)) {
      matchedBone = bone;
    }
  });
  
  return matchedBone;
}

function updateBoneMaterial() {
  if (!boneMaterial) return;
  
  boneMaterial.wireframe = options.wireframe;
  boneMaterial.color.setHex(options.boneColor);
  
  if (boneSideMaterial) {
    boneSideMaterial.wireframe = options.wireframe;
    boneSideMaterial.color.setHex(options.boneSideColor);
  }
  
  // If there are any mesh bones, update them
  scene.traverse(object => {
    if (object.userData && object.userData.bonePart) {
      if (object.isMesh) {
        if (object.userData.bonePart === 'cap') {
          object.material = boneMaterial;
        } else if (object.userData.bonePart === 'side') {
          if (object.userData.segmentIndex % 2 === 0) {
            object.material = boneMaterial;
          } else {
            object.material = boneSideMaterial;
          }
        }
      }
    }
  });
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
  
  // Materials
  boneMaterial = new THREE.MeshPhongMaterial({
    color: options.boneColor,
    emissive: 0x072534,
    side: THREE.DoubleSide,
    flatShading: true,
    wireframe: options.wireframe
  });
  
  boneSideMaterial = new THREE.MeshPhongMaterial({
    color: options.boneSideColor,
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
  
  // Base cylinder with dual materials
  createBoneMesh(rootBone, 7, 7, 5, 0, 2.5, true);
  
  // Create chain
  let prevBone = rootBone;
  for (let i = 0; i < segmentCount; i++) {
    const bone = new THREE.Object3D();
    bone.position.y = i === 0 ? 5 : segmentHeight;
    
    // Create bone mesh with different colors for top/bottom and sides
    createBoneMesh(bone, 
                   boneSize - (i * 0.5), 
                   boneSize - ((i + 1) * 0.5), 
                   segmentHeight, 
                   0, 
                   segmentHeight/2);
    
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

// Helper function to create bone mesh with different materials for sides and caps
function createBoneMesh(parent, radiusTop, radiusBottom, height, posX = 0, posY = 0, isBase = false) {
  // Number of segments around the cylinder to create alternating colors
  const segmentCount = 8;
  
  // Create caps
  if (!isBase || radiusTop > 0) {
    const topGeometry = new THREE.CircleGeometry(radiusTop, 16);
    const topMesh = new THREE.Mesh(topGeometry, boneMaterial);
    topMesh.userData.bonePart = 'cap';
    topMesh.position.set(posX, posY + height/2, 0);
    topMesh.rotation.x = -Math.PI/2;
    parent.add(topMesh);
  }
  
  const bottomGeometry = new THREE.CircleGeometry(radiusBottom, 16);
  const bottomMesh = new THREE.Mesh(bottomGeometry, boneMaterial);
  bottomMesh.userData.bonePart = 'cap';
  bottomMesh.position.set(posX, posY - height/2, 0);
  bottomMesh.rotation.x = Math.PI/2;
  parent.add(bottomMesh);
  
  // Create alternating colored segments around the cylinder
  for (let i = 0; i < segmentCount; i++) {
    // Alternate between the two colors
    const material = i % 2 === 0 ? boneMaterial : boneSideMaterial;
    
    // Create a partial cylinder segment
    const thetaStart = (i / segmentCount) * Math.PI * 2;
    const thetaLength = (1 / segmentCount) * Math.PI * 2;
    
    const segmentGeometry = new THREE.CylinderGeometry(
      radiusTop, radiusBottom, height, 
      1, 1, true, // open-ended cylinder
      thetaStart, thetaLength
    );
    
    const segmentMesh = new THREE.Mesh(segmentGeometry, material);
    segmentMesh.userData.bonePart = 'side';
    segmentMesh.userData.segmentIndex = i;
    segmentMesh.position.set(posX, posY, 0);
    parent.add(segmentMesh);
  }
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
  
  if (controlPoints.length > 0) {
    // GLB rig - check if hovering over any control point
    const hoveredControl = checkControlPointsHover(event.clientX, event.clientY);
    if (hoveredControl) {
      activeControlPoint = hoveredControl;
      isDragging = true;
      orbitControls.enabled = false;
      
      // Set the drag color
      hoveredControl.controlBall.material.color.setHex(dragColor);
      
      // Setup drag plane
      const controlPos = new THREE.Vector3();
      hoveredControl.getWorldPosition(controlPos);
      setupDragPlane(event.clientX, event.clientY, controlPos);
      
      console.log('Control point drag started:', hoveredControl.name);
    }
  } else {
    // Sample rig - check if hovering over the tip ball
    if (checkTipHover(event.clientX, event.clientY)) {
      isDragging = true;
      orbitControls.enabled = false;
      
      // Set the drag color
      tipBall.material.color.setHex(dragColor);
      
      console.log('Sample rig tip drag started');
    }
  }
}

function onMouseMove(event) {
  if (isDragging) {
    // Get normalized device coordinates (NDC)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Create ray from camera through mouse position
    raycaster.setFromCamera(mouse, camera);
    
    if (controlPoints.length > 0 && activeControlPoint) {
      // GLB rig - handle control point dragging
      
      // Get the root bone position
      const rootPos = new THREE.Vector3();
      if (rootBone) {
        rootBone.getWorldPosition(rootPos);
      }
      
      // Create a target plane that always faces the camera
      const rayOrigin = raycaster.ray.origin.clone();
      const rayDirection = raycaster.ray.direction.clone();
      
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
      
      // Set the target position
      const targetPosition = targetPoint.clone();
      
      console.log('Dragging control to position:', targetPosition);
      
      // Now move the target bone using IK
      const bone = getTargetBoneForControl(activeControlPoint);
      if (bone) {
        console.log('Found target bone for control:', bone.name);
        moveBonesForTarget(bone, targetPosition);
      } else {
        console.log('No target bone found for control');
      }
    } else {
      // Sample rig - handle tip ball dragging using existing logic
      // Get the root position
      const rootPos = new THREE.Vector3();
      rootBone.getWorldPosition(rootPos);
      
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
      
      console.log('Dragging sample tip to position:', targetPosition);
      
      // Direct position-based IK
      positionBones(targetPosition);
    }
  } else {
    // Check hover state
    if (controlPoints.length > 0) {
      checkControlPointsHover(event.clientX, event.clientY);
    } else {
      checkTipHover(event.clientX, event.clientY);
    }
  }
}

function onMouseUp() {
  if (isDragging) {
    isDragging = false;
    orbitControls.enabled = true;
    
    if (activeControlPoint) {
      activeControlPoint.controlBall.material.color.setHex(normalColor);
      activeControlPoint = null;
    }
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
  if (armature) {
    armature.updateMatrixWorld(true);
  } else if (rootBone) {
    rootBone.updateMatrixWorld(true);
  }
  
  bones.forEach(bone => {
    if (bone.updateMatrixWorld) {
      bone.updateMatrixWorld(true);
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  
  // Update bone line visualizations if any exist
  scene.traverse(obj => {
    if (obj.isLine && obj.userData.parentBone && obj.userData.childBone) {
      const positions = obj.geometry.attributes.position.array;
      const parentPos = new THREE.Vector3();
      const childPos = new THREE.Vector3();
      
      obj.userData.parentBone.getWorldPosition(parentPos);
      obj.userData.childBone.getWorldPosition(childPos);
      
      // Update line positions
      positions[0] = parentPos.x;
      positions[1] = parentPos.y;
      positions[2] = parentPos.z;
      positions[3] = childPos.x;
      positions[4] = childPos.y;
      positions[5] = childPos.z;
      
      obj.geometry.attributes.position.needsUpdate = true;
    }
    
    // Update visual bone positions and orientations
    if (obj.userData.isVisualBone && obj.userData.updatePosition) {
      obj.userData.updatePosition();
    }
  });
  
  orbitControls.update();
  renderer.render(scene, camera);
}

// Function to initialize a draggable rig from the GLB data
function initializeRigFromGLB() {
  if (!loadedGltf) return false;
  
  console.log('Initializing rig from GLB data');
  
  // Find the armature
  armature = null;
  loadedGltf.scene.traverse(node => {
    if ((node.name.toLowerCase().includes('rig') || 
         node.name.toLowerCase().includes('armature')) && !armature) {
      armature = node;
      console.log('Found armature:', node.name);
    }
  });
  
  // Add the model to the scene without scaling
  scene.add(loadedGltf.scene);
  
  // Create a bounding box to measure the model
  const bbox = new THREE.Box3().setFromObject(loadedGltf.scene);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  
  console.log('Model dimensions:', size);
  console.log('Model center:', center);
  
  // Adjust the environment to fit the model
  adjustEnvironmentToModel(bbox, size, center);
  
  // Calculate appropriate control point size based on model dimensions
  // Use 2% of the model's diagonal length for control points
  const modelScale = size.length() * 0.02;
  const controlPointSize = Math.max(0.1, modelScale); // Minimum size of 0.1
  console.log('Using control point size:', controlPointSize);
  
  // Display a helper box around the model
  const boxHelper = new THREE.BoxHelper(loadedGltf.scene, 0xffff00);
  scene.add(boxHelper);
  
  // Reset the arrays
  bones = [];
  boneLengths = [];
  controlPoints = [];
  
  // Find all bones and calculate their lengths
  const boneMap = new Map();
  
  // First pass: collect all bones
  if (armature) {
    armature.traverse(node => {
      if (node.isBone || node.name.toLowerCase().includes('bone')) {
        bones.push(node);
        boneMap.set(node.name, node);
        console.log('Found bone:', node.name);
      }
    });
  }
  
  // If no bones were found in the armature, try to find them in the whole scene
  if (bones.length === 0) {
    console.log('No bones found in armature, searching entire scene');
    loadedGltf.scene.traverse(node => {
      if (node.isBone || node.name.toLowerCase().includes('bone')) {
        bones.push(node);
        boneMap.set(node.name, node);
        console.log('Found bone in scene:', node.name);
      }
    });
  }
  
  // Create materials for GLB bone visualization
  boneMaterial = new THREE.MeshPhongMaterial({
    color: options.boneColor,
    emissive: 0x072534,
    side: THREE.DoubleSide,
    flatShading: true,
    wireframe: options.wireframe
  });
  
  boneSideMaterial = new THREE.MeshPhongMaterial({
    color: options.boneSideColor,
    emissive: 0x072534,
    side: THREE.DoubleSide,
    flatShading: true,
    wireframe: options.wireframe
  });
  
  // Second pass: calculate bone lengths and create visual bone meshes
  const bonesByParent = new Map(); // Map to store child bones by parent
  
  // Group bones by parent for easier bone pair creation
  bones.forEach(bone => {
    if (bone.parent) {
      const parentId = bone.parent.uuid;
      if (!bonesByParent.has(parentId)) {
        bonesByParent.set(parentId, []);
      }
      bonesByParent.get(parentId).push(bone);
    }
  });
  
  // Create visual bone meshes between parent-child bone pairs
  bones.forEach(bone => {
    // Skip if this bone is not in our scene (e.g., if it's part of a different armature)
    if (!scene.getObjectById(bone.id)) return;
    
    // Get current bone position
    const bonePos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    
    // Check if this bone has children in our bone list
    const childBones = bonesByParent.get(bone.uuid) || [];
    
    // If this bone has child bones, create a visual bone for each connection
    childBones.forEach(childBone => {
      // Get child bone position
      const childPos = new THREE.Vector3();
      childBone.getWorldPosition(childPos);
      
      // Calculate distance and direction
      const distance = bonePos.distanceTo(childPos);
      boneLengths.push(distance);
      
      // Only create visual bone if distance is not zero
      if (distance > 0.001) {
        // Create a group for the bone mesh
        const boneGroup = new THREE.Group();
        scene.add(boneGroup);
        
        // Position bone group at parent bone position
        boneGroup.position.copy(bonePos);
        
        // Make the bone look at the child
        const direction = new THREE.Vector3().subVectors(childPos, bonePos);
        boneGroup.lookAt(childPos);
        
        // Rotate to align with standard Three.js cylinder orientation
        boneGroup.rotateX(Math.PI/2);
        
        // Create bone mesh with two colors
        const jointSize = modelScale * 0.5;
        const boneRadius = modelScale * 0.3;
        createBoneMesh(boneGroup, boneRadius, boneRadius, distance, 0, 0);
        
        // Store reference to the bone connection
        boneGroup.userData.parentBone = bone;
        boneGroup.userData.childBone = childBone;
        
        // Add to scene for updates in animation loop
        boneGroup.userData.isVisualBone = true;
        
        // Add a debug label
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const context = labelCanvas.getContext('2d');
        context.fillStyle = 'rgba(0,0,0,0.5)';
        context.fillRect(0, 0, 256, 64);
        context.fillStyle = 'white';
        context.font = '12px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(bone.name + ' → ' + childBone.name, 128, 32);
        
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(distance * 0.5, distance * 0.12, 1);
        label.position.set(0, 0, 0);
        boneGroup.add(label);
      }
    });
    
    // If this bone has no children (end bones), create a small marker
    if (childBones.length === 0) {
      // Create a small cone to indicate end bones
      const endBoneMarker = new THREE.Mesh(
        new THREE.ConeGeometry(modelScale * 0.4, modelScale * 0.8, 8),
        boneMaterial
      );
      endBoneMarker.rotation.x = Math.PI; // Point outward
      bone.add(endBoneMarker);
    }
    
    // Add joint marker at bone position
    const jointMarker = new THREE.Mesh(
      new THREE.SphereGeometry(modelScale * 0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    bone.add(jointMarker);
  });
  
  // Find control points (controls/handles)
  loadedGltf.scene.traverse(node => {
    if (node.name.toLowerCase().includes('control') || 
        node.name.toLowerCase().includes('ctrl') || 
        node.name.toLowerCase().includes('handle')) {
      
      // Make the control point visible and interactive, sized appropriately for the model
      createControlPoint(node, controlPointSize);
      controlPoints.push(node);
      console.log('Found control point:', node.name);
    }
  });
  
  // If no control points were found, create one for the last bone
  if (controlPoints.length === 0 && bones.length > 0) {
    console.log('No control points found, creating one for the last bone');
    const lastBone = bones[bones.length - 1];
    const controlPoint = new THREE.Group();
    controlPoint.name = "generated_control";
    lastBone.add(controlPoint);
    createControlPoint(controlPoint, controlPointSize);
    controlPoints.push(controlPoint);
  }
  
  // If we still have no control points, create one for the model itself
  if (controlPoints.length === 0) {
    console.log('No bones or controls found, creating a control for the model itself');
    const modelControl = new THREE.Group();
    modelControl.name = "model_control";
    loadedGltf.scene.add(modelControl);
    createControlPoint(modelControl, controlPointSize * 5); // Make this one larger to be easily visible
    controlPoints.push(modelControl);
  }
  
  // Store the root bone
  rootBone = bones.length > 0 ? bones[0] : null;
  lastBone = bones.length > 0 ? bones[bones.length - 1] : null;
  
  // Update bone positions in the animation loop
  scene.traverse(object => {
    if (object.userData.isVisualBone) {
      object.userData.updatePosition = () => {
        if (object.userData.parentBone && object.userData.childBone) {
          const parentPos = new THREE.Vector3();
          const childPos = new THREE.Vector3();
          
          object.userData.parentBone.getWorldPosition(parentPos);
          object.userData.childBone.getWorldPosition(childPos);
          
          // Update position and orientation
          object.position.copy(parentPos);
          
          // Make the bone look at the child
          const direction = new THREE.Vector3().subVectors(childPos, parentPos);
          if (direction.lengthSq() > 0.001) { // Avoid issues with zero length
            object.lookAt(childPos);
            object.rotateX(Math.PI/2); // Adjust rotation to match cylinder orientation
            
            // Update scale to match new length
            const distance = parentPos.distanceTo(childPos);
            const children = object.children;
            for (let i = 0; i < children.length; i++) {
              if (children[i].userData.bonePart === 'side') {
                children[i].scale.set(1, distance / children[i].geometry.parameters.height, 1);
                children[i].position.y = distance / 2;
              }
            }
          }
        }
      };
    }
  });
  
  console.log('Model successfully added to scene at original scale');
  return true;
}

// Updated to accept a scale parameter - with better scaling for small models
function addAxisLabels(scale = 60) {
  // First do a thorough cleanup of any existing axis labels
  // This needs to happen before creating new labels
  cleanupAxisLabels();
  
  // Function to create an axis marker
  function createAxisMarker(text, position, color) {
    // Create spherical marker sized proportionally to the scale
    const markerSize = scale * 0.02; // Reduced from 0.05 to be smaller
    const markerGeometry = new THREE.SphereGeometry(markerSize, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: color });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    marker.userData.isAxisMarker = true; // Mark for easy removal
    marker.userData.axisLabel = text; // Tag with the label text for easier debugging
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
    label.userData.isAxisLabel = true; // Mark for easy removal
    label.userData.axisLabel = text; // Tag with the label text for easier debugging
    
    // Position the label a bit away from the axis end
    const labelOffset = scale * 0.08; // Reduced from 0.12
    label.position.copy(position).add(new THREE.Vector3(0, labelOffset, 0));
    
    // Scale label based on axis scale - smaller for small models
    const labelScale = scale * 0.1; // Reduced from 0.17
    label.scale.set(labelScale, labelScale, 1);
    
    scene.add(label);
    
    console.log(`Created axis label: ${text} with size ${labelScale}`);
  }
  
  // X axis (red)
  createAxisMarker('+X', new THREE.Vector3(scale, 0, 0), 0xff0000);
  createAxisMarker('-X', new THREE.Vector3(-scale, 0, 0), 0xff0000);
  
  // Y axis (yellow instead of green)
  createAxisMarker('+Y', new THREE.Vector3(0, scale, 0), 0xffff00);
  createAxisMarker('-Y', new THREE.Vector3(0, -scale * 0.17, 0), 0xffff00);
  
  // Z axis (blue)
  createAxisMarker('+Z', new THREE.Vector3(0, 0, scale), 0x0000ff);
  createAxisMarker('-Z', new THREE.Vector3(0, 0, -scale), 0x0000ff);
}

// Separate function to thoroughly clean up any axis labels
function cleanupAxisLabels() {
  // First gather all objects to remove to avoid modifying the array while iterating
  const objectsToRemove = [];
  
  scene.traverse((object) => {
    // Check for axis labels and markers using userData
    if ((object.isSprite && object.userData.isAxisLabel) || 
        (object.isMesh && object.userData.isAxisMarker)) {
      objectsToRemove.push(object);
    }
    
    // Also look for any objects that might be axis labels but weren't tagged properly
    if (object.isSprite) {
      const material = object.material;
      if (material && material.map && 
          (material.map.source && material.map.source.data instanceof HTMLCanvasElement)) {
        // This is likely a canvas sprite used for text labels
        objectsToRemove.push(object);
      }
    }
  });
  
  // Now remove all the gathered objects
  for (const object of objectsToRemove) {
    scene.remove(object);
    if (object.material) {
      if (object.material.map) {
        object.material.map.dispose();
      }
      object.material.dispose();
    }
    if (object.geometry) {
      object.geometry.dispose();
    }
  }
  
  console.log(`Cleaned up ${objectsToRemove.length} axis labels/markers`);
}

// New function to adjust environment to model scale
function adjustEnvironmentToModel(bbox, size, center) {
  // Remove existing grid and axes
  scene.children.forEach(child => {
    if (child.isGridHelper || child.isAxesHelper) {
      scene.remove(child);
    }
  });
  
  // Clean up all axis labels thoroughly
  cleanupAxisLabels();
  
  // Calculate the largest dimension of the model
  const maxDimension = Math.max(size.x, size.y, size.z);
  console.log('Max model dimension:', maxDimension);
  
  // Scale grid size based on model size with no minimum
  const gridSize = maxDimension * 3;
  const gridDivisions = 10;
  
  // Create new grid scaled to model
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
  scene.add(gridHelper);
  
  // Create new axes helper scaled to model
  const axesSize = maxDimension * 1.5;
  const axesHelper = new THREE.AxesHelper(axesSize);
  scene.add(axesHelper);
  
  // Re-add axis labels with appropriate scale
  addAxisLabels(axesSize);
  
  // Position camera to view the model appropriately
  const cameraDistance = maxDimension * 3; // Position camera at 3x the model's max dimension
  
  // Keep the same camera angle but adjust the distance
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.normalize();
  
  // Calculate new camera position - looking at the center of the model
  camera.position.copy(center).add(
    cameraDirection.clone().multiplyScalar(-cameraDistance)
  );
  
  // Adjust camera position to be at an angle
  camera.position.y += maxDimension * 1.5;
  
  // Update camera target to look at model center
  orbitControls.target.copy(center);
  
  // Adjust camera near and far planes to ensure model is visible
  camera.near = Math.max(0.01, cameraDistance * 0.001);
  camera.far = cameraDistance * 10;
  camera.updateProjectionMatrix();
  
  // Update orbit controls
  orbitControls.maxDistance = cameraDistance * 5;
  orbitControls.update();
  
  console.log('Environment adjusted to model scale', {
    gridSize,
    axesSize,
    cameraDistance,
    modelCenter: center
  });
}

// Create a visual control point with drag capabilities, properly sized
function createControlPoint(node, size = 0.5) {
  // Create a visible sphere for the control point
  const controlBall = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 16),
    new THREE.MeshPhongMaterial({ color: normalColor })
  );
  
  // Position the ball at the control point
  controlBall.position.set(0, 0, 0);
  node.add(controlBall);
  
  // Store a reference to the visual representation
  node.controlBall = controlBall;
  
  console.log('Created control point for', node.name, 'with size', size);
}

// Check if mouse is hovering over any control point
function checkControlPointsHover(clientX, clientY) {
  // Normalized device coordinates
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  
  // Update ray
  raycaster.setFromCamera(mouse, camera);
  
  // Check for intersection with all control points
  let hoveredControl = null;
  controlPoints.forEach(control => {
    if (control.controlBall) {
      const intersects = raycaster.intersectObject(control.controlBall);
      
      // Reset this control point's color if not currently being dragged
      if (control !== activeControlPoint) {
        control.controlBall.material.color.setHex(normalColor);
      }
      
      // If we have an intersection, this is our hovered control
      if (intersects.length > 0) {
        hoveredControl = control;
      }
    }
  });
  
  // Highlight only the hovered control
  if (hoveredControl && hoveredControl !== activeControlPoint) {
    hoveredControl.controlBall.material.color.setHex(hoverColor);
  }
  
  return hoveredControl;
}

// Get the target bone that should be moved when a control point is dragged
function getTargetBoneForControl(controlPoint) {
  // Try to find the farthest bone (end bone) with a related name first
  const controlName = controlPoint.name;
  const namePattern = controlName.replace('control', '')
                               .replace('ctrl', '')
                               .replace('handle', '');
  
  // If the name pattern is empty (e.g., the control is just named "control"), use a different approach
  if (!namePattern.trim()) {
    // Find the farthest bone from the root (likely an end effector)
    return findFarthestBone();
  }
  
  // Find all bones with matching name pattern
  const matchingBones = [];
  bones.forEach(bone => {
    if (bone.name.includes(namePattern)) {
      matchingBones.push(bone);
    }
  });
  
  // If we found matching bones, select the one that's farthest from root
  if (matchingBones.length > 0) {
    return findFarthestBoneInChain(matchingBones);
  }
  
  // If no bones match by name, try controlling the direct parent if it's a bone
  if (controlPoint.parent && (controlPoint.parent.isBone || controlPoint.parent.name.toLowerCase().includes('bone'))) {
    return controlPoint.parent;
  }
  
  // Default to farthest bone
  return findFarthestBone();
}

// Helper function to find the farthest bone from the root
function findFarthestBone() {
  if (bones.length === 0) return null;
  
  // Find bones with no children (end effectors)
  const endBones = [];
  
  bones.forEach(bone => {
    let isEndBone = true;
    // Check if this bone has any child bones
    for (let i = 0; i < bone.children.length; i++) {
      const child = bone.children[i];
      if (child.isBone || child.name.toLowerCase().includes('bone')) {
        isEndBone = false;
        break;
      }
    }
    
    if (isEndBone) {
      endBones.push(bone);
    }
  });
  
  // If we found end bones, return the first one
  if (endBones.length > 0) {
    console.log('Found end bone:', endBones[0].name);
    return endBones[0];
  }
  
  // If we couldn't identify end bones, just return the last bone
  console.log('No end bones found, using last bone:', bones[bones.length - 1].name);
  return bones[bones.length - 1];
}

// Helper function to find the farthest bone in a specific chain of bones
function findFarthestBoneInChain(boneChain) {
  if (boneChain.length === 0) return null;
  
  // Find bones with no bone children within this chain
  const endBones = [];
  
  for (const bone of boneChain) {
    let hasChildInChain = false;
    for (const potentialChild of boneChain) {
      if (potentialChild !== bone && potentialChild.parent === bone) {
        hasChildInChain = true;
        break;
      }
    }
    
    if (!hasChildInChain) {
      endBones.push(bone);
    }
  }
  
  // If we found end bones in the chain, return the first one
  if (endBones.length > 0) {
    console.log('Found end bone in chain:', endBones[0].name);
    return endBones[0];
  }
  
  // Otherwise return the last bone in the chain
  console.log('Using last bone in chain:', boneChain[boneChain.length - 1].name);
  return boneChain[boneChain.length - 1];
}

// Function to move a chain of bones to reach a target position
function moveBonesForTarget(targetBone, targetPosition) {
  // Find the chain of bones from root to the target bone
  const boneChain = [];
  let currentBone = targetBone;
  
  while (currentBone && bones.includes(currentBone)) {
    // Add to the start of array to maintain parent->child order
    boneChain.unshift(currentBone);
    currentBone = currentBone.parent;
    
    // Stop when we reach the armature or top level
    if (!currentBone || currentBone === armature) break;
  }
  
  // If the chain is too short, use all bones
  if (boneChain.length <= 1 && bones.length > 0) {
    // Find where the target bone is in the hierarchy
    let targetIndex = -1;
    for (let i = 0; i < bones.length; i++) {
      if (bones[i] === targetBone) {
        targetIndex = i;
        break;
      }
    }
    
    // Only include bones in the chain up to the target bone
    // This prevents bones further down the chain from rotating wildly
    if (targetIndex >= 0) {
      for (let i = 0; i <= targetIndex; i++) {
        boneChain.push(bones[i]);
      }
    } else {
      // If target bone not found, just use all bones
      for (let i = 0; i < bones.length; i++) {
        boneChain.push(bones[i]);
      }
    }
  }
  
  // Restore locked bone rotations before applying IK
  lockedBones.forEach((data) => {
    data.bone.rotation.copy(data.rotation);
  });
  
  // Apply IK to this chain to reach the target
  applyIKToChain(boneChain, targetPosition);
  
  // Restore locked bone rotations after applying IK 
  lockedBones.forEach((data) => {
    data.bone.rotation.copy(data.rotation);
  });
}

// Apply inverse kinematics to a chain of bones to reach a target
function applyIKToChain(boneChain, targetPosition) {
  if (boneChain.length === 0) return;
  
  // Get the root position
  const rootPos = new THREE.Vector3();
  boneChain[0].getWorldPosition(rootPos);
  
  // Use simple CCD (Cyclic Coordinate Descent)
  const iterations = 10;
  
  for (let iteration = 0; iteration < iterations; iteration++) {
    // Work backwards from the tip to root
    for (let i = boneChain.length - 1; i >= 0; i--) {
      const bone = boneChain[i];
      
      // Skip locked bones
      if (lockedBones.has(bone.uuid)) {
        continue;
      }
      
      // Get current end effector position
      const endEffector = new THREE.Vector3();
      boneChain[boneChain.length - 1].getWorldPosition(endEffector);
      
      // Get current bone position
      const bonePos = new THREE.Vector3();
      bone.getWorldPosition(bonePos);
      
      // Direction from bone to end effector
      const dirToEffector = new THREE.Vector3().subVectors(endEffector, bonePos).normalize();
      
      // Direction from bone to target
      const dirToTarget = new THREE.Vector3().subVectors(targetPosition, bonePos).normalize();
      
      // Calculate the angle between these directions
      let rotAngle = Math.acos(Math.min(1, Math.max(-1, dirToEffector.dot(dirToTarget))));
      
      // If the angle is very small, skip this bone
      if (rotAngle < 0.01) continue;
      
      // Limit rotation angle per iteration for smoother movement
      rotAngle = Math.min(rotAngle, 0.1);
      
      // Calculate rotation axis
      const rotAxis = new THREE.Vector3().crossVectors(dirToEffector, dirToTarget).normalize();
      
      // Skip if we can't determine rotation axis
      if (rotAxis.lengthSq() < 0.01) continue;
      
      // Convert world rotation axis to bone local space
      const boneWorldQuat = new THREE.Quaternion();
      bone.getWorldQuaternion(boneWorldQuat);
      const localRotAxis = rotAxis.clone().applyQuaternion(boneWorldQuat.clone().invert()).normalize();
      
      // Apply rotation around local axis
      bone.rotateOnAxis(localRotAxis, rotAngle);
      
      // Update matrices
      updateAllBoneMatrices();
      
      // Check if we're close enough to the target
      const newEffectorPos = new THREE.Vector3();
      boneChain[boneChain.length - 1].getWorldPosition(newEffectorPos);
      
      if (newEffectorPos.distanceTo(targetPosition) < 0.5) {
        break;
      }
    }
  }
}

// Rig reset function - respect bone locks
function resetGlbModel() {
  if (!loadedGltf) return;
  
  // Reset all bone rotations to initial state, except locked bones
  bones.forEach(bone => {
    // Skip locked bones
    if (lockedBones.has(bone.uuid)) return;
    
    // Reset rotation to identity
    bone.rotation.set(0, 0, 0);
  });
  
  // Update all matrices
  updateAllBoneMatrices();
  
  console.log('GLB model reset to initial position');
}

// Add function to reset sample rig
function resetSampleRig() {
  if (controlPoints.length > 0) return; // Only for sample rig
  
  // Reset all bone rotations
  bones.forEach(bone => {
    bone.rotation.set(0, 0, 0);
  });
  
  // Update all matrices
  updateAllBoneMatrices();
  
  console.log('Sample rig reset to initial position');
}

// Function to create sample rig details similar to GLB details
function createSampleRigDetailsContent(container) {
  // Create sample bone details
  const createSampleSection = (title, items) => {
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
        itemElem.style.position = 'relative';
        
        // Create name element
        const nameElem = document.createElement('div');
        nameElem.textContent = `Name: ${item.name}`;
        itemElem.appendChild(nameElem);
        
        if (item.position) {
          const posElem = document.createElement('div');
          posElem.style.fontSize = '10px';
          posElem.style.color = '#ccc';
          posElem.textContent = `Pos: [${item.position.join(', ')}]`;
          itemElem.appendChild(posElem);
        }
        
        if (item.type) {
          const typeElem = document.createElement('div');
          typeElem.style.fontSize = '10px';
          typeElem.style.color = '#ccc';
          typeElem.textContent = `Type: ${item.type}`;
          itemElem.appendChild(typeElem);
        }
        
        // Add lock rotation toggle for bones
        if (title === 'Bones') {
          const lockContainer = document.createElement('div');
          lockContainer.style.display = 'flex';
          lockContainer.style.alignItems = 'center';
          lockContainer.style.marginTop = '5px';
          
          const lockLabel = document.createElement('label');
          lockLabel.textContent = 'Lock Rotation:';
          lockLabel.style.fontSize = '10px';
          lockLabel.style.marginRight = '5px';
          lockLabel.style.color = '#ccc';
          
          const lockCheckbox = document.createElement('input');
          lockCheckbox.type = 'checkbox';
          lockCheckbox.style.cursor = 'pointer';
          
          // Find the actual bone object
          const boneName = item.name;
          const bone = item.ref;
          
          if (bone) {
            // Initialize checkbox state
            lockCheckbox.checked = lockedBones.has(bone.uuid);
            
            lockCheckbox.addEventListener('change', (e) => {
              if (e.target.checked) {
                // Store the bone's current rotation
                const rotationBackup = new THREE.Euler(
                  bone.rotation.x,
                  bone.rotation.y,
                  bone.rotation.z,
                  bone.rotation.order
                );
                lockedBones.set(bone.uuid, {
                  bone: bone,
                  rotation: rotationBackup
                });
                console.log(`Locked rotation for bone: ${boneName}`);
              } else {
                lockedBones.delete(bone.uuid);
                console.log(`Unlocked rotation for bone: ${boneName}`);
              }
            });
          }
          
          lockContainer.appendChild(lockLabel);
          lockContainer.appendChild(lockCheckbox);
          itemElem.appendChild(lockContainer);
        }
        
        section.appendChild(itemElem);
      });
    }
    
    return section;
  };
  
  // Generate sample rig details
  const sampleBones = [];
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const position = [0, i === 0 ? 5 : 15, 0]; // Approximate values
    sampleBones.push({
      name: `Bone ${i+1}`,
      position: position,
      ref: bone
    });
  }
  
  const sampleRig = [{
    name: 'Sample Rig',
    position: [0, 0, 0],
    type: 'sample'
  }];
  
  const sampleRoot = [{
    name: 'Root',
    position: [0, 0, 0],
    type: 'root'
  }];
  
  const sampleControls = [{
    name: 'Tip Control',
    position: [0, (bones.length * 15), 0],
    type: 'control'
  }];
  
  // Create sections
  container.appendChild(createSampleSection('Bones', sampleBones));
  container.appendChild(createSampleSection('Rigs', sampleRig));
  container.appendChild(createSampleSection('Roots', sampleRoot));
  container.appendChild(createSampleSection('Controls/Handles', sampleControls));
}

// Function to add the standard options to a container
function addStandardOptions(container, isGlbModel) {
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
    
    // Toggle visibility of secondary color option
    if (secondaryColorContainer) {
      secondaryColorContainer.style.display = e.target.checked ? 'block' : 'none';
    }
  });
  
  wireframeContainer.appendChild(wireframeLabel);
  wireframeContainer.appendChild(wireframeCheckbox);
  container.appendChild(wireframeContainer);
  
  // Primary Color picker
  const colorContainer = document.createElement('div');
  colorContainer.style.marginBottom = '15px';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Primary Color: ';
  colorLabel.style.display = 'inline-block';
  colorLabel.style.width = '60%';
  colorLabel.title = 'Main color for bones';
  
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
  
  // Secondary Color picker (for alternating segments)
  const secondaryColorContainer = document.createElement('div');
  secondaryColorContainer.style.marginBottom = '15px';
  secondaryColorContainer.style.display = !options.wireframe ? 'block' : 'none'; // Only show when not in wireframe mode
  
  const secondaryColorLabel = document.createElement('label');
  secondaryColorLabel.textContent = 'Secondary Color: ';
  secondaryColorLabel.style.display = 'inline-block';
  secondaryColorLabel.style.width = '60%';
  secondaryColorLabel.title = 'Alternating color for bone segments';
  
  const secondaryColorPicker = document.createElement('input');
  secondaryColorPicker.type = 'color';
  secondaryColorPicker.value = '#' + options.boneSideColor.toString(16).padStart(6, '0');
  secondaryColorPicker.style.cursor = 'pointer';
  secondaryColorPicker.addEventListener('input', (e) => {
    // Convert hex string to integer
    options.boneSideColor = parseInt(e.target.value.substring(1), 16);
    updateBoneMaterial();
  });
  
  secondaryColorContainer.appendChild(secondaryColorLabel);
  secondaryColorContainer.appendChild(secondaryColorPicker);
  container.appendChild(secondaryColorContainer);
  
  // Add Force Z Override checkbox for GLB models
  if (isGlbModel) {
    const zOverrideContainer = document.createElement('div');
    zOverrideContainer.style.marginBottom = '15px';
    
    const zOverrideLabel = document.createElement('label');
    zOverrideLabel.textContent = 'Force Z Override: ';
    zOverrideLabel.style.display = 'inline-block';
    zOverrideLabel.style.width = '60%';
    zOverrideLabel.title = 'Force bones/controls to render on top of the model';
    
    const zOverrideCheckbox = document.createElement('input');
    zOverrideCheckbox.type = 'checkbox';
    zOverrideCheckbox.checked = false;
    zOverrideCheckbox.style.cursor = 'pointer';
    zOverrideCheckbox.addEventListener('change', (e) => {
      applyZOverride(e.target.checked);
    });
    
    zOverrideContainer.appendChild(zOverrideLabel);
    zOverrideContainer.appendChild(zOverrideCheckbox);
    container.appendChild(zOverrideContainer);
  }
  
  // Only show bone count adjustment for sample rig, not GLB models
  if (!isGlbModel) {
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
  }
  
  // Add Reset Physics button (replacing the Restart button in the panel)
  const resetPhysicsContainer = document.createElement('div');
  resetPhysicsContainer.style.marginTop = '20px';
  resetPhysicsContainer.style.display = 'flex';
  resetPhysicsContainer.style.justifyContent = 'center';
  
  const resetPhysicsButton = document.createElement('button');
  resetPhysicsButton.textContent = 'Reset Physics';
  resetPhysicsButton.style.padding = '8px 16px';
  resetPhysicsButton.style.backgroundColor = '#4CAF50'; // Green color for Reset Physics
  resetPhysicsButton.style.color = 'white';
  resetPhysicsButton.style.border = 'none';
  resetPhysicsButton.style.borderRadius = '4px';
  resetPhysicsButton.style.cursor = 'pointer';
  resetPhysicsButton.style.transition = 'background-color 0.3s';
  resetPhysicsButton.style.fontSize = '14px';
  
  resetPhysicsButton.addEventListener('mouseover', () => {
    resetPhysicsButton.style.backgroundColor = '#3e8e41'; // Darker green on hover
  });
  
  resetPhysicsButton.addEventListener('mouseout', () => {
    resetPhysicsButton.style.backgroundColor = '#4CAF50';
  });
  
  resetPhysicsButton.addEventListener('click', () => {
    // Reset the model to its initial state
    if (isGlbModel) {
      // Reset GLB model to initial position
      resetGlbModel();
    } else {
      // Reset sample rig
      resetSampleRig();
    }
  });
  
  resetPhysicsContainer.appendChild(resetPhysicsButton);
  container.appendChild(resetPhysicsContainer);
}

// Function to apply Z override to make bones/controls render on top of model
function applyZOverride(enabled) {
  console.log(`Z Override ${enabled ? 'enabled' : 'disabled'}`);
  
  // Set renderOrder for bones and control points
  const renderOrder = enabled ? 10 : 0;
  
  // Apply to all bones
  bones.forEach(bone => {
    bone.traverse(node => {
      if (node.isMesh) {
        node.renderOrder = renderOrder;
        if (enabled) {
          // When enabled, disable depth testing to ensure controls are on top
          node.material.depthTest = !enabled;
        } else {
          // Re-enable depth testing when turning off
          node.material.depthTest = true;
        }
        node.material.needsUpdate = true;
      }
    });
  });
  
  // Apply to all control points
  controlPoints.forEach(control => {
    if (control.controlBall) {
      control.controlBall.renderOrder = renderOrder;
      if (enabled) {
        control.controlBall.material.depthTest = !enabled;
      } else {
        control.controlBall.material.depthTest = true;
      }
      control.controlBall.material.needsUpdate = true;
    }
  });
  
  // For sample rig, apply to tip ball
  if (tipBall) {
    tipBall.renderOrder = renderOrder;
    if (enabled) {
      tipBall.material.depthTest = !enabled;
    } else {
      tipBall.material.depthTest = true;
    }
    tipBall.material.needsUpdate = true;
  }
} 