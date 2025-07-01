import * as THREE from 'three';
import { injectUnifiedAnimationDetectionScript } from '../../data/animation-classifier';
import { loadHtml2Canvas } from '../../loaders/html2canvas-loader';

const HTML2CANVAS_DEBUG_FLAG = false;

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
            const html2canvasAvailable = await loadHtml2Canvas();
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
