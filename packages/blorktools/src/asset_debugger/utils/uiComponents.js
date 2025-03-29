// UI Components Utility Module
// Reusable UI creation patterns for the asset debugger

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
    
	// Add touch support for mobile devices
	addTouchSupport(container, header);
    
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
	
	// Check if panel extends beyond screen edges
	if (rect.top < 0) {
		availableHeight += rect.top;
		isOffscreen = true;
	}
	
	if (rect.bottom > windowHeight) {
		availableHeight -= (rect.bottom - windowHeight);
		isOffscreen = true;
	}
	
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
	
	// Apply height first (to ensure content is measured properly)
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
	
	// Adjust overall panel height
	if (isOffscreen) {
		// When off-screen, constrain to available visible area
		panel.style.height = `${Math.min(windowHeight, availableHeight)}px`;
	} else {
		// When fully visible, let content determine height (up to viewport limit)
		panel.style.height = 'auto';
		panel.style.maxHeight = 'calc(100vh - 40px)';
	}
}

// Replace the old check visibility function
/**
 *
 */
function checkVisibilityAndAddScroll(element) {
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
    
	// Magnetism threshold in pixels (distance at which to snap back)
	const magnetThreshold = 50;
    
	const header = element.querySelector('div:first-child');
	if (!header) return;
    
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
        
		// Allow dragging beyond window bounds (removed restrictions)
		element.style.left = left + 'px';
		element.style.top = top + 'px';
        
		// Ensure bottom position is cleared when dragging by top
		element.style.bottom = 'auto';
		element.style.right = 'auto';
        
		// Don't check scrolling on every mouse move (causes flickering)
		// Instead, only update scrolling when dragging stops
		element.setAttribute('data-needs-scroll-check', 'true');
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
			}, 300);
		}
		
		// Check visibility after snap back
		if (element.getAttribute('data-needs-scroll-check') === 'true') {
			element.removeAttribute('data-needs-scroll-check');
			checkVisibilityAndAddScroll(element);
		}
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

// When a panel is dragged off screen or has a lot of content, make sure scrolling works
/**
 *
 */
function setupScrollForcing() {
	// Use a slower interval to reduce flickering (500ms instead of 1000ms)
	const checkInterval = setInterval(() => {
		allMovablePanels.forEach(panel => {
			if (panel && document.body.contains(panel)) {
				// Only update panels that are visible
				if (panel.style.display !== 'none') {
					checkVisibilityAndAddScroll(panel);
				}
			} else {
				allMovablePanels.delete(panel);
			}
		});
	}, 500);
	
	// Clean up interval when page unloads
	window.addEventListener('beforeunload', () => {
		clearInterval(checkInterval);
	});
}

// Run setup on load
if (typeof window !== 'undefined') {
	// Setup once the DOM is fully loaded
	if (document.readyState === 'complete') {
		setupScrollForcing();
	} else {
		window.addEventListener('load', setupScrollForcing);
	}
}

/**
 * Add touchscreen support to element
 * @param {HTMLElement} element - Element to make touch-draggable
 * @param {HTMLElement} handle - Drag handle element (usually header)
 */
function addTouchSupport(element, handle) {
	let touchStartX = 0;
	let touchStartY = 0;
	let initialLeft = 0;
	let initialTop = 0;
	
	handle.addEventListener('touchstart', (e) => {
		const touch = e.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		initialLeft = element.offsetLeft;
		initialTop = element.offsetTop;
		
		// Indicate dragging
		element.style.opacity = '0.8';
		e.preventDefault();
	});
	
	document.addEventListener('touchmove', (e) => {
		if (!touchStartX && !touchStartY) return;
		
		const touch = e.touches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		
		// Apply new position
		element.style.left = (initialLeft + deltaX) + 'px';
		element.style.top = (initialTop + deltaY) + 'px';
		
		// Update scrolling
		checkVisibilityAndAddScroll(element);
		e.preventDefault();
	});
	
	document.addEventListener('touchend', (e) => {
		touchStartX = 0;
		touchStartY = 0;
		element.style.opacity = '1';
		
		// Update scrolling for final position
		checkVisibilityAndAddScroll(element);
		e.preventDefault();
	});
} 