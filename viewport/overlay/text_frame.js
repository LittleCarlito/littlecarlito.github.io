import { CSS2DObject } from "three/examples/jsm/Addons.js";

const TEST_LINK = "https://www.youtube.com/embed/SJOz3qjfQXU?";

// TODO OOOOOO
// TODO create one of these inside every text box
// TODO Enable mouse physics when HideButton enabled
// TODO Create html pages for each category
// TODO Ensure html page text boxes are sensitive to zooming
//          Text should enlarge
export class TextFrame {
    constructor(incoming_parent) {
        this.parent = incoming_parent;
        const div = document.createElement( 'div' );
        div.style.width = '480px';
        div.style.height = '360px';
        div.style.backgroundColor = '#000';
        const iframe = document.createElement('iframe');
        iframe.style.width = '480px';
        iframe.style.height = '360px';
        iframe.style.border = '0px';
        // Use the current domain as the origin parameter; adjust if needed for development vs production
        const origin = window.location.origin;
        iframe.src = `${TEST_LINK}rel=0&origin=${origin}`;
        // Recommended allow attributes
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        div.appendChild(iframe);
        this.css_div = new CSS2DObject(div);
        this.parent.add(this.css_div);
        // TODO Get positioning bacsed off incomign parent dimensions to position directly in the middle
        //          Should also provide same margin on all sides to show background asset
        this.css_div.position.set(2.5, 0, 5);
    }
}