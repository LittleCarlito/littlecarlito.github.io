import * as THREE from 'three';
import { getIsPreviewActive, setLastTextureUpdateTime, getLastTextureUpdateTime } from '../../util/custom-animation/animation-util';
import * as modelIntegration from '../../modals/html-editor-modal/model-integration.js';
import { updateMeshTexture } from '../../util/custom-animation/animation-util';

// Track active textures and animations
const activeTextureData = new Map();

// Add a variable to track if we're capturing frames for long exposure
let isCapturingForLongExposure = false;

// Track if we've attempted to load html2canvas
let html2canvasLoaded = false;
let html2canvasLoading = false;
let html2canvasCallbacks = [];

// Initialize texture util module
(function initTextureUtil() {
    console.log('Initializing texture-util module...');
    
    // Preload html2canvas library to ensure it's available when needed
    ensureHtml2Canvas()
        .then(success => {
            if (success) {
                console.log('html2canvas preloaded successfully for texture operations');
            } else {
                console.warn('Failed to preload html2canvas, textures may not render correctly');
            }
        })
        .catch(error => {
            console.error('Error preloading html2canvas:', error);
        });
    
    // Set up global animation handler
    if (typeof window !== 'undefined') {
        // Ensure we clean up on page unload
        window.addEventListener('beforeunload', () => {
            cleanupAllTextureResources();
        });
    }
})();

/**
 * Ensure html2canvas is loaded
 * @returns {Promise<boolean>} Promise that resolves to true if html2canvas is available
 */
export function ensureHtml2Canvas() {
    return new Promise((resolve) => {
        // If already loaded, resolve immediately
        if (window.html2canvas) {
            console.log('[HTML2CANVAS] Library already loaded and available');
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
            console.log('[HTML2CANVAS] Library already loading, waiting');
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
 * Create a long exposure texture from all animation frames
 * @param {Array} frames - Array of frames with textures
 * @param {number} playbackSpeed - The playback speed affecting opacity
 * @returns {THREE.Texture} A static long exposure texture
 */
export function createLongExposureTexture(frames, playbackSpeed) {
    if (!frames || frames.length === 0) {
        return createEmptyTexture();
    }
    
    try {
        // Create a canvas for the blended result
        const canvas = document.createElement('canvas');
        
        // Use the dimensions of the first frame's texture
        const firstTexture = frames[0].texture;
        if (!firstTexture || !firstTexture.image) {
            return createEmptyTexture();
        }
        
        canvas.width = firstTexture.image.width;
        canvas.height = firstTexture.image.height;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate base opacity based on playback speed
        // Faster playback = fainter traces (lower opacity per frame)
        // Slower playback = more solid impressions (higher opacity per frame)
        // Use a direct inverse relationship between speed and opacity
        // This makes the effect much more noticeable between different speeds
        const baseOpacity = Math.min(0.3, Math.max(0.01, 0.075 / playbackSpeed));
        
        console.log(`Creating long exposure with ${frames.length} frames at base opacity ${baseOpacity.toFixed(4)} (speed: ${playbackSpeed}x)`);
        
        // Draw all frames with calculated opacity
        frames.forEach((frame) => {
            if (!frame.texture || !frame.texture.image) return;
            
            // Set global alpha for this frame
            ctx.globalAlpha = baseOpacity;
            
            // Draw the frame
            ctx.drawImage(frame.texture.image, 0, 0, canvas.width, canvas.height);
        });
        
        // Reset global alpha
        ctx.globalAlpha = 1.0;
        
        // Create texture from the blended canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Apply high quality settings
        texture.anisotropy = 16;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        
        // Reset the capture flag
        isCapturingForLongExposure = false;
        
        // Restore original border setting
        if (window._originalBorderSetting !== undefined) {
            window.showPreviewBorders = window._originalBorderSetting;
            console.log(`Long exposure complete, borders restored to: ${window.showPreviewBorders}`);
            window._originalBorderSetting = undefined;
        }
        
        return texture;
    } catch (error) {
        console.error('Error creating long exposure texture:', error);
        
        // Reset the capture flag
        isCapturingForLongExposure = false;
        
        // Restore original border setting even on error
        if (window._originalBorderSetting !== undefined) {
            window.showPreviewBorders = window._originalBorderSetting;
            window._originalBorderSetting = undefined;
        }
        
        return createEmptyTexture();
    }
}

/**
 * Create a texture from the iframe content using html2canvas
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @returns {Promise<THREE.Texture>} A promise that resolves to a Three.js texture
 */
export async function createTextureFromIframe(iframe) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('[IFRAME_DEBUG] Starting texture creation from iframe');
            
            // Check if preview is still active, but don't reject - just log a warning and continue
            if (!getIsPreviewActive()) {
                console.warn('[IFRAME_DEBUG] Preview is no longer active, but proceeding with texture creation anyway');
                // Instead of rejecting, we'll continue and try to create a texture
            }
            
            // Make sure we can access the iframe
            if (!iframe || !document.body.contains(iframe)) {
                console.warn('[IFRAME_DEBUG] Iframe not found in DOM or removed, using empty texture');
                resolve(createEmptyTexture());
                return;
            }
            
            // Log iframe properties
            console.log('[IFRAME_DEBUG] Iframe properties:', {
                width: iframe.style.width,
                height: iframe.style.height,
                visibility: iframe.style.visibility,
                contentDocument: !!iframe.contentDocument,
                contentWindow: !!iframe.contentWindow
            });
            
            // Ensure html2canvas is loaded
            console.log('[IFRAME_DEBUG] Ensuring html2canvas is loaded');
            const html2canvasAvailable = await ensureHtml2Canvas();
            if (!html2canvasAvailable) {
                console.error('[IFRAME_DEBUG] html2canvas not available - cannot create texture');
                reject(new Error('html2canvas library not available - cannot render HTML to texture'));
                return;
            }
            
            // Create a simple delay function
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            
            // Give more time for the iframe to fully load - increase from 300ms to 1000ms
            console.log('[IFRAME_DEBUG] Waiting for iframe content to fully load');
            delay(1000).then(async () => {
                try {
                    // Check if we can access the iframe content safely
                    if (!iframe.contentDocument || !iframe.contentWindow) {
                        console.error('[IFRAME_DEBUG] Cannot access iframe content - security restriction or iframe removed');
                        reject(new Error('Cannot access iframe content - security restriction or iframe removed'));
                        return;
                    }
                    
                    // Log content document properties
                    console.log('[IFRAME_DEBUG] Content document properties:', {
                        hasBody: !!iframe.contentDocument.body,
                        bodyContent: iframe.contentDocument.body ? 
                            iframe.contentDocument.body.innerHTML.substring(0, 100) + '...' : 'none',
                        docReady: iframe.contentDocument.readyState
                    });
                    
                    // Make sure the body is fully loaded
                    if (!iframe.contentDocument.body) {
                        console.error('[IFRAME_DEBUG] Iframe body not available - iframe content failed to load');
                        reject(new Error('Iframe body not available - iframe content failed to load'));
                        return;
                    }
                    
                    // Inject animation detection script if not already injected
                    if (!iframe.contentWindow.__animationDetection) {
                        console.log('[IFRAME_DEBUG] Injecting animation detection script');
                        injectAnimationDetectionScript(iframe);
                    }
                    
                    console.log('[IFRAME_DEBUG] Preparing to capture iframe content...');

                    // Ensure iframe is visible for capture (even if off-screen)
                    const originalStyle = iframe.style.cssText;
                    iframe.style.position = 'absolute';
                    iframe.style.left = '-9999px';
                    iframe.style.visibility = 'visible';
                    iframe.style.opacity = '1';
                    
                    // Apply a frame to the content to make it more visible on the texture
                    const styleElement = iframe.contentDocument.createElement('style');
                    
                    // Never show borders when capturing for long exposure
                    const shouldShowBorders = window.showPreviewBorders && !isCapturingForLongExposure;
                    
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
                        console.log('[IFRAME_DEBUG] Adding style element to iframe head');
                        iframe.contentDocument.head.appendChild(styleElement);
                        
                        // Force a layout/repaint in the iframe
                        iframe.contentWindow.scrollTo(0, 0);
                        
                        // Wait a bit longer for styles to apply
                        console.log('[IFRAME_DEBUG] Waiting for styles to apply');
                        await delay(200);
                        
                        // Debug logging the content
                        console.log(`[IFRAME_DEBUG] Capturing HTML content: ${iframe.contentDocument.body.innerHTML.substring(0, 100)}...`);
                        
                        // Use html2canvas to capture the iframe content
                        const targetElement = iframe.contentDocument.body;
                        
                        try {
                            console.log('[IFRAME_DEBUG] Starting html2canvas capture with scale factor 8');
                            // Increase scale factor for better quality
                            const canvas = await window.html2canvas(targetElement, {
                                backgroundColor: '#FFFFFF', // Explicitly set to white to match HTML default
                                scale: 8, // Significantly increased from 4 for higher resolution textures
                                logging: true, // Enable logging
                                allowTaint: true,
                                useCORS: true,
                                foreignObjectRendering: true
                            });
                            
                            console.log('[IFRAME_DEBUG] html2canvas capture successful');
                            console.log('[IFRAME_DEBUG] Canvas dimensions:', {
                                width: canvas.width,
                                height: canvas.height
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
                            
                            console.log('[IFRAME_DEBUG] Canvas content check:', {
                                hasContent,
                                nonWhitePixelCount,
                                totalPixels: data.length / 4
                            });
                            
                            if (!hasContent) {
                                console.error('[IFRAME_DEBUG] Canvas capture appears to be blank - no content rendered');
                                reject(new Error('Canvas capture appears to be blank - no content was rendered'));
                                return;
                            }
                            
                            // Create texture from the canvas
                            console.log('[IFRAME_DEBUG] Creating THREE.CanvasTexture from canvas');
                            const texture = new THREE.CanvasTexture(canvas);
                            
                            // Improve texture quality settings
                            texture.anisotropy = 16; // Doubled from 8 for better quality at angles
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.generateMipmaps = false;
                            texture.needsUpdate = true;
                            
                            console.log('[IFRAME_DEBUG] Texture created successfully');
                            resolve(texture);
                        } catch (error) {
                            console.error('[IFRAME_DEBUG] Error capturing with html2canvas:', error);
                            
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
                        console.error('[IFRAME_DEBUG] Error in texture creation:', error);
                        reject(new Error(`Error creating texture from iframe: ${error.message}`));
                    }
                } catch (error) {
                    console.error('[IFRAME_DEBUG] Error in texture creation:', error);
                    reject(new Error(`Error in iframe content processing: ${error.message}`));
                }
            });
        } catch (error) {
            console.error('[IFRAME_DEBUG] Error in createTextureFromIframe:', error);
            reject(new Error(`Failed to create texture from iframe: ${error.message}`));
        }
    });
}

/**
 * Create a debug texture with error information
 * @param {string} errorMessage - The error message to display
 * @returns {THREE.Texture} A debug texture with error info
 */
function createDebugTexture(errorMessage) {
    console.log('[DEBUG_TEXTURE] Creating debug texture with message:', errorMessage);
    
    // Create a canvas element with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    
    // Draw a more attention-grabbing background with error pattern
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#ff6b6b');  // Reddish start
    gradient.addColorStop(1, '#f5f5f5');  // Light gray end
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw diagonal error stripes
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    for (let i = -canvas.height * 2; i < canvas.width * 2; i += 40) {
        ctx.fillRect(i, 0, 20, canvas.height);
    }
    ctx.restore();
    
    // Add border for visibility
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Draw a message about the error
    ctx.fillStyle = '#333';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('HTML Texture Debug', 20, 50);
    
    // Add version info
    ctx.font = '16px sans-serif';
    const versionInfo = `Debug Version: ${new Date().toISOString().split('T')[0]}`;
    ctx.fillText(versionInfo, 20, 80);
    
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Error rendering HTML content:', 20, 120);
    
    // Wrap error message
    const maxWidth = canvas.width - 40;
    let y = 160;
    ctx.font = '18px monospace';
    ctx.fillStyle = '#000';
    
    // Split error message into words
    const words = errorMessage.split(' ');
    let line = '';
    
    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && i > 0) {
            ctx.fillText(line, 20, y);
            line = words[i] + ' ';
            y += 30;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, 20, y);
    
    // Add visual markers to show texture is being rendered
    y += 60;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Texture Rendering Information:', 20, y);
    
    y += 30;
    ctx.font = '16px sans-serif';
    ctx.fillText(`Canvas size: ${canvas.width}x${canvas.height}`, 20, y);
    
    y += 30;
    ctx.fillText(`Time created: ${new Date().toLocaleTimeString()}`, 20, y);
    
    // Add checkerboard pattern at the bottom to verify texture mapping
    const squareSize = 40;
    const startY = canvas.height - 160;
    let isBlack = false;
    
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < canvas.width / squareSize; col++) {
            ctx.fillStyle = isBlack ? '#000' : '#fff';
            ctx.fillRect(col * squareSize, startY + row * squareSize, squareSize, squareSize);
            isBlack = !isBlack;
        }
        isBlack = !isBlack; // Start the next row with alternating pattern
    }
    
    // Add timestamp
    const timestamp = new Date().toISOString();
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#333';
    ctx.fillText(`Debug ID: ${Math.random().toString(36).substring(2, 10)}`, 20, canvas.height - 20);
    ctx.fillText(`Time: ${timestamp}`, canvas.width - 250, canvas.height - 20);
    
    // Create texture from canvas with high quality settings
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16; // Higher anisotropy for better quality
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    console.log('[DEBUG_TEXTURE] Debug texture created successfully');
    return texture;
}

