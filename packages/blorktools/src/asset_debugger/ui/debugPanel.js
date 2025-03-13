// Debug Panel Module
// Handles the asset debug info panel and interaction

import { switchUvChannel } from '../core/analyzer.js';
import { toggleTextureEditor } from './textureEditor.js';
import { createAtlasVisualization } from './atlasVisualization.js';

// Exported functions for external use
export let updateModelInfo = null;
export let updateTextureInfo = null;

// Setup debug panel
export function setupDebugPanel(state) {
  const panel = createDebugPanel(state);
}

// Start debugging (called from dragdrop.js)
export function startDebugging(state) {
  console.log('Starting debugging with files:', state.modelFile, state.textureFile);
  
  // Hide drag-drop zone
  const dragDropZone = document.getElementById('drop-container');
  if (dragDropZone) {
    dragDropZone.style.display = 'none';
  }
  
  // Show loading screen
  const loadingScreen = document.getElementById('loading');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
  }
  
  // Show renderer canvas
  if (state.renderer) {
    state.renderer.domElement.style.display = 'block';
  }
  
  // Set debug mode
  state.isDebugMode = true;
  
  // If debug panel exists already, show it
  const debugPanel = document.getElementById('debug-panel');
  if (debugPanel) {
    debugPanel.style.display = 'block';
  }
}

