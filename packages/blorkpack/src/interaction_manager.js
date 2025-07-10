import { BTYPES, extract_type, THREE } from './index';
import { 
    update_mouse_position,
    zoom_object_in,
    zoom_object_out,
    release_object,
    grab_object,
    shove_object
} from "./physics";
import { DiplomaInteractionHandler } from './diploma_interaction_handler';
import { ActivationInteractionHandler } from './activation_interaction_handler';

const LogLevel = {
    DEBUG: 'debug',
    WARN: 'warn',
    INFO: 'info',
    ERROR: 'error'
};

export class InteractionManager {
    static instance = null;
    static LOG_FLAG = true;
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
        if(!this.listening) {
            this.#logString("Wasn't listening anyways...", LogLevel.WARN)
        }
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.diploma_handler) {
            this.diploma_handler.dispose();
        }
        if (this.activation_interaction_handler) {
            this.activation_interaction_handler.dispose();
        }
        this.window = null;
        this.abortController = null;
        this.listening = false;
    }

    handle_resize(e) {
        if(!this.listening) {
            this.#logString("Cannot handle resize. Not listening...", LogLevel.ERROR, true);
            return;
        }
        this.#logString(`Resize event: ${e.target.innerWidth}x${e.target.innerHeight} 
            (was ${e.target.previousWidth || 'unknown'}x${e.target.previousHeight || 'unknown'})`, 
            LogLevel.DEBUG);
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
        if(!this.listening) {
            this.#logString("Cannot handle mouse move. Not listening...", LogLevel.ERROR, true);
            return;
        }
        if(this.window.viewable_container.is_animating()) {
            this.#logString("Ignoring mouse movement due to ongoing animation...", LogLevel.WARN);
            return;
        }
        this.#logString(`Mouse move event: position ${e.clientX}x${e.clientY}, 
            movement ${e.movementX}x${e.movementY}`, 
            LogLevel.DEBUG);
        
        this.diploma_handler.update_mouse_position(e.clientX, e.clientY);
        
        this.#handle_rotation(e);
        this.handle_intersections(e);
    }

    handle_mouse_down(e) {
        if(!this.listening) {
            this.#logString("Cannot handle mouse down. Not listening...", LogLevel.ERROR, true);
            return;
        }
        if(e.button === 0) {
            this.left_mouse_down = true;
            if(this.window.viewable_container.is_overlay_hidden()) {
                this.window.viewable_container.detect_rotation = true;
            }
        }
        if(e.button === 2) {
            this.right_mouse_down = true;
            if(this.grabbed_object) {
                release_object(this.grabbed_object);
                this.grabbed_object = null;
            }
        }
        if(this.window.viewable_container.is_overlay_hidden() && e.button === 2) {
            const found_intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);
            found_intersections.forEach(i => {
                switch(extract_type(i.object)) {
                case BTYPES.INTERACTABLE:
                    if(this.left_mouse_down) {
                        this.grabbed_object = i.object;
                        grab_object(this.grabbed_object, this.window.viewable_container.get_camera());
                    } else {
                        shove_object(i.object, this.window.viewable_container.get_camera());
                    }
                    break;
                default:
                    break;
                }
            });
        }
    }

    handle_mouse_up(e) {
        if(!this.listening) {
            this.#logString("Cannot handle mouse up. Not listening...", LogLevel.ERROR, true);
            return;
        }
        if(this.grabbed_object) {
            release_object(this.grabbed_object, this.window.background_container);
            this.grabbed_object = null;
        }
        const intersections = this.get_intersect_list(
            e, 
            this.window.viewable_container.get_camera(), 
            this.window.scene
        );
        this.window.viewable_container.handle_mouse_up(intersections);
        if (e.button === 0) {
            this.window.viewable_container.detect_rotation = false;
            this.left_mouse_down = false;
        }
        if (e.button === 2) {
            this.window.viewable_container.detect_rotation = false;
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
            // Camera zoom controls when overlay is hidden and no object grabbed
            const zoom_delta = e.deltaY * 0.01; // Adjust sensitivity as needed
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

    #handle_rotation(e) {
        update_mouse_position(e);
        if(this.window.viewable_container.detect_rotation && this.left_mouse_down) {
            this.window.viewable_container.get_camera_manager().rotate(
                e.movementX * InteractionManager.mouse_sensitivity,
                e.movementY * InteractionManager.mouse_sensitivity
            );
        }
    }

    handle_intersections(e) {
        const found_intersections = this.get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);       
        const is_overlay_hidden = this.window.viewable_container.is_overlay_hidden();
        
        this.diploma_handler.check_diploma_hover(found_intersections, this.window.scene);
        
        let relevant_intersections = found_intersections;
        if(!is_overlay_hidden) {
            relevant_intersections = found_intersections.filter(intersection => {
                const object_name = intersection.object.name;
                const name_type = object_name.split("_")[0] + "_";
                return name_type === BTYPES.LABEL;
            });
        }
        if(relevant_intersections.length > 0 && !this.window.viewable_container.get_overlay().is_swapping_sides()) {
            const intersected_object = relevant_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = object_name.split("_")[0] + "_";
            switch(name_type) {
            case BTYPES.LABEL:
                this.window.viewable_container.get_overlay().handle_hover(intersected_object);
                this.activation_interaction_handler.handle_category_hover(object_name);
                break;
            case BTYPES.FLOOR:
                this.window.viewable_container.get_overlay().reset_hover();
                this.activation_interaction_handler.handle_category_hover_exit();
                break;
            case BTYPES.INTERACTABLE:
                this.hovered_interactable_name = object_name;
                this.#logString("Hover detected on interactable:", LogLevel.DEBUG);
                break;
            default:
                this.window.viewable_container.get_overlay().reset_hover();
                this.activation_interaction_handler.handle_category_hover_exit();
                break;
            }
        } else {
            this.window.viewable_container.get_overlay().reset_hover();
            this.activation_interaction_handler.handle_category_hover_exit();
            if (is_overlay_hidden) {
                this.hovered_interactable_name = "";
            }
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

    #logString(incomingString, incomingLevel, forceLog = false) {
        if(InteractionManager.LOG_FLAG || forceLog) {
            switch(incomingLevel) {
                case LogLevel.DEBUG:
                    console.debug(incomingString);
                    break;
                case LogLevel.WARN:
                    console.warn(incomingString);
                    break;
                case LogLevel.INFO:
                    console.info(incomingString);
                    break;
                case LogLevel.ERROR:
                    console.error(incomingString);
                    break;
            }
        }
    }
}