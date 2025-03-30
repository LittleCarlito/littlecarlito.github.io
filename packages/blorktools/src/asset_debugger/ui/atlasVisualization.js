// Atlas Visualization module
// Creates a minimap/visualization of the texture atlas with UV coordinates
import * as THREE from 'three';
import { createMovablePanel, createButton, createLabel } from '../utils/uiComponents.js';

// Keep track of created atlas visualization container
let atlasVisualizationContainer = null;
// Keep track of 3D visualization object (for cleanup)
let atlasVisualization3D = null;
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
		if (state.textureObject) {
			updateCanvasWithTexture(state.textureObject, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
		}
		return;
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
	
	// Draw the texture onto the canvas if available, otherwise show a "no data" message
	if (state.textureObject) {
		updateCanvasWithTexture(state.textureObject, { min: [0, 0], max: [1, 1] });
	} else {
		showNoTextureState(atlasCanvas);
	}
	
	console.log('Atlas visualization created with HTML canvas');
	
	return container;
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
	ctx.fillText('Drop and drop a texture to view', canvas.width / 2, canvas.height / 2 + 15);
	
	// Update the coordinates text if it exists
	if (atlasVisualizationContainer) {
		const coordsText = atlasVisualizationContainer.querySelector('.coords-text');
		if (coordsText) {
			coordsText.textContent = 'No texture loaded. Drag and drop a texture file to view.';
		}
	}
}

/**
 * Update the atlas visualization with new texture
 * @param {Object} state - Global state object
 */
export function updateAtlasVisualization(state) {
	console.log('updateAtlasVisualization called with state:', {
		textureObject: state.textureObject ? 'Texture loaded' : 'No texture',
		modelObject: state.modelObject ? 'Model loaded' : 'No model',
		textureLoaded: state.textureLoaded,
		modelLoaded: state.modelLoaded
	});
	
	if (!atlasVisualizationContainer) {
		console.log('No atlas visualization container exists - creating one');
		createAtlasVisualization(state);
		return;
	}
	
	// If no texture, show the "no data" state
	if (!state.textureObject) {
		console.log('No texture object available - showing no data state');
		const canvas = atlasVisualizationContainer.querySelector('canvas');
		if (canvas) {
			showNoTextureState(canvas);
		}
		return;
	}
	
	// Get the current UV region or use full texture as default
	const currentRegion = state.currentUvRegion || { min: [0, 0], max: [1, 1] };
	
	// NEW: Check if any mesh is using a specific atlas segment
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
	
	// If a segment is active, use that instead of the current region
	if (currentSegment) {
		currentRegion.min = [currentSegment.u, currentSegment.v];
		currentRegion.max = [currentSegment.u + currentSegment.w, currentSegment.v + currentSegment.h];
	}
	
	// Update the canvas with the texture and current UV region
	updateCanvasWithTexture(state.textureObject, currentRegion);
	
	// Make sure the visualization is visible
	if (atlasVisualizationContainer.style.display === 'none') {
		atlasVisualizationContainer.style.display = 'block';
	}
	
	// NEW: Update segment info in the visualization
	updateSegmentInfo(state, currentSegment);
	
	console.log('Atlas visualization updated with new texture');
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
		
		segmentInfo.textContent = `Atlas segment: ${currentIndex+1}/${totalSegments} - Offset: (${segment.u.toFixed(2)},${segment.v.toFixed(2)}), Size: ${segment.w.toFixed(2)}x${segment.h.toFixed(2)}`;
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
		coordsText.textContent = 'Currently using: Full texture (0,0) to (1,1)';
	} else {
		coordsText.textContent = `Currently using: (${currentRegion.min[0].toFixed(2)},${currentRegion.min[1].toFixed(2)}) to (${currentRegion.max[0].toFixed(2)},${currentRegion.max[1].toFixed(2)})`;
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
	if (!state.textureObject) return;
	// Store the current UV region in state
	state.currentUvRegion = { min, max };
	// Update the visualization if it exists
	if (atlasVisualizationContainer) {
		// Update the canvas with the new region
		updateCanvasWithTexture(state.textureObject, state.currentUvRegion);
		// Make sure the visualization is visible
		if (atlasVisualizationContainer.style.display === 'none') {
			atlasVisualizationContainer.style.display = 'block';
		}
	}
	console.log(`Updated current UV region to: (${min[0].toFixed(2)},${min[1].toFixed(2)}) - (${max[0].toFixed(2)},${max[1].toFixed(2)})`);
	return state.currentUvRegion;
} 