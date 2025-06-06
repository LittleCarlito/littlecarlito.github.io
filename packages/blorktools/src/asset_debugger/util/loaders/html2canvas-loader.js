// Track if we've attempted to load html2canvas
let html2canvasLoaded = false;
let html2canvasLoading = false;
let html2canvasCallbacks = [];

/**
 * Ensure html2canvas is loaded
 * @returns {Promise<boolean>} Promise that resolves to true if html2canvas is available
 */
export function loadHtml2Canvas() {
    return new Promise((resolve) => {
        // If already loaded, resolve immediately
        if (window.html2canvas) {
            resolve(true);
            return;
        }
        
        // If we already tried and failed to load, don't try again
        if (html2canvasLoaded && !window.html2canvas) {
            console.error('[HTML2CANVAS] Library could not be loaded previously');
            resolve(false);
            return;
        }
        
        // If already loading, add to callbacks
        if (html2canvasLoading) {
            console.debug('[HTML2CANVAS] Library already loading, waiting');
            html2canvasCallbacks.push(resolve);
            return;
        }
        
        // Start loading
        html2canvasLoading = true;
        console.log('[HTML2CANVAS] Starting library load');
        
        // Define potential sources for html2canvas
        const sources = [
            'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
            'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
            '/node_modules/html2canvas/dist/html2canvas.min.js',
            '/lib/html2canvas.min.js'
        ];
        
        // Try to load from the first source
        loadFromSource(0);
        
        function loadFromSource(index) {
            if (index >= sources.length) {
                console.error('[HTML2CANVAS] All sources failed, could not load the library');
                html2canvasLoaded = true; // Mark as loaded but failed
                html2canvasLoading = false;
                resolve(false);
                
                // Resolve any pending callbacks with failure
                html2canvasCallbacks.forEach(callback => callback(false));
                html2canvasCallbacks = [];
                return;
            }
            
            const source = sources[index];
            console.log(`[HTML2CANVAS] Trying to load from source: ${source}`);
            
            // Add script to page
            const script = document.createElement('script');
            script.src = source;
            script.async = true;
            
            let timeout = setTimeout(() => {
                console.warn(`[HTML2CANVAS] Timeout loading from ${source}, trying next source`);
                script.onload = null;
                script.onerror = null;
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                loadFromSource(index + 1);
            }, 5000); // 5 second timeout
            
            script.onload = () => {
                clearTimeout(timeout);
                if (window.html2canvas) {
                    console.log(`[HTML2CANVAS] Successfully loaded from ${source}`);
                    html2canvasLoaded = true;
                    html2canvasLoading = false;
                    resolve(true);
                    
                    // Resolve any pending callbacks
                    html2canvasCallbacks.forEach(callback => callback(true));
                    html2canvasCallbacks = [];
                } else {
                    console.warn(`[HTML2CANVAS] Loaded script from ${source}, but html2canvas is not available, trying next source`);
                    loadFromSource(index + 1);
                }
            };
            
            script.onerror = () => {
                clearTimeout(timeout);
                console.warn(`[HTML2CANVAS] Error loading from ${source}, trying next source`);
                loadFromSource(index + 1);
            };
            
            document.head.appendChild(script);
        }
    });
}


