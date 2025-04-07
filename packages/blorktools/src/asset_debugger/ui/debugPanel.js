// Debug Panel Module
// Handles the asset debug info panel and interaction
import { switchUvChannel } from '../core/analyzer.js';
import { createUvChannelPanel, updateUvChannelPanel } from './uvChannelPanel.js';
import { createButton, createMovablePanel } from '../utils/uiComponents.js';

// Keep track of created panel
let debugPanelContainer = null;

// Exported functions for external use
export let updateModelInfo = null;
export let updateTextureInfo = null;

// Setup debug panel
/**
 *
 */
export function setupDebugPanel(state) {
	console.log('Setting up debug panel');
	createDebugPanel(state);
	
	// Update with initial state if available
	if (state.modelObject && state.modelFile) {
		console.log('Initial model data available, updating debug panel');
		state.updateModelInfo({
			name: state.modelFile.name,
			size: state.modelFile.size,
			uvSets: state.availableUvSets || [],
			meshes: getMeshesFromModel(state.modelObject)
		});
	}
	
	if (state.textureObject && state.textureFile) {
		console.log('Initial texture data available, updating debug panel');
		state.updateTextureInfo({
			name: state.textureFile.name,
			size: state.textureFile.size,
			dimensions: state.textureObject.image ? {
				width: state.textureObject.image.width,
				height: state.textureObject.image.height
			} : undefined
		});
	}
}

// Start debugging (called from dragdrop.js)
/**
 * Start debugging mode with loaded assets
 * @param {Object} state - Global state object
 */
export function startDebugging(state) {
	console.log('Starting debugging with files:', state.modelFile, '\n', state.textureFile);
	
	// Show debug panel - find it either by ID or in our global reference
	if (debugPanelContainer) {
		console.log('Making debug panel visible via container reference');
		debugPanelContainer.style.display = 'block';
	} else {
		const debugPanel = document.getElementById('debug-panel');
		if (debugPanel) {
			console.log('Making debug panel visible via DOM lookup');
			debugPanel.style.display = 'block';
		} else {
			console.log('Debug panel not found, creating it');
			createDebugPanel(state);
		}
	}
	
	// Show renderer canvas
	if (state.renderer) {
		console.log('Making renderer visible');
		state.renderer.domElement.style.display = 'block';
	}
	
	// Set debug mode
	state.isDebugMode = true;
	
	// Force update model info
	if (state.modelObject && state.updateModelInfo) {
		console.log('Force updating model info panel');
		state.updateModelInfo({
			name: state.modelFile?.name || 'Model object available',
			size: state.modelFile?.size || 0,
			uvSets: state.availableUvSets || [],
			meshes: getMeshesFromModel(state.modelObject)
		});
	}
	
	// Force update texture info
	if (state.textureObject && state.updateTextureInfo) {
		console.log('Force updating texture info panel');
		state.updateTextureInfo({
			name: state.textureFile?.name || 'Texture object available',
			size: state.textureFile?.size || 0,
			dimensions: state.textureObject.image ? {
				width: state.textureObject.image.width,
				height: state.textureObject.image.height
			} : undefined
		});
	}
	
	// Hide loading screen
	const loadingScreen = document.getElementById('loading');
	if (loadingScreen) {
		loadingScreen.style.display = 'none';
	}
	
	// Analyze UV channels if we have a model
	if (state.modelObject) {
		console.log('Analyzing UV channels in startDebugging');
		analyzeUvChannels(state);
	}
	
	// Import dynamically to avoid circular dependencies
	import('./atlasVisualization.js').then(module => {
		// CRITICAL: Force atlas visualization update after debugging starts
		console.log('FORCE UPDATING atlas visualization after debugging starts');
		
		// Ensure we have textures in the state object before updating
		if (!state.textureObjects) {
			state.textureObjects = {};
		}
		
		// Ensure backward compatibility with older code
		if (state.textureObject && !state.textureObjects.baseColor) {
			state.textureObjects.baseColor = state.textureObject;
		}
		
		// Add any texture files to the appropriate texture objects
		if (state.textureFiles) {
			Object.keys(state.textureFiles).forEach(type => {
				if (state.textureFiles[type] && !state.textureObjects[type]) {
					console.log(`Loading missing ${type} texture to state`);
					
					// Import texture manager to load any missing textures
					import('../materials/textureManager.js').then(texModule => {
						texModule.loadTexture(state, state.textureFiles[type], type)
							.then(() => {
								console.log(`Successfully loaded ${type} texture after debugging started`);
								// Update atlas again after texture loaded
								module.updateAtlasVisualization(state);
							});
					});
				}
			});
		}
		
		// Force immediate update of the atlas visualizations
		module.updateAtlasVisualization(state);
		
		// Schedule another update after a short delay to ensure all assets are loaded
		setTimeout(() => {
			console.log('Scheduled atlas visualization update after short delay');
			module.updateAtlasVisualization(state);
		}, 500);
	});
}

