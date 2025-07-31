// Debug UI for displaying framerate and performance metrics
import { FLAGS, RAPIER, THREE } from '../common';
import { BLORKPACK_FLAGS, AssetHandler } from '@littlecarlito/blorkpack';
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
const THROTTLE_CHECK_INTERVAL = 2000;
const DEFAULT_LOW_FPS_THRESHOLD = 30;
const DEFAULT_HIGH_FPS_THRESHOLD = 55;
let LOW_FPS_THRESHOLD = DEFAULT_LOW_FPS_THRESHOLD;
let HIGH_FPS_THRESHOLD = DEFAULT_HIGH_FPS_THRESHOLD;
let throttleStabilityCounter = 0;
let throttleUpStabilityCounter = 0;
let throttleDownStabilityCounter = 0;
const REQUIRED_STABILITY_COUNT_UP = 4;
const REQUIRED_STABILITY_COUNT_DOWN = 2;
let maxFpsLimit = 60;

// FPS limiting variables
let lastFrameTime = 0;
let frameDelta = 0;

// Reference to the background container
let backgroundContainer = null;

// Add a new variable for tracking when a resolution change is in progress
let resolutionChangeInProgress = false;

// Add scene reference
let sceneRef = null;

// Add variables to store current selections
let currentSelectedObjectId = null;
let currentSelectedImageIndex = 0;

// DOM element cache
const domCache = {};

// Define image options for the display mesh
const imageOptions = [
	{ value: 0, text: 'Display Transparent' },
	{ value: 1, text: 'Display Black Screen' },
	{ value: 2, text: 'Display White Screen' }
];

/**
 * Cache DOM elements for performance
 */
function cacheDOMElement(id) {
	if (!domCache[id]) {
		domCache[id] = document.getElementById(id);
	}
	return domCache[id];
}

/**
 * Clear DOM cache when UI is recreated
 */
function clearDOMCache() {
	Object.keys(domCache).forEach(key => delete domCache[key]);
}

/**
 * Creates a debug UI that shows performance metrics
 */
