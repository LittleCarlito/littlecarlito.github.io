import { InteractionManager } from './interaction_manager';

// Rig interaction configuration
const RIG_INTERACTION_CONFIG = {
    normalColor: 0xFF0000,      // Red - normal state
    hoverColor: 0x00FF00,       // Green - hover state
    activeColor: 0x0000FF       // Blue - active/dragging state
};

let rigInteractionEnabled = true;
let hoveredHandle = null;
let isDragging = false;
let dragTarget = null;

/**
 * Sets up rig interaction handling for control handles
 * Integrates with the existing InteractionManager system
 * @param {Array} controlHandles - Array of control handle meshes
 * @param {Object} scene - Three.js scene
 */
export function setupRigInteractionHandling(controlHandles, scene) {
    if (!controlHandles || controlHandles.length === 0) {
        console.warn('[RigInteractionHandler] No control handles provided');
        return;
    }

    console.log(`[RigInteractionHandler] Setting up interaction for ${controlHandles.length} control handles`);
    
    // Get the interaction manager instance
    const interactionManager = InteractionManager.getInstance();
    
    // Store original handle reference for later use
    interactionManager.rigControlHandles = controlHandles;
    
    // Override the intersection handling to include rig handles
    const originalHandleIntersections = interactionManager.handle_intersections;
    
    interactionManager.handle_intersections = function(e) {
        // Call original intersection handling first
        if (originalHandleIntersections) {
            originalHandleIntersections.call(this, e);
        }
        
        // Add rig-specific intersection handling
        handleRigIntersections.call(this, e);
    };
    
    // Override mouse down to handle rig interactions
    const originalHandleMouseDown = interactionManager.handle_mouse_down;
    
    interactionManager.handle_mouse_down = function(e) {
        // Handle rig interactions first
        const rigHandled = handleRigMouseDown.call(this, e);
        
        // If rig didn't handle it, use original handler
        if (!rigHandled && originalHandleMouseDown) {
            originalHandleMouseDown.call(this, e);
        }
    };
    
    // Override mouse up to handle rig interactions
    const originalHandleMouseUp = interactionManager.handle_mouse_up;
    
    interactionManager.handle_mouse_up = function(e) {
        // Handle rig interactions first
        handleRigMouseUp.call(this, e);
        
        // Call original handler
        if (originalHandleMouseUp) {
            originalHandleMouseUp.call(this, e);
        }
    };
}

/**
 * Handles rig-specific intersections for hover effects
 * @param {Event} e - Mouse event
 */
function handleRigIntersections(e) {
    if (!rigInteractionEnabled) return;
    
    const intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);
    
    let rigHandleHovered = false;
    
    // Check if we're hovering over any rig control handles
    for (const intersection of intersections) {
        const object = intersection.object;
        
        // Check if this is a rig control handle
        if (object.userData && object.userData.isControlHandle) {
            console.log('[RigInteractionHandler] 🎯 RIG CONTROL HANDLE DETECTED:', object.name);
            rigHandleHovered = true;
            
            // Don't change hover state if we're currently dragging this object
            if (isDragging && dragTarget === object) {
                break;
            }
            
            // Set hover state if not already hovered
            if (hoveredHandle !== object) {
                console.log('[RigInteractionHandler] ✅ HOVERING RIG CONTROL HANDLE:', object.name, '- Setting to GREEN');
                
                // Reset previous hover
                if (hoveredHandle && hoveredHandle.material && hoveredHandle !== dragTarget) {
                    hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
                    hoveredHandle.material.needsUpdate = true;
                }
                
                // Set new hover state
                hoveredHandle = object;
                hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.hoverColor);
                hoveredHandle.material.needsUpdate = true;
                
                // Update cursor
                document.body.style.cursor = 'pointer';
            }
            break;
        }
    }
    
    // Reset hover if no rig handle is hovered
    if (!rigHandleHovered && hoveredHandle && !isDragging) {
        console.log('[RigInteractionHandler] ❌ NO RIG HANDLE HOVERED - Resetting to RED');
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
        hoveredHandle = null;
        document.body.style.cursor = 'auto';
    }
}

