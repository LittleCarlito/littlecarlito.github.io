// Common utility helper functions
// Format file size in KB or MB
export function formatFileSize(bytes) {
	if (bytes < 1024) {
		return bytes + ' bytes';
	} else if (bytes < 1024 * 1024) {
		return (bytes / 1024).toFixed(1) + ' KB';
	} else {
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}
}
// Get file extension
export function getFileExtension(filename) {
	return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}
// Create a DOM element with properties
export function createElement(tag, properties = {}, children = []) {
	const element = document.createElement(tag);
	// Set properties
	Object.entries(properties).forEach(([key, value]) => {
		if (key === 'style' && typeof value === 'object') {
			Object.assign(element.style, value);
		} else if (key === 'className') {
			element.className = value;
		} else if (key === 'textContent') {
			element.textContent = value;
		} else if (key.startsWith('on') && typeof value === 'function') {
			// Event handlers
			const eventName = key.slice(2).toLowerCase();
			element.addEventListener(eventName, value);
		} else {
			// Other properties
			element[key] = value;
		}
	});
	// Add children
	children.forEach(child => {
		if (typeof child === 'string') {
			element.appendChild(document.createTextNode(child));
		} else if (child instanceof Node) {
			element.appendChild(child);
		}
	});
	return element;
}
// Create a collapsible component
export function createCollapsiblePanel({
	id, 
	title, 
	initialPosition = { top: '20px', right: '20px' },
	width = '300px',
	startCollapsed = true,
	magneticSnap = true
}) {
	// Remove any existing panel with the same id
	const existingPanel = document.getElementById(id);
	if (existingPanel) {
		existingPanel.remove();
	}
	// Create container
	const container = createElement('div', {
		id,
		style: {
			position: 'absolute',
			top: initialPosition.top,
			right: initialPosition.right,
			width,
			backgroundColor: 'rgba(0, 0, 0, 0.8)',
			border: '1px solid #666',
			borderRadius: '5px',
			padding: '10px',
			color: 'white',
			fontFamily: 'monospace',
			fontSize: '12px',
			zIndex: '1000',
			cursor: 'move',
			transition: 'opacity 0.3s ease'
		}
	});
	// Create header
	const header = createElement('div', {
		style: {
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: '10px',
			cursor: 'pointer'
		}
	});
	// Title
	const titleElement = createElement('div', {
		textContent: title,
		style: {
			fontWeight: 'bold'
		}
	});
	// Caret
	const caret = createElement('div', {
		textContent: startCollapsed ? '►' : '▼',
		style: {
			marginLeft: '5px',
			transition: 'transform 0.3s ease'
		}
	});
	header.appendChild(titleElement);
	header.appendChild(caret);
	container.appendChild(header);
	// Content container
	const content = createElement('div', {
		id: `${id}-content`,
		style: {
			transition: 'height 0.3s ease, opacity 0.3s ease, max-height 0.4s cubic-bezier(0, 1, 0, 1)',
			overflow: 'hidden',
			opacity: startCollapsed ? '0' : '1',
			height: startCollapsed ? '0' : 'auto',
			maxHeight: startCollapsed ? '0' : '1000px'
		}
	});
	container.appendChild(content);
	// Track state
	const state = {
		isCollapsed: startCollapsed,
		originalPosition: initialPosition,
		mouseDownPosition: null,
		hasDragged: false,
		isDragging: false,
		offsetX: 0, 
		offsetY: 0
	};
	// Toggle collapse state
	function toggleCollapseState() {
		state.isCollapsed = !state.isCollapsed;
		if (state.isCollapsed) {
			// Get the current height for smooth animation
			const currentHeight = content.scrollHeight;
			content.style.height = currentHeight + 'px';
			// Trigger reflow
			content.offsetHeight;
			// Animate to collapsed state
			content.style.height = '0';
			content.style.opacity = '0';
			content.style.maxHeight = '0';
			caret.textContent = '►'; // Right caret (collapsed)
			caret.style.transform = 'rotate(0deg)';
		} else {
			// Get target height for animation
			// Fire onExpand event if provided by the caller
			if (typeof onExpand === 'function') {
				onExpand(content);
			}
			const targetHeight = content.scrollHeight;
			// Start animation
			content.style.maxHeight = '1000px'; // Large enough value
			content.style.height = targetHeight + 'px';
			content.style.opacity = '1';
			caret.textContent = '▼'; // Down caret (expanded)
			caret.style.transform = 'rotate(0deg)';
			// Remove fixed height after animation completes
			setTimeout(() => {
				content.style.height = 'auto';
			}, 400);
		}
	}
	// Drag threshold (pixels of movement to consider it a drag)
	const dragThreshold = 5;
	// Handle header click for collapsing
	header.addEventListener('mousedown', (e) => {
		state.mouseDownPosition = { x: e.clientX, y: e.clientY };
		state.hasDragged = false;
	});
	header.addEventListener('mouseup', (e) => {
		if (!state.mouseDownPosition) return;
		// Calculate distance moved
		const dx = Math.abs(e.clientX - state.mouseDownPosition.x);
		const dy = Math.abs(e.clientY - state.mouseDownPosition.y);
		const distance = Math.sqrt(dx*dx + dy*dy);
		// Only toggle if it's a clean click (minimal movement)
		if (distance < dragThreshold && !state.hasDragged) {
			toggleCollapseState();
		}
		// Reset tracking
		state.mouseDownPosition = null;
	});
	// Make the panel draggable
	if (magneticSnap) {
		container.addEventListener('mousedown', startDrag);
	}
	function startDrag(e) {
		// Avoid dragging when clicking on content
		if (e.target !== container && e.target !== header && 
        e.target !== titleElement && e.target !== caret) return;
		// Save initial position for drag detection
		state.mouseDownPosition = { x: e.clientX, y: e.clientY };
		// Calculate the offset from the mouse position to the panel's corner
		const rect = container.getBoundingClientRect();
		state.offsetX = e.clientX - rect.left;
		state.offsetY = e.clientY - rect.top;
		// Add event listeners for dragging and drop
		document.addEventListener('mousemove', dragMove);
		document.addEventListener('mouseup', dragEnd);
		// Stop event propagation to prevent other handlers
		e.preventDefault();
		e.stopPropagation();
	}
	function dragMove(e) {
		// Check if we've moved enough to consider it a drag
		if (state.mouseDownPosition) {
			const dx = Math.abs(e.clientX - state.mouseDownPosition.x);
			const dy = Math.abs(e.clientY - state.mouseDownPosition.y);
			const distance = Math.sqrt(dx*dx + dy*dy);
			if (distance >= dragThreshold) {
				state.isDragging = true;
				state.hasDragged = true;
				// When drag starts, switch from right-based to left-based positioning
				if (!container.style.left) {
					const rect = container.getBoundingClientRect();
					container.style.right = 'auto';
					container.style.left = `${window.innerWidth - rect.right}px`;
				}
			}
		}
		if (state.isDragging) {
			// Calculate new position
			const x = e.clientX - state.offsetX;
			const y = e.clientY - state.offsetY;
			// Update panel position
			container.style.left = `${x}px`;
			container.style.top = `${y}px`;
		}
	}
	function dragEnd(e) {
		// Remove event listeners regardless
		document.removeEventListener('mousemove', dragMove);
		document.removeEventListener('mouseup', dragEnd);
		if (state.isDragging && magneticSnap) {
			// Check if we should snap back to original position
			const rect = container.getBoundingClientRect();
			const snapDistance = 50; // Distance in pixels to trigger snap
			// Calculate distance from original position in pixels
			let originalRight = parseFloat(initialPosition.right);
			// Calculate the current right position
			const currentRight = window.innerWidth - (rect.left + rect.width);
			// Calculate distance to original position
			const distanceToOriginal = Math.sqrt(
				Math.pow(rect.top - parseFloat(initialPosition.top), 2) + 
        Math.pow(currentRight - originalRight, 2)
			);
			// If close enough to original position, snap back
			if (distanceToOriginal < snapDistance) {
				container.style.transition = 'left 0.3s ease, top 0.3s ease, right 0.3s ease';
				container.style.left = 'auto';
				container.style.top = initialPosition.top;
				container.style.right = initialPosition.right;
				// Reset transition after animation
				setTimeout(() => {
					container.style.transition = 'opacity 0.3s ease';
				}, 300);
			}
			// Reset state
			state.isDragging = false;
		}
		// Reset tracking
		state.mouseDownPosition = null;
		state.hasDragged = false;
	}
	document.body.appendChild(container);
	return {
		container,
		content,
		header,
		toggleCollapseState,
		state
	};
} 