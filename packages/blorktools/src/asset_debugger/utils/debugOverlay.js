// Debug Overlay Module
// Creates a modal debug settings panel triggered by "s" key

import { UIDebugFlags, toggleDebugFlag } from './flags.js';
import { toggleOffscreenIndicators, setOffscreenIndicatorOpacity, togglePositionLogging } from './uiComponents.js';

// Track instances
let overlayContainer = null;
let isInitialized = false;

/**
 * Initialize debug overlay
 * @returns {void}
 */
export function initDebugOverlay() {
	if (isInitialized) return;
    
	// Add keyboard listener for "s" key
	document.addEventListener('keydown', handleKeyPress);
    
	isInitialized = true;
	console.log('Debug overlay initialized, press "s" to open debug settings');
}

/**
 * Handle key press events
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {void}
 */
function handleKeyPress(event) {
	// Check if the key pressed is "s" and no input elements are focused
	if (event.key === 's' && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA' && 
        document.activeElement.tagName !== 'SELECT') {
		toggleDebugOverlay();
	}
}

/**
 * Toggle debug overlay visibility
 * @returns {void}
 */
export function toggleDebugOverlay() {
	if (overlayContainer) {
		// If overlay exists, remove it
		document.body.removeChild(overlayContainer);
		overlayContainer = null;
	} else {
		// Create and show the overlay
		createDebugOverlay();
	}
}

/**
 * Create debug overlay
 * @returns {void}
 */
function createDebugOverlay() {
	// Create background overlay
	overlayContainer = document.createElement('div');
	overlayContainer.style.position = 'fixed';
	overlayContainer.style.top = '0';
	overlayContainer.style.left = '0';
	overlayContainer.style.width = '100%';
	overlayContainer.style.height = '100%';
	overlayContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
	overlayContainer.style.display = 'flex';
	overlayContainer.style.justifyContent = 'flex-start';
	overlayContainer.style.alignItems = 'flex-start';
	overlayContainer.style.zIndex = '10000';
    
	// Close on background click
	overlayContainer.addEventListener('click', (e) => {
		if (e.target === overlayContainer) {
			toggleDebugOverlay();
		}
	});
    
	// Create the settings panel
	const panel = createDebugPanel();
	overlayContainer.appendChild(panel);
    
	// Add to document
	document.body.appendChild(overlayContainer);
}

/**
 * Create debug settings panel
 * @returns {HTMLElement} The debug panel
 */
function createDebugPanel() {
	const panel = document.createElement('div');
	panel.style.backgroundColor = 'rgba(32, 32, 32, 0.95)';
	panel.style.border = '1px solid #666';
	panel.style.borderRadius = '5px';
	panel.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
	panel.style.color = 'white';
	panel.style.width = '320px';
	panel.style.margin = '20px';
	panel.style.fontFamily = 'monospace';
	panel.style.overflow = 'hidden';
    
	// Add title
	const title = document.createElement('div');
	title.textContent = 'UI Debug Settings';
	title.style.backgroundColor = '#333';
	title.style.padding = '10px 15px';
	title.style.fontSize = '14px';
	title.style.fontWeight = 'bold';
	title.style.borderBottom = '1px solid #555';
	panel.appendChild(title);
    
	// Add content container
	const content = document.createElement('div');
	content.style.padding = '15px';
	panel.appendChild(content);
    
	// Add controls
	addOffscreenControls(content);
	addSeparator(content);
	addLoggingControls(content);
	addSeparator(content);
	addAdditionalInfo(content);
    
	return panel;
}

/**
 * Add offscreen detection controls
 * @param {HTMLElement} container - Container to add controls to
 */
function addOffscreenControls(container) {
	// Section title
	const sectionTitle = document.createElement('div');
	sectionTitle.textContent = 'Offscreen Panel Detection';
	sectionTitle.style.fontSize = '13px';
	sectionTitle.style.fontWeight = 'bold';
	sectionTitle.style.marginBottom = '10px';
	sectionTitle.style.color = '#90CAF9';
	container.appendChild(sectionTitle);
    
	// Toggle for offscreen indicators
	addToggleSwitch(
		container, 
		'Enable offscreen indicators', 
		UIDebugFlags.showOffscreenIndicators,
		() => {
			const isEnabled = toggleOffscreenIndicators();
			return isEnabled;
		}
	);
    
	// Opacity slider
	addSlider(
		container,
		'Indicator opacity:',
		UIDebugFlags.offscreenIndicatorOpacity,
		0, 1, 0.1,
		(value) => {
			setOffscreenIndicatorOpacity(value);
		}
	);
}

/**
 * Add logging controls
 * @param {HTMLElement} container - Container to add controls to
 */
function addLoggingControls(container) {
	// Section title
	const sectionTitle = document.createElement('div');
	sectionTitle.textContent = 'Debugging Information';
	sectionTitle.style.fontSize = '13px';
	sectionTitle.style.fontWeight = 'bold';
	sectionTitle.style.marginBottom = '10px';
	sectionTitle.style.color = '#90CAF9';
	container.appendChild(sectionTitle);
    
	// Toggle for position logging
	addToggleSwitch(
		container, 
		'Log position information', 
		UIDebugFlags.logPositionInfo,
		() => {
			const isEnabled = togglePositionLogging();
			return isEnabled;
		}
	);
}

