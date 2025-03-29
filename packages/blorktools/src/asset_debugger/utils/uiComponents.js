// UI Components Utility Module
// Reusable UI creation patterns for the asset debugger
import { UIDebugFlags } from './flags.js';

/**
 * Creates a movable panel with standard styling and functionality
 * @param {Object} options - Configuration options
 * @param {string} options.id - ID for the panel
 * @param {string} options.title - Panel title
 * @param {Object} options.position - Position settings {top, right, bottom, left} (optional)
 * @param {string} options.width - Panel width (default: '300px')
 * @param {boolean} options.startCollapsed - Whether panel should start collapsed
 * @param {function} options.onClose - Function to call when close button is clicked
 * @returns {Object} Created elements {container, header, contentContainer}
 */
export function createMovablePanel(options) {
	const {
		id,
		title,
		position = { bottom: '20px', left: '20px' },
		width = '300px',
		startCollapsed = false
	} = options;

	// Create container
	const container = document.createElement('div');
	container.id = id;
	container.style.position = 'absolute';
	container.style.width = width;
	container.style.maxHeight = 'calc(100vh - 40px)';
	container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
	container.style.border = '1px solid #666';
	container.style.borderRadius = '5px';
	container.style.color = 'white';
	container.style.fontFamily = 'monospace';
	container.style.fontSize = '12px';
	container.style.zIndex = '1000';
	container.style.boxSizing = 'border-box';
	container.style.overflow = 'hidden'; // Keep this as hidden
	container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
	container.style.display = 'flex';
	container.style.flexDirection = 'column'; // Stack header and content

	// Apply position
	Object.keys(position).forEach(key => {
		container.style[key] = position[key];
	});

	// Create header with title, collapse caret and close button
	const header = document.createElement('div');
	header.style.display = 'flex';
	header.style.justifyContent = 'space-between';
	header.style.alignItems = 'center';
	header.style.padding = '10px';
	header.style.cursor = 'move'; // Indicate draggable
	header.style.borderBottom = '1px solid #444';
	header.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
	header.style.position = 'relative'; // Add positioning for proper layout
	header.style.overflow = 'visible'; // Ensure close button is never cut off
	header.style.width = '100%';
	
	// Create left section with caret and title
	const leftSection = document.createElement('div');
	leftSection.style.display = 'flex';
	leftSection.style.alignItems = 'center';
	leftSection.style.overflow = 'hidden'; // Prevent overflow
	leftSection.style.flexGrow = '1'; // Let left section take available space
	leftSection.style.width = '100%'; // Take full width

	// Add collapse caret
	const caret = document.createElement('span');
	caret.textContent = startCollapsed ? '►' : '▼'; // Down arrow for expanded, right for collapsed
	caret.style.marginRight = '5px';
	caret.style.cursor = 'pointer';
	caret.style.fontSize = '10px';
	caret.style.color = '#aaa';
	caret.style.transition = 'transform 0.2s';
	caret.style.flexShrink = '0'; // Don't allow caret to shrink
	leftSection.appendChild(caret);

	// Add title
	const titleElement = document.createElement('div');
	titleElement.className = 'panel-title';
	titleElement.textContent = title;
	titleElement.style.fontWeight = 'bold';
	titleElement.style.overflow = 'hidden'; // Prevent overflow
	titleElement.style.textOverflow = 'ellipsis'; // Show ellipsis if title is too long
	titleElement.style.whiteSpace = 'nowrap'; // Keep title on one line
	leftSection.appendChild(titleElement);
	header.appendChild(leftSection);
	
	// Add header to container
	container.appendChild(header);

	// Content container (everything except the header)
	const contentContainer = document.createElement('div');
	contentContainer.className = 'panel-content';
	contentContainer.style.padding = '10px';
	contentContainer.style.paddingTop = '5px';
	contentContainer.style.paddingRight = '18px'; // Increased space for scrollbar
	contentContainer.style.display = startCollapsed ? 'none' : 'block';
	contentContainer.style.overflowY = 'auto'; // Changed from 'scroll' to 'auto'
	contentContainer.style.overflowX = 'hidden';
	contentContainer.style.boxSizing = 'border-box'; // Make sure padding is included in width
	contentContainer.style.maxHeight = 'calc(100vh - 120px)'; // Default max height
	contentContainer.style.flexGrow = '1'; // Allow content to grow and fill space
	
	// Add content to container
	container.appendChild(contentContainer);
	
	// Add very explicit scrollbar styles
	const scrollStyles = document.createElement('style');
	scrollStyles.textContent = `
		#${id} .panel-content {
			overflow-y: auto !important; /* Changed from scroll to auto */
			overflow-x: hidden !important;
			transition: max-height 0.2s ease;
			scrollbar-width: thin; /* For Firefox */
			-ms-overflow-style: -ms-autohiding-scrollbar; /* For IE/Edge */
			box-sizing: border-box;
			width: 100%; /* Ensure it doesn't expand beyond container */
		}
		#${id} .panel-content::-webkit-scrollbar {
			width: 8px !important; /* Smaller scrollbar */
			background-color: transparent !important; /* Make background transparent */
		}
		#${id} .panel-content::-webkit-scrollbar-thumb {
			background-color: rgba(102, 102, 102, 0.5) !important; /* Semi-transparent thumb */
			border-radius: 4px !important;
		}
		#${id} .panel-content::-webkit-scrollbar-thumb:hover {
			background-color: rgba(136, 136, 136, 0.7) !important;
		}
		#${id} .panel-content::-webkit-scrollbar-track {
			background-color: transparent !important;
		}
		#${id} .panel-content > div,
		#${id} .manual-uv-controls,
		#${id} .uv-info-container,
		#${id} [class*="controls"],
		#${id} [id*="controls"] {
			overflow: visible !important;
			max-height: none !important;
			/* Force all child elements to take natural height */
		}
		/* Style for when scrollbar is needed */
		#${id} .panel-content.needs-scrollbar {
			overflow-y: scroll !important;
		}
		#${id} .panel-content.needs-scrollbar::-webkit-scrollbar-thumb {
			background-color: rgba(102, 102, 102, 0.8) !important;
		}
		
		/* Special styling for the Atlas Visualization panel */
		${id === 'atlas-visualization' ? `
		#atlas-visualization canvas {
			display: block;
			max-width: 100%;
			height: auto;
		}
		#atlas-visualization .coords-text,
		#atlas-visualization .segment-info {
			margin-right: 10px; /* Give room for scrollbar */
		}
		` : ''}
		
		/* Special styling for the UV Channel panel */
		${id === 'uv-channel-panel' ? `
		#uv-channel-panel input,
		#uv-channel-panel select {
			max-width: calc(100% - 10px); /* Prevent controls from overflowing */
		}
		` : ''}
	`;
	document.head.appendChild(scrollStyles);

	// Add click event for collapsing/expanding
	caret.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		const isCollapsed = contentContainer.style.display === 'none';
		if (isCollapsed) {
			// Expand
			contentContainer.style.display = 'block';
			caret.textContent = '▼';
			header.style.borderBottom = '1px solid #444';
			setTimeout(() => updateScrollableHeight(container), 50);
		} else {
			// Collapse
			contentContainer.style.display = 'none';
			caret.textContent = '►';
			header.style.borderBottom = 'none';
			// Just set height to header height
			container.style.height = `${header.offsetHeight}px`;
		}
	});

	// Make the container draggable
	makeDraggableWithMagnetism(container, position);
    
	// Track this panel for resize handling
	allMovablePanels.add(container);
    
	// Initial update of scrollable height
	setTimeout(() => updateScrollableHeight(container), 100);

	// Return the container and important elements for further manipulation
	return {
		container,
		header,
		contentContainer
	};
}

