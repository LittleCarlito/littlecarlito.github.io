// Proxy implementation for lazy-loading THREE
import { load_three } from './loader.js';
// Track module state
let threeModule = null;
let isInitialized = false;
let initPromise = null;

// Add this variable to track if we've added our extension enabler
let extensionEnablerAdded = false;

/**
 * A simple function that enables the necessary WebGL extensions for a renderer
 * @param {THREE.WebGLRenderer} renderer - The renderer to enable extensions for
 */
function enableExtensionsForRenderer(renderer) {
	if (!renderer) return;
	
	try {
		const gl = renderer.getContext();
		if (gl) {
			gl.getExtension('EXT_float_blend');
			gl.getExtension('OES_texture_float');
			gl.getExtension('OES_texture_float_linear');
			gl.getExtension('WEBGL_depth_texture');
		}
	} catch (e) {
		console.warn('Could not enable WebGL extensions:', e);
	}
}

/**
 * We'll add this function to the THREE global so it can be called manually
 */
function setupExtensionEnabler(three) {
	if (extensionEnablerAdded) return;
	
	// Add our enableExtensions helper to the THREE global
	three.enableWebGLExtensions = enableExtensionsForRenderer;
	
	// Print a helpful message in the console
	console.log('THREE.enableWebGLExtensions() is now available to manually enable WebGL extensions on any renderer');
	
	extensionEnablerAdded = true;
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
				
				// Add our extension enabler to THREE
				setupExtensionEnabler(threeModule);
				
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