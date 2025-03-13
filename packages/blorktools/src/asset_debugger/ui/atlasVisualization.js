// Atlas Visualization Module
// Handles the visualization of UV coordinates on texture atlas

import * as THREE from 'three';
import { getUvCoordinates } from '../core/analyzer.js';
import { createCollapsiblePanel } from '../utils/helpers.js';

let atlasVisualization = null;

// Create atlas visualization panel
export function createAtlasVisualization(state) {
  // If atlas visualization already exists, toggle visibility
  if (atlasVisualization) {
    const isVisible = atlasVisualization.container.style.display !== 'none';
    atlasVisualization.container.style.display = isVisible ? 'none' : 'block';
    
    // Update visualization if showing
    if (!isVisible) {
      updateVisualization(state);
    }
    
    return;
  }
  
  // Create a collapsible panel
  const panel = createCollapsiblePanel({
    id: 'atlas-visualization',
    title: 'Texture Atlas Visualization',
    initialPosition: { x: window.innerWidth - 520, y: 20 },
    width: 500,
    startCollapsed: false,
    magneticSnap: true
  });
  
  // Create canvas for drawing UV coordinates
  const canvasContainer = document.createElement('div');
  canvasContainer.style.width = '100%';
  canvasContainer.style.height = '500px';
  canvasContainer.style.position = 'relative';
  canvasContainer.style.overflow = 'hidden';
  canvasContainer.style.backgroundColor = '#f5f5f5';
  canvasContainer.style.border = '1px solid #ddd';
  canvasContainer.style.borderRadius = '4px';
  canvasContainer.style.marginTop = '10px';
  panel.content.appendChild(canvasContainer);
  
  // Create settings section
  const settingsSection = document.createElement('div');
  settingsSection.style.marginTop = '10px';
  
  // Mesh selector
  const meshSelectorSection = document.createElement('div');
  meshSelectorSection.style.marginBottom = '10px';
  
  const meshSelectorLabel = document.createElement('div');
  meshSelectorLabel.textContent = 'Select Mesh:';
  meshSelectorLabel.style.marginBottom = '5px';
  meshSelectorSection.appendChild(meshSelectorLabel);
  
  const meshSelector = document.createElement('select');
  meshSelector.id = 'mesh-selector';
  meshSelector.style.width = '100%';
  meshSelector.style.padding = '5px';
  meshSelector.style.marginBottom = '10px';
  
  // Update mesh options based on loaded model
  updateMeshSelector(meshSelector, state);
  
  // Listen for changes to update visualization
  meshSelector.addEventListener('change', () => {
    updateVisualization(state);
  });
  
  meshSelectorSection.appendChild(meshSelector);
  settingsSection.appendChild(meshSelectorSection);
  
  // Display options
  const displayOptions = document.createElement('div');
  displayOptions.style.display = 'flex';
  displayOptions.style.gap = '10px';
  displayOptions.style.flexWrap = 'wrap';
  
  // Show points checkbox
  const showPointsLabel = document.createElement('label');
  showPointsLabel.style.display = 'flex';
  showPointsLabel.style.alignItems = 'center';
  showPointsLabel.style.marginRight = '15px';
  
  const showPointsCheckbox = document.createElement('input');
  showPointsCheckbox.type = 'checkbox';
  showPointsCheckbox.id = 'show-points';
  showPointsCheckbox.checked = true;
  showPointsCheckbox.style.marginRight = '5px';
  
  showPointsLabel.appendChild(showPointsCheckbox);
  showPointsLabel.appendChild(document.createTextNode('Show Points'));
  
  // Show lines checkbox
  const showLinesLabel = document.createElement('label');
  showLinesLabel.style.display = 'flex';
  showLinesLabel.style.alignItems = 'center';
  showLinesLabel.style.marginRight = '15px';
  
  const showLinesCheckbox = document.createElement('input');
  showLinesCheckbox.type = 'checkbox';
  showLinesCheckbox.id = 'show-lines';
  showLinesCheckbox.checked = true;
  showLinesCheckbox.style.marginRight = '5px';
  
  showLinesLabel.appendChild(showLinesCheckbox);
  showLinesLabel.appendChild(document.createTextNode('Show Lines'));
  
  // Show fills checkbox
  const showFillsLabel = document.createElement('label');
  showFillsLabel.style.display = 'flex';
  showFillsLabel.style.alignItems = 'center';
  
  const showFillsCheckbox = document.createElement('input');
  showFillsCheckbox.type = 'checkbox';
  showFillsCheckbox.id = 'show-fills';
  showFillsCheckbox.checked = false;
  showFillsCheckbox.style.marginRight = '5px';
  
  showFillsLabel.appendChild(showFillsCheckbox);
  showFillsLabel.appendChild(document.createTextNode('Show Fills'));
  
  displayOptions.appendChild(showPointsLabel);
  displayOptions.appendChild(showLinesLabel);
  displayOptions.appendChild(showFillsLabel);
  settingsSection.appendChild(displayOptions);
  
  // Add change listeners for all display options
  [showPointsCheckbox, showLinesCheckbox, showFillsCheckbox].forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateVisualization(state);
    });
  });
  
  panel.content.appendChild(settingsSection);
  
  // Store the panel and create the visualization scene
  atlasVisualization = {
    container: panel.container,
    content: panel.content,
    canvasContainer: canvasContainer,
    scene: null,
    camera: null,
    renderer: null,
    meshSelector: meshSelector
  };
  
  // Add to body
  document.body.appendChild(panel.container);
  
  // Initialize Three.js for atlas visualization
  initAtlasVisualizationScene(canvasContainer);
  
  // Render the initial visualization
  updateVisualization(state);
}

