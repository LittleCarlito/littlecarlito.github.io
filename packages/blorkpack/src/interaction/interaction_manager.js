import { BTYPES, extract_type, THREE } from '../index';
import { 
    update_mouse_position,
    zoom_object_in,
    zoom_object_out,
    release_object
} from "../physics";
import { DiplomaInteractionHandler } from './handler/diploma_interaction_handler';
import { ActivationInteractionHandler } from './handler/activation_interaction_handler';
import { BackgroundInteractionHandler } from './handler/background_interaction_handler';
import { UIInteractionHandler } from './handler/ui_interaction_handler';

export class InteractionManager {
    static instance = null;
    static mouse_sensitivity = 0.02;

    constructor() {
        if (InteractionManager.instance){
            return InteractionManager.instance;
        }
        this.window = null;
        this.abortController = null;
        this.listening = false;
        this.raycaster = null;
        this.mouse_location = null;
        this.left_mouse_down = false;
        this.right_mouse_down = false;
        this.hovered_interactable_name = "";
        this.grabbed_object = null;
        this.resize_timeout = null;
        this.resize_move = false;
        this.zoom_event = false;
        this.diploma_handler = new DiplomaInteractionHandler();
        this.activation_interaction_handler = new ActivationInteractionHandler();
        this.background_interaction_handler = new BackgroundInteractionHandler();
        this.ui_interaction_handler = new UIInteractionHandler();
        this.rig_interaction_active = false;
        InteractionManager.instance = this;
    }

    static getInstance() {
        if(!InteractionManager.instance) {
            InteractionManager.instance = new InteractionManager();
        }
        return InteractionManager.instance;
    }

    async startListening(incomingWindow) {
        this.window = incomingWindow;
        await this.#waitForDependencies();
        this.activation_interaction_handler.initialize(incomingWindow);
        this.background_interaction_handler.initialize(incomingWindow);
        this.ui_interaction_handler.initialize(incomingWindow);
        this.window.activation_interaction_handler = this.activation_interaction_handler;
        this.abortController = new AbortController();
        const abortSignal = this.abortController.signal;
        this.listening = true;
        this.window.addEventListener('resize', (e) => this.handle_resize(e), { abortSignal });
        this.window.addEventListener('mousemove', (e) => this.handle_mouse_move(e), { abortSignal });
        this.window.addEventListener('mousedown', (e) => this.handle_mouse_down(e), { abortSignal });
        this.window.addEventListener('mouseup', (e) => this.handle_mouse_up(e), { abortSignal });
        this.window.addEventListener('contextmenu', (e) => this.handle_context_menu(e), { abortSignal });
        this.window.addEventListener('wheel', (e) => this.handle_wheel(e), { abortSignal });
    }