/**
 * Update the scrollable height of a panel based on screen position
 * @param {HTMLElement} panel - The panel element to update
 */
function updateScrollableHeight(panel) {
	const rect = panel.getBoundingClientRect();
	const contentContainer = panel.querySelector('.panel-content');
	const header = panel.querySelector('div:first-child');
	
	if (!contentContainer || !header) return;
	
	// Special handling for Atlas Visualization panel
	const isAtlasPanel = panel.id === 'atlas-visualization';
	
	// Get window dimensions
	const windowHeight = window.innerHeight;
	const headerHeight = header.offsetHeight;
	
	// Calculate content height differently for Atlas panel
	let realContentHeight = 0;
	
	if (isAtlasPanel) {
		// For Atlas panel, consider canvas height + info text
		const canvas = panel.querySelector('canvas');
		const infoTexts = panel.querySelectorAll('.coords-text, .segment-info');
		
		realContentHeight = (canvas ? canvas.offsetHeight : 0) + 20; // Canvas + margin
		
		// Add height of info texts
		infoTexts.forEach(text => {
			realContentHeight += text.offsetHeight + 5; // Add some spacing
		});
	} else {
		// For other panels, calculate based on all children
		realContentHeight = Array.from(contentContainer.children)
			.reduce((total, child) => total + (child.offsetHeight || 0), 0) + 20; // Add 20px buffer
	}
	
	// Default - show all content within viewport
	let availableHeight = windowHeight;
	let isOffscreen = false;
	
	// Check if panel extends beyond screen edges - we still need to detect this for scrollbar purposes
	if (rect.top < 0) {
		availableHeight += rect.top;
		isOffscreen = true;
	}
	
	if (rect.bottom > windowHeight) {
		availableHeight -= (rect.bottom - windowHeight);
		isOffscreen = true;
	}
	
	// Check if panel extends beyond horizontal screen edges too
	if (rect.left < 0 || rect.right > window.innerWidth) {
		isOffscreen = true;
	}
	
	// Apply debug visualization if enabled
	applyOffscreenIndicator(panel, isOffscreen);
	
	// Ensure minimum height (always leave room for at least some content)
	availableHeight = Math.max(150, availableHeight);
	
	// Calculate content area height
	const contentHeight = availableHeight - headerHeight - 20;
	
	// Store current scroll position to restore after adjustments
	const scrollTop = contentContainer.scrollTop;
	
	// Special handling for atlas panel - ensure consistent height
	if (isAtlasPanel) {
		// Force a minimum height for atlas visualization
		contentContainer.style.minHeight = '100px';
		
		// Always size atlas panel to fit content when not off-screen
		if (!isOffscreen) {
			availableHeight = Math.min(windowHeight - 40, realContentHeight + headerHeight + 20);
		}
	}
	
	// ONLY show scrollbar when needed (content taller than container)
	const needsScrollbar = realContentHeight > contentHeight;
	
	// Apply max height to content container only (not the entire panel)
	contentContainer.style.maxHeight = `${Math.max(100, contentHeight)}px`;
	
	// Apply appropriate overflow style (with a small delay to prevent flickering)
	if (needsScrollbar) {
		// Ensure we're using the right overflow mode
		contentContainer.style.overflowY = 'scroll';
		contentContainer.classList.add('needs-scrollbar');
		
		// For atlas panel, make scrollbar more prominent
		if (isAtlasPanel) {
			contentContainer.style.paddingRight = '15px';
		}
		
		// Add mouse wheel event handler for smoother scrolling
		if (!contentContainer.hasAttribute('data-scroll-handler-added')) {
			contentContainer.setAttribute('data-scroll-handler-added', 'true');
			
			// Improve wheel scrolling
			contentContainer.addEventListener('wheel', (e) => {
				if (contentContainer.classList.contains('needs-scrollbar')) {
					const delta = e.deltaY || e.detail || e.wheelDelta;
					contentContainer.scrollTop += delta > 0 ? 40 : -40;
					e.preventDefault();
				}
			}, { passive: false });
		}
	} else {
		contentContainer.style.overflowY = 'hidden';
		contentContainer.classList.remove('needs-scrollbar');
		
		// Reset padding for atlas panel
		if (isAtlasPanel) {
			contentContainer.style.paddingRight = '10px';
		}
	}
	
	// Restore scroll position
	contentContainer.scrollTop = scrollTop;
	
	// Adjust overall panel height - MODIFIED to prevent resize when off-screen
	// Regardless of on-screen or off-screen, we keep the panel's natural height
	panel.style.height = 'auto';
	panel.style.maxHeight = 'calc(100vh - 40px)';
	
	// Log position info if debug logging enabled
	if (UIDebugFlags.logPositionInfo) {
		console.log(`Panel ${panel.id} position:`, {
			rect,
			isOffscreen,
			viewportDimensions: { width: window.innerWidth, height: window.innerHeight }
		});
	}
}

