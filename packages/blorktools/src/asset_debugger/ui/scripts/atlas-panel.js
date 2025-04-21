/**
 * Texture Debugger - Atlas Panel Module
 * 
 * This module handles texture atlas visualization in the UI.
 */
import { getState, updateState } from "../../core/state.js";

/**
 * Initialize the atlas panel and set up event listeners
 */
export function initAtlasPanel() {
    console.log('Initializing Atlas Panel...');
    
    // Initialize the panel once the atlas-panel-container is found and has content
    const initCheck = setInterval(() => {
        const container = document.getElementById('atlas-panel-container');
        if (container && container.children.length > 0) {
            clearInterval(initCheck);
            console.log('Atlas Panel container found, setting up event listeners...');
            setupAtlasPanelEvents();
        }
    }, 100);
}

/**
 * Set up event listeners for the atlas panel
 */
function setupAtlasPanelEvents() {
    const textureTypeButtons = document.querySelectorAll('.texture-type-button');
    
    // Check if any button has the active class
    let hasActiveButton = false;
    textureTypeButtons.forEach(button => {
        if (button.classList.contains('active')) {
            hasActiveButton = true;
        }
    });
    
    // If no button is active, set the first one as active
    if (!hasActiveButton && textureTypeButtons.length > 0) {
        textureTypeButtons[0].classList.add('active');
        // Update state with the default texture type
        updateState('currentTextureType', textureTypeButtons[0].dataset.textureType);
    }
    
    // Set up texture type button handlers
    textureTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            textureTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update current texture type in state
            updateState('currentTextureType', button.dataset.textureType);
            
            // Update visualization
            updateAtlasVisualization();
        });
    });
    
    // Initialize visualization
    updateAtlasVisualization();
}

/**
 * Update the atlas visualization based on the selected texture type
 */
export function updateAtlasVisualization() {
    console.log('Updating atlas visualization...');
    const state = getState();
    
    // Get active texture type from UI
    const activeButton = document.querySelector('.texture-type-button.active');
    if (!activeButton) {
        console.error('No active texture type button found');
        return;
    }
    
    const selectedType = activeButton.getAttribute('data-texture-type');
    console.log('Selected texture type:', selectedType);
    
    // Get the texture based on selected type
    const texture = state.textureObjects[selectedType];
    
    // Get the atlas canvas
    const atlasCanvas = document.getElementById('atlas-canvas');
    if (!atlasCanvas) {
        console.error('Atlas canvas not found');
        return;
    }
    
    // Check if we have the selected texture
    if (!texture || !texture.image) {
        // Show the "No texture loaded" message
        showNoTextureState(atlasCanvas);
        return;
    }
    
    // Get 2D context and clear it
    const ctx = atlasCanvas.getContext('2d');
    
    // Set the canvas size to match the texture 
    atlasCanvas.width = texture.image.width;
    atlasCanvas.height = texture.image.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    
    // Draw the texture
    ctx.drawImage(texture.image, 0, 0);
    
    // Set proper CSS for the canvas to maintain aspect ratio and fit in container
    atlasCanvas.style.width = '100%';
    atlasCanvas.style.height = 'auto';
    atlasCanvas.style.maxHeight = '100%';
    atlasCanvas.style.objectFit = 'contain';
    atlasCanvas.style.display = 'block';
    
    console.log('Atlas visualization updated');
}

/**
 * Update the canvas with the texture
 * @param {THREE.Texture} texture - The texture to display
 * @param {Object} currentRegion - The UV region to highlight
 */
