// Debug UI for displaying framerate and performance metrics
import { FLAGS } from './flags';
import { BackgroundLighting } from '../background/background_lighting';
import { BackgroundContainer } from '../background/background_container';

// FPS tracking variables
let frameCount = 0;
let lastTime = performance.now();
let currentFps = 0;

// Reference to the background container
let backgroundContainer = null;

/**
 * Creates a debug UI that shows performance metrics
 */
export function createDebugUI() {
    // Check if debug UI already exists
    if (document.getElementById('debug-ui')) {
        return;
    }
    
    // Create debug UI container
    const debugUI = document.createElement('div');
    debugUI.id = 'debug-ui';
    debugUI.style.position = 'fixed';
    debugUI.style.top = '10px';
    debugUI.style.left = '10px';
    debugUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    debugUI.style.color = 'white';
    debugUI.style.padding = '15px';
    debugUI.style.borderRadius = '5px';
    debugUI.style.fontFamily = 'Arial, sans-serif';
    debugUI.style.fontSize = '14px';
    debugUI.style.zIndex = '1000';
    debugUI.style.display = FLAGS.DEBUG_UI ? 'block' : 'none';
    debugUI.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    debugUI.style.minWidth = '200px';
    
    // Add title
    const title = document.createElement('div');
    title.textContent = 'Performance Monitor';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.fontSize = '16px';
    title.style.borderBottom = '1px solid #555';
    title.style.paddingBottom = '5px';
    debugUI.appendChild(title);
    
    // Add FPS display
    const fpsDisplay = document.createElement('div');
    fpsDisplay.id = 'fps-display';
    fpsDisplay.textContent = 'FPS: --';
    fpsDisplay.style.fontWeight = 'bold';
    fpsDisplay.style.marginBottom = '8px';
    debugUI.appendChild(fpsDisplay);
    
    // Add draw calls info
    const drawCallsInfo = document.createElement('div');
    drawCallsInfo.id = 'draw-calls-info';
    drawCallsInfo.textContent = 'Draw calls: --';
    drawCallsInfo.style.marginBottom = '8px';
    debugUI.appendChild(drawCallsInfo);
    
    // Add triangles info
    const trianglesInfo = document.createElement('div');
    trianglesInfo.id = 'triangles-info';
    trianglesInfo.textContent = 'Triangles: --';
    trianglesInfo.style.marginBottom = '8px';
    debugUI.appendChild(trianglesInfo);
    
    // Add geometries info
    const geometriesInfo = document.createElement('div');
    geometriesInfo.id = 'geometries-info';
    geometriesInfo.textContent = 'Geometries: --';
    geometriesInfo.style.marginBottom = '8px';
    debugUI.appendChild(geometriesInfo);
    
    // Add textures info
    const texturesInfo = document.createElement('div');
    texturesInfo.id = 'textures-info';
    texturesInfo.textContent = 'Textures: --';
    texturesInfo.style.marginBottom = '8px';
    debugUI.appendChild(texturesInfo);
    
    // Add divider
    const divider = document.createElement('div');
    divider.style.borderBottom = '1px solid #555';
    divider.style.margin = '10px 0';
    debugUI.appendChild(divider);
    
    // Add debug toggles section title
    const togglesTitle = document.createElement('div');
    togglesTitle.textContent = 'Debug Toggles';
    togglesTitle.style.fontWeight = 'bold';
    togglesTitle.style.marginBottom = '8px';
    debugUI.appendChild(togglesTitle);
    
    // Add debug toggles
    addToggle(debugUI, 'SPOTLIGHT_VISUAL_DEBUG', 'Spotlight Debug');
    addToggle(debugUI, 'SIGN_VISUAL_DEBUG', 'Sign Debug');
    
    // Add keyboard shortcut info
    const shortcutInfo = document.createElement('div');
    shortcutInfo.textContent = 'Press S to toggle';
    shortcutInfo.style.fontSize = '12px';
    shortcutInfo.style.color = '#aaa';
    shortcutInfo.style.marginTop = '10px';
    debugUI.appendChild(shortcutInfo);
    
    // Add to document
    document.body.appendChild(debugUI);
    
    // Start FPS counter
    updateFPS();
    
    return debugUI;
}

/**
 * Sets the background container reference for debug UI
 * @param {BackgroundContainer} container - The background container instance
 */
export function setBackgroundContainer(container) {
    backgroundContainer = container;
}

/**
 * Adds a toggle switch for a debug flag
 * @param {HTMLElement} parent - The parent element to append to
 * @param {string} flagName - The name of the flag in FLAGS object
 * @param {string} label - The display label for the toggle
 */
