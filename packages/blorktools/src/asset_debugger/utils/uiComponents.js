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
		startCollapsed = false,
		onClose = null
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
	container.style.overflow = 'hidden';
	container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';

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

	// Create left section with caret and title
	const leftSection = document.createElement('div');
	leftSection.style.display = 'flex';
	leftSection.style.alignItems = 'center';

	// Add collapse caret
	const caret = document.createElement('span');
	caret.textContent = startCollapsed ? '►' : '▼'; // Down arrow for expanded, right for collapsed
	caret.style.marginRight = '5px';
	caret.style.cursor = 'pointer';
	caret.style.fontSize = '10px';
	caret.style.color = '#aaa';
	caret.style.transition = 'transform 0.2s';
	leftSection.appendChild(caret);

	// Add title
	const titleElement = document.createElement('div');
	titleElement.className = 'panel-title';
	titleElement.textContent = title;
	titleElement.style.fontWeight = 'bold';
	leftSection.appendChild(titleElement);
	header.appendChild(leftSection);

	// Add close button
	const closeButton = document.createElement('button');
	closeButton.textContent = '×';
	closeButton.style.background = 'none';
	closeButton.style.border = 'none';
	closeButton.style.color = 'white';
	closeButton.style.fontSize = '16px';
	closeButton.style.cursor = 'pointer';
	closeButton.style.padding = '0 5px';
	header.appendChild(closeButton);
	container.appendChild(header);

	// Content container (everything except the header)
	const contentContainer = document.createElement('div');
	contentContainer.className = 'panel-content';
	contentContainer.style.padding = '10px';
	contentContainer.style.paddingTop = '5px';
	contentContainer.style.display = startCollapsed ? 'none' : 'block'; // Start expanded or collapsed
	container.appendChild(contentContainer);

	// Add click event for collapsing/expanding
	caret.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		const isCollapsed = contentContainer.style.display === 'none';
		if (isCollapsed) {
			// Expand
			contentContainer.style.display = 'block';
			caret.textContent = '▼';
			// Add back the border at the bottom of the header
			header.style.borderBottom = '1px solid #444';
			// Transition to larger height
			container.style.transition = 'height 0.3s ease';
			container.style.height = 'auto';
			// Remove transition after animation completes
			setTimeout(() => {
				container.style.transition = '';
			}, 300);
		} else {
			// Before collapsing, get the header height to set as the new container height
			const headerHeight = header.offsetHeight;
			// Collapse
			contentContainer.style.display = 'none';
			caret.textContent = '►';
			// Remove the border at the bottom of the header when collapsed
			header.style.borderBottom = 'none';
			// Set the container height to just the header height
			container.style.transition = 'height 0.3s ease';
			container.style.height = `${headerHeight}px`;
			// Remove transition after animation completes
			setTimeout(() => {
				container.style.transition = '';
			}, 300);
		}
	});

	// Close button event
	closeButton.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent triggering drag
		container.style.display = 'none';
		if (onClose && typeof onClose === 'function') {
			onClose();
		}
	});

	// Make the container draggable with magnetism
	makeDraggableWithMagnetism(container, position);

	// Return the container and important elements for further manipulation
	return {
		container,
		header,
		contentContainer
	};
}

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