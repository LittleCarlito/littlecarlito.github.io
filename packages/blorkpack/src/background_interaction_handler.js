import { THREE } from './index';

export class BackgroundInteractionHandler {
    constructor() {
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
        this.hovered_asset_name = "";
        this.is_hovering_grabbable_asset = false;
        this.grabbed_object = null;
        this.is_dragging_object = false;
        this.last_mouse_x = 0;
        this.last_mouse_y = 0;
        this.drag_sensitivity = 0.05;
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
            if (this.is_hovering_grabbable_asset && this.hovered_asset_name) {
                console.log(`[BackgroundInteractionHandler] Starting object drag for: ${this.hovered_asset_name}`);
                this.#startObjectDrag(e.clientX, e.clientY);
                return true;
            }
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

        if (this.is_dragging_object && this.grabbed_object) {
            this.#updateObjectDrag(e.clientX, e.clientY);
            return true;
        }

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

        if (this.is_dragging_object) {
            console.log("[BackgroundInteractionHandler] Stopping object drag");
            this.#stopObjectDrag();
            handled = true;
        }

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
        
        if (rigInteractionActive) {
            this.#updateCursor(wasHoveringRoom);
            return;
        }
        
        // Check for grabbable assets first - FIX: Find the root asset object
        for (const intersection of intersections) {
            const object = intersection.object;
            
            // Find the root asset object that has the interactable_ name
            const rootAsset = this.#findRootAssetObject(object);
            
            if (rootAsset) {
                const asset_name = rootAsset.name;
                
                if (this.hovered_asset_name !== asset_name) {
                    this.hovered_asset_name = asset_name;
                    console.log(`[BackgroundInteractionHandler] Hovering asset: ${asset_name}`);
                }
                this.is_hovering_grabbable_asset = this.#isGrabbableAsset(asset_name);
                if (this.is_hovering_grabbable_asset) {
                    console.log(`[BackgroundInteractionHandler] Asset is grabbable: ${asset_name}`);
                }
                this.#updateCursor(wasHoveringRoom);
                return;
            }
        }
        
        if (!intersections.some(intersection => this.#findRootAssetObject(intersection.object))) {
            if (this.hovered_asset_name !== "") {
                console.log(`[BackgroundInteractionHandler] No longer hovering asset: ${this.hovered_asset_name}`);
                this.hovered_asset_name = "";
            }
        }
        
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

    // NEW METHOD: Find the root asset object by traversing up the hierarchy
    #findRootAssetObject(object) {
        let current = object;
        
        // Traverse up the hierarchy until we find an object with interactable_ name
        while (current) {
            if (current.name && current.name.includes('interactable_')) {
                return current;
            }
            current = current.parent;
        }
        
        return null;
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
            !this.is_dragging_object
        );
    }

    #startObjectDrag(clientX, clientY) {
        if (!this.hovered_asset_name || !this.window.background_container) {
            console.error("[BackgroundInteractionHandler] Cannot start drag - missing asset or container");
            return;
        }

        // Find the ROOT object in the background container, not a child mesh
        this.grabbed_object = this.window.background_container.getDraggedObjectByName(this.hovered_asset_name);
        
        if (!this.grabbed_object) {
            console.error(`[BackgroundInteractionHandler] Could not find object: ${this.hovered_asset_name}`);
            return;
        }

        this.is_dragging_object = true;
        this.last_mouse_x = clientX;
        this.last_mouse_y = clientY;

        console.log(`[BackgroundInteractionHandler] Started dragging ROOT object: ${this.hovered_asset_name} at position:`, this.grabbed_object.position);
    }

    #updateObjectDrag(clientX, clientY) {
        if (!this.is_dragging_object || !this.grabbed_object) {
            return;
        }

        const deltaX = clientX - this.last_mouse_x;
        const deltaY = clientY - this.last_mouse_y;

        this.#translateObjectFromMouseDelta(deltaX, deltaY);

        this.last_mouse_x = clientX;
        this.last_mouse_y = clientY;
    }

    #stopObjectDrag() {
        if (this.is_dragging_object && this.grabbed_object) {
            console.log(`[BackgroundInteractionHandler] Stopped dragging object: ${this.grabbed_object.name} at final position:`, this.grabbed_object.position);
            
            this.window.background_container.snapObjectToSurface(this.grabbed_object.name);
        }
        
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

        const cameraMatrix = camera.matrixWorld;
        const right = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1);

        const scaleFactor = this.drag_sensitivity;

        const rightMovement = right.clone().multiplyScalar(deltaX * scaleFactor);
        const upMovement = up.clone().multiplyScalar(-deltaY * scaleFactor);

        this.grabbed_object.position.add(rightMovement);
        this.grabbed_object.position.add(upMovement);
    }

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

        if (this.is_dragging_object) {
            this.#setCursorGrabbing();
            return;
        }

        if (this.hovered_asset_name && this.is_hovering_grabbable_asset) {
            if (this.left_mouse_down) {
                this.#setCursorGrabbing();
            } else {
                this.#setCursorGrab();
            }
            return;
        }

        if (this.hovered_asset_name) {
            const assetType = this.hovered_asset_name.replace('interactable_', '').split('_')[0];
            if (assetType === 'DIPLOMA' || assetType === 'CAT') {
                this.#setCursorPointer();
                return;
            }
        }

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