/**
 * Create a fallback texture when iframe content can't be accessed
 * @returns {THREE.Texture} A simple fallback texture
 */
function createEmptyTexture() {    
    // Create a canvas element with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a semi-transparent background for the message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(10, 10, 400, 150);
    
    // Draw a message about preview limitations
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HTML Preview', 20, 40);
    
    ctx.font = '16px sans-serif';
    ctx.fillText('Preview content cannot be displayed.', 20, 80);
    ctx.fillText('This may be due to security restrictions', 20, 110);
    ctx.fillText('or content that requires special rendering.', 20, 140);
    
    // Create texture from canvas with high quality settings
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16; // Higher anisotropy for better quality
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.premultiplyAlpha = true; // Handle transparency correctly
    return texture;
}

// Inject animation detection script when creating the iframe
function injectAnimationDetectionScript(iframe) {
    try {
        if (!iframe || !iframe.contentDocument) return;
        
        const script = iframe.contentDocument.createElement('script');
        script.textContent = `
            // Animation detection
            window.__animationDetection = {
                setTimeout: 0,
                setInterval: 0,
                rAF: 0,
                activeTimeouts: 0,
                activeIntervals: 0,
                animationFrameIds: new Set()
            };
            
            // Override setTimeout
            const originalSetTimeout = window.setTimeout;
            window.setTimeout = function(callback, delay) {
                window.__animationDetection.setTimeout++;
                window.__animationDetection.activeTimeouts++;
                const id = originalSetTimeout.call(this, function() {
                    window.__animationDetection.activeTimeouts--;
                    if (typeof callback === 'function') callback();
                }, delay);
                return id;
            };
            
            // Override setInterval
            const originalSetInterval = window.setInterval;
            window.setInterval = function(callback, delay) {
                window.__animationDetection.setInterval++;
                window.__animationDetection.activeIntervals++;
                return originalSetInterval.call(this, callback, delay);
            };
            
            // Override requestAnimationFrame
            const originalRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = function(callback) {
                window.__animationDetection.rAF++;
                const id = originalRAF.call(this, function(timestamp) {
                    window.__animationDetection.animationFrameIds.add(id);
                    if (typeof callback === 'function') callback(timestamp);
                    // If the same callback requests another frame, it's likely a loop
                    if (window.__animationDetection.animationFrameIds.size > 5) {
                        window.__animationDetection.isAnimationLoop = true;
                    }
                });
                return id;
            };
            
            // Detect DOM changes that might indicate animation
            try {
                const observer = new MutationObserver(mutations => {
                    for (const mutation of mutations) {
                        // Check for style or class changes which might indicate animation
                        if (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                            window.__animationDetection.domChanges = true;
                        }
                        // Check for added/removed nodes which might indicate animation
                        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                            window.__animationDetection.domChanges = true;
                        }
                    }
                });
                
                // Observe the entire document for changes
                observer.observe(document.documentElement, {
                    attributes: true,
                    childList: true,
                    subtree: true
                });
            } catch (e) {
                // MutationObserver might not be available in all contexts
                console.debug('MutationObserver not available:', e);
            }
        `;
        
        iframe.contentDocument.head.appendChild(script);
    } catch (e) {
        console.debug('Error injecting animation detection script:', e);
    }
}

/**
 * Set the capturing for long exposure flag
 * @param {boolean} incomingValue - The new value to set
 */
export function setCapturingForLongExposure(incomingValue) {
    if(incomingValue === Boolean(incomingValue)) {
        isCapturingForLongExposure = incomingValue;
    }
}

/**
 * Calculate a simple hash of a texture to detect changes between frames
 * @param {THREE.Texture} texture - The texture to hash
 * @returns {string} A simple hash of the texture
 */
export function calculateTextureHash(texture) {
    if (!texture || !texture.image) return '';
    
    try {
        // Create a small canvas to sample the texture
        const canvas = document.createElement('canvas');
        const size = 16; // Small sample size for performance
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Draw the texture to the canvas
        ctx.drawImage(texture.image, 0, 0, size, size);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, size, size).data;
        
        // Sample pixels at regular intervals
        const samples = [];
        const step = 4 * 4; // Sample every 4th pixel (RGBA)
        for (let i = 0; i < imageData.length; i += step) {
            // Use just the RGB values (skip alpha)
            samples.push(imageData[i], imageData[i+1], imageData[i+2]);
        }
        
        // Create a simple hash from the samples
        return samples.join(',');
    } catch (e) {
        console.error('Error calculating texture hash:', e);
        return '';
    }
}

/**
 * Handle custom texture display on a mesh
 * @param {Object} meshData - Data about the mesh to display on
 * @param {string} renderType - The type of rendering (threejs, longExposure)
 * @param {Object} settings - Additional settings for rendering
 * @returns {Promise<boolean>} Promise that resolves when the texture is applied
 */