// Initialize Three.js for atlas visualization
function initAtlasVisualizationScene(container) {
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  
  // Create camera (orthographic for 2D display)
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 100);
  camera.position.z = 10;
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (container.clientWidth > 0 && container.clientHeight > 0) {
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
  });
  
  // Store in the visualization object
  atlasVisualization.scene = scene;
  atlasVisualization.camera = camera;
  atlasVisualization.renderer = renderer;
  
  // Initial render
  renderer.render(scene, camera);
}

// Update mesh selector with available meshes
function updateMeshSelector(selector, state) {
  // Clear current options
  selector.innerHTML = '';
  
  if (!state.modelInfo || !state.modelInfo.meshes) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No meshes available';
    selector.appendChild(option);
    return;
  }
  
  // Add options for each mesh
  state.modelInfo.meshes.forEach((mesh, index) => {
    if (mesh.geometry && mesh.geometry.getAttribute('uv')) {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = mesh.name || `Mesh ${index + 1}`;
      selector.appendChild(option);
    }
  });
  
  // Add option for all meshes
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Meshes';
  selector.appendChild(allOption);
  
  // If no mesh with UV was found
  if (selector.options.length === 1 && selector.options[0].value === 'all') {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No meshes with UV coordinates found';
    selector.innerHTML = '';
    selector.appendChild(option);
  }
}

