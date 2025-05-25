/**
 * Examples Modal UI Component for Asset Debugger
 * 
 * This component displays a modal with examples when no files are loaded.
 */

export class ExamplesModal {
    constructor(onExampleSelected) {
        // Store the callback function to be called when an example is selected
        this.onExampleSelected = onExampleSelected;
        
        // Wait for HTML to be loaded before initializing elements
        this.waitForElementsAndInitialize();
    }
    
    /**
     * Wait for modal elements to be available in DOM before initializing
     */
    waitForElementsAndInitialize() {
        // Check if modal container is loaded
        if (document.getElementById('examples-modal-container')) {
            // Check if modal content has been loaded into the container
            if (document.getElementById('load-example-modal')) {
                this.initializeElements();
                this.initEventListeners();
            } else {
                // Wait for content to be loaded
                setTimeout(() => this.waitForElementsAndInitialize(), 100);
            }
        } else {
            // Wait for container to be available
            setTimeout(() => this.waitForElementsAndInitialize(), 100);
        }
    }
    
    /**
     * Initialize modal elements
     */
    initializeElements() {
        // Modal elements
        this.modal = document.getElementById('load-example-modal');
        this.closeButton = document.getElementById('close-example-modal');
        this.rigExampleButton = document.getElementById('rig-example-button');
        
        console.log('Examples modal elements initialized:', !!this.modal, !!this.closeButton, !!this.rigExampleButton);
    }
    
