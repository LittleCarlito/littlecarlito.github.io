import { THREE } from './index';

export class BackgroundInteractionHandler {
    constructor() {
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
        this.hovered_asset_name = "";
        this.is_hovering_grabbable_asset = false;
        // EXACT same state management as rig system
        this.grabbed_object = null;
        this.is_dragging_object = false;
        this.last_mouse_x = 0;
        this.last_mouse_y = 0;
        this.drag_sensitivity = 0.01; // EXACT same as background container rotation
    }

    initialize(incomingWindow) {
        this.window = incomingWindow;
        console.log("[BackgroundInteractionHandler] Initialized");
    }

    dispose() {
        this.#resetCursor();
        this.#releaseGrabbedObject();
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
        this.hovered_asset_name = "";
        this.is_hovering_grabbable_asset = false;
        this.grabbed_object = null;
        this.is_dragging_object = false;
        console.log("[BackgroundInteractionHandler] Disposed");
    }

    setMouseState(leftMouseDown) {
        this.left_mouse_down = leftMouseDown;
        this.#updateCursor(this.is_hovering_room);
    }

    handleMouseDown(e) {
        if (!this.window || !this.window.viewable_container || !this.window.background_container) {
            return false;
        }

        console.log(`[BackgroundInteractionHandler] Mouse down - button: ${e.button}, overlay hidden: ${this.window.viewable_container.is_overlay_hidden()}, hovering grabbable: ${this.is_hovering_grabbable_asset}, hovered asset: ${this.hovered_asset_name}`);

        if (e.button === 0) {
            // Priority 1: Check if clicking on a grabbable asset (NO overlay check like rig system)
            if (this.is_hovering_grabbable_asset && this.hovered_asset_name) {
                console.log(`[BackgroundInteractionHandler] Starting object drag for: ${this.hovered_asset_name}`);
                this.#startObjectDrag(e.clientX, e.clientY);
                return true;
            }
            // Priority 2: Check for room rotation (only when overlay is hidden)
            else if (this.is_hovering_room && this.window.viewable_container.is_overlay_hidden()) {
                console.log("[BackgroundInteractionHandler] Starting room rotation");
                this.window.background_container.startMouseRotation(e.clientX, e.clientY);
                return true;
            }
        }
        return false;
    }

    handleMouseMove(e) {
        if (!this.window || !this.window.background_container) {
            return false;
        }

        // Priority 1: Handle object dragging with EXACT same logic as rig system
        if (this.is_dragging_object && this.grabbed_object) {
            this.#updateObjectDrag(e.clientX, e.clientY);
            return true;
        }

        // Priority 2: Handle background rotation (existing system)
        if (this.shouldHandleBackgroundRotation()) {
            this.window.background_container.updateMouseRotation(e.clientX, e.clientY);
            return true;
        }

        return false;
    }

    handleMouseUp() {
        if (!this.window || !this.window.background_container) {
            return false;
        }

        let handled = false;

        // Stop object dragging
        if (this.is_dragging_object) {
            console.log("[BackgroundInteractionHandler] Stopping object drag");
            this.#stopObjectDrag();
            handled = true;
        }

        // Stop background rotation
        if (this.window.background_container.isMouseRotating()) {
            console.log("[BackgroundInteractionHandler] Stopping room rotation");
            this.window.background_container.stopMouseRotation();
            handled = true;
        }

        return handled;
    }

    checkRoomHover(intersections, rigInteractionActive) {
        if (!this.window || !this.window.viewable_container) {
            return;
        }

        const wasHoveringRoom = this.is_hovering_room;
        const wasHoveringGrabbableAsset = this.is_hovering_grabbable_asset;
        
        this.is_hovering_room = false;
        this.is_hovering_grabbable_asset = false;
        
        // Don't process hover if rig interaction is active
        if (rigInteractionActive) {
            this.#updateCursor(wasHoveringRoom);
            return;
        }
        
        // Check for grabbable assets first
        for (const intersection of intersections) {
            const object = intersection.object;
            const object_name = object.name;
            
            if (object_name && object_name.includes('interactable_')) {
                if (this.hovered_asset_name !== object_name) {
                    this.hovered_asset_name = object_name;
                    console.log(`[BackgroundInteractionHandler] Hovering asset: ${object_name}`);
                }
                this.is_hovering_grabbable_asset = this.#isGrabbableAsset(object_name);
                if (this.is_hovering_grabbable_asset) {
                    console.log(`[BackgroundInteractionHandler] Asset is grabbable: ${object_name}`);
                }
                this.#updateCursor(wasHoveringRoom);
                return;
            }
        }
        
        // Clear hovered asset if not found
        if (!intersections.some(intersection => 
            intersection.object.name && intersection.object.name.includes('interactable_')
        )) {
            if (this.hovered_asset_name !== "") {
                console.log(`[BackgroundInteractionHandler] No longer hovering asset: ${this.hovered_asset_name}`);
                this.hovered_asset_name = "";
            }
        }
        
        // Check for higher priority interactions
        const hasHigherPriorityInteraction = intersections.some(intersection => {
            const objectName = intersection.object.name || '';
            const nameType = objectName.split("_")[0] + "_";
            
            return (
                nameType === 'label_' ||
                objectName.includes('RigControlHandle') ||
                objectName.includes('Rig') ||
                intersection.object.userData?.isControlHandle ||
                intersection.object.userData?.bonePart ||
                intersection.object.userData?.isVisualBone ||
                (nameType === 'interactable_' && !objectName.includes('ROOM'))
            );
        });
        
        // Check for room hover only if no higher priority interactions
        if (!hasHigherPriorityInteraction) {
            for (const intersection of intersections) {
                if (intersection.object.name && intersection.object.name.includes('ROOM')) {
                    this.is_hovering_room = true;
                    break;
                }
            }
        }
        
        this.#updateCursor(wasHoveringRoom);
    }