// Create debug panel
export function createDebugPanel(state) {
  // Create the debug panel - simple fixed panel style
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.position = 'fixed';
  panel.style.top = '20px';
  panel.style.right = '20px';
  panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  panel.style.padding = '15px';
  panel.style.borderRadius = '8px';
  panel.style.width = '300px';
  panel.style.maxHeight = 'calc(100vh - 40px)';
  panel.style.overflowY = 'auto';
  panel.style.zIndex = '100';
  panel.style.display = 'none';
  panel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
  
  // Panel title
  const title = document.createElement('h3');
  title.textContent = 'Asset Debug Info';
  title.style.marginTop = '0';
  title.style.color = '#3498db';
  panel.appendChild(title);
  
  // Model info section
  const modelSection = document.createElement('div');
  modelSection.className = 'debug-section';
  modelSection.style.marginBottom = '15px';
  
  const modelLabel = document.createElement('div');
  modelLabel.className = 'debug-label';
  modelLabel.textContent = 'Model Info:';
  modelLabel.style.fontWeight = 'bold';
  modelLabel.style.marginBottom = '5px';
  modelLabel.style.color = '#95a5a6';
  
  const modelInfoDiv = document.createElement('div');
  modelInfoDiv.id = 'model-info';
  modelInfoDiv.className = 'debug-value';
  modelInfoDiv.textContent = 'No model loaded';
  modelInfoDiv.style.fontFamily = 'monospace';
  modelInfoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modelInfoDiv.style.padding = '5px';
  modelInfoDiv.style.borderRadius = '3px';
  modelInfoDiv.style.wordBreak = 'break-word';
  
  modelSection.appendChild(modelLabel);
  modelSection.appendChild(modelInfoDiv);
  panel.appendChild(modelSection);
  
  // Texture info section
  const textureSection = document.createElement('div');
  textureSection.className = 'debug-section';
  textureSection.style.marginBottom = '15px';
  
  const textureLabel = document.createElement('div');
  textureLabel.className = 'debug-label';
  textureLabel.textContent = 'Texture Info:';
  textureLabel.style.fontWeight = 'bold';
  textureLabel.style.marginBottom = '5px';
  textureLabel.style.color = '#95a5a6';
  
  const textureInfoDiv = document.createElement('div');
  textureInfoDiv.id = 'texture-info';
  textureInfoDiv.className = 'debug-value';
  textureInfoDiv.textContent = 'No texture loaded';
  textureInfoDiv.style.fontFamily = 'monospace';
  textureInfoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  textureInfoDiv.style.padding = '5px';
  textureInfoDiv.style.borderRadius = '3px';
  textureInfoDiv.style.wordBreak = 'break-word';
  
  textureSection.appendChild(textureLabel);
  textureSection.appendChild(textureInfoDiv);
  panel.appendChild(textureSection);
  
  // Mesh visibility section
  const meshSection = document.createElement('div');
  meshSection.className = 'debug-section';
  meshSection.style.marginBottom = '15px';
  
  const meshLabel = document.createElement('div');
  meshLabel.className = 'debug-label';
  meshLabel.textContent = 'Mesh Visibility:';
  meshLabel.style.fontWeight = 'bold';
  meshLabel.style.marginBottom = '5px';
  meshLabel.style.color = '#95a5a6';
  
  const meshToggles = document.createElement('div');
  meshToggles.id = 'mesh-toggles';
  
  const meshHelp = document.createElement('div');
  meshHelp.style.fontSize = '0.85em';
  meshHelp.style.color = '#999';
  meshHelp.style.marginTop = '5px';
  meshHelp.textContent = 'Toggle visibility of individual meshes or entire groups.';
  
  meshSection.appendChild(meshLabel);
  meshSection.appendChild(meshToggles);
  meshSection.appendChild(meshHelp);
  panel.appendChild(meshSection);
  
  // UV Channel section
  const uvSection = document.createElement('div');
  uvSection.className = 'debug-section';
  uvSection.id = 'uv-info-section';
  
  const uvLabel = document.createElement('div');
  uvLabel.className = 'debug-label';
  uvLabel.textContent = 'UV Channel:';
  uvLabel.style.fontWeight = 'bold';
  uvLabel.style.marginBottom = '5px';
  uvLabel.style.color = '#95a5a6';
  
  // Create select dropdown for UV channels
  const uvSelectContainer = document.createElement('div');
  uvSelectContainer.style.marginBottom = '10px';
  
  const uvSelect = document.createElement('select');
  uvSelect.id = 'uv-channel-select';
  uvSelect.style.width = '100%';
  uvSelect.style.backgroundColor = '#333';
  uvSelect.style.color = 'white';
  uvSelect.style.padding = '8px'; // Slightly larger padding
  uvSelect.style.border = '1px solid #555';
  uvSelect.style.borderRadius = '3px';
  uvSelect.style.marginBottom = '10px';
  uvSelect.style.cursor = 'pointer';
  uvSelect.style.fontSize = '14px';
  
  // Default UV option
  const defaultOption = document.createElement('option');
  defaultOption.value = "uv";
  defaultOption.textContent = "UV Channel (Default)";
  uvSelect.appendChild(defaultOption);
  
  // UV2 option (initially disabled)
  const uv2Option = document.createElement('option');
  uv2Option.value = "uv2";
  uv2Option.textContent = "UV2 Channel";
  uv2Option.disabled = true;
  uvSelect.appendChild(uv2Option);
  
  // UV3 option (initially disabled)
  const uv3Option = document.createElement('option');
  uv3Option.value = "uv3";
  uv3Option.textContent = "UV3 Channel";
  uv3Option.disabled = true;
  uvSelect.appendChild(uv3Option);
  
  uvSelect.addEventListener('change', (e) => {
    const channel = e.target.value;
    switchUvChannel(state, channel === "uv" ? 0 : (channel === "uv2" ? 1 : 2));
  });
  
  uvSelectContainer.appendChild(uvSelect);
  uvSection.appendChild(uvLabel);
  uvSection.appendChild(uvSelectContainer);
  
  // UV info container
  const uvInfoContainer = document.createElement('div');
  uvInfoContainer.id = 'uv-info-container';
  uvInfoContainer.className = 'debug-value';
  uvInfoContainer.style.fontFamily = 'monospace';
  uvInfoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  uvInfoContainer.style.padding = '5px';
  uvInfoContainer.style.borderRadius = '3px';
  uvInfoContainer.style.marginBottom = '10px';
  uvInfoContainer.textContent = 'No UV data available';
  
  uvSection.appendChild(uvInfoContainer);
  panel.appendChild(uvSection);
  
  // Atlas visualization button (for the minimap)
  const atlasSection = document.createElement('div');
  atlasSection.className = 'debug-section';
  
  const atlasButton = document.createElement('button');
  atlasButton.className = 'debug-button';
  atlasButton.textContent = 'Show Texture Atlas';
  atlasButton.style.width = '100%';
  atlasButton.style.padding = '8px';
  atlasButton.style.marginBottom = '10px';
  atlasButton.style.backgroundColor = '#e67e22';
  
  atlasButton.addEventListener('click', () => {
    createAtlasVisualization(state);
  });
  
  atlasSection.appendChild(atlasButton);
  panel.appendChild(atlasSection);
  
  // Texture Editor Button
  const editorSection = document.createElement('div');
  editorSection.className = 'debug-section';
  
  const editorButton = document.createElement('button');
  editorButton.className = 'debug-button';
  editorButton.textContent = 'Open Texture Editor';
  editorButton.style.width = '100%';
  editorButton.style.padding = '8px';
  editorButton.style.marginTop = '10px';
  editorButton.style.backgroundColor = '#9b59b6';
  
  editorButton.addEventListener('click', () => {
    toggleTextureEditor(state);
  });
  
  editorSection.appendChild(editorButton);
  panel.appendChild(editorSection);
  
  // Add to document
  document.body.appendChild(panel);
  
  // Helper functions for updating panel content
  function updateModelInfoImpl(info) {
    const modelInfo = document.getElementById('model-info');
    if (!modelInfo) return;
    
    if (info) {
      let content = '';
      content += `Name: ${info.name || 'Unknown'}<br>`;
      content += `Size: ${formatBytes(info.size || 0)}<br>`;
      
      // Add UV map availability with more prominence
      if (info.uvSets && info.uvSets.length > 0) {
        content += `<span style="color: #3498db; font-weight: bold;">UV Maps: ${info.uvSets.join(', ')}</span><br>`;
        
        // Ensure UV channel select options are updated based on available sets
        updateUvSelectOptions(info.uvSets);
        
        console.log('UV Sets detected:', info.uvSets);
      } else {
        content += `<span style="color: #e74c3c;">No UV maps detected</span><br>`;
        
        // Update UI to reflect no UV sets
        updateUvSelectOptions([]);
      }
      
      // If we have mesh info, create mesh toggles
      if (info.meshes && info.meshes.length > 0) {
        content += `<br>Meshes: ${info.meshes.length}<br>`;
        createMeshToggles(info.meshes);
      }
      
      modelInfo.innerHTML = content;
    } else {
      modelInfo.textContent = 'No model loaded';
    }
  }
  
  // Create toggle buttons for meshes
  function createMeshToggles(meshes) {
    const meshTogglesContainer = document.getElementById('mesh-toggles');
    if (!meshTogglesContainer) return;
    
    meshTogglesContainer.innerHTML = '';
    
    // Group meshes by name prefix (up to first underscore)
    const meshGroups = {};
    
    meshes.forEach(mesh => {
      // Get prefix from mesh name (up to first underscore)
      let groupName = 'unclassified';
      
      if (mesh.name) {
        const underscoreIndex = mesh.name.indexOf('_');
        if (underscoreIndex > 0) {
          // Use prefix if underscore found
          groupName = mesh.name.substring(0, underscoreIndex);
        } else {
          // If no underscore, use the mesh name as is
          groupName = mesh.name;
        }
      } else if (mesh.parent && mesh.parent.name) {
        // Fallback to parent name if mesh has no name
        groupName = mesh.parent.name;
      }
      
      // Initialize group array if needed
      if (!meshGroups[groupName]) {
        meshGroups[groupName] = [];
      }
      
      // Add mesh to its group
      meshGroups[groupName].push(mesh);
    });
    
    // Create toggle for each mesh group
    for (const groupName in meshGroups) {
      const group = meshGroups[groupName];
      
      const groupDiv = document.createElement('div');
      groupDiv.style.marginBottom = '15px';
      groupDiv.style.padding = '8px';
      groupDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      groupDiv.style.borderRadius = '5px';
      
      // Header and toggle row
      const groupHeader = document.createElement('div');
      groupHeader.style.display = 'flex';
      groupHeader.style.justifyContent = 'space-between';
      groupHeader.style.alignItems = 'center';
      groupHeader.style.marginBottom = '8px';
      groupHeader.style.cursor = 'pointer';
      
      const groupLabel = document.createElement('div');
      groupLabel.textContent = `Group: ${groupName} (${group.length} mesh${group.length > 1 ? 'es' : ''})`;
      groupLabel.style.fontWeight = 'bold';
      groupLabel.style.color = '#3498db';
      groupHeader.appendChild(groupLabel);
      
      // Toggle button for the entire group - moved here from contentContainer
      const groupToggle = document.createElement('button');
      groupToggle.textContent = 'Hide';
      groupToggle.className = 'debug-button';
      groupToggle.style.marginLeft = '10px';
      groupToggle.style.marginRight = '10px';
      groupToggle.style.padding = '2px 8px';
      groupToggle.style.minWidth = '45px';
      groupToggle.style.backgroundColor = '#3498db'; // Start with blue (visible)
      groupToggle.style.color = 'white';
      groupToggle.style.fontWeight = 'bold';
      
      groupToggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the collapse/expand
        const someVisible = group.some(mesh => mesh.visible);
        
        // Toggle visibility state based on current state
        group.forEach(mesh => {
          mesh.visible = !someVisible;
        });
        
        // Update button text and color
        groupToggle.textContent = someVisible ? 'Show' : 'Hide';
        groupToggle.style.backgroundColor = someVisible ? '#95a5a6' : '#3498db';
        
        // Update button colors for all meshes in the group if the container is expanded
        contentContainer.querySelectorAll('.mesh-toggle').forEach((button) => {
          button.style.backgroundColor = !someVisible ? '#3498db' : '#95a5a6';
        });
      });
      groupHeader.appendChild(groupToggle);
      
      // Add collapse/expand icon
      const collapseIcon = document.createElement('span');
      collapseIcon.textContent = '▼';
      collapseIcon.style.transition = 'transform 0.3s';
      groupHeader.appendChild(collapseIcon);
      
      groupDiv.appendChild(groupHeader);
      
      // Container for toggles and mesh list
      const contentContainer = document.createElement('div');
      contentContainer.style.display = 'none'; // Collapsed by default
      
      // Show all meshes in group
      const meshList = document.createElement('div');
      meshList.style.marginLeft = '10px';
      meshList.style.marginTop = '5px';
      
      group.forEach(mesh => {
        const meshDiv = document.createElement('div');
        meshDiv.style.margin = '5px 0';
        
        const toggle = document.createElement('button');
        toggle.textContent = mesh.name || 'Unnamed Mesh';
        toggle.className = 'debug-button mesh-toggle';
        toggle.style.backgroundColor = mesh.visible ? '#3498db' : '#95a5a6';
        
        toggle.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering the collapse/expand
          mesh.visible = !mesh.visible;
          toggle.style.backgroundColor = mesh.visible ? '#3498db' : '#95a5a6';
        });
        
        meshDiv.appendChild(toggle);
        meshList.appendChild(meshDiv);
      });
      
      contentContainer.appendChild(meshList);
      groupDiv.appendChild(contentContainer);
      
      // Add click handler to header for toggling collapse/expand
      groupHeader.addEventListener('click', () => {
        const isCollapsed = contentContainer.style.display === 'none';
        contentContainer.style.display = isCollapsed ? 'block' : 'none';
        collapseIcon.textContent = isCollapsed ? '▲' : '▼';
        collapseIcon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(0deg)';
      });
      
      meshTogglesContainer.appendChild(groupDiv);
    }
  }
  
  // Update UV channel select dropdown based on available UV sets
  function updateUvSelectOptions(uvSets) {
    const uvSelect = document.getElementById('uv-channel-select');
    if (!uvSelect) return;
    
    console.log('Updating UV Select Options with sets:', uvSets);
    
    // Enable/disable options based on available UV sets
    const options = uvSelect.options;
    
    // Always enable UV (default)
    options[0].disabled = false;
    
    // UV2
    const hasUv2 = uvSets.includes('uv2');
    options[1].disabled = !hasUv2;
    options[1].textContent = hasUv2 ? "UV2 Channel (Available)" : "UV2 Channel (Not Available)";
    
    // UV3
    const hasUv3 = uvSets.includes('uv3');
    options[2].disabled = !hasUv3;
    options[2].textContent = hasUv3 ? "UV3 Channel (Available)" : "UV3 Channel (Not Available)";
    
    // Update the UV info container
    updateUvInfo(uvSets);
  }
  
  // Update UV info display
  function updateUvInfo(uvSets) {
    const uvInfoContainer = document.getElementById('uv-info-container');
    if (!uvInfoContainer) return;
    
    if (!uvSets || uvSets.length === 0) {
      uvInfoContainer.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">No UV data available</span>';
      return;
    }
    
    let uvInfo = '<span style="color: #2ecc71; font-weight: bold;">Available UV Channels:</span><br>';
    uvSets.forEach(set => {
      uvInfo += `- <span style="color: #f1c40f;">${set}</span><br>`;
    });
    
    // Add a tip about using the dropdown
    uvInfo += '<br><span style="color: #95a5a6; font-style: italic;">Select a channel from the dropdown above to view it.</span>';
    
    uvInfoContainer.innerHTML = uvInfo;
  }
  
  function updateTextureInfoImpl(info) {
    const textureInfo = document.getElementById('texture-info');
    if (!textureInfo) return;
    
    // If passed a state object instead of direct texture info
    if (info && info.textureFile) {
      const file = info.textureFile;
      let content = '';
      content += `Name: ${file.name || 'Unknown'}<br>`;
      content += `Size: ${formatBytes(file.size || 0)}<br>`;
      
      if (info.textureObject && info.textureObject.image) {
        content += `Dimensions: ${info.textureObject.image.width} x ${info.textureObject.image.height}<br>`;
      }
      
      textureInfo.innerHTML = content;
    } else if (info) {
      // Direct texture info object
      let content = '';
      content += `Name: ${info.name || 'Unknown'}<br>`;
      content += `Size: ${formatBytes(info.size || 0)}<br>`;
      
      if (info.dimensions) {
        content += `Dimensions: ${info.dimensions.width} x ${info.dimensions.height}<br>`;
      }
      
      textureInfo.innerHTML = content;
    } else {
      textureInfo.textContent = 'No texture loaded';
    }
  }
  
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  // Set the exported functions
  updateModelInfo = updateModelInfoImpl;
  updateTextureInfo = updateTextureInfoImpl;
  
  // Expose update methods to the state for use elsewhere
  state.updateModelInfo = updateModelInfoImpl;
  state.updateTextureInfo = updateTextureInfoImpl;
  
  return panel;
}