export function setCustomTexture(meshData, renderType, settings = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('[TEXTURE_SETUP] Applying custom HTML texture to mesh:', { 
                meshId: meshData.id, 
                meshName: meshData.mesh?.name || 'unnamed',
                renderType,
                htmlLength: meshData.html ? meshData.html.length : 0
            });
            
            if (!meshData || !meshData.id) {
                console.error('[TEXTURE_SETUP] Invalid mesh data provided to setCustomTexture');
                reject(new Error('Invalid mesh data'));
                return;
            }
            
            // Generate a unique ID for this mesh
            const meshId = `mesh_${meshData.id}`;
            
            // Get the mesh directly from the meshData object
            let targetMesh = meshData.mesh;
            
            // Clean up any existing texture data for this mesh
            if (activeTextureData.has(meshId)) {
                const oldData = activeTextureData.get(meshId);
                if (oldData.iframe) {
                    try {
                        document.body.removeChild(oldData.iframe);
                    } catch (error) {
                        console.debug('[TEXTURE_SETUP] Error removing old iframe:', error);
                    }
                }
                activeTextureData.delete(meshId);
            }
            
            // If mesh is not provided, try to find it using the state
            if (!targetMesh) {
                console.warn(`[TEXTURE_SETUP] No mesh object provided directly in meshData for ID ${meshData.id}, trying to find it in the state`);
                
                try {
                    // Import state module to get current state
                    const stateModule = await import('../../scene/state.js');
                    const state = stateModule.getState();
                    if (!state.meshes || state.meshes.length === 0) {
                        console.error('[TEXTURE_SETUP] No meshes available in state');
                        reject(new Error('No meshes available in state'));
                        return;
                    }
                    
                    // Try to find mesh by index
                    if (state.meshes.length > meshData.id) {
                        targetMesh = state.meshes[meshData.id];
                        console.log(`[TEXTURE_SETUP] Found mesh by index: ${targetMesh.name || 'unnamed'}`);
                        
                        // Store mesh reference in activeTextureData
                        if (activeTextureData.has(meshId)) {
                            activeTextureData.get(meshId).mesh = targetMesh;
                        }
                        
                        // Now continue with the found mesh
                        await continueWithMesh(targetMesh, meshId, meshData, renderType, settings);
                        resolve(true);
                    } else {
                        console.error(`[TEXTURE_SETUP] Mesh index ${meshData.id} out of bounds (total meshes: ${state.meshes.length})`);
                        reject(new Error('Mesh index out of bounds'));
                    }
                } catch (error) {
                    console.error('[TEXTURE_SETUP] Error importing state module:', error);
                    reject(error);
                }
                
                return;
            }
            
            // Continue with the mesh we have
            try {
                await continueWithMesh(targetMesh, meshId, meshData, renderType, settings);
                resolve(true);
            } catch (error) {
                console.error('[TEXTURE_SETUP] Error in continueWithMesh:', error);
                reject(error);
            }
        } catch (error) {
            console.error('[TEXTURE_SETUP] Error in setCustomTexture:', error);
            reject(error);
        }
    });
    
    // Helper function to continue texture process with a valid mesh
    // Pass all required parameters explicitly to avoid closure scope issues
    async function continueWithMesh(mesh, meshId, meshData, renderType, settings) {
        return new Promise(async (resolve, reject) => {
            try {
                // Store the mesh in our data
                const meshDataObj = { mesh };
                activeTextureData.set(meshId, meshDataObj);
                
                // Check if mesh still exists in the scene
                try {
                    if (!mesh.isMesh) {
                        console.error(`[TEXTURE_SETUP] Target object is not a mesh for ID ${meshData.id}`);
                        reject(new Error('Target object is not a mesh'));
                        return;
                    }
                } catch (error) {
                    console.error(`[TEXTURE_SETUP] Error checking mesh validity for ID ${meshData.id}:`, error);
                    reject(error);
                    return;
                }
                
                console.log(`[TEXTURE_SETUP] Using mesh: ${mesh.name}, type: ${mesh.type}`);
                
                // Get HTML content from binary data, not directly from meshData
                let html;
                
                if (meshData.binaryData) {
                    // Use binary data (preferred approach)
                    try {
                        // Import string deserialization function
                        const { deserializeStringFromBinary } = await import('../../util/string-serder.js');
                        const result = deserializeStringFromBinary(meshData.binaryData);
                        html = result.content;
                        
                        // If settings were serialized with the HTML, merge them with provided settings
                        if (result.settings) {
                            settings = { ...settings, ...result.settings };
                        }
                    } catch (error) {
                        console.error('[TEXTURE_SETUP] Failed to deserialize HTML from binary data:', error);
                        reject(new Error('Failed to read HTML content from binary data'));
                        return;
                    }
                } else {
                    // No binary data provided
                    console.error(`[TEXTURE_SETUP] No binary data provided for mesh ID ${meshData.id}`);
                    reject(new Error('No binary data provided'));
                    return;
                }
                
                if (!html) {
                    console.error(`[TEXTURE_SETUP] No HTML content found for mesh ID ${meshData.id}`);
                    reject(new Error('No HTML content found in binary data'));
                    return;
                }
                
                console.log(`[TEXTURE_SETUP] HTML content length: ${html.length} characters`);
                if (html.length > 100) {
                    console.log(`[TEXTURE_SETUP] First 100 chars: ${html.substring(0, 100)}...`);
                } else {
                    console.log(`[TEXTURE_SETUP] HTML content: ${html}`);
                }
                
                // Set up window global for preview borders settings
                window.showPreviewBorders = settings.display && 
                    settings.display.showBorders !== undefined ? 
                    settings.display.showBorders : true;
                
                // Handle long exposure special case
                const isLongExposure = renderType === 'longExposure' || 
                                    (settings.previewMode === 'longExposure');
                                    
                // Create iframe and set up content
                const iframe = createAndSetupIframe(html);
                
                // Update our data with the iframe
                if (activeTextureData.has(meshId)) {
                    activeTextureData.get(meshId).iframe = iframe;
                }
                
                // Add animation if enabled
                if (settings.animation && !isLongExposure) {
                    
                    // Add animation JavaScript to the iframe
                    try {
                        // Wait for iframe to fully load before adding animation
                        iframe.onload = function() {
                            if (!iframe.contentDocument) return;
                            
                            const style = iframe.contentDocument.createElement('style');
                            
                            // Calculate animation duration based on playback speed
                            const speed = settings.playbackSpeed || 1.0;
                            const baseDuration = 2.0; // Base duration in seconds
                            const duration = baseDuration / speed;
                            
                            // Add animation styles based on animation type
                            if (settings.animation.type === 'loop') {
                                style.textContent = `
                                    @keyframes slide {
                                        0% { transform: translateX(0); }
                                        50% { transform: translateX(20px); }
                                        100% { transform: translateX(0); }
                                    }
                                    
                                    body * {
                                        animation: slide ${duration}s infinite ease-in-out;
                                    }
                                `;
                            } else if (settings.animation.type === 'bounce') {
                                style.textContent = `
                                    @keyframes bounce {
                                        0%, 100% { transform: translateY(0); }
                                        50% { transform: translateY(-20px); }
                                    }
                                    
                                    body * {
                                        animation: bounce ${duration}s infinite ease-in-out;
                                    }
                                `;
                            }
                            
                            // Add the style to the iframe document
                            iframe.contentDocument.head.appendChild(style);
                            console.log(`[TEXTURE_SETUP] Added ${settings.animation.type} animation to iframe content`);
                        };
                    } catch (error) {
                        console.error('[TEXTURE_SETUP] Error injecting animation:', error);
                    }
                }
                    
                // Create a material for the mesh and set the iframe as texture
                if (isLongExposure) {
                    // For long exposure mode, we need to capture multiple frames
                    // and blend them together
                    console.log('[TEXTURE_SETUP] Creating long exposure texture for mesh');
                    
                    // Set the capturing flag
                    setCapturingForLongExposure(true);
                    
                    // Store original border setting
                    window._originalBorderSetting = window.showPreviewBorders;
                    
                    // Disable borders during long exposure capture
                    window.showPreviewBorders = false;
                    
                    // Create an array to store frames
                    const frames = [];
                    const frameCount = 30; // Capture 30 frames for blending
                    const captureInterval = 50;
                    
                    let capturedFrames = 0;
                    
                    const captureFrame = async () => {
                        try {
                            // Make sure html2canvas is available
                            const html2canvasAvailable = await ensureHtml2Canvas();
                            if (!html2canvasAvailable) {
                                console.error('[TEXTURE_SETUP] html2canvas library not available for long exposure');
                                document.body.removeChild(iframe);
                                setCapturingForLongExposure(false);
                                reject(new Error('html2canvas not available'));
                                return;
                            }
                            
                            // Capture the current frame
                            const texture = await createTextureFromIframe(iframe);
                            frames.push({texture, timestamp: Date.now()});
                            capturedFrames++;
                            
                            // Check if we have captured all frames
                            if (capturedFrames >= frameCount) {
                                // Create the long exposure texture
                                console.log(`[TEXTURE_SETUP] Creating long exposure from ${frames.length} frames`);
                                const longExposureTexture = createLongExposureTexture(frames, settings.playbackSpeed || 1.0);
                                
                                // Apply the texture to the mesh
                                await applyTextureToMesh(mesh, longExposureTexture);
                                
                                // Clean up
                                document.body.removeChild(iframe);
                                setCapturingForLongExposure(false);
                                
                                // Restore border setting
                                if (window._originalBorderSetting !== undefined) {
                                    window.showPreviewBorders = window._originalBorderSetting;
                                    delete window._originalBorderSetting;
                                }
                                
                                resolve(true);
                            } else {
                                // Continue capturing frames
                                setTimeout(captureFrame, captureInterval);
                            }
                        } catch (error) {
                            console.error('[TEXTURE_SETUP] Error capturing frame for long exposure:', error);
                            document.body.removeChild(iframe);
                            setCapturingForLongExposure(false);
                            reject(error);
                        }
                    };
                    
                    // Start capturing frames
                    setTimeout(captureFrame, 500);
                } 
                else {
                                        // For normal mode, use the same pre-rendering approach as in preview mode
                    console.log('[TEXTURE_SETUP] Setting up pre-rendering for animated texture');
                    
                    // Create a loading overlay using loading-splash.css styles
                    const loadingOverlay = document.createElement('div');
                    loadingOverlay.id = 'apply-texture-overlay';
                    loadingOverlay.className = 'loading-splash';
                    
                    // Create content container using loading-splash.css styles
                    const loadingContent = document.createElement('div');
                    loadingContent.className = 'loading-content';
                    
                    // Create title
                    const loadingTitle = document.createElement('h1');
                    loadingTitle.className = 'loading-title';
                    loadingTitle.textContent = 'APPLYING TEXTURE';
                    
                    // Create spinner container
                    const spinnerContainer = document.createElement('div');
                    spinnerContainer.className = 'loading-spinner-container';
                    
                    // Create atomic spinner
                    const atomicSpinner = document.createElement('div');
                    atomicSpinner.className = 'atomic-spinner';
                    
                    // Create nucleus
                    const nucleus = document.createElement('div');
                    nucleus.className = 'nucleus';
                    atomicSpinner.appendChild(nucleus);
                    
                    // Create electron orbits (3)
                    for (let i = 0; i < 3; i++) {
                        const orbit = document.createElement('div');
                        orbit.className = 'electron-orbit';
                        
                        const electron = document.createElement('div');
                        electron.className = 'electron';
                        
                        orbit.appendChild(electron);
                        atomicSpinner.appendChild(orbit);
                    }
                    
                    spinnerContainer.appendChild(atomicSpinner);
                    
                    // Create progress text
                    const progressText = document.createElement('div');
                    progressText.id = 'apply-texture-progress-text';
                    progressText.className = 'loading-progress-text';
                    progressText.textContent = 'Pre-rendering animation frames...';
                    
                    // Add elements to loading content
                    loadingContent.appendChild(loadingTitle);
                    loadingContent.appendChild(spinnerContainer);
                    loadingContent.appendChild(progressText);
                    
                    // Create progress container
                    const progressContainer = document.createElement('div');
                    progressContainer.style.width = '80%';
                    progressContainer.style.maxWidth = '300px';
                    progressContainer.style.height = '4px';
                    progressContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    progressContainer.style.borderRadius = '2px';
                    progressContainer.style.overflow = 'hidden';
                    progressContainer.style.margin = '10px auto 0';
                    progressContainer.style.display = 'block';
                    
                    // Create progress bar
                    const progressBar = document.createElement('div');
                    progressBar.id = 'apply-texture-progress';
                    progressBar.style.width = '0%';
                    progressBar.style.height = '100%';
                    progressBar.style.backgroundColor = '#2ecc71';
                    progressBar.style.transition = 'width 0.3s ease-out';
                    
                    // Add progress bar to container
                    progressContainer.appendChild(progressBar);
                    loadingContent.appendChild(progressContainer);
                    
                    // Add loading content to overlay
                    loadingOverlay.appendChild(loadingContent);
                    
                    // Add overlay to the document
                    document.body.appendChild(loadingOverlay);
                    
                    // Add CSS link for loading-splash styles if not already present
                    if (!document.getElementById('loading-splash-css')) {
                        const cssLink = document.createElement('link');
                        cssLink.id = 'loading-splash-css';
                        cssLink.rel = 'stylesheet';
                        cssLink.href = '../../css/loading-splash.css';
                        document.head.appendChild(cssLink);
                    }
                    
                    // Create a status callback for updating the loading overlay
                    const statusCallback = (message, type) => {
                        console.log(`[TEXTURE_STATUS] ${message} (${type})`);
                        // Update the progress text
                        const progressTextEl = document.getElementById('apply-texture-progress-text');
                        if (progressTextEl) {
                            progressTextEl.textContent = message;
                        }
                    };
                    
                    // Create CustomTextureSettings object with all needed properties
                    const customTextureSettings = {
                        html: html,
                        meshId: meshData.id, // This is from the outer meshData parameter
                        previewMode: renderType,
                        playbackSpeed: settings.playbackSpeed || 1.0,
                        animationType: settings.animation ? settings.animation.type : 'play',
                        showPreviewBorders: window.showPreviewBorders,
                        updateStatus: statusCallback,
                        isLongExposureMode: false
                    };
                    
                    try {
                        // Create an initial texture to apply immediately so there's visual feedback
                        const initialTexture = await createTextureFromIframe(iframe);
                        
                        // Apply the initial texture to the mesh
                        console.log('[TEXTURE_SETUP] Applying initial texture to mesh');
                        await applyTextureToMesh(mesh, initialTexture);
                        
                        // Import animation utility to use pre-rendering
                        console.log('[TEXTURE_SETUP] Importing animation-util.js module');
                        try {
                            const animationModule = await import('../../util/custom-animation/animation-util.js');
                            
                            if (typeof animationModule.startImage2TexturePreRendering !== 'function') {
                                throw new Error('Missing required function: startImage2TexturePreRendering');
                            }
                            
                            console.log('[TEXTURE_SETUP] Starting pre-rendering for animation');
                            
                            // Start pre-rendering with the mesh directly in the callback
                            await new Promise(preRenderResolve => {
                                // Update progress bar as frames are captured
                                const updateProgress = (percent) => {
                                    console.log(`[TEXTURE_PROGRESS] Updating progress to ${percent}%`);
                                    const progressBar = document.getElementById('apply-texture-progress');
                                    if (progressBar) {
                                        progressBar.style.width = `${percent}%`;
                                    }
                                    
                                    // Update text as well
                                    const progressTextEl = document.getElementById('apply-texture-progress-text');
                                    
                                    // Request animation frame for smoother UI updates
                                    requestAnimationFrame(() => {
                                        const progressBarEl = document.getElementById('apply-texture-progress');
                                        if (progressBarEl) {
                                            progressBarEl.style.width = `${percent}%`;
                                        }
                                        
                                        // Update progress text based on completion level
                                        const progressTextEl = document.getElementById('apply-texture-progress-text');
                                        if (progressTextEl) {
                                            if (percent < 30) {
                                                progressTextEl.textContent = 'Analyzing animation frames...';
                                            } else if (percent < 60) {
                                                progressTextEl.textContent = 'Processing texture data...';
                                            } else if (percent < 90) {
                                                progressTextEl.textContent = 'Finalizing animation...';
                                            } else {
                                                progressTextEl.textContent = 'Applying texture to mesh...';
                                            }
                                        }
                                    });
                                };
                                
                                try {
                                    // Log details about the settings being passed
                                    console.log('[TEXTURE_SETUP] Starting pre-rendering with settings:', 
                                        JSON.stringify({
                                            meshId: customTextureSettings.meshId,
                                            previewMode: customTextureSettings.previewMode,
                                            playbackSpeed: customTextureSettings.playbackSpeed,
                                            animationType: customTextureSettings.animationType,
                                        }));
                                    
                                    // Force an initial progress update to show activity
                                    updateProgress(1);
                                
                                    animationModule.startImage2TexturePreRendering(iframe, () => {
                                        console.log('[TEXTURE_SETUP] Pre-rendering complete, setting up animation loop');
                                        
                                        // Make sure we show completion
                                        updateProgress(100);
                                        
                                        // Set original animation start time to now for proper playback timing
                                        if (typeof animationModule.setOriginalAnimationStartTime === 'function') {
                                            animationModule.setOriginalAnimationStartTime(Date.now());
                                        }
                                        
                                        // Setup animation loop that properly maintains mesh reference
                                        setupTextureAnimation(meshId, iframe, settings, mesh);
                                        
                                        // Reinforce the mesh connection
                                        if (activeTextureData.has(meshId)) {
                                            activeTextureData.get(meshId).mesh = mesh;
                                        }
                                        
                                        // Remove loading overlay with fade out
                                        loadingOverlay.classList.add('fade-out');
                                        
                                        // Remove after fade out
                                        setTimeout(() => {
                                            if (loadingOverlay.parentNode) {
                                                loadingOverlay.parentNode.removeChild(loadingOverlay);
                                            }
                                        }, 500);
                                        
                                        preRenderResolve();
                                    }, updateProgress, customTextureSettings);
                                } catch (error) {
                                    console.error('[TEXTURE_SETUP] Error in animation pre-rendering:', error);
                                    
                                    // Update progress text to show error
                                    const progressTextEl = document.getElementById('apply-texture-progress-text');
                                    if (progressTextEl) {
                                        progressTextEl.textContent = 'Error in pre-rendering';
                                        progressTextEl.style.color = '#ff6b6b';
                                    }
                                    
                                    // Remove loading overlay after displaying error
                                    setTimeout(() => {
                                        if (loadingOverlay.parentNode) {
                                            loadingOverlay.parentNode.removeChild(loadingOverlay);
                                        }
                                        
                                        // Reject with the error to stop the process
                                        preRenderResolve(false);
                                    }, 2000);
                                }
                            });
                        } catch (importError) {
                            console.error('[TEXTURE_SETUP] Failed to import animation-util.js:', importError);
                            
                            // Clean up any loading overlay
                            if (document.body.contains(loadingOverlay)) {
                                document.body.removeChild(loadingOverlay);
                            }
                            
                            // Reject with proper error
                            reject(new Error(`Animation module failed to load: ${importError.message}`));
                            return;
                        }
                        
                        resolve(true);
                    } catch (error) {
                        console.error('[TEXTURE_SETUP] Error in pre-rendering setup:', error);
                        
                        // Remove loading overlay in case of error
                        loadingOverlay.style.transition = 'opacity 0.5s ease';
                        loadingOverlay.style.opacity = '0';
                        setTimeout(() => {
                            if (loadingOverlay.parentNode) {
                                loadingOverlay.parentNode.removeChild(loadingOverlay);
                            }
                        }, 500);
                        
                        // Reject with the error instead of using fallback
                        reject(error);
                    }
                }
            } catch (error) {
                console.error('[TEXTURE_SETUP] Error in continueWithMesh:', error);
                reject(error);
            }
        });
    }
}

