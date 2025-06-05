/**
 * Applies HTML-based textures to 3D meshes with support for animations and special rendering modes.
 * 
 * This function takes HTML content (stored as binary data) and renders it as a texture onto a Three.js mesh.
 * It supports both static textures and animated textures with pre-rendering for smooth playback.
 * 
 * Process Overview:
 * 1. Validates mesh data and retrieves the target mesh object
 * 2. Deserializes HTML content from binary data
 * 3. Creates an invisible iframe to render the HTML content
 * 4. For normal mode: Pre-renders animation frames and sets up playback loop
 * 5. For long exposure mode: Captures multiple frames and blends them together
 * 6. Applies the final texture(s) to the mesh material
 * 
 * @param {Object} meshData - Container for mesh information and content
 * @param {number} meshData.id - Unique identifier for the mesh (used as index if mesh not provided)
 * @param {THREE.Mesh} [meshData.mesh] - Direct reference to Three.js mesh object (preferred)
 * @param {Uint8Array} meshData.binaryData - Serialized HTML content and settings as binary data
 * @param {string} [meshData.html] - Deprecated: HTML content (use binaryData instead)
 * 
 * @param {string} renderType - Rendering mode: 'threejs' for normal animated textures, 'longExposure' for blended multi-frame textures
 * 
 * @param {Object} [settings={}] - Configuration options for texture rendering
 * @param {Object} [settings.animation] - Animation configuration
 * @param {string} [settings.animation.type] - Animation type: 'loop', 'bounce', or 'play'
 * @param {number} [settings.playbackSpeed=1.0] - Animation playback speed multiplier
 * @param {string} [settings.previewMode] - Alternative way to specify rendering mode
 * @param {Object} [settings.display] - Display configuration
 * @param {boolean} [settings.display.showBorders=true] - Whether to show preview borders during rendering
 * 
 * @returns {Promise<boolean>} Promise that resolves to true when texture is successfully applied, rejects on error
 * 
 * @throws {Error} When mesh data is invalid or missing
 * @throws {Error} When binary data cannot be deserialized
 * @throws {Error} When mesh object cannot be found or is invalid
 * @throws {Error} When html2canvas library is unavailable (long exposure mode)
 * @throws {Error} When animation module fails to load (normal mode with animations)
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
                    const stateModule = await import('../scene/state.js');
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
                        const { deserializeStringFromBinary } = await import('./string-serder.js');
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
                            const animationModule = await import('./custom-animation/animation-util.js');
                            
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
                                        
                                        if (typeof animationModule.startPlayback === 'function') {
                                            animationModule.startPlayback();
                                        } else {
                                            console.warn('startPlayback function not available in animation module');
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