// Automatically show atlas visualization when both model and texture are loaded
export function autoShowAtlasVisualization(state) {
  if (!state.modelObject || !state.textureObject) {
    console.log('Cannot show atlas visualization: Model or texture not loaded');
    return;
  }
  
  console.log('Auto-showing atlas visualization');
  
  // First, analyze the model to find available UV channels
  const availableUvSets = [];
  const uvSetNames = [];
  
  // Create a list of potential UV attributes to check for in the model
  const potentialUvAttributes = [];
  for (let i = 0; i < 8; i++) {
    potentialUvAttributes.push(i === 0 ? 'uv' : `uv${i+1}`);
  }
  
  // Track which channels exist in the model
  const detectedUvChannels = new Map();
  
  // First pass: collect all meshes and detect UV channels
  state.modelObject.traverse((child) => {
    if (child.isMesh && child.geometry) {
      // Check which UV channels this mesh has
      potentialUvAttributes.forEach(attr => {
        if (child.geometry.attributes[attr]) {
          if (!detectedUvChannels.has(attr)) {
            detectedUvChannels.set(attr, []);
          }
          detectedUvChannels.get(attr).push(child);
        }
      });
    }
  });
  
  // Convert to arrays for easier use
  detectedUvChannels.forEach((meshes, channel) => {
    availableUvSets.push(channel);
    uvSetNames.push(`${channel} - ${meshes.length} meshes`);
  });
  
  console.log('Available UV sets:', availableUvSets);
  
  // Try to find a screen mesh with UV2 first (common for screens)
  let foundScreenUv = false;
  
  state.modelObject.traverse((child) => {
    if (child.isMesh && 
        (child.name.toLowerCase().includes('screen') || 
         child.name.toLowerCase().includes('display') || 
         child.name.toLowerCase().includes('monitor'))) {
      
      // Check which UV channels this screen mesh has
      potentialUvAttributes.forEach(attr => {
        if (child.geometry.attributes[attr] && !foundScreenUv) {
          console.log(`Found screen mesh with ${attr}: ${child.name}`);
          // Switch to this UV channel
          switchUvChannel(state, attr);
          foundScreenUv = true;
        }
      });
    }
  });
  
  // If no screen-specific UV was found, just use the first available UV set
  if (!foundScreenUv && availableUvSets.length > 0) {
    console.log(`No screen-specific UV found, using ${availableUvSets[0]}`);
    switchUvChannel(state, availableUvSets[0]);
  }
  
  // Create the atlas visualization
  createAtlasVisualization(state);
}