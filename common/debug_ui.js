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
const THROTTLE_CHECK_INTERVAL = 2000; // Check every 2 seconds (increased from 1 second)
const DEFAULT_LOW_FPS_THRESHOLD = 30;  // Lower threshold (was 35)
const DEFAULT_HIGH_FPS_THRESHOLD = 55; // Higher threshold (was 50)
let LOW_FPS_THRESHOLD = DEFAULT_LOW_FPS_THRESHOLD;
let HIGH_FPS_THRESHOLD = DEFAULT_HIGH_FPS_THRESHOLD;
let throttleStabilityCounter = 0;
// Add counters for both up and down transitions
let throttleUpStabilityCounter = 0;
let throttleDownStabilityCounter = 0;
// Required stability counts
const REQUIRED_STABILITY_COUNT_UP = 4;   // More stability required for upscaling (was 3)
const REQUIRED_STABILITY_COUNT_DOWN = 2; // Less stability required for downscaling
let maxFpsLimit = 60; // Default max FPS limit

// FPS limiting variables
let lastFrameTime = 0;
let frameDelta = 0;

// Reference to the background container
let backgroundContainer = null;

// Add a new variable for tracking when a resolution change is in progress
let resolutionChangeInProgress = false;

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
    
    // Add event listeners to prevent click-through to elements below
    debugUI.addEventListener('mousedown', e => e.stopPropagation());
    debugUI.addEventListener('click', e => e.stopPropagation());
    debugUI.addEventListener('dblclick', e => e.stopPropagation());
    debugUI.addEventListener('mouseup', e => e.stopPropagation());
    debugUI.addEventListener('wheel', e => e.stopPropagation());
    
    // Add title
    const title = document.createElement('div');
    title.textContent = 'Performance Monitor';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.fontSize = '16px';
    title.style.borderBottom = '1px solid #555';
    title.style.paddingBottom = '5px';
    debugUI.appendChild(title);
    
    // Add FPS display - always visible
    const fpsDisplay = document.createElement('div');
    fpsDisplay.id = 'fps-display';
    fpsDisplay.textContent = 'FPS: --';
    fpsDisplay.style.fontWeight = 'bold';
    fpsDisplay.style.marginBottom = '8px';
    debugUI.appendChild(fpsDisplay);
    
    // Create a container for detailed performance metrics (collapsible)
    const metricsContainer = document.createElement('div');
    metricsContainer.id = 'metrics-container';
    metricsContainer.style.overflow = 'hidden';
    metricsContainer.style.maxHeight = '0'; // Hidden by default
    metricsContainer.style.transition = 'max-height 0.3s ease-in-out';
    
    // Add resolution scale display
    const resolutionDisplay = document.createElement('div');
    resolutionDisplay.id = 'resolution-scale-display';
    resolutionDisplay.textContent = 'Resolution Scale: 100%';
    resolutionDisplay.style.marginBottom = '8px';
    metricsContainer.appendChild(resolutionDisplay);
    
    // Add draw calls info
    const drawCallsInfo = document.createElement('div');
    drawCallsInfo.id = 'draw-calls-info';
    drawCallsInfo.textContent = 'Draw calls: --';
    drawCallsInfo.style.marginBottom = '8px';
    metricsContainer.appendChild(drawCallsInfo);
    
    // Add triangles info
    const trianglesInfo = document.createElement('div');
    trianglesInfo.id = 'triangles-info';
    trianglesInfo.textContent = 'Triangles: --';
    trianglesInfo.style.marginBottom = '8px';
    metricsContainer.appendChild(trianglesInfo);
    
    // Add geometries info
    const geometriesInfo = document.createElement('div');
    geometriesInfo.id = 'geometries-info';
    geometriesInfo.textContent = 'Geometries: --';
    geometriesInfo.style.marginBottom = '8px';
    metricsContainer.appendChild(geometriesInfo);
    
    // Add textures info
    const texturesInfo = document.createElement('div');
    texturesInfo.id = 'textures-info';
    texturesInfo.textContent = 'Textures: --';
    texturesInfo.style.marginBottom = '8px';
    metricsContainer.appendChild(texturesInfo);
    
    // Add the metrics container to the debug UI
    debugUI.appendChild(metricsContainer);
    
    // Add a subtle toggle for metrics (small dots)
    const metricsToggle = document.createElement('div');
    metricsToggle.style.textAlign = 'center';
    metricsToggle.style.margin = '0 0 10px 0';
    metricsToggle.style.cursor = 'pointer';
    metricsToggle.style.fontSize = '10px';
    metricsToggle.style.color = '#777';
    metricsToggle.innerHTML = '•••';
    metricsToggle.title = 'Toggle performance details';
    
    // Add hover effect for metrics toggle
    metricsToggle.addEventListener('mouseenter', function() {
        this.style.color = '#aaa';
    });
    
    metricsToggle.addEventListener('mouseleave', function() {
        this.style.color = '#777';
    });
    
    // Add click event to toggle metrics visibility
    let isMetricsVisible = false;
    metricsToggle.addEventListener('click', function() {
        isMetricsVisible = !isMetricsVisible;
        metricsContainer.style.maxHeight = isMetricsVisible ? '300px' : '0';
        this.innerHTML = isMetricsVisible ? '•••' : '•••';
    });
    
    debugUI.appendChild(metricsToggle);
    
    // Add divider
    const divider = document.createElement('div');
    divider.style.borderBottom = '1px solid #555';
    divider.style.margin = '0 0 10px 0';
    debugUI.appendChild(divider);
    
    // Add physics control section title
    const physicsTitle = document.createElement('div');
    physicsTitle.textContent = 'Physics Control';
    physicsTitle.style.fontWeight = 'bold';
    physicsTitle.style.marginBottom = '8px';
    debugUI.appendChild(physicsTitle);
    
    // Add pause/play physics button
    const pauseButton = document.createElement('button');
    pauseButton.id = 'physics-pause-button';
    
    // Create a container for the icon
    const iconSpan = document.createElement('span');
    iconSpan.style.display = 'inline-block';
    iconSpan.style.width = '18px';
    iconSpan.style.height = '12px';
    iconSpan.style.position = 'relative';
    iconSpan.style.marginRight = '5px';
    iconSpan.style.top = '1px';
    
    // Create play icon (single triangle)
    const playIcon = document.createElement('span');
    playIcon.style.display = 'none'; // Initially hidden
    playIcon.style.width = '0';
    playIcon.style.height = '0';
    playIcon.style.borderTop = '6px solid transparent';
    playIcon.style.borderBottom = '6px solid transparent';
    playIcon.style.borderLeft = '12px solid white';
    playIcon.style.position = 'absolute';
    playIcon.style.left = '3px';
    playIcon.style.top = '0';
    
    // Create pause icon (two bars)
    const pauseIcon = document.createElement('span');
    pauseIcon.style.display = 'inline-block'; // Initially shown
    pauseIcon.style.position = 'absolute';
    pauseIcon.style.width = '100%';
    pauseIcon.style.height = '100%';
    pauseIcon.style.left = '0';
    
    // First bar
    const bar1 = document.createElement('span');
    bar1.style.display = 'inline-block';
    bar1.style.width = '4px';
    bar1.style.height = '12px';
    bar1.style.backgroundColor = 'white';
    bar1.style.position = 'absolute';
    bar1.style.left = '3px';
    
    // Second bar
    const bar2 = document.createElement('span');
    bar2.style.display = 'inline-block';
    bar2.style.width = '4px';
    bar2.style.height = '12px';
    bar2.style.backgroundColor = 'white';
    bar2.style.position = 'absolute';
    bar2.style.right = '3px';
    
    // Assemble icons
    pauseIcon.appendChild(bar1);
    pauseIcon.appendChild(bar2);
    iconSpan.appendChild(pauseIcon);
    iconSpan.appendChild(playIcon);
    
    // Create text span
    const textSpan = document.createElement('span');
    textSpan.textContent = 'Pause Physics';
    
    // Add both to button
    pauseButton.appendChild(iconSpan);
    pauseButton.appendChild(textSpan);
    
    pauseButton.style.width = '100%';
    pauseButton.style.padding = '6px';
    pauseButton.style.backgroundColor = '#4CAF50'; // Green when physics is active
    pauseButton.style.border = 'none';
    pauseButton.style.borderRadius = '3px';
    pauseButton.style.color = 'white';
    pauseButton.style.cursor = 'pointer';
    pauseButton.style.marginBottom = '10px';
    pauseButton.style.fontWeight = 'bold';
    pauseButton.style.transition = 'all 0.2s';
    pauseButton.style.textAlign = 'center';
    
    // Add hover effect
    pauseButton.addEventListener('mouseenter', function() {
        this.style.opacity = '0.9';
    });
    
    pauseButton.addEventListener('mouseleave', function() {
        this.style.opacity = '1';
    });
    
    // Add click event to toggle physics
    pauseButton.addEventListener('click', function() {
        if (window.togglePhysicsPause) {
            const isPaused = window.togglePhysicsPause();
            // The togglePhysicsPause function now handles rebuilding the button
        }
    });
    
    debugUI.appendChild(pauseButton);
    
    // Add another divider
    const divider2 = document.createElement('div');
    divider2.style.borderBottom = '1px solid #555';
    divider2.style.margin = '0 0 10px 0';
    debugUI.appendChild(divider2);
    
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
    const divider3 = document.createElement('div');
    divider3.style.borderBottom = '1px solid #555';
    divider3.style.margin = '10px 0';
    debugUI.appendChild(divider3);
    
    // Create a container for the debug toggles section (keep this visible)
    const debugTogglesTitle = document.createElement('div');
    debugTogglesTitle.textContent = 'Debug Toggles';
    debugTogglesTitle.style.fontWeight = 'bold';
    debugTogglesTitle.style.marginBottom = '8px';
    debugUI.appendChild(debugTogglesTitle);
    
    // Add debug toggles (these remain visible)
    addToggle(debugUI, 'COLLISION_VISUAL_DEBUG', 'Collision Debug', FLAGS.COLLISION_VISUAL_DEBUG, (checked) => {
        // Update flags
        FLAGS.COLLISION_VISUAL_DEBUG = checked;
        
        // Also update SIGN_VISUAL_DEBUG to match COLLISION_VISUAL_DEBUG
        FLAGS.SIGN_VISUAL_DEBUG = checked;
        
        // Update sign debug visualizations
        if (window.background_container) {
            background_container.updateSignDebugVisualizations();
        }
        
        // Update collision debug in the asset spawner if available
        if (window.asset_spawner) {
            console.log(`Setting collision debug to ${checked}`);
            asset_spawner.setCollisionDebug(checked);
        }
        
        // Update label wireframes
        updateLabelWireframes();
        
        // Log the change for debugging
        console.log(`Collision and Sign debug visualization ${checked ? 'enabled' : 'disabled'}`);
        console.log(`All collision wireframes will be ${checked ? 'shown' : 'hidden'}`);
    });
    
    addToggle(debugUI, 'SPOTLIGHT_VISUAL_DEBUG', 'Spotlight Debug');
    
    // Add divider
    const divider4 = document.createElement('div');
    divider4.style.borderBottom = '1px solid #555';
    divider4.style.margin = '10px 0';
    debugUI.appendChild(divider4);
    
    // Create a container for the log flags section
    const logFlagsContainer = document.createElement('div');
    logFlagsContainer.id = 'log-flags-container';
    logFlagsContainer.style.overflow = 'hidden';
    logFlagsContainer.style.maxHeight = '0';
    logFlagsContainer.style.transition = 'max-height 0.3s ease-in-out';
    logFlagsContainer.style.marginTop = '5px';
    
    // Add log flags section title
    const logFlagsTitle = document.createElement('div');
    logFlagsTitle.textContent = 'Log Flags';
    logFlagsTitle.style.fontWeight = 'bold';
    logFlagsTitle.style.marginBottom = '8px';
    logFlagsContainer.appendChild(logFlagsTitle);
    
    // Add log flags toggles
    addToggle(logFlagsContainer, 'SELECT_LOGS', 'Selection Logs');
    addToggle(logFlagsContainer, 'TWEEN_LOGS', 'Animation Logs');
    addToggle(logFlagsContainer, 'HTML_LOGS', 'HTML Logs');
    addToggle(logFlagsContainer, 'PHYSICS_LOGS', 'Physics Logs');
    addToggle(logFlagsContainer, 'ASSET_LOGS', 'Asset Logs');
    addToggle(logFlagsContainer, 'ACTIVATE_LOGS', 'Activation Logs');
    addToggle(logFlagsContainer, 'EFFECT_LOGS', 'Effect Logs');
    
    // Add the container to the debug UI
    debugUI.appendChild(logFlagsContainer);
    
    // Create a caret button container for better styling
    const caretContainer = document.createElement('div');
    caretContainer.style.position = 'relative';
    caretContainer.style.width = '100%';
    caretContainer.style.height = '20px';
    caretContainer.style.marginTop = '5px';
    caretContainer.style.cursor = 'pointer';
    caretContainer.style.textAlign = 'center';
    caretContainer.style.borderTop = '1px solid #444';
    
    // Add the caret icon
    const caret = document.createElement('div');
    caret.innerHTML = '▼';
    caret.style.position = 'absolute';
    caret.style.top = '0';
    caret.style.left = '50%';
    caret.style.transform = 'translateX(-50%) translateY(-50%)';
    caret.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    caret.style.padding = '0 10px';
    caret.style.fontSize = '12px';
    caret.style.color = '#888';
    caret.style.transition = 'transform 0.2s ease, color 0.2s ease';
    caretContainer.appendChild(caret);
    
    // Add hover effect
    caretContainer.addEventListener('mouseenter', function() {
        caret.style.color = '#fff';
        // Add wiggle animation
        caret.style.animation = 'wiggle 0.5s ease infinite';
    });
    
    caretContainer.addEventListener('mouseleave', function() {
        caret.style.color = '#888';
        // Remove wiggle animation
        caret.style.animation = '';
    });
    
    // Add keyframes for wiggle animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes wiggle {
            0%, 100% { transform: translateX(-50%) translateY(-50%) rotate(0deg); }
            25% { transform: translateX(-50%) translateY(-50%) rotate(10deg); }
            75% { transform: translateX(-50%) translateY(-50%) rotate(-10deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Add event listener to toggle the log flags section
    let isLogFlagsSectionVisible = false;
    caretContainer.addEventListener('click', function() {
        isLogFlagsSectionVisible = !isLogFlagsSectionVisible;
        logFlagsContainer.style.maxHeight = isLogFlagsSectionVisible ? '300px' : '0';
        caret.innerHTML = isLogFlagsSectionVisible ? '▲' : '▼';
    });
    
    debugUI.appendChild(caretContainer);
    
    // Add keyboard shortcut info
    const shortcutInfo = document.createElement('div');
    shortcutInfo.textContent = 'Press S to toggle UI';
    shortcutInfo.style.fontSize = '12px';
    shortcutInfo.style.color = '#aaa';
    shortcutInfo.style.marginTop = '10px';
    shortcutInfo.style.textAlign = 'center';
    debugUI.appendChild(shortcutInfo);
    
    // Add to document
    document.body.appendChild(debugUI);
    
    // Start FPS counter
    updateFPS();
    
    // Force update label wireframes if they exist
    setTimeout(() => {
        console.log('Attempting to force update label wireframes...');
        if (window.viewable_container && window.viewable_container.get_overlay()) {
            console.log('viewable_container and overlay exist');
            const labelContainer = window.viewable_container.get_overlay().label_container;
            if (labelContainer) {
                console.log('labelContainer exists');
                if (typeof labelContainer.updateDebugVisualizations === 'function') {
                    console.log('updateDebugVisualizations method exists, calling it');
                    labelContainer.updateDebugVisualizations();
                } else {
                    console.error('updateDebugVisualizations method does not exist on labelContainer');
                    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(labelContainer)));
                }
            } else {
                console.error('labelContainer does not exist on overlay');
                console.log('Overlay properties:', Object.keys(window.viewable_container.get_overlay()));
            }
        } else {
            console.error('viewable_container or overlay does not exist');
            if (window.viewable_container) {
                console.log('viewable_container exists, but get_overlay() returned:', window.viewable_container.get_overlay());
            } else {
                console.log('viewable_container does not exist');
            }
        }
    }, 3000); // Wait 3 seconds to ensure everything is loaded
    
    // Set up periodic checks to update label wireframes
    let checkCount = 0;
    const maxChecks = 10; // Increase max checks to 10
    const checkInterval = setInterval(() => {
        checkCount++;
        console.log(`Periodic check ${checkCount}/${maxChecks} for label wireframes...`);
        
        if (window.viewable_container && window.viewable_container.get_overlay()) {
            const labelContainer = window.viewable_container.get_overlay().label_container;
            if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
                console.log('Periodic update of label wireframes');
                labelContainer.updateDebugVisualizations();
                // If successful, we can stop checking
                clearInterval(checkInterval);
                console.log('Successfully updated label wireframes, stopping periodic checks');
            }
        }
        
        if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            console.log('Finished periodic checks for label wireframes');
        }
    }, 2000); // Check every 2 seconds instead of 5
    
    // Add a MutationObserver to detect when viewable_container becomes available
    if (!window.viewable_container) {
        console.log('Setting up MutationObserver to detect viewable_container initialization');
        
        // Function to check if viewable_container is available
        const checkForViewableContainer = () => {
            if (window.viewable_container) {
                console.log('viewable_container detected by observer!');
                
                // Wait a short time for it to be fully initialized
                setTimeout(() => {
                    if (window.viewable_container.get_overlay()) {
                        const labelContainer = window.viewable_container.get_overlay().label_container;
                        if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
                            console.log('Observer: Updating label wireframes after detection');
                            labelContainer.updateDebugVisualizations();
                        }
                    }
                }, 500);
                
                // Disconnect the observer as it's no longer needed
                observer.disconnect();
            }
        };
        
        // Create a MutationObserver to watch for changes to the window object
        const observer = new MutationObserver((mutations) => {
            checkForViewableContainer();
        });
        
        // Start observing the document with the configured parameters
        observer.observe(document, { childList: true, subtree: true });
        
        // Also check periodically in case the MutationObserver misses it
        const viewableContainerInterval = setInterval(() => {
            if (window.viewable_container) {
                console.log('viewable_container detected by interval check!');
                
                if (window.viewable_container.get_overlay()) {
                    const labelContainer = window.viewable_container.get_overlay().label_container;
                    if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
                        console.log('Interval check: Updating label wireframes after detection');
                        labelContainer.updateDebugVisualizations();
                    }
                }
                
                clearInterval(viewableContainerInterval);
            }
        }, 1000);
    }
    
    return debugUI;
}

