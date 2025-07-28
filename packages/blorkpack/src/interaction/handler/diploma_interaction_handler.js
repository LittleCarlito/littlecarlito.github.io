const TOP_DIPLOMA_LOG_MESSAGE = "DePaul University";
const TOP_DIPLOMA_TEXT = `Masters in Computer Science <i>with Distinction</i>\nGPA: 3.98`;
const BOTTOM_DIPLOMA_LOG_MESSAGE = "Michigan State University";
const BOTTOM_DIPLOMA_TEXT = "Bachelor of Arts in Economics";
const INFO_BOX_WIDTH = 190;
const INFO_BOX_HEIGHT = 100;

export class DiplomaInteractionHandler {
    constructor() {
        this.current_hovered_diploma = null;
        this.info_box = null;
        this.mouse_x = 0;
        this.mouse_y = 0;
        this.setup_info_box();
    }

    setup_info_box() {
        this.info_box = document.createElement('div');
        this.info_box.style.position = 'fixed';
        this.info_box.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
        this.info_box.style.border = '2px solid rgba(64, 64, 64, 1)';
        this.info_box.style.color = 'white';
        this.info_box.style.padding = '12px 16px';
        this.info_box.style.borderRadius = '4px';
        this.info_box.style.fontSize = '14px';
        this.info_box.style.fontFamily = 'Arial, sans-serif';
        this.info_box.style.pointerEvents = 'none';
        this.info_box.style.zIndex = '10000';
        this.info_box.style.display = 'none';
        this.info_box.style.whiteSpace = 'pre-line';
        this.info_box.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        this.info_box.style.textAlign = 'center';
        this.info_box.style.minWidth = `${INFO_BOX_WIDTH}px`;
        this.info_box.style.minHeight = `${INFO_BOX_HEIGHT}px`;
        this.info_box.style.width = `${INFO_BOX_WIDTH}px`;
        this.info_box.style.height = `${INFO_BOX_HEIGHT}px`;
        this.info_box.style.boxSizing = 'border-box';
        this.info_box.style.flexDirection = 'column';
        this.info_box.style.justifyContent = 'center';
        this.info_box.style.left = '-9999px';
        this.info_box.style.top = '-9999px';
        document.body.appendChild(this.info_box);
    }

    update_mouse_position(x, y) {
        this.mouse_x = x;
        this.mouse_y = y;
        if (this.info_box && this.info_box.style.display === 'flex') {
            this.position_info_box();
        }
    }

    position_info_box() {
        if (!this.info_box) return;
        
        const box_rect = this.info_box.getBoundingClientRect();
        const viewport_width = window.innerWidth;
        
        let final_x = this.mouse_x - (box_rect.width / 2);
        let final_y = this.mouse_y - box_rect.height;
        
        if (final_x < 0) {
            final_x = 5;
        } else if (final_x + box_rect.width > viewport_width) {
            final_x = viewport_width - box_rect.width - 5;
        }
        
        if (final_y < 0) {
            final_y = this.mouse_y + 20;
        }
        
        this.info_box.style.left = `${final_x}px`;
        this.info_box.style.top = `${final_y}px`;
    }

    show_info_box(diploma_type) {
        if (!this.info_box) return;
        
        const title_text = diploma_type === 'top' ? TOP_DIPLOMA_LOG_MESSAGE : BOTTOM_DIPLOMA_LOG_MESSAGE;
        const content_text = diploma_type === 'top' ? TOP_DIPLOMA_TEXT : BOTTOM_DIPLOMA_TEXT;
        
        this.info_box.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; line-height: 1.2;">${title_text}</div>
            <div style="line-height: 1.4;">${content_text}</div>
        `;
        
        this.info_box.style.display = 'flex';
        this.position_info_box();
    }

    hide_info_box() {
        if (this.info_box) {
            this.info_box.style.display = 'none';
            this.info_box.innerHTML = '';
            this.info_box.style.left = '-9999px';
            this.info_box.style.top = '-9999px';
        }
    }

    check_diploma_hover(found_intersections, scene) {
        let new_hovered_diploma = null;
        let diploma_asset_info = null;
        let is_ui_diploma = false;
        
        for (const intersection of found_intersections) {
            const object = intersection.object;
            
            if (object.name && (object.name.includes('diploma') || object.name.includes('DIPLOMA'))) {
                is_ui_diploma = this.is_ui_diploma(object);
                
                if (!is_ui_diploma) continue;
                
                if (object.name.includes('BOT') || object.name.includes('bot')) {
                    new_hovered_diploma = 'top';
                    diploma_asset_info = {
                        name: object.name,
                        position: object.position,
                        distance: intersection.distance,
                        isUI: is_ui_diploma
                    };
                    break;
                } else if (object.name.includes('TOP') || object.name.includes('top')) {
                    new_hovered_diploma = 'bot';
                    diploma_asset_info = {
                        name: object.name,
                        position: object.position,
                        distance: intersection.distance,
                        isUI: is_ui_diploma
                    };
                    break;
                }
            }
            
            let parent = object.parent;
            while (parent && parent !== scene) {
                if (parent.name && (parent.name.includes('diploma') || parent.name.includes('DIPLOMA'))) {
                    is_ui_diploma = this.is_ui_diploma(parent);
                    
                    if (!is_ui_diploma) break;
                    
                    if (parent.name.includes('BOT') || parent.name.includes('bot')) {
                        new_hovered_diploma = 'top';
                        diploma_asset_info = {
                            name: parent.name,
                            position: parent.position,
                            distance: intersection.distance,
                            isUI: is_ui_diploma
                        };
                        break;
                    } else if (parent.name.includes('TOP') || parent.name.includes('top')) {
                        new_hovered_diploma = 'bot';
                        diploma_asset_info = {
                            name: parent.name,
                            position: parent.position,
                            distance: intersection.distance,
                            isUI: is_ui_diploma
                        };
                        break;
                    }
                }
                parent = parent.parent;
            }
            
            if (new_hovered_diploma) break;
        }
        
        if (new_hovered_diploma !== this.current_hovered_diploma) {
            if (this.current_hovered_diploma) {
                this.hide_info_box();
            }
            
            this.current_hovered_diploma = new_hovered_diploma;
            
            if (new_hovered_diploma) {
                this.show_info_box(new_hovered_diploma);
            }
        }
    }

    is_ui_diploma(object) {
        let current = object;
        while (current) {
            if (current.name && current.name.includes('text_')) {
                return true;
            }
            if (current.name && current.name.includes('interactable_')) {
                return false;
            }
            current = current.parent;
        }
        return false;
    }

    dispose() {
        if (this.info_box) {
            document.body.removeChild(this.info_box);
            this.info_box = null;
        }
    }
}