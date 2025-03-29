// Proxy implementation for lazy-loading THREE
import { load_three } from './loader.js';
// Track module state
let threeModule = null;
let isInitialized = false;
let initPromise = null;
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