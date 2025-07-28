import { InteractionHelper } from '../interaction_helper';
import { InteractionManager } from '../interaction_manager';
import { grab_object, update_mouse_position, release_object } from "../../physics";

export class BackgroundInteractionHandler {
    constructor() {
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
        this.hovered_asset_name = "";
        this.is_hovering_grabbable_asset = false;
        this.interaction_helper = null;
        this.grabbed_asset = null;
        this.dragging_asset = false;
        this.original_body_type = null;
    }

    initialize(incomingWindow) {
        this.window = incomingWindow;
        this.interaction_helper = InteractionHelper.getInstance();
        this.interaction_helper.setInteractionManager(this.window.interactionManager || null);
    }

    dispose() {
        this.#resetCursor();
        if (this.dragging_asset && this.grabbed_asset) {
            this.#stopDraggingAsset();
        }
        this.window = null;
        this.is_hovering_room = false;
        this.left_mouse_down = false;
        this.hovered_asset_name = "";
        this.is_hovering_grabbable_asset = false;
        this.interaction_helper = null;
        this.grabbed_asset = null;
        this.dragging_asset = false;
        this.original_body_type = null;
    }

    setMouseState(leftMouseDown) {
        this.left_mouse_down = leftMouseDown;
        this.#updateCursor();
    }

    handleMouseDown(e) {
        console.log('[BackgroundInteractionHandler] handleMouseDown called', {
            button: e.button,
            hovering_grabbable: this.is_hovering_grabbable_asset,
            hovered_asset: this.hovered_asset_name
        });

        if (!this.window || !this.window.viewable_container || !this.window.background_container) {
            console.warn('[BackgroundInteractionHandler] Missing required window dependencies');
            return false;
        }

        if (e.button === 0) {
            // Check if we're clicking on the cat
            if (this.hovered_asset_name && this.#isCatAsset(this.hovered_asset_name)) {
                console.log('[BackgroundInteractionHandler] Cat clicked, triggering animation');
                this.#triggerCatAnimation();
                return true;
            }

            // Handle grabbable assets
            if (this.is_hovering_grabbable_asset) {
                const intersections = this.#getIntersections(e);
                const grabbableAsset = this.#findGrabbableAsset(intersections);
                if (grabbableAsset) {
                    console.log('[BackgroundInteractionHandler] Starting to drag asset:', grabbableAsset.name);
                    this.#startDraggingAsset(grabbableAsset, intersections[0], e);
                    return true;
                }
            }
        }
        return false;
    }

    handleMouseMove(e) {
        if (!this.window || !this.window.background_container || !this.window.renderer) {
            return false;
        }

        if (this.dragging_asset && this.interaction_helper) {
            this.interaction_helper.updateMousePosition(e.clientX, e.clientY, this.window.renderer);
            
            if (this.window.viewable_container && this.window.viewable_container.get_camera()) {
                this.interaction_helper.updateRaycaster(this.window.viewable_container.get_camera());
            }
            
            this.interaction_helper.updateDrag({
                onDragUpdate: (dragTarget, localPosition, worldPosition, oldPosition) => {
                    this.#updateAssetPhysics(dragTarget, worldPosition);
                }
            });
            
            if (this.window.interactionManager && this.window.interactionManager.grabbed_object) {
                if (typeof update_mouse_position === 'function') {
                    update_mouse_position(e);
                }
            }
            
            return true;
        }

        return false;
    }

    handleMouseUp() {
        if (!this.window || !this.window.background_container) {
            return false;
        }

        let handled = false;

        if (this.dragging_asset && this.grabbed_asset) {
            this.#stopDraggingAsset();
            handled = true;
        }

        return handled;
    }

    checkRoomHover(intersections, rigInteractionActive) {
        if (!this.window || !this.window.viewable_container) {
            return;
        }        
        this.is_hovering_room = false;
        this.is_hovering_grabbable_asset = false;
        
        if (rigInteractionActive) {
            this.#updateCursor();
            return;
        }
        
        for (const intersection of intersections) {
            const object = intersection.object;
            const rootAsset = this.#findRootAssetObject(object);
            
            if (rootAsset) {
                const asset_name = rootAsset.name;
                
                if (this.hovered_asset_name !== asset_name) {
                    this.hovered_asset_name = asset_name;
                }
                this.is_hovering_grabbable_asset = this.#isGrabbableAsset(asset_name);
                this.#updateCursor();
                return;
            }
        }
        
        if (!intersections.some(intersection => this.#findRootAssetObject(intersection.object))) {
            if (this.hovered_asset_name !== "") {
                this.hovered_asset_name = "";
            }
        }
        
        this.#updateCursor();
    }

    shouldHandleBackgroundRotation() {
        return false;
    }

    #isCatAsset(assetName) {
        if (!assetName) return false;
        const isCat = assetName.includes('CAT') || assetName.includes('cat');
        console.log('[BackgroundInteractionHandler] #isCatAsset check:', assetName, '-> result:', isCat);
        return isCat;
    }

