// Atlas Visualization module
// Creates a minimap/visualization of the texture atlas with UV coordinates

import * as THREE from 'three';

// Keep track of created atlas visualization container
let atlasVisualizationContainer = null;

// Keep track of 3D visualization object (for cleanup)
let atlasVisualization3D = null;

/**
 * Create or toggle a visualization of the texture atlas
 * @param {Object} state - Global state object
 */
export function createAtlasVisualization(state) {
	if (!state.textureObject) {
		console.warn('No texture loaded. Cannot create atlas visualization.');
		return;
	}
  
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
    
		// Update visualization with current texture state
		updateCanvasWithTexture(state.textureObject, state.currentUvRegion || { min: [0, 0], max: [1, 1] });
    
		return;
	}
  
	// Create container for the atlas visualization
	atlasVisualizationContainer = document.createElement('div');
	atlasVisualizationContainer.id = 'atlas-visualization';
	atlasVisualizationContainer.style.position = 'absolute';
	atlasVisualizationContainer.style.bottom = '20px';
	atlasVisualizationContainer.style.left = '20px'; 
	atlasVisualizationContainer.style.width = '300px';
	atlasVisualizationContainer.style.height = 'auto'; // Auto height based on content
	atlasVisualizationContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
	atlasVisualizationContainer.style.border = '1px solid #666';
	atlasVisualizationContainer.style.borderRadius = '5px';
	atlasVisualizationContainer.style.color = 'white';
	atlasVisualizationContainer.style.fontFamily = 'monospace';
	atlasVisualizationContainer.style.fontSize = '12px';
	atlasVisualizationContainer.style.zIndex = '1000';
	atlasVisualizationContainer.style.boxSizing = 'border-box';
	atlasVisualizationContainer.style.overflow = 'hidden'; // Prevent content overflow
  
	// Create header with title, collapse caret and close button
	const header = document.createElement('div');
	header.style.display = 'flex';
	header.style.justifyContent = 'space-between';
	header.style.alignItems = 'center';
	header.style.padding = '10px';
	header.style.cursor = 'move'; // Indicate draggable
	header.style.borderBottom = '1px solid #444';
  
	// Create left section with caret and title
	const leftSection = document.createElement('div');
	leftSection.style.display = 'flex';
	leftSection.style.alignItems = 'center';
  
	// Add collapse caret
	const caret = document.createElement('span');
	caret.textContent = '▼'; // Down arrow for expanded state
	caret.style.marginRight = '5px';
	caret.style.cursor = 'pointer';
	caret.style.fontSize = '10px';
	caret.style.color = '#aaa';
	caret.style.transition = 'transform 0.2s';
  
	// Content container (everything except the header)
	const contentContainer = document.createElement('div');
	contentContainer.className = 'atlas-content';
	contentContainer.style.padding = '10px';
	contentContainer.style.paddingTop = '5px';
	contentContainer.style.display = 'block'; // Start expanded
  
	// Add click event for collapsing/expanding
	caret.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		const isCollapsed = contentContainer.style.display === 'none';
    
		if (isCollapsed) {
			// Expand
			contentContainer.style.display = 'block';
			caret.textContent = '▼';
			// Add back the border at the bottom of the header
			header.style.borderBottom = '1px solid #444';
			// Transition to larger height
			atlasVisualizationContainer.style.transition = 'height 0.3s ease';
			atlasVisualizationContainer.style.height = 'auto';
      
			// Remove transition after animation completes
			setTimeout(() => {
				atlasVisualizationContainer.style.transition = '';
			}, 300);
		} else {
			// Before collapsing, get the header height to set as the new container height
			const headerHeight = header.offsetHeight;
      
			// Collapse
			contentContainer.style.display = 'none';
			caret.textContent = '►';
			// Remove the border at the bottom of the header when collapsed
			header.style.borderBottom = 'none';
			// Set the container height to just the header height
			atlasVisualizationContainer.style.transition = 'height 0.3s ease';
			atlasVisualizationContainer.style.height = `${headerHeight}px`;
      
			// Remove transition after animation completes
			setTimeout(() => {
				atlasVisualizationContainer.style.transition = '';
			}, 300);
		}
	});
  
	leftSection.appendChild(caret);
  
	// Add title
	const title = document.createElement('div');
	title.className = 'atlas-title';
	title.textContent = 'Atlas Texture Visualization';
	title.style.fontWeight = 'bold';
	leftSection.appendChild(title);
  
	header.appendChild(leftSection);
  
	// Add close button
	const closeButton = document.createElement('button');
	closeButton.textContent = '×';
	closeButton.style.background = 'none';
	closeButton.style.border = 'none';
	closeButton.style.color = 'white';
	closeButton.style.fontSize = '16px';
	closeButton.style.cursor = 'pointer';
	closeButton.style.padding = '0 5px';
  
	closeButton.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		atlasVisualizationContainer.style.display = 'none';
	});
  
	header.appendChild(closeButton);
	atlasVisualizationContainer.appendChild(header);
  
	// Add the content container
	atlasVisualizationContainer.appendChild(contentContainer);
  
	// Create canvas for atlas visualization
	const atlasCanvas = document.createElement('canvas');
	atlasCanvas.style.width = '100%';
	atlasCanvas.style.border = '1px solid #444';
	atlasCanvas.style.display = 'block';
	atlasCanvas.style.maxHeight = '400px'; // Limit maximum height
  
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
	document.body.appendChild(atlasVisualizationContainer);
  
	// Draw the texture onto the canvas - use full texture as default with no highlighting
	updateCanvasWithTexture(state.textureObject, { min: [0, 0], max: [1, 1] });
  
	console.log('Atlas visualization created with HTML canvas');
  
	// Make the container draggable with magnetism
	makeDraggableWithMagnetism(atlasVisualizationContainer);
  
	return atlasVisualizationContainer;
}

