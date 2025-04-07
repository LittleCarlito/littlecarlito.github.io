// Atlas Visualization module
// Creates a minimap/visualization of the texture atlas with UV coordinates
import * as THREE from 'three';
import { createMovablePanel, createButton, createLabel } from '../utils/uiComponents.js';

// Keep track of created atlas visualization container
let atlasVisualizationContainer = null;
// Keep track of 3D visualization object (for cleanup)
let atlasVisualization3D = null;
// Track which texture type is currently being visualized
let currentTextureType = 'baseColor';

/**
 * Create or toggle a visualization of the texture atlas
 * @param {Object} state - Global state object
 */
export function createAtlasVisualization(state) {
	// Clean up any rogue visualization containers
	const existingContainers = document.querySelectorAll('#atlas-visualization');
	if (existingContainers.length > 1) {
		// Keep only the first one if multiple exist
		for (let i = 1; i < existingContainers.length; i++) {
			if (document.body.contains(existingContainers[i])) {
				document.body.removeChild(existingContainers[i]);
			}
		}
	}
	// If visualization already exists, ensure it's visible
	if (atlasVisualizationContainer) {
		if (atlasVisualizationContainer.style.display === 'none') {
			atlasVisualizationContainer.style.display = 'block';
		}
		// Update visualization with current texture state if available
		updateVisualizationWithState(state);
		return atlasVisualizationContainer;
	}

	// Create panel using the utility function - position at bottom left, not overlapping with UV Channel panel
	const { container, contentContainer } = createMovablePanel({
		id: 'atlas-visualization',
		title: 'Atlas Texture Visualization',
		position: { bottom: '20px', left: '20px' },
		width: '300px'
	});
	
	// Store the container for future reference
	atlasVisualizationContainer = container;

	// Create texture type selector
	const textureTypeSelectorContainer = document.createElement('div');
	textureTypeSelectorContainer.style.display = 'flex';
	textureTypeSelectorContainer.style.marginBottom = '10px';
	textureTypeSelectorContainer.style.justifyContent = 'center';
	
	// Create texture type buttons
	const textureTypes = [
		{ id: 'baseColor', label: 'Base Color', icon: '🎨' },
		{ id: 'orm', label: 'ORM', icon: '✨' },
		{ id: 'normal', label: 'Normal', icon: '🧩' }
	];
	
	textureTypes.forEach(type => {
		const button = document.createElement('button');
		button.textContent = `${type.icon} ${type.label}`;
		button.className = 'texture-type-button';
		button.dataset.textureType = type.id;
		button.style.flex = '1';
		button.style.margin = '0 2px';
		button.style.padding = '5px';
		button.style.backgroundColor = type.id === currentTextureType ? '#3498db' : '#2c3e50';
		button.style.border = 'none';
		button.style.borderRadius = '3px';
		button.style.color = 'white';
		button.style.cursor = 'pointer';
		button.style.fontSize = '11px';
		
		button.addEventListener('click', () => {
			// Update active button styling
			document.querySelectorAll('.texture-type-button').forEach(btn => {
				btn.style.backgroundColor = '#2c3e50';
			});
			button.style.backgroundColor = '#3498db';
			
			console.log(`Texture type button clicked: ${type.id}`);
			
			// Update current texture type
			currentTextureType = type.id;
			
			// Update visualization with the selected texture type
			updateVisualizationWithState(state);
		});
		
		textureTypeSelectorContainer.appendChild(button);
	});
	
	contentContainer.appendChild(textureTypeSelectorContainer);

	// Create canvas for atlas visualization
	const atlasCanvas = document.createElement('canvas');
	atlasCanvas.style.width = '100%';
	atlasCanvas.style.border = '1px solid #444';
	atlasCanvas.style.display = 'block';
	atlasCanvas.style.maxHeight = '400px'; // Limit maximum height
	atlasCanvas.width = 280;
	atlasCanvas.height = 280;
	
	// Add the canvas to the content container
	contentContainer.appendChild(atlasCanvas);
	
	// Create coordinates text element
	const coordsText = document.createElement('div');
	coordsText.className = 'coords-text';
	coordsText.style.marginTop = '5px';
	coordsText.style.fontSize = '10px';
	coordsText.style.color = '#aaa';
	coordsText.textContent = 'UV coordinates: Full texture is shown';
	contentContainer.appendChild(coordsText);
	
	// Add container to the document
	document.body.appendChild(container);
	
	// Update the visualization with the current state
	updateVisualizationWithState(state);
	
	console.log('Atlas visualization created with HTML canvas');
	
	return container;
}

