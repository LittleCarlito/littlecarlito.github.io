// UV Channel Panel Module
// Creates a movable panel for UV channel selection and manipulation
import { createMovablePanel, createButton, createLabel, createDropdown } from '../utils/uiComponents.js';
import { switchUvChannel } from '../core/analyzer.js';

// Keep track of created panel
let uvChannelPanelContainer = null;

/**
 * Create or toggle a UV channel selection panel
 * @param {Object} state - Global state object
 * @returns {HTMLElement} The panel container
 */
export function createUvChannelPanel(state) {
	console.log('Creating UV Channel Panel with state:', {
		availableUvSets: state.availableUvSets ? state.availableUvSets.length + ' sets' : 'None',
		modelLoaded: state.modelLoaded,
		modelObject: state.modelObject ? 'Available' : 'Missing'
	});
	
	// If panel already exists, just ensure it's visible
	if (uvChannelPanelContainer) {
		console.log('UV Channel Panel already exists, ensuring visibility');
		uvChannelPanelContainer.style.display = 'block';
		
		// Update panel content if state has changed
		updateUvChannelPanel(state);
		return uvChannelPanelContainer;
	}

	// Create panel using the utility function - position consistently with Atlas panel
	const { container, contentContainer } = createMovablePanel({
		id: 'uv-channel-panel',
		title: 'UV Channel Controls',
		position: { top: '80px', left: '20px' },
		width: '280px',
		startCollapsed: false
	});

	// Store for future reference
	uvChannelPanelContainer = container;
	console.log('UV Channel Panel container created');

	// Add content to the panel - either UV data or "No model loaded" message
	if (state.availableUvSets && state.availableUvSets.length > 0) {
		console.log('Adding UV controls with data:', state.availableUvSets);
		// We have UV data, add the controls
		addUvChannelSelector(state, contentContainer);
		addAtlasSegmentCycler(state, contentContainer);
		addManualUvControls(state, contentContainer);
	} else {
		console.log('No UV data available, showing placeholder message');
		// No UV data, show placeholder message
		addNoDataMessage(contentContainer);
	}

	// Add to document and ensure it's visible
	document.body.appendChild(container);
	container.style.display = 'block';
	console.log('UV Channel panel added to document and set to visible');

	return container;
}

/**
 * Add a "No model loaded" message to the panel
 * @param {HTMLElement} container - Container to add the message to
 */
function addNoDataMessage(container) {
	const messageContainer = document.createElement('div');
	messageContainer.style.padding = '15px';
	messageContainer.style.textAlign = 'center';
	messageContainer.style.color = '#aaa';
	messageContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
	messageContainer.style.borderRadius = '5px';
	messageContainer.style.marginTop = '10px';
	
	const noDataMessage = document.createElement('p');
	noDataMessage.textContent = 'No model loaded';
	noDataMessage.style.fontSize = '14px';
	noDataMessage.style.fontWeight = 'bold';
	noDataMessage.style.marginBottom = '10px';
	messageContainer.appendChild(noDataMessage);
	
	const helpMessage = document.createElement('p');
	helpMessage.textContent = 'Load a 3D model to view and manipulate UV channel data';
	helpMessage.style.fontSize = '12px';
	messageContainer.appendChild(helpMessage);
	
	container.appendChild(messageContainer);
}

/**
 * Add UV channel selector to the panel
 * @param {Object} state - Global state object
 * @param {HTMLElement} container - Container to add the selector to
 */
function addUvChannelSelector(state, container) {
	// If no UV sets found
	if (!state.availableUvSets || state.availableUvSets.length === 0) {
		const noUvInfo = document.createElement('div');
		noUvInfo.style.padding = '10px';
		noUvInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
		noUvInfo.style.borderRadius = '5px';
		noUvInfo.textContent = 'No UV data found in this model.';
		container.appendChild(noUvInfo);
		return;
	}

	// Add label for the dropdown
	container.appendChild(createLabel('Select UV Channel:'));

	// Create dropdown items from available UV sets
	const items = state.uvSetNames.map((name, index) => ({
		value: index.toString(),
		text: name
	}));

	// Create and add the dropdown
	const dropdown = createDropdown({
		id: 'uv-channel-select',
		items: items,
		selectedValue: state.currentUvSet !== undefined ? state.currentUvSet.toString() : '0',
		onChange: function(e) {
			const selectedIndex = parseInt(this.value);
			state.currentUvSet = selectedIndex;
			const channelName = state.availableUvSets[selectedIndex];
			switchUvChannel(state, channelName);
			// Update our own UV info display after switching
			updateUvInfo(state);
		}
	});
    
	container.appendChild(dropdown);

	// Add UV info container
	const uvInfoContainer = document.createElement('div');
	uvInfoContainer.id = 'uv-info-container';
	uvInfoContainer.style.fontFamily = 'monospace';
	uvInfoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
	uvInfoContainer.style.padding = '10px';
	uvInfoContainer.style.borderRadius = '5px';
	uvInfoContainer.style.marginBottom = '15px';
	uvInfoContainer.style.color = '#ddd';
	uvInfoContainer.style.lineHeight = '1.4';
	uvInfoContainer.style.fontSize = '11px';
	container.appendChild(uvInfoContainer);

	// Update UV info based on current selection
	updateUvInfo(state);
}