/**
 * Apply visual indicator for off-screen panels
 * @param {HTMLElement} panel - The panel to check and apply indicator to
 * @param {boolean} isOffscreen - Whether the panel is detected as being off-screen
 */
function applyOffscreenIndicator(panel, isOffscreen) {
	// Only apply if debug flag is enabled
	if (!UIDebugFlags.showOffscreenIndicators) {
		// Remove any existing indicator
		const existingIndicator = panel.querySelector('.offscreen-indicator');
		if (existingIndicator) {
			panel.removeChild(existingIndicator);
		}
		return;
	}
	
	// Get or create the offscreen indicator
	let indicator = panel.querySelector('.offscreen-indicator');
	
	if (isOffscreen) {
		// Create indicator if it doesn't exist
		if (!indicator) {
			indicator = document.createElement('div');
			indicator.className = 'offscreen-indicator';
			indicator.style.position = 'absolute';
			indicator.style.top = '0';
			indicator.style.left = '0';
			indicator.style.right = '0';
			indicator.style.bottom = '0';
			indicator.style.backgroundColor = 'rgba(255, 0, 0, ' + UIDebugFlags.offscreenIndicatorOpacity + ')';
			indicator.style.pointerEvents = 'none'; // Don't block interactions
			indicator.style.zIndex = '10000'; // Above panel content
			
			// Add text label
			const label = document.createElement('div');
			label.textContent = 'OFFSCREEN DETECTED';
			label.style.position = 'absolute';
			label.style.top = '50%';
			label.style.left = '50%';
			label.style.transform = 'translate(-50%, -50%)';
			label.style.color = 'white';
			label.style.fontWeight = 'bold';
			label.style.textShadow = '1px 1px 2px black';
			indicator.appendChild(label);
			
			panel.appendChild(indicator);
		}
	} else if (indicator) {
		// Remove indicator if panel is not offscreen
		panel.removeChild(indicator);
	}
}

