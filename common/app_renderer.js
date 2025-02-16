import { CSS2DRenderer, UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { OutputPass } from 'three/examples/jsm/Addons.js';
import { THREE } from '.';

export class AppRenderer {
    webgl_renderer;
    css_renderer;
    composer;

    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        // Html rendering
        this.css_renderer = new CSS2DRenderer();
        this.css_renderer.setSize(window.innerWidth, window.innerHeight);
        this.css_renderer.domElement.style.position = 'absolute';
        this.css_renderer.domElement.style.top = '0';
        this.css_renderer.domElement.style.zIndex = '1'; // On top of WebGL canvas
        document.body.appendChild(this.css_renderer.domElement);
        // 3D rendering
        this.webgl_renderer = new THREE.WebGLRenderer({ antialias: true });
        this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
        this.webgl_renderer.shadowMap.enabled = true;
        this.webgl_renderer.shadowMap.type = THREE.VSMShadowMap;
        this. webgl_renderer.domElement.style.position = 'absolute';
        this. webgl_renderer.domElement.style.top = '0';
        this.webgl_renderer.domElement.style.zIndex = '0';
        document.body.appendChild(this.webgl_renderer.domElement);
        // After effects
        this.composer = new EffectComposer(this.webgl_renderer);
        const output_pass = new OutputPass();
        const render_scene = new RenderPass(this.parent, this.camera);
        const bloom_pass = new UnrealBloomPass( 
            new THREE.Vector2(window.innerWidth, window.innerHeight), // Resolution
            1.5, // Strength
            0.4, // Radius
            1 // Threshold
        );
        this.composer.addPass(render_scene);
        this.composer.addPass(bloom_pass);
        this.composer.addPass(output_pass);

    }

    // ----- Functions

    add_event_listener(incoming_event_name, handler_method) {
        this.webgl_renderer.domElement.addEventListener(incoming_event_name, handler_method);
        this.css_renderer.domElement.addEventListener(incoming_event_name, handler_method);
    }

    render() {
        this.composer.render();
        this.css_renderer.render(this.parent, this.camera);
    }

    resize() {
        this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
        this.css_renderer.setSize(window.innerWidth, window.innerHeight);
        // Update bloom pass resolution
        const bloomPass = this.composer.passes.find(pass => pass instanceof UnrealBloomPass);
        if (bloomPass) {
            bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }
    }

    
    // ----- Setters

    set_animation_loop(incoming_function) {
        this.webgl_renderer.setAnimationLoop(incoming_function);
    }
}