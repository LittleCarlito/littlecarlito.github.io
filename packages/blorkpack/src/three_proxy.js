// Proxy implementation for lazy-loading THREE
import { load_three } from './loader.js';
// Track module state
let threeModule = null;
let isInitialized = false;
let initPromise = null;

/**
 * Patches the THREE.WebGLRenderer constructor to automatically enable required WebGL extensions
 * @param {Object} three - The THREE module to patch
 */
function patchWebGLRenderer(three) {
	// Store the original WebGLRenderer constructor
	const OriginalWebGLRenderer = three.WebGLRenderer;
	
	// Create a new constructor that wraps the original
	three.WebGLRenderer = function(parameters) {
		// Call the original constructor
		const renderer = new OriginalWebGLRenderer(parameters);
		
		// Enable required WebGL extensions
		const gl = renderer.getContext();
		if (gl) {
			// Enable EXT_float_blend to avoid the warning
			gl.getExtension('EXT_float_blend');
			// Other useful extensions
			gl.getExtension('OES_texture_float');
			gl.getExtension('OES_texture_float_linear');
			gl.getExtension('WEBGL_depth_texture');
		}
		
		return renderer;
	};
	
	// Copy prototype and static properties
	three.WebGLRenderer.prototype = OriginalWebGLRenderer.prototype;
	Object.setPrototypeOf(three.WebGLRenderer, OriginalWebGLRenderer);
}

/**
 * Creates a proxy for the THREE module that lazily loads the actual module
 */
export function createThreeProxy() {
	// Create a handler proxy that forwards all property access to the real module
	return new Proxy({
		// Special method to initialize the module
		init: async function() {
			if (initPromise) return initPromise;
			initPromise = (async () => {
				const module = await load_three();
				threeModule = module.THREE;
				
				// Patch WebGLRenderer to automatically enable extensions
				patchWebGLRenderer(threeModule);
				
				isInitialized = true;
				return threeModule;
			})();
			return initPromise;
		}
	}, {
		// Handle property access
		get(target, prop) {
			// Special case for init method
			if (prop === 'init') {
				return target.init;
			}
			// Block access until initialized
			if (!isInitialized) {
				if (typeof prop === 'symbol' || prop === 'then' || prop === 'catch') {
					// Handle special JS properties to avoid errors
					return undefined;
				}
				throw new Error(`THREE.${String(prop)} cannot be accessed before initialization. Call initThree() first.`);
			}
			// Forward to the real module
			return threeModule[prop];
		}
	});
} 