    #triggerCatAnimation() {
        console.log('[BackgroundInteractionHandler] #triggerCatAnimation called for asset:', this.hovered_asset_name);
        
        if (!this.window.asset_handler) {
            console.error('[BackgroundInteractionHandler] No asset_handler found on window');
            return;
        }

        const animationController = this.window.asset_handler.animationController;
        if (!animationController) {
            console.error('[BackgroundInteractionHandler] No animationController found on asset_handler');
            return;
        }

        // Find the cat asset in the scene
        const catAsset = this.#findCatAssetInScene();
        if (!catAsset) {
            console.error('[BackgroundInteractionHandler] Could not find cat asset in scene');
            return;
        }

        // Get the instance ID for the cat asset
        const instanceId = this.#getAssetInstanceId(catAsset);
        console.log('[BackgroundInteractionHandler] Cat asset instance ID:', instanceId);
        
        if (!instanceId) {
            console.error('[BackgroundInteractionHandler] Could not find instance ID for cat asset');
            return;
        }

        // Get available animations for the cat
        const availableAnimations = this.#getAvailableAnimations(animationController, instanceId);
        console.log('[BackgroundInteractionHandler] Available animations for cat:', availableAnimations);
        
        if (!availableAnimations || availableAnimations.length === 0) {
            console.warn('[BackgroundInteractionHandler] No animations available for cat asset');
            return;
        }

        // Pick a random animation
        const randomIndex = Math.floor(Math.random() * availableAnimations.length);
        const selectedAnimation = availableAnimations[randomIndex];
        console.log('[BackgroundInteractionHandler] Selected random animation:', selectedAnimation, 'from index:', randomIndex);