    shouldHandleBackgroundRotation() {
        if (!this.window || !this.window.viewable_container || !this.window.background_container) {
            return false;
        }

        return (
            this.left_mouse_down &&
            this.window.viewable_container.is_overlay_hidden() &&
            this.is_hovering_room &&
            this.window.background_container.isMouseRotating() &&
            !this.is_dragging_object // Don't rotate background while dragging object
        );
    }

    // EXACT same approach as rig system - direct mesh manipulation
    #startObjectDrag(clientX, clientY) {
        if (!this.hovered_asset_name || !this.window.background_container) {
            console.error("[BackgroundInteractionHandler] Cannot start drag - missing asset or container");
            return;
        }

        // Find the object in the background container
        this.grabbed_object = this.window.background_container.getDraggedObjectByName(this.hovered_asset_name);
        
        if (!this.grabbed_object) {
            console.error(`[BackgroundInteractionHandler] Could not find object: ${this.hovered_asset_name}`);
            return;
        }

        // EXACT same initialization as background container rotation
        this.is_dragging_object = true;
        this.last_mouse_x = clientX;
        this.last_mouse_y = clientY;

        console.log(`[BackgroundInteractionHandler] Started dragging object: ${this.hovered_asset_name} at position:`, this.grabbed_object.position);
    }

    #updateObjectDrag(clientX, clientY) {
        if (!this.is_dragging_object || !this.grabbed_object) {
            return;
        }

        // EXACT same delta calculation as background container rotation
        const deltaX = clientX - this.last_mouse_x;
        const deltaY = clientY - this.last_mouse_y;

        // Apply movement directly to mesh position using camera vectors
        this.#translateObjectFromMouseDelta(deltaX, deltaY);

        // EXACT same update as background container rotation
        this.last_mouse_x = clientX;
        this.last_mouse_y = clientY;
    }

    #stopObjectDrag() {
        if (this.is_dragging_object && this.grabbed_object) {
            console.log(`[BackgroundInteractionHandler] Stopped dragging object: ${this.grabbed_object.name} at final position:`, this.grabbed_object.position);
            
            // Optional: Snap to surface when released
            this.window.background_container.snapObjectToSurface(this.grabbed_object.name);
        }
        
        // EXACT same cleanup as background container rotation
        this.is_dragging_object = false;
        this.grabbed_object = null;
    }

    #releaseGrabbedObject() {
        if (this.is_dragging_object) {
            this.#stopObjectDrag();
        }
    }

    #translateObjectFromMouseDelta(deltaX, deltaY) {
        if (!this.grabbed_object || !this.window.viewable_container) {
            return;
        }

        const camera = this.window.viewable_container.get_camera();

        // Get camera's right and up vectors (same approach as rig system)
        const cameraMatrix = camera.matrixWorld;
        const right = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1);

        // Use same sensitivity as background rotation for consistency
        const scaleFactor = this.drag_sensitivity;

        // Apply movement directly to object position
        const rightMovement = right.clone().multiplyScalar(deltaX * scaleFactor);
        const upMovement = up.clone().multiplyScalar(-deltaY * scaleFactor); // Invert Y for screen coordinates

        // Add the movement vectors to the object position
        this.grabbed_object.position.add(rightMovement);
        this.grabbed_object.position.add(upMovement);
    }

    // Configuration methods
    setDragSensitivity(sensitivity) {
        this.drag_sensitivity = sensitivity;
    }

    getDragSensitivity() {
        return this.drag_sensitivity;
    }

    isDraggingObject() {
        return this.is_dragging_object;
    }

    getDraggedObject() {
        return this.grabbed_object;
    }

    #isGrabbableAsset(assetName) {
        if (!assetName) return false;
        
        const assetType = assetName.replace('interactable_', '').split('_')[0];
        const grabbableTypes = [
            'NOTEBOOK',
            'BOOK',
            'TABLET',
            'KEYBOARD',
            'PLANT',
            'MOUSEPAD',
            'MOUSE',
            'DESKPHOTO',
            'COMPUTER',
            'CHAIR'
        ];
        
        return grabbableTypes.includes(assetType);
    }

    #updateCursor(wasHoveringRoom) {
        if (!this.window || !this.window.viewable_container) {
            return;
        }

        // Priority 1: Show dragging cursor when actively dragging
        if (this.is_dragging_object) {
            this.#setCursorGrabbing();
            return;
        }

        // Priority 2: Show grab cursor when hovering grabbable asset
        if (this.hovered_asset_name && this.is_hovering_grabbable_asset) {
            if (this.left_mouse_down) {
                this.#setCursorGrabbing();
            } else {
                this.#setCursorGrab();
            }
            return;
        }

        // Priority 3: Handle non-grabbable assets
        if (this.hovered_asset_name) {
            const assetType = this.hovered_asset_name.replace('interactable_', '').split('_')[0];
            if (assetType === 'DIPLOMA' || assetType === 'CAT') {
                this.#setCursorPointer();
                return;
            }
        }

        // Priority 4: Show background rotation cursors
        if (this.window.background_container?.isMouseRotating() && this.is_hovering_room && this.window.viewable_container.is_overlay_hidden()) {
            this.#setCursorGrabbing();
        } else if (this.is_hovering_room && this.window.viewable_container.is_overlay_hidden()) {
            this.#setCursorGrab();
        } else {
            this.#resetCursor();
        }
    }

    #setCursorGrab() {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = 'grab';
        }
    }

    #setCursorGrabbing() {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = 'grabbing';
        }
    }

    #setCursorPointer() {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = 'pointer';
        }
    }

    #resetCursor() {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = 'default';
        }
    }
}