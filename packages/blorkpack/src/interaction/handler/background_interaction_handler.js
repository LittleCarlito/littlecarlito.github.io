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
        if (!this.window || !this.window.viewable_container || !this.window.background_container) {
            return false;
        }
        if (e.button === 0) {
            if (this.is_hovering_grabbable_asset) {
                const intersections = this.#getIntersections(e);
                const grabbableAsset = this.#findGrabbableAsset(intersections);
                if (grabbableAsset) {
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
            'CHAIR',
            'CAT'
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
            if (assetType === 'DIPLOMA') {
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