/**
 * Handles mouse down events for rig interactions
 * @param {Event} e - Mouse event
 * @returns {boolean} True if rig handled the event
 */
function handleRigMouseDown(e) {
    if (!rigInteractionEnabled || e.button !== 0) return false; // Only handle left mouse button
    
    const intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);
    
    // Check for rig control handle clicks
    for (const intersection of intersections) {
        const object = intersection.object;
        
        if (object.userData && object.userData.isControlHandle) {
            console.log('[RigInteractionHandler] ✅ STARTING DRAG on rig control handle:', object.name);
            
            // Start dragging
            isDragging = true;
            dragTarget = object;
            
            // Set active color
            if (object.material) {
                object.material.color.setHex(RIG_INTERACTION_CONFIG.activeColor);
                object.material.needsUpdate = true;
            }
            
            // Disable orbit controls if available
            if (this.window.viewable_container && this.window.viewable_container.controls) {
                this.window.viewable_container.controls.enabled = false;
            }
            
            e.preventDefault();
            return true; // Rig handled the event
        }
    }
    
    return false; // Rig didn't handle the event
}

/**
 * Handles mouse up events for rig interactions
 * @param {Event} e - Mouse event
 */
function handleRigMouseUp(e) {
    if (isDragging && dragTarget) {
        console.log('[RigInteractionHandler] ✅ ENDING DRAG on rig control handle:', dragTarget.name);
        
        // Reset color based on hover state
        const isStillHovered = hoveredHandle === dragTarget;
        const targetColor = isStillHovered ? RIG_INTERACTION_CONFIG.hoverColor : RIG_INTERACTION_CONFIG.normalColor;
        
        if (dragTarget.material) {
            dragTarget.material.color.setHex(targetColor);
            dragTarget.material.needsUpdate = true;
        }
        
        // Re-enable orbit controls
        if (this.window.viewable_container && this.window.viewable_container.controls) {
            this.window.viewable_container.controls.enabled = true;
        }
        
        // Reset drag state
        isDragging = false;
        dragTarget = null;
        
        // Reset cursor
        document.body.style.cursor = 'auto';
        
        e.preventDefault();
    }
}

/**
 * Updates rig interaction configuration
 * @param {Object} newConfig - New configuration options
 */
export function updateRigInteractionConfig(newConfig) {
    Object.assign(RIG_INTERACTION_CONFIG, newConfig);
    console.log('[RigInteractionHandler] Interaction config updated:', RIG_INTERACTION_CONFIG);
}

/**
 * Enables or disables rig interaction handling
 * @param {boolean} enabled - Whether to enable rig interactions
 */
export function setRigInteractionEnabled(enabled) {
    rigInteractionEnabled = enabled;
    
    // Reset hover states when disabling
    if (!enabled && hoveredHandle) {
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
        hoveredHandle = null;
        document.body.style.cursor = 'auto';
    }
    
    console.log('[RigInteractionHandler] Rig interaction enabled:', enabled);
}

/**
 * Gets the currently hovered handle
 * @returns {Object|null} Currently hovered handle or null
 */
export function getHoveredHandle() {
    return hoveredHandle;
}

/**
 * Gets the current dragging state
 * @returns {boolean} True if currently dragging a rig handle
 */
export function getIsDragging() {
    return isDragging;
}

/**
 * Gets the current drag target
 * @returns {Object|null} Currently dragged handle or null
 */
export function getDragTarget() {
    return dragTarget;
}

/**
 * Cleans up rig interaction handling
 */
export function cleanupRigInteractionHandling() {
    // Reset any hover states
    if (hoveredHandle && hoveredHandle.material) {
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
    }
    
    // Reset variables
    hoveredHandle = null;
    isDragging = false;
    dragTarget = null;
    
    // Reset cursor
    document.body.style.cursor = 'auto';
    
    console.log('[RigInteractionHandler] Cleanup completed');
}