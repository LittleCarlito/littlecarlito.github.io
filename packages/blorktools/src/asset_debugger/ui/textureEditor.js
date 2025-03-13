// Texture Editor Module
// Handles the texture editor panel with multi-texture support

import { loadAdditionalTexture, removeTexture, updateTextureSettings, applyMultiTextureMaterial, applyTextureToModel } from '../materials/textureManager.js';
import { createCollapsiblePanel } from '../utils/helpers.js';
import { originalUvData } from '../core/analyzer.js';

let textureEditor = null;
let textureList = null;
let editorWindow = null;

// Create texture editor
export function createTextureEditor(state) {
  // Create a collapsible panel
  const panel = createCollapsiblePanel({
    id: 'texture-editor',
    title: 'Texture Editor',
    initialPosition: { x: 20, y: window.innerHeight - 420 },
    width: 400,
    startCollapsed: false,
    magneticSnap: true
  });
  
  // Main content
  const content = panel.content;
  
  // Create main toggle for multi-texture mode
  const modeToggleSection = document.createElement('div');
  modeToggleSection.style.marginBottom = '20px';
  
  const modeToggleLabel = document.createElement('label');
  modeToggleLabel.style.display = 'flex';
  modeToggleLabel.style.alignItems = 'center';
  modeToggleLabel.style.cursor = 'pointer';
  
  const modeToggleCheckbox = document.createElement('input');
  modeToggleCheckbox.type = 'checkbox';
  modeToggleCheckbox.id = 'multi-texture-toggle';
  modeToggleCheckbox.style.margin = '0 10px 0 0';
  
  const modeToggleText = document.createElement('span');
  modeToggleText.textContent = 'Enable Multi-Texture Mode';
  modeToggleText.style.fontWeight = 'bold';
  
  modeToggleLabel.appendChild(modeToggleCheckbox);
  modeToggleLabel.appendChild(modeToggleText);
  modeToggleSection.appendChild(modeToggleLabel);
  
  // Event listener for mode toggle
  modeToggleCheckbox.addEventListener('change', (e) => {
    state.multiTextureMode = e.target.checked;
    
    // Update UI based on mode
    updateEditorUI(state);
    
    // If turning off multi-texture mode, restore original UV data for all meshes
    if (!state.multiTextureMode && state.modelObject) {
      state.modelObject.traverse((node) => {
        if (node.isMesh && originalUvData.has(node)) {
          const originalUv = originalUvData.get(node);
          node.geometry.setAttribute('uv', originalUv);
          console.log('Restored original UV data for mesh', node.name || 'unnamed');
        }
      });
      
      // Revert to single texture mode
      applyTextureToModel(state);
    } 
    // If turning on multi-texture mode and there are additional textures, apply them
    else if (state.multiTextureMode && state.additionalTextures && state.additionalTextures.length > 0) {
      applyMultiTextureMaterial(state);
    }
  });
  
  content.appendChild(modeToggleSection);
  
  // Create texture list section
  const textureListSection = document.createElement('div');
  textureListSection.className = 'texture-list-section';
  textureListSection.style.display = 'none'; // Initially hidden until multi-texture mode is enabled
  
  // Add title
  const textureListTitle = document.createElement('div');
  textureListTitle.textContent = 'Texture Layers';
  textureListTitle.style.fontWeight = 'bold';
  textureListTitle.style.marginBottom = '10px';
  textureListSection.appendChild(textureListTitle);
  
  // Create texture list container
  textureList = document.createElement('div');
  textureList.className = 'texture-list';
  textureList.style.marginBottom = '15px';
  textureListSection.appendChild(textureList);
  
  // Add primary texture to the list
  const primaryTextureItem = createTextureListItem({
    name: 'Primary Texture',
    isPrimary: true,
    isEnabled: true,
    uvIndex: 0,
    blendMode: 'normal',
    intensity: 1.0
  }, -1, state);
  
  textureList.appendChild(primaryTextureItem);
  
  // Add button for adding new textures
  const addTextureButton = document.createElement('button');
  addTextureButton.textContent = '+ Add Texture';
  addTextureButton.style.width = '100%';
  addTextureButton.style.padding = '8px';
  addTextureButton.style.marginTop = '10px';
  addTextureButton.style.backgroundColor = '#4CAF50';
  addTextureButton.style.color = 'white';
  addTextureButton.style.border = 'none';
  addTextureButton.style.borderRadius = '4px';
  addTextureButton.style.cursor = 'pointer';
  
  addTextureButton.addEventListener('click', () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // When a file is selected
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // Load the texture and add it to state
        loadAdditionalTexture(file, state, 0); // Default to UV0
        
        // Update the texture list
        updateTextureList(state);
      }
      
      // Remove the file input element
      document.body.removeChild(fileInput);
    });
    
    // Open the file dialog
    fileInput.click();
  });
  
  textureListSection.appendChild(addTextureButton);
  content.appendChild(textureListSection);
  
  // Add section for texture visualization in single texture mode
  const singleTextureModeSection = document.createElement('div');
  singleTextureModeSection.className = 'single-texture-mode-section';
  
  // Add instruction text
  const instruction = document.createElement('div');
  instruction.innerHTML = `
    <p>In single texture mode, you can click on different regions of your texture to visualize them on the model.</p>
    <p>The texture will be displayed on the selected UV channel.</p>
  `;
  instruction.style.marginBottom = '15px';
  singleTextureModeSection.appendChild(instruction);
  
  // Create texture preview container
  const texturePreview = document.createElement('div');
  texturePreview.className = 'texture-preview';
  texturePreview.style.border = '1px solid #ddd';
  texturePreview.style.borderRadius = '4px';
  texturePreview.style.marginBottom = '15px';
  texturePreview.style.position = 'relative';
  texturePreview.style.overflow = 'hidden';
  texturePreview.style.height = '200px';
  texturePreview.style.backgroundColor = '#f5f5f5';
  texturePreview.style.display = 'flex';
  texturePreview.style.justifyContent = 'center';
  texturePreview.style.alignItems = 'center';
  
  // Setup texture preview content once the texture is loaded
  if (state.textureObject) {
    updateTexturePreview(texturePreview, state);
  } else {
    texturePreview.textContent = 'No texture loaded';
  }
  
  singleTextureModeSection.appendChild(texturePreview);
  content.appendChild(singleTextureModeSection);
  
  // Register for texture object updates
  state.onTextureLoaded = (texture) => {
    updateTexturePreview(texturePreview, state);
  };
  
  // Initially hide the panel
  panel.container.style.display = 'none';
  
  document.body.appendChild(panel.container);
  
  // Store reference to editor
  textureEditor = panel;
  
  return panel;
}

