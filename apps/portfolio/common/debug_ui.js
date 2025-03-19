// Debug UI for displaying framerate and performance metrics
import { FLAGS, RAPIER, THREE } from '../common';
import { BLORKPACK_FLAGS, AssetSpawner } from '@littlecarlito/blorkpack';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

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

// Add scene reference
let sceneRef = null;

// Add a variable for the display mesh refresh timer
let displayMeshRefreshTimer = null;
// Add variables to store current selections
let currentSelectedObjectId = null;
let currentSelectedImageIndex = 0;

// Define image options for the display mesh
const imageOptions = [
    { value: 0, text: 'Display Transparent' },
    { value: 1, text: 'Display Black Screen' },
    { value: 2, text: 'Display White Screen' }
];

/**
 * Creates a debug UI that shows performance metrics
 */
export function createDebugUI() {
    // Check if debug UI already exists
    if (document.getElementById('debug-ui')) {
        return;
    }
    
    // Try to set scene reference if it's not already set
    if (!sceneRef && window.scene) {
        console.log("Automatically setting scene reference from window.scene");
        setSceneReference(window.scene);
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
    
    // Add resolution control section title - moved outside the container
    const resolutionTitle = document.createElement('div');
    resolutionTitle.textContent = 'Resolution Control';
    resolutionTitle.style.fontWeight = 'bold';
    resolutionTitle.style.marginBottom = '5px';
    debugUI.appendChild(resolutionTitle);
    
    // Create a container for both the toggle and collapsible content
    const resolutionSectionContainer = document.createElement('div');
    resolutionSectionContainer.style.position = 'relative';
    resolutionSectionContainer.style.marginBottom = '0'; // No margin by default
    resolutionSectionContainer.style.transition = 'margin-bottom 0.3s ease-in-out';
    debugUI.appendChild(resolutionSectionContainer);
    
    // Add toggle indicator for resolution control section
    const resolutionToggle = document.createElement('div');
    resolutionToggle.style.position = 'relative';
    resolutionToggle.style.backgroundColor = '#444';
    resolutionToggle.style.color = '#eee';
    resolutionToggle.style.padding = '4px 0';
    resolutionToggle.style.borderRadius = '3px';
    resolutionToggle.style.textAlign = 'center';
    resolutionToggle.style.cursor = 'pointer';
    resolutionToggle.style.fontSize = '11px';
    resolutionToggle.style.letterSpacing = '1px';
    resolutionToggle.style.transition = 'all 0.2s ease';
    resolutionToggle.style.border = '1px solid #555';
    resolutionToggle.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    resolutionToggle.style.marginBottom = '0'; // No bottom margin on the button
    resolutionToggle.innerHTML = 'SHOW CONTROLS';
    resolutionToggle.title = 'Toggle resolution controls';
    resolutionSectionContainer.appendChild(resolutionToggle);
    
    // Add hover effect for resolution toggle
    resolutionToggle.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#555';
        this.style.color = '#fff';
        this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    });
    
    resolutionToggle.addEventListener('mouseleave', function() {
        this.style.backgroundColor = isResolutionVisible ? '#555' : '#444';
        this.style.color = isResolutionVisible ? '#fff' : '#eee';
        this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    });
    
    // Create collapsible container for resolution controls
    const resolutionContainer = document.createElement('div');
    resolutionContainer.id = 'resolution-container';
    resolutionContainer.style.marginTop = '0';
    resolutionContainer.style.padding = '10px';
    resolutionContainer.style.border = '1px solid #444';
    resolutionContainer.style.borderRadius = '5px';
    resolutionContainer.style.maxHeight = '0'; // Start collapsed
    resolutionContainer.style.overflow = 'hidden';
    resolutionContainer.style.transition = 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, margin-top 0.3s ease-in-out';
    resolutionContainer.style.opacity = '0';
    resolutionSectionContainer.appendChild(resolutionContainer);
    
    // Add click event to toggle resolution controls visibility
    let isResolutionVisible = false;
    resolutionToggle.addEventListener('click', function() {
        isResolutionVisible = !isResolutionVisible;
        
        resolutionContainer.style.maxHeight = isResolutionVisible ? '300px' : '0';
        resolutionContainer.style.opacity = isResolutionVisible ? '1' : '0';
        resolutionContainer.style.marginTop = isResolutionVisible ? '8px' : '0';
        resolutionSectionContainer.style.marginBottom = isResolutionVisible ? '15px' : '0';
        
        // Update the divider margin too
        divider3.style.margin = isResolutionVisible ? '10px 0' : '5px 0 10px 0';
        
        // Update the toggle button styling
        this.innerHTML = isResolutionVisible ? 'HIDE CONTROLS' : 'SHOW CONTROLS';
        this.style.backgroundColor = isResolutionVisible ? '#555' : '#444';
        this.style.color = isResolutionVisible ? '#fff' : '#eee';
    });
    
    // Add auto-throttle toggle - moved inside the container
    addToggle(resolutionContainer, 'AUTO_THROTTLE', 'Auto-Throttle', autoThrottleEnabled, (checked) => {
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
    
    // Add resolution dropdown instead of slider - moved inside the container
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
    resolutionContainer.appendChild(dropdownContainer);
    
    // Add Max FPS dropdown - moved inside the container
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
    resolutionContainer.appendChild(fpsDropdownContainer);
    
    // Add divider with transition for margin
    const divider3 = document.createElement('div');
    divider3.style.borderBottom = '1px solid #555';
    divider3.style.margin = '5px 0 10px 0'; // Adjusted margin for collapsed state by default
    divider3.style.transition = 'margin 0.3s ease-in-out';
    debugUI.appendChild(divider3);
    
    // Title for display mesh section - moved outside the container
    const displayMeshTitle = document.createElement('div');
    displayMeshTitle.textContent = 'DISPLAY MESH CONTROL';
    displayMeshTitle.style.fontWeight = 'bold';
    displayMeshTitle.style.marginBottom = '5px';
    debugUI.appendChild(displayMeshTitle);
    
    // Create a container for both the toggle and collapsible content
    const displayMeshSectionContainer = document.createElement('div');
    displayMeshSectionContainer.style.position = 'relative';
    displayMeshSectionContainer.style.marginBottom = '0'; // No margin by default
    displayMeshSectionContainer.style.transition = 'margin-bottom 0.3s ease-in-out';
    debugUI.appendChild(displayMeshSectionContainer);
    
    // Add toggle indicator for display mesh section
    const displayMeshToggle = document.createElement('div');
    displayMeshToggle.style.position = 'relative';
    displayMeshToggle.style.backgroundColor = '#444';
    displayMeshToggle.style.color = '#eee';
    displayMeshToggle.style.padding = '4px 0';
    displayMeshToggle.style.borderRadius = '3px';
    displayMeshToggle.style.textAlign = 'center';
    displayMeshToggle.style.cursor = 'pointer';
    displayMeshToggle.style.fontSize = '11px';
    displayMeshToggle.style.letterSpacing = '1px';
    displayMeshToggle.style.transition = 'all 0.2s ease';
    displayMeshToggle.style.border = '1px solid #555';
    displayMeshToggle.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    displayMeshToggle.style.marginBottom = '0'; // No bottom margin on the button
    displayMeshToggle.innerHTML = 'SHOW CONTROLS';
    displayMeshToggle.title = 'Toggle display mesh controls';
    displayMeshSectionContainer.appendChild(displayMeshToggle);
    
    // Add hover effect for display mesh toggle
    displayMeshToggle.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#555';
        this.style.color = '#fff';
        this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    });
    
    displayMeshToggle.addEventListener('mouseleave', function() {
        this.style.backgroundColor = isDisplayMeshVisible ? '#555' : '#444';
        this.style.color = isDisplayMeshVisible ? '#fff' : '#eee';
        this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    });
    
    // Create collapsible container for display mesh controls
    const displayMeshContainer = document.createElement('div');
    displayMeshContainer.id = 'display-mesh-container';
    displayMeshContainer.style.marginTop = '0';
    displayMeshContainer.style.padding = '10px';
    displayMeshContainer.style.border = '1px solid #444';
    displayMeshContainer.style.borderRadius = '5px';
    displayMeshContainer.style.maxHeight = '0'; // Start collapsed
    displayMeshContainer.style.overflow = 'hidden';
    displayMeshContainer.style.transition = 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, margin-top 0.3s ease-in-out';
    displayMeshContainer.style.opacity = '0';
    displayMeshSectionContainer.appendChild(displayMeshContainer);
    
    // Add click event to toggle display mesh controls visibility
    let isDisplayMeshVisible = false;
    displayMeshToggle.addEventListener('click', function() {
        isDisplayMeshVisible = !isDisplayMeshVisible;
        
        displayMeshContainer.style.maxHeight = isDisplayMeshVisible ? '300px' : '0';
        displayMeshContainer.style.opacity = isDisplayMeshVisible ? '1' : '0';
        displayMeshContainer.style.marginTop = isDisplayMeshVisible ? '8px' : '0';
        displayMeshSectionContainer.style.marginBottom = isDisplayMeshVisible ? '15px' : '0';
        
        // Update the divider margin too
        displayDivider.style.margin = isDisplayMeshVisible ? '10px 0' : '5px 0 10px 0';
        
        // Update the toggle button styling
        this.innerHTML = isDisplayMeshVisible ? 'HIDE CONTROLS' : 'SHOW CONTROLS';
        this.style.backgroundColor = isDisplayMeshVisible ? '#555' : '#444';
        this.style.color = isDisplayMeshVisible ? '#fff' : '#eee';
    });
    
    // Container for object selection
    const objectSelectContainer = document.createElement('div');
    objectSelectContainer.style.marginBottom = '10px';
    displayMeshContainer.appendChild(objectSelectContainer);
    
    // Object dropdown label
    const objectDropdownLabel = document.createElement('div');
    objectDropdownLabel.textContent = 'Object:';
    objectDropdownLabel.style.marginBottom = '5px';
    objectSelectContainer.appendChild(objectDropdownLabel);
    
    // Object dropdown
    const objectDropdown = document.createElement('select');
    objectDropdown.id = 'display-object-dropdown';
    objectDropdown.style.width = '100%';
    objectDropdown.style.padding = '5px';
    objectDropdown.style.backgroundColor = '#333';
    objectDropdown.style.color = '#fff';
    objectDropdown.style.border = '1px solid #555';
    objectDropdown.style.borderRadius = '3px';
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Loading...';
    placeholderOption.selected = true;
    objectDropdown.appendChild(placeholderOption);
    objectSelectContainer.appendChild(objectDropdown);
    
    // Container for channel selection
    const channelSelectContainer = document.createElement('div');
    channelSelectContainer.style.marginBottom = '10px';
    displayMeshContainer.appendChild(channelSelectContainer);
    
    // Channel dropdown label
    const channelDropdownLabel = document.createElement('div');
    channelDropdownLabel.textContent = 'Display Image:';
    channelDropdownLabel.style.marginBottom = '5px';
    channelSelectContainer.appendChild(channelDropdownLabel);
    
    // Channel dropdown
    const channelDropdown = document.createElement('select');
    channelDropdown.id = 'display-channel-dropdown';
    channelDropdown.style.width = '100%';
    channelDropdown.style.padding = '5px';
    channelDropdown.style.backgroundColor = '#333';
    channelDropdown.style.color = '#fff';
    channelDropdown.style.border = '1px solid #555';
    channelDropdown.style.borderRadius = '3px';
    channelDropdown.disabled = true;
    
    // Populate channel dropdown with options
    imageOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        channelDropdown.appendChild(optionElement);
    });
    
    channelSelectContainer.appendChild(channelDropdown);
    
    // Add change event to update the display image when a channel is selected
    channelDropdown.onchange = updateDisplayImage;
    
    // Create refresh status element instead of a button
    const refreshStatus = document.createElement('div');
    refreshStatus.id = 'display-refresh-status';
    refreshStatus.textContent = 'Auto-refreshing...';
    refreshStatus.style.fontSize = '12px';
    refreshStatus.style.color = '#aaa';
    refreshStatus.style.marginTop = '5px';
    refreshStatus.style.marginBottom = '10px';
    refreshStatus.style.textAlign = 'center';
    refreshStatus.style.fontStyle = 'italic';
    displayMeshContainer.appendChild(refreshStatus);
    
    // Add the display mesh container to the debug UI
    debugUI.appendChild(displayMeshContainer);
    
    // Add divider before the Debug Toggles section
    const displayDivider = document.createElement('div');
    displayDivider.style.borderBottom = '1px solid #555';
    displayDivider.style.margin = isDisplayMeshVisible ? '10px 0' : '5px 0 10px 0'; // Adjusted margin
    displayDivider.style.transition = 'margin 0.3s ease-in-out';
    debugUI.appendChild(displayDivider);
    
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
            asset_spawner.set_collision_debug(checked);
        }
        
        // Update label wireframes
        updateLabelWireframes();
        
        // Log the change for debugging
        console.log(`Collision and Sign debug visualization ${checked ? 'enabled' : 'disabled'}`);
        console.log(`All collision wireframes will be ${checked ? 'shown' : 'hidden'}`);
    });
    
    addToggle(debugUI, 'SPOTLIGHT_VISUAL_DEBUG', 'Spotlight Debug', undefined, function(checked) {
        // Update flag to control visibility
        BLORKPACK_FLAGS.SPOTLIGHT_VISUAL_DEBUG = checked;
        console.log(`Spotlight debug helpers visibility set to ${checked ? 'visible' : 'hidden'}`);
        
        // Force update of spotlight debug visualizations to apply the change
        if (window.asset_spawner && window.asset_spawner.forceHelperUpdate) {
            window.asset_spawner.forceHelperUpdate();
            window.asset_spawner.update_helpers();
        }
    });
    
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
    
    // Initialize the display mesh objects dropdown
    setTimeout(populateDisplayMeshObjects, 1000); // Delay to ensure scene is loaded
    
    // Force update label wireframes if they exist
    setTimeout(() => {
        console.log('Attempting to force update label wireframes...');
        if (window.viewable_container && window.viewable_container.get_overlay()) {
            if(BLORKPACK_FLAGS.ASSET_LOGS) {
                console.log('viewable_container and overlay exist');
            }
            const labelContainer = window.viewable_container.get_overlay().label_container;
            if (labelContainer) {
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log('labelContainer exists');
                }
                if (typeof labelContainer.updateDebugVisualizations === 'function') {
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log('updateDebugVisualizations method exists, calling it');
                    }
                    labelContainer.updateDebugVisualizations();
                } else {
                    console.error('updateDebugVisualizations method does not exist on labelContainer');
                    if(BLORKPACK_FLAGS.ASSET_LOGS) {
                        console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(labelContainer)));
                    }
                }
            } else {
                console.error('labelContainer does not exist on overlay');
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log('Overlay properties:', Object.keys(window.viewable_container.get_overlay()));
                }
            }
        } else {
            console.error('viewable_container or overlay does not exist');
            if (window.viewable_container) {
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log('viewable_container exists, but get_overlay() returned:', window.viewable_container.get_overlay());
                }
            } else {
                if(BLORKPACK_FLAGS.ASSET_LOGS) {
                    console.log('viewable_container does not exist');
                }
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
    if(BLORKPACK_FLAGS.ASSET_LOGS) {
        console.log("Debug UI initialized. Press 's' to toggle.");
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
        // Try to set scene reference if it's not already set
        if (!sceneRef && window.scene) {
            console.log("Setting scene reference during UI toggle");
            setSceneReference(window.scene);
        } else if (sceneRef) {
            // If we already have a scene reference, just refresh the display objects
            populateDisplayMeshObjects();
        }
        
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

/**
 * Finds all objects in the scene with display meshes and populates the dropdown
 */
function populateDisplayMeshObjects() {
    const objectDropdown = document.getElementById('display-object-dropdown');
    const channelDropdown = document.getElementById('display-channel-dropdown');
    const refreshStatus = document.getElementById('display-refresh-status');
    
    if (!objectDropdown || !channelDropdown) {
        console.log("Dropdown elements not found, cannot populate display mesh objects");
        return;
    }
    
    if (!sceneRef) {
        console.log("No scene reference available, cannot populate display mesh objects");
        if (refreshStatus) {
            refreshStatus.textContent = 'Waiting for scene...';
            refreshStatus.style.color = '#ff9900';
        }
        return;
    }
    
    console.log("Attempting to populate display mesh objects dropdown");
    
    // Store current selections before updating
    if (objectDropdown.value) {
        currentSelectedObjectId = objectDropdown.value;
        if (channelDropdown.value) {
            currentSelectedImageIndex = parseInt(channelDropdown.value);
        }
    }
    
    // Clear existing options except the placeholder
    while (objectDropdown.options.length > 1) {
        objectDropdown.remove(1);
    }
    
    // Reset channel dropdown to disabled state
    channelDropdown.disabled = true;
    
    // Find all objects with display meshes in the scene
    const displayMeshObjects = findDisplayMeshObjects();
    
    console.log(`Found ${displayMeshObjects.length} display mesh objects`);
    
    if (displayMeshObjects.length === 0) {
        // If no objects found, show the placeholder
        objectDropdown.options[0].selected = true;
        objectDropdown.options[0].textContent = 'No objects found';
        
        if (refreshStatus) {
            refreshStatus.textContent = 'No display mesh objects found';
        }
        return;
    }
    
    // Update placeholder text
    objectDropdown.options[0].textContent = 'Select an object';
    
    // Add the found objects to the dropdown
    displayMeshObjects.forEach((obj, index) => {
        const option = document.createElement('option');
        option.value = obj.uuid;
        
        // Get a better display name for the object
        let displayName = obj.name || 'Unnamed Object';
        
        // If the object has a display mesh, use that for better identification
        let displayMeshName = '';
        obj.traverse(child => {
            if (child.isMesh && child.name.toLowerCase().includes('display_')) {
                displayMeshName = child.name;
                
                // DEBUG: Log the current material settings of the display mesh
                console.log(`Display mesh ${child.name} current material:`, 
                    child.material ? {
                        type: child.material.type,
                        transparent: child.material.transparent,
                        opacity: child.material.opacity,
                        color: child.material.color ? child.material.color.getHexString() : 'none',
                        emissive: child.material.emissive ? child.material.emissive.getHexString() : 'none'
                    } : 'no material');
            }
        });
        
        // DEBUG: Log the userData of the object
        console.log(`Object ${obj.name} userData:`, obj.userData);
        
        if (displayMeshName) {
            displayName = `Monitor (${displayMeshName})`;
        }
        
        option.textContent = displayName;
        objectDropdown.appendChild(option);
    });
    
    // Add change event to the object dropdown to enable/disable the channel dropdown
    objectDropdown.onchange = function() {
        const selectedObjectId = this.value;
        currentSelectedObjectId = selectedObjectId;
        
        if (selectedObjectId) {
            // Enable the channel dropdown
            channelDropdown.disabled = false;
            
            // Set the channel dropdown to the current image index if possible
            const selectedObject = findObjectByUuid(selectedObjectId);
            if (selectedObject && selectedObject.userData.currentDisplayImage !== undefined) {
                console.log(`Object ${selectedObject.name} has currentDisplayImage = ${selectedObject.userData.currentDisplayImage}`);
                channelDropdown.value = selectedObject.userData.currentDisplayImage;
                currentSelectedImageIndex = selectedObject.userData.currentDisplayImage;
            } else {
                // Default to stored image index
                console.log(`Using default image index: ${currentSelectedImageIndex}`);
                channelDropdown.value = currentSelectedImageIndex;
            }
        } else {
            // Disable the channel dropdown
            channelDropdown.disabled = true;
        }
    };
    
    // Restore previous selection if it exists in new list
    let foundPreviousSelection = false;
    
    if (currentSelectedObjectId) {
        // Try to find and select the previously selected object
        for (let i = 0; i < objectDropdown.options.length; i++) {
            if (objectDropdown.options[i].value === currentSelectedObjectId) {
                objectDropdown.selectedIndex = i;
                foundPreviousSelection = true;
                
                // Trigger the change event
                const event = new Event('change');
                objectDropdown.dispatchEvent(event);
                break;
            }
        }
    }
    
    // If we couldn't restore the previous selection, select the placeholder
    if (!foundPreviousSelection) {
        objectDropdown.selectedIndex = 0;
        channelDropdown.disabled = true;
    }
    
    // Update refresh status with timestamp
    if (refreshStatus) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        refreshStatus.textContent = `Found ${displayMeshObjects.length} object(s) at ${timeString}`;
        
        // Flash the status briefly to show it updated
        refreshStatus.style.color = '#4CAF50'; // Green flash
        setTimeout(() => {
            refreshStatus.style.color = '#aaa';
        }, 500);
    }
    
    console.log(`Found ${displayMeshObjects.length} objects with display meshes`);
}

/**
 * Find all objects in the scene that have display meshes
 * @returns {Array} - Array of objects that have display meshes
 */
function findDisplayMeshObjects() {
    if (!sceneRef) {
        console.log("No scene reference, cannot find display mesh objects");
        return [];
    }
    
    const objects = [];
    const processed = new Set(); // To avoid duplicates
    let displayMeshCount = 0;
    
    console.log("Searching for display mesh objects in scene...");
    
    // Traverse the scene to find objects with display meshes
    sceneRef.traverse(obj => {
        // Skip if we've already processed this object or its parent
        if (processed.has(obj.uuid)) return;
        
        // Check if this object has any mesh children with names containing 'display_'
        let hasDisplayMesh = false;
        if (obj.isMesh && obj.name.toLowerCase().includes('display_')) {
            hasDisplayMesh = true;
            displayMeshCount++;
            console.log(`Found direct display mesh: ${obj.name}`);
        } else {
            // Check children recursively
            obj.traverse(child => {
                if (child.isMesh && child.name.toLowerCase().includes('display_')) {
                    hasDisplayMesh = true;
                    displayMeshCount++;
                    console.log(`Found child display mesh: ${child.name} in parent: ${obj.name || 'unnamed'}`);
                }
            });
        }
        
        // If this object has display meshes, add it to the list
        if (hasDisplayMesh) {
            // Add the top-level parent that has an assetType (if available)
            let parentToAdd = obj;
            let currentObj = obj;
            
            // Walk up the hierarchy to find the asset parent
            while (currentObj.parent && currentObj.parent !== sceneRef) {
                currentObj = currentObj.parent;
                if (currentObj.userData && currentObj.userData.assetType) {
                    parentToAdd = currentObj;
                    console.log(`Found parent with assetType: ${parentToAdd.name} (${parentToAdd.userData.assetType})`);
                    break;
                }
            }
            
            // Mark all children as processed to avoid duplicates
            parentToAdd.traverse(child => {
                processed.add(child.uuid);
            });
            
            // Only add if not already in the list
            if (!objects.some(o => o.uuid === parentToAdd.uuid)) {
                objects.push(parentToAdd);
                console.log(`Added object to display mesh list: ${parentToAdd.name}`);
            }
        }
    });
    
    console.log(`Total display meshes found: ${displayMeshCount}, Total objects with display meshes: ${objects.length}`);
    
    return objects;
}

/**
 * Find an object in the scene by its UUID
 * @param {string} uuid - The UUID of the object to find
 * @returns {Object3D|null} - The object if found, null otherwise
 */
function findObjectByUuid(uuid) {
    if (!sceneRef) return null;
    
    let foundObject = null;
    
    sceneRef.traverse(obj => {
        if (obj.uuid === uuid) {
            foundObject = obj;
        }
    });
    
    return foundObject;
}

/**
 * Updates the display image of the selected object
 */
function updateDisplayImage() {
    const objectDropdown = document.getElementById('display-object-dropdown');
    const channelDropdown = document.getElementById('display-channel-dropdown');
    const refreshStatus = document.getElementById('display-refresh-status');
    
    const selectedObjectId = objectDropdown.value;
    const selectedImageIndex = parseInt(channelDropdown.value);
    
    if (!selectedObjectId || isNaN(selectedImageIndex)) {
        console.log('No valid object or image selected');
        return;
    }
    
    try {
        // Find the selected object in the scene
        const selectedObject = findObjectByUuid(selectedObjectId);
        
        if (!selectedObject) {
            console.error(`Object with UUID ${selectedObjectId} not found`);
            if (refreshStatus) {
                refreshStatus.textContent = `Error: Object not found`;
                refreshStatus.style.color = 'red';
                setTimeout(() => {
                    refreshStatus.style.color = '#aaa';
                    refreshStatus.textContent = 'Auto-refreshing...';
                }, 2000);
            }
            return;
        }
        
        // Find all meshes with the 'display_' naming convention
        const displayMeshes = [];
        selectedObject.traverse(child => {
            if (child.isMesh && child.name.toLowerCase().includes('display_')) {
                displayMeshes.push(child);
            }
        });
        
        if (displayMeshes.length === 0) {
            console.error(`No display meshes found in object ${selectedObject.name}`);
            if (refreshStatus) {
                refreshStatus.textContent = `Error: No display meshes found`;
                refreshStatus.style.color = 'red';
                setTimeout(() => {
                    refreshStatus.style.color = '#aaa';
                    refreshStatus.textContent = 'Auto-refreshing...';
                }, 2000);
            }
            return;
        }
        
        console.log(`Updating display image for ${selectedObject.name} to image ${selectedImageIndex}`);
        
        // Store the current display image index in the object's userData
        selectedObject.userData.currentDisplayImage = selectedImageIndex;
        
        // Update all display meshes based on the selected option
        displayMeshes.forEach(mesh => {
            // Create a new material based on the selected option using the shared function
            const material = AssetSpawner.createDisplayMeshMaterial(selectedImageIndex);
            
            // Log which mode was applied
            const modes = ['transparent', 'black screen', 'white screen'];
            console.log(`Set mesh ${mesh.name} to ${modes[selectedImageIndex]}`);
            
            // Apply the new material
            mesh.material = material;
            mesh.material.needsUpdate = true;
            
            if (refreshStatus) {
                refreshStatus.textContent = `Updated to ${imageOptions[selectedImageIndex].text}`;
                refreshStatus.style.color = '#4CAF50';
                setTimeout(() => {
                    refreshStatus.style.color = '#aaa';
                    refreshStatus.textContent = 'Auto-refreshing...';
                }, 2000);
            }
        });
    } catch (error) {
        console.error('Error updating display image:', error);
        if (refreshStatus) {
            refreshStatus.textContent = `Error: ${error.message}`;
            refreshStatus.style.color = 'red';
            setTimeout(() => {
                refreshStatus.style.color = '#aaa';
                refreshStatus.textContent = 'Auto-refreshing...';
            }, 2000);
        }
    }
}

/**
 * Sets the scene reference for debug UI functions
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function setSceneReference(scene) {
    console.log("Setting scene reference for debug UI");
    
    // Store the scene reference
    sceneRef = scene;
    
    if (scene) {
        // Set up object detection by monkey-patching Object3D methods
        setupSceneChangeDetection();
        
        // Populate the display mesh objects dropdown initially
        populateDisplayMeshObjects();
    }
}

/**
 * Set up detection of scene graph changes by monkey-patching Object3D methods
 */
function setupSceneChangeDetection() {
    if (!window.THREE || !sceneRef) return;
    
    console.log("Setting up scene change detection for display mesh objects");
    
    // Store original methods
    const originalAdd = THREE.Object3D.prototype.add;
    const originalRemove = THREE.Object3D.prototype.remove;
    
    // Keep track if we've already patched the methods
    if (THREE.Object3D.prototype._displayMeshDetectionPatched) {
        console.log("Scene change detection already set up");
        return;
    }
    
    // Flag to prevent multiple refreshes in a short period
    let refreshPending = false;
    
    // Function to schedule a refresh with debouncing
    const scheduleRefresh = () => {
        if (refreshPending) return;
        
        refreshPending = true;
        // Wait a short while to batch multiple changes
        setTimeout(() => {
            if (document.getElementById('debug-ui')?.style.display !== 'none') {
                console.log("Scene changed - refreshing display mesh objects list");
                populateDisplayMeshObjects();
            }
            refreshPending = false;
        }, 500);
    };
    
    // Override add method
    THREE.Object3D.prototype.add = function(...objects) {
        const result = originalAdd.apply(this, objects);
        
        // Only trigger if this object is part of our scene
        let isPartOfScene = false;
        let current = this;
        
        while (current) {
            if (current === sceneRef) {
                isPartOfScene = true;
                break;
            }
            current = current.parent;
        }
        
        if (isPartOfScene) {
            // Check if any added object has a display mesh
            const hasDisplayMesh = objects.some(obj => {
                let found = false;
                
                // Check the object itself
                if (obj.isMesh && obj.name.toLowerCase().includes('display_')) {
                    found = true;
                }
                
                // Check children recursively
                if (!found) {
                    obj.traverse(child => {
                        if (child.isMesh && child.name.toLowerCase().includes('display_')) {
                            found = true;
                        }
                    });
                }
                
                return found;
            });
            
            if (hasDisplayMesh) {
                scheduleRefresh();
            }
        }
        
        return result;
    };
    
    // Override remove method
    THREE.Object3D.prototype.remove = function(...objects) {
        // Check if any removed object has a display mesh before removing
        const hasDisplayMesh = objects.some(obj => {
            let found = false;
            
            // Check the object itself
            if (obj.isMesh && obj.name.toLowerCase().includes('display_')) {
                found = true;
            }
            
            // Check children recursively
            if (!found) {
                obj.traverse(child => {
                    if (child.isMesh && child.name.toLowerCase().includes('display_')) {
                        found = true;
                    }
                });
            }
            
            return found;
        });
        
        const result = originalRemove.apply(this, objects);
        
        if (hasDisplayMesh) {
            scheduleRefresh();
        }
        
        return result;
    };
    
    // Mark as patched to avoid double patching
    THREE.Object3D.prototype._displayMeshDetectionPatched = true;
    
    // Set up an occasional fallback refresh (much less frequent)
    startDisplayMeshFallbackTimer();
}

function startDisplayMeshRefreshTimer() {
    // Clear any existing timer
    stopDisplayMeshRefreshTimer();
    
    // Start a new timer that refreshes every 3 seconds
    displayMeshRefreshTimer = setInterval(() => {
        if (document.getElementById('debug-ui').style.display !== 'none') {
            populateDisplayMeshObjects();
        }
    }, 3000);
    
    console.log('Started display mesh refresh timer');
}

function stopDisplayMeshRefreshTimer() {
    if (displayMeshRefreshTimer) {
        clearInterval(displayMeshRefreshTimer);
        displayMeshRefreshTimer = null;
        console.log('Stopped display mesh refresh timer');
    }
}

function startDisplayMeshFallbackTimer() {
    // Clear any existing timer
    stopDisplayMeshRefreshTimer();
    
    // Start a new timer that refreshes much less frequently (every 30 seconds)
    // This is just a fallback in case some objects are added through methods that bypass our patches
    displayMeshRefreshTimer = setInterval(() => {
        if (document.getElementById('debug-ui')?.style.display !== 'none') {
            console.log("Fallback check for display mesh objects");
            populateDisplayMeshObjects();
        }
    }, 30000); // Check every 30 seconds
    
    console.log('Started display mesh fallback timer (checking every 30 seconds)');
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
    
    // Use provided initial state or get from FLAGS or BLORKPACK_FLAGS
    let isChecked = initialState !== undefined ? initialState : false;
    if (flagName === 'SPOTLIGHT_VISUAL_DEBUG') {
        isChecked = BLORKPACK_FLAGS[flagName] || false;
    } else {
        isChecked = FLAGS[flagName] || false;
    }
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
        
        // Special case for SPOTLIGHT_VISUAL_DEBUG which now uses BLORKPACK_FLAGS
        if (flagName === 'SPOTLIGHT_VISUAL_DEBUG') {
            // Skip the default FLAG update
            if (onChange && typeof onChange === 'function') {
                onChange(checked);
            }
            return;
        }
        
        // For all other flags, update FLAGS as before
        if (flagName in FLAGS) {
            FLAGS[flagName] = checked;
            console.log(`${flagName} set to ${checked}`);
            
            // Call specific update functions based on the flag
            if (flagName === 'SIGN_VISUAL_DEBUG' && flagName !== 'COLLISION_VISUAL_DEBUG') {
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