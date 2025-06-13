// Tooltip related variables
let tooltipElement = null;
let tooltipTimers = new Map();
const TOOLTIP_DELAY = 1500; // 1.5 seconds delay
// Track the currently hovered element
let hoveredElement = null;

// Initialize tooltip when the module loads
document.addEventListener('DOMContentLoaded', () => {
    initTooltip();
    
    // Add document click handler to hide tooltips when clicking elsewhere
    document.addEventListener('click', (event) => {
        // If clicked element is not the hovered element or the tooltip
        if (hoveredElement && event.target !== hoveredElement && 
            event.target !== tooltipElement && 
            !hoveredElement.contains(event.target) && 
            !tooltipElement.contains(event.target)) {
            
            // Hide tooltip and clear hover state
            hideTooltip();
            hoveredElement = null;
        }
    });
});

/**
 * Initialize tooltip element
 */
function initTooltip() {
    // Create tooltip if it doesn't exist
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'text-tooltip';
        document.body.appendChild(tooltipElement);
        
        // Add mouse events to the tooltip itself
        tooltipElement.addEventListener('mouseenter', () => {
            tooltipElement.classList.add('mouse-over');
        });
        
        tooltipElement.addEventListener('mouseleave', (event) => {
            tooltipElement.classList.remove('mouse-over');
            
            // Get the element the mouse is moving to
            const relatedTarget = event.relatedTarget;
            
            // Only keep tooltip visible if moving directly back to the original element
            if (hoveredElement && relatedTarget === hoveredElement) {
                return;
            }
            
            // Otherwise, hide the tooltip and clear reference
            hideTooltip();
            hoveredElement = null;
        });
    }
}

/**
 * Process all elements in a container that might have truncated text
 * @param {HTMLElement} container - Container to search for truncatable elements
 */
export function setupTruncationTooltips(container) {
    if (!container) return;
    
    // Find all elements that might have truncated text
    const truncatableElements = container.querySelectorAll('.rig-item-name, .rig-parent-bone, .rig-child-bone, .rig-associated-bone, .rig-connected-bone');
    truncatableElements.forEach(setupTruncationTooltip);
    
    // Log summary of truncated elements for debugging
    const truncatedCount = container.querySelectorAll('.is-truncated').length;
    if (truncatedCount > 0) {
        console.log(`Found ${truncatedCount} truncated elements with tooltips enabled`);
    }
}

/**
 * Hide tooltip
 */
export function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.classList.remove('visible');
        tooltipElement.classList.remove('mouse-over');
    }
}

/**
 * Setup tooltip behavior for an element that might have truncated text
 * @param {HTMLElement} element - Element to add tooltip functionality to
 */
function setupTruncationTooltip(element) {
    // Skip if already processed
    if (element.dataset.tooltipProcessed) return;
    
    // Set flag to avoid reprocessing
    element.dataset.tooltipProcessed = 'true';
    
    // Check if text is actually truncated
    if (isTextTruncated(element)) {
        element.classList.add('is-truncated');
        
        // Add mouse events
        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
        // Remove mousemove event - we don't want tooltip to follow cursor
    }
}

/**
 * Handle mouse enter event
 * @param {MouseEvent} event - Mouse enter event
 */
function handleMouseEnter(event) {
    const element = event.target;
    const elementId = element.dataset.tooltipId || element.id || Math.random().toString(36).substring(2, 9);
    
    // Store reference to currently hovered element
    hoveredElement = element;
    
    // Store ID for future reference
    element.dataset.tooltipId = elementId;
    
    // Clear any existing timer for this element
    if (tooltipTimers.has(elementId)) {
        clearTimeout(tooltipTimers.get(elementId));
    }
    
    // Start new timer
    const timer = setTimeout(() => {
        showTooltip(element);
    }, TOOLTIP_DELAY);
    
    tooltipTimers.set(elementId, timer);
}

/**
 * Handle mouse leave event
 * @param {MouseEvent} event - Mouse leave event
 */