// Update visualization based on current state and settings
function updateVisualization(state) {
  if (!atlasVisualization || !atlasVisualization.scene) return;
  
  const { scene, camera, renderer, meshSelector } = atlasVisualization;
  
  // Clear previous visualization
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
  
  // Get settings
  const showPoints = document.getElementById('show-points')?.checked ?? true;
  const showLines = document.getElementById('show-lines')?.checked ?? true;
  const showFills = document.getElementById('show-fills')?.checked ?? false;
  
  // Get selected mesh
  const selectedMeshIndex = meshSelector.value;
  
  if (!state.modelInfo || !state.modelInfo.meshes || selectedMeshIndex === '') {
    // Render empty scene
    renderer.render(scene, camera);
    return;
  }
  
  // Add texture background if available
  if (state.textureObject) {
    const textureBackground = createTextureBackground(state.textureObject);
    scene.add(textureBackground);
  }
  
  // Process the selected mesh(es)
  if (selectedMeshIndex === 'all') {
    // Visualize all meshes
    state.modelInfo.meshes.forEach((mesh, index) => {
      visualizeMeshUV(mesh, scene, showPoints, showLines, showFills, getRandomColor(index));
    });
  } else {
    // Visualize just the selected mesh
    const meshIndex = parseInt(selectedMeshIndex);
    const selectedMesh = state.modelInfo.meshes[meshIndex];
    
    if (selectedMesh) {
      visualizeMeshUV(selectedMesh, scene, showPoints, showLines, showFills, 0x00ff00);
    }
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

// Create a background plane with the texture
function createTextureBackground(texture) {
  // Create a plane geometry that fills the [0,1] UV space
  const geometry = new THREE.PlaneGeometry(1, 1);
  
  // Position the plane at z = -1 (behind other elements)
  geometry.translate(0.5, 0.5, -1);
  
  // Create material with the texture
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  // Create and return the mesh
  return new THREE.Mesh(geometry, material);
}

// Visualize UV coordinates of a mesh
function visualizeMeshUV(mesh, scene, showPoints, showLines, showFills, color) {
  if (!mesh || !mesh.geometry || !mesh.geometry.getAttribute('uv')) return;
  
  const uvCoords = getUvCoordinates(mesh.geometry);
  if (!uvCoords || uvCoords.length === 0) return;
  
  // Get faces based on the index or raw position attribute
  const geometry = mesh.geometry;
  const faces = [];
  
  if (geometry.index) {
    // Indexed geometry - get faces from index
    const index = geometry.index.array;
    for (let i = 0; i < index.length; i += 3) {
      faces.push([
        index[i],
        index[i + 1],
        index[i + 2]
      ]);
    }
  } else {
    // Non-indexed geometry - assume one triangle per three vertices
    for (let i = 0; i < geometry.getAttribute('position').count; i += 3) {
      faces.push([i, i + 1, i + 2]);
    }
  }
  
  // Draw points
  if (showPoints) {
    const pointsGeometry = new THREE.BufferGeometry();
    const positions = [];
    
    uvCoords.forEach(uv => {
      positions.push(uv.x, uv.y, 0);
    });
    
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const pointsMaterial = new THREE.PointsMaterial({
      color: color,
      size: 0.01,
      sizeAttenuation: false
    });
    
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);
  }
  
  // Draw lines (triangle edges)
  if (showLines) {
    const linesGeometry = new THREE.BufferGeometry();
    const positions = [];
    
    faces.forEach(face => {
      // For each face, draw its three edges
      for (let i = 0; i < 3; i++) {
        const uv1 = uvCoords[face[i]];
        const uv2 = uvCoords[face[(i + 1) % 3]];
        
        positions.push(uv1.x, uv1.y, 0);
        positions.push(uv2.x, uv2.y, 0);
      }
    });
    
    linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const lineMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5
    });
    
    const lines = new THREE.LineSegments(linesGeometry, lineMaterial);
    scene.add(lines);
  }
  
  // Draw filled triangles
  if (showFills) {
    const fillGeometry = new THREE.BufferGeometry();
    const positions = [];
    
    faces.forEach(face => {
      // For each face, add a triangle
      for (let i = 0; i < 3; i++) {
        const uv = uvCoords[face[i]];
        positions.push(uv.x, uv.y, 0);
      }
    });
    
    fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    
    const fills = new THREE.Mesh(fillGeometry, fillMaterial);
    scene.add(fills);
  }
}

// Generate a random color based on index
function getRandomColor(index) {
  // Generate distinct colors based on hue
  const hue = (index * 137.5) % 360;
  return new THREE.Color().setHSL(hue / 360, 0.8, 0.6);
} 