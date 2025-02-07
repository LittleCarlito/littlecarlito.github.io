import { CSS2DObject } from "three/examples/jsm/Addons.js";
import { UI_Z_DIST } from "../viewable_ui";
import { CATEGORIES } from "./common/categories.js";

const WIDTH_OFFSET = 2;
const HEIGHT_OFFSET = 2;
const PLACEHOLDER_PATH = '/pages/placeholder.html';
export const IFRAME = "iframe_";
export const DIV = "div_"

export class TextFrame {
    camera;
    parent;
    div;
    iframe;
    css_div;
    
    constructor(incoming_parent, incoming_camera, incoming_width, incoming_height) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.div = document.createElement( 'div' );
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
        const calced_width = incoming_width - WIDTH_OFFSET;
        const calced_height = incoming_height - HEIGHT_OFFSET;
        const distance_to_camera = UI_Z_DIST;
        // Calculate conversion ratio
        const vertical_fov = 75 * Math.PI / 180;
        const pixels_per_unit = window.innerHeight / (2 * Math.tan(vertical_fov / 2) * distance_to_camera);
        // Convert units
        const pixel_width = Math.round(calced_width * pixels_per_unit);
        const pixel_height = Math.round(calced_height * pixels_per_unit);
        // Apply conversions
        this.div.style.width = `${pixel_width}px`;
        this.div.style.height = `${pixel_height}px`;
        this.iframe.style.width = `${pixel_width}px`;
        this.iframe.style.height = `${pixel_height}px`;
        this.iframe.style.border = '0px';
    }
}