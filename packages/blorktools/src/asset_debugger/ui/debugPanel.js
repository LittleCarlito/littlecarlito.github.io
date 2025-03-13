// Debug Panel Module
// Handles the asset debug info panel and interaction

import { switchUvChannel } from '../core/analyzer.js';
import { createCollapsiblePanel } from '../utils/helpers.js';
import { toggleTextureEditor } from './textureEditor.js';
import { createAtlasVisualization } from './atlasVisualization.js';

// Exported functions for external use
export let updateModelInfo = null;
export let updateTextureInfo = null;

// Setup debug panel
export function setupDebugPanel(state) {
  createDebugPanel(state);
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
  // Create a collapsible panel for the debug information
  const panelObj = createCollapsiblePanel({
    id: 'debug-panel',
    title: 'Asset Debug Info',
    initialPosition: { top: '20px', right: '20px' },
    width: '320px',
    startCollapsed: false,
    magneticSnap: true
  });
  
  // Initially hide the panel - access the container element
  panelObj.container.style.display = 'none';
  
  // Create a button to open the texture editor
  const textureEditorButton = document.createElement('button');
  textureEditorButton.textContent = 'Open Texture Editor';
  textureEditorButton.style.margin = '10px 0';
  textureEditorButton.style.padding = '8px 12px';
  textureEditorButton.style.backgroundColor = '#2196F3';
  textureEditorButton.style.color = 'white';
  textureEditorButton.style.border = 'none';
  textureEditorButton.style.borderRadius = '4px';
  textureEditorButton.style.cursor = 'pointer';
  textureEditorButton.style.width = '100%';
  
  textureEditorButton.addEventListener('click', () => {
    toggleTextureEditor(state);
  });
  
  // Model section
  const modelSection = document.createElement('div');
  modelSection.style.marginBottom = '15px';
  
  const modelTitle = document.createElement('h3');
  modelTitle.textContent = 'Model Information';
  modelTitle.style.margin = '5px 0';
  modelTitle.style.fontSize = '16px';
  modelTitle.style.color = '#2196F3';
  
  const modelInfoDiv = document.createElement('div');
  modelInfoDiv.id = 'model-info-details';
  
  // Texture section
  const textureSection = document.createElement('div');
  textureSection.style.marginBottom = '15px';
  
  const textureTitle = document.createElement('h3');
  textureTitle.textContent = 'Texture Information';
  textureTitle.style.margin = '5px 0';
  textureTitle.style.fontSize = '16px';
  textureTitle.style.color = '#2196F3';
  
  const textureInfoDiv = document.createElement('div');
  textureInfoDiv.id = 'texture-info-details';
  
  // UV channel controls
  const uvControlsTitle = document.createElement('h3');
  uvControlsTitle.textContent = 'UV Channel';
  uvControlsTitle.style.margin = '5px 0';
  uvControlsTitle.style.fontSize = '16px';
  uvControlsTitle.style.color = '#2196F3';
  
  const uvControls = document.createElement('div');
  uvControls.id = 'uv-controls';
  uvControls.style.display = 'flex';
  uvControls.style.marginBottom = '15px';
  
  const uvButtons = ['UV', 'UV2', 'UV3'].map((name, index) => {
    const button = document.createElement('button');
    button.textContent = name;
    button.dataset.uvIndex = index;
    button.style.flex = '1';
    button.style.margin = '0 5px';
    button.style.padding = '5px';
    button.style.backgroundColor = index === 0 ? '#4CAF50' : '#555';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    
    // Set first button as active by default
    if (index === 0) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', () => {
      // Deactivate all buttons
      document.querySelectorAll('#uv-controls button').forEach(btn => {
        btn.style.backgroundColor = '#555';
        btn.classList.remove('active');
      });
      
      // Activate this button
      button.style.backgroundColor = '#4CAF50';
      button.classList.add('active');
      
      // Switch UV channel in the shader
      switchUvChannel(state, index);
    });
    
    return button;
  });
  
  uvButtons.forEach(button => uvControls.appendChild(button));
  
  // Atlas visualization button
  const atlasButton = document.createElement('button');
  atlasButton.textContent = 'Visualize Texture Atlas';
  atlasButton.style.width = '100%';
  atlasButton.style.margin = '0 0 15px 0';
  atlasButton.style.padding = '8px 12px';
  atlasButton.style.backgroundColor = '#9C27B0';
  atlasButton.style.color = 'white';
  atlasButton.style.border = 'none';
  atlasButton.style.borderRadius = '4px';
  atlasButton.style.cursor = 'pointer';
  
  atlasButton.addEventListener('click', () => {
    createAtlasVisualization(state);
  });
  
  // Assemble the panel
  modelSection.appendChild(modelTitle);
  modelSection.appendChild(modelInfoDiv);
  
  textureSection.appendChild(textureTitle);
  textureSection.appendChild(textureInfoDiv);
  
  // Append to the content div of the panel object
  panelObj.content.appendChild(modelSection);
  panelObj.content.appendChild(textureSection);
  panelObj.content.appendChild(uvControlsTitle);
  panelObj.content.appendChild(uvControls);
  panelObj.content.appendChild(atlasButton);
  panelObj.content.appendChild(textureEditorButton);
  
  // Helper functions to update the panel content
  function updateModelInfoImpl(info) {
    modelInfoDiv.innerHTML = '';
    
    if (info) {
      // Display model name and size
      const nameRow = createInfoRow('Name:', info.name || 'Unknown');
      const sizeRow = createInfoRow('Size:', formatBytes(info.size || 0));
      
      modelInfoDiv.appendChild(nameRow);
      modelInfoDiv.appendChild(sizeRow);
      
      // Add UV map availability
      if (info.uvSets) {
        const uvRow = createInfoRow('UV Maps:', info.uvSets.join(', '));
        modelInfoDiv.appendChild(uvRow);
        
        // Show/hide UV controls based on available UV sets
        updateUvControlsVisibility(info.uvSets);
      }
    } else {
      modelInfoDiv.textContent = 'No model loaded';
    }
  }
  
  function updateTextureInfoImpl(info) {
    textureInfoDiv.innerHTML = '';
    
    if (info) {
      // Display texture name, size, dimensions
      const nameRow = createInfoRow('Name:', info.name || 'Unknown');
      const sizeRow = createInfoRow('Size:', formatBytes(info.size || 0));
      
      if (info.dimensions) {
        const dimensionsRow = createInfoRow('Dimensions:', `${info.dimensions.width} x ${info.dimensions.height}`);
        textureInfoDiv.appendChild(dimensionsRow);
      }
      
      textureInfoDiv.appendChild(nameRow);
      textureInfoDiv.appendChild(sizeRow);
    } else {
      textureInfoDiv.textContent = 'No texture loaded';
    }
  }
  
  function updateUvControlsVisibility(uvSets) {
    // Show/hide UV buttons based on available UV sets
    const buttons = document.querySelectorAll('#uv-controls button');
    
    buttons.forEach((button, index) => {
      if (uvSets && uvSets.includes(`uv${index === 0 ? '' : index + 1}`)) {
        button.style.display = 'block';
      } else if (index === 0) {
        // Always show UV (first channel)
        button.style.display = 'block';
      } else {
        button.style.display = 'none';
      }
    });
  }
  
  function createInfoRow(label, value) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.margin = '2px 0';
    row.style.fontSize = '14px';
    
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.fontWeight = 'bold';
    
    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    
    return row;
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
  
  return panelObj;
} 