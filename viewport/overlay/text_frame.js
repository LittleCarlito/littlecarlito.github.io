import { CSS2DObject } from "three/examples/jsm/Addons.js";
import { CATEGORIES } from "./overlay_common/categories.js";

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
        
        // Apply conversions with maximum size limits
        this.pixel_width = Math.min(800, Math.round(this.frame_width * pixels_per_unit));
        this.pixel_height = Math.min(600, Math.round(this.frame_height * pixels_per_unit));
        
        // Apply to both div and iframe
        this.div.style.width = `${this.pixel_width}px`;
        this.div.style.height = `${this.pixel_height}px`;
        
        this.iframe.style.width = `${this.pixel_width}px`;
        this.iframe.style.height = `${this.pixel_height}px`;
        this.iframe.style.border = '0px';
    }
}