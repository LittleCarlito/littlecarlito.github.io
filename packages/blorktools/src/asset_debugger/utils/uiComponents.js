// UI Components Utility Module
// Reusable UI creation patterns for the asset debugger
import { UIDebugFlags } from './flags.js';

// Check if localStorage is available (for private browsing support)
const isLocalStorageAvailable = (() => {
	try {
		const test = 'test';
		localStorage.setItem(test, test);
		localStorage.removeItem(test);
		return true;
	} catch (e) {
		return false;
	}
})();

// Track all created movable panels for global management
const allMovablePanels = new Set();

// Memory storage fallback when localStorage isn't available
const memoryStorage = new Map();

// Safe storage functions that work in both regular and private browsing
const safeStorage = {
	getItem(key) {
		if (isLocalStorageAvailable) {
			return localStorage.getItem(key);
		}
		return memoryStorage.get(key);
	},
	setItem(key, value) {
		if (isLocalStorageAvailable) {
			try {
				localStorage.setItem(key, value);
			} catch (e) {
				memoryStorage.set(key, value);
			}
		} else {
			memoryStorage.set(key, value);
		}
	}
};

// Panel type definitions for specialized handling
const PANEL_TYPES = {
	DEFAULT: 'default',
	UV_CHANNEL: 'uv-channel',
	ATLAS_VISUALIZATION: 'atlas-visualization'
};

// Panel configuration presets
const PANEL_CONFIGS = {
	[PANEL_TYPES.DEFAULT]: {
		minHeight: 100,
		maxHeight: 600,
		defaultHeight: null, // Will be calculated based on content
		fixedHeight: false
	},
	[PANEL_TYPES.UV_CHANNEL]: {
		minHeight: 400,
		maxHeight: 600,
		defaultHeight: 500, // Fixed reasonable size
		fixedHeight: true
	},
	[PANEL_TYPES.ATLAS_VISUALIZATION]: {
		minHeight: 200,
		maxHeight: 800,
		defaultHeight: null,
		fixedHeight: false
	}
};

/**
 * Panel Manager - handles global panel operations
 */
