import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

init();
animate();

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
  panel.style.padding = '15px';
  panel.style.backgroundColor = 'rgba(0,0,0,0.7)';
  panel.style.color = 'white';
  panel.style.borderRadius = '5px';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.zIndex = '1000';
  
  // Panel title
  const title = document.createElement('h3');
  title.textContent = 'Rig Options';
  title.style.margin = '0 0 15px 0';
  title.style.textAlign = 'center';
  panel.appendChild(title);
  
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
  panel.appendChild(wireframeContainer);
  
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
  panel.appendChild(colorContainer);
  
  // Bone count adjustment
  const boneCountContainer = document.createElement('div');
  boneCountContainer.style.marginBottom = '15px';
  
  const boneCountLabel = document.createElement('label');
  boneCountLabel.textContent = 'Bone Count: ';
  boneCountLabel.style.display = 'inline-block';
  boneCountLabel.style.width = '60%';
  
  const boneCountValue = document.createElement('span');
  boneCountValue.textContent = options.segmentCount;
  boneCountValue.style.marginLeft = '10px';
  boneCountValue.style.marginRight = '10px';
  boneCountValue.style.display = 'inline-block';
  boneCountValue.style.width = '20px';
  boneCountValue.style.textAlign = 'center';
  
  const decreaseButton = document.createElement('button');
  decreaseButton.textContent = '-';
  decreaseButton.style.width = '30px';
  decreaseButton.style.cursor = 'pointer';
  decreaseButton.addEventListener('click', () => {
    if (options.segmentCount > 1) {
      options.segmentCount--;
      boneCountValue.textContent = options.segmentCount;
      rebuildBoneChain();
    }
  });
  
  const increaseButton = document.createElement('button');
  increaseButton.textContent = '+';
  increaseButton.style.width = '30px';
  increaseButton.style.cursor = 'pointer';
  increaseButton.addEventListener('click', () => {
    if (options.segmentCount < 8) {
      options.segmentCount++;
      boneCountValue.textContent = options.segmentCount;
      rebuildBoneChain();
    }
  });
  
  boneCountContainer.appendChild(boneCountLabel);
  boneCountContainer.appendChild(decreaseButton);
  boneCountContainer.appendChild(boneCountValue);
  boneCountContainer.appendChild(increaseButton);
  panel.appendChild(boneCountContainer);
  
  // Apply button for bone count changes
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.justifyContent = 'center';
  buttonsContainer.style.marginTop = '10px';
  
  document.body.appendChild(panel);
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