        // Play the animation
        try {
            console.log('[BackgroundInteractionHandler] Attempting to play animation...');
            
            // Get the mixer data again
            const mixerData = animationController.animationMixers.get(instanceId);
            if (mixerData && mixerData.actions && mixerData.actions[selectedAnimation]) {
                console.log('[BackgroundInteractionHandler] Playing animation via direct action access');
                const action = mixerData.actions[selectedAnimation];
                
                // Stop current animation if playing
                if (mixerData.isPlaying && mixerData.actions[mixerData.currentAnimationIndex]) {
                    mixerData.actions[mixerData.currentAnimationIndex].stop();
                }
                
                // Play the selected animation
                action.reset().play();
                mixerData.currentAnimationIndex = parseInt(selectedAnimation);
                mixerData.isPlaying = true;
                
                console.log('[BackgroundInteractionHandler] Animation started successfully');
            } else if (typeof animationController.playAnimation === 'function') {
                console.log('[BackgroundInteractionHandler] Calling animationController.playAnimation');
                animationController.playAnimation(instanceId, selectedAnimation);
            } else if (typeof animationController.play === 'function') {
                console.log('[BackgroundInteractionHandler] Calling animationController.play');
                animationController.play(instanceId, selectedAnimation);
            } else if (typeof animationController.startAnimation === 'function') {
                console.log('[BackgroundInteractionHandler] Calling animationController.startAnimation');
                animationController.startAnimation(instanceId, selectedAnimation);
            } else {
                console.error('[BackgroundInteractionHandler] No play method found on animation controller. Available methods:', Object.getOwnPropertyNames(animationController));
            }
            
            console.log('[BackgroundInteractionHandler] Animation play request completed');
        } catch (error) {
            console.error('[BackgroundInteractionHandler] Error playing cat animation:', error);
        }
    }

    #findCatAssetInScene() {
        if (!this.window.background_container || !this.window.background_container.asset_container) {
            console.warn('[BackgroundInteractionHandler] No asset container found');
            return null;
        }

        const assetContainer = this.window.background_container.asset_container;
        let catAsset = null;
        
        // Find the root cat asset (interactable_CAT)
        assetContainer.traverse((child) => {
            if (child.name === 'interactable_CAT') {
                catAsset = child;
                return;
            }
        });

        console.log('[BackgroundInteractionHandler] Found cat asset in scene:', catAsset?.name);
        return catAsset;
    }

    #getAssetInstanceId(asset) {
        console.log('[BackgroundInteractionHandler] #getAssetInstanceId called for asset:', asset.name);
        
        // Try userData first
        if (asset.userData && asset.userData.instanceId) {
            console.log('[BackgroundInteractionHandler] Found instanceId in userData:', asset.userData.instanceId);
            return asset.userData.instanceId;
        }

        // Try getting from asset storage
        if (this.window.asset_handler && this.window.asset_handler.storage) {
            console.log('[BackgroundInteractionHandler] Checking asset storage for instance ID');
            const storage = this.window.asset_handler.storage;
            
            if (typeof storage.get_instance_id_by_mesh === 'function') {
                const instanceId = storage.get_instance_id_by_mesh(asset);
                console.log('[BackgroundInteractionHandler] Found instanceId from storage:', instanceId);
                return instanceId;
            }
            
            if (typeof storage.get_all_assets === 'function') {
                console.log('[BackgroundInteractionHandler] Searching through all assets');
                const allAssets = storage.get_all_assets();
                for (const assetData of allAssets) {
                    if (assetData.mesh === asset) {
                        console.log('[BackgroundInteractionHandler] Found matching asset with instanceId:', assetData.instanceId);
                        return assetData.instanceId;
                    }
                }
            }
        }

        // Try extracting from asset name if it follows a pattern
        if (asset.name && asset.name.includes('_')) {
            const nameParts = asset.name.split('_');
            const possibleId = nameParts[nameParts.length - 1];
            console.log('[BackgroundInteractionHandler] Extracted possible ID from name:', possibleId);
            return possibleId;
        }

        console.warn('[BackgroundInteractionHandler] Could not determine instance ID for asset');
        return null;
    }

    #getAvailableAnimations(animationController, instanceId) {
        console.log('[BackgroundInteractionHandler] #getAvailableAnimations called for instanceId:', instanceId);
        
        try {
            // Try accessing animationMixers directly since that's what's available
            if (animationController.animationMixers && animationController.animationMixers.has(instanceId)) {
                console.log('[BackgroundInteractionHandler] Found mixer for instanceId');
                const mixerData = animationController.animationMixers.get(instanceId);
                console.log('[BackgroundInteractionHandler] Mixer object:', mixerData);
                
                if (mixerData.actions && Array.isArray(mixerData.actions)) {
                    console.log('[BackgroundInteractionHandler] Found actions array:', mixerData.actions);
                    // Return array indices since the actions are indexed by number
                    return mixerData.actions.map((action, index) => index.toString());
                }
            } else {
                console.log('[BackgroundInteractionHandler] No mixer found for instanceId:', instanceId);
                console.log('[BackgroundInteractionHandler] Available mixer instances:', Array.from(animationController.animationMixers.keys()));
            }
            
            console.warn('[BackgroundInteractionHandler] Could not find animations. Available controller properties:', Object.getOwnPropertyNames(animationController));
            
        } catch (error) {
            console.error('[BackgroundInteractionHandler] Error getting available animations:', error);
        }
        
        return [];
    }

    #getIntersections(e) {
        if (!this.window) {
            return [];
        }
        
        const interactionManager = this.window.interactionManager || 
                                  this.window.interaction_manager ||
                                  InteractionManager.getInstance();
        
        if (!interactionManager) {
            return [];
        }
        
        return interactionManager.get_intersect_list(
            e, 
            this.window.viewable_container.get_camera(), 
            this.window.scene
        );
    }

    #findGrabbableAsset(intersections) {
        if (!this.is_hovering_grabbable_asset || !this.hovered_asset_name) {
            return null;
        }
        
        for (const intersection of intersections) {
            const rootAsset = this.#findRootAssetObject(intersection.object);
            if (rootAsset && rootAsset.name === this.hovered_asset_name) {
                return rootAsset;
            }
        }
        
        return null;
    }

    #startDraggingAsset(asset, intersection, mouseEvent) {
        this.grabbed_asset = asset;
        this.dragging_asset = true;

        if (this.window.interactionManager) {
            this.window.interactionManager.grabbed_object = asset;
        }

        const camera = this.window.viewable_container.get_camera();
        const renderer = this.window.app_renderer?.get_renderer();

        if (renderer) {
            this.interaction_helper.updateMousePosition(mouseEvent.clientX, mouseEvent.clientY, renderer);
            this.interaction_helper.updateRaycaster(camera);
        }

        this.#convertToKinematic(asset);
        
        grab_object(asset, camera);

        this.interaction_helper.startDrag(asset, intersection, camera, {
            onDragStart: (draggedObject, worldPosition) => {
                this.#setCursorGrabbing();
            }
        });
    }

    #stopDraggingAsset() {
        if (!this.interaction_helper || !this.grabbed_asset) {
            return;
        }

        this.interaction_helper.stopDrag({
            onDragEnd: (draggedObject, finalPosition) => {
                if (this.window.interactionManager) {
                    this.window.interactionManager.grabbed_object = null;
                }
                
                this.#convertToDynamic(draggedObject);
                
                this.#updateCursor();
            }
        });

        if (typeof release_object === 'function') {
            release_object(this.grabbed_asset, this.window.background_container);
        }

        this.grabbed_asset = null;
        this.dragging_asset = false;
        this.original_body_type = null;
    }

    #convertToKinematic(asset) {
        const body = this.#getPhysicsBody(asset);
        if (!body) return;

        this.original_body_type = body.bodyType();
        
        if (body.bodyType() !== 1) {
            body.setBodyType(1, true);
        }

        if (this.window.background_container) {
            this.window.background_container.removeCollisionBoxForAsset(asset);
        }
    }

    #convertToDynamic(asset) {
        const body = this.#getPhysicsBody(asset);
        if (!body) {
            console.warn('No physics body found for asset:', asset.name);
            return;
        }

        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        
        setTimeout(() => {
            body.setBodyType(0, true);
            body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);

            if (this.window.background_container) {
                const assetConfig = this.#getAssetConfig(asset);
                this.window.background_container.createCollisionBoxForDroppedAsset(asset, body, assetConfig);
            }
        }, 16);
        
        if (this.window.background_container && this.window.background_container.dynamic_bodies) {
            const existingEntry = this.window.background_container.dynamic_bodies.find(entry => {
                const mesh = Array.isArray(entry) ? entry[0] : entry.mesh;
                return mesh === asset;
            });
            
            if (!existingEntry) {
                this.window.background_container.dynamic_bodies.push({ mesh: asset, body: body });
            }
        }
    }

    #getAssetConfig(asset) {
        const defaultConfig = {
            restitution: 0.3,
            friction: 0.7
        };

        if (!asset || !asset.name) {
            return defaultConfig;
        }

        const assetType = asset.name.replace('interactable_', '').split('_')[0];
        
        const assetSpecificConfigs = {
            'TABLET': { restitution: 0.1, friction: 0.8 },
            'BOOK': { restitution: 0.2, friction: 0.9 },
            'NOTEBOOK': { restitution: 0.2, friction: 0.9 },
            'DIPLOMA': { restitution: 0.1, friction: 0.8 },
            'PLANT': { restitution: 0.4, friction: 0.6 },
            'CAT': { restitution: 0.3, friction: 0.5 },
            'CHAIR': { restitution: 0.2, friction: 0.8 },
            'COMPUTER': { restitution: 0.1, friction: 0.9 }
        };

        return assetSpecificConfigs[assetType] || defaultConfig;
    }

    #getPhysicsBody(asset) {
        let body = null;

        const storage = this.window.asset_handler?.storage;
        if (storage) {
            const bodyPair = storage.get_body_pair_by_mesh(asset);
            if (bodyPair && bodyPair[1]) {
                body = bodyPair[1];
            }
        }

        if (!body && window.AssetStorage) {
            const assetStorage = window.AssetStorage.get_instance();
            if (assetStorage) {
                const bodyPair = assetStorage.get_body_pair_by_mesh(asset);
                if (bodyPair && bodyPair[1]) {
                    body = bodyPair[1];
                }
            }
        }

        if (!body && this.window.background_container) {
            const dynamicEntry = this.window.background_container.dynamic_bodies.find(entry => {
                const mesh = Array.isArray(entry) ? entry[0] : entry.mesh;
                return mesh === asset;
            });
            
            if (dynamicEntry) {
                body = Array.isArray(dynamicEntry) ? dynamicEntry[1] : dynamicEntry.body;
            }
        }

        return body;
    }

    #updateAssetPhysics(asset, worldPosition) {
        if (!asset || !this.window.background_container) {
            return;
        }

        const assetContainer = this.window.background_container.asset_container;
        if (assetContainer) {
            const localPosition = worldPosition.clone();
            assetContainer.worldToLocal(localPosition);
            asset.position.copy(localPosition);
        }

        const body = this.#getPhysicsBody(asset);
        if (body) {
            const physicsWorldPos = worldPosition.clone();
            body.setTranslation({ x: physicsWorldPos.x, y: physicsWorldPos.y, z: physicsWorldPos.z }, false);
            body.setLinvel({ x: 0, y: 0, z: 0 }, false);
            body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        }
    }

    #findRootAssetObject(object) {
        let current = object;
        
        while (current) {
            if (current.name && current.name.includes('interactable_')) {
                return current;
            }
            current = current.parent;
        }
        
        return null;
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

    #updateCursor() {
        if (!this.window || !this.window.viewable_container) {
            return;
        }

        if (this.dragging_asset) {
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

        this.#resetCursor();
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