function updateCanvasWithTexture(texture, currentRegion = { min: [0, 0], max: [1, 1] }) {
    const atlasCanvas = document.getElementById('atlas-canvas');
    const coordsText = document.getElementById('coords-text');
    
    if (!atlasCanvas || !texture || !texture.image) return;
    
    const ctx = atlasCanvas.getContext('2d');
    
    // Set canvas dimensions to match texture
    atlasCanvas.width = texture.image.width;
    atlasCanvas.height = texture.image.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    
    // Draw the texture with proper scaling
    try {
        ctx.drawImage(texture.image, 0, 0);
    } catch (error) {
        console.error('Error drawing texture to canvas:', error);
    }
    
    // Add overlay grid for UV coordinates
    drawUvGrid(ctx, atlasCanvas.width, atlasCanvas.height);
    
    // Draw red highlight to show current region used on the model
    drawHighlightRegion(ctx, currentRegion, atlasCanvas.width, atlasCanvas.height);
    
    // Set proper CSS for the canvas
    atlasCanvas.style.width = '100%';
    atlasCanvas.style.height = 'auto';
    atlasCanvas.style.maxHeight = '100%';
    atlasCanvas.style.objectFit = 'contain';
    atlasCanvas.style.display = 'block';
    
    // Update coordinates text
    if (coordsText) {
        const isFullTexture = (currentRegion.min[0] === 0 && currentRegion.min[1] === 0 && 
                              currentRegion.max[0] === 1 && currentRegion.max[1] === 1);
                              
        if (isFullTexture) {
            coordsText.textContent = `${getState().currentTextureType}: Full texture (0,0) to (1,1)`;
        } else {
            coordsText.textContent = `${getState().currentTextureType}: (${currentRegion.min[0].toFixed(2)},${currentRegion.min[1].toFixed(2)}) to (${currentRegion.max[0].toFixed(2)},${currentRegion.max[1].toFixed(2)})`;
        }
    }
}

/**
 * Show "No texture loaded" message in the canvas
 * @param {HTMLCanvasElement} atlasCanvas - The canvas element
 */
function showNoTextureState(atlasCanvas) {
    const coordsText = document.getElementById('coords-text');
    if (!atlasCanvas) return;
    
    const ctx = atlasCanvas.getContext('2d');
    
    // Use a reasonable size for the empty state
    atlasCanvas.width = 260;
    atlasCanvas.height = 260;
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    
    // Draw a visible border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, atlasCanvas.width - 4, atlasCanvas.height - 4);
    
    // Add a subtle background to make text more readable
    ctx.fillStyle = 'rgba(40, 40, 40, 0.3)';
    ctx.fillRect(2, 2, atlasCanvas.width - 4, atlasCanvas.height - 4);
    
    // Draw "No Atlas Data" text
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No Atlas Data', atlasCanvas.width / 2, atlasCanvas.height / 2 - 15);
    
    // Add additional help text
    ctx.font = '12px monospace';
    ctx.fillText('Drag and drop a texture to view', atlasCanvas.width / 2, atlasCanvas.height / 2 + 15);
    
    // Set proper CSS for the canvas to maintain aspect ratio and fit in container
    atlasCanvas.style.width = '100%';
    atlasCanvas.style.height = 'auto';
    atlasCanvas.style.maxHeight = '100%';
    atlasCanvas.style.objectFit = 'contain';
    atlasCanvas.style.display = 'block';
    
    // Update the coordinates text
    if (coordsText) {
        coordsText.textContent = `No ${getState().currentTextureType} texture loaded. Drag and drop a texture file to view.`;
    }
}

/**
 * Draw a UV coordinate grid on the canvas
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} width - The canvas width
 * @param {number} height - The canvas height
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
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} region - The region to highlight {min: [x, y], max: [x, y]}
 * @param {number} width - The canvas width
 * @param {number} height - The canvas height
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
 * Update the current UV region in the state
 * @param {Array} min - [x, y] minimum UV coordinates
 * @param {Array} max - [x, y] maximum UV coordinates
 */
export function updateUvRegion(min, max) {
    const region = { min, max };
    updateState('currentUvRegion', region);
    updateAtlasVisualization();
}

export default {
    initAtlasPanel,
    updateAtlasVisualization,
    updateUvRegion
}; 