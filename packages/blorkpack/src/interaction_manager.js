import { BTYPES, extract_type, THREE } from './index';
import { 
    update_mouse_position,
    zoom_object_in,
    zoom_object_out,
    release_object,
    grab_object,
    shove_object
} from "./physics";

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
        // See if instance exists
        if (InteractionManager.instance){
            return InteractionManager.instance;
        }
        // Setup variables
        this.window = null;
        this.abortController = null;
        this.listening = false;
        this.raycaster = null;
        // Pointer variables
        this.mouse_location = null;
        this.left_mouse_down = false;
        this.right_mouse_down = false;
        // Object specific variables
        this.hovered_interactable_name = "";
        this.grabbed_object = null;
        this.resize_timeout = null;
        this.resize_move = false;
        this.zoom_event = false;
        // Set instance to this
        InteractionManager.instance = this;
    }

    /**
     * Gets the singleton instance of InteractionManager
     * @returns {InteractionManager} The singleton instance
     */
    static getInstance() {
        if(!InteractionManager.instance) {
            InteractionManager.instance = new InteractionManager();
        }
        return InteractionManager.instance;
    }

    /**
     * Starts listening for user input events on the provided window
     * @param {Window} incomingWindow - The window object to attach event listeners to
     * @returns {Promise<void>} Promise that resolves when listening has started
     */
    async startListening(incomingWindow) {
        // this.#logString("BAZINGA GOTTEM", LogLevel.ERROR);
        this.window = incomingWindow;
        await this.#waitForDependencies();
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

    /**
     * Stops listening for user input events and cleans up resources
     */
    stopListening() {
        if(!this.listening) {
            this.#logString("Wasn't listening anyways...", LogLevel.WARN)
        }
        if (this.abortController) {
            this.abortController.abort();
        }
        this.window = null;
        this.abortController = null;
        this.listening = false;
    }

    /**
     * Handles window resize events and triggers appropriate responses
     * @param {Event} e - The resize event
     */
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

    /**
     * Handles mouse movement events for camera rotation and object intersection detection
     * @param {Event} e - Mouse movement event
     */
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
        this.#handle_rotation(e);
        this.#handle_intersections(e);
    }

    /**
     * Handles mouse down events for object interaction and camera rotation control
     * @param {Event} e - Mouse down event
     */
    handle_mouse_down(e) {
        if(!this.listening) {
            this.#logString("Cannot handle mouse down. Not listening...", LogLevel.ERROR, true);
            return;
        }
        if(e.button === 0) {
            this.left_mouse_down = true;
        }
        if(e.button === 2) {
            this.right_mouse_down = true;
            if(this.grabbed_object) {
                release_object(this.grabbed_object);
                this.grabbed_object = null;
            }
        }
        if(this.left_mouse_down && this.right_mouse_down && this.window.viewable_container.is_overlay_hidden()) {
            this.window.viewable_container.detect_rotation = true;
        } else if(this.window.viewable_container.is_overlay_hidden()) {
            const found_intersections = this.#get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);
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

    /**
     * Handles mouse up events for the viewable container
     * @param {Event} e - The mouse event
     */
    handle_mouse_up(e) {
        if(!this.listening) {
            this.#logString("Cannot handle mouse up. Not listening...", LogLevel.ERROR, true);
            return;
        }
        if(this.grabbed_object) {
            release_object(this.grabbed_object, this.window.background_container);
            this.grabbed_object = null;
        }
        const intersections = this.#get_intersect_list(
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

    /**
     * Handles mouse wheel events for zooming grabbed objects
     * @param {WheelEvent} e - The wheel event
     */
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
        }
    }

    /**
     * Prevents the default context menu from appearing
     * @param {Event} e - The context menu event
     */
    handle_context_menu(e) {
        e.preventDefault();
    }

    /**
     * Waits for required dependencies to be available before proceeding
     * @returns {Promise<void>} Promise that resolves when dependencies are ready
     */
    #waitForDependencies() {
        return new Promise((resolve, reject) => {
            const timeout = 5000; // 5 second timeout
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

    /**
     * Handles mouse rotation events for camera control
     * @param {Event} e - Mouse movement event
     */
    #handle_rotation(e) {
        update_mouse_position(e);
        if(this.window.viewable_container.detect_rotation) {
            this.window.viewable_container.get_camera_manager().rotate(
                e.movementX * InteractionManager.mouse_sensitivity,
                e.movementY * InteractionManager.mouse_sensitivity
            );
        }
    }

    /**
     * Handles intersection detection and processes hover interactions for different object types
     * @param {Event} e - Mouse movement event
     */
    #handle_intersections(e) {
        const found_intersections = this.#get_intersect_list(e, this.window.viewable_container.get_camera(), this.window.scene);       
        const is_overlay_hidden = this.window.viewable_container.is_overlay_hidden();
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
                break;
            case BTYPES.FLOOR:
                this.window.viewable_container.get_overlay().reset_hover();
                break;
            case BTYPES.INTERACTABLE:
                this.hovered_interactable_name = object_name;
                this.#logString("Hover detected on interactable:", LogLevel.DEBUG);
                break;
            default:
                this.window.viewable_container.get_overlay().reset_hover();
                break;
            }
        } else {
            this.window.viewable_container.get_overlay().reset_hover();
            if (is_overlay_hidden) {
                this.hovered_interactable_name = "";
            }
        }
    }

    /**
     * Retrieves objects mouse is intersecting with from the given event
     * @param {Event} e - The mouse event
     * @param {THREE.Camera} incoming_camera - The camera to use for raycasting
     * @param {THREE.Scene} incoming_scene - The scene to raycast against
     * @returns {Array} Array of intersection objects sorted by priority
     */
    #get_intersect_list(e, incoming_camera, incoming_scene) {
        const ndc = this.#get_ndc_from_event(e);
        const mousePos = this.#getMouseLocation();
        mousePos.x = ndc.x;
        mousePos.y = ndc.y;
        const ray = this.#getRaycaster();
        ray.setFromCamera(mousePos, incoming_camera);
        const intersections = ray.intersectObject(incoming_scene, true);
        // First sort by renderOrder (higher values first)
        // This ensures UI elements with high renderOrder are prioritized
        // Then sort by distance within the same renderOrder group
        return intersections.sort((a, b) => {
            const renderOrderA = a.object.renderOrder || 0;
            const renderOrderB = b.object.renderOrder || 0;
            // If renderOrder is different, prioritize higher renderOrder
            if (renderOrderB !== renderOrderA) {
                return renderOrderB - renderOrderA;
            }
            // Check if either object is a label or contains "label" in its name
            const isLabelA = a.object.name.includes('label_') || a.object.name.includes('_collision');
            const isLabelB = b.object.name.includes('label_') || b.object.name.includes('_collision');
            // If only one is a label, prioritize it
            if (isLabelA && !isLabelB) return -1;
            if (!isLabelA && isLabelB) return 1;
            // Otherwise, sort by distance (closer first for UI elements)
            return a.distance - b.distance;
        });
    }

    /**
     * Get the mouse location vector, initializing if needed
     * @returns {THREE.Vector2} The mouse location vector
     */
    #getMouseLocation() {
        if (!this.mouse_location) {
            this.mouse_location = new THREE.Vector2();
        }
        return this.mouse_location;
    }

    /**
     * Converts screen coordinates to Normalized Device Coordinates (NDC)
     * @param {Event} e - The mouse event
     * @returns {Object} Object containing x and y NDC coordinates
     */
    #get_ndc_from_event(e) {
        return {
            x: (e.clientX / this.window.innerWidth) * 2 - 1,
            y: -(e.clientY / this.window.innerHeight) * 2 + 1
        };
    }

    /**
     * Get the raycaster, initializing if needed
     * @returns {THREE.Raycaster} The raycaster instance
     */
    #getRaycaster() {
        if (!this.raycaster) {
            this.raycaster = new THREE.Raycaster();
        }
        return this.raycaster;
    }

    /**
     * Logs a string with the specified log level
     * @param {string} incomingString - The string to log
     * @param {string} incomingLevel - The log level to use
     * @param {boolean} forceLog - Whether to force logging regardless of LOG_FLAG
     */
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