/**
 * Update the UV info display with current statistics
 * @param {Object} state - Global state object
 */
function updateUvInfo(state) {
	// Find the container within our panel rather than using document.getElementById
	const infoContainer = uvChannelPanelContainer?.querySelector('#uv-info-container');
	if (!infoContainer) {
		console.warn('UV info container not found in UV Channel Panel');
		return;
	}

	// Make sure we have a valid selection
	if (state.currentUvSet === undefined || !state.availableUvSets || 
        state.currentUvSet >= state.availableUvSets.length) {
		infoContainer.textContent = 'No UV channel selected';
		return;
	}

	const channelName = state.availableUvSets[state.currentUvSet];
    
	// Build HTML content
	let content = '<div style="color: #f1c40f; font-weight: bold;">UV Channel Info:</div>';
	content += `<div>Channel Name: <span style="color: #3498db">${channelName}</span></div>`;
    
	// Add mapping type if available
	if (state.uvMappingInfo && state.uvMappingInfo[channelName]) {
		const info = state.uvMappingInfo[channelName];
		content += `<div>Mapping Type: <span style="color: #2ecc71">${info.mappingType || 'Standard (0-1 Range)'}</span></div>`;
		content += `<div>Texture Usage: <span style="color: #2ecc71">${info.textureUsage || 'Full Texture'}</span></div>`;
        
		// Add mesh statistics
		content += '<div style="margin-top: 5px; color: #f1c40f;">Mesh Statistics:</div>';
		content += `<div>Meshes with this UV: <span style="color: #3498db">${info.meshes ? info.meshes.length : 0}</span></div>`;
        
		if (info.meshes && info.meshes.length > 0) {
			const screenMeshes = info.meshes.filter(mesh => 
				mesh.name.toLowerCase().includes('screen') || 
                mesh.name.toLowerCase().includes('display') || 
                mesh.name.toLowerCase().includes('monitor'));
            
			content += `<div>Screen Meshes: <span style="color: #3498db">${screenMeshes.length} of ${info.meshes.length}</span></div>`;
		}
        
		// Add UV range
		if (info.minU !== undefined && info.maxU !== undefined) {
			content += '<div style="margin-top: 5px; color: #f1c40f;">UV Range:</div>';
			content += `<div>U: <span style="color: #3498db">${info.minU.toFixed(4)} to ${info.maxU.toFixed(4)}</span></div>`;
			content += `<div>V: <span style="color: #3498db">${info.minV.toFixed(4)} to ${info.maxV.toFixed(4)}</span></div>`;
		}
        
		// Add sample UV coordinates from a mesh
		if (info.sampleUVs && info.sampleMesh) {
			content += '<div style="margin-top: 5px; color: #f1c40f;">Sample UV Coordinates:</div>';
			content += `<div>From: <span style="color: #3498db">${info.sampleMesh.name}</span></div>`;
            
			// Get a few sample vertices
			const attr = info.sampleMesh.geometry.attributes[channelName];
			const sampleCount = Math.min(5, attr.count);
            
			for (let i = 0; i < sampleCount; i++) {
				const u = attr.getX(i);
				const v = attr.getY(i);
				content += `<div>Vertex ${i}: <span style="color: #3498db">(${u.toFixed(4)}, ${v.toFixed(4)})</span></div>`;
			}
            
			if (attr.count > sampleCount) {
				content += `<div>... and ${attr.count - sampleCount} more vertices</div>`;
			}
		}
	} else {
		content += '<div style="color: #e74c3c;">Detailed UV information not available</div>';
	}

	infoContainer.innerHTML = content;
}

