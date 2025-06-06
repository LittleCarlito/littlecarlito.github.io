import * as THREE from 'three';

// Track if we've attempted to load html2canvas
let html2canvasLoaded = false;
let html2canvasLoading = false;
let html2canvasCallbacks = [];
const HTML2CANVAS_DEBUG_FLAG = false;

/**
 * Ensure html2canvas is loaded
 * @returns {Promise<boolean>} Promise that resolves to true if html2canvas is available
 */
export function ensureHtml2Canvas() {
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

/**
 * Create a texture from the iframe content using html2canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @returns {Promise<THREE.Texture>} A promise that resolves to a Three.js texture
 */
export async function createTextureFromIframe(iframe) {
    return new Promise(async (resolve, reject) => {
        try {
                        
            // Make sure we can access the iframe
            if (!iframe || !document.body.contains(iframe)) {
                reject(new Error('Iframe not found in DOM or removed'));
                return;
            }
            
            // Ensure html2canvas is loaded
            const html2canvasAvailable = await ensureHtml2Canvas();
            if (!html2canvasAvailable) {
                reject(new Error('html2canvas library not available - cannot render HTML to texture'));
                return;
            }
            
            // Create a simple delay function
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            
            // Give more time for the iframe to fully load - increase from 300ms to 1000ms
            delay(1000).then(async () => {
                try {
                    // Check if we can access the iframe content safely
                    if (!iframe.contentDocument || !iframe.contentWindow) {
                        reject(new Error('Cannot access iframe content - security restriction or iframe removed'));
                        return;
                    }                    
                    // Make sure the body is fully loaded
                    if (!iframe.contentDocument.body) {
                        reject(new Error('Iframe body not available - iframe content failed to load'));
                        return;
                    }
                    
                    // Inject animation detection script if not already injected
                    if (!iframe.contentWindow.__animationDetection) {
                        injectUnifiedAnimationDetectionScript(iframe, 'image2texture');
                    }

                    // Ensure iframe is visible for capture (even if off-screen)
                    const originalStyle = iframe.style.cssText;
                    iframe.style.position = 'absolute';
                    iframe.style.left = '-9999px';
                    iframe.style.visibility = 'visible';
                    iframe.style.opacity = '1';
                    
                    // Apply a frame to the content to make it more visible on the texture
                    const styleElement = iframe.contentDocument.createElement('style');
                    
                    // Never show borders when capturing for long exposure
                    const shouldShowBorders = window.showPreviewBorders;
                    
                    styleElement.textContent = `
                        body {
                            margin: 0;
                            padding: 15px;
                            ${shouldShowBorders ? 'border: 5px solid #3498db;' : ''}
                            box-sizing: border-box;
                            background-color: white !important; /* Force white background */
                            font-size: 20px !important; /* Increase base font size for better readability */
                            min-height: 100vh;
                            width: 100%;
                            overflow: auto;
                        }
                        
                        /* Add a subtle grid to help with alignment */
                        body::before {
                            content: "";
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-image: ${shouldShowBorders ? 
                                'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)' : 
                                'none'};
                            background-size: 20px 20px;
                            pointer-events: none;
                            z-index: -1;
                        }
                        
                        /* Increase font size of common elements for better readability */
                        h1, h2, h3, h4, h5, h6 {
                            font-size: 1.5em !important;
                        }
                        
                        p, div, span, a, li, td, th {
                            font-size: 1.2em !important;
                        }
                        
                        /* Make sure buttons and inputs are readable */
                        button, input, select, textarea {
                            font-size: 1.2em !important;
                            padding: 5px !important;
                            background-color: #fff;
                        }
                    `;
                    
                    try {
                        // Add the style element temporarily for rendering
                        iframe.contentDocument.head.appendChild(styleElement);
                        
                        // Force a layout/repaint in the iframe
                        iframe.contentWindow.scrollTo(0, 0);
                        
                        // Wait a bit longer for styles to apply
                        await delay(200);
                                                
                        // Use html2canvas to capture the iframe content
                        const targetElement = iframe.contentDocument.body;
                        
                        try {
                            // Increase scale factor for better quality
                            const canvas = await window.html2canvas(targetElement, {
                                backgroundColor: '#FFFFFF', // Explicitly set to white to match HTML default
                                scale: 8, // Significantly increased from 4 for higher resolution textures
                                logging: HTML2CANVAS_DEBUG_FLAG, // Enable logging
                                allowTaint: true,
                                useCORS: true,
                                foreignObjectRendering: true
                            });
                            
                            // Remove the temporary style element after rendering
                            if (styleElement && styleElement.parentNode) {
                                styleElement.parentNode.removeChild(styleElement);
                            }
                            
                            // Restore original iframe style
                            iframe.style.cssText = originalStyle;
                            
                            // Check if canvas has content (not a blank capture)
                            const ctx = canvas.getContext('2d');
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const data = imageData.data;
                            
                            // Check if the canvas is entirely white/transparent
                            let hasContent = false;
                            let nonWhitePixelCount = 0;
                            for (let i = 0; i < data.length; i += 4) {
                                // If any pixel has non-white color or non-zero alpha, there's content
                                if (data[i] < 255 || data[i+1] < 255 || data[i+2] < 255 || data[i+3] > 0) {
                                    hasContent = true;
                                    nonWhitePixelCount++;
                                    if (nonWhitePixelCount > 100) break; // No need to count all of them
                                }
                            }
                            
                            if (!hasContent) {
                                reject(new Error('Canvas capture appears to be blank - no content was rendered'));
                                return;
                            }
                            
                            // Create texture from the canvas
                            const texture = new THREE.CanvasTexture(canvas);
                            
                            // Improve texture quality settings
                            texture.anisotropy = 16; // Doubled from 8 for better quality at angles
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.generateMipmaps = false;
                            texture.needsUpdate = true;
                            
                            resolve(texture);
                        } catch (error) {
                            
                            // Remove the temporary style element if it exists
                            if (styleElement && styleElement.parentNode) {
                                styleElement.parentNode.removeChild(styleElement);
                            }
                            
                            // Restore original iframe style
                            iframe.style.cssText = originalStyle;
                            
                            // Properly reject with error
                            reject(new Error(`Failed to capture HTML content with html2canvas: ${error.message}`));
                        }
                    } catch (error) {
                        reject(new Error(`Error creating texture from iframe: ${error.message}`));
                    }
                } catch (error) {
                    reject(new Error(`Error in iframe content processing: ${error.message}`));
                }
            });
        } catch (error) {
            reject(new Error(`Failed to create texture from iframe: ${error.message}`));
        }
    });
}

// Unified animation detection script for both CSS3D and Image2Texture modes
export function injectUnifiedAnimationDetectionScript(iframe, mode = 'auto') {
    if (!iframe || !iframe.contentDocument) return;
    
    const script = iframe.contentDocument.createElement('script');
    script.textContent = `
        // Unified animation detection system
        window.__animationDetection = {
            // Basic counters
            setTimeout: 0,
            setInterval: 0,
            rAF: 0,
            activeTimeouts: 0,
            activeIntervals: 0,
            animationFrameIds: new Set(),
            
            // CSS animation tracking
            cssAnimations: new Set(),
            cssTransitions: new Set(),
            
            // DOM change tracking
            domChanges: 0,
            lastDomChange: 0,
            styleChanges: false,
            
            // Mode configuration
            mode: '${mode}', // 'css3d', 'image2texture', or 'auto'
            
            // Advanced detection
            isAnimationLoop: false,
            loopDetectionThreshold: 5
        };
        
        const detection = window.__animationDetection;
        
        // Override setTimeout
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay) {
            detection.setTimeout++;
            detection.activeTimeouts++;
            const id = originalSetTimeout.call(this, function() {
                detection.activeTimeouts--;
                if (typeof callback === 'function') callback();
            }, delay);
            return id;
        };
        
        // Override setInterval
        const originalSetInterval = window.setInterval;
        window.setInterval = function(callback, delay) {
            detection.setInterval++;
            detection.activeIntervals++;
            return originalSetInterval.call(this, callback, delay);
        };
        
        // Override requestAnimationFrame
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback) {
            detection.rAF++;
            const id = originalRAF.call(this, function(timestamp) {
                detection.animationFrameIds.add(id);
                if (typeof callback === 'function') callback(timestamp);
                
                // Animation loop detection for image2texture mode
                if (detection.mode === 'image2texture' || detection.mode === 'auto') {
                    if (detection.animationFrameIds.size > detection.loopDetectionThreshold) {
                        detection.isAnimationLoop = true;
                    }
                }
            });
            return id;
        };
        
        // CSS Animation and Transition Event Listeners (for CSS3D mode or auto)
        if (detection.mode === 'css3d' || detection.mode === 'auto') {
            // CSS animation events
            document.addEventListener('animationstart', (event) => {
                detection.cssAnimations.add(event.animationName);
            });
            
            document.addEventListener('animationend', (event) => {
                detection.cssAnimations.delete(event.animationName);
            });
            
            document.addEventListener('animationiteration', (event) => {
                detection.lastDomChange = Date.now();
            });
            
            // CSS transition events
            document.addEventListener('transitionstart', (event) => {
                detection.cssTransitions.add(event.propertyName);
            });
            
            document.addEventListener('transitionend', (event) => {
                detection.cssTransitions.delete(event.propertyName);
            });
            
            document.addEventListener('transitionrun', (event) => {
                detection.lastDomChange = Date.now();
            });
        }
        
        // DOM Mutation Observer (enhanced for both modes)
        try {
            const observer = new MutationObserver(mutations => {
                detection.domChanges += mutations.length;
                detection.lastDomChange = Date.now();
                
                for (const mutation of mutations) {
                    // Check for style or class changes
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                        detection.styleChanges = true;
                    }
                    
                    // Check for added/removed nodes (image2texture specific)
                    if (detection.mode === 'image2texture' || detection.mode === 'auto') {
                        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                            detection.domChanges++;
                        }
                    }
                }
            });
            
            // Configure observer based on mode
            const observerConfig = {
                attributes: true,
                childList: true,
                subtree: true
            };
            
            // Add attribute filter for CSS3D mode for better performance
            if (detection.mode === 'css3d') {
                observerConfig.attributeFilter = ['style', 'class'];
            }
            
            observer.observe(document.documentElement, observerConfig);
            
        } catch (e) {
            console.debug('MutationObserver not available:', e);
        }
        
        // Utility methods for external access
        window.__animationDetection.getStatus = function() {
            const now = Date.now();
            return {
                hasActiveTimeouts: detection.activeTimeouts > 0,
                hasActiveIntervals: detection.activeIntervals > 0,
                hasActiveRAF: detection.rAF > 0 && detection.animationFrameIds.size > 0,
                hasCssAnimations: detection.cssAnimations.size > 0,
                hasCssTransitions: detection.cssTransitions.size > 0,
                hasRecentDomChanges: (now - detection.lastDomChange) < 500,
                timeSinceLastChange: now - detection.lastDomChange,
                totalChanges: detection.domChanges,
                isAnimationLoop: detection.isAnimationLoop,
                mode: detection.mode
            };
        };
        
        window.__animationDetection.isAnimating = function() {
            const status = this.getStatus();
            return status.hasActiveTimeouts || 
                   status.hasActiveIntervals || 
                   status.hasActiveRAF || 
                   status.hasCssAnimations || 
                   status.hasCssTransitions || 
                   status.hasRecentDomChanges;
        };
        
        window.__animationDetection.reset = function() {
            detection.setTimeout = 0;
            detection.setInterval = 0;
            detection.rAF = 0;
            detection.activeTimeouts = 0;
            detection.activeIntervals = 0;
            detection.animationFrameIds.clear();
            detection.cssAnimations.clear();
            detection.cssTransitions.clear();
            detection.domChanges = 0;
            detection.lastDomChange = 0;
            detection.styleChanges = false;
            detection.isAnimationLoop = false;
        };
    `;
    
    iframe.contentDocument.head.appendChild(script);
}