// Debug Panel Module
// Handles the asset debug info panel and interaction
import { switchUvChannel } from '../core/analyzer.js';
import { toggleTextureEditor } from './textureEditor.js';
import { createAtlasVisualization } from './atlasVisualization.js';
// Exported functions for external use
export let updateModelInfo = null;
export let updateTextureInfo = null;
// Setup debug panel
/**
 *
 */
export function setupDebugPanel(state) {
	// Create the debug panel
	const panel = createDebugPanel(state);
	
	// Set up UV information section - first create section with controls
	setupUvSwitcher(state);
	
	// Then add the atlas cycler and manual controls to the same section
	addAtlasSegmentCycler(state);
}
// Start debugging (called from dragdrop.js)
/**
 *
 */
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
/**
 *
 */
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
	/**
	 *
	 */
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
				console.log('UV Sets detected:', info.uvSets);
			} else {
				content += `<span style="color: #e74c3c;">No UV maps detected</span><br>`;
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
	/**
	 *
	 */
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

	/**
	 *
	 */
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

	/**
	 *
	 */
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
/**
 *
 */
export function autoShowAtlasVisualization(state) {
	if (!state.modelObject || !state.textureObject) {
		console.log('Cannot show atlas visualization: Model or texture not loaded');
		return;
	}
	console.log('Auto-showing atlas visualization');
	// First, analyze the model to find available UV channels
	state.availableUvSets = [];
	state.uvSetNames = [];
	// Create a list of potential UV attributes to check for in the model
	const potentialUvAttributes = [];
	for (let i = 0; i < 8; i++) { // Check up to 8 possible UV channels
		potentialUvAttributes.push(i === 0 ? 'uv' : `uv${i+1}`);
	}
	// Track which channels exist in the model with detailed information
	const detectedUvChannels = new Map();
	// First pass: collect all meshes and detect UV channels
	state.modelObject.traverse((child) => {
		if (child.isMesh && child.geometry) {
			// Check which UV channels this mesh has
			potentialUvAttributes.forEach(attrName => {
				if (child.geometry.attributes[attrName]) {
					// If this channel wasn't detected before, add it
					if (!detectedUvChannels.has(attrName)) {
						detectedUvChannels.set(attrName, {
							count: 0,
							minU: Infinity,
							maxU: -Infinity,
							minV: Infinity,
							maxV: -Infinity,
							sampleUVs: null,
							sampleMesh: null,
							meshes: []
						});
					}
					const info = detectedUvChannels.get(attrName);
					info.count++;
					info.meshes.push(child);
					// Store sample UVs for analysis if this is a screen mesh
					const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                              child.name.toLowerCase().includes('display') || 
                              child.name.toLowerCase().includes('monitor');
					if (isScreenMesh && !info.sampleUVs) {
						info.sampleUVs = child.geometry.attributes[attrName].array;
						info.sampleMesh = child;
					}
					// Analyze UV bounds
					const attr = child.geometry.attributes[attrName];
					for (let i = 0; i < attr.count; i++) {
						const u = attr.getX(i);
						const v = attr.getY(i);
						// Skip invalid values
						if (isNaN(u) || isNaN(v)) continue;
						info.minU = Math.min(info.minU, u);
						info.maxU = Math.max(info.maxU, u);
						info.minV = Math.min(info.minV, v);
						info.maxV = Math.max(info.maxV, v);
					}
				}
			});
		}
	});
	// Build availableUvSets and uvSetNames arrays from detected channels
	detectedUvChannels.forEach((info, channelName) => {
		// Determine what type of mapping this is
		let mappingType = "Unknown";
		let textureUsage = "Unknown";
		if (info.maxU > 1 || info.minU < 0 || info.maxV > 1 || info.minV < 0) {
			mappingType = "Tiling";
		} else {
			mappingType = "Standard";
			// Check if it's using a small portion of the texture
			const uRange = info.maxU - info.minU;
			const vRange = info.maxV - info.minV;
			if (uRange < 0.5 || vRange < 0.5) {
				textureUsage = "Partial Texture";
			} else {
				textureUsage = "Full Texture";
			}
		}
		// Add to the arrays
		state.availableUvSets.push(channelName);
		// Create descriptive name with detailed info
		const displayName = `${channelName.toUpperCase()} - ${textureUsage} (U: ${info.minU.toFixed(2)}-${info.maxU.toFixed(2)}, V: ${info.minV.toFixed(2)}-${info.maxV.toFixed(2)})`;
		state.uvSetNames.push(displayName);
	});
	console.log('Available UV sets:', state.availableUvSets);
	console.log('UV set display names:', state.uvSetNames);
	// Setup the UV switcher in the UI
	setupUvSwitcher(state);
	// Try to find a screen mesh with UV2/UV3 first (common for screens)
	let foundScreenUv = false;
	let bestUvChannel = null; // Start with no selection
	// Prioritize 'uv' (UV1) as the industry standard default
	// First check if 'uv' exists in the available sets
	if (state.availableUvSets.includes('uv')) {
		bestUvChannel = 'uv';
		foundScreenUv = true;
		console.log('Using industry standard UV1 (uv) as default');
	} 
	// Only if 'uv' doesn't exist, check for other UV channels
	else if (state.availableUvSets.length > 0) {
		// If UV1 isn't available, use the first available UV set
		bestUvChannel = state.availableUvSets[0];
		foundScreenUv = true;
		console.log(`UV1 not found, using ${bestUvChannel} as fallback`);
	}
	// If we still don't have a channel (unlikely), default to 'uv'
	if (!bestUvChannel) {
		bestUvChannel = 'uv';
		console.log('No UV channels found, defaulting to uv');
	}
	if (bestUvChannel) {
		// Find the index in the availableUvSets array
		const selectedIndex = state.availableUvSets.indexOf(bestUvChannel);
		if (selectedIndex !== -1) {
			state.currentUvSet = selectedIndex;
			console.log(`Setting initial UV channel to ${bestUvChannel} (index: ${selectedIndex})`);
			// Apply the UV channel - pass the channel name directly
			switchUvChannel(state, bestUvChannel);
		}
	}
	// Create the atlas visualization
	createAtlasVisualization(state);
}

// Setup UV set switcher in the debug panel
/**
 *
 */
function setupUvSwitcher(state) {
	const uvInfoSection = document.getElementById('uv-info-section');
	if (!uvInfoSection) {
		// Create the section if it doesn't exist
		const debugPanel = document.getElementById('debug-panel');
		if (!debugPanel) return;
		
		const newSection = document.createElement('div');
		newSection.className = 'debug-section';
		newSection.id = 'uv-info-section';
		
		// Create label
		const uvLabel = document.createElement('div');
		uvLabel.className = 'debug-label';
		uvLabel.textContent = 'UV Information:';
		uvLabel.style.fontWeight = 'bold';
		uvLabel.style.marginBottom = '10px';
		uvLabel.style.color = '#95a5a6';
		newSection.appendChild(uvLabel);
		
		debugPanel.appendChild(newSection);
		
		// Continue with the new section
		setupUvControls(state, newSection);
	} else {
		// Clear only the UV controls part, preserving other components that might have been added
		const existingControls = uvInfoSection.querySelector('#uv-controls');
		const existingInfoContainer = uvInfoSection.querySelector('#uv-info-container');
		
		if (existingControls) {
			existingControls.remove();
		}
		
		if (existingInfoContainer) {
			existingInfoContainer.remove();
		}
		
		// Setup controls in the existing section
		setupUvControls(state, uvInfoSection);
	}
}

/**
 * Helper function to set up UV controls within a container
 * @param {Object} state - Application state
 * @param {HTMLElement} container - Container to add controls to
 */
function setupUvControls(state, container) {
	// If no UV sets found
	if (state.availableUvSets.length === 0) {
		const noUvInfo = document.createElement('div');
		noUvInfo.className = 'debug-value';
		noUvInfo.style.padding = '10px';
		noUvInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
		noUvInfo.style.borderRadius = '5px';
		noUvInfo.textContent = 'No UV data found in this model.';
		container.appendChild(noUvInfo);
		return;
	}
	
	// Create UV controls
	const uvControls = document.createElement('div');
	uvControls.id = 'uv-controls';
	uvControls.style.marginBottom = '15px';
	
	// Create a label for the dropdown
	const dropdownLabel = document.createElement('div');
	dropdownLabel.textContent = 'Select UV Channel:';
	dropdownLabel.style.marginBottom = '5px';
	dropdownLabel.style.color = 'white';
	uvControls.appendChild(dropdownLabel);
	
	// Create select dropdown
	const select = document.createElement('select');
	select.id = 'uv-channel-select';
	select.style.width = '100%';
	select.style.backgroundColor = '#333';
	select.style.color = 'white';
	select.style.padding = '8px';
	select.style.border = '1px solid #555';
	select.style.borderRadius = '3px';
	select.style.marginBottom = '10px';
	select.style.cursor = 'pointer';
	
	// Add options for each UV set
	state.uvSetNames.forEach((name, index) => {
		const option = document.createElement('option');
		option.value = index;
		option.textContent = name;
		select.appendChild(option);
	});
	
	// Set current value - make sure it's properly initialized
	if (state.currentUvSet !== undefined && state.currentUvSet >= 0 && state.currentUvSet < state.availableUvSets.length) {
		select.value = state.currentUvSet;
		console.log(`Setting dropdown to UV set index ${state.currentUvSet}: ${state.availableUvSets[state.currentUvSet]}`);
	} else {
		// Default to first option
		select.selectedIndex = 0;
		state.currentUvSet = 0;
		console.log(`Defaulting dropdown to first UV set: ${state.availableUvSets[0]}`);
	}
	
	// Log the selected UV channel for debugging
	console.log(`UV Dropdown initialized with value: ${select.value}, text: ${select.options[select.selectedIndex].text}`);
	
	// Add change event
	select.addEventListener('change', function() {
		const selectedIndex = parseInt(this.value);
		state.currentUvSet = selectedIndex;
		const channelName = state.availableUvSets[selectedIndex];
		// Pass the actual channel name (e.g., 'uv', 'uv2') to switchUvChannel
		switchUvChannel(state, channelName);
	});
	
	uvControls.appendChild(select);
	container.appendChild(uvControls);
	
	// Add UV info container
	const uvInfoContainer = document.createElement('div');
	uvInfoContainer.id = 'uv-info-container';
	uvInfoContainer.className = 'debug-value';
	uvInfoContainer.style.fontFamily = 'monospace';
	uvInfoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
	uvInfoContainer.style.padding = '10px';
	uvInfoContainer.style.borderRadius = '5px';
	uvInfoContainer.style.marginBottom = '15px';
	uvInfoContainer.style.color = '#ddd';
	uvInfoContainer.style.lineHeight = '1.4';
	container.appendChild(uvInfoContainer);
}

/**
 * Adds a button to cycle through atlas texture segments
 * @param {Object} state - Global application state
 */
function addAtlasSegmentCycler(state) {
	// Find the UV info section
	const uvInfoSection = document.getElementById('uv-info-section');
	if (!uvInfoSection) {
		console.warn('UV info section not found, cannot add atlas segment cycler');
		return;
	}

	// Check if the cycle button already exists
	if (uvInfoSection.querySelector('#cycle-segments-button')) {
		return; // Button already exists, don't duplicate
	}
	
	// Create atlas segment cycling button
	const cycleButton = document.createElement('button');
	cycleButton.id = 'cycle-segments-button';
	cycleButton.textContent = 'Cycle Atlas Segments';
	cycleButton.className = 'debug-button';
	cycleButton.style.marginTop = '10px';
	cycleButton.style.display = 'block';
	cycleButton.style.width = '100%';
	
	// Add click handler
	cycleButton.addEventListener('click', () => {
		if (state.cycleAtlasSegments) {
			state.cycleAtlasSegments();
			console.log('Cycling atlas segments');
		} else {
			console.warn('Atlas segment cycling function not available');
		}
	});
	
	// Add to UV information section
	uvInfoSection.appendChild(cycleButton);
	
	// Add a help text
	const helpText = document.createElement('div');
	helpText.className = 'help-text';
	helpText.textContent = 'If textures aren\'t displaying correctly, try cycling through different sections of the texture atlas.';
	helpText.style.fontSize = '12px';
	helpText.style.color = '#aaa';
	helpText.style.marginTop = '5px';
	helpText.style.marginBottom = '15px';
	uvInfoSection.appendChild(helpText);
	
	// Check if manual UV controls already exist
	if (!uvInfoSection.querySelector('.manual-uv-controls')) {
		// Add manual UV mapping controls only if they don't exist yet
		addManualUvControls(state, uvInfoSection);
	}
}

/**
 * Add manual UV mapping controls to the debug panel
 * @param {Object} state - Global state object
 * @param {HTMLElement} container - Container to add controls to
 */
function addManualUvControls(state, container) {
	// Create section for manual controls
	const manualControlsSection = document.createElement('div');
	manualControlsSection.className = 'manual-uv-controls';
	manualControlsSection.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
	manualControlsSection.style.padding = '10px';
	manualControlsSection.style.borderRadius = '5px';
	manualControlsSection.style.marginTop = '5px';
	
	// Add heading
	const heading = document.createElement('div');
	heading.textContent = 'Manual UV Mapping Controls';
	heading.style.fontWeight = 'bold';
	heading.style.marginBottom = '10px';
	heading.style.color = '#95a5a6';  // Changed to match other headers
	manualControlsSection.appendChild(heading);
	
	// Create labels and input styles
	const createLabel = (text) => {
		const label = document.createElement('div');
		label.textContent = text;
		label.style.fontSize = '11px';
		label.style.color = '#bbb';
		label.style.marginTop = '5px';
		return label;
	};
	
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
	manualControlsSection.appendChild(createLabel('UV Offset (0-1):'));
	
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
	manualControlsSection.appendChild(createLabel('UV Scale (0-1):'));
	
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
			import('../ui/atlasVisualization.js').then(module => {
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
	
	// Apply button (now optional as a fallback)
	const applyButton = document.createElement('button');
	applyButton.textContent = 'Apply Manual Mapping';
	applyButton.className = 'debug-button';
	applyButton.style.width = '100%';
	applyButton.style.marginTop = '8px';
	applyButton.style.backgroundColor = '#27ae60';
	applyButton.style.padding = '6px';
	applyButton.style.fontWeight = 'bold';
	applyButton.style.display = 'none'; // Hide by default since auto-apply is enabled
	
	// Add click handler for apply button
	applyButton.addEventListener('click', applyMapping);
	
	manualControlsSection.appendChild(applyButton);
	
	// 3. Predefined Segments Dropdown
	manualControlsSection.appendChild(createLabel('Predefined Segments:'));
	
	const segmentsSelect = document.createElement('select');
	segmentsSelect.style.width = '100%';
	segmentsSelect.style.padding = '5px';
	segmentsSelect.style.backgroundColor = '#333';
	segmentsSelect.style.border = '1px solid #555';
	segmentsSelect.style.borderRadius = '3px';
	segmentsSelect.style.color = 'white';
	segmentsSelect.style.marginBottom = '10px';
	
	// Add common segment options
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
	
	segments.forEach((segment, index) => {
		const option = document.createElement('option');
		option.value = index;
		option.textContent = segment.name;
		segmentsSelect.appendChild(option);
	});
	
	segmentsSelect.addEventListener('change', function() {
		const selectedSegment = segments[this.value];
		
		// Update input fields
		offsetXInput.value = selectedSegment.u;
		offsetYInput.value = selectedSegment.v;
		scaleWInput.value = selectedSegment.w;
		scaleHInput.value = selectedSegment.h;
		
		// Auto-apply the mapping immediately
		applyMapping();
	});
	
	manualControlsSection.appendChild(segmentsSelect);
	
	// Add the section to the container
	container.appendChild(manualControlsSection);
	
	// Add note about auto-apply
	const autoApplyNote = document.createElement('div');
	autoApplyNote.textContent = 'Changes auto-apply immediately';
	autoApplyNote.style.fontSize = '11px';
	autoApplyNote.style.color = '#27ae60';
	autoApplyNote.style.marginTop = '5px';
	autoApplyNote.style.textAlign = 'center';
	manualControlsSection.appendChild(autoApplyNote);
	
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