import { CSS2DObject } from "three/examples/jsm/Addons.js";
import { UI_Z_DIST } from "../viewable_ui";

const TEST_LINK = "https://www.youtube.com/embed/SJOz3qjfQXU?";

// TODO OOOOOO
// TODO Enable mouse physics when HideButton enabled
// TODO Create html pages for each category
// TODO Ensure html page text boxes are sensitive to zooming
//          Text should enlarge
export class TextFrame {
    camera;
    parent;
    div;
    iframe;
    css_div;
    
    constructor(incoming_parent, incoming_camera, incoming_width, incoming_height) {
        this.parent = incoming_parent;
        console.log(`incoming camera ${incoming_camera}`);
        this.camera = incoming_camera;
        this.div = document.createElement( 'div' );
        this.iframe = document.createElement('iframe');
        const origin = window.location.origin;
        this.iframe.src = `${TEST_LINK}rel=0&origin=${origin}`;
        this.iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        this.iframe.setAttribute('allowfullscreen', '');
        this.div.appendChild(this.iframe);
        // Position and add to scene
        this.css_div = new CSS2DObject(this.div);
        this.parent.add(this.css_div);
        // Set initial size
        this.update_size(incoming_width - 2, incoming_height - 2);
    }

    update_size(incoming_width, incoming_height) {
        const distance_to_camera = UI_Z_DIST;
        // Calculate conversion ratio
        const vertical_fov = 75 * Math.PI / 180;
        const pixels_per_unit = window.innerHeight / (2 * Math.tan(vertical_fov / 2) * distance_to_camera);
        // Convert units
        const pixel_width = Math.round(incoming_width * pixels_per_unit);
        const pixel_height = Math.round(incoming_height * pixels_per_unit);
        // Apply conversions
        this.div.style.width = `${pixel_width}px`;
        this.div.style.height = `${pixel_height}px`;
        this.iframe.style.width = `${pixel_width}px`;
        this.iframe.style.height = `${pixel_height}px`;
        this.iframe.style.border = '0px';
    }
}