// Replace the old check visibility function
/**
 * Check visibility of a panel and add scrollbars if needed
 * @param {HTMLElement} element - The panel to check
 */
function checkVisibilityAndAddScroll(element) {
	if (!element || !document.body.contains(element)) {
		return;
	}
	
	// Call the updated function that includes offscreen detection
	updateScrollableHeight(element);
}

// Track all created movable panels for global resize handling
const allMovablePanels = new Set();

// Add window resize handler to update scrollbars on all panels
window.addEventListener('resize', () => {
	allMovablePanels.forEach(panel => {
		if (panel && document.body.contains(panel)) {
			checkVisibilityAndAddScroll(panel);
		} else {
			// Clean up references to removed panels
			allMovablePanels.delete(panel);
		}
	});
});

/**
 * Make an element draggable with magnetism to its default position
 * @param {HTMLElement} element - The element to make draggable
 * @param {Object} defaultPosition - Default position {top, right, bottom, left}
 */
function makeDraggableWithMagnetism(element, defaultPosition) {
	let isDragging = false;
	let offset = { x: 0, y: 0 };
	let initialRect = null;
    
	// Magnetism threshold in pixels (distance at which to snap back)
	const magnetThreshold = 50;
    
	const header = element.querySelector('div:first-child');
	if (!header) return;
    
	// Store initial position to prevent window scroll from affecting dragged panels
	/**
	 *
	 */
	function storeInitialPosition() {
		// Store relative position to viewport for scroll correction
		const rect = element.getBoundingClientRect();
		initialRect = {
			left: rect.left,
			top: rect.top,
			width: rect.width,
			height: rect.height
		};
	}
    
	// Mouse down handler
	header.addEventListener('mousedown', (e) => {
		isDragging = true;
		storeInitialPosition();
		offset.x = e.clientX - element.offsetLeft;
		offset.y = e.clientY - element.offsetTop;
		// Add a class to indicate dragging
		element.style.opacity = '0.8';
		// Prevent default to avoid text selection while dragging
		e.preventDefault();
	});
    
	// Mouse move handler
	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		const left = e.clientX - offset.x;
		const top = e.clientY - offset.y;
        
		// Allow dragging beyond window bounds
		element.style.left = left + 'px';
		element.style.top = top + 'px';
        
		// Ensure bottom and right positions are cleared when dragging
		element.style.bottom = 'auto';
		element.style.right = 'auto';
	});
    
	// Mouse up handler with magnetism
	document.addEventListener('mouseup', () => {
		if (!isDragging) return;
		isDragging = false;
		element.style.opacity = '1';
        
		// Get current position
		const rect = element.getBoundingClientRect();
        
		// Check if default position uses bottom/right or top/left
		let shouldSnapBack = false;
        
		if (defaultPosition.bottom !== undefined && defaultPosition.left !== undefined) {
			// Bottom-left positioning
			const left = rect.left;
			const bottom = window.innerHeight - rect.bottom;
			const isCloseToDefaultX = Math.abs(left - parseInt(defaultPosition.left)) < magnetThreshold;
			const isCloseToDefaultY = Math.abs(bottom - parseInt(defaultPosition.bottom)) < magnetThreshold;
			shouldSnapBack = isCloseToDefaultX && isCloseToDefaultY;
            
			if (shouldSnapBack) {
				// Animate back to default position
				element.style.transition = 'left 0.3s ease, bottom 0.3s ease, top 0.3s ease';
				element.style.left = defaultPosition.left;
				element.style.bottom = defaultPosition.bottom;
				element.style.top = 'auto';
			}
		} else if (defaultPosition.top !== undefined && defaultPosition.right !== undefined) {
			// Top-right positioning
			const right = window.innerWidth - rect.right;
			const top = rect.top;
			const isCloseToDefaultX = Math.abs(right - parseInt(defaultPosition.right)) < magnetThreshold;
			const isCloseToDefaultY = Math.abs(top - parseInt(defaultPosition.top)) < magnetThreshold;
			shouldSnapBack = isCloseToDefaultX && isCloseToDefaultY;
            
			if (shouldSnapBack) {
				element.style.transition = 'right 0.3s ease, top 0.3s ease, left 0.3s ease';
				element.style.right = defaultPosition.right;
				element.style.top = defaultPosition.top;
				element.style.left = 'auto';
			}
		} else if (defaultPosition.top !== undefined && defaultPosition.left !== undefined) {
			// Top-left positioning
			const left = rect.left;
			const top = rect.top;
			const isCloseToDefaultX = Math.abs(left - parseInt(defaultPosition.left)) < magnetThreshold;
			const isCloseToDefaultY = Math.abs(top - parseInt(defaultPosition.top)) < magnetThreshold;
			shouldSnapBack = isCloseToDefaultX && isCloseToDefaultY;
            
			if (shouldSnapBack) {
				element.style.transition = 'left 0.3s ease, top 0.3s ease';
				element.style.left = defaultPosition.left;
				element.style.top = defaultPosition.top;
			}
		}
        
		// Reset the transition after animation
		if (shouldSnapBack) {
			setTimeout(() => {
				element.style.transition = '';
				// Only check visibility if the panel snaps back
				checkVisibilityAndAddScroll(element);
			}, 300);
		} else {
			// Only check scrollbar needs when position has changed
			// Check if the panel now needs a scrollbar based on new position
			checkVisibilityAndAddScroll(element);
		}
		
		initialRect = null; // Clear stored position
	});
}

