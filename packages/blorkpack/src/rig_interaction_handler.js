import { InteractionManager } from './interaction_manager';
import { THREE } from './index';

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

// EXACT COPY of drag state tracking from working rig-mouse-handler.js
let dragStartPosition = null;
let dragPlane = null;
let dragOffset = null;
let dragTargetPosition = null;

// Variables needed for exact IK copy
let bones = []; // Will be populated from the rig
let lockedBones = new Set(); // For bone locking functionality

// Raycaster for mouse interaction (EXACT COPY)
let raycaster = null;
let mouse = null;

// NEW: Store reference to the asset container for coordinate transformations
let assetContainer = null;

/**
 * Initialize THREE objects for rig interaction
 */
function initializeRigObjects() {
    if (!dragStartPosition) dragStartPosition = new THREE.Vector3();
    if (!dragPlane) dragPlane = new THREE.Plane();
    if (!dragOffset) dragOffset = new THREE.Vector3();
    if (!dragTargetPosition) dragTargetPosition = new THREE.Vector3();
    if (!raycaster) raycaster = new THREE.Raycaster();
    if (!mouse) mouse = new THREE.Vector2();
}

/**
 * Find and store reference to the asset container
 * @param {Object} controlHandle - A control handle to traverse from
 */
function findAssetContainer(controlHandle) {
    if (assetContainer) return assetContainer;
    
    let currentParent = controlHandle.parent;
    console.log('[RigInteractionHandler] Looking for asset container from handle:', controlHandle.name);
    
    while (currentParent) {
        console.log('[RigInteractionHandler] Checking parent:', currentParent.name, 'userData:', currentParent.userData);
        
        if (currentParent.name === 'asset_container' || 
            (currentParent.userData && currentParent.userData.isAssetContainer)) {
            assetContainer = currentParent;
            console.log('[RigInteractionHandler] Found asset container:', assetContainer.name);
            console.log('[RigInteractionHandler] Asset container rotation:', assetContainer.rotation);
            return assetContainer;
        }
        currentParent = currentParent.parent;
    }
    
    console.warn('[RigInteractionHandler] Could not find asset container, using scene');
    return null;
}

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
    
    // Initialize THREE objects
    initializeRigObjects();
    
    // Find the asset container from the first control handle
    if (controlHandles.length > 0) {
        findAssetContainer(controlHandles[0]);
    }
    
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

    // Override mouse move to handle rig manipulation
    const originalHandleMouseMove = interactionManager.handle_mouse_move;
    
    interactionManager.handle_mouse_move = function(e) {
        // Ensure objects are initialized
        initializeRigObjects();
        
        // Update mouse position for rig system (EXACT COPY from working code)
        const rect = this.window.renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster with the new mouse position
        if (this.window.viewable_container && this.window.viewable_container.get_camera()) {
            raycaster.setFromCamera(mouse, this.window.viewable_container.get_camera());
        }
        
        // Handle rig dragging with coordinate transformation
        if (getIsDragging() && dragTarget) {
            handleDrag.call(this);
        }
        
        // Call original handler
        if (originalHandleMouseMove) {
            originalHandleMouseMove.call(this, e);
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
            
            // Ensure we have the asset container reference
            if (!assetContainer) {
                findAssetContainer(object);
            }
            
            // Populate bones array from the rig if not already done
            if (bones.length === 0) {
                populateBonesFromRig(object);
            }
            
            // Start dragging with coordinate transformation
            startDrag(intersection, object, this);
            
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
        
        // Stop dragging
        stopDrag.call(this, this);
        
        e.preventDefault();
    }
}

/**
 * Handle dragging logic with coordinate transformation for rotated asset container
 */
