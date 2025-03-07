import { CSS2DObject } from "three/examples/jsm/Addons.js";
import { CATEGORIES } from "../../common/categories.js";

const WIDTH_OFFSET = .5;
const HEIGHT_OFFSET = .5;
const PLACEHOLDER_PATH = '/pages/placeholder.html';
export const IFRAME = "iframe_";
export const DIV = "div_"

export class TextFrame {
    camera;
    parent;
    frame_width;
    pixel_width;
    frame_height;
    pixel_height;
    div;
    iframe;
    css_div;
    particles = [];
    wasVerySmall = false;
    
    constructor(incoming_parent, incoming_camera, incoming_width, incoming_height) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.div = document.createElement('div');
        this.div.name = `${DIV}${incoming_parent.simple_name}`;
        this.iframe = document.createElement('iframe');
        this.iframe.name = `${IFRAME}${incoming_parent.simple_name}`;
        // Look up the HTML path from CATEGORIES based on simple_name
        const category = Object.values(CATEGORIES).find(cat => cat.value === incoming_parent.simple_name);
        this.iframe.src = category ? category.html : PLACEHOLDER_PATH;
        this.div.appendChild(this.iframe);
        // Position and add to scene
        this.css_div = new CSS2DObject(this.div);
        this.css_div.simple_name = `${incoming_parent.simple_name}`;
        this.css_div.name = `${IFRAME}${this.css_div.simple_name}`;
        
        // Ensure iframe is always in front of 3D objects
        this.css_div.renderOrder = 999;
        
        // Special handling for contact frame - position it slightly forward
        if (incoming_parent.simple_name === CATEGORIES.CONTACT.value) {
            this.css_div.position.z = 0.05;
        }
        
        this.parent.add(this.css_div);
        // Set initial size
        this.update_size(incoming_width, incoming_height);
    }

    update_size(incoming_width, incoming_height) {
        this.frame_width = incoming_width - WIDTH_OFFSET;
        this.frame_height = incoming_height - HEIGHT_OFFSET;
        // Convert world units to pixels using the same scale as Three.js
        const fov = this.camera.fov * Math.PI / 180;
        const height_at_distance = 2 * Math.tan(fov / 2) * 15;
        const pixels_per_unit = window.innerHeight / height_at_distance;
        // Apply conversions
        this.pixel_width = Math.round(this.frame_width * pixels_per_unit);
        this.pixel_height = Math.round(this.frame_height * pixels_per_unit);
        // Apply to both div and iframe
        this.div.style.width = `${this.pixel_width}px`;
        this.div.style.height = `${this.pixel_height}px`;
        this.iframe.style.width = `${this.pixel_width}px`;
        this.iframe.style.height = `${this.pixel_height}px`;
        this.iframe.style.border = '0px';
        
        // Special handling for contact iframe - add transition for smooth resizing
        if (this.css_div && this.css_div.simple_name === CATEGORIES.CONTACT.value) {
            // Add a smooth transition for size changes
            this.iframe.style.transition = 'width 0.3s ease, height 0.3s ease';
            
            // Check for extreme resize case
            const isExtremeResize = this.wasVerySmall && this.pixel_width > 800;
            
            if (isExtremeResize) {
                // Add special handling for extreme resize cases
                // Very slight z-position adjustment to ensure content stays visible
                this.css_div.position.z = 0.055;
            } else {
                // Normal z-position
                this.css_div.position.z = 0.05;
            }
            
            // Track if we were in a very small state
            this.wasVerySmall = this.pixel_width < 500;
            
            // Notify the iframe content window about the resize
            if (this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage('resize', '*');
            }
        }
    }
}