/**
 * Add atlas segment cycler button
 * @param {Object} state - Global state object
 * @param {HTMLElement} container - Container to add to
 */
function addAtlasSegmentCycler(state, container) {
	// Add a separator
	const separator = document.createElement('div');
	separator.style.height = '1px';
	separator.style.backgroundColor = '#444';
	separator.style.margin = '15px 0';
	container.appendChild(separator);
    
	// Add section title
	container.appendChild(createLabel('Atlas Segments:'));
    
	// Create atlas segment cycling button
	const cycleButton = createButton({
		text: 'Cycle Atlas Segments',
		color: '#e67e22',
		onClick: () => {
			if (state.cycleAtlasSegments) {
				state.cycleAtlasSegments();
				console.log('Cycling atlas segments');
			} else {
				console.warn('Atlas segment cycling function not available');
			}
		}
	});
    
	container.appendChild(cycleButton);
    
	// Add a help text
	const helpText = document.createElement('div');
	helpText.textContent = 'If textures aren\'t displaying correctly, try cycling through different sections of the texture atlas.';
	helpText.style.fontSize = '11px';
	helpText.style.color = '#aaa';
	helpText.style.marginTop = '5px';
	helpText.style.marginBottom = '15px';
	container.appendChild(helpText);
}

/**
 * Add manual UV mapping controls
 * @param {Object} state - Global state object
 * @param {HTMLElement} container - Container to add to
 */