const PanelManager = {
	/**
	 * Initialize the panel management system
	 */
	init() {
		// Set up resize listener
		window.addEventListener('resize', this.handleWindowResize.bind(this));
		
		// Create periodic check for panel visibility
		setInterval(this.checkPanelsVisibility.bind(this), 1000);
		
		console.log('Panel Manager initialized');
	},
	
	/**
	 * Handle window resize events
	 */
	handleWindowResize() {
		this.refreshAllPanels();
	},
	
	/**
	 * Refresh all panels to update their visibility and sizing
	 * @param {boolean} force - Whether to force update even for invisible panels
	 */
	refreshAllPanels(force = false) {
		allMovablePanels.forEach(panel => {
			if (panel && document.body.contains(panel)) {
				if (force || panel.style.display !== 'none') {
					panel._panelConfig.updatePanelLayout(panel);
				}
			} else {
				// Clean up references to removed panels
				allMovablePanels.delete(panel);
			}
		});
	},
	
	/**
	 * Check if panels are visible and properly positioned
	 */
	checkPanelsVisibility() {
		allMovablePanels.forEach(panel => {
			if (panel && document.body.contains(panel) && panel.style.display !== 'none') {
				this.checkPanelVisibility(panel);
			}
		});
	},
	
	/**
	 * Check visibility of a specific panel
	 * @param {HTMLElement} panel - The panel to check
	 */
	checkPanelVisibility(panel) {
		const rect = panel.getBoundingClientRect();
		
		// Get window dimensions
		const windowHeight = window.innerHeight;
		const windowWidth = window.innerWidth;
		
		// Check if panel extends beyond screen edges
		const isOffscreenTop = rect.top < 0;
		const isOffscreenBottom = rect.bottom > windowHeight;
		const isOffscreenLeft = rect.left < 0;
		const isOffscreenRight = rect.right > windowWidth;
		const isOffscreen = isOffscreenTop || isOffscreenBottom || isOffscreenLeft || isOffscreenRight;
		
		// Apply visual indicator for offscreen panels
		applyOffscreenIndicator(panel, isOffscreen);
		
		// Log position info if enabled
		if (UIDebugFlags.logPositionInfo && isOffscreen) {
			console.log(`Panel ${panel.id} offscreen status:`, {
				top: isOffscreenTop ? `${Math.abs(rect.top)}px above viewport` : 'in view',
				bottom: isOffscreenBottom ? `${Math.abs(rect.bottom - windowHeight)}px below viewport` : 'in view',
				left: isOffscreenLeft ? `${Math.abs(rect.left)}px left of viewport` : 'in view',
				right: isOffscreenRight ? `${Math.abs(rect.right - windowWidth)}px right of viewport` : 'in view'
			});
		}
	},
	
	/**
	 * Register a panel with the manager
	 * @param {HTMLElement} panel - The panel to register
	 */
	registerPanel(panel) {
		allMovablePanels.add(panel);
	}
};

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
		position = { top: '20px', right: '20px' },
		width = '300px',
		startCollapsed = false
	} = options;
	
	// Determine panel type based on ID
	let panelType = PANEL_TYPES.DEFAULT;
	if (id === 'uv-channel-panel') panelType = PANEL_TYPES.UV_CHANNEL;
	if (id === 'atlas-visualization') panelType = PANEL_TYPES.ATLAS_VISUALIZATION;
	
	// Get configuration for this panel type
	const config = PANEL_CONFIGS[panelType];
	
	// Create container
	const container = document.createElement('div');
	container.id = id;
	container.style.position = 'absolute';
	container.style.width = width;
	container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
	container.style.border = '1px solid #666';
	container.style.borderRadius = '5px';
	container.style.color = 'white';
	container.style.fontFamily = 'monospace';
	container.style.fontSize = '12px';
	container.style.zIndex = '1000';
	container.style.boxSizing = 'border-box';
	container.style.overflow = 'hidden';
	container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
	container.style.display = 'flex';
	container.style.flexDirection = 'column';
	
	// Convert bottom position to top position for consistent behavior
	if (position.bottom !== undefined && position.top === undefined) {
		// Store original position for reference
		container._originalPosition = { ...position };
		
		// We'll need to calculate the top position after the panel is in the DOM
		setTimeout(() => {
			// If the panel is already in the DOM, calculate top position
			if (document.body.contains(container)) {
				const windowHeight = window.innerHeight;
				const bottomPosition = parseInt(position.bottom, 10);
				const panelHeight = container.offsetHeight;
				
				// Set top position instead of bottom
				container.style.top = (windowHeight - panelHeight - bottomPosition) + 'px';
				container.style.bottom = '';
			}
		}, 100);
	}
	
	// Apply position
	Object.keys(position).forEach(key => {
		container.style[key] = position[key];
	});
	
	// Create header with title and collapse caret
	const header = document.createElement('div');
	header.style.display = 'flex';
	header.style.justifyContent = 'space-between';
	header.style.alignItems = 'center';
	header.style.padding = '10px';
	header.style.cursor = 'move';
	header.style.borderBottom = '1px solid #444';
	header.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
	header.style.position = 'relative';
	header.style.overflow = 'visible';
	header.style.width = '100%';
	
	// Create left section with caret and title
	const leftSection = document.createElement('div');
	leftSection.style.display = 'flex';
	leftSection.style.alignItems = 'center';
	leftSection.style.overflow = 'hidden';
	leftSection.style.flexGrow = '1';
	leftSection.style.width = '100%';
	
	// Add collapse caret
	const caret = document.createElement('span');
	caret.textContent = startCollapsed ? '►' : '▼';
	caret.style.marginRight = '5px';
	caret.style.cursor = 'pointer';
	caret.style.fontSize = '10px';
	caret.style.color = '#aaa';
	caret.style.transition = 'transform 0.2s';
	caret.style.flexShrink = '0';
	caret.className = 'panel-collapse-caret';
	leftSection.appendChild(caret);
	
	// Add title
	const titleElement = document.createElement('div');
	titleElement.className = 'panel-title';
	titleElement.textContent = title;
	titleElement.style.fontWeight = 'bold';
	titleElement.style.overflow = 'hidden';
	titleElement.style.textOverflow = 'ellipsis';
	titleElement.style.whiteSpace = 'nowrap';
	titleElement.style.cursor = 'pointer';
	leftSection.appendChild(titleElement);
	header.appendChild(leftSection);
	
	// Add a right section for additional controls
	const rightSection = document.createElement('div');
	rightSection.style.display = 'flex';
	rightSection.style.alignItems = 'center';
	rightSection.style.marginLeft = 'auto';
	
	// Close button (X)
	const closeButton = document.createElement('span');
	closeButton.textContent = '✕';
	closeButton.style.marginLeft = '8px';
	closeButton.style.cursor = 'pointer';
	closeButton.style.fontSize = '12px';
	closeButton.style.color = '#aaa';
	closeButton.style.padding = '2px 4px';
	closeButton.style.borderRadius = '3px';
	closeButton.addEventListener('mouseenter', () => {
		closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
	});
	closeButton.addEventListener('mouseleave', () => {
		closeButton.style.backgroundColor = 'transparent';
	});
	closeButton.addEventListener('click', (e) => {
		e.stopPropagation();
		container.style.display = 'none';
	});
	rightSection.appendChild(closeButton);
	header.appendChild(rightSection);
	
	// Add header to container
	container.appendChild(header);
	
	// Content container (everything except the header)
	const contentContainer = document.createElement('div');
	contentContainer.className = 'panel-content';
	contentContainer.style.padding = '10px';
	contentContainer.style.paddingTop = '5px';
	contentContainer.style.paddingRight = '18px';
	contentContainer.style.display = startCollapsed ? 'none' : 'block';
	contentContainer.style.overflowY = 'auto';
	contentContainer.style.overflowX = 'hidden';
	contentContainer.style.boxSizing = 'border-box';
	
	// Apply type-specific styles
	if (config.fixedHeight && config.defaultHeight) {
		// Fixed height panels (like UV Channel panel)
		contentContainer.style.height = `${config.defaultHeight}px`;
		contentContainer.style.maxHeight = `${config.defaultHeight}px`;
		contentContainer.style.minHeight = `${config.defaultHeight}px`;
		
		if (panelType === PANEL_TYPES.UV_CHANNEL) {
			// Remove transitions for UV panel to prevent animation
			contentContainer.style.transition = 'none';
		}
	} else {
		// Flexible panels
		contentContainer.style.maxHeight = 'calc(100vh - 120px)';
		contentContainer.style.flexGrow = '1';
	}
	
	// Add content to container
	container.appendChild(contentContainer);
	
	// Add panel-specific CSS
	const scrollStyles = document.createElement('style');
	scrollStyles.textContent = `
		#${id} .panel-content {
			overflow-y: auto !important;
			overflow-x: hidden !important;
			scrollbar-width: thin;
			-ms-overflow-style: -ms-autohiding-scrollbar;
			box-sizing: border-box;
			width: 100%;
		}
		#${id} .panel-content::-webkit-scrollbar {
			width: 8px !important;
			background-color: transparent !important;
		}
		#${id} .panel-content::-webkit-scrollbar-thumb {
			background-color: rgba(102, 102, 102, 0.5) !important;
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
		}
		#${id} .panel-content.needs-scrollbar {
			overflow-y: scroll !important;
		}
		#${id} .panel-content.needs-scrollbar::-webkit-scrollbar-thumb {
			background-color: rgba(102, 102, 102, 0.8) !important;
		}
		
		${panelType === PANEL_TYPES.ATLAS_VISUALIZATION ? `
		#atlas-visualization canvas {
			display: block;
			max-width: 100%;
			height: auto;
		}
		#atlas-visualization .coords-text,
		#atlas-visualization .segment-info {
			margin-right: 10px;
		}
		` : ''}
		
		${panelType === PANEL_TYPES.UV_CHANNEL ? `
		#uv-channel-panel input,
		#uv-channel-panel select {
			max-width: calc(100% - 10px);
		}
		#uv-channel-panel {
			height: auto !important;
			transition: none !important;
		}
		#uv-channel-panel .panel-content {
			transition: none !important;
		}
		` : ''}
	`;
	document.head.appendChild(scrollStyles);
	
	// Create Panel Configuration object to manage this panel
	const panelConfig = {
		type: panelType,
		config: config,
		
		/**
		 * Update panel layout based on content and current state
		 * @param {HTMLElement} panel - The panel to update
		 */
		updatePanelLayout(panel) {
			const contentContainer = panel.querySelector('.panel-content');
			const header = panel.querySelector('div:first-child');
			
			if (!contentContainer || !header) return;
			
			// Skip height calculations for fixed height panels
			if (this.config.fixedHeight) {
				// Only update scrollbar visibility
				if (contentContainer.scrollHeight > contentContainer.clientHeight) {
					contentContainer.style.overflowY = 'auto';
					contentContainer.classList.add('needs-scrollbar');
				}
				return;
			}
			
			// For flexible panels, calculate appropriate height
			const windowHeight = window.innerHeight;
			
			// Calculate content height (all children + padding)
			const realContentHeight = Array.from(contentContainer.children)
				.reduce((total, child) => total + (child.offsetHeight || 0), 0) + 20;
			
			// Get or calculate appropriate max height
			const contentMaxHeight = Math.min(this.config.maxHeight, windowHeight - 80);
			
			// Remember scroll position
			const scrollTop = contentContainer.scrollTop;
			
			// Set max height on content container
			contentContainer.style.maxHeight = `${contentMaxHeight}px`;
			
			// Show scrollbar if content won't fit
			const needsScrollbar = realContentHeight > contentMaxHeight;
			
			// Apply scrollbar style
			if (needsScrollbar) {
				contentContainer.style.overflowY = 'scroll';
				contentContainer.classList.add('needs-scrollbar');
				
				// Ensure smooth scrolling is added
				addSmoothScrolling(contentContainer);
			} else {
				contentContainer.style.overflowY = 'hidden';
				contentContainer.classList.remove('needs-scrollbar');
			}
			
			// Restore scroll position
			contentContainer.scrollTop = scrollTop;
		},
		
		/**
		 * Toggle panel collapse state
		 */
		toggleCollapse() {
			const contentContainer = container.querySelector('.panel-content');
			const header = container.querySelector('div:first-child');
			const caret = header.querySelector('.panel-collapse-caret');
			const isCollapsed = contentContainer.style.display === 'none';
			
			// Save the original position
			const rect = container.getBoundingClientRect();
			const hasBottomPosition = container.style.bottom !== '';
			
			if (isCollapsed) {
				// Expand
				contentContainer.style.display = 'block';
				if (caret) caret.textContent = '▼';
				header.style.borderBottom = '1px solid #444';
				// Set to auto height
				container.style.height = 'auto';
				
				// If positioned from bottom, adjust top position to maintain header position
				if (hasBottomPosition) {
					container.style.top = (rect.top) + 'px';
					container.style.bottom = '';
				}
				
				this.updatePanelLayout(container);
			} else {
				// Collapse
				contentContainer.style.display = 'none';
				if (caret) caret.textContent = '►';
				header.style.borderBottom = 'none';
				// Just set height to header height
				container.style.height = `${header.offsetHeight}px`;
				
				// If positioned from bottom, adjust top position to maintain header position
				if (hasBottomPosition) {
					container.style.top = (rect.top) + 'px';
					container.style.bottom = '';
				}
			}
		}
	};
	
	// Store panel config with the container
	container._panelConfig = panelConfig;
	
	// Add click event for collapsing/expanding
	caret.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		panelConfig.toggleCollapse();
	});
	
	// Also allow clicking on title to toggle collapse
	titleElement.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		panelConfig.toggleCollapse();
	});
	
	// Make the container draggable
	makeDraggableWithMagnetism(container, position);
	
	// Register with panel manager
	PanelManager.registerPanel(container);
	
	// Add smooth scrolling to content container
	addSmoothScrolling(contentContainer);
	
	// Initial update of panel layout
	setTimeout(() => panelConfig.updatePanelLayout(container), 100);
	
	// Return the container and important elements for further manipulation
	return {
		container,
		header,
		contentContainer
	};
}

