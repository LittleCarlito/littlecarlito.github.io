// Drop Panel module
// Creates a movable panel with drag & drop functionality for models and textures
import { createMovablePanel } from '../utils/uiComponents.js';
import { handleFileUploads } from './dragdrop.js';

// Keep track of created drop panel container
let dropPanelContainer = null;

/**
 * Create or toggle the movable drop panel for file uploads
 * @param {Object} state - Global state object
 */
export function createDropPanel(state) {
	// Clean up any rogue visualization containers
	const existingContainers = document.querySelectorAll('#drop-panel');
	if (existingContainers.length > 1) {
		// Keep only the first one if multiple exist
		for (let i = 1; i < existingContainers.length; i++) {
			if (document.body.contains(existingContainers[i])) {
				document.body.removeChild(existingContainers[i]);
			}
		}
	}

	// If panel already exists, ensure it's visible
	if (dropPanelContainer) {
		if (dropPanelContainer.style.display === 'none') {
			dropPanelContainer.style.display = 'block';
		}
		return dropPanelContainer;
	}

	// Create panel using the utility function
	const { container, contentContainer } = createMovablePanel({
		id: 'drop-panel',
		title: '3D Asset Debugger',
		position: { bottom: '20px', right: '20px' },
		width: '360px'
	});
    
	// Store the container for future reference
	dropPanelContainer = container;

	// Center all content in the panel
	contentContainer.style.display = 'flex';
	contentContainer.style.flexDirection = 'column';
	contentContainer.style.alignItems = 'center';
	contentContainer.style.justifyContent = 'center';
	contentContainer.style.textAlign = 'center';
    
	// Add description text
	const descriptionText = document.createElement('p');
	descriptionText.textContent = 'Drop your model and texture files to begin debugging';
	descriptionText.style.textAlign = 'center';
	descriptionText.style.marginBottom = '15px';
	descriptionText.style.width = '100%';
	contentContainer.appendChild(descriptionText);
    
	// Create model drop zone
	const modelDropZone = document.createElement('div');
	modelDropZone.id = 'drop-zone-model';
	modelDropZone.className = 'drop-zone';
	modelDropZone.style.margin = '0 auto 15px auto'; // Center horizontally with margin
    
	const modelIcon = document.createElement('div');
	modelIcon.className = 'drop-zone-icon';
	modelIcon.textContent = '📦';
    
	const modelPrompt = document.createElement('p');
	modelPrompt.className = 'drop-zone-prompt';
	modelPrompt.textContent = 'Drop 3D Model Here';
    
	const modelFormats = document.createElement('p');
	modelFormats.className = 'drop-zone-formats';
	modelFormats.textContent = 'Supported format: .glb';
    
	const modelFileInfo = document.createElement('p');
	modelFileInfo.className = 'file-info';
	modelFileInfo.id = 'model-file-info';
    
	modelDropZone.appendChild(modelIcon);
	modelDropZone.appendChild(modelPrompt);
	modelDropZone.appendChild(modelFormats);
	modelDropZone.appendChild(modelFileInfo);
	contentContainer.appendChild(modelDropZone);
    
	// Create texture drop zone
	const textureDropZone = document.createElement('div');
	textureDropZone.id = 'drop-zone-texture';
	textureDropZone.className = 'drop-zone';
	textureDropZone.style.margin = '0 auto 15px auto'; // Center horizontally with margin
    
	const textureIcon = document.createElement('div');
	textureIcon.className = 'drop-zone-icon';
	textureIcon.textContent = '🖼️';
    
	const texturePrompt = document.createElement('p');
	texturePrompt.className = 'drop-zone-prompt';
	texturePrompt.textContent = 'Drop Texture Atlas Here';
    
	const textureFormats = document.createElement('p');
	textureFormats.className = 'drop-zone-formats';
	textureFormats.textContent = 'Supported formats: .jpg, .png';
    
	const textureFileInfo = document.createElement('p');
	textureFileInfo.className = 'file-info';
	textureFileInfo.id = 'texture-file-info';
    
	textureDropZone.appendChild(textureIcon);
	textureDropZone.appendChild(texturePrompt);
	textureDropZone.appendChild(textureFormats);
	textureDropZone.appendChild(textureFileInfo);
	contentContainer.appendChild(textureDropZone);
    
	// Create start button
	const startButton = document.createElement('button');
	startButton.id = 'start-button';
	startButton.textContent = 'Start Debugging';
	startButton.disabled = true;
	startButton.style.width = '80%'; // Make it slightly narrower than the panel
	startButton.style.margin = '0 auto'; // Center horizontally
	startButton.addEventListener('click', () => {
		handleFileUploads(state);
	});
	contentContainer.appendChild(startButton);

	// Add container to the document
	document.body.appendChild(container);
    
	// Setup drop zone event listeners - this will be called from dragdrop.js
	// We're just creating the UI structure here
    
	console.log('Drop panel created as a movable component');
    
	return container;
}

/**
 * Update the drop panel with current file selections
 * @param {Object} state - Global state object
 */
export function updateDropPanel(state) {
	if (!dropPanelContainer) return;
    
	// Update model file info if available
	if (state.modelFile) {
		const modelInfo = dropPanelContainer.querySelector('#model-file-info');
		if (modelInfo) {
			modelInfo.textContent = state.modelFile.name;
		}
		const modelDropZone = dropPanelContainer.querySelector('#drop-zone-model');
		if (modelDropZone) {
			modelDropZone.classList.add('has-file');
		}
	}
    
	// Update texture file info if available
	if (state.textureFile) {
		const textureInfo = dropPanelContainer.querySelector('#texture-file-info');
		if (textureInfo) {
			textureInfo.textContent = state.textureFile.name;
		}
		const textureDropZone = dropPanelContainer.querySelector('#drop-zone-texture');
		if (textureDropZone) {
			textureDropZone.classList.add('has-file');
		}
	}
    
	// Update start button state
	const startButton = dropPanelContainer.querySelector('#start-button');
	if (startButton) {
		if (state.modelFile || state.textureFile) {
			startButton.disabled = false;
		} else {
			startButton.disabled = true;
		}
	}
}

/**
 * Show or hide the drop panel
 * @param {boolean} show - Whether to show or hide the panel
 */
export function toggleDropPanel(show = true) {
	if (!dropPanelContainer) return;
    
	dropPanelContainer.style.display = show ? 'block' : 'none';
}

/**
 * Remove the drop panel
 */
export function removeDropPanel() {
	if (dropPanelContainer) {
		if (document.body.contains(dropPanelContainer)) {
			document.body.removeChild(dropPanelContainer);
		}
		dropPanelContainer = null;
	}
} 