// Toggle texture editor visibility
export function toggleTextureEditor(state) {
  if (!state.textureObject) {
    alert('No texture loaded. Please load a texture first.');
    return;
  }
  
  if (editorWindow) {
    // Toggle visibility of existing editor
    const isVisible = editorWindow.style.display !== 'none';
    editorWindow.style.display = isVisible ? 'none' : 'block';
    return;
  }
  
  // Create editor window
  editorWindow = document.createElement('div');
  editorWindow.id = 'texture-editor';
  editorWindow.style.position = 'fixed';
  editorWindow.style.left = '50%';
  editorWindow.style.top = '50%';
  editorWindow.style.transform = 'translate(-50%, -50%)';
  editorWindow.style.width = '80%';
  editorWindow.style.maxWidth = '800px';
  editorWindow.style.maxHeight = '80vh';
  editorWindow.style.backgroundColor = 'rgba(40, 40, 40, 0.95)';
  editorWindow.style.color = 'white';
  editorWindow.style.padding = '20px';
  editorWindow.style.borderRadius = '8px';
  editorWindow.style.zIndex = '1000';
  editorWindow.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
  editorWindow.style.overflowY = 'auto';
  
  // Editor header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '20px';
  
  const title = document.createElement('h2');
  title.textContent = 'Texture Editor';
  title.style.margin = '0';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.fontSize = '24px';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', () => {
    editorWindow.style.display = 'none';
  });
  
  header.appendChild(title);
  header.appendChild(closeButton);
  editorWindow.appendChild(header);
  
  // Add placeholder message for future implementation
  const placeholderMessage = document.createElement('div');
  placeholderMessage.style.textAlign = 'center';
  placeholderMessage.style.padding = '40px';
  placeholderMessage.style.color = '#aaa';
  placeholderMessage.innerHTML = `
    <p>Texture Editor will be implemented in a future update.</p>
    <p>Planned features include:</p>
    <ul style="text-align: left; display: inline-block;">
      <li>Basic adjustments (brightness, contrast, saturation)</li>
      <li>Channel viewing and editing</li>
      <li>UV island visualization</li>
      <li>Texture baking tools</li>
    </ul>
  `;
  editorWindow.appendChild(placeholderMessage);
  
  // Add to document
  document.body.appendChild(editorWindow);
}

