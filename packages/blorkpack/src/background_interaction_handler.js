export class BackgroundInteractionHandler {
    constructor() {
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
    }

    initialize(incomingWindow) {
        this.window = incomingWindow;
    }

    dispose() {
        this.#resetCursor();
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
    }

    setMouseState(leftMouseDown) {
        this.left_mouse_down = leftMouseDown;
    }

    handleMouseDown(e) {
        if (!this.window || !this.window.viewable_container || !this.window.background_container) {
            return false;
        }

        if (e.button === 0 && this.window.viewable_container.is_overlay_hidden() && this.is_hovering_room) {
            this.window.background_container.startMouseRotation(e.clientX, e.clientY);
            return true;
        }
        return false;
    }

    handleMouseMove(e) {
        if (!this.window || !this.window.background_container) {
            return false;
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

        if (this.window.background_container.isMouseRotating()) {
            this.window.background_container.stopMouseRotation();
            return true;
        }
        return false;
    }

    checkRoomHover(intersections) {
        if (!this.window || !this.window.viewable_container) {
            return;
        }

        const wasHoveringRoom = this.is_hovering_room;
        this.is_hovering_room = false;
        
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

    shouldHandleBackgroundRotation() {
        if (!this.window || !this.window.viewable_container || !this.window.background_container) {
            return false;
        }

        return (
            this.left_mouse_down &&
            this.window.viewable_container.is_overlay_hidden() &&
            this.is_hovering_room &&
            this.window.background_container.isMouseRotating()
        );
    }

    #updateCursor(wasHoveringRoom) {
        if (!this.window || !this.window.viewable_container) {
            return;
        }

        if (this.is_hovering_room !== wasHoveringRoom) {
            if (this.is_hovering_room && this.window.viewable_container.is_overlay_hidden()) {
                if (!this.window.background_container.isMouseRotating()) {
                    this.#setCursorGrab();
                }
            } else {
                this.#resetCursor();
            }
        }
        
        if (this.window.background_container.isMouseRotating() && this.is_hovering_room && this.window.viewable_container.is_overlay_hidden()) {
            this.#setCursorGrabbing();
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

    #resetCursor() {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = 'default';
        }
    }
}