function handleDrag() {
    if (!isDragging || !dragTarget) return;
    
    // Ensure objects are initialized
    initializeRigObjects();
    
    // Get current intersection point with drag plane (in world space)
    const worldIntersection = new THREE.Vector3();
    
    // Check if ray intersects plane
    if (raycaster.ray.intersectPlane(dragPlane, worldIntersection)) {
        // Apply the offset to maintain the grab point
        worldIntersection.add(dragOffset);
        
        console.log('[RigInteractionHandler] World intersection point:', worldIntersection);
        
        // Transform world position to local space relative to asset container
        let localIntersection = worldIntersection.clone();
        if (assetContainer) {
            assetContainer.worldToLocal(localIntersection);
            console.log('[RigInteractionHandler] Local intersection point:', localIntersection);
        }
        
        // Move handle to new LOCAL position
        dragTarget.position.copy(localIntersection);
        
        // Apply IK if this is the furthest bone handle
        if (dragTarget.userData.controlledBone) {
            const controlledBone = dragTarget.userData.controlledBone;
            
            // For IK calculations, we need the target position in WORLD space
            // because bone.getWorldPosition() returns world coordinates
            const worldTargetPosition = localIntersection.clone();
            if (assetContainer) {
                assetContainer.localToWorld(worldTargetPosition);
            }
            
            console.log('[RigInteractionHandler] IK target world position:', worldTargetPosition);
            
            // Store current locked bone rotations
            restoreLockedBoneRotations();
            
            // Use the moveBonesForTarget function with world coordinates
            moveBonesForTarget(controlledBone, worldTargetPosition);
            
            // Restore locked bone rotations again
            restoreLockedBoneRotations();
            
            // Force immediate update of visual bone meshes during drag
            updateBoneVisuals();
        }
    }
}

/**
 * Start dragging a control handle with coordinate transformation
 * @param {Object} intersection - The intersection data from raycaster
 * @param {Object} handle - The handle being dragged
 * @param {Object} interactionManager - The interaction manager instance with window reference
 */
function startDrag(intersection, handle, interactionManager) {
    // Ensure the handle exists
    if (!handle) return;
    
    // Ensure objects are initialized
    initializeRigObjects();
    
    // Set the dragging state to true
    setIsDragging(true);
    dragTarget = handle;
    
    // Update material to active color
    if (handle.material) {
        handle.material.color.setHex(RIG_INTERACTION_CONFIG.activeColor);
        handle.material.needsUpdate = true;
    }
    
    // Store the initial position (in local space)
    dragTargetPosition.copy(handle.position);
    
    console.log('[RigInteractionHandler] Handle local position:', dragTargetPosition);
    
    // Convert handle position to world space for plane calculation
    let worldHandlePosition = dragTargetPosition.clone();
    if (assetContainer) {
        assetContainer.localToWorld(worldHandlePosition);
    }
    
    console.log('[RigInteractionHandler] Handle world position:', worldHandlePosition);
    
    // Create a drag plane perpendicular to the camera using world position
    const camera = interactionManager.window.viewable_container.get_camera();
    const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, worldHandlePosition);
    
    // Calculate offset for precise dragging (in world space)
    const dragIntersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, dragIntersectionPoint);
    dragOffset.subVectors(worldHandlePosition, dragIntersectionPoint);
    
    console.log('[RigInteractionHandler] Drag started at world position:', worldHandlePosition);
    console.log('[RigInteractionHandler] Drag offset:', dragOffset);
    console.log('[RigInteractionHandler] Asset container rotation:', assetContainer ? assetContainer.rotation : 'No container');
}

/**
 * Stop dragging operation
 * @param {Object} interactionManager - The interaction manager instance with window reference
 */
function stopDrag(interactionManager) {
    if (!getIsDragging() || !dragTarget) return;
    setIsDragging(false);
    
    // Reset material to normal or hover color based on current state
    if (dragTarget.material) {
        const isHovered = dragTarget === hoveredHandle;
        dragTarget.material.color.setHex(isHovered ? RIG_INTERACTION_CONFIG.hoverColor : RIG_INTERACTION_CONFIG.normalColor);
        dragTarget.material.needsUpdate = true;
    }
    
    // Re-enable orbit controls
    if (interactionManager.window.viewable_container && interactionManager.window.viewable_container.controls) {
        interactionManager.window.viewable_container.controls.enabled = true;
        document.body.style.cursor = 'auto';
    }
    
    console.log('[RigInteractionHandler] Drag ended');
}