function handleMouseLeave(event) {
    const element = event.target;
    const elementId = element.dataset.tooltipId;
    
    // Get the element the mouse is moving to
    const relatedTarget = event.relatedTarget;
    
    // Don't hide if moving to the tooltip
    if (relatedTarget === tooltipElement) {
        return;
    }
    
    // Clear reference to hovered element if not moving to tooltip
    hoveredElement = null;
    
    // Clear timer
    if (elementId && tooltipTimers.has(elementId)) {
        clearTimeout(tooltipTimers.get(elementId));
        tooltipTimers.delete(elementId);
    }
    
    // Hide tooltip unless mouse is over it
    if (!tooltipElement || !tooltipElement.classList.contains('mouse-over')) {
        hideTooltip();
    }
}

/**
 * Show tooltip for element
 * @param {HTMLElement} element - Element to show tooltip for
 */
function showTooltip(element) {
    initTooltip();
    
    // Use the raw name from data attribute if available, otherwise use the full text
    const tooltipContent = element.dataset.rawName || element.textContent;
    
    // Set tooltip content
    tooltipElement.textContent = tooltipContent;
    
    // Make tooltip visible
    tooltipElement.classList.add('visible');
    
    // Position tooltip directly above the element with overlap
    positionTooltipWithOverlap(element);
}

/**
 * Position tooltip with slight overlap to prevent gaps
 * @param {HTMLElement} element - Element to position tooltip relative to
 */
function positionTooltipWithOverlap(element) {
    const elementRect = element.getBoundingClientRect();
    const margin = 5; // smaller margin
    
    // Reset any previous positioning to get proper dimensions
    tooltipElement.style.left = '0px';
    tooltipElement.style.top = '0px';
    tooltipElement.style.maxWidth = '300px';
    
    // Get tooltip dimensions after setting content
    const tooltipRect = tooltipElement.getBoundingClientRect();
    
    // Calculate position above the element with slight overlap
    let tooltipX = elementRect.left;
    let tooltipY = elementRect.top - tooltipRect.height + 2; // 2px overlap
    
    // If tooltip would be above viewport, position it below element instead
    if (tooltipY < margin) {
        tooltipY = elementRect.bottom - 2; // 2px overlap at bottom
    }
    
    // If tooltip is wider than element, center it
    if (tooltipRect.width > elementRect.width) {
        tooltipX = elementRect.left - ((tooltipRect.width - elementRect.width) / 2);
    }
    
    // Keep tooltip within viewport
    if (tooltipX < margin) tooltipX = margin;
    if (tooltipX + tooltipRect.width > window.innerWidth - margin) {
        // Align right edge with viewport or constrain width
        if (tooltipRect.width > window.innerWidth - (margin * 2)) {
            // If tooltip is too wide, constrain it
            tooltipElement.style.maxWidth = (window.innerWidth - (margin * 2)) + 'px';
            tooltipX = margin;
        } else {
            tooltipX = window.innerWidth - tooltipRect.width - margin;
        }
    }
    
    tooltipElement.style.left = `${tooltipX}px`;
    tooltipElement.style.top = `${tooltipY}px`;
}

/**
 * Check if element's text is truncated (ellipsis applied)
 * @param {HTMLElement} element - Element to check for truncation
 * @returns {boolean} - True if text is truncated
 */
function isTextTruncated(element) {
    // Basic truncation check - scrollWidth > clientWidth
    const basicTruncation = element.scrollWidth > element.clientWidth;
    
    // If we're dealing with a rig-item-name, perform additional checks
    if (element.classList.contains('rig-item-name')) {
        const item = element.closest('.rig-item');
        if (item) {
            // Check if we have a count element
            const countElement = item.querySelector('.rig-item-count');
            if (countElement) {
                // Get positions
                const nameRect = element.getBoundingClientRect();
                const countRect = countElement.getBoundingClientRect();
                
                // Check if natural text width would overlap with count
                // We'll consider it potentially truncated if the name without truncation
                // would extend into the count element's space
                const textWidth = element.scrollWidth;
                const availableWidth = countRect.left - nameRect.left - 5; // 5px buffer
                
                return textWidth > availableWidth;
            }
        }
    }
    
    return basicTruncation;
}