/**
 * Updates the label wireframes if they exist
 * This can be called from anywhere in the code to ensure wireframes are updated
 */
export function updateLabelWireframes() {
    if (window.viewable_container && window.viewable_container.get_overlay()) {
        const labelContainer = window.viewable_container.get_overlay().label_container;
        if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
            console.log('Updating label wireframes via direct call');
            labelContainer.updateDebugVisualizations();
            return true;
        }
    }
    return false;
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
    
    // If no change in scale or change already in progress, just return
    if (Math.abs(currentResolutionScale - scale) < 0.01 || resolutionChangeInProgress) {
        return scale;
    }
    
    // Mark resolution change as in progress
    resolutionChangeInProgress = true;
    
    // Store previous scale for reference
    const previousScale = currentResolutionScale;
    currentResolutionScale = scale;
    
    console.log(`Resolution scale changing from ${previousScale.toFixed(2)} to ${scale.toFixed(2)}`);
    
    if (window.renderer) {
        // First update the UI to reflect the change
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
        
        // Apply the new pixel ratio with proper handling to avoid flash
        if (typeof window.renderer.setPixelRatio === 'function') {
            window.renderer.setPixelRatio(window.devicePixelRatio * scale);
            
            // After a short delay, mark resolution change as complete
            setTimeout(() => {
                resolutionChangeInProgress = false;
            }, 600); // Wait longer than the full transition to prevent rapid changes
        } else {
            // Fallback to basic renderer pixel ratio change
            window.renderer.setPixelRatio(window.devicePixelRatio * scale);
            
            // After a short delay, mark resolution change as complete
            setTimeout(() => {
                resolutionChangeInProgress = false;
            }, 300);
        }
    } else {
        // If no renderer available, just mark as complete
        resolutionChangeInProgress = false;
    }
    
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
            } else if (flagName === 'SIGN_VISUAL_DEBUG' && flagName !== 'COLLISION_VISUAL_DEBUG') {
                // Only handle SIGN_VISUAL_DEBUG here if it's not being controlled by COLLISION_VISUAL_DEBUG
                if (backgroundContainer) {
                    backgroundContainer.updateSignDebugVisualizations();
                }
            } else if (flagName === 'COLLISION_VISUAL_DEBUG') {
                // For collision debug, we need to refresh the scene to show/hide wireframes
                // The wireframes will be created/updated in the next frame if the flag is enabled
                console.log(`Collision debug visualization ${checked ? 'enabled' : 'disabled'}`);
                
                // The visibility of wireframes is controlled in the update_debug_wireframes method
                // which is called every frame during the physics update
                console.log(`All collision wireframes will be ${checked ? 'shown' : 'hidden'}`);
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
        frameCount = 0;
        lastTime = now;
        
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
        
        // Update other debug info if visible
        updateDebugInfo();
        
        // Check if we should adjust resolution based on performance
        if (autoThrottleEnabled && now - lastThrottleCheck > THROTTLE_CHECK_INTERVAL && !resolutionChangeInProgress) {
            lastThrottleCheck = now;
            
            // Auto-throttle logic with stepped values and stability control
            const steps = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
            const currentIndex = steps.findIndex(step => step >= currentResolutionScale);
            
            // Use separate stability counters for up and down scaling
            if (currentFps < LOW_FPS_THRESHOLD && currentResolutionScale > 0.25) {
                // Increment down counter and reset up counter
                throttleDownStabilityCounter++;
                throttleUpStabilityCounter = 0;
                
                // Only downscale after sustained low performance
                if (throttleDownStabilityCounter >= REQUIRED_STABILITY_COUNT_DOWN) {
                    // Reduce resolution when FPS is consistently too low
                    const newScale = steps[Math.max(0, currentIndex - 1)];
                    
                    // Only update if it's actually a change
                    if (newScale < currentResolutionScale) {
                        setResolutionScale(newScale);
                        console.log(`Auto-throttle: Reducing resolution to ${newScale.toFixed(2)} (${Math.round(newScale * 100)}%) - FPS: ${currentFps}`);
                        // Reset stability counters
                        throttleDownStabilityCounter = 0;
                        throttleUpStabilityCounter = 0;
                    }
                } else {
                    console.log(`Auto-throttle: Low performance detected (${throttleDownStabilityCounter}/${REQUIRED_STABILITY_COUNT_DOWN}) - FPS: ${currentFps}`);
                }
            } else if (currentFps > HIGH_FPS_THRESHOLD && currentResolutionScale < 1.5) {
                // Increment up counter and reset down counter
                throttleUpStabilityCounter++;
                throttleDownStabilityCounter = 0;
                
                // Only increase resolution if we've had good performance for required checks
                if (throttleUpStabilityCounter >= REQUIRED_STABILITY_COUNT_UP) {
                    const newScale = steps[Math.min(steps.length - 1, currentIndex + 1)];
                    
                    // Only update if it's actually a change
                    if (newScale > currentResolutionScale) {
                        setResolutionScale(newScale);
                        console.log(`Auto-throttle: Increasing resolution to ${newScale.toFixed(2)} (${Math.round(newScale * 100)}%) - FPS: ${currentFps}`);
                    }
                    // Reset stability counters
                    throttleUpStabilityCounter = 0;
                    throttleDownStabilityCounter = 0;
                } else {
                    console.log(`Auto-throttle: Good performance detected (${throttleUpStabilityCounter}/${REQUIRED_STABILITY_COUNT_UP}) - FPS: ${currentFps}`);
                }
            } else {
                // Reset stability counters if FPS is in the middle range
                throttleUpStabilityCounter = 0;
                throttleDownStabilityCounter = 0;
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
    }
    
    // Request next frame
    requestAnimationFrame(updateFPS);
}

/**
 * Updates additional debug info like draw calls, triangles, etc.
 */
function updateDebugInfo() {
    // Only update if renderer is available
    if (!window.renderer) return;
    
    // Get renderer info
    const renderer = window.renderer;
    let info;
    
    // Handle both direct WebGLRenderer and our AppRenderer class
    if (renderer.info) {
        // Direct WebGLRenderer
        info = renderer.info;
    } else if (renderer.get_renderer && renderer.get_renderer().info) {
        // Our AppRenderer class
        info = renderer.get_renderer().info;
    } else {
        // Can't get info
        return;
    }
    
    // Update draw calls
    const drawCallsInfo = document.getElementById('draw-calls-info');
    if (drawCallsInfo && info.render) {
        drawCallsInfo.textContent = `Draw calls: ${info.render.calls || 0}`;
    }
    
    // Update triangles
    const trianglesInfo = document.getElementById('triangles-info');
    if (trianglesInfo && info.render) {
        trianglesInfo.textContent = `Triangles: ${info.render.triangles || 0}`;
    }
    
    // Update geometries
    const geometriesInfo = document.getElementById('geometries-info');
    if (geometriesInfo && info.memory) {
        geometriesInfo.textContent = `Geometries: ${info.memory.geometries || 0}`;
    }
    
    // Update textures
    const texturesInfo = document.getElementById('textures-info');
    if (texturesInfo && info.memory) {
        texturesInfo.textContent = `Textures: ${info.memory.textures || 0}`;
    }
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