// Debug UI for displaying framerate and performance metrics
import { FLAGS } from './flags';
import { BackgroundLighting } from '../background/background_lighting';
import { BackgroundContainer } from '../background/background_container';

// FPS tracking variables
let frameCount = 0;
let lastTime = performance.now();
let currentFps = 0;

// Resolution throttling variables
let autoThrottleEnabled = true;
let manualResolutionScale = 1.0;
let currentResolutionScale = 1.0;
let lastThrottleCheck = 0;
const THROTTLE_CHECK_INTERVAL = 1000; // Check every 1 second
const DEFAULT_LOW_FPS_THRESHOLD = 35;  // Default threshold for reducing resolution
const DEFAULT_HIGH_FPS_THRESHOLD = 50; // Default threshold for increasing resolution
let LOW_FPS_THRESHOLD = DEFAULT_LOW_FPS_THRESHOLD;
let HIGH_FPS_THRESHOLD = DEFAULT_HIGH_FPS_THRESHOLD;
let throttleStabilityCounter = 0; // Counter to prevent rapid oscillations
let maxFpsLimit = 60; // Default max FPS limit

// FPS limiting variables
let lastFrameTime = 0;
let frameDelta = 0;

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
    
    // Add resolution scale display
    const resolutionDisplay = document.createElement('div');
    resolutionDisplay.id = 'resolution-scale-display';
    resolutionDisplay.textContent = 'Resolution Scale: 100%';
    resolutionDisplay.style.marginBottom = '8px';
    debugUI.appendChild(resolutionDisplay);
    
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
    
    // Add resolution control section title
    const resolutionTitle = document.createElement('div');
    resolutionTitle.textContent = 'Resolution Control';
    resolutionTitle.style.fontWeight = 'bold';
    resolutionTitle.style.marginBottom = '8px';
    debugUI.appendChild(resolutionTitle);
    
    // Add auto-throttle toggle
    addToggle(debugUI, 'AUTO_THROTTLE', 'Auto-Throttle', autoThrottleEnabled, (checked) => {
        autoThrottleEnabled = checked;
        
        // Enable/disable resolution dropdown based on auto-throttle state
        const resolutionDropdown = document.getElementById('resolution-dropdown');
        if (resolutionDropdown) {
            resolutionDropdown.disabled = checked;
            resolutionDropdown.style.opacity = checked ? '0.5' : '1';
            
            // If auto-throttle is turned back on, update dropdown to show current throttled value
            if (checked) {
                updateDropdownValue(currentResolutionScale);
            }
        }
        
        // Enable/disable FPS dropdown based on auto-throttle state
        const fpsDropdown = document.getElementById('max-fps-dropdown');
        if (fpsDropdown) {
            fpsDropdown.disabled = checked;
            fpsDropdown.style.opacity = checked ? '0.5' : '1';
            
            if (checked) {
                // Reset to default thresholds when auto-throttle is enabled
                LOW_FPS_THRESHOLD = DEFAULT_LOW_FPS_THRESHOLD;
                HIGH_FPS_THRESHOLD = DEFAULT_HIGH_FPS_THRESHOLD;
                
                // Reset max FPS target to 60 when auto-throttle is enabled
                maxFpsLimit = 60;
                
                // Update the dropdown to show 60 FPS
                for (let i = 0; i < fpsDropdown.options.length; i++) {
                    if (fpsDropdown.options[i].value === '60') {
                        fpsDropdown.selectedIndex = i;
                        break;
                    }
                }
                
                console.log(`Auto-throttle enabled: Using default thresholds (${LOW_FPS_THRESHOLD}/${HIGH_FPS_THRESHOLD})`);
            } else {
                // When auto-throttle is disabled, set thresholds based on selected max FPS
                maxFpsLimit = fpsDropdown.value === 'Infinity' ? Infinity : parseInt(fpsDropdown.value);
                LOW_FPS_THRESHOLD = Math.max(20, Math.floor(maxFpsLimit * 0.6));
                HIGH_FPS_THRESHOLD = Math.floor(maxFpsLimit * 0.8);
                console.log(`Auto-throttle disabled: Using manual FPS limit ${maxFpsLimit} (Thresholds: ${LOW_FPS_THRESHOLD}/${HIGH_FPS_THRESHOLD})`);
            }
        }
        
        // Update resolution display indicator
        const resolutionDisplay = document.getElementById('resolution-scale-display');
        if (resolutionDisplay) {
            const indicator = checked ? ' 🔄' : '';
            resolutionDisplay.textContent = `Resolution Scale: ${Math.round(currentResolutionScale * 100)}%${indicator}`;
        }
        
        console.log(`Auto-throttle ${checked ? 'enabled' : 'disabled'}`);
    });
    
    // Add resolution dropdown instead of slider
    const dropdownContainer = document.createElement('div');
    dropdownContainer.style.marginBottom = '10px';
    
    const dropdownLabel = document.createElement('div');
    dropdownLabel.textContent = 'Resolution Scale:';
    dropdownLabel.style.marginBottom = '5px';
    dropdownContainer.appendChild(dropdownLabel);
    
    const dropdown = document.createElement('select');
    dropdown.id = 'resolution-dropdown';
    dropdown.style.width = '100%';
    dropdown.style.padding = '5px';
    dropdown.style.backgroundColor = '#333';
    dropdown.style.color = 'white';
    dropdown.style.border = '1px solid #555';
    dropdown.style.borderRadius = '3px';
    dropdown.style.opacity = autoThrottleEnabled ? '0.5' : '1';
    dropdown.disabled = autoThrottleEnabled;
    
    // Add resolution options (25% to 150% in steps)
    const resolutionOptions = [
        { value: 0.25, label: '25%' },
        { value: 0.5, label: '50%' },
        { value: 0.75, label: '75%' },
        { value: 1.0, label: '100%' },
        { value: 1.25, label: '125%' },
        { value: 1.5, label: '150%' }
    ];
    
    resolutionOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        // Set the initial selected option
        if (Math.abs(option.value - manualResolutionScale) < 0.1) {
            optionElement.selected = true;
        }
        dropdown.appendChild(optionElement);
    });
    
    dropdown.addEventListener('change', function() {
        manualResolutionScale = parseFloat(this.value);
        if (!autoThrottleEnabled) {
            setResolutionScale(manualResolutionScale);
        }
        console.log(`Manual resolution scale set to ${manualResolutionScale.toFixed(2)}`);
    });
    
    dropdownContainer.appendChild(dropdown);
    debugUI.appendChild(dropdownContainer);
    
    // Add Max FPS dropdown
    const fpsDropdownContainer = document.createElement('div');
    fpsDropdownContainer.style.marginBottom = '10px';
    
    const fpsDropdownLabel = document.createElement('div');
    fpsDropdownLabel.textContent = 'Max FPS Target:';
    fpsDropdownLabel.style.marginBottom = '5px';
    fpsDropdownContainer.appendChild(fpsDropdownLabel);
    
    const fpsDropdown = document.createElement('select');
    fpsDropdown.id = 'max-fps-dropdown';
    fpsDropdown.style.width = '100%';
    fpsDropdown.style.padding = '5px';
    fpsDropdown.style.backgroundColor = '#333';
    fpsDropdown.style.color = 'white';
    fpsDropdown.style.border = '1px solid #555';
    fpsDropdown.style.borderRadius = '3px';
    fpsDropdown.style.opacity = autoThrottleEnabled ? '0.5' : '1';
    fpsDropdown.disabled = autoThrottleEnabled;
    
    // Add FPS options
    const fpsOptions = [
        { value: 30, label: '30 FPS (Low)' },
        { value: 45, label: '45 FPS (Medium)' },
        { value: 60, label: '60 FPS (High)' },
        { value: 90, label: '90 FPS (Very High)' },
        { value: 120, label: '120 FPS (Ultra)' },
        { value: Infinity, label: 'Unlimited' }
    ];
    
    fpsOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value === Infinity ? 'Infinity' : option.value;
        optionElement.textContent = option.label;
        // Set the initial selected option
        if (option.value === maxFpsLimit) {
            optionElement.selected = true;
        }
        fpsDropdown.appendChild(optionElement);
    });
    
    fpsDropdown.addEventListener('change', function() {
        maxFpsLimit = this.value === 'Infinity' ? Infinity : parseInt(this.value);
        if (!autoThrottleEnabled) {
            // When manually set, update the thresholds based on the max FPS
            if (maxFpsLimit === Infinity) {
                LOW_FPS_THRESHOLD = DEFAULT_LOW_FPS_THRESHOLD;
                HIGH_FPS_THRESHOLD = DEFAULT_HIGH_FPS_THRESHOLD;
                console.log(`Manual FPS limit set to Unlimited`);
            } else {
                LOW_FPS_THRESHOLD = Math.max(20, Math.floor(maxFpsLimit * 0.6));
                HIGH_FPS_THRESHOLD = Math.floor(maxFpsLimit * 0.8);
                console.log(`Manual FPS limit set to ${maxFpsLimit} (Thresholds: ${LOW_FPS_THRESHOLD}/${HIGH_FPS_THRESHOLD})`);
            }
        }
    });
    
    fpsDropdownContainer.appendChild(fpsDropdown);
    debugUI.appendChild(fpsDropdownContainer);
    
    // Add divider
    const divider2 = document.createElement('div');
    divider2.style.borderBottom = '1px solid #555';
    divider2.style.margin = '10px 0';
    debugUI.appendChild(divider2);
    
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
 * Sets the resolution scale for the renderer
 * @param {number} scale - The resolution scale (0.25 to 1.5)
 */