/**
 * Apply a texture to a mesh
 * @param {THREE.Mesh} mesh - The mesh to update
 * @param {THREE.Texture} texture - The texture to apply
 * @returns {Promise<boolean>} Promise that resolves when texture is applied and rendered
 */
function applyTextureToMesh(mesh, texture) {
    return new Promise((resolve, reject) => {
        if (!mesh || !texture) {
            console.error('[TEXTURE_DEBUG] Cannot apply texture: mesh or texture is missing', {
                hasMesh: !!mesh,
                hasTexture: !!texture
            });
            reject(new Error('Missing mesh or texture'));
            return;
        }
        
        try {
            console.log(`[TEXTURE_DEBUG] Applying texture to mesh:`, { 
                meshName: mesh.name || 'unnamed',
                meshType: mesh.type,
                textureSize: texture.image ? `${texture.image.width}x${texture.image.height}` : 'unknown',
                hasImageData: !!texture.image,
                materialType: Array.isArray(mesh.material) ? 'array' : (mesh.material ? mesh.material.type : 'none')
            });
            
            // Validate the texture
            if (!texture.image) {
                console.error('[TEXTURE_DEBUG] Texture has no image data!');
                // Create a visible error texture
                const errorTexture = createDebugTexture('Texture has no image data');
                texture = errorTexture;
            }
            
            // Check if image data is valid
            if (texture.image && (texture.image.width === 0 || texture.image.height === 0)) {
                console.error('[TEXTURE_DEBUG] Texture has invalid dimensions:', {
                    width: texture.image.width,
                    height: texture.image.height
                });
                // Create a visible error texture
                const errorTexture = createDebugTexture('Texture has invalid dimensions');
                texture = errorTexture;
            }
            
            // Set texture properties that help with display
            texture.anisotropy = 16; // High quality filtering
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            
            // Ensure the texture is using the correct encoding
            if (THREE.sRGBEncoding !== undefined) {
                texture.encoding = THREE.sRGBEncoding;
                console.log('[TEXTURE_DEBUG] Set texture encoding to sRGBEncoding');
            } else if (THREE.LinearSRGBColorSpace !== undefined) {
                texture.colorSpace = THREE.LinearSRGBColorSpace;
                console.log('[TEXTURE_DEBUG] Set texture colorSpace to LinearSRGBColorSpace');
            }
            
            // Add texture load handler to ensure rendering after texture is fully loaded
            const checkTextureLoaded = () => {
                if (texture.image && texture.image.complete) {
                    texture.needsUpdate = true;
                    applyTextureToMaterial();
                } else if (texture.image) {
                    // If image is still loading, wait for it
                    texture.image.onload = () => {
                        texture.needsUpdate = true;
                        applyTextureToMaterial();
                    };
                    
                    // Handle image load errors
                    texture.image.onerror = (err) => {
                        console.error('[TEXTURE_DEBUG] Texture image failed to load', err);
                        reject(new Error('Texture image failed to load'));
                    };
                } else {
                    // If no image property, assume it's ready (like canvas textures)
                    texture.needsUpdate = true;
                    applyTextureToMaterial();
                }
            };
            
            // Function to apply the texture to the material
            const applyTextureToMaterial = () => {
                // Handle different material types
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        console.log(`[TEXTURE_DEBUG] Mesh has ${mesh.material.length} materials, applying to all`);
                        // If the mesh has multiple materials, apply to all
                        mesh.material.forEach((material, index) => {
                            // Log material state before update
                            console.log(`[TEXTURE_DEBUG] Material ${index} before update:`, {
                                type: material.type,
                                hasMap: !!material.map,
                                mapUuid: material.map ? material.map.uuid : 'none',
                                transparent: material.transparent,
                                opacity: material.opacity,
                                color: material.color ? material.color.getHexString() : 'none'
                            });
                            
                            // Backup original material properties
                            if (material._originalMap === undefined) {
                                material._originalMap = material.map;
                                material._originalColor = material.color ? material.color.clone() : null;
                                material._originalEmissive = material.emissive ? material.emissive.clone() : null;
                                material._originalRoughness = material.roughness;
                                material._originalMetalness = material.metalness;
                                console.log(`[TEXTURE_DEBUG] Backed up original material properties for material ${index}`);
                            }
                            
                            // Set the texture properties
                            material.map = texture;
                            
                            // Set material properties to ensure texture is displayed correctly
                            setMaterialForTextureDisplay(material);
                            
                            // Log material state after update
                            console.log(`[TEXTURE_DEBUG] Material ${index} after update:`, {
                                type: material.type,
                                hasMap: !!material.map,
                                mapUuid: material.map ? material.map.uuid : 'none',
                                transparent: material.transparent,
                                opacity: material.opacity,
                                color: material.color ? material.color.getHexString() : 'none'
                            });
                        });
                    } else {
                        // Single material
                        console.log('[TEXTURE_DEBUG] Mesh has a single material, applying texture');
                        
                        // Log material state before update
                        console.log('[TEXTURE_DEBUG] Material before update:', {
                            type: mesh.material.type,
                            hasMap: !!mesh.material.map,
                            mapUuid: mesh.material.map ? mesh.material.map.uuid : 'none',
                            transparent: mesh.material.transparent,
                            opacity: mesh.material.opacity,
                            color: mesh.material.color ? mesh.material.color.getHexString() : 'none',
                            roughness: mesh.material.roughness,
                            metalness: mesh.material.metalness
                        });
                        
                        // Backup original material properties
                        if (mesh.material._originalMap === undefined) {
                            mesh.material._originalMap = mesh.material.map;
                            mesh.material._originalColor = mesh.material.color ? mesh.material.color.clone() : null;
                            mesh.material._originalEmissive = mesh.material.emissive ? mesh.material.emissive.clone() : null;
                            mesh.material._originalRoughness = mesh.material.roughness;
                            mesh.material._originalMetalness = mesh.material.metalness;
                            console.log('[TEXTURE_DEBUG] Backed up original material properties');
                        }
                        
                        // Set the texture properties
                        mesh.material.map = texture;
                        
                        // Set material properties to ensure texture is displayed correctly
                        setMaterialForTextureDisplay(mesh.material);
                        
                        // Log material state after update
                        console.log('[TEXTURE_DEBUG] Material after update:', {
                            type: mesh.material.type,
                            hasMap: !!mesh.material.map,
                            mapUuid: mesh.material.map ? mesh.material.map.uuid : 'none',
                            textureUuid: texture.uuid,
                            transparent: mesh.material.transparent,
                            opacity: mesh.material.opacity,
                            color: mesh.material.color ? mesh.material.color.getHexString() : 'none',
                            roughness: mesh.material.roughness,
                            metalness: mesh.material.metalness
                        });
                    }
                    
                    // Trigger a single render using the most reliable renderer we can find
                    triggerRender().then(() => {
                        console.log('[TEXTURE_DEBUG] Texture successfully applied to mesh');
                        resolve(true);
                    }).catch(error => {
                        console.error('[TEXTURE_DEBUG] Error in render after texture application:', error);
                        // Even if rendering fails, resolve the promise since we did apply the texture
                        resolve(true);
                    });
                } else {
                    console.error('[TEXTURE_DEBUG] Mesh has no material to apply texture to');
                    reject(new Error('Mesh has no material'));
                }
            };
            
            // Start the texture loading process
            checkTextureLoaded();
            
        } catch (error) {
            console.error('[TEXTURE_DEBUG] Error applying texture to mesh:', error);
            reject(error);
        }
    });
}