    stopListening() {
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.diploma_handler) {
            this.diploma_handler.dispose();
        }
        if (this.activation_interaction_handler) {
            this.activation_interaction_handler.dispose();
        }
        if (this.background_interaction_handler) {
            this.background_interaction_handler.dispose();
        }
        if (this.ui_interaction_handler) {
            this.ui_interaction_handler.dispose();
        }
        this.#resetCursor();
        this.window = null;
        this.abortController = null;
        this.listening = false;
    }

    handle_resize(e) {
        if (this.resize_timeout) {
            clearTimeout(this.resize_timeout);
        }
        this.resize_timeout = setTimeout(() => {
            if (this.window.app_renderer) this.window.app_renderer.resize();
            if (this.window.viewable_container) {
                this.window.viewable_container.reset_camera();
                this.window.viewable_container.resize_reposition();
            }
        }, 100);
    }

    handle_mouse_move(e) {
        if(this.window.viewable_container.is_animating()) {
            return;
        }
        
        this.diploma_handler.update_mouse_position(e.clientX, e.clientY);
        
        if (this.background_interaction_handler.handleMouseMove(e)) {
            return;
        }
        
        this.#handle_rotation_and_pan(e);
        
        this.handle_intersections(e);
    }

    handle_mouse_down(e) {
        if(e.button === 0) {
            this.left_mouse_down = true;
            this.background_interaction_handler.setMouseState(true);
            
            if (this.background_interaction_handler.handleMouseDown(e)) {
                return;
            }
            
            if(this.window.viewable_container.is_overlay_hidden()) {
                this.window.viewable_container.detect_rotation = true;
            }
        }
        if(e.button === 2) {
            this.right_mouse_down = true;
            if(this.grabbed_object) {
                release_object(this.grabbed_object);
                this.grabbed_object = null;
            } else if(this.window.viewable_container.is_overlay_hidden()) {
                this.window.viewable_container.detect_pan = true;
            }
        }
    }

    handle_mouse_up(e) {
        if(this.grabbed_object) {
            release_object(this.grabbed_object, this.window.background_container);
            this.grabbed_object = null;
        }
        
        this.background_interaction_handler.handleMouseUp();
        
        const intersections = this.get_intersect_list(
            e, 
            this.window.viewable_container.get_camera(), 
            this.window.scene
        );
        
        let handled = false;
        if (e.button === 0) {
            handled = this.ui_interaction_handler.handleUIClick(intersections);
        }
        
        if (!handled) {
            this.window.viewable_container.handle_mouse_up(intersections);
        }
        if (e.button === 0) {
            this.window.viewable_container.detect_rotation = false;
            this.left_mouse_down = false;
            this.background_interaction_handler.setMouseState(false);
        }
        if (e.button === 2) {
            this.window.viewable_container.detect_rotation = false;
            this.window.viewable_container.detect_pan = false;
            this.right_mouse_down = false;
        }
    }

    handle_wheel(e) {
        if(this.grabbed_object) {
            if(e.deltaY < 0) {
                this.window.background_container.break_secondary_chains();
                zoom_object_in(this.grabbed_object);
            } else {
                this.window.background_container.break_secondary_chains();
                zoom_object_out(this.grabbed_object);
            }
            this.zoom_event = true;
            this.resize_move = true;
        } else if(this.window.viewable_container.is_overlay_hidden()) {
            const zoom_delta = e.deltaY * 0.01;
            this.window.viewable_container.get_camera_manager().zoom(zoom_delta);
            this.zoom_event = true;
            this.resize_move = true;
        }
    }

    handle_context_menu(e) {
        e.preventDefault();
    }

    #waitForDependencies() {
        return new Promise((resolve, reject) => {
            const timeout = 5000;
            const startTime = Date.now();
            
            const checkDependencies = () => {
                const elapsed = Date.now() - startTime;
                
                if (elapsed > timeout) {
                    const missingDeps = [];
                    if (!this.window?.viewable_container) missingDeps.push('window.viewable_container');
                    if (!this.window?.scene) missingDeps.push('window.scene');
                    
                    reject(new Error(`Dependency timeout after ${timeout}ms. Missing dependencies: ${missingDeps.join(', ')}`));
                    return;
                }
                
                if (this.window?.viewable_container && this.window?.scene) {
                    resolve();
                } else {
                    setTimeout(checkDependencies, 10);
                }
            };
            checkDependencies();
        });
    }

    #handle_rotation_and_pan(e) {
        update_mouse_position(e);
        
        if(this.window.viewable_container.detect_rotation && this.left_mouse_down) {
            this.window.viewable_container.get_camera_manager().rotate(
                e.movementX * InteractionManager.mouse_sensitivity,
                e.movementY * InteractionManager.mouse_sensitivity
            );
        } else if(this.window.viewable_container.detect_pan && this.right_mouse_down) {
            this.window.viewable_container.get_camera_manager().pan(
                e.movementX * InteractionManager.mouse_sensitivity,
                e.movementY * InteractionManager.mouse_sensitivity
            );
        }
    }

    handle_intersections(e) {
        const found_intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);       
        const is_overlay_hidden = this.window.viewable_container.is_overlay_hidden();
        
        this.diploma_handler.check_diploma_hover(found_intersections, this.window.scene);
        
        const interaction_priority = this.#determineInteractionPriority(found_intersections);
        
        this.rig_interaction_active = (interaction_priority === 'rig');
        
        if (interaction_priority === 'rig') {
            return;
        }
        
        this.background_interaction_handler.checkRoomHover(found_intersections, this.rig_interaction_active);
        
        this.ui_interaction_handler.handleUIIntersections(found_intersections, is_overlay_hidden);
    }

    #determineInteractionPriority(intersections) {
        for (const intersection of intersections) {
            const objectName = intersection.object.name || '';
            
            if (objectName.includes('RigControlHandle') || 
                intersection.object.userData?.isControlHandle ||
                intersection.object.userData?.bonePart ||
                intersection.object.userData?.isVisualBone) {
                return 'rig';
            }
            
            const nameType = objectName.split("_")[0] + "_";
            if (nameType === 'label_') {
                return 'label';
            }
            
            if (objectName.includes('artist_') || objectName.includes('link_') || objectName.includes('hide_')) {
                return 'overlay';
            }
            
            if (objectName.includes('interactable_') && !objectName.includes('ROOM')) {
                return 'asset';
            }
        }
        
        for (const intersection of intersections) {
            if (intersection.object.name && intersection.object.name.includes('ROOM')) {
                return 'room';
            }
        }
        
        return 'none';
    }

    #resetCursor() {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = 'default';
        }
    }

    get_intersect_list(e, incoming_camera, incoming_scene) {
        const ndc = this.#get_ndc_from_event(e);
        const mousePos = this.#getMouseLocation();
        mousePos.x = ndc.x;
        mousePos.y = ndc.y;
        const ray = this.#getRaycaster();
        ray.setFromCamera(mousePos, incoming_camera);
        const intersections = ray.intersectObject(incoming_scene, true);
        return intersections.sort((a, b) => {
            const renderOrderA = a.object.renderOrder || 0;
            const renderOrderB = b.object.renderOrder || 0;
            if (renderOrderB !== renderOrderA) {
                return renderOrderB - renderOrderA;
            }
            const isLabelA = a.object.name.includes('label_') || a.object.name.includes('_collision');
            const isLabelB = b.object.name.includes('label_') || b.object.name.includes('_collision');
            if (isLabelA && !isLabelB) return -1;
            if (!isLabelA && isLabelB) return 1;
            return a.distance - b.distance;
        });
    }

    #getMouseLocation() {
        if (!this.mouse_location) {
            this.mouse_location = new THREE.Vector2();
        }
        return this.mouse_location;
    }

    #get_ndc_from_event(e) {
        const renderer = this.window.app_renderer?.get_renderer() || this.window.app_renderer?.webgl_renderer;
        if (renderer && renderer.domElement) {
            const rect = renderer.domElement.getBoundingClientRect();
            return {
                x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
                y: -((e.clientY - rect.top) / rect.height) * 2 + 1
            };
        }
        // Fallback to original method
        return {
            x: (e.clientX / this.window.innerWidth) * 2 - 1,
            y: -(e.clientY / this.window.innerHeight) * 2 + 1
        };
    }

    #getRaycaster() {
        if (!this.raycaster) {
            this.raycaster = new THREE.Raycaster();
        }
        return this.raycaster;
    }
}