// Update texture editor UI based on current state
function updateEditorUI(state) {
  if (!textureEditor) return;
  
  // Update multi-texture mode toggle
  const modeToggle = document.getElementById('multi-texture-toggle');
  if (modeToggle) {
    modeToggle.checked = state.multiTextureMode;
  }
  
  // Show/hide sections based on mode
  const textureListSection = textureEditor.content.querySelector('.texture-list-section');
  const singleTextureModeSection = textureEditor.content.querySelector('.single-texture-mode-section');
  
  if (textureListSection) {
    textureListSection.style.display = state.multiTextureMode ? 'block' : 'none';
  }
  
  if (singleTextureModeSection) {
    singleTextureModeSection.style.display = state.multiTextureMode ? 'none' : 'block';
  }
  
  // Update texture list if in multi-texture mode
  if (state.multiTextureMode) {
    updateTextureList(state);
  } else {
    // Update single texture preview
    const texturePreview = singleTextureModeSection?.querySelector('.texture-preview');
    if (texturePreview) {
      updateTexturePreview(texturePreview, state);
    }
  }
}

// Update the texture list in the editor
function updateTextureList(state) {
  if (!textureList) return;
  
  // Clear the current list, except for the primary texture item
  const primaryTextureItem = textureList.firstChild;
  textureList.innerHTML = '';
  
  if (primaryTextureItem) {
    textureList.appendChild(primaryTextureItem);
  }
  
  // Add additional textures to the list
  if (state.additionalTextures && state.additionalTextures.length > 0) {
    state.additionalTextures.forEach((texInfo, index) => {
      const textureItem = createTextureListItem({
        name: texInfo.file.name,
        isPrimary: false,
        isEnabled: texInfo.enabled,
        uvIndex: texInfo.uvIndex,
        blendMode: texInfo.blendMode,
        intensity: texInfo.intensity
      }, index, state);
      
      textureList.appendChild(textureItem);
    });
  }
}