/**
 * Update the visualization with the current state
 * @param {Object} state - Global state object 
 */
function updateVisualizationWithState(state) {
	console.log(`Updating visualization with texture type: ${currentTextureType}`);
	
	// For backward compatibility
	if (state.textureObject && !state.textureObjects) {
		state.textureObjects = {
			baseColor: state.textureObject
		};
	}
	
	// Get the current texture for the selected type
	const texture = state.textureObjects ? state.textureObjects[currentTextureType] : null;
	
	// Log available textures for debugging
	if (state.textureObjects) {
		console.log('Available textures:', Object.keys(state.textureObjects).join(', '));
	} else {
		console.log('No textures available in state');
	}
	
	// Log if the texture for current type is available
	if (texture) {
		console.log(`${currentTextureType} texture found, updating visualization`);
	} else {
		console.log(`No texture found for ${currentTextureType}`);
	}
	
	// Update the texture type buttons
	const buttons = document.querySelectorAll('.texture-type-button');
	buttons.forEach(btn => {
		const textureType = btn.dataset.textureType;
		
		// Set active state for current texture type
		btn.style.backgroundColor = textureType === currentTextureType ? '#3498db' : '#2c3e50';
		
		// Indicate which texture types have data available
		if (state.textureObjects && state.textureObjects[textureType]) {
			btn.style.opacity = '1.0';
			btn.style.fontWeight = 'bold';
		} else {
			btn.style.opacity = '0.7';
			btn.style.fontWeight = 'normal';
		}
	});
	
	// Check if any texture is available and switch to it
	if (!texture && state.textureObjects) {
		const availableTextures = Object.keys(state.textureObjects).filter(
			key => state.textureObjects[key] && state.textureObjects[key].image
		);
		
		console.log(`No texture for ${currentTextureType}, but found ${availableTextures.length} available textures`);
		
		if (availableTextures.length > 0) {
			// Prioritize baseColor if available
			let newTextureType = availableTextures.includes('baseColor') ? 'baseColor' : availableTextures[0];
			console.log(`Switching to available texture type: ${newTextureType}`);
			
			// Update current texture type
			currentTextureType = newTextureType;
			
			// Update buttons to reflect the new selection
			buttons.forEach(btn => {
				btn.style.backgroundColor = btn.dataset.textureType === currentTextureType ? '#3498db' : '#2c3e50';
			});
			
			// Get the new texture
			const newTexture = state.textureObjects[currentTextureType];
			if (newTexture && newTexture.image) {
				console.log(`Using ${currentTextureType} texture instead`);
				updateCanvasWithTexture(newTexture, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
				return;
			}
		}
	}
	
	// Determine which texture to show based on what's available
	if (!texture) {
		// If the selected texture isn't available, try to find an available one
		if (state.textureObjects) {
			const availableTypes = Object.keys(state.textureObjects);
			if (availableTypes.length > 0) {
				console.log(`Selected texture type ${currentTextureType} not available, switching to ${availableTypes[0]}`);
				currentTextureType = availableTypes[0];
				
				// Update button selection for the newly selected texture type
				buttons.forEach(btn => {
					btn.style.backgroundColor = btn.dataset.textureType === currentTextureType ? '#3498db' : '#2c3e50';
				});
				
				// Show the available texture
				const newTexture = state.textureObjects[currentTextureType];
				if (newTexture) {
					updateCanvasWithTexture(newTexture, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
					return;
				}
			}
		}
		
		// If no textures available, show no texture state
		console.log('No textures available for visualization, showing empty state');
		const canvas = atlasVisualizationContainer.querySelector('canvas');
		if (canvas) {
			showNoTextureState(canvas);
		}
	} else {
		// Show the selected texture
		console.log(`Displaying ${currentTextureType} texture in visualization`);
		updateCanvasWithTexture(texture, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
	}
}

/**
 * Show a "No texture loaded" message in the canvas
 * @param {HTMLCanvasElement} canvas - The canvas to draw on
 */
function showNoTextureState(canvas) {
	const ctx = canvas.getContext('2d');
	
	// Clear canvas with dark background
	ctx.fillStyle = '#1a1a1a';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	// Draw a border
	ctx.strokeStyle = '#444';
	ctx.lineWidth = 2;
	ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
	
	// Draw "No texture loaded" text
	ctx.fillStyle = '#aaa';
	ctx.font = '14px monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('No texture loaded', canvas.width / 2, canvas.height / 2 - 15);
	
	// Add additional help text
	ctx.font = '12px monospace';
	ctx.fillText('Drag and drop a texture to view', canvas.width / 2, canvas.height / 2 + 15);
	
	// Update the coordinates text if it exists
	if (atlasVisualizationContainer) {
		const coordsText = atlasVisualizationContainer.querySelector('.coords-text');
		if (coordsText) {
			coordsText.textContent = `No ${currentTextureType} texture loaded. Drag and drop a texture file to view.`;
		}
	}
}

/**
 * Update the atlas visualization with new texture
 * @param {Object} state - Global state object
 */
export function updateAtlasVisualization(state) {
	console.log('updateAtlasVisualization called with state:', {
		textureObjects: state.textureObjects ? Object.keys(state.textureObjects).join(', ') : 'None',
		textureObject: state.textureObject ? 'Texture loaded' : 'No texture',
		modelObject: state.modelObject ? 'Model loaded' : 'No model',
		textureLoaded: state.textureLoaded,
		modelLoaded: state.modelLoaded
	});
	
	// Force immediate update if no container exists
	if (!atlasVisualizationContainer) {
		console.log('No atlas visualization container exists - creating one');
		createAtlasVisualization(state);
		// Force immediate update after creation if textures are available
		if (atlasVisualizationContainer) {
			// Check if textures are available right after creation
			if ((state.textureObjects && Object.keys(state.textureObjects).length > 0) || state.textureObject) {
				console.log('Textures available after creation - forcing immediate update');
				// For backward compatibility
				if (state.textureObject && !state.textureObjects) {
					state.textureObjects = {
						baseColor: state.textureObject
					};
				}
				
				// Find available texture
				const availableTextureTypes = Object.keys(state.textureObjects);
				if (availableTextureTypes.includes('baseColor')) {
					currentTextureType = 'baseColor';
				} else if (availableTextureTypes.length > 0) {
					currentTextureType = availableTextureTypes[0];
				}
				
				// Force update with available texture
				const texture = state.textureObjects[currentTextureType];
				if (texture && texture.image) {
					console.log(`Forcing display of ${currentTextureType} texture after container creation`);
					updateCanvasWithTexture(texture, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
				}
			}
		}
		return;
	}
	
	// Ensure the container is visible
	atlasVisualizationContainer.style.display = 'block';
	
	// CRITICAL: Check if we need to force-update because canvas shows "No texture loaded" despite having textures
	const forceUpdateNeeded = shouldForceTextureUpdate(state);
	if (forceUpdateNeeded) {
		console.log('Force update needed - empty canvas detected despite having textures');
		
		// Find the first available texture
		let textureToShow = null;
		let textureType = null;
		
		// Backward compatibility
		if (state.textureObject && state.textureObject.image) {
			textureToShow = state.textureObject;
			textureType = 'baseColor';
		} 
		// Check texture objects
		else if (state.textureObjects) {
			const types = Object.keys(state.textureObjects);
			// Prioritize baseColor
			if (types.includes('baseColor') && state.textureObjects.baseColor && state.textureObjects.baseColor.image) {
				textureToShow = state.textureObjects.baseColor;
				textureType = 'baseColor';
			} 
			// Otherwise use first available
			else {
				for (const type of types) {
					if (state.textureObjects[type] && state.textureObjects[type].image) {
						textureToShow = state.textureObjects[type];
						textureType = type;
						break;
					}
				}
			}
		}
		
		// Force update with available texture
		if (textureToShow && textureToShow.image) {
			console.log(`Force updating atlas with ${textureType} texture`);
			currentTextureType = textureType;
			
			// Update buttons to reflect current texture
			const buttons = document.querySelectorAll('.texture-type-button');
			buttons.forEach(btn => {
				btn.style.backgroundColor = btn.dataset.textureType === currentTextureType ? '#3498db' : '#2c3e50';
			});
			
			// Force update canvas
			updateCanvasWithTexture(textureToShow, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
			return;
		}
	}
	
	// Update the visualization with the current state
	updateVisualizationWithState(state);
	
	// Make sure the visualization is visible
	if (atlasVisualizationContainer.style.display === 'none') {
		atlasVisualizationContainer.style.display = 'block';
	}
	
	// Get current segment for the current texture type
	const currentSegment = getCurrentSegment(state);
	
	// Update segment info in the visualization
	updateSegmentInfo(state, currentSegment);
	
	console.log('Atlas visualization updated with texture type:', currentTextureType);
}

/**
 * Determines if we need to force a texture update
 * @param {Object} state - Global state object
 * @returns {boolean} - True if we need to force an update
 */
function shouldForceTextureUpdate(state) {
	// Skip if no container or no textures available
	if (!atlasVisualizationContainer) return false;
	
	// Check if we have any textures
	const hasTextures = (state.textureObject && state.textureObject.image) || 
		(state.textureObjects && Object.values(state.textureObjects).some(tex => tex && tex.image));
	
	if (!hasTextures) return false;
	
	// Check if canvas appears to be showing "No texture loaded"
	const canvas = atlasVisualizationContainer.querySelector('canvas');
	if (!canvas || !canvas.getContext) return false;
	
	try {
		// Check if canvas is mostly dark (indicating "No texture loaded" message)
		const ctx = canvas.getContext('2d');
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const pixelData = imageData.data;
		
		// Count dark pixels
		let darkPixelCount = 0;
		const totalPixels = pixelData.length / 4;
		
		// Sample pixels to determine if canvas is mostly dark
		for (let i = 0; i < pixelData.length; i += 16) { // Sample every 4th pixel for efficiency
			if (pixelData[i] < 50 && pixelData[i+1] < 50 && pixelData[i+2] < 50) {
				darkPixelCount++;
			}
		}
		
		// If more than 80% of sampled pixels are dark, it's likely showing "No texture loaded"
		const darkRatio = darkPixelCount / (totalPixels / 4);
		return darkRatio > 0.8;
	} catch (e) {
		console.error('Error checking canvas content:', e);
		return true; // Force update on error to be safe
	}
}

/**
 * Get the current segment for the selected texture type
 * @param {Object} state - Global state object
 * @returns {Object|null} - Current segment or null if none
 */
function getCurrentSegment(state) {
	// Check if any mesh is using a specific atlas segment
	let currentSegment = null;
	if (state.screenMeshes && state.screenMeshes.length > 0) {
		// Use the first mesh with a defined segment
		for (const mesh of state.screenMeshes) {
			if (mesh.userData.atlasSegments && mesh.userData.currentSegment !== undefined) {
				const segmentIndex = mesh.userData.currentSegment;
				currentSegment = mesh.userData.atlasSegments[segmentIndex];
				break;
			}
		}
	}
	return currentSegment;
}

/**
 * Update segment information in the visualization
 * @param {Object} state - Global state object
 * @param {Object} segment - Current segment information
 */
function updateSegmentInfo(state, segment) {
	if (!atlasVisualizationContainer) return;
	
	// Find or create segment info container
	let segmentInfo = atlasVisualizationContainer.querySelector('.segment-info');
	if (!segmentInfo) {
		segmentInfo = document.createElement('div');
		segmentInfo.className = 'segment-info';
		segmentInfo.style.fontSize = '10px';
		segmentInfo.style.color = '#aaa';
		segmentInfo.style.marginTop = '5px';
		
		// Add to container after coords text
		const coordsText = atlasVisualizationContainer.querySelector('.coords-text');
		if (coordsText) {
			coordsText.parentNode.insertBefore(segmentInfo, coordsText.nextSibling);
		} else {
			const contentContainer = atlasVisualizationContainer.querySelector('.panel-content');
			if (contentContainer) {
				contentContainer.appendChild(segmentInfo);
			}
		}
	}
	
	// Update segment info text
	if (segment) {
		const totalSegments = state.screenMeshes[0]?.userData.atlasSegments?.length || 0;
		const currentIndex = state.screenMeshes[0]?.userData.currentSegment || 0;
		
		segmentInfo.textContent = `${currentTextureType} atlas segment: ${currentIndex+1}/${totalSegments} - Offset: (${segment.u.toFixed(2)},${segment.v.toFixed(2)}), Size: ${segment.w.toFixed(2)}x${segment.h.toFixed(2)}`;
		segmentInfo.style.display = 'block';
	} else {
		segmentInfo.style.display = 'none';
	}
}

/**
 * Update the canvas with the texture
 * @param {THREE.Texture} texture - The texture to display
 * @param {Object} currentRegion - Current region displayed on the GLB model {min: [x,y], max: [x,y]}
 */
function updateCanvasWithTexture(texture, currentRegion = { min: [0, 0], max: [1, 1] }) {
	if (!atlasVisualizationContainer || !texture || !texture.image) return;
	// Find or create canvas in the content container
	let canvas = atlasVisualizationContainer.querySelector('canvas');
	if (!canvas) {
		canvas = document.createElement('canvas');
		canvas.style.width = '100%';
		canvas.style.border = '1px solid #444';
		canvas.style.display = 'block';
		canvas.style.maxHeight = '300px'; // Limit maximum height
		const contentContainer = atlasVisualizationContainer.querySelector('.panel-content');
		if (contentContainer) {
			contentContainer.appendChild(canvas);
		} else {
			atlasVisualizationContainer.appendChild(canvas);
		}
	}
	// Set canvas size to match texture, with reasonable limits
	const maxWidth = 280; // Max width within container
	const maxHeight = 280; // Max height to prevent overly tall visualizations
	const ratio = texture.image.height / texture.image.width;
	canvas.width = Math.min(texture.image.width, maxWidth);
	canvas.height = Math.min(canvas.width * ratio, maxHeight);
	// Draw texture to canvas
	const ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Draw the texture with proper scaling
	try {
		ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
	} catch (error) {
		console.error('Error drawing texture to canvas:', error);
	}
	// Add overlay grid for UV coordinates
	drawUvGrid(ctx, canvas.width, canvas.height);
	// Draw red highlight to show current region used on the model
	drawHighlightRegion(ctx, currentRegion, canvas.width, canvas.height);
	// Add coordinates text
	let coordsText = atlasVisualizationContainer.querySelector('.coords-text');
	if (!coordsText) {
		coordsText = document.createElement('div');
		coordsText.className = 'coords-text';
		coordsText.style.marginTop = '5px';
		coordsText.style.marginBottom = '0'; // Ensure no bottom margin
		coordsText.style.fontSize = '10px';
		coordsText.style.color = '#aaa';
		const contentContainer = atlasVisualizationContainer.querySelector('.panel-content');
		if (contentContainer) {
			contentContainer.appendChild(coordsText);
		} else {
			atlasVisualizationContainer.appendChild(coordsText);
		}
	}
	// Update coordinates text to show what's currently displayed on the model
	const isFullTexture = (currentRegion.min[0] === 0 && currentRegion.min[1] === 0 && 
                          currentRegion.max[0] === 1 && currentRegion.max[1] === 1);
	if (isFullTexture) {
		coordsText.textContent = `${currentTextureType}: Full texture (0,0) to (1,1)`;
	} else {
		coordsText.textContent = `${currentTextureType}: (${currentRegion.min[0].toFixed(2)},${currentRegion.min[1].toFixed(2)}) to (${currentRegion.max[0].toFixed(2)},${currentRegion.max[1].toFixed(2)})`;
	}
}

/**
 * Draw a UV coordinate grid on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawUvGrid(ctx, width, height) {
	// Draw grid lines
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;
	// Draw vertical grid lines
	for (let i = 1; i < 10; i++) {
		const x = width * i / 10;
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}
	// Draw horizontal grid lines
	for (let i = 1; i < 10; i++) {
		const y = height * i / 10;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}
	// Draw coordinate labels
	ctx.fillStyle = 'white';
	ctx.font = '10px monospace';
	// 0,0 at bottom left
	ctx.fillText('0,0', 2, height - 2);
	// 1,0 at bottom right
	ctx.fillText('1,0', width - 20, height - 2);
	// 0,1 at top left
	ctx.fillText('0,1', 2, 10);
	// 1,1 at top right
	ctx.fillText('1,1', width - 20, 10);
}

/**
 * Draw a highlight region on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} region - Region to highlight {min: [x,y], max: [x,y]}
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawHighlightRegion(ctx, region, width, height) {
	// Draw highlight box
	ctx.strokeStyle = 'red';
	ctx.lineWidth = 2;
	ctx.beginPath();
	// Calculate rect coordinates (remember Y needs to be flipped)
	const x = width * region.min[0];
	const y = height * (1 - region.max[1]); // Flip Y because canvas coordinates are top-down
	const w = width * (region.max[0] - region.min[0]);
	const h = height * (region.max[1] - region.min[1]);
	ctx.rect(x, y, w, h);
	ctx.stroke();
	// Add semi-transparent fill
	ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
	ctx.fill();
}

/**
 * Remove atlas visualization
 */
export function removeAtlasVisualization() {
	// Remove HTML container
	if (atlasVisualizationContainer) {
		if (document.body.contains(atlasVisualizationContainer)) {
			document.body.removeChild(atlasVisualizationContainer);
		}
		atlasVisualizationContainer = null;
	}
	// Clean up 3D visualization if it exists
	if (atlasVisualization3D) {
		if (atlasVisualization3D.parent) {
			atlasVisualization3D.parent.remove(atlasVisualization3D);
		}
		if (atlasVisualization3D.geometry) {
			atlasVisualization3D.geometry.dispose();
		}
		if (atlasVisualization3D.material) {
			atlasVisualization3D.material.dispose();
		}
		atlasVisualization3D = null;
	}
}

/**
 * Set the current UV region displayed on the model
 * @param {Array} min - Min coordinates [x, y] (0 to 1)
 * @param {Array} max - Max coordinates [x, y] (0 to 1)
 * @param {Object} state - Global state object
 */
export function setCurrentUvRegion(min, max, state) {
	// For backward compatibility
	if (state.textureObject && !state.textureObjects) {
		state.textureObjects = {
			baseColor: state.textureObject
		};
	}
	
	// Get current texture for selected type
	const texture = state.textureObjects ? state.textureObjects[currentTextureType] : null;
	
	if (!texture) return;
	
	// Store the current UV region in state
	state.currentUvRegion = { min, max };
	
	// Update the visualization if it exists
	if (atlasVisualizationContainer) {
		// Update the canvas with the new region
		updateCanvasWithTexture(texture, state.currentUvRegion);
		
		// Make sure the visualization is visible
		if (atlasVisualizationContainer.style.display === 'none') {
			atlasVisualizationContainer.style.display = 'block';
		}
	}
	
	console.log(`Updated current UV region for ${currentTextureType}: (${min[0].toFixed(2)},${min[1].toFixed(2)}) - (${max[0].toFixed(2)},${max[1].toFixed(2)})`);
	return state.currentUvRegion;
} 