function addManualUvControls(state, container) {
	// Add section title
	container.appendChild(createLabel('Manual UV Mapping Controls:'));
    
	// Create section for manual controls
	const manualControlsSection = document.createElement('div');
	manualControlsSection.className = 'manual-uv-controls';
	manualControlsSection.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
	manualControlsSection.style.padding = '10px';
	manualControlsSection.style.borderRadius = '5px';
	manualControlsSection.style.marginTop = '5px';
    
	// Helper for creating labels
	const createControlLabel = (text) => {
		const label = document.createElement('div');
		label.textContent = text;
		label.style.fontSize = '11px';
		label.style.color = '#bbb';
		label.style.marginTop = '5px';
		return label;
	};
    
	// Helper for setting input styles
	const setInputStyles = (input) => {
		input.style.width = '100%';
		input.style.padding = '4px';
		input.style.backgroundColor = '#333';
		input.style.border = '1px solid #555';
		input.style.borderRadius = '3px';
		input.style.color = 'white';
		input.style.marginBottom = '5px';
		return input;
	};
    
	// 1. UV Offset Controls (x, y)
	manualControlsSection.appendChild(createControlLabel('UV Offset (0-1):'));
    
	// Offset X input
	const offsetXContainer = document.createElement('div');
	offsetXContainer.style.display = 'flex';
	offsetXContainer.style.alignItems = 'center';
	offsetXContainer.style.marginBottom = '5px';
    
	const offsetXLabel = document.createElement('span');
	offsetXLabel.textContent = 'X: ';
	offsetXLabel.style.width = '20px';
	offsetXContainer.appendChild(offsetXLabel);
    
	const offsetXInput = document.createElement('input');
	offsetXInput.type = 'number';
	offsetXInput.min = '0';
	offsetXInput.max = '1';
	offsetXInput.step = '0.01';
	offsetXInput.value = '0';
	setInputStyles(offsetXInput);
	offsetXContainer.appendChild(offsetXInput);
    
	manualControlsSection.appendChild(offsetXContainer);
    
	// Offset Y input
	const offsetYContainer = document.createElement('div');
	offsetYContainer.style.display = 'flex';
	offsetYContainer.style.alignItems = 'center';
	offsetYContainer.style.marginBottom = '5px';
    
	const offsetYLabel = document.createElement('span');
	offsetYLabel.textContent = 'Y: ';
	offsetYLabel.style.width = '20px';
	offsetYContainer.appendChild(offsetYLabel);
    
	const offsetYInput = document.createElement('input');
	offsetYInput.type = 'number';
	offsetYInput.min = '0';
	offsetYInput.max = '1';
	offsetYInput.step = '0.01';
	offsetYInput.value = '0';
	setInputStyles(offsetYInput);
	offsetYContainer.appendChild(offsetYInput);
    
	manualControlsSection.appendChild(offsetYContainer);
    
	// 2. UV Scale Controls (w, h)
	manualControlsSection.appendChild(createControlLabel('UV Scale (0-1):'));
    
	// Scale Width input
	const scaleWContainer = document.createElement('div');
	scaleWContainer.style.display = 'flex';
	scaleWContainer.style.alignItems = 'center';
	scaleWContainer.style.marginBottom = '5px';
    
	const scaleWLabel = document.createElement('span');
	scaleWLabel.textContent = 'W: ';
	scaleWLabel.style.width = '20px';
	scaleWContainer.appendChild(scaleWLabel);
    
	const scaleWInput = document.createElement('input');
	scaleWInput.type = 'number';
	scaleWInput.min = '0.01';
	scaleWInput.max = '1';
	scaleWInput.step = '0.01';
	scaleWInput.value = '1';
	setInputStyles(scaleWInput);
	scaleWContainer.appendChild(scaleWInput);
    
	manualControlsSection.appendChild(scaleWContainer);
    
	// Scale Height input
	const scaleHContainer = document.createElement('div');
	scaleHContainer.style.display = 'flex';
	scaleHContainer.style.alignItems = 'center';
	scaleHContainer.style.marginBottom = '5px';
    
	const scaleHLabel = document.createElement('span');
	scaleHLabel.textContent = 'H: ';
	scaleHLabel.style.width = '20px';
	scaleHContainer.appendChild(scaleHLabel);
    
	const scaleHInput = document.createElement('input');
	scaleHInput.type = 'number';
	scaleHInput.min = '0.01';
	scaleHInput.max = '1';
	scaleHInput.step = '0.01';
	scaleHInput.value = '1';
	setInputStyles(scaleHInput);
	scaleHContainer.appendChild(scaleHInput);
    
	manualControlsSection.appendChild(scaleHContainer);
    
	// Function to apply mapping changes automatically
	const applyMapping = () => {
		// Get values
		const offsetX = parseFloat(offsetXInput.value) || 0;
		const offsetY = parseFloat(offsetYInput.value) || 0;
		const scaleW = parseFloat(scaleWInput.value) || 1;
		const scaleH = parseFloat(scaleHInput.value) || 1;
        
		// Check if all values are valid
		if (offsetX < 0 || offsetX > 1 || 
            offsetY < 0 || offsetY > 1 || 
            scaleW <= 0 || scaleW > 1 || 
            scaleH <= 0 || scaleH > 1) {
			return;
		}
        
		// Apply mapping to all screen meshes
		if (state.screenMeshes && state.screenMeshes.length > 0) {
			state.screenMeshes.forEach(mesh => {
				if (mesh.material && mesh.material.map) {
					// Apply offset and scale
					mesh.material.map.offset.set(offsetX, offsetY);
					mesh.material.map.repeat.set(scaleW, scaleH);
                    
					// If material has emissive map, apply same settings
					if (mesh.material.emissiveMap) {
						mesh.material.emissiveMap.offset.set(offsetX, offsetY);
						mesh.material.emissiveMap.repeat.set(scaleW, scaleH);
					}
                    
					// Update textures
					mesh.material.map.needsUpdate = true;
					mesh.material.needsUpdate = true;
				}
			});
            
			console.log(`Applied manual UV mapping: Offset(${offsetX}, ${offsetY}), Scale(${scaleW}, ${scaleH})`);
            
			// Update the current UV region for visualization
			if (state.setCurrentUvRegion) {
				state.setCurrentUvRegion([offsetX, offsetY], [offsetX + scaleW, offsetY + scaleH], state);
			}
            
			// Update atlas visualization
			import('./atlasVisualization.js').then(module => {
				module.updateAtlasVisualization(state);
			});
		} else {
			console.warn('No screen meshes found to apply mapping to');
		}
	};
    
	// Add listeners to auto-apply when any input changes
	offsetXInput.addEventListener('input', applyMapping);
	offsetYInput.addEventListener('input', applyMapping);
	scaleWInput.addEventListener('input', applyMapping);
	scaleHInput.addEventListener('input', applyMapping);
    
	// 3. Predefined Segments Dropdown
	manualControlsSection.appendChild(createControlLabel('Predefined Segments:'));
    
	// Define common segment options
	const segments = [
		{ name: 'Full texture (1×1)', u: 0, v: 0, w: 1, h: 1 },
		{ name: 'Top-left quarter (1/2×1/2)', u: 0, v: 0, w: 0.5, h: 0.5 },
		{ name: 'Top-right quarter (1/2×1/2)', u: 0.5, v: 0, w: 0.5, h: 0.5 },
		{ name: 'Bottom-left quarter (1/2×1/2)', u: 0, v: 0.5, w: 0.5, h: 0.5 },
		{ name: 'Bottom-right quarter (1/2×1/2)', u: 0.5, v: 0.5, w: 0.5, h: 0.5 },
		{ name: 'Top-left ninth (1/3×1/3)', u: 0, v: 0, w: 0.33, h: 0.33 },
		{ name: 'Top-center ninth (1/3×1/3)', u: 0.33, v: 0, w: 0.33, h: 0.33 },
		{ name: 'Top-right ninth (1/3×1/3)', u: 0.66, v: 0, w: 0.33, h: 0.33 },
		{ name: 'Middle-left ninth (1/3×1/3)', u: 0, v: 0.33, w: 0.33, h: 0.33 }
	];
    
	// Create items for dropdown
	const segmentItems = segments.map((segment, index) => ({
		value: index.toString(),
		text: segment.name
	}));
    
	// Create and add dropdown
	const segmentsSelect = createDropdown({
		id: 'predefined-segments',
		items: segmentItems,
		onChange: function() {
			const selectedSegment = segments[this.value];
            
			// Update input fields
			offsetXInput.value = selectedSegment.u;
			offsetYInput.value = selectedSegment.v;
			scaleWInput.value = selectedSegment.w;
			scaleHInput.value = selectedSegment.h;
            
			// Auto-apply the mapping immediately
			applyMapping();
		}
	});
    
	manualControlsSection.appendChild(segmentsSelect);

	// Add note about auto-apply
	const autoApplyNote = document.createElement('div');
	autoApplyNote.textContent = 'Changes auto-apply immediately';
	autoApplyNote.style.fontSize = '11px';
	autoApplyNote.style.color = '#27ae60';
	autoApplyNote.style.marginTop = '5px';
	autoApplyNote.style.textAlign = 'center';
	manualControlsSection.appendChild(autoApplyNote);
    
	// Add to main container
	container.appendChild(manualControlsSection);
    
	// Expose a global function to reset the values to defaults
	state.resetManualMappingControls = () => {
		offsetXInput.value = '0';
		offsetYInput.value = '0';
		scaleWInput.value = '1';
		scaleHInput.value = '1';
		segmentsSelect.selectedIndex = 0;
		applyMapping(); // Apply the reset values
	};
}

