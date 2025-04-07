// Drop Panel module
// Creates a movable panel with drag & drop functionality for models and textures
import { createMovablePanel, createButton } from '../utils/uiComponents.js';
import { handleFileUploads } from './dragdrop.js';

// Keep track of created drop panel container
let dropPanelContainer = null;

console.log('Drop Panel module loaded');

/**
 * Create or toggle the movable drop panel for file uploads
 * @param {Object} state - Global state object
 */
export function createDropPanel(state) {
	console.log('Creating drop panel with state:', {
		modelLoaded: state.modelLoaded,
		textureLoaded: state.textureLoaded,
		modelFile: state.modelFile ? 'present' : 'none',
		textureFiles: {
			baseColor: state.textureFiles?.baseColor ? 'present' : 'none',
			orm: state.textureFiles?.orm ? 'present' : 'none',
			normal: state.textureFiles?.normal ? 'present' : 'none'
		}
	});

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
	modelDropZone.title = 'Drop GLB or GLTF file here';
    
	// Add icon for drop zone
	const modelIcon = document.createElement('div');
	modelIcon.className = 'drop-zone-icon';
	modelIcon.innerHTML = '📦';
	modelDropZone.appendChild(modelIcon);
    
	// Add drop message
	const modelText = document.createElement('p');
	modelText.className = 'drop-zone-prompt';
	modelText.textContent = 'Drop 3D Model Here';
	modelDropZone.appendChild(modelText);
    
	// Add supported formats
	const modelFormats = document.createElement('p');
	modelFormats.className = 'drop-zone-formats';
	modelFormats.textContent = 'Supported format: .glb';
	modelDropZone.appendChild(modelFormats);
    
	// Add file info element
	const modelFileInfo = document.createElement('div');
	modelFileInfo.className = 'file-info';
	modelFileInfo.id = 'model-file-info';
	modelFileInfo.textContent = state.modelFile ? state.modelFile.name : 'No file selected';
	modelDropZone.appendChild(modelFileInfo);
    
	// Add to container
	contentContainer.appendChild(modelDropZone);
    
	// Create texture drop zones for different texture types
    const textureTypes = [
        { id: 'baseColor', name: 'Base Color', icon: '🎨', description: 'Color + Opacity' },
        { id: 'orm', name: 'ORM', icon: '✨', description: 'Occlusion, Roughness, Metalness' },
        { id: 'normal', name: 'Normal Map', icon: '🧩', description: 'Surface Detail' }
    ];
    
    // Initialize textureFiles object if it doesn't exist
    if (!state.textureFiles) {
        state.textureFiles = {};
    }
    
    textureTypes.forEach(type => {
        const textureDropZone = document.createElement('div');
        textureDropZone.id = `drop-zone-texture-${type.id}`;
        textureDropZone.className = 'drop-zone';
        textureDropZone.dataset.textureType = type.id;
        textureDropZone.title = `Drop ${type.name} texture here`;
        
        // Add icon for drop zone
        const textureIcon = document.createElement('div');
        textureIcon.className = 'drop-zone-icon';
        textureIcon.innerHTML = type.icon;
        textureDropZone.appendChild(textureIcon);
        
        // Add drop message
        const textureText = document.createElement('p');
        textureText.className = 'drop-zone-prompt';
        textureText.textContent = `Drop ${type.name} Texture Here`;
        textureDropZone.appendChild(textureText);
        
        // Add description
        const textureDesc = document.createElement('p');
        textureDesc.className = 'drop-zone-formats';
        textureDesc.textContent = type.description;
        textureDropZone.appendChild(textureDesc);
        
        // Add supported formats
        const textureFormats = document.createElement('p');
        textureFormats.className = 'drop-zone-formats';
        textureFormats.textContent = 'Supported formats: .jpg, .png';
        textureDropZone.appendChild(textureFormats);
        
        // Add file info element
        const textureFileInfo = document.createElement('div');
        textureFileInfo.className = 'file-info';
        textureFileInfo.id = `texture-file-info-${type.id}`;
        textureFileInfo.textContent = state.textureFiles[type.id] ? state.textureFiles[type.id].name : 'No file selected';
        textureDropZone.appendChild(textureFileInfo);
        
        // Add to container
        contentContainer.appendChild(textureDropZone);
    });
    
	// Create start button
	const startButton = createButton({
		id: 'start-debugging-button',
		text: 'Start Debugging',
		onClick: () => {
			console.log('Start debugging button clicked with files:', {
				modelFile: state.modelFile ? state.modelFile.name : 'none',
				textureFiles: {
					baseColor: state.textureFiles.baseColor ? state.textureFiles.baseColor.name : 'none',
					orm: state.textureFiles.orm ? state.textureFiles.orm.name : 'none',
					normal: state.textureFiles.normal ? state.textureFiles.normal.name : 'none'
				}
			});
			
			// Check if we have at least one file
			if (!state.modelFile && !Object.values(state.textureFiles).every(file => file === undefined)) {
				console.warn('No files selected for debugging');
				alert('Please drop at least one model or texture file to begin debugging.');
				return;
			}
			
			// Start file processing
			console.log('Starting file uploads process');
			handleFileUploads(state);
		},
		width: '80%', // Make it slightly narrower than the panel
		margin: '0 auto', // Center horizontally
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
	console.log('Updating drop panel with state:', {
		modelFile: state.modelFile ? state.modelFile.name : 'none',
		textureFiles: state.textureFiles ? Object.keys(state.textureFiles).filter(key => state.textureFiles[key]).join(', ') : 'none'
	});

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
    
	// Update texture file info for each texture type
	if (state.textureFiles) {
		['baseColor', 'orm', 'normal'].forEach(type => {
			if (state.textureFiles[type]) {
				const textureInfo = dropPanelContainer.querySelector(`#texture-file-info-${type}`);
				if (textureInfo) {
					textureInfo.textContent = state.textureFiles[type].name;
				}
				const textureDropZone = dropPanelContainer.querySelector(`#drop-zone-texture-${type}`);
				if (textureDropZone) {
					textureDropZone.classList.add('has-file');
				}
			}
		});
	}
    
	// Update start button state
	const startButton = dropPanelContainer.querySelector('#start-debugging-button');
	if (startButton) {
		const hasAnyFile = state.modelFile || (state.textureFiles && Object.values(state.textureFiles).some(file => file));
		startButton.disabled = !hasAnyFile;
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