import { CSS2DRenderer } from 'three/examples/jsm/Addons.js';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { OutputPass } from 'three/examples/jsm/Addons.js';
import { THREE } from './index.js';

export class AppRenderer {
	webgl_renderer;
	css_renderer;
	composer;
	css3d_factory;
	isFirstRender = true;
	compilationComplete = false;

	constructor(incoming_parent, incoming_camera) {
		this.parent = incoming_parent;
		this.camera = incoming_camera;
		this.css3d_factory = null;
		
		this.css_renderer = new CSS2DRenderer();
		this.css_renderer.setSize(window.innerWidth, window.innerHeight);
		this.css_renderer.domElement.style.position = 'absolute';
		this.css_renderer.domElement.style.top = '0';
		this.css_renderer.domElement.style.zIndex = '1';
		document.body.appendChild(this.css_renderer.domElement);
		
		this.webgl_renderer = new THREE.WebGLRenderer({ 
			antialias: true,
			powerPreference: "high-performance",
			stencil: false,
			depth: true,
			alpha: false
		});
		this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
		this.webgl_renderer.shadowMap.enabled = true;
		this.webgl_renderer.shadowMap.type = THREE.VSMShadowMap;
		this.webgl_renderer.sortObjects = false;
		this.webgl_renderer.domElement.style.position = 'absolute';
		this.webgl_renderer.domElement.style.top = '0';
		this.webgl_renderer.domElement.style.zIndex = '0';
		document.body.appendChild(this.webgl_renderer.domElement);
		
		this.composer = new EffectComposer(this.webgl_renderer);
		const output_pass = new OutputPass();
		const render_scene = new RenderPass(this.parent, this.camera);
		this.composer.addPass(render_scene);
		this.composer.addPass(output_pass);
		this.composer.setSize(window.innerWidth, window.innerHeight);
	}

	async precompileShaders() {
		if (this.compilationComplete) return;
		
		console.log('Starting shader precompilation...');
		const startTime = performance.now();
		
		await this.webgl_renderer.compileAsync(this.parent, this.camera);
		
		this.compilationComplete = true;
		const endTime = performance.now();
		console.log(`Shader precompilation completed in ${(endTime - startTime).toFixed(2)}ms`);
	}

	setCss3dFactory(css3dFactory) {
		this.css3d_factory = css3dFactory;
	}

	add_event_listener(incoming_event_name, handler_method) {
		this.webgl_renderer.domElement.addEventListener(incoming_event_name, handler_method);
		this.css_renderer.domElement.addEventListener(incoming_event_name, handler_method);
	}

	remove_event_listener(incoming_event_name, handler_method) {
		this.webgl_renderer.domElement.removeEventListener(incoming_event_name, handler_method);
		this.css_renderer.domElement.removeEventListener(incoming_event_name, handler_method);
	}

	dispose() {
		this.webgl_renderer.setAnimationLoop(null);
		
		if (this.css3d_factory) {
			this.css3d_factory.dispose();
			this.css3d_factory = null;
		}
		
		if (this.composer) {
			this.composer.passes.forEach(pass => {
				if (pass.dispose) {
					pass.dispose();
				}
			});
		}
		
		if (this.webgl_renderer) {
			this.webgl_renderer.dispose();
			if (document.body.contains(this.webgl_renderer.domElement)) {
				document.body.removeChild(this.webgl_renderer.domElement);
			}
		}
		if (this.css_renderer && document.body.contains(this.css_renderer.domElement)) {
			document.body.removeChild(this.css_renderer.domElement);
		}
		
		this.composer = null;
		this.webgl_renderer = null;
		this.css_renderer = null;
	}

	render() {
		if (this.isFirstRender && !this.compilationComplete) {
			console.warn('First render called before shader compilation - this may cause lag');
		}
		
		this.composer.render();
		this.css_renderer.render(this.parent, this.camera);
		
		if (this.css3d_factory && this.css3d_factory.css3dRenderer && this.css3d_factory.css3dScene) {
			this.css3d_factory.css3dRenderer.render(this.css3d_factory.css3dScene, this.camera);
		}
		
		this.isFirstRender = false;
	}

	forceRender() {
		this.render();
	}

	resize() {
		this.webgl_renderer.setSize(window.innerWidth, window.innerHeight);
		this.css_renderer.setSize(window.innerWidth, window.innerHeight);
		this.composer.setSize(window.innerWidth, window.innerHeight);
		
		if (this.css3d_factory && this.css3d_factory.css3dRenderer) {
			this.css3d_factory.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
		}
	}

	setPixelRatio(ratio) {
		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.backgroundColor = 'black';
		overlay.style.opacity = '0';
		overlay.style.transition = 'opacity 0.2s ease-in-out';
		overlay.style.zIndex = '9999';
		overlay.style.pointerEvents = 'none';
		document.body.appendChild(overlay);
		
		const currentBgColor = window.getComputedStyle(document.body).backgroundColor || 'black';
		overlay.style.backgroundColor = currentBgColor;
		
		overlay.offsetHeight;
		overlay.style.opacity = '0.3'; 
		
		setTimeout(() => {
			this.webgl_renderer.setPixelRatio(ratio);
			this.composer.setPixelRatio(ratio);
			this.render();
			setTimeout(() => {
				this.render();
				overlay.style.opacity = '0';
				setTimeout(() => {
					if (document.body.contains(overlay)) {
						document.body.removeChild(overlay);
					}
					this.render();
				}, 250);
			}, 50);
		}, 200);
	}

	set_animation_loop(incoming_function) {
		this.webgl_renderer.setAnimationLoop(incoming_function);
	}

	get_renderer() {
		return this.webgl_renderer;
	}
}