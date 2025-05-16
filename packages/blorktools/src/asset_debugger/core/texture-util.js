import * as THREE from 'three';
import { isPreviewActive } from './preview/preview-util';

// Add a variable to track if we're capturing frames for long exposure
let isCapturingForLongExposure = false;

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
    return new Promise((resolve, reject) => {
        try {
            // Check if preview is still active
            if (!isPreviewActive) {
                reject(new Error('Preview is no longer active'));
                return;
            }
            
            // Make sure we can access the iframe
            if (!iframe || !document.body.contains(iframe)) {
                reject(new Error('Iframe not found in DOM or removed'));
                return;
            }
            
            // Create a simple delay function
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            
            // Give more time for the iframe to fully load
            delay(300).then(async () => {
                try {
                    // Check if we can access the iframe content safely
                    if (!iframe.contentDocument || !iframe.contentWindow) {
                        console.log('Cannot access iframe content, using empty texture');
                        resolve(createEmptyTexture());
                        return;
                    }
                    
                    // Check if html2canvas is available
                    if (typeof window.html2canvas === 'undefined') {
                        console.log('html2canvas not available, using empty texture');
                        resolve(createEmptyTexture());
                        return;
                    }
                    
                    // Make sure the body is fully loaded
                    if (!iframe.contentDocument.body) {
                        console.log('Iframe body not available, using empty texture');
                        resolve(createEmptyTexture());
                        return;
                    }
                    
                    // Inject animation detection script if not already injected
                    if (!iframe.contentWindow.__animationDetection) {
                        injectAnimationDetectionScript(iframe);
                    }
                    
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
                            background-color: white;
                            font-size: 20px !important; /* Increase base font size for better readability */
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
                        
                        /* Increase font size of common elements */
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
                        }
                    `;
                    
                    try {
                        // Add the style element temporarily for rendering
                        iframe.contentDocument.head.appendChild(styleElement);
                        
                        // Use html2canvas to capture the iframe content
                        const targetElement = iframe.contentDocument.body;
                        
                        try {
                            // Increase scale factor for better quality
                            const canvas = await window.html2canvas(targetElement, {
                                backgroundColor: '#FFFFFF', // Explicitly set to white to match HTML default
                                scale: 8, // Significantly increased from 4 for higher resolution textures
                                logging: false,
                                allowTaint: true,
                                useCORS: true,
                                foreignObjectRendering: true
                            });
                            
                            // Remove the temporary style element after rendering
                            if (styleElement && styleElement.parentNode) {
                                styleElement.parentNode.removeChild(styleElement);
                            }
                            
                            // Create a texture from the canvas
                            const texture = new THREE.CanvasTexture(canvas);
                            
                            // Improve texture quality settings
                            texture.anisotropy = 16; // Doubled from 8 for better quality at angles
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.generateMipmaps = false;
                            texture.needsUpdate = true;
                            
                            resolve(texture);
                        } catch (error) {
                            console.error('Error capturing with html2canvas:', error);
                            
                            // Remove the temporary style element if it exists
                            if (styleElement && styleElement.parentNode) {
                                styleElement.parentNode.removeChild(styleElement);
                            }
                            
                            // On error, return empty texture instead of failing
                            resolve(createEmptyTexture());
                        }
                    } catch (error) {
                        console.error('Error in texture creation:', error);
                        // Return empty texture on error rather than failing completely
                        const emptyTexture = createEmptyTexture();
                        resolve(emptyTexture);
                    }
                } catch (error) {
                    console.error('Error in texture creation:', error);
                    // Return empty texture on error rather than failing completely
                    const emptyTexture = createEmptyTexture();
                    resolve(emptyTexture);
                }
            });
        } catch (error) {
            console.error('Error in createTextureFromIframe:', error);
            // Create a simple empty texture on error instead of failing
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF'; // White background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            resolve(texture);
        }
    });
}

/**
 * Create a fallback texture when iframe content can't be accessed
 * @returns {THREE.Texture} A simple fallback texture
 */
function createEmptyTexture() {
    console.log('Creating empty texture');
    
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