/**
 * Move a chain of bones to reach a target position (EXACT COPY from bone-kinematics.js)
 * @param {Object} targetBone - The target bone being controlled
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function moveBonesForTarget(targetBone, targetPosition) {
    if (!targetBone) return;
    
    const boneChain = [];
    let currentBone = targetBone;
    
    while (currentBone && bones.includes(currentBone)) {
        boneChain.unshift(currentBone);
        currentBone = currentBone.parent;
        
        if (!currentBone || !currentBone.isBone) break;
    }
    
    if (boneChain.length === 0) {
        boneChain.push(targetBone);
    }
    
    console.log(`[RigInteractionHandler] Applying IK to chain of ${boneChain.length} bones`);
    
    const rotationBackups = new Map();
    boneChain.forEach(bone => {
        rotationBackups.set(bone.uuid, {
            bone: bone,
            rotation: new THREE.Euler(
                bone.rotation.x,
                bone.rotation.y,
                bone.rotation.z,
                bone.rotation.order
            )
        });
    });
    
    applyIKToBoneChain(boneChain, targetPosition);
    
    boneChain.forEach(bone => {
        const lockedData = Array.from(lockedBones).find(data => data.bone === bone);
        if (lockedData) {
            const backup = rotationBackups.get(bone.uuid);
            if (backup) {
                bone.rotation.copy(backup.rotation);
            }
        }
    });
    
    updateAllBoneMatrices();
}

/**
 * Apply inverse kinematics to a chain of bones to reach a target (EXACT COPY from bone-kinematics.js)
 * @param {Array} boneChain - Array of bones from parent to child
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function applyIKToBoneChain(boneChain, targetPosition) {
    if (boneChain.length === 0) return;
    
    const iterations = 10;
    
    for (let iteration = 0; iteration < iterations; iteration++) {
        for (let i = boneChain.length - 1; i >= 0; i--) {
            const bone = boneChain[i];
            
            const lockedData = Array.from(lockedBones).find(data => data.bone === bone);
            if (lockedData) {
                continue;
            }
            
            const endEffector = new THREE.Vector3();
            boneChain[boneChain.length - 1].getWorldPosition(endEffector);
            
            const bonePos = new THREE.Vector3();
            bone.getWorldPosition(bonePos);
            
            const dirToEffector = new THREE.Vector3().subVectors(endEffector, bonePos).normalize();
            const dirToTarget = new THREE.Vector3().subVectors(targetPosition, bonePos).normalize();
            
            let rotAngle = Math.acos(Math.min(1, Math.max(-1, dirToEffector.dot(dirToTarget))));
            
            if (rotAngle < 0.01) continue;
            
            rotAngle = Math.min(rotAngle, 0.1);
            
            const rotAxis = new THREE.Vector3().crossVectors(dirToEffector, dirToTarget).normalize();
            
            if (rotAxis.lengthSq() < 0.01) continue;
            
            const boneWorldQuat = new THREE.Quaternion();
            bone.getWorldQuaternion(boneWorldQuat);
            const localRotAxis = rotAxis.clone().applyQuaternion(boneWorldQuat.clone().invert()).normalize();
            
            bone.rotateOnAxis(localRotAxis, rotAngle);
            
            updateBoneChainMatrices(boneChain);
            
            const newEffectorPos = new THREE.Vector3();
            boneChain[boneChain.length - 1].getWorldPosition(newEffectorPos);
            
            if (newEffectorPos.distanceTo(targetPosition) < 0.1) {
                break;
            }
        }
    }
    
    if (boneChain.length >= 2) {
        const lastBone = boneChain[boneChain.length - 1];
        const secondLastBone = boneChain[boneChain.length - 2];
        
        const lockedData = Array.from(lockedBones).find(data => data.bone === lastBone);
        if (!lockedData) {
            const secondLastPos = new THREE.Vector3();
            secondLastBone.getWorldPosition(secondLastPos);
            
            const dirToTarget = new THREE.Vector3().subVectors(targetPosition, secondLastPos).normalize();
            
            const lastBoneDir = new THREE.Vector3(0, 1, 0);
            lastBoneDir.applyQuaternion(lastBone.getWorldQuaternion(new THREE.Quaternion()));
            
            const alignQuat = new THREE.Quaternion();
            alignQuat.setFromUnitVectors(lastBoneDir, dirToTarget);
            
            const worldQuatInverse = new THREE.Quaternion();
            secondLastBone.getWorldQuaternion(worldQuatInverse).invert();
            
            const localQuat = new THREE.Quaternion().multiplyQuaternions(worldQuatInverse, alignQuat);
            
            lastBone.quaternion.multiply(localQuat);
            
            updateBoneChainMatrices(boneChain);
        }
    }
}

/**
 * Update matrices for a specific chain of bones
 * This helps avoid unnecessary updates to the entire hierarchy
 * @param {Array} boneChain - The bone chain to update
 */