// Create a texture list item
function createTextureListItem(options, index, state) {
  const { name, isPrimary, isEnabled, uvIndex, blendMode, intensity } = options;
  
  const item = document.createElement('div');
  item.className = 'texture-item';
  item.style.marginBottom = '10px';
  item.style.padding = '10px';
  item.style.backgroundColor = '#f5f5f5';
  item.style.borderRadius = '4px';
  item.style.border = '1px solid #ddd';
  
  // Texture name and primary indicator
  const nameRow = document.createElement('div');
  nameRow.style.display = 'flex';
  nameRow.style.justifyContent = 'space-between';
  nameRow.style.alignItems = 'center';
  nameRow.style.marginBottom = '10px';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = name;
  nameSpan.style.fontWeight = isPrimary ? 'bold' : 'normal';
  nameSpan.style.flex = '1';
  nameSpan.style.overflow = 'hidden';
  nameSpan.style.textOverflow = 'ellipsis';
  nameSpan.style.whiteSpace = 'nowrap';
  
  nameRow.appendChild(nameSpan);
  
  // If not primary, add a remove button
  if (!isPrimary) {
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.style.backgroundColor = '#f44336';
    removeButton.style.color = 'white';
    removeButton.style.border = 'none';
    removeButton.style.borderRadius = '50%';
    removeButton.style.width = '24px';
    removeButton.style.height = '24px';
    removeButton.style.cursor = 'pointer';
    removeButton.style.marginLeft = '10px';
    
    removeButton.addEventListener('click', () => {
      removeTexture(index, state);
      updateTextureList(state);
    });
    
    nameRow.appendChild(removeButton);
  }
  
  item.appendChild(nameRow);
  
  // Controls row
  const controlsRow = document.createElement('div');
  controlsRow.style.display = 'flex';
  controlsRow.style.flexDirection = 'column';
  controlsRow.style.gap = '10px';
  
  // Enabled checkbox - only for additional textures
  if (!isPrimary) {
    const enabledLabel = document.createElement('label');
    enabledLabel.style.display = 'flex';
    enabledLabel.style.alignItems = 'center';
    
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = isEnabled;
    enabledCheckbox.style.marginRight = '10px';
    
    enabledCheckbox.addEventListener('change', (e) => {
      updateTextureSettings(index, { enabled: e.target.checked }, state);
    });
    
    enabledLabel.appendChild(enabledCheckbox);
    enabledLabel.appendChild(document.createTextNode('Enabled'));
    controlsRow.appendChild(enabledLabel);
  }
  
  // UV Channel selector
  const uvRow = document.createElement('div');
  uvRow.style.display = 'flex';
  uvRow.style.alignItems = 'center';
  
  const uvLabel = document.createElement('span');
  uvLabel.textContent = 'UV Channel:';
  uvLabel.style.marginRight = '10px';
  uvLabel.style.width = '100px';
  
  const uvSelect = document.createElement('select');
  uvSelect.style.flex = '1';
  uvSelect.style.padding = '4px';
  
  const uvOptions = [
    { value: 0, text: 'UV1' },
    { value: 1, text: 'UV2' },
    { value: 2, text: 'UV3' }
  ];
  
  uvOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.text;
    if (uvIndex === opt.value) option.selected = true;
    
    // If primary texture, only allow UV1
    if (isPrimary && opt.value !== 0) {
      option.disabled = true;
    }
    
    uvSelect.appendChild(option);
  });
  
  // Only allow changing UV for non-primary textures
  uvSelect.disabled = isPrimary;
  
  // Event listener for UV change
  uvSelect.addEventListener('change', (e) => {
    if (!isPrimary) {
      updateTextureSettings(index, { uvIndex: parseInt(e.target.value) }, state);
    }
  });
  
  uvRow.appendChild(uvLabel);
  uvRow.appendChild(uvSelect);
  controlsRow.appendChild(uvRow);
  
  // Blend Mode selector - only for additional textures
  if (!isPrimary) {
    const blendRow = document.createElement('div');
    blendRow.style.display = 'flex';
    blendRow.style.alignItems = 'center';
    
    const blendLabel = document.createElement('span');
    blendLabel.textContent = 'Blend Mode:';
    blendLabel.style.marginRight = '10px';
    blendLabel.style.width = '100px';
    
    const blendSelect = document.createElement('select');
    blendSelect.style.flex = '1';
    blendSelect.style.padding = '4px';
    
    const blendOptions = [
      { value: 'normal', text: 'Normal' },
      { value: 'add', text: 'Add' },
      { value: 'multiply', text: 'Multiply' },
      { value: 'screen', text: 'Screen' },
      { value: 'overlay', text: 'Overlay' }
    ];
    
    blendOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      if (blendMode === opt.value) option.selected = true;
      blendSelect.appendChild(option);
    });
    
    // Event listener for blend mode change
    blendSelect.addEventListener('change', (e) => {
      updateTextureSettings(index, { blendMode: e.target.value }, state);
    });
    
    blendRow.appendChild(blendLabel);
    blendRow.appendChild(blendSelect);
    controlsRow.appendChild(blendRow);
    
    // Intensity slider
    const intensityRow = document.createElement('div');
    intensityRow.style.display = 'flex';
    intensityRow.style.alignItems = 'center';
    
    const intensityLabel = document.createElement('span');
    intensityLabel.textContent = 'Intensity:';
    intensityLabel.style.marginRight = '10px';
    intensityLabel.style.width = '100px';
    
    const intensityValueLabel = document.createElement('span');
    intensityValueLabel.textContent = intensity.toFixed(2);
    intensityValueLabel.style.minWidth = '40px';
    intensityValueLabel.style.textAlign = 'right';
    
    const intensitySlider = document.createElement('input');
    intensitySlider.type = 'range';
    intensitySlider.min = '0';
    intensitySlider.max = '2';
    intensitySlider.step = '0.01';
    intensitySlider.value = intensity;
    intensitySlider.style.flex = '1';
    intensitySlider.style.marginRight = '10px';
    
    // Event listener for intensity change
    intensitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      intensityValueLabel.textContent = value.toFixed(2);
      updateTextureSettings(index, { intensity: value }, state);
    });
    
    intensityRow.appendChild(intensityLabel);
    intensityRow.appendChild(intensitySlider);
    intensityRow.appendChild(intensityValueLabel);
    controlsRow.appendChild(intensityRow);
  }
  
  item.appendChild(controlsRow);
  
  return item;
}