/**
 * Trigger a render using the best available renderer
 * @returns {Promise<boolean>} Promise that resolves when rendering is complete
 */
function triggerRender() {
    return new Promise((resolve, reject) => {
        try {
            // Import state to get renderer
            import('../../scene/state.js').then(stateModule => {
                const state = stateModule.getState();
                
                if (state && state.renderer && state.scene && state.camera) {
                    console.log('[TEXTURE_DEBUG] Triggering render using state.renderer');
                    
                    // Use requestAnimationFrame to ensure we render in the next frame
                    // This helps ensure textures have had time to load properly
                    requestAnimationFrame(() => {
                        state.renderer.render(state.scene, state.camera);
                        console.log('[TEXTURE_DEBUG] Render complete');
                        resolve(true);
                    });
                } else if (window.renderer) {
                    console.log('[TEXTURE_DEBUG] Triggering render using window.renderer');
                    
                    requestAnimationFrame(() => {
                        window.renderer.render();
                        console.log('[TEXTURE_DEBUG] Render complete');
                        resolve(true);
                    });
                } else if (typeof window.render === 'function') {
                    console.log('[TEXTURE_DEBUG] Triggering render using window.render()');
                    
                    requestAnimationFrame(() => {
                        window.render();
                        console.log('[TEXTURE_DEBUG] Render complete');
                        resolve(true);
                    });
                } else {
                    console.warn('[TEXTURE_DEBUG] No renderer found, cannot trigger render');
                    resolve(false);
                }
            }).catch(error => {
                console.error('[TEXTURE_DEBUG] Error importing state module:', error);
                reject(error);
            });
        } catch (error) {
            console.error('[TEXTURE_DEBUG] Error in triggerRender:', error);
            reject(error);
        }
    });
}