function updateBoneChainMatrices(boneChain) {
    if (!boneChain || boneChain.length === 0) return;
    
    boneChain.forEach(bone => {
        if (bone.updateMatrix && bone.updateMatrixWorld) {
            bone.updateMatrix();
            bone.updateMatrixWorld(true);
        }
    });
}

/**
 * Update matrices for all bones in the scene
 * @param {boolean} forceUpdate - Force update even if no bones
 */
function updateAllBoneMatrices(forceUpdate = false) {
    if (!bones || bones.length === 0) {
        if (!forceUpdate) return;
    }
    
    let armature = null;
    
    for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        if (!bone.parent || !bone.parent.isBone) {
            if (bone.parent) {
                armature = bone.parent;
                break;
            }
        }
    }
    
    if (!armature) {
        bones.forEach(bone => {
            if (bone && bone.updateMatrixWorld) {
                bone.updateMatrix();
                bone.updateMatrixWorld(true);
            }
        });
    } else {
        armature.updateMatrixWorld(true);
    }
}

/**
 * Restore locked bone rotations (EXACT COPY from bone-kinematics.js)
 */
function restoreLockedBoneRotations() {
    lockedBones.forEach((boneData) => {
        if (boneData.bone && boneData.rotation) {
            boneData.bone.rotation.x = boneData.rotation.x;
            boneData.bone.rotation.y = boneData.rotation.y;
            boneData.bone.rotation.z = boneData.rotation.z;
            boneData.bone.updateMatrix();
        }
    });
    
    updateAllBoneMatrices();
}

/**
 * Update the bone visual meshes to match bone positions and rotations (EXACT COPY from bone-kinematics.js)
 */
function updateBoneVisuals() {
    // This function would update rig visualizations
    // For now, we'll just update matrices since we don't have direct access to boneVisualsGroup
    updateAllBoneMatrices();
}

/**
 * Populate bones array from the rig visualization
 * @param {Object} handle - The control handle to find bones from
 */
function populateBonesFromRig(handle) {
    if (!handle.userData.controlledBone) return;
    
    // Find all bones in the rig by traversing from the controlled bone
    let currentBone = handle.userData.controlledBone;
    
    // First, go to the root of the bone hierarchy
    while (currentBone.parent && currentBone.parent.isBone) {
        currentBone = currentBone.parent;
    }
    
    // Now traverse down and collect all bones
    function collectBones(bone) {
        if (bone.isBone) {
            bones.push(bone);
        }
        
        if (bone.children) {
            bone.children.forEach(child => {
                if (child.isBone) {
                    collectBones(child);
                }
            });
        }
    }
    
    collectBones(currentBone);
    
    // LOCK THE END EFFECTOR BONE to prevent spinning
    const controlledBone = handle.userData.controlledBone;
    if (controlledBone) {
        const rotationBackup = new THREE.Euler(
            controlledBone.rotation.x,
            controlledBone.rotation.y,
            controlledBone.rotation.z,
            controlledBone.rotation.order
        );
        
        lockedBones.add({
            bone: controlledBone,
            rotation: rotationBackup,
            uuid: controlledBone.uuid
        });
        
        console.log(`[RigInteractionHandler] 🔒 LOCKED end effector bone: ${controlledBone.name} to prevent spinning`);
    }
    
    console.log(`[RigInteractionHandler] 🦴 Populated bones array with ${bones.length} bones`);
}

/**
 * Update the isDragging state
 * @param {Boolean} dragging - The new dragging state
 */
export function setIsDragging(dragging) {
    isDragging = dragging;
}

/**
 * Returns the current dragging state
 * @returns {Boolean} The current dragging state
 */
export function getIsDragging() {
    return isDragging;
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
    // Stop any active manipulation
    if (isDragging) {
        setIsDragging(false);
    }
    
    // Reset any hover states
    if (hoveredHandle && hoveredHandle.material) {
        hoveredHandle.material.color.setHex(RIG_INTERACTION_CONFIG.normalColor);
        hoveredHandle.material.needsUpdate = true;
    }
    
    // Reset variables
    hoveredHandle = null;
    isDragging = false;
    dragTarget = null;
    assetContainer = null; // Reset container reference
    
    // Clear bones array for next session
    bones = [];
    lockedBones.clear();
    
    // Reset cursor
    document.body.style.cursor = 'auto';
    
    console.log('[RigInteractionHandler] Cleanup completed');
}