/**
 * Update the UV Channel Panel with current UV data
 * @param {Object} state - Global state object
 */
export function updateUvChannelPanel(state) {
	console.log('updateUvChannelPanel called with state:', {
		availableUvSets: state.availableUvSets ? state.availableUvSets.length + ' sets' : 'None',
		modelObject: state.modelObject ? 'Model loaded' : 'No model',
		textureObject: state.textureObject ? 'Texture loaded' : 'No texture',
		modelLoaded: state.modelLoaded,
		textureLoaded: state.textureLoaded
	});

	// Create the panel if it doesn't exist
	if (!uvChannelPanelContainer) {
		console.log('Creating UV channel panel as it does not exist');
		createUvChannelPanel(state);
		return;
	}

	// Get the content container
	const contentContainer = uvChannelPanelContainer.querySelector('.panel-content');
	if (!contentContainer) {
		console.error('Could not find content container in UV channel panel');
		return;
	}

	// Clear out the existing content
	contentContainer.innerHTML = '';

	// Add appropriate content based on whether we have UV data
	if (state.availableUvSets && state.availableUvSets.length > 0) {
		console.log('Adding UV channel controls with ' + state.availableUvSets.length + ' UV sets');
		// We have UV data, add the controls
		addUvChannelSelector(state, contentContainer);
		addAtlasSegmentCycler(state, contentContainer);
		addManualUvControls(state, contentContainer);
	} else {
		console.log('No UV data available, showing no data message');
		// No UV data, show placeholder message
		addNoDataMessage(contentContainer);
	}

	// Ensure the panel is visible
	uvChannelPanelContainer.style.display = 'block';
}

/**
 * Remove the UV channel panel
 */
export function removeUvChannelPanel() {
	if (uvChannelPanelContainer) {
		// Instead of removing, just hide the panel
		uvChannelPanelContainer.style.display = 'none';
	}
} 