/**
 * Set material properties to ensure a texture displays correctly
 * @param {THREE.Material} material - The material to modify
 */
function setMaterialForTextureDisplay(material) {
    // For MeshStandardMaterial or similar PBR materials
    if (material.type.includes('Standard') || material.type.includes('Physical')) {
        if (material.color) {
            // Set color to white to allow texture to display at full brightness
            material.color.setRGB(1, 1, 1);
        }
        
        // Adjust roughness and metalness for better texture visibility
        material.roughness = 0.1;  // Lower roughness for less diffuse scattering
        material.metalness = 0.0;  // Lower metalness for less reflection
    } 
    // For MeshBasicMaterial or similar non-PBR materials
    else if (material.color) {
        // Set color to white to allow texture to display at full brightness
        material.color.setRGB(1, 1, 1);
    }
    
    // For emissive materials, can optionally set emissive to allow the texture to "glow"
    if (material.emissive) {
        // Optional: make the material slightly emissive to ensure it's visible in all lighting
        material.emissive.setRGB(0.1, 0.1, 0.1);
    }
    
    // Set up transparency
    material.transparent = true;
    material.opacity = 1.0;
    material.alphaTest = 0.01;  // Helps with transparency issues
    
    // Ensure proper material settings for correct rendering
    material.side = THREE.DoubleSide; // Render both sides
    material.depthWrite = true;
    material.depthTest = true;
    material.needsUpdate = true;
}

/**
 * Disable custom texture display on a mesh
 * @param {Object} meshData - Data about the mesh to remove display from
 * @returns {Promise<boolean>} Promise that resolves when texture is removed
 */
export function disableCustomTexture(meshData) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Disabling custom texture for mesh:', meshData?.id);
            
            if (!meshData || !meshData.id) {
                console.error('Invalid mesh data provided to disableCustomTexture');
                reject(new Error('Invalid mesh data'));
                return;
            }
            
            // Generate the unique ID for this mesh
            const meshId = `mesh_${meshData.id}`;
            
            // Clean up animation resources for this mesh
            if (activeTextureData.has(meshId)) {
                const data = activeTextureData.get(meshId);
                
                // Remove iframe if it exists
                if (data.iframe) {
                    try {
                        document.body.removeChild(data.iframe);
                    } catch (error) {
                        console.debug('Error removing iframe:', error);
                    }
                }
                
                // Restore the original mesh material if we have the mesh
                if (data.mesh) {
                    await restoreMeshMaterial(data.mesh, meshData.id);
                } else {
                    // If we don't have the mesh, try to find it
                    await fallbackDisableTexture();
                }
                
                // Remove from active textures
                activeTextureData.delete(meshId);
                resolve(true);
            } else {
                // Fall back to old method if not in our tracking system
                await fallbackDisableTexture();
                resolve(true);
            }
        } catch (error) {
            console.error('Error disabling custom texture:', error);
            reject(error);
        }
        
        // Fallback method to find and disable texture if not in our tracking system
        async function fallbackDisableTexture() {
            return new Promise(async (resolve, reject) => {
                try {
                    // Try to get the mesh directly from meshData
                    let targetMesh = meshData.mesh;
                    
                    // If mesh is not provided in meshData, try to find it in the scene
                    if (!targetMesh) {
                        console.log(`No mesh provided in meshData for ID ${meshData.id}, trying to find in scene`);
                        
                        // Fall back to looking for the mesh in the scene
                        const stateModule = await import('../../scene/state.js');
                        const state = stateModule.getState();
                        if (!state.scene) {
                            console.error('Scene not available in state');
                            reject(new Error('Scene not available'));
                            return;
                        }
                        
                        // Find all meshes in the scene
                        const meshes = [];
                        state.scene.traverse(object => {
                            if (object.isMesh) {
                                meshes.push(object);
                            }
                        });
                        
                        // Try different methods to find the mesh
                        if (meshes.length > meshData.id) {
                            targetMesh = meshes[meshData.id];
                            console.log(`Found mesh by index ${meshData.id}: ${targetMesh.name}`);
                        } else {
                            const targetMeshName = `display_monitor_screen`;
                            targetMesh = meshes.find(mesh => mesh.name === targetMeshName);
                            
                            if (!targetMesh && meshes.length === 1) {
                                targetMesh = meshes[0];
                                console.log(`Using the only mesh in scene: ${targetMesh.name}`);
                            }
                        }
                        
                        if (!targetMesh) {
                            console.error(`Could not find target mesh with ID ${meshData.id}`);
                            reject(new Error('Target mesh not found'));
                            return;
                        }
                    }
                    
                    // Call the actual restore function
                    await restoreMeshMaterial(targetMesh, meshData.id);
                    resolve(true);
                } catch (error) {
                    console.error('Error in fallbackDisableTexture:', error);
                    reject(error);
                }
            });
        }
    });
}

/**
 * Restore the original material of a mesh
 * @param {THREE.Mesh} targetMesh - The mesh to restore
 * @param {number} meshId - The ID of the mesh for logging
 * @returns {Promise<boolean>} Promise that resolves when restoration is complete
 */
function restoreMeshMaterial(targetMesh, meshId) {
    return new Promise(async (resolve, reject) => {
        try {
            if (targetMesh.material) {
                if (Array.isArray(targetMesh.material)) {
                    // If the mesh has multiple materials, restore all
                    targetMesh.material.forEach(material => {
                        // Check for original texture backup
                        if (material._originalMap !== undefined) {
                            material.map = material._originalMap;
                            delete material._originalMap;
                        } else {
                            // If no backup, just remove the map
                            material.map = null;
                        }
                        
                        // Restore original material properties if they exist
                        if (material._originalColor) {
                            material.color.copy(material._originalColor);
                            delete material._originalColor;
                        }
                        
                        if (material._originalEmissive) {
                            material.emissive.copy(material._originalEmissive);
                            delete material._originalEmissive;
                        }
                        
                        if (material._originalRoughness !== undefined) {
                            material.roughness = material._originalRoughness;
                            delete material._originalRoughness;
                        }
                        
                        if (material._originalMetalness !== undefined) {
                            material.metalness = material._originalMetalness;
                            delete material._originalMetalness;
                        }
                        
                        material.needsUpdate = true;
                    });
                } else {
                    // Single material
                    if (targetMesh.material._originalMap !== undefined) {
                        targetMesh.material.map = targetMesh.material._originalMap;
                        delete targetMesh.material._originalMap;
                    } else {
                        targetMesh.material.map = null;
                    }
                    
                    // Restore original material properties if they exist
                    if (targetMesh.material._originalColor) {
                        targetMesh.material.color.copy(targetMesh.material._originalColor);
                        delete targetMesh.material._originalColor;
                    }
                    
                    if (targetMesh.material._originalEmissive) {
                        targetMesh.material.emissive.copy(targetMesh.material._originalEmissive);
                        delete targetMesh.material._originalEmissive;
                    }
                    
                    if (targetMesh.material._originalRoughness !== undefined) {
                        targetMesh.material.roughness = targetMesh.material._originalRoughness;
                        delete targetMesh.material._originalRoughness;
                    }
                    
                    if (targetMesh.material._originalMetalness !== undefined) {
                        targetMesh.material.metalness = targetMesh.material._originalMetalness;
                        delete targetMesh.material._originalMetalness;
                    }
                    
                    targetMesh.material.needsUpdate = true;
                }
            }
            
            // Clear any iframe reference stored on the mesh
            if (targetMesh._htmlIframe) {
                delete targetMesh._htmlIframe;
            }
            
            // Trigger a render to ensure changes are visible
            await triggerRender();
            
            console.log(`Custom texture removed from mesh ID ${meshId}`);
            resolve(true);
        } catch (error) {
            console.error('Error disabling custom texture:', error);
            reject(error);
        }
    });
}

/**
 * Set up the animation loop for updating HTML textures in real-time
 */