export function setResolutionScale(scale) {
    // Clamp scale between 0.25 and 1.5
    scale = Math.max(0.25, Math.min(1.5, scale));
    currentResolutionScale = scale;
    
    // Update renderer if available
    if (window.renderer) {
        window.renderer.setPixelRatio(window.devicePixelRatio * scale);
    }
    
    // Update display
    const resolutionDisplay = document.getElementById('resolution-scale-display');
    if (resolutionDisplay) {
        // Add indicator if auto-throttle is enabled
        const indicator = autoThrottleEnabled ? ' 🔄' : '';
        resolutionDisplay.textContent = `Resolution Scale: ${Math.round(scale * 100)}%${indicator}`;
        
        // Flash the display briefly when changed
        resolutionDisplay.style.transition = 'color 0.5s';
        resolutionDisplay.style.color = '#4CAF50'; // Green flash
        setTimeout(() => {
            resolutionDisplay.style.color = 'white';
        }, 500);
    }
    
    // Update dropdown value if it exists
    updateDropdownValue(scale);
    
    return scale;
}

/**
 * Updates the dropdown selection based on the current resolution scale
 * @param {number} scale - The current resolution scale
 */
function updateDropdownValue(scale) {
    const dropdown = document.getElementById('resolution-dropdown');
    if (!dropdown) return;
    
    // Find the closest option value to the current scale
    let closestOption = null;
    let minDifference = Infinity;
    
    Array.from(dropdown.options).forEach(option => {
        const optionValue = parseFloat(option.value);
        const difference = Math.abs(optionValue - scale);
        
        if (difference < minDifference) {
            minDifference = difference;
            closestOption = option;
        }
    });
    
    // Set the selected option
    if (closestOption) {
        dropdown.value = closestOption.value;
    }
}