function addToggle(parent, flagName, label) {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.justifyContent = 'space-between';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.marginBottom = '5px';
    
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = label;
    toggleContainer.appendChild(toggleLabel);
    
    const toggle = document.createElement('label');
    toggle.className = 'switch';
    toggle.style.position = 'relative';
    toggle.style.display = 'inline-block';
    toggle.style.width = '30px';
    toggle.style.height = '17px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = FLAGS[flagName];
    checkbox.style.opacity = '0';
    checkbox.style.width = '0';
    checkbox.style.height = '0';
    
    const slider = document.createElement('span');
    slider.className = 'slider';
    slider.style.position = 'absolute';
    slider.style.cursor = 'pointer';
    slider.style.top = '0';
    slider.style.left = '0';
    slider.style.right = '0';
    slider.style.bottom = '0';
    slider.style.backgroundColor = FLAGS[flagName] ? '#4CAF50' : '#ccc';
    slider.style.transition = '.4s';
    slider.style.borderRadius = '17px';
    
    // Create the circle on the slider
    const circle = document.createElement('span');
    circle.style.position = 'absolute';
    circle.style.height = '13px';
    circle.style.width = '13px';
    circle.style.left = FLAGS[flagName] ? '13px' : '2px';
    circle.style.bottom = '2px';
    circle.style.backgroundColor = 'white';
    circle.style.transition = '.4s';
    circle.style.borderRadius = '50%';
    slider.appendChild(circle);
    
    // Add event listener to toggle the flag
    checkbox.addEventListener('change', function() {
        FLAGS[flagName] = this.checked;
        slider.style.backgroundColor = this.checked ? '#4CAF50' : '#ccc';
        circle.style.left = this.checked ? '13px' : '2px';
        console.log(`${flagName} set to ${this.checked}`);
        
        // Call specific update functions based on the flag
        if (flagName === 'SPOTLIGHT_VISUAL_DEBUG') {
            const lighting = BackgroundLighting.getInstance();
            if (lighting) {
                lighting.updateDebugVisualizations();
            }
        } else if (flagName === 'SIGN_VISUAL_DEBUG') {
            if (backgroundContainer) {
                backgroundContainer.updateSignDebugVisualizations();
            }
        }
    });
    
    toggle.appendChild(checkbox);
    toggle.appendChild(slider);
    toggleContainer.appendChild(toggle);
    
    parent.appendChild(toggleContainer);
}

/**
 * Updates the FPS counter and other debug information
 */
function updateFPS() {
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastTime;
    
    if (elapsed >= 1000) {
        currentFps = Math.round((frameCount * 1000) / elapsed);
        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            fpsDisplay.textContent = `FPS: ${currentFps}`;
            
            // Set color based on FPS
            if (currentFps < 30) {
                fpsDisplay.style.color = '#FF3B30'; // Red for low FPS
            } else if (currentFps < 50) {
                fpsDisplay.style.color = '#FF9500'; // Orange for medium FPS
            } else {
                fpsDisplay.style.color = '#32CD32'; // Green for high FPS
            }
        }
        
        // Update renderer info if available
        if (window.renderer) {
            const info = window.renderer.info;
            
            // Update draw calls
            const drawCallsInfo = document.getElementById('draw-calls-info');
            if (drawCallsInfo && info.render) {
                drawCallsInfo.textContent = `Draw calls: ${info.render.calls || '--'}`;
            }
            
            // Update triangles count
            const trianglesInfo = document.getElementById('triangles-info');
            if (trianglesInfo && info.render) {
                trianglesInfo.textContent = `Triangles: ${info.render.triangles || '--'}`;
            }
            
            // Update geometries count
            const geometriesInfo = document.getElementById('geometries-info');
            if (geometriesInfo && info.memory) {
                geometriesInfo.textContent = `Geometries: ${info.memory.geometries || '--'}`;
            }
            
            // Update textures count
            const texturesInfo = document.getElementById('textures-info');
            if (texturesInfo && info.memory) {
                texturesInfo.textContent = `Textures: ${info.memory.textures || '--'}`;
            }
        }
        
        frameCount = 0;
        lastTime = now;
    }
    
    requestAnimationFrame(updateFPS);
}

/**
 * Toggles the visibility of the debug UI
 * @param {boolean} show - Whether to show or hide the UI
 * @returns {boolean} The new visibility state
 */
export function toggleDebugUI(show) {
    // If show parameter is not provided, toggle based on current state
    if (show === undefined) {
        FLAGS.DEBUG_UI = !FLAGS.DEBUG_UI;
    } else {
        FLAGS.DEBUG_UI = show;
    }
    
    // Find existing UI
    const existingUI = document.getElementById('debug-ui');
    
    if (FLAGS.DEBUG_UI) {
        // If UI should be shown but doesn't exist, create it
        if (!existingUI) {
            createDebugUI();
        } else {
            existingUI.style.display = 'block';
        }
    } else {
        // If UI should be hidden and exists, hide it
        if (existingUI) {
            existingUI.style.display = 'none';
        }
    }
    
    return FLAGS.DEBUG_UI;
}

/**
 * Gets the current FPS
 * @returns {number} The current FPS
 */
export function getCurrentFPS() {
    return currentFps;
} 