function setupHtmlTextureAnimationLoop() {
    // Store the animation frame ID so we can cancel it later if needed
    window._htmlTextureAnimationLoop = requestAnimationFrame(updateHtmlTextures);
    
    // Create a variable to track the last update time
    window._lastHtmlTextureUpdateTime = Date.now();
}

/**
 * Update all HTML textures that have animation enabled
 */
async function updateHtmlTextures() {
    // Check if we have any meshes to update
    if (!window._animatedHtmlMeshes || window._animatedHtmlMeshes.size === 0) {
        // No meshes to update, cancel the animation loop
        if (window._htmlTextureAnimationLoop) {
            cancelAnimationFrame(window._htmlTextureAnimationLoop);
            window._htmlTextureAnimationLoop = null;
        }
        return;
    }
    
    // Calculate the time since the last update
    const now = Date.now();
    const elapsed = now - window._lastHtmlTextureUpdateTime;
    
    // Only update textures at a reasonable rate (e.g., max 30 FPS)
    // This prevents excessive CPU usage while still providing smooth animation
    if (elapsed >= 33) { // ~30 FPS
        window._lastHtmlTextureUpdateTime = now;
        
        // Update each mesh with animated HTML content - use Promise.all to handle concurrently
        const updatePromises = [];
        
        window._animatedHtmlMeshes.forEach((data, id) => {
            // Check if it's time to update this mesh based on its playback speed
            const timeSinceLastUpdate = now - data.lastUpdate;
            const updateInterval = Math.max(33, 100 / (data.settings.playbackSpeed || 1.0));
            
            if (timeSinceLastUpdate >= updateInterval) {
                // Update the last update time
                data.lastUpdate = now;
                
                // Create a new texture from the iframe
                if (data.iframe && data.iframe.contentDocument) {
                    // Add to update promises
                    updatePromises.push(
                        createTextureFromIframe(data.iframe)
                            .then(texture => updateMeshTextureById(id, texture))
                            .catch(error => {
                                console.error(`Error updating HTML texture for mesh ${id}:`, error);
                            })
                    );
                }
            }
        });
        
        // Wait for all updates to complete
        if (updatePromises.length > 0) {
            try {
                await Promise.all(updatePromises);
            } catch (error) {
                console.error('Error updating multiple textures:', error);
            }
        }
    }
    
    // Continue the animation loop
    window._htmlTextureAnimationLoop = requestAnimationFrame(updateHtmlTextures);
}

/**
 * Clean up HTML texture animation resources
 * @param {number|string} meshId - The ID of the mesh to clean up, or null to clean up all
 */
export function cleanupHtmlTextureAnimation(meshId = null) {
    // If meshId is provided, only remove that mesh from the animation loop
    if (meshId !== null) {
        // Handle both number and string mesh IDs
        const targetId = typeof meshId === 'string' ? meshId : `mesh_${meshId}`;
        
        if (activeTextureData.has(targetId)) {
            const data = activeTextureData.get(targetId);
            
            // Remove iframe if it exists
            if (data.iframe) {
                try {
                    document.body.removeChild(data.iframe);
                } catch (error) {
                    console.debug('Error removing iframe:', error);
                }
            }
            
            // Dispose textures
            if (data.frames) {
                data.frames.forEach(frame => {
                    if (frame.texture) {
                        try {
                            frame.texture.dispose();
                        } catch (error) {
                            console.debug('Error disposing texture:', error);
                        }
                    }
                });
            }
            
            // Remove from active textures
            activeTextureData.delete(targetId);
        }
        
        // Legacy support for old system
        if (window._animatedHtmlMeshes && window._animatedHtmlMeshes.has(meshId)) {
            const data = window._animatedHtmlMeshes.get(meshId);
            if (data && data.iframe) {
                try {
                    document.body.removeChild(data.iframe);
                } catch (error) {
                    console.debug('Error removing iframe (legacy):', error);
                }
            }
            window._animatedHtmlMeshes.delete(meshId);
        }
        
        // If no more active textures, cancel animation loops
        if (activeTextureData.size === 0) {
            // Cancel our animation loop
            if (window._textureAnimationLoop) {
                cancelAnimationFrame(window._textureAnimationLoop);
                window._textureAnimationLoop = null;
            }
            
            // Cancel legacy animation loop
            if (window._htmlTextureAnimationLoop) {
                cancelAnimationFrame(window._htmlTextureAnimationLoop);
                window._htmlTextureAnimationLoop = null;
            }
        }
    } 
    // If no meshId is provided, clean up all resources
    else {
        // Clean up all tracked textures
        activeTextureData.forEach((data, id) => {
            if (data.iframe) {
                try {
                    document.body.removeChild(data.iframe);
                } catch (error) {
                    console.debug('Error removing iframe:', error);
                }
            }
            
            // Dispose textures
            if (data.frames) {
                data.frames.forEach(frame => {
                    if (frame.texture) {
                        try {
                            frame.texture.dispose();
                        } catch (error) {
                            console.debug('Error disposing texture:', error);
                        }
                    }
                });
            }
        });
        
        // Clear the map
        activeTextureData.clear();
        
        // Legacy support for old system
        if (window._animatedHtmlMeshes) {
            // Remove all iframes
            window._animatedHtmlMeshes.forEach((data) => {
                if (data.iframe) {
                    try {
                        document.body.removeChild(data.iframe);
                    } catch (error) {
                        console.debug('Error removing iframe (legacy):', error);
                    }
                }
            });
            
            // Clear the map
            window._animatedHtmlMeshes.clear();
        }
        
        // Cancel animation loops
        if (window._textureAnimationLoop) {
            cancelAnimationFrame(window._textureAnimationLoop);
            window._textureAnimationLoop = null;
        }
        
        if (window._htmlTextureAnimationLoop) {
            cancelAnimationFrame(window._htmlTextureAnimationLoop);
            window._htmlTextureAnimationLoop = null;
        }
    }
}

/**
 * Clean up all texture resources
 * This is useful for cleaning up when navigating away or shutting down
 */
function cleanupAllTextureResources() {
    console.log('Cleaning up all texture resources');
    
    // Clean up all HTML texture animations
    cleanupHtmlTextureAnimation();
    
    // Clean up all active texture data
    activeTextureData.forEach((data, id) => {
        console.log(`Cleaning up texture data for ID ${id}`);
        if (data.iframe) {
            try {
                document.body.removeChild(data.iframe);
            } catch (error) {
                console.debug('Error removing iframe:', error);
            }
        }
        
        if (data.texture) {
            try {
                data.texture.dispose();
            } catch (error) {
                console.debug('Error disposing texture:', error);
            }
        }
    });
    
    // Clear the map
    activeTextureData.clear();
    
    // Cancel any animation frames
    if (window._htmlTextureAnimationLoop) {
        cancelAnimationFrame(window._htmlTextureAnimationLoop);
        window._htmlTextureAnimationLoop = null;
    }
}

/**
 * Create and manage animation frames for a mesh
 * @param {string} meshId - Unique identifier for the mesh
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @param {Object} settings - Animation settings
 * @param {THREE.Mesh} [meshReference] - Direct reference to the mesh (to prevent loss of reference)
 */
export function setupTextureAnimation(meshId, iframe, settings = {}, meshReference = null) {
    return new Promise((resolve, reject) => {
        try {
            if (!meshId || !iframe) {
                console.error('Cannot set up texture animation: missing meshId or iframe');
                reject(new Error('Missing meshId or iframe'));
                return;
            }
            
            const playbackSpeed = settings.playbackSpeed || 1.0;
            const animationType = settings.animation?.type || 'play';
            
            console.log(`Setting up texture animation for mesh ${meshId} with type: ${animationType}`);
            
            // Check if we already have data for this mesh
            let meshData = activeTextureData.get(meshId);
            if (!meshData) {
                meshData = {};
                activeTextureData.set(meshId, meshData);
            }
            
            // Update with animation data
            Object.assign(meshData, {
                iframe,
                settings,
                lastUpdate: Date.now(),
                startTime: Date.now(),
                frames: [],
                animationType,
                playbackSpeed
            });
            
            // If direct mesh reference is provided, use it (helps prevent loss of reference)
            if (meshReference) {
                meshData.mesh = meshReference;
                console.log(`[TEXTURE_SETUP] Using direct mesh reference for ${meshId}`);
            }
            
            // Start the animation loop if not already running
            if (!window._textureAnimationLoop) {
                console.log('Starting texture animation loop');
                startTextureAnimationLoop();
            }
            
            // First frame can be captured immediately to kick-start the animation
            createTextureFromIframe(iframe)
                .then(texture => {
                    if (!meshData.frames) meshData.frames = [];
                    
                    meshData.frames.push({
                        texture,
                        timestamp: Date.now()
                    });
                    
                    // If we have the mesh reference, apply texture right away
                    if (meshData.mesh) {
                        return updateMeshTextureById(meshId, texture);
                    }
                })
                .then(() => {
                    resolve(true);
                })
                .catch(error => {
                    console.error(`Error in initial texture capture for animation:`, error);
                    // Resolve anyway since the animation can continue
                    resolve(true);
                });
        } catch (error) {
            console.error('Error setting up texture animation:', error);
            reject(error);
        }
    });
}

/**
 * Start the texture animation loop
 */
function startTextureAnimationLoop() {
    // Store the animation frame ID
    window._textureAnimationLoop = requestAnimationFrame(updateTextureAnimations);
    
    // Initial timestamp
    setLastTextureUpdateTime(Date.now());
}