export function createDebugUI() {
	// Check if debug UI already exists
	if (document.getElementById('debug-ui')) {
		return;
	}

	// Clear DOM cache since we're creating new elements
	clearDOMCache();

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
	metricsContainer.style.maxHeight = '0';
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
	playIcon.style.display = 'none';
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
	pauseIcon.style.display = 'inline-block';
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
	pauseButton.style.backgroundColor = '#4CAF50';
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
	resolutionTitle.style.marginBottom = '5px';
	debugUI.appendChild(resolutionTitle);

	// Create a container for both the toggle and collapsible content
	const resolutionSectionContainer = document.createElement('div');
	resolutionSectionContainer.style.position = 'relative';
	resolutionSectionContainer.style.marginBottom = '0';
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
	resolutionToggle.style.marginBottom = '0';
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
	resolutionContainer.style.maxHeight = '0';
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

		this.innerHTML = isResolutionVisible ? 'HIDE CONTROLS' : 'SHOW CONTROLS';
		this.style.backgroundColor = isResolutionVisible ? '#555' : '#444';
		this.style.color = isResolutionVisible ? '#fff' : '#eee';
	});

	// Add auto-throttle toggle
	addToggle(resolutionContainer, 'AUTO_THROTTLE', 'Auto-Throttle', autoThrottleEnabled, (checked) => {
		autoThrottleEnabled = checked;
		const resolutionDropdown = cacheDOMElement('resolution-dropdown');
		if (resolutionDropdown) {
			resolutionDropdown.disabled = checked;
			resolutionDropdown.style.opacity = checked ? '0.5' : '1';
			if (checked) {
				updateDropdownValue(currentResolutionScale);
			}
		}

		const fpsDropdown = cacheDOMElement('max-fps-dropdown');
		if (fpsDropdown) {
			fpsDropdown.disabled = checked;
			fpsDropdown.style.opacity = checked ? '0.5' : '1';
			if (checked) {
				LOW_FPS_THRESHOLD = DEFAULT_LOW_FPS_THRESHOLD;
				HIGH_FPS_THRESHOLD = DEFAULT_HIGH_FPS_THRESHOLD;
				maxFpsLimit = 60;
				for (let i = 0; i < fpsDropdown.options.length; i++) {
					if (fpsDropdown.options[i].value === '60') {
						fpsDropdown.selectedIndex = i;
						break;
					}
				}
				console.log(`Auto-throttle enabled: Using default thresholds (${LOW_FPS_THRESHOLD}/${HIGH_FPS_THRESHOLD})`);
			} else {
				maxFpsLimit = fpsDropdown.value === 'Infinity' ? Infinity : parseInt(fpsDropdown.value);
				LOW_FPS_THRESHOLD = Math.max(20, Math.floor(maxFpsLimit * 0.6));
				HIGH_FPS_THRESHOLD = Math.floor(maxFpsLimit * 0.8);
				console.log(`Auto-throttle disabled: Using manual FPS limit ${maxFpsLimit} (Thresholds: ${LOW_FPS_THRESHOLD}/${HIGH_FPS_THRESHOLD})`);
			}
		}

		const resolutionDisplay = cacheDOMElement('resolution-scale-display');
		if (resolutionDisplay) {
			const indicator = checked ? ' 🔄' : '';
			resolutionDisplay.textContent = `Resolution Scale: ${Math.round(currentResolutionScale * 100)}%${indicator}`;
		}
		console.log(`Auto-throttle ${checked ? 'enabled' : 'disabled'}`);
	});

	// Add resolution dropdown
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

	// Add resolution options
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
		if (option.value === maxFpsLimit) {
			optionElement.selected = true;
		}
		fpsDropdown.appendChild(optionElement);
	});

	fpsDropdown.addEventListener('change', function() {
		maxFpsLimit = this.value === 'Infinity' ? Infinity : parseInt(this.value);
		if (!autoThrottleEnabled) {
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

	// Add divider
	const divider3 = document.createElement('div');
	divider3.style.borderBottom = '1px solid #555';
	divider3.style.margin = '5px 0 10px 0';
	divider3.style.transition = 'margin 0.3s ease-in-out';
	debugUI.appendChild(divider3);

	// Title for display mesh section
	const displayMeshTitle = document.createElement('div');
	displayMeshTitle.textContent = 'DISPLAY MESH CONTROL';
	displayMeshTitle.style.fontWeight = 'bold';
	displayMeshTitle.style.marginBottom = '5px';
	debugUI.appendChild(displayMeshTitle);

	// Create a container for both the toggle and collapsible content
	const displayMeshSectionContainer = document.createElement('div');
	displayMeshSectionContainer.style.position = 'relative';
	displayMeshSectionContainer.style.marginBottom = '0';
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
	displayMeshToggle.style.marginBottom = '0';
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
	displayMeshContainer.style.maxHeight = '0';
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
	placeholderOption.textContent = 'Click refresh to load objects';
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

	// Create manual refresh button instead of auto-refresh
	const refreshButton = document.createElement('button');
	refreshButton.id = 'display-refresh-button';
	refreshButton.textContent = 'Refresh Objects';
	refreshButton.style.width = '100%';
	refreshButton.style.padding = '6px';
	refreshButton.style.backgroundColor = '#4CAF50';
	refreshButton.style.border = 'none';
	refreshButton.style.borderRadius = '3px';
	refreshButton.style.color = 'white';
	refreshButton.style.cursor = 'pointer';
	refreshButton.style.marginTop = '5px';
	refreshButton.style.marginBottom = '10px';
	refreshButton.style.fontWeight = 'bold';
	refreshButton.style.transition = 'all 0.2s';

	// Add hover effect
	refreshButton.addEventListener('mouseenter', function() {
		this.style.backgroundColor = '#45a049';
	});
	refreshButton.addEventListener('mouseleave', function() {
		this.style.backgroundColor = '#4CAF50';
	});

	// Add click event to manually refresh objects
	refreshButton.addEventListener('click', function() {
		this.textContent = 'Refreshing...';
		this.disabled = true;
		populateDisplayMeshObjects();
		setTimeout(() => {
			this.textContent = 'Refresh Objects';
			this.disabled = false;
		}, 500);
	});

	displayMeshContainer.appendChild(refreshButton);

	// Add the display mesh container to the debug UI
	debugUI.appendChild(displayMeshContainer);

	// Add divider before the Debug Toggles section
	const displayDivider = document.createElement('div');
	displayDivider.style.borderBottom = '1px solid #555';
	displayDivider.style.margin = '5px 0 10px 0';
	displayDivider.style.transition = 'margin 0.3s ease-in-out';
	debugUI.appendChild(displayDivider);

	// Create a container for the debug toggles section (keep this visible)
	const debugTogglesTitle = document.createElement('div');
	debugTogglesTitle.textContent = 'Debug Toggles';
	debugTogglesTitle.style.fontWeight = 'bold';
	debugTogglesTitle.style.marginBottom = '8px';
	debugUI.appendChild(debugTogglesTitle);

	// Create toggles
	addToggle(debugUI, 'COLLISION_WIREFRAMES', 'Collision Wireframes', false, (checked) => {
		FLAGS.COLLISION_WIREFRAMES = checked;
		toggleCollisionWireframes(checked);
		console.log(`Collision wireframes ${checked ? 'enabled' : 'disabled'}`);
	});

	addToggle(debugUI, 'RIG_VISUALIZATION', 'Rig Visualization', FLAGS.RIG_VISUALIZATION, (checked) => {
		FLAGS.RIG_VISUALIZATION = checked;
		toggleRigVisualization(checked);
		console.log(`Rig visualization ${checked ? 'enabled' : 'disabled'}`);
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
		caret.style.animation = 'wiggle 0.5s ease infinite';
	});
	caretContainer.addEventListener('mouseleave', function() {
		caret.style.color = '#888';
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
	setTimeout(populateDisplayMeshObjects, 1000);

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
	scale = Math.max(0.25, Math.min(1.5, scale));
	if (Math.abs(currentResolutionScale - scale) < 0.01 || resolutionChangeInProgress) {
		return scale;
	}

	resolutionChangeInProgress = true;
	const previousScale = currentResolutionScale;
	currentResolutionScale = scale;
	console.log(`Resolution scale changing from ${previousScale.toFixed(2)} to ${scale.toFixed(2)}`);

	if (window.renderer) {
		const resolutionDisplay = cacheDOMElement('resolution-scale-display');
		if (resolutionDisplay) {
			const indicator = autoThrottleEnabled ? ' 🔄' : '';
			resolutionDisplay.textContent = `Resolution Scale: ${Math.round(scale * 100)}%${indicator}`;
			resolutionDisplay.style.transition = 'color 0.5s';
			resolutionDisplay.style.color = '#4CAF50';
			setTimeout(() => {
				resolutionDisplay.style.color = 'white';
			}, 500);
		}

		updateDropdownValue(scale);

		if (typeof window.renderer.setPixelRatio === 'function') {
			window.renderer.setPixelRatio(window.devicePixelRatio * scale);
			setTimeout(() => {
				resolutionChangeInProgress = false;
			}, 600);
		} else {
			window.renderer.setPixelRatio(window.devicePixelRatio * scale);
			setTimeout(() => {
				resolutionChangeInProgress = false;
			}, 300);
		}
	} else {
		resolutionChangeInProgress = false;
	}

	return scale;
}

/**
 * Updates the dropdown selection based on the current resolution scale
 * @param {number} scale - The current resolution scale
 */
function updateDropdownValue(scale) {
	const dropdown = cacheDOMElement('resolution-dropdown');
	if (!dropdown) return;

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

	if (closestOption) {
		dropdown.value = closestOption.value;
	}
}

/**
 * More efficient FPS update function
 */
function updateFPS() {
	const now = performance.now();
	
	// More efficient FPS limiting
	if (!autoThrottleEnabled && maxFpsLimit !== Infinity) {
		const targetFrameTime = 1000 / maxFpsLimit;
		if (now - lastFrameTime < targetFrameTime) {
			const remainingTime = targetFrameTime - (now - lastFrameTime);
			setTimeout(() => requestAnimationFrame(updateFPS), remainingTime);
			return;
		}
	}
	
	lastFrameTime = now;
	frameCount++;
	
	const elapsed = now - lastTime;
	
	// Only update DOM and do expensive operations once per second
	if (elapsed >= 1000) {
		currentFps = Math.round((frameCount * 1000) / elapsed);
		frameCount = 0;
		lastTime = now;
		
		// Batch DOM updates to prevent layout thrashing
		requestAnimationFrame(() => {
			updateFPSDisplay();
			updateDebugInfo();
		});
		
		// Only do throttling checks if enabled and enough time has passed
		if (autoThrottleEnabled && now - lastThrottleCheck > THROTTLE_CHECK_INTERVAL && !resolutionChangeInProgress) {
			performThrottleCheck(now);
		}
	}
	
	// Continue the loop
	requestAnimationFrame(updateFPS);
}

/**
 * Separate function for FPS display updates
 */
function updateFPSDisplay() {
	const fpsDisplay = cacheDOMElement('fps-display');
	if (!fpsDisplay) return;
	
	const targetInfo = !autoThrottleEnabled ? 
		(maxFpsLimit === Infinity ? ' / Unlimited' : ` / ${maxFpsLimit}`) : '';
	fpsDisplay.textContent = `FPS: ${currentFps}${targetInfo}`;
	
	// Set color based on FPS
	let color = '#32CD32';
	if (currentFps < 30) {
		color = '#FF3B30';
	} else if (currentFps < 50) {
		color = '#FF9500';
	}
	fpsDisplay.style.color = color;
}

/**
 * Extract throttling logic to separate function
 */
function performThrottleCheck(now) {
	lastThrottleCheck = now;
	
	const steps = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
	const currentIndex = steps.findIndex(step => step >= currentResolutionScale);
	
	if (currentFps < LOW_FPS_THRESHOLD && currentResolutionScale > 0.25) {
		throttleDownStabilityCounter++;
		throttleUpStabilityCounter = 0;
		
		if (throttleDownStabilityCounter >= REQUIRED_STABILITY_COUNT_DOWN) {
			const newScale = steps[Math.max(0, currentIndex - 1)];
			if (newScale < currentResolutionScale) {
				setResolutionScale(newScale);
				console.log(`Auto-throttle: Reducing resolution to ${newScale.toFixed(2)} (${Math.round(newScale * 100)}%) - FPS: ${currentFps}`);
				throttleDownStabilityCounter = 0;
				throttleUpStabilityCounter = 0;
			}
		}
	} else if (currentFps > HIGH_FPS_THRESHOLD && currentResolutionScale < 1.5) {
		throttleUpStabilityCounter++;
		throttleDownStabilityCounter = 0;
		
		if (throttleUpStabilityCounter >= REQUIRED_STABILITY_COUNT_UP) {
			const newScale = steps[Math.min(steps.length - 1, currentIndex + 1)];
			if (newScale > currentResolutionScale) {
				setResolutionScale(newScale);
				console.log(`Auto-throttle: Increasing resolution to ${newScale.toFixed(2)} (${Math.round(newScale * 100)}%) - FPS: ${currentFps}`);
			}
			throttleUpStabilityCounter = 0;
			throttleDownStabilityCounter = 0;
		}
	} else {
		throttleUpStabilityCounter = 0;
		throttleDownStabilityCounter = 0;
	}
}

/**
 * Updates additional debug info like draw calls, triangles, etc.
 */
function updateDebugInfo() {
	if (!window.renderer) return;

	const renderer = window.renderer;
	let info;

	if (renderer.info) {
		info = renderer.info;
	} else if (renderer.get_renderer && renderer.get_renderer().info) {
		info = renderer.get_renderer().info;
	} else {
		return;
	}

	// Use cached DOM elements
	const drawCallsInfo = cacheDOMElement('draw-calls-info');
	if (drawCallsInfo && info.render) {
		drawCallsInfo.textContent = `Draw calls: ${info.render.calls || 0}`;
	}

	const trianglesInfo = cacheDOMElement('triangles-info');
	if (trianglesInfo && info.render) {
		trianglesInfo.textContent = `Triangles: ${info.render.triangles || 0}`;
	}

	const geometriesInfo = cacheDOMElement('geometries-info');
	if (geometriesInfo && info.memory) {
		geometriesInfo.textContent = `Geometries: ${info.memory.geometries || 0}`;
	}

	const texturesInfo = cacheDOMElement('textures-info');
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
	if (show === undefined) {
		FLAGS.DEBUG_UI = !FLAGS.DEBUG_UI;
	} else {
		FLAGS.DEBUG_UI = show;
	}

	const existingUI = document.getElementById('debug-ui');
	if (FLAGS.DEBUG_UI) {
		if (!sceneRef && window.scene) {
			console.log("Setting scene reference during UI toggle");
			setSceneReference(window.scene);
		} else if (sceneRef) {
			populateDisplayMeshObjects();
		}

		if (!existingUI) {
			createDebugUI();
		} else {
			existingUI.style.display = 'block';
		}
	} else {
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
 * Only called manually now via refresh button
 */
function populateDisplayMeshObjects() {
	const objectDropdown = cacheDOMElement('display-object-dropdown');
	const channelDropdown = cacheDOMElement('display-channel-dropdown');

	if (!objectDropdown || !channelDropdown) {
		console.log("Dropdown elements not found, cannot populate display mesh objects");
		return;
	}

	if (!sceneRef) {
		console.log("No scene reference available, cannot populate display mesh objects");
		if (objectDropdown.options[0]) {
			objectDropdown.options[0].textContent = 'No scene reference';
		}
		return;
	}

	console.log("Populating display mesh objects dropdown");

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

	channelDropdown.disabled = true;

	const displayMeshObjects = findDisplayMeshObjects();
	console.log(`Found ${displayMeshObjects.length} display mesh objects`);

	if (displayMeshObjects.length === 0) {
		objectDropdown.options[0].selected = true;
		objectDropdown.options[0].textContent = 'No objects found';
		return;
	}

	objectDropdown.options[0].textContent = 'Select an object';

	displayMeshObjects.forEach((obj, index) => {
		const option = document.createElement('option');
		option.value = obj.uuid;

		let displayName = obj.name || 'Unnamed Object';
		let displayMeshName = '';
		obj.traverse(child => {
			if (child.isMesh && child.name.toLowerCase().includes('display_')) {
				displayMeshName = child.name;
			}
		});

		if (displayMeshName) {
			displayName = `Monitor (${displayMeshName})`;
		}

		option.textContent = displayName;
		objectDropdown.appendChild(option);
	});

	// Add change event to the object dropdown
	objectDropdown.onchange = function() {
		const selectedObjectId = this.value;
		currentSelectedObjectId = selectedObjectId;
		if (selectedObjectId) {
			channelDropdown.disabled = false;
			const selectedObject = findObjectByUuid(selectedObjectId);
			if (selectedObject && selectedObject.userData.currentDisplayImage !== undefined) {
				channelDropdown.value = selectedObject.userData.currentDisplayImage;
				currentSelectedImageIndex = selectedObject.userData.currentDisplayImage;
			} else {
				channelDropdown.value = currentSelectedImageIndex;
			}
		} else {
			channelDropdown.disabled = true;
		}
	};

	// Restore previous selection if it exists
	let foundPreviousSelection = false;
	if (currentSelectedObjectId) {
		for (let i = 0; i < objectDropdown.options.length; i++) {
			if (objectDropdown.options[i].value === currentSelectedObjectId) {
				objectDropdown.selectedIndex = i;
				foundPreviousSelection = true;
				const event = new Event('change');
				objectDropdown.dispatchEvent(event);
				break;
			}
		}
	}

	if (!foundPreviousSelection) {
		objectDropdown.selectedIndex = 0;
		channelDropdown.disabled = true;
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
	const processed = new Set();
	let displayMeshCount = 0;

	console.log("Searching for display mesh objects in scene...");

	sceneRef.traverse(obj => {
		if (processed.has(obj.uuid)) return;

		let hasDisplayMesh = false;
		if (obj.isMesh && obj.name.toLowerCase().includes('display_')) {
			hasDisplayMesh = true;
			displayMeshCount++;
		} else {
			obj.traverse(child => {
				if (child.isMesh && child.name.toLowerCase().includes('display_')) {
					hasDisplayMesh = true;
					displayMeshCount++;
				}
			});
		}

		if (hasDisplayMesh) {
			let parentToAdd = obj;
			let currentObj = obj;

			while (currentObj.parent && currentObj.parent !== sceneRef) {
				currentObj = currentObj.parent;
				if (currentObj.userData && currentObj.userData.assetType) {
					parentToAdd = currentObj;
					break;
				}
			}

			parentToAdd.traverse(child => {
				processed.add(child.uuid);
			});

			if (!objects.some(o => o.uuid === parentToAdd.uuid)) {
				objects.push(parentToAdd);
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
	const objectDropdown = cacheDOMElement('display-object-dropdown');
	const channelDropdown = cacheDOMElement('display-channel-dropdown');

	const selectedObjectId = objectDropdown.value;
	const selectedImageIndex = parseInt(channelDropdown.value);

	if (!selectedObjectId || isNaN(selectedImageIndex)) {
		console.log('No valid object or image selected');
		return;
	}

	try {
		const selectedObject = findObjectByUuid(selectedObjectId);
		if (!selectedObject) {
			console.error(`Object with UUID ${selectedObjectId} not found`);
			return;
		}

		const displayMeshes = [];
		selectedObject.traverse(child => {
			if (child.isMesh && child.name.toLowerCase().includes('display_')) {
				displayMeshes.push(child);
			}
		});

		if (displayMeshes.length === 0) {
			console.error(`No display meshes found in object ${selectedObject.name}`);
			return;
		}

		console.log(`Updating display image for ${selectedObject.name} to image ${selectedImageIndex}`);

		selectedObject.userData.currentDisplayImage = selectedImageIndex;

		displayMeshes.forEach(mesh => {
			const material = AssetHandler.createDisplayMeshMaterial(selectedImageIndex);
			const modes = ['transparent', 'black screen', 'white screen'];
			console.log(`Set mesh ${mesh.name} to ${modes[selectedImageIndex]}`);

			mesh.material = material;
			mesh.material.needsUpdate = true;
		});
	} catch (error) {
		console.error('Error updating display image:', error);
	}
}

/**
 * Sets the scene reference for debug UI functions
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function setSceneReference(scene) {
	console.log("Setting scene reference for debug UI");
	sceneRef = scene;
	if (scene) {
		populateDisplayMeshObjects();
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

	let isChecked = initialState !== undefined ? initialState : false;
	isChecked = FLAGS[flagName] || false;
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

	checkbox.addEventListener('change', function() {
		const checked = this.checked;
		slider.style.backgroundColor = checked ? '#4CAF50' : '#ccc';
		circle.style.left = checked ? '13px' : '2px';

		if (flagName in FLAGS) {
			FLAGS[flagName] = checked;
			console.log(`${flagName} set to ${checked}`);

			if (flagName === 'SIGN_VISUAL_DEBUG') {
				if (backgroundContainer) {
					backgroundContainer.updateSignDebugVisualizations();
				}
			}
		}

		if (onChange && typeof onChange === 'function') {
			onChange(checked);
		}
	});

	toggle.appendChild(checkbox);
	toggle.appendChild(slider);
	toggleContainer.appendChild(toggle);
	parent.appendChild(toggleContainer);
} 

function toggleRigVisualization(enabled) {
    console.log(`Rig visualization ${enabled ? 'enabled' : 'disabled'}`);
    
    if (window.asset_handler) {
        window.asset_handler.updateRigConfig({ displayRig: enabled });
        window.asset_handler.setRigVisualizationEnabled(enabled);
    }
    
    if (sceneRef) {
        sceneRef.traverse((object) => {
            if (object.name === "RigVisualization") {
                object.visible = enabled;
            }
            if (object.name === "RigControlHandle") {
                object.visible = enabled;
            }
        });
    }

    if (window.asset_handler && window.asset_handler.activeRigVisualizations) {
        window.asset_handler.activeRigVisualizations.forEach((rigData) => {
            if (rigData.visualization && rigData.visualization.group) {
                rigData.visualization.group.visible = enabled;
            }
            if (rigData.visualization && rigData.visualization.handles) {
                rigData.visualization.handles.forEach(handle => {
                    handle.visible = enabled;
                });
            }
        });
    }
}

function toggleCollisionWireframes(enabled) {
	console.log(`Collision wireframes ${enabled ? 'enabled' : 'disabled'}`);
	
	if (sceneRef) {
		sceneRef.traverse((object) => {
			if (object.userData && object.userData.collisionWireframes) {
				if (enabled) {
					object.userData.enableCollisionWireframes();
				} else {
					object.userData.disableCollisionWireframes();
				}
			}
		});
	}
	
	if (backgroundContainer) {
		const allAssets = backgroundContainer.getAllCategorizedAssets();
		Object.values(allAssets).forEach(categoryAssets => {
			categoryAssets.forEach(assetData => {
				if (assetData.mesh && assetData.mesh.userData && assetData.mesh.userData.collisionWireframes) {
					if (enabled) {
						assetData.mesh.userData.enableCollisionWireframes();
					} else {
						assetData.mesh.userData.disableCollisionWireframes();
					}
				}
			});
		});
		
		if (backgroundContainer.asset_container) {
			backgroundContainer.asset_container.traverse((object) => {
				if (object.userData && object.userData.collisionWireframes) {
					if (enabled) {
						object.userData.enableCollisionWireframes();
					} else {
						object.userData.disableCollisionWireframes();
					}
				}
			});
		}
	}
	
	if (window.asset_handler && window.asset_handler.storage) {
		const allAssets = window.asset_handler.storage.get_all_assets();
		allAssets.forEach(asset => {
			if (asset.mesh && asset.mesh.userData && asset.mesh.userData.collisionWireframes) {
				if (enabled) {
					asset.mesh.userData.enableCollisionWireframes();
				} else {
					asset.mesh.userData.disableCollisionWireframes();
				}
			}
		});
	}
}