/**
 * Create a styled button
 * @param {Object} options - Button options
 * @param {string} options.text - Button text
 * @param {string} options.color - Button color (default: '#3498db')
 * @param {function} options.onClick - Click handler
 * @returns {HTMLElement} The created button
 */
export function createButton(options) {
	const {
		text,
		color = '#3498db',
		onClick
	} = options;
    
	const button = document.createElement('button');
	button.textContent = text;
	button.className = 'debug-button';
	button.style.width = '100%';
	button.style.padding = '8px';
	button.style.margin = '5px 0';
	button.style.backgroundColor = color;
	button.style.border = 'none';
	button.style.borderRadius = '3px';
	button.style.color = 'white';
	button.style.cursor = 'pointer';
	button.style.fontWeight = 'bold';
    
	if (onClick && typeof onClick === 'function') {
		button.addEventListener('click', onClick);
	}
    
	return button;
}

/**
 * Create a label for controls
 * @param {string} text - Label text
 * @returns {HTMLElement} The created label
 */
export function createLabel(text) {
	const label = document.createElement('div');
	label.textContent = text;
	label.style.fontSize = '12px';
	label.style.fontWeight = 'bold';
	label.style.color = '#95a5a6';
	label.style.marginTop = '10px';
	label.style.marginBottom = '5px';
	return label;
}

