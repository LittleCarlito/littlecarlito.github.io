// Proxy implementation for lazy-loading RAPIER
import { load_rapier, ensure_rapier_initialized } from './loader.js';
// Track module state
let rapierModule = null;
let isInitialized = false;
let initPromise = null;
/**
 * Creates a proxy for the RAPIER module that lazily loads the actual module
 */
export function createRapierProxy() {
	// Create a handler proxy that forwards all property access to the real module
	return new Proxy({
		// Special method to initialize the module
		init: async function() {
			if (initPromise) return initPromise;
			initPromise = (async () => {
				const module = await ensure_rapier_initialized();
				rapierModule = module;
				isInitialized = true;
				return module;
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
				throw new Error(`RAPIER.${String(prop)} cannot be accessed before initialization. Call initRapier() first.`);
			}
			// Forward to the real module
			return rapierModule[prop];
		}
	});
} 