/**
 * Update the atlas visualization with new texture
 * @param {Object} state - Global state object
 */
export function updateAtlasVisualization(state) {
	if (!state.textureObject || !atlasVisualizationContainer) return;
  
	// Get the current UV region or use full texture as default
	const currentRegion = state.currentUvRegion || { min: [0, 0], max: [1, 1] };
  
	// Update the canvas with the texture and current UV region
	updateCanvasWithTexture(state.textureObject, currentRegion);
  
	// Make sure the visualization is visible
	if (atlasVisualizationContainer.style.display === 'none') {
		atlasVisualizationContainer.style.display = 'block';
	}
  
	console.log('Atlas visualization updated with new texture');
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
		const contentContainer = atlasVisualizationContainer.querySelector('.atlas-content');
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
		const contentContainer = atlasVisualizationContainer.querySelector('.atlas-content');
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
 * Make an element draggable
 * @param {HTMLElement} element - The element to make draggable
 */
function makeDraggable(element) {
	let isDragging = false;
	let offset = { x: 0, y: 0 };
  
	const header = element.querySelector('div:first-child');
	if (!header) return;
  
	header.style.cursor = 'move';
  
	// Mouse down handler
	header.addEventListener('mousedown', (e) => {
		isDragging = true;
		offset.x = e.clientX - element.offsetLeft;
		offset.y = e.clientY - element.offsetTop;
    
		// Add a class to indicate dragging
		element.style.opacity = '0.8';
	});
  
	// Mouse move handler
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
    
		const left = e.clientX - offset.x;
		const top = e.clientY - offset.y;
    
		// Keep within window bounds
		const maxLeft = window.innerWidth - element.offsetWidth;
		const maxTop = window.innerHeight - element.offsetHeight;
    
		element.style.left = Math.min(Math.max(0, left), maxLeft) + 'px';
		element.style.top = Math.min(Math.max(0, top), maxTop) + 'px';
	});
  
	// Mouse up handler
	document.addEventListener('mouseup', () => {
		if (isDragging) {
			isDragging = false;
			element.style.opacity = '1';
		}
	});
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

/**
 * Make an element draggable with magnetism
 * @param {HTMLElement} element - The element to make draggable with magnetism
 */
function makeDraggableWithMagnetism(element) {
	let isDragging = false;
	let offset = { x: 0, y: 0 };
  
	// Default position (bottom left)
	const defaultPosition = { left: 20, bottom: 20 };
	// Magnetism threshold in pixels (distance at which to snap back)
	const magnetThreshold = 50;
  
	const header = element.querySelector('div:first-child');
	if (!header) return;
  
	header.style.cursor = 'move';
  
	// Mouse down handler
	header.addEventListener('mousedown', (e) => {
		isDragging = true;
		offset.x = e.clientX - element.offsetLeft;
		offset.y = e.clientY - element.offsetTop;
    
		// Add a class to indicate dragging
		element.style.opacity = '0.8';
	});
  
	// Mouse move handler
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
    
		const left = e.clientX - offset.x;
		const top = e.clientY - offset.y;
    
		// Keep within window bounds
		const maxLeft = window.innerWidth - element.offsetWidth;
		const maxTop = window.innerHeight - element.offsetHeight;
    
		element.style.left = Math.min(Math.max(0, left), maxLeft) + 'px';
		element.style.top = Math.min(Math.max(0, top), maxTop) + 'px';
    
		// Ensure bottom position is cleared when dragging by top
		element.style.bottom = 'auto';
	});
  
	// Mouse up handler with magnetism
	document.addEventListener('mouseup', () => {
		if (!isDragging) return;
    
		isDragging = false;
		element.style.opacity = '1';
    
		// Get current position
		const rect = element.getBoundingClientRect();
		const left = rect.left;
		const bottom = window.innerHeight - rect.bottom;
    
		// Check if close to default position
		const isCloseToDefaultX = Math.abs(left - defaultPosition.left) < magnetThreshold;
		const isCloseToDefaultY = Math.abs(bottom - defaultPosition.bottom) < magnetThreshold;
    
		// Apply magnetism if close to default position on both axes
		if (isCloseToDefaultX && isCloseToDefaultY) {
			// Animate back to default position
			element.style.transition = 'left 0.3s ease, bottom 0.3s ease, top 0.3s ease';
			element.style.left = `${defaultPosition.left}px`;
			element.style.bottom = `${defaultPosition.bottom}px`;
			element.style.top = 'auto'; // Reset top position to use bottom
      
			// Reset the transition after animation
			setTimeout(() => {
				element.style.transition = '';
			}, 300);
		}
	});
} 