/**
 * Create a dropdown select control
 * @param {Object} options - Dropdown options
 * @param {string} options.id - Element ID
 * @param {Array} options.items - Array of {value, text} objects
 * @param {string|number} options.selectedValue - Initially selected value
 * @param {function} options.onChange - Change handler
 * @returns {HTMLElement} The created select element
 */
export function createDropdown(options) {
	const {
		id,
		items,
		selectedValue,
		onChange
	} = options;
    
	const select = document.createElement('select');
	select.id = id;
	select.style.width = '100%';
	select.style.backgroundColor = '#333';
	select.style.color = 'white';
	select.style.padding = '8px';
	select.style.border = '1px solid #555';
	select.style.borderRadius = '3px';
	select.style.marginBottom = '10px';
	select.style.cursor = 'pointer';
    
	// Add options
	items.forEach(item => {
		const option = document.createElement('option');
		option.value = item.value;
		option.textContent = item.text;
		select.appendChild(option);
	});
    
	// Set selected value if provided
	if (selectedValue !== undefined) {
		select.value = selectedValue;
	}
    
	// Add change event listener
	if (onChange && typeof onChange === 'function') {
		select.addEventListener('change', onChange);
	}
    
	return select;
}

/**
 * Setup essential panel event handlers without intervals
 */
function setupPanelEventHandlers() {
	// ONLY check scroll on window resize - no intervals
	window.addEventListener('resize', () => {
		allMovablePanels.forEach(panel => {
			if (panel && document.body.contains(panel) && panel.style.display !== 'none') {
				checkVisibilityAndAddScroll(panel);
			} else if (!document.body.contains(panel)) {
				allMovablePanels.delete(panel);
			}
		});
	});
    
	// Clean up on page unload
	window.addEventListener('beforeunload', () => {
		allMovablePanels.clear();
	});
}

// Run setup once on load
if (typeof window !== 'undefined') {
	if (document.readyState === 'complete') {
		setupPanelEventHandlers();
	} else {
		window.addEventListener('load', setupPanelEventHandlers);
	}
}

/**
 * Export functions to control debugging visualization
 */
export function toggleOffscreenIndicators() {
	UIDebugFlags.showOffscreenIndicators = !UIDebugFlags.showOffscreenIndicators;
	
	// Update all panels immediately
	allMovablePanels.forEach(panel => {
		if (panel && document.body.contains(panel)) {
			checkVisibilityAndAddScroll(panel);
		}
	});
	
	return UIDebugFlags.showOffscreenIndicators;
}

/**
 * Set the opacity for offscreen indicators
 * @param {number} opacity - Value between 0 and 1
 */
export function setOffscreenIndicatorOpacity(opacity) {
	if (opacity >= 0 && opacity <= 1) {
		UIDebugFlags.offscreenIndicatorOpacity = opacity;
		
		// Update existing indicators
		document.querySelectorAll('.offscreen-indicator').forEach(indicator => {
			indicator.style.backgroundColor = `rgba(255, 0, 0, ${opacity})`;
		});
		
		return UIDebugFlags.offscreenIndicatorOpacity;
	}
	
	console.warn('Opacity must be between 0 and 1');
	return UIDebugFlags.offscreenIndicatorOpacity;
}

/**
 * Toggle position information logging
 */
export function togglePositionLogging() {
	UIDebugFlags.logPositionInfo = !UIDebugFlags.logPositionInfo;
	return UIDebugFlags.logPositionInfo;
} 