    /**
     * Initialize all event listeners for the examples modal
     */
    initEventListeners() {
        // Close button event listener
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.closeModal());
        }
        
        // Rig example button event listener
        if (this.rigExampleButton) {
            this.rigExampleButton.addEventListener('click', () => {
                this.closeModal();
                
                // First call the callback to set the state
                if (this.onExampleSelected) {
                    this.onExampleSelected('rig');
                }
                
                // Then directly create the wireframe cube example
                console.log('[EXAMPLES MODAL] Creating wireframe cube directly');
                
                // Import necessary modules with correct paths
                Promise.all([
                    import('./examples.js'),
                    import('../../state.js'),
                    import('../../scene/scene.js')
                ]).then(([examplesModule, stateModule, sceneModule]) => {
                    // Log all state modules we're using
                    console.log('[EXAMPLES MODAL] Loaded modules:', {
                        examples: !!examplesModule, 
                        state: !!stateModule,
                        scene: !!sceneModule
                    });
                    
                    // Get the current state and check its content
                    const state = stateModule.getState();
                    console.log('[EXAMPLES MODAL] Initial state content:', {
                        hasScene: !!state.scene,
                        hasCamera: !!state.camera,
                        hasRenderer: !!state.renderer,
                        selectedExample: state.selectedExample || 'none',
                        stateKeys: Object.keys(state)
                    });
                    
                    // Try to manually initialize the scene if it doesn't exist
                    if (!state.scene && sceneModule && sceneModule.initScene) {
                        console.log('[EXAMPLES MODAL] Attempting to manually initialize scene');
                        
                        // Get viewport element
                        const viewport = document.getElementById('viewport');
                        if (!viewport) {
                            console.error('[EXAMPLES MODAL] Viewport element not found!');
                        }
                        
                        try {
                            // Try to initialize the scene - handle both Promise and non-Promise return values
                            const result = sceneModule.initScene(viewport);
                            
                            console.log('[EXAMPLES MODAL] Scene initialization result:', result);
                            
                            // Start animation loop if available
                            if (sceneModule.startAnimation) {
                                sceneModule.startAnimation();
                                console.log('[EXAMPLES MODAL] Started animation loop');
                            }
                            
                            // Get updated state after manual initialization
                            setTimeout(() => {
                                const updatedState = stateModule.getState();
                                console.log('[EXAMPLES MODAL] After manual initialization:', {
                                    hasScene: !!updatedState.scene,
                                    hasCamera: !!updatedState.camera,
                                    hasRenderer: !!updatedState.renderer,
                                    stateKeys: Object.keys(updatedState)
                                });
                                
                                // Proceed with example creation
                                createExampleWhenReady();
                            }, 500); // Give it time to update the state
                        } catch (error) {
                            console.error('[EXAMPLES MODAL] Manual scene initialization failed:', error);
                            // Proceed anyway to use the waiting approach
                            createExampleWhenReady();
                        }
                    } else {
                        // Proceed with normal example creation
                        createExampleWhenReady();
                    }
                    
                    // Counter for attempts to ensure we don't wait forever
                    let attempts = 0;
                    const maxAttempts = 20; // 6 seconds max wait
                    
                    // Function to check for dependencies and create the example when ready
                    function createExampleWhenReady() {
                        // Wait until scene is initialized
                        const checkForScene = () => {
                            attempts++;
                            const state = stateModule.getState(); // Get fresh state every check
                            
                            // Detailed debug information
                            const stateInfo = {
                                scene: state.scene ? {
                                    type: state.scene.type,
                                    children: state.scene.children ? state.scene.children.length : 0,
                                    isObject3D: state.scene instanceof Object ? (state.scene.isObject3D || false) : false,
                                    background: state.scene.background ? (state.scene.background.isColor ? state.scene.background.getHexString() : 'unknown') : 'none'
                                } : 'null',
                                camera: state.camera ? {
                                    type: state.camera.type,
                                    position: state.camera.position ? `(${state.camera.position.x.toFixed(1)}, ${state.camera.position.y.toFixed(1)}, ${state.camera.position.z.toFixed(1)})` : 'unknown',
                                    isObject3D: state.camera instanceof Object ? (state.camera.isObject3D || false) : false
                                } : 'null',
                                renderer: state.renderer ? {
                                    type: state.renderer.type || 'unknown',
                                    domElement: state.renderer.domElement ? 'present' : 'missing'
                                } : 'null',
                                controls: state.controls ? 'present' : 'null',
                                stateKeys: Object.keys(state)
                            };
                            
                            console.log(`[EXAMPLES MODAL] State check (attempt ${attempts}/${maxAttempts}):`, stateInfo);
                            
                            if (state.scene) {
                                console.log('[EXAMPLES MODAL] Scene is ready, checking other dependencies...');
                                
                                // Check if camera is ready too
                                if (!state.camera) {
                                    if (attempts >= maxAttempts) {
                                        console.error('[EXAMPLES MODAL] Timed out waiting for camera');
                                        return;
                                    }
                                    console.log('[EXAMPLES MODAL] Camera not ready yet, waiting... (attempt ' + attempts + '/' + maxAttempts + ')');
                                    setTimeout(checkForScene, 300);
                                    return;
                                }
                                
                                // Check if renderer is ready
                                if (!state.renderer) {
                                    if (attempts >= maxAttempts) {
                                        console.error('[EXAMPLES MODAL] Timed out waiting for renderer');
                                        return;
                                    }
                                    console.log('[EXAMPLES MODAL] Renderer not ready yet, waiting... (attempt ' + attempts + '/' + maxAttempts + ')');
                                    setTimeout(checkForScene, 300);
                                    return;
                                }
                                
                                console.log('[EXAMPLES MODAL] All dependencies ready, creating wireframe cube example');
                                
                                examplesModule.createWireframeCubeExample()
                                    .then(cube => {
                                        console.log('[EXAMPLES MODAL] Wireframe cube created successfully:', cube);
                                    })
                                    .catch(error => {
                                        console.error('[EXAMPLES MODAL] Error creating wireframe cube:', error);
                                    });
                            } else {
                                if (attempts >= maxAttempts) {
                                    console.error('[EXAMPLES MODAL] Timed out waiting for scene to be initialized');
                                    console.error('[EXAMPLES MODAL] FAILURE: Unable to create wireframe cube example due to missing scene');
                                    console.error('[EXAMPLES MODAL] This is a critical error in the application initialization flow');
                                    
                                    // Dump detailed state for debugging
                                    console.log('[EXAMPLES MODAL] Final state dump:', state);
                                    console.log('[EXAMPLES MODAL] State keys:', Object.keys(state));
                                    
                                    // Log viewport status
                                    const viewport = document.getElementById('viewport');
                                    console.log('[EXAMPLES MODAL] Viewport element:', viewport ? 'Found' : 'Missing', 
                                        viewport ? `(${viewport.clientWidth}x${viewport.clientHeight})` : '');
                                    
                                    return;
                                }
                                console.log('[EXAMPLES MODAL] Scene not ready yet, waiting... (attempt ' + attempts + '/' + maxAttempts + ')');
                                setTimeout(checkForScene, 300);
                            }
                        };
                        
                        // Start checking for scene
                        checkForScene();
                    }
                }).catch(error => {
                    console.error('[EXAMPLES MODAL] Error importing modules:', error);
                });
            });
        }
        
        // Close modal when clicking outside
        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.closeModal();
                }
            });
        }
    }
    
    /**
     * Open the examples modal
     */
    openModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
        }
    }
    
    /**
     * Close the examples modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }
    
    /**
     * Show the modal if no files are loaded
     * @param {boolean} hasFiles - Whether any files are loaded
     * @returns {boolean} - Whether the modal was shown
     */
    showIfNoFiles(hasFiles) {
        if (!hasFiles) {
            console.log('No files loaded. Showing example modal...');
            this.openModal();
            return true;
        }
        return false;
    }
}

export default ExamplesModal; 