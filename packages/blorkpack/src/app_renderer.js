import { CSS2DRenderer, UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { OutputPass } from 'three/examples/jsm/Addons.js';
import { THREE } from './index.js';
/**
 *
 */
export class AppRenderer {
	webgl_renderer;
	css_renderer;
	composer;
	css3d_factory;
	/**
	 *
	 */
	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.css3d_factory = null;
		
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
	setCss3dFactory(css3dFactory) {
		this.css3d_factory = css3dFactory;
	}
	
	/**
	 *
	 */
	add_event_listener(incoming_event_name, handler_method) {
		this.webgl_renderer.domElement.addEventListener(incoming_event_name, handler_method);
		this.css_renderer.domElement.addEventListener(incoming_event_name, handler_method);
	}
	
	/**
	 *
	 */
	remove_event_listener(incoming_event_name, handler_method) {
		this.webgl_renderer.domElement.removeEventListener(incoming_event_name, handler_method);
		this.css_renderer.domElement.removeEventListener(incoming_event_name, handler_method);
	}
	
	/**
     * Properly disposes of all renderer resources to prevent memory leaks
     */
	dispose() {
		// Stop animation loop
		this.webgl_renderer.setAnimationLoop(null);
		
		// Dispose CSS3D factory
		if (this.css3d_factory) {
			this.css3d_factory.dispose();
			this.css3d_factory = null;
		}
		
		// Dispose of composer passes
		if (this.composer) {
			this.composer.passes.forEach(pass => {
				if (pass.dispose) {
					pass.dispose();
				}
			});
		}
		
		// Dispose of renderers
		if (this.webgl_renderer) {
			this.webgl_renderer.dispose();
			if (document.body.contains(this.webgl_renderer.domElement)) {
				document.body.removeChild(this.webgl_renderer.domElement);
			}
		}
		if (this.css_renderer && document.body.contains(this.css_renderer.domElement)) {
			document.body.removeChild(this.css_renderer.domElement);
		}
		
		// Clear references
		this.composer = null;
		this.webgl_renderer = null;
		this.css_renderer = null;
	}
	
	/**
	 *
	 */
	render() {
		this.composer.render();
		this.css_renderer.render(this.parent, this.camera);
		
		// Add CSS3D rendering
		if (this.css3d_factory && this.css3d_factory.css3dRenderer && this.css3d_factory.css3dScene) {
			this.css3d_factory.css3dRenderer.render(this.css3d_factory.css3dScene, this.camera);
		}
	}
	
	/**
     * Force a render. Used by the debug UI for smooth resolution changes.
     */
	forceRender() {
		this.render();
	}
	
	/**
	 *
	 */
	resize() {
		this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
		this.css_renderer.setSize(window.innerWidth, window.innerHeight);
		
		// Add CSS3D resize
		if (this.css3d_factory && this.css3d_factory.css3dRenderer) {
			this.css3d_factory.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
		}
		
		// Update bloom pass resolution
		const bloomPass = this.composer.passes.find(pass => pass instanceof UnrealBloomPass);
		if (bloomPass) {
			bloomPass.resolution.set(window.innerWidth, window.innerHeight);
		}
	}
	
	/**
     * Sets the pixel ratio with proper handling of the post-processing pipeline
     * @param {number} ratio - The new pixel ratio
     */
	setPixelRatio(ratio) {
		// Create overlay for smooth transition
		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.backgroundColor = 'black';
		overlay.style.opacity = '0';
		overlay.style.transition = 'opacity 0.2s ease-in-out';
		overlay.style.zIndex = '9999'; // Very high z-index to be above everything
		overlay.style.pointerEvents = 'none'; // Don't block interactions
		document.body.appendChild(overlay);
		
		// Store current canvas to properly match the background color
		const currentBgColor = window.getComputedStyle(document.body).backgroundColor || 'black';
		overlay.style.backgroundColor = currentBgColor;
		
		// Apply fade-in
		// Force a reflow to ensure transition works
		overlay.offsetHeight;
		// Fade to higher opacity to ensure complete masking
		overlay.style.opacity = '0.3'; 
		
		// After fade-in completes, update renderer
		setTimeout(() => {
			// Update renderer
			this.webgl_renderer.setPixelRatio(ratio);
			// Update composer
			this.composer.setPixelRatio(ratio);
			// Force a render to apply changes - do this twice to ensure all buffers are updated
			this.render();
			// Wait a bit for the render to complete before starting fade-out
			setTimeout(() => {
				// Double-check with a second render
				this.render();
				// Now start fade-out
				overlay.style.opacity = '0';
				// Clean up after transition
				setTimeout(() => {
					if (document.body.contains(overlay)) {
						document.body.removeChild(overlay);
					}
					// Final render after cleanup
					this.render();
				}, 250); // Longer cleanup time
			}, 50); // Short delay between renderer update and fade-out
		}, 200); // Longer delay to ensure fade-in is complete
	}
	
	// ----- Setters
	/**
	 *
	 */
	set_animation_loop(incoming_function) {
		this.webgl_renderer.setAnimationLoop(incoming_function);
	}
	
	// ----- Getters
	/**
     * Returns the WebGL renderer instance
     * @returns {THREE.WebGLRenderer} The WebGL renderer
     */
	get_renderer() {
		return this.webgl_renderer;
	}
}