// Create debug panel
/**
 * Create or toggle a debug info panel
 * @param {Object} state - Global state object
 * @returns {HTMLElement} The panel container
 */
export function createDebugPanel(state) {
	console.log('Creating debug panel with state:', {
		modelObject: state.modelObject ? 'Available' : 'Missing',
		textureObject: state.textureObject ? 'Available' : 'Missing',
		modelLoaded: state.modelLoaded,
		textureLoaded: state.textureLoaded
	});

	// If panel already exists, just ensure it's visible
	if (debugPanelContainer) {
		console.log('Debug panel already exists, ensuring visibility');
		debugPanelContainer.style.display = 'block';
		return debugPanelContainer;
	}

	// Create panel using the utility function
	const { container, contentContainer } = createMovablePanel({
		id: 'debug-panel',
		title: 'Asset Debug Info',
		position: { top: '20px', right: '20px' },
		width: '280px',
		startCollapsed: false
	});

	// Store for future reference
	debugPanelContainer = container;
	console.log('Debug panel container created');

	// Create model info section
	const modelInfoTitle = document.createElement('div');
	modelInfoTitle.textContent = 'Model Info:';
	modelInfoTitle.style.fontWeight = 'bold';
	modelInfoTitle.style.marginBottom = '5px';
	contentContainer.appendChild(modelInfoTitle);

	const modelInfo = document.createElement('div');
	modelInfo.id = 'model-info';
	modelInfo.style.marginBottom = '15px';
	modelInfo.style.paddingLeft = '10px';
	// Default info
	modelInfo.textContent = 'No model loaded';
	contentContainer.appendChild(modelInfo);

	// Create texture info section
	const textureInfoTitle = document.createElement('div');
	textureInfoTitle.textContent = 'Texture Info:';
	textureInfoTitle.style.fontWeight = 'bold';
	textureInfoTitle.style.marginBottom = '5px';
	contentContainer.appendChild(textureInfoTitle);

	const textureInfo = document.createElement('div');
	textureInfo.id = 'texture-info';
	textureInfo.style.marginBottom = '15px';
	textureInfo.style.paddingLeft = '10px';
	// Default info
	textureInfo.textContent = 'No texture loaded';
	contentContainer.appendChild(textureInfo);

	// Create mesh visibility section
	const meshVisibilityTitle = document.createElement('div');
	meshVisibilityTitle.textContent = 'Mesh Visibility:';
	meshVisibilityTitle.style.fontWeight = 'bold';
	meshVisibilityTitle.style.marginBottom = '5px';
	contentContainer.appendChild(meshVisibilityTitle);

	const meshVisibilityDesc = document.createElement('div');
	meshVisibilityDesc.textContent = 'Toggle visibility of individual meshes or entire groups';
	meshVisibilityDesc.style.fontSize = '10px';
	meshVisibilityDesc.style.marginBottom = '10px';
	meshVisibilityDesc.style.paddingLeft = '10px';
	contentContainer.appendChild(meshVisibilityDesc);

	// Mesh toggles container
	const meshTogglesContainer = document.createElement('div');
	meshTogglesContainer.id = 'mesh-toggles';
	meshTogglesContainer.style.marginBottom = '15px';
	contentContainer.appendChild(meshTogglesContainer);

	// Add to document
	document.body.appendChild(container);
	container.style.display = 'block';
	console.log('Debug panel added to document and set to visible');

	// Helper functions for updating panel content
	/**
	 * Update model info with new data
	 * @param {Object} info - Model information object
	 */
	function updateModelInfoImpl(info) {
		console.log('updateModelInfoImpl called with:', info);
		// First try to find the element by ID
		let modelInfo = document.getElementById('model-info');
		
		// If not found, try to find it by query selector within the debug panel
		if (!modelInfo && debugPanelContainer) {
			modelInfo = debugPanelContainer.querySelector('#model-info');
		}
		
		// If still not found, create it
		if (!modelInfo) {
			console.error('Model info element not found, creating one');
			modelInfo = document.createElement('div');
			modelInfo.id = 'model-info';
			modelInfo.style.marginBottom = '15px';
			modelInfo.style.paddingLeft = '10px';
			
			// Try to append to panel if it exists
			if (debugPanelContainer && debugPanelContainer.querySelector('.panel-content')) {
				const content = debugPanelContainer.querySelector('.panel-content');
				if (content.firstChild) {
					content.insertBefore(modelInfo, content.firstChild.nextSibling);
				} else {
					content.appendChild(modelInfo);
				}
			} else {
				// Fallback to appending to document body
				document.body.appendChild(modelInfo);
			}
		}
		
		// Update content
		if (info) {
			let content = '';
			content += `<strong>Name:</strong> ${info.name || 'Unknown'}<br>`;
			content += `<strong>Size:</strong> ${formatBytes(info.size || 0)}<br>`;
			// Add UV map availability with more prominence
			if (info.uvSets && info.uvSets.length > 0) {
				content += `<span style="color: #3498db; font-weight: bold;">UV Maps: ${info.uvSets.join(', ')}</span><br>`;
				console.log('UV Sets detected:', info.uvSets);
			} else {
				content += `<span style="color: #e74c3c;">No UV maps detected</span><br>`;
			}
			// If we have mesh info, create mesh toggles
			if (info.meshes && info.meshes.length > 0) {
				content += `<br><strong>Meshes:</strong> ${info.meshes.length}<br>`;
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
	 * Update texture info with new data
	 *
	 */
	function updateTextureInfoImpl(info) {
		console.log('updateTextureInfoImpl called with:', info);
		// First try to find the element by ID
		let textureInfo = document.getElementById('texture-info');
		
		// If not found, try to find it by query selector within the debug panel
		if (!textureInfo && debugPanelContainer) {
			textureInfo = debugPanelContainer.querySelector('#texture-info');
		}
		
		// If still not found, create it
		if (!textureInfo) {
			console.error('Texture info element not found, creating one');
			textureInfo = document.createElement('div');
			textureInfo.id = 'texture-info';
			textureInfo.style.marginBottom = '15px';
			textureInfo.style.paddingLeft = '10px';
			
			// Try to append to panel if it exists
			if (debugPanelContainer && debugPanelContainer.querySelector('#model-info')) {
				const modelInfo = debugPanelContainer.querySelector('#model-info');
				debugPanelContainer.insertBefore(textureInfo, modelInfo.nextSibling);
			} else if (debugPanelContainer) {
				debugPanelContainer.appendChild(textureInfo);
			} else {
				// Fallback to appending to document body
				document.body.appendChild(textureInfo);
			}
		}
		
		// If passed a state object instead of direct texture info
		if (info && info.textureFile) {
			const file = info.textureFile;
			let content = '';
			content += `<strong>Name:</strong> ${file.name || 'Unknown'}<br>`;
			content += `<strong>Size:</strong> ${formatBytes(file.size || 0)}<br>`;
			if (info.textureObject && info.textureObject.image) {
				content += `<strong>Dimensions:</strong> ${info.textureObject.image.width} x ${info.textureObject.image.height}<br>`;
			}
			textureInfo.innerHTML = content;
		} else if (info) {
			// Direct texture info object
			let content = '';
			content += `<strong>Name:</strong> ${info.name || 'Unknown'}<br>`;
			content += `<strong>Size:</strong> ${formatBytes(info.size || 0)}<br>`;
			if (info.dimensions) {
				content += `<strong>Dimensions:</strong> ${info.dimensions.width} x ${info.dimensions.height}<br>`;
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
	
	console.log('Debug panel created and functions exported to state');
	
	return debugPanelContainer;
}

// Helper function to get meshes from a model for model info updates
/**
 *
 */
function getMeshesFromModel(model) {
	const meshes = [];
	if (model) {
		model.traverse((child) => {
			if (child.isMesh) {
				meshes.push(child);
			}
		});
	}
	return meshes;
}

// Helper function to analyze UV channels for switching
/**
 *
 */
export function analyzeUvChannels(state) {
	if (!state.modelObject) {
		console.log('Cannot analyze UV channels: Model not loaded');
		return;
	}
	
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
					
					// Store sample UVs for any mesh if we don't have a sample yet
					if (!info.sampleUVs) {
						info.sampleUVs = child.geometry.attributes[attrName].array;
						info.sampleMesh = child;
					}
					
					// Still identify screen meshes for statistics
					const isScreenMesh = child.name.toLowerCase().includes('screen') || 
										 child.name.toLowerCase().includes('display') || 
										 child.name.toLowerCase().includes('monitor');
					
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
	state.availableUvSets = [];
	state.uvSetNames = [];
	
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
		
		// Store mapping info for use in UV panel
		if (!state.uvMappingInfo) {
			state.uvMappingInfo = {};
		}
		state.uvMappingInfo[channelName] = {
			mappingType,
			textureUsage,
			minU: info.minU,
			maxU: info.maxU,
			minV: info.minV,
			maxV: info.maxV,
			meshes: info.meshes,
			sampleUVs: info.sampleUVs,
			sampleMesh: info.sampleMesh
		};
	});
	
	console.log('Available UV sets:', state.availableUvSets);
	console.log('UV set display names:', state.uvSetNames);
	
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
	
	// Update the panels with the new data
	updateUvChannelPanel(state);
}