/**
 * Add smooth scrolling to an element
 * @param {HTMLElement} element - The element to add smooth scrolling to
 */
function addSmoothScrolling(element) {
	if (element.hasAttribute('data-smooth-scroll-added')) {
		return;
	}
	
	element.setAttribute('data-smooth-scroll-added', 'true');
	
	element.addEventListener('wheel', (e) => {
		// Only apply custom scrolling when element has scrollbar visible
		if (element.scrollHeight > element.clientHeight) {
			const delta = e.deltaY || e.detail || e.wheelDelta;
			const scrollAmount = delta > 0 ? 40 : -40;
			
			element.scrollTop += scrollAmount;
			e.preventDefault();
		}
	}, { passive: false });
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

/**
 * Make an element draggable with magnetism to its default position
 * @param {HTMLElement} element - The element to make draggable
 * @param {Object} defaultPosition - Default position {top, right, bottom, left}
 */
function makeDraggableWithMagnetism(element, defaultPosition) {
	let dragState = {
		isDragging: false,
		startMouseX: 0,
		startMouseY: 0,
		startElemTop: 0,
		startElemLeft: 0,
		wasDetachedFromRight: false,
		wasDetachedFromBottom: false
	};
	
	// Get the draggable handler (first child - header)
	const dragHandle = element.querySelector('div:first-child');
	
	// Add mouse event listeners
	dragHandle.addEventListener('mousedown', startDrag);
	
	/**
	 *
	 */
	function startDrag(e) {
		// Skip if clicking on interactive elements
		if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
			return;
		}
		
		dragState.isDragging = true;
		
		// Get current position
		const rect = element.getBoundingClientRect();
		
		// Store mouse position
		dragState.startMouseX = e.clientX;
		dragState.startMouseY = e.clientY;
		
		// Store starting element position
		dragState.startElemTop = rect.top;
		dragState.startElemLeft = rect.left;
		
		// Check if the element uses right/bottom positioning
		dragState.wasDetachedFromRight = element.style.right !== '';
		dragState.wasDetachedFromBottom = element.style.bottom !== '';
		
		// Add document event listeners
		document.addEventListener('mousemove', onDrag);
		document.addEventListener('mouseup', stopDrag);
		
		// Prevent default selection behavior
		e.preventDefault();
	}
	
	/**
	 *
	 */
	function onDrag(e) {
		if (!dragState.isDragging) return;
		
		// Calculate how far the mouse has moved
		const dx = e.clientX - dragState.startMouseX;
		const dy = e.clientY - dragState.startMouseY;
		
		// Switch to top/left positioning if using right/bottom
		if (dragState.wasDetachedFromRight) {
			element.style.right = '';
			dragState.wasDetachedFromRight = false;
		}
		
		if (dragState.wasDetachedFromBottom) {
			element.style.bottom = '';
			dragState.wasDetachedFromBottom = false;
		}
		
		// Apply new position
		element.style.top = `${dragState.startElemTop + dy}px`;
		element.style.left = `${dragState.startElemLeft + dx}px`;
		
		// Check for offscreen status after drag
		PanelManager.checkPanelVisibility(element);
	}
	
	/**
	 *
	 */
	function stopDrag() {
		dragState.isDragging = false;
		
		// Remove document event listeners
		document.removeEventListener('mousemove', onDrag);
		document.removeEventListener('mouseup', stopDrag);
		
		// Apply magnetic snapping here if needed
		applyMagneticSnapping(element, defaultPosition);
	}
	
	/**
	 *
	 */
	function applyMagneticSnapping(element, defaultPosition) {
		// Implement magnetic snapping if needed
		// Could snap to edges of screen or default position
	}
}

/**
 * Export the refreshAllPanels function for external use
 * @param {boolean} force - Whether to force update even for invisible panels
 */
export function refreshAllPanels(force = false) {
	PanelManager.refreshAllPanels(force);
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
 * Export functions to control debugging visualization
 */
export function toggleOffscreenIndicators() {
	UIDebugFlags.showOffscreenIndicators = !UIDebugFlags.showOffscreenIndicators;
	
	// Update all panels immediately
	PanelManager.refreshAllPanels(true);
	
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

// Initialize the panel manager
PanelManager.init(); 