/**
 * Add additional information
 * @param {HTMLElement} container - Container to add info to
 */
function addAdditionalInfo(container) {
	const info = document.createElement('div');
	info.innerHTML = `
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 10px; color: #90CAF9">Help</div>
        <div style="font-size: 12px; margin-bottom: 5px">Press <span style="color: #FF9800; font-weight: bold">S</span> to toggle this debug panel</div>
        <div style="font-size: 12px; margin-bottom: 5px">Click outside to close this panel</div>
        <div style="font-size: 11px; color: #999; margin-top: 10px">Offscreen detection helps visualize when UI panels extend beyond the viewport edges.</div>
    `;
	container.appendChild(info);
}

/**
 * Add toggle switch control
 * @param {HTMLElement} container - Container to add to
 * @param {string} label - Control label
 * @param {boolean} initialValue - Initial state
 * @param {Function} onChange - Change handler function
 */
function addToggleSwitch(container, label, initialValue, onChange) {
	const controlContainer = document.createElement('div');
	controlContainer.style.display = 'flex';
	controlContainer.style.justifyContent = 'space-between';
	controlContainer.style.alignItems = 'center';
	controlContainer.style.marginBottom = '12px';
    
	// Label
	const labelElement = document.createElement('label');
	labelElement.textContent = label;
	labelElement.style.fontSize = '12px';
	controlContainer.appendChild(labelElement);
    
	// Toggle switch
	const toggleContainer = document.createElement('div');
	toggleContainer.style.position = 'relative';
	toggleContainer.style.width = '40px';
	toggleContainer.style.height = '20px';
    
	const toggleBg = document.createElement('div');
	toggleBg.style.position = 'absolute';
	toggleBg.style.top = '0';
	toggleBg.style.left = '0';
	toggleBg.style.width = '100%';
	toggleBg.style.height = '100%';
	toggleBg.style.backgroundColor = initialValue ? '#4CAF50' : '#666';
	toggleBg.style.borderRadius = '10px';
	toggleBg.style.transition = 'background-color 0.3s';
	toggleContainer.appendChild(toggleBg);
    
	const toggleHandle = document.createElement('div');
	toggleHandle.style.position = 'absolute';
	toggleHandle.style.top = '2px';
	toggleHandle.style.left = initialValue ? '22px' : '2px';
	toggleHandle.style.width = '16px';
	toggleHandle.style.height = '16px';
	toggleHandle.style.backgroundColor = 'white';
	toggleHandle.style.borderRadius = '50%';
	toggleHandle.style.transition = 'left 0.3s';
	toggleContainer.appendChild(toggleHandle);
    
	// Add click handler
	toggleContainer.addEventListener('click', () => {
		const isEnabled = onChange();
		toggleBg.style.backgroundColor = isEnabled ? '#4CAF50' : '#666';
		toggleHandle.style.left = isEnabled ? '22px' : '2px';
	});
    
	toggleContainer.style.cursor = 'pointer';
	controlContainer.appendChild(toggleContainer);
    
	container.appendChild(controlContainer);
}

/**
 * Add slider control
 * @param {HTMLElement} container - Container to add to
 * @param {string} label - Control label
 * @param {number} initialValue - Initial value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} step - Step value
 * @param {Function} onChange - Change handler function
 */
function addSlider(container, label, initialValue, min, max, step, onChange) {
	const controlContainer = document.createElement('div');
	controlContainer.style.marginBottom = '15px';
    
	// Label
	const labelElement = document.createElement('label');
	labelElement.textContent = label;
	labelElement.style.fontSize = '12px';
	labelElement.style.display = 'block';
	labelElement.style.marginBottom = '5px';
	controlContainer.appendChild(labelElement);
    
	// Slider container with value display
	const sliderContainer = document.createElement('div');
	sliderContainer.style.display = 'flex';
	sliderContainer.style.alignItems = 'center';
    
	// Slider
	const slider = document.createElement('input');
	slider.type = 'range';
	slider.min = min;
	slider.max = max;
	slider.step = step;
	slider.value = initialValue;
	slider.style.flex = '1';
	slider.style.height = '6px';
	slider.style.appearance = 'none';
	slider.style.backgroundColor = '#555';
	slider.style.borderRadius = '3px';
	slider.style.outline = 'none';
    
	// Value display
	const valueDisplay = document.createElement('span');
	valueDisplay.textContent = initialValue.toFixed(1);
	valueDisplay.style.marginLeft = '10px';
	valueDisplay.style.fontSize = '12px';
	valueDisplay.style.minWidth = '24px';
	valueDisplay.style.textAlign = 'right';
    
	// Add change handler
	slider.addEventListener('input', () => {
		const value = parseFloat(slider.value);
		valueDisplay.textContent = value.toFixed(1);
		onChange(value);
	});
    
	// Add elements to containers
	sliderContainer.appendChild(slider);
	sliderContainer.appendChild(valueDisplay);
	controlContainer.appendChild(sliderContainer);
    
	container.appendChild(controlContainer);
}

/**
 * Add separator line
 * @param {HTMLElement} container - Container to add to
 */
function addSeparator(container) {
	const separator = document.createElement('div');
	separator.style.height = '1px';
	separator.style.backgroundColor = '#444';
	separator.style.margin = '15px 0';
	container.appendChild(separator);
} 