/**
 * Update all texture animations
 */
async function updateTextureAnimations() {
    // Cancel loop if no textures to update
    if (activeTextureData.size === 0) {
        if (window._textureAnimationLoop) {
            cancelAnimationFrame(window._textureAnimationLoop);
            window._textureAnimationLoop = null;
        }
        return;
    }
    
    // Continue the animation loop
    window._textureAnimationLoop = requestAnimationFrame(updateTextureAnimations);
    
    // Calculate delta time
    const now = Date.now();
    const elapsed = now - getLastTextureUpdateTime();
    
    // Only update at a reasonable rate (30 FPS)
    if (elapsed < 33) return;
    
    // Update timestamp
    setLastTextureUpdateTime(now);
    
    // Process each active texture - gather all update promises
    const updatePromises = [];
    
    activeTextureData.forEach((data, meshId) => {
        // Calculate time based on playback speed
        const playbackSpeed = data.playbackSpeed || 1.0;
        const timeSinceLastUpdate = now - data.lastUpdate;
        const updateInterval = Math.max(33, 100 / playbackSpeed);
        
        // Skip if not time to update yet
        if (timeSinceLastUpdate < updateInterval) return;
        
        // Update timestamp
        data.lastUpdate = now;
        
        // If we have captured frames, use them for animation
        if (data.frames && data.frames.length > 0) {
            const elapsedSinceStart = now - data.startTime;
            const adjustedTime = elapsedSinceStart * playbackSpeed;
            
            // Calculate the frame index based on animation type
            let frameIndex = 0;
            
            switch (data.animationType) {
                case 'loop':
                    // Loop animation: cycle through frames
                    frameIndex = Math.floor(adjustedTime / 100) % data.frames.length;
                    break;
                    
                case 'bounce':
                    // Bounce animation: go back and forth through frames
                    const cycle = Math.floor(adjustedTime / (100 * data.frames.length));
                    const position = (adjustedTime / 100) % data.frames.length;
                    frameIndex = cycle % 2 === 0 ? 
                        Math.floor(position) : 
                        Math.floor(data.frames.length - position - 1);
                    break;
                    
                default:
                    // Default: use the most recent frame
                    frameIndex = data.frames.length - 1;
                    break;
            }
            
            // Use the appropriate frame
            frameIndex = Math.min(frameIndex, data.frames.length - 1);
            const texture = data.frames[frameIndex].texture;
            
            // Add to update promises
            updatePromises.push(
                updateMeshTextureById(meshId, texture)
                    .catch(error => {
                        console.error(`Error updating texture animation for mesh ${meshId}:`, error);
                    })
            );
        } 
        // Otherwise capture a new frame
        else if (data.iframe && document.body.contains(data.iframe)) {
            // Add to update promises
            updatePromises.push(
                createTextureFromIframe(data.iframe)
                    .then(texture => {
                        // Add to frames
                        if (!data.frames) data.frames = [];
                        
                        data.frames.push({
                            texture,
                            timestamp: now
                        });
                        
                        // Limit the number of stored frames (for memory)
                        if (data.frames.length > 30) {
                            // Remove oldest frame (and dispose its texture)
                            const oldestFrame = data.frames.shift();
                            if (oldestFrame.texture) {
                                oldestFrame.texture.dispose();
                            }
                        }
                        
                        // Update the mesh's texture
                        return updateMeshTextureById(meshId, texture);
                    })
                    .catch(error => {
                        console.error(`Error capturing frame for mesh ${meshId}:`, error);
                    })
            );
        }
    });
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
        try {
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Error updating multiple texture animations:', error);
        }
    }
}

/**
 * Update a mesh's texture by ID
 * @param {string} meshId - ID of the mesh to update
 * @param {THREE.Texture} texture - Texture to apply
 * @returns {Promise<boolean>} Promise that resolves when the texture is applied
 */
function updateMeshTextureById(meshId, texture) {
    return new Promise(async (resolve, reject) => {
        if (!texture) {
            reject(new Error('No texture provided'));
            return;
        }
        
        // Get data about this mesh
        const data = activeTextureData.get(meshId);
        if (!data || !data.mesh) {
            console.warn(`Cannot update texture for mesh ${meshId}: mesh not found`);
            reject(new Error('Mesh not found'));
            return;
        }
        
        try {
            // Apply the texture to the mesh
            await applyTextureToMesh(data.mesh, texture);
            resolve(true);
        } catch (error) {
            console.error(`Error updating texture for mesh ${meshId}:`, error);
            reject(error);
        }
    });
}

/**
 * Create and setup an iframe for rendering HTML content
 * @param {string} html - The HTML content to render
 * @returns {HTMLIFrameElement} The configured iframe
 */
function createAndSetupIframe(html) {
    console.log('[IFRAME_SETUP] Creating and setting up iframe for HTML content');
    
    // Create an iframe to render the HTML content
    const iframe = document.createElement('iframe');
    
    // Set up iframe style for optimal rendering
    iframe.style.width = '1024px';  // Use consistent size for better quality
    iframe.style.height = '576px';  // 16:9 aspect ratio
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';  // Hide it off-screen
    iframe.style.top = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'visible';
    iframe.style.opacity = '1';
    iframe.style.backgroundColor = 'white';  // Ensure white background
    iframe.style.transform = 'scale(1)';     // Ensure no scaling is applied
    iframe.allowTransparency = false;        // Don't allow transparency
    
    // Add important attributes
    iframe.setAttribute('scrolling', 'no');  // Prevent scrolling
    iframe.setAttribute('frameborder', '0'); // No border
    
    // Insert the iframe into the DOM
    document.body.appendChild(iframe);
    
    // Log iframe creation
    console.log('[IFRAME_SETUP] Iframe created and added to DOM');
    
    // Write the HTML content to the iframe
    if (iframe.contentDocument) {
        iframe.contentDocument.open();
        
        // Inject a basic HTML structure with embedded styles
        const enhancedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    html, body {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 15px;
                        box-sizing: border-box;
                        background-color: white !important;
                        overflow: hidden;
                        font-family: Arial, sans-serif;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    /* Basic layout styling */
                    p, h1, h2, h3, h4, h5, h6, div, span {
                        margin: 0 0 10px 0;
                    }
                    /* Ensure images don't overflow */
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;
        
        iframe.contentDocument.write(enhancedHtml);
        iframe.contentDocument.close();
        
        // Log content writing
        console.log('[IFRAME_SETUP] HTML content written to iframe');
    } else {
        console.error('[IFRAME_SETUP] Could not access iframe contentDocument');
    }
    
    return iframe;
}

/**
 * Create a texture using basic Canvas API as a fallback when html2canvas isn't available
 * @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
 * @returns {THREE.Texture} A basic texture created from the HTML content
 */
function createFallbackTexture(iframe) {
    console.log('[FALLBACK] Creating fallback texture without html2canvas');
    
    // Create a canvas with 16:9 aspect ratio
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const ctx = canvas.getContext('2d');
    
    // Fill with a white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    try {
        // Add visual info about the content
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
            const doc = iframe.contentDocument;
            const text = doc.body.textContent || 'No text content';
            
            // Draw a frame
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 10;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            
            // Add heading
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('HTML Content Preview', 30, 50);
            
            // Draw text preview - limit to 300 chars
            const textPreview = text.substring(0, 300) + (text.length > 300 ? '...' : '');
            
            // Wrap text
            const maxWidth = canvas.width - 60;
            const lineHeight = 24;
            let y = 100;
            
            // Add basic formatting if there seems to be structure
            const hasHeadings = doc.querySelector('h1, h2, h3, h4, h5, h6');
            const hasImages = doc.querySelector('img');
            const hasParagraphs = doc.querySelector('p');
            
            // Break the text into words
            let words = textPreview.split(' ');
            let line = '';
            
            ctx.font = '18px Arial';
            
            for (let i = 0; i < words.length; i++) {
                let testLine = line + words[i] + ' ';
                let metrics = ctx.measureText(testLine);
                let testWidth = metrics.width;
                
                if (testWidth > maxWidth && i > 0) {
                    ctx.fillText(line, 30, y);
                    line = words[i] + ' ';
                    y += lineHeight;
                    
                    // Stop if we've reached the bottom of the canvas
                    if (y > canvas.height - 100) break;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, 30, y);
            
            // Add info about content structure
            y = canvas.height - 80;
            ctx.font = '16px Arial';
            
            if (hasHeadings) {
                ctx.fillText('• Contains headings', 30, y);
                y += 20;
            }
            
            if (hasImages) {
                ctx.fillText('• Contains images', 30, y);
                y += 20;
            }
            
            if (hasParagraphs) {
                ctx.fillText('• Contains paragraphs', 30, y);
                y += 20;
            }
            
            // Add a message about fallback rendering
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('Using fallback rendering (html2canvas unavailable)', 30, canvas.height - 20);
        } else {
            // If we can't access the iframe content, add an error message
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('Error: Cannot access HTML content', 30, 100);
        }
    } catch (error) {
        console.error('[FALLBACK] Error creating fallback texture:', error);
        
        // If there's an error, add an error message to the canvas
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Error creating texture', 30, 100);
        ctx.font = '18px Arial';
        ctx.fillText(error.message, 30, 140);
    }
    
    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    console.log('[FALLBACK] Created fallback texture successfully');
    return texture;
}