import { BTYPES } from '../../index';

export class UIInteractionHandler {
    constructor() {
        this.current_hovered_label = null;
        this.window = null;
    }

    initialize(window) {
        this.window = window;
    }

    dispose() {
        this.current_hovered_label = null;
        this.window = null;
    }

    handleUIIntersections(intersections, is_overlay_hidden) {
        let relevant_intersections = intersections;
        if (!is_overlay_hidden) {
            relevant_intersections = intersections.filter(intersection => {
                const object_name = intersection.object.name;
                const name_type = object_name.split("_")[0] + "_";
                return name_type === BTYPES.LABEL || 
                       object_name.includes('artist_') || 
                       object_name.includes('link_') || 
                       object_name.includes('hide_');
            });
        }

        if (relevant_intersections.length > 0 && !this.window.viewable_container.get_overlay().is_swapping_sides()) {
            const intersected_object = relevant_intersections[0].object;
            const object_name = intersected_object.name;
            const name_type = object_name.split("_")[0] + "_";
            
            switch(name_type) {
                case BTYPES.LABEL:
                    this.#setCursor('pointer');
                    this.#logLabelInformation(intersected_object);
                    this.window.viewable_container.get_overlay().handle_hover(intersected_object);
                    if (this.window.activation_interaction_handler) {
                        this.window.activation_interaction_handler.handle_category_hover(object_name);
                    }
                    break;
                case 'artist_':
                    this.#setCursor('pointer');
                    break;
                case 'link_':
                    this.#setCursor('pointer');
                    break;
                case 'hide_':
                    this.#setCursor('pointer');
                    break;
                case BTYPES.FLOOR:
                    this.#clearUIHover();
                    break;
                case BTYPES.INTERACTABLE:
                    break;
                default:
                    this.#clearUIHover();
                    break;
            }
        } else {
            this.#clearUIHover();
        }
    }

    handleUIClick(intersections) {
        const relevant_intersections = intersections.filter(intersection => {
            const object_name = intersection.object.name;
            return object_name.includes('artist_');
        });
        
        if (relevant_intersections.length > 0) {
            const overlay = this.window.viewable_container.get_overlay();
            if (overlay && overlay.artist_block) {
                overlay.artist_block.handle_click();
                return true;
            }
        }
        return false;
    }

    #logLabelInformation(intersected_object) {
        if (this.current_hovered_label === intersected_object.name) {
            return;
        }
        
        this.current_hovered_label = intersected_object.name;
        
        const labelInfo = {
            name: intersected_object.name,
            simple_name: intersected_object.simple_name,
            position: {
                x: intersected_object.position.x,
                y: intersected_object.position.y,
                z: intersected_object.position.z
            },
            rotation: {
                x: intersected_object.rotation.x,
                y: intersected_object.rotation.y,
                z: intersected_object.rotation.z
            },
            parent_name: intersected_object.parent?.name,
            render_order: intersected_object.renderOrder
        };
        
        // console.log("Label Hover Info:", labelInfo);
    }

    #clearUIHover() {
        this.#clearLabelHover();
        this.window.viewable_container.get_overlay().reset_hover();
        if (this.window.activation_interaction_handler) {
            this.window.activation_interaction_handler.handle_category_hover_exit();
        }
    }

    #clearLabelHover() {
        if (this.current_hovered_label) {
            // console.log("Label hover cleared:", this.current_hovered_label);
            this.current_hovered_label = null;
            this.#setCursor('default');
        }
    }

    #setCursor(cursorType) {
        if (this.window && this.window.document && this.window.document.body) {
            this.window.document.body.style.cursor = cursorType;
        }
    }
}