// Update texture preview in single texture mode
function updateTexturePreview(previewContainer, state) {
  // Clear current content
  previewContainer.innerHTML = '';
  
  if (!state.textureObject) {
    previewContainer.textContent = 'No texture loaded';
    return;
  }
  
  // Create an image element
  const img = document.createElement('img');
  img.style.maxWidth = '100%';
  img.style.maxHeight = '100%';
  img.style.objectFit = 'contain';
  
  // Create a canvas to get the image data from the texture
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // If texture is loaded from a file
  if (state.textureObject.image) {
    // Set canvas size to match the texture
    canvas.width = state.textureObject.image.width;
    canvas.height = state.textureObject.image.height;
    
    // Draw the texture to the canvas
    ctx.drawImage(state.textureObject.image, 0, 0);
    
    // Convert to data URL
    img.src = canvas.toDataURL();
  } 
  // If texture is a canvas texture (procedural)
  else if (state.textureObject.source?.data instanceof HTMLCanvasElement) {
    const sourceCanvas = state.textureObject.source.data;
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    ctx.drawImage(sourceCanvas, 0, 0);
    img.src = canvas.toDataURL();
  }
  else {
    previewContainer.textContent = 'Texture preview not available';
    return;
  }
  
  // Add image to preview container
  previewContainer.appendChild(img);
  
  // Make the preview clickable for texture offset/repeat adjustment
  img.style.cursor = 'pointer';
  img.addEventListener('click', (e) => {
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height; // Flip Y for UV coordinates
    
    console.log(`Clicked at UV: (${x.toFixed(2)}, ${y.toFixed(2)})`);
    
    // Apply offset to texture
    applyTextureOffset(x, y, state);
  });
}

// Apply texture offset/repeat based on click
function applyTextureOffset(x, y, state) {
  if (!state.textureObject || !state.modelObject) return;
  
  // Offset to center the clicked point
  const offsetX = 0.5 - x;
  const offsetY = 0.5 - y;
  
  // Apply to all mesh materials
  state.modelObject.traverse((node) => {
    if (node.isMesh && node.material) {
      if (node.material.map) {
        // Reset the repeat
        node.material.map.repeat.set(1, 1);
        
        // Set the offset so the clicked point is centered
        node.material.map.offset.set(offsetX, offsetY);
        
        // Mark the material for update
        node.material.needsUpdate = true;
      }
    }
  });
}

/**
 * Apply texture adjustments
 * @param {Object} state - Global state object
 * @param {Object} adjustments - Adjustment values
 */
export function applyTextureAdjustments(state, adjustments) {
  // This will be implemented in the future
  console.log('Texture adjustments will be implemented in a future update');
} 