/**
 * Adds a toggle switch for a debug flag
 * @param {HTMLElement} parent - The parent element to append to
 * @param {string} flagName - The name of the flag in FLAGS object
 * @param {string} label - The display label for the toggle
 * @param {boolean} initialState - Initial state of the toggle (optional)
 * @param {Function} onChange - Callback function when toggle changes (optional)
 */
function addToggle(parent, flagName, label, initialState, onChange) {
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
    
    // Use provided initial state or get from FLAGS
    const isChecked = initialState !== undefined ? initialState : (FLAGS[flagName] || false);
    checkbox.checked = isChecked;
    
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
    slider.style.backgroundColor = isChecked ? '#4CAF50' : '#ccc';
    slider.style.transition = '.4s';
    slider.style.borderRadius = '17px';
    
    // Create the circle on the slider
    const circle = document.createElement('span');
    circle.style.position = 'absolute';
    circle.style.height = '13px';
    circle.style.width = '13px';
    circle.style.left = isChecked ? '13px' : '2px';
    circle.style.bottom = '2px';
    circle.style.backgroundColor = 'white';
    circle.style.transition = '.4s';
    circle.style.borderRadius = '50%';
    slider.appendChild(circle);
    
    // Add event listener to toggle the flag
    checkbox.addEventListener('change', function() {
        const checked = this.checked;
        slider.style.backgroundColor = checked ? '#4CAF50' : '#ccc';
        circle.style.left = checked ? '13px' : '2px';
        
        // If flagName exists in FLAGS, update it
        if (flagName in FLAGS) {
            FLAGS[flagName] = checked;
            console.log(`${flagName} set to ${checked}`);
            
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
        }
        
        // Call onChange callback if provided
        if (onChange && typeof onChange === 'function') {
            onChange(checked);
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
    const now = performance.now();
    
    // FPS limiting logic when not using auto-throttle
    if (!autoThrottleEnabled && maxFpsLimit !== Infinity) {
        frameDelta = now - lastFrameTime;
        const frameInterval = 1000 / maxFpsLimit;
        
        // If we're rendering faster than our target FPS, delay the next frame
        if (frameDelta < frameInterval) {
            // Skip this frame to limit FPS
            requestAnimationFrame(updateFPS);
            return;
        }
    }
    
    // Update lastFrameTime for FPS limiting
    lastFrameTime = now;
    
    frameCount++;
    const elapsed = now - lastTime;
    
    if (elapsed >= 1000) {
        currentFps = Math.round((frameCount * 1000) / elapsed);
        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            // Show current FPS with target if not using auto-throttle
            const targetInfo = !autoThrottleEnabled ? 
                (maxFpsLimit === Infinity ? ' / Unlimited' : ` / ${maxFpsLimit}`) : '';
            fpsDisplay.textContent = `FPS: ${currentFps}${targetInfo}`;
            
            // Set color based on FPS
            if (currentFps < 30) {
                fpsDisplay.style.color = '#FF3B30'; // Red for low FPS
            } else if (currentFps < 50) {
                fpsDisplay.style.color = '#FF9500'; // Orange for medium FPS
            } else {
                fpsDisplay.style.color = '#32CD32'; // Green for high FPS
            }
        }
        
        // Check if we should adjust resolution based on performance
        if (autoThrottleEnabled && now - lastThrottleCheck > THROTTLE_CHECK_INTERVAL) {
            lastThrottleCheck = now;
            
            // Auto-throttle logic with stepped values and stability control
            const steps = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
            const currentIndex = steps.findIndex(step => step >= currentResolutionScale);
            
            if (currentFps < LOW_FPS_THRESHOLD && currentResolutionScale > 0.25) {
                // Reduce resolution immediately when FPS is too low
                const newScale = steps[Math.max(0, currentIndex - 1)];
                
                // Only update if it's actually a change
                if (newScale < currentResolutionScale) {
                    setResolutionScale(newScale);
                    console.log(`Auto-throttle: Reducing resolution to ${newScale.toFixed(2)} (${Math.round(newScale * 100)}%) - FPS: ${currentFps}`);
                    // Reset stability counter when we change resolution
                    throttleStabilityCounter = 0;
                }
            } else if (currentFps > HIGH_FPS_THRESHOLD && currentResolutionScale < 1.0) {
                // For increasing resolution, use stability counter to ensure sustained good performance
                throttleStabilityCounter++;
                
                // Only increase resolution if we've had good performance for at least 3 consecutive checks
                if (throttleStabilityCounter >= 3) {
                    const newScale = steps[Math.min(steps.length - 1, currentIndex + 1)];
                    
                    // Only update if it's actually a change
                    if (newScale > currentResolutionScale) {
                        setResolutionScale(newScale);
                        console.log(`Auto-throttle: Increasing resolution to ${newScale.toFixed(2)} (${Math.round(newScale * 100)}%) - FPS: ${currentFps}`);
                    }
                    // Reset stability counter after changing resolution
                    throttleStabilityCounter = 0;
                } else {
                    console.log(`Auto-throttle: Good performance detected (${throttleStabilityCounter}/3) - FPS: ${currentFps}`);
                }
            } else {
                // Reset stability counter if FPS is in the middle range
                throttleStabilityCounter = 0;
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

/**
 * Gets the current resolution scale
 * @returns {number} The current resolution scale
 */
export function getCurrentResolutionScale() {
    return currentResolutionScale;
}

/**
 * Checks if auto-throttling is enabled
 * @returns {boolean} Whether auto-throttling is enabled
 */
export function isAutoThrottleEnabled() {
    return autoThrottleEnabled;
} 