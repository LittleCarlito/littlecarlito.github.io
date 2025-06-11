// Import all dependencies at the top
import * as THREE from 'three';
import { loadSettings, saveSettings } from '../util/data/localstorage-manager.js';
import { SettingsModal } from '../modals/settings-modal/settings-modal.js';
import { initAssetPanel } from '../panels/asset-panel/asset-panel.js';
import { initModelIntegration } from '../util/state/glb-state-manager.js';
import { initHtmlEditorModal } from '../modals/html-editor-modal/html-editor-modal.js';
import { initWorldPanel } from '../panels/world-panel/world-panel.js';
import { getState, printStateReport, hasFiles } from '../util/state/scene-state.js';
import { initUiManager } from '../util/ui/ui-manager.js';
import { hideLoadingSplash, showLoadingSplash, updateLoadingProgress } from '../loading-splash/loading-splash.js';
import { terminateAllWorkers } from '../util/workers/worker-manager.js';
import * as sceneController from '../util/scene/threejs-scene-controller.js';
import * as cameraController from '../util/scene/camera-controller.js';
import * as rigController from '../util/scene/rig/rig-controller.js';
import * as lightingManager from '../util/scene/lighting-manager.js';
import * as backgroundManager from '../util/scene/background-manager.js';
import * as modelHandler from '../util/scene/threejs-model-manager.js';
import * as textureHandler from '../util/upload/handlers/texture-file-handler.js';
import * as worldPanel from '../panels/world-panel/world-panel.js';
import * as assetPanel from '../panels/asset-panel/asset-panel.js';
import * as htmlEditorModule from '../modals/html-editor-modal/html-editor-modal.js';
import * as meshInfoModule from '../modals/mesh-info-modal/mesh-info-modal.js'
import * as stateModule from '../util/state/scene-state.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// Debug flags
const DEBUG_LIGHTING = false;

// Debug CSS3D variables
let debugCSS3DRenderer = null;
let debugCSS3DScene = null;
let debugCSS3DCamera = null;
let debugCSS3DFrame = null;
let debugAnimationId = null;

// Debug CSS3D HTML content
const DEBUG_CSS3D_HTML = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: linear-gradient(45deg, #1a1a2e, #16213e);
            font-family: 'Courier New', monospace;
            color: #00ff88;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .debug-container { text-align: center; position: relative; }
        .debug-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            text-shadow: 0 0 10px #00ff88;
            animation: pulse 2s ease-in-out infinite;
        }
        .debug-grid {
            display: grid;
            grid-template-columns: repeat(3, 60px);
            grid-gap: 10px;
            margin: 20px 0;
        }
        .debug-cube {
            width: 60px;
            height: 60px;
            background: linear-gradient(45deg, #00ff88, #00cc66);
            border: 2px solid #ffffff;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            color: #000;
            animation: rotate 3s linear infinite;
            transform-origin: center;
        }
        .debug-cube:nth-child(1) { animation-delay: 0s; }
        .debug-cube:nth-child(2) { animation-delay: 0.3s; }
        .debug-cube:nth-child(3) { animation-delay: 0.6s; }
        .debug-cube:nth-child(4) { animation-delay: 0.9s; }
        .debug-cube:nth-child(5) { animation-delay: 1.2s; }
        .debug-cube:nth-child(6) { animation-delay: 1.5s; }
        .debug-cube:nth-child(7) { animation-delay: 1.8s; }
        .debug-cube:nth-child(8) { animation-delay: 2.1s; }
        .debug-cube:nth-child(9) { animation-delay: 2.4s; }
        .debug-stats {
            margin-top: 20px;
            font-size: 12px;
            opacity: 0.8;
        }
        .debug-counter {
            display: inline-block;
            min-width: 30px;
            background: rgba(0, 255, 136, 0.2);
            padding: 2px 6px;
            border-radius: 4px;
            animation: count 1s linear infinite;
        }
        .debug-wave {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, #00ff88, #00cc66, #00ff88);
            animation: wave 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes rotate {
            0% { transform: rotate(0deg) scale(1); }
            25% { transform: rotate(90deg) scale(1.1); }
            50% { transform: rotate(180deg) scale(1); }
            75% { transform: rotate(270deg) scale(0.9); }
            100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes count {
            0% { background: rgba(0, 255, 136, 0.2); }
            50% { background: rgba(0, 255, 136, 0.5); }
            100% { background: rgba(0, 255, 136, 0.2); }
        }
        @keyframes wave {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
    </style>
</head>
<body>
    <div class="debug-container">
        <div class="debug-title">DEBUG CSS3D</div>
        <div class="debug-grid">
            <div class="debug-cube">1</div>
            <div class="debug-cube">2</div>
            <div class="debug-cube">3</div>
            <div class="debug-cube">4</div>
            <div class="debug-cube">5</div>
            <div class="debug-cube">6</div>
            <div class="debug-cube">7</div>
            <div class="debug-cube">8</div>
            <div class="debug-cube">9</div>
        </div>
        <div class="debug-stats">
            FRAME: <span class="debug-counter" id="frameCounter">0</span> | 
            TIME: <span class="debug-counter" id="timeCounter">00:00</span>
        </div>
        <div class="debug-wave"></div>
    </div>
    <script>
        let frameCount = 0;
        let startTime = Date.now();
        function updateCounters() {
            frameCount++;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('frameCounter').textContent = frameCount;
            document.getElementById('timeCounter').textContent = \`\${minutes}:\${seconds}\`;
        }
        setInterval(updateCounters, 100);
    </script>
</body>
</html>`;

// Component loading state tracker
const componentsLoaded = {
    worldPanel: false,
    assetPanel: false,
    settingsModal: false,
    htmlEditor: false,
    meshInfo:false,
    scene: false
};

// Resource loading state tracker
const resourcesLoaded = {
    componentsLoaded: false,
    sceneInitialized: false,
    lightingLoaded: false,
    backgroundLoaded: false,
    modelLoaded: false,
    controlsReady: false
};

// Track if loading is complete
let loadingComplete = false;

// Flag to indicate that page is being unloaded
let isPageUnloading = false;

function initDebugCSS3DFrame() {
    const viewport = document.getElementById('viewport');
    if (!viewport) return;

    try {
        debugCSS3DScene = new THREE.Scene();
        
        debugCSS3DCamera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
        debugCSS3DCamera.position.set(0, 0, 500);

        debugCSS3DRenderer = new CSS3DRenderer();
        debugCSS3DRenderer.setSize(300, 200);
        debugCSS3DRenderer.domElement.style.position = 'absolute';
        debugCSS3DRenderer.domElement.style.top = '80px';
        debugCSS3DRenderer.domElement.style.left = '20px';
        debugCSS3DRenderer.domElement.style.zIndex = '3000';
        debugCSS3DRenderer.domElement.style.border = '2px solid #00ff88';
        debugCSS3DRenderer.domElement.style.borderRadius = '8px';
        debugCSS3DRenderer.domElement.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)';
        debugCSS3DRenderer.domElement.style.pointerEvents = 'none';

        const iframe = document.createElement('iframe');
        iframe.style.width = '300px';
        iframe.style.height = '200px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '6px';
        iframe.style.overflow = 'hidden';

        debugCSS3DFrame = new CSS3DObject(iframe);
        debugCSS3DFrame.position.set(0, 0, 0);
        debugCSS3DScene.add(debugCSS3DFrame);

        viewport.appendChild(debugCSS3DRenderer.domElement);

        setTimeout(() => {
            if (iframe.contentDocument) {
                iframe.contentDocument.open();
                iframe.contentDocument.write(DEBUG_CSS3D_HTML);
                iframe.contentDocument.close();
            }
        }, 100);

        animateDebugCSS3D();
        console.log('Debug CSS3D frame initialized');
    } catch (error) {
        console.error('Error initializing debug CSS3D frame:', error);
    }
}

function animateDebugCSS3D() {
    if (!debugCSS3DRenderer || !debugCSS3DScene || !debugCSS3DCamera) {
        return;
    }

    debugAnimationId = requestAnimationFrame(animateDebugCSS3D);

    if (debugCSS3DFrame) {
        debugCSS3DFrame.rotation.z += 0.001;
    }

    debugCSS3DRenderer.render(debugCSS3DScene, debugCSS3DCamera);
}

function cleanupDebugCSS3DFrame() {
    if (debugAnimationId) {
        cancelAnimationFrame(debugAnimationId);
        debugAnimationId = null;
    }

    if (debugCSS3DRenderer && debugCSS3DRenderer.domElement) {
        const parent = debugCSS3DRenderer.domElement.parentNode;
        if (parent) {
            parent.removeChild(debugCSS3DRenderer.domElement);
        }
        debugCSS3DRenderer = null;
    }

    debugCSS3DScene = null;
    debugCSS3DCamera = null;
    debugCSS3DFrame = null;
    console.log('Debug CSS3D frame cleaned up');
}

export function setupDebuggerScene() {
    showLoadingSplash("Setting up debugging environment");
    resetThreeJSState();
    
    getState();
    printStateReport('debugger-scene');
    
    updateLoadingProgress("Initializing UI");
    initUiManager();
    
    updateLoadingProgress("Loading HTML components");
    loadComponentHtml();
    
    updateLoadingProgress("Setting up 3D scene");
    initializeScene();
    
    updateLoadingProgress("Setting up event listeners");
    const restartDebugBtn = document.getElementById('restart-debug');
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
    }
    
    setTimeout(ensureCollapsibleHeadersWork, 500);
    setTimeout(initDebugCSS3DFrame, 1000);
    
    updateLoadingProgress("Finalizing startup");
    return cleanupDebuggerScene;
}

function resetThreeJSState() {
    const state = stateModule.getState();
    
    // Clear ThreeJS objects
    if (state.scene) {
        while(state.scene.children && state.scene.children.length > 0) { 
            state.scene.remove(state.scene.children[0]); 
        }
    }
    
    // Dispose renderer
    if (state.renderer) {
        state.renderer.dispose();
    }
    
    // Dispose controls
    if (state.controls) {
        state.controls.dispose();
    }
    
    // Reset critical state values
    stateModule.updateState('scene', null);
    stateModule.updateState('camera', null);
    stateModule.updateState('renderer', null);
    stateModule.updateState('controls', null);
    stateModule.updateState('cube', null);
    stateModule.updateState('animating', false);
    
    // Reset background option via DOM
    setTimeout(() => {
        const noneRadioBtn = document.querySelector('input[name="bg-option"][value="none"]');
        if (noneRadioBtn) {
            noneRadioBtn.checked = true;
        }
        
        const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
        const hdrPreviewCanvas = document.getElementById('hdr-preview-canvas');
        
        if (bgPreviewCanvas) bgPreviewCanvas.style.opacity = '0.3';
        if (hdrPreviewCanvas) hdrPreviewCanvas.style.opacity = '0.3';
    }, 100);
}

function cleanupDebuggerScene() {
   isPageUnloading = true;
   cleanupDebugCSS3DFrame();
   
   if (htmlEditorModule.resetInitialization) {
       htmlEditorModule.resetInitialization();
   }
   
   const debugControls = document.querySelector('.debug-controls');
   if (debugControls) {
       debugControls.style.display = 'none';
   }
   
   terminateAllWorkers();
   
   setTimeout(() => {
       if (worldPanel.cleanupWorldPanel) {
           worldPanel.cleanupWorldPanel();
       }
       
       if (stateModule.clearAllFiles) {
           stateModule.clearAllFiles(true);
       }
       
       const state = stateModule.getState();
       
       if (state.animating && sceneController.stopAnimation) {
           sceneController.stopAnimation();
       }
       
       if (state.renderer) {
           state.renderer.dispose();
           stateModule.updateState('renderer', null);
       }
       
       const controls = state.controls;
       if (controls) {
           if (cameraController.disposeControls) {
               cameraController.disposeControls();
           }
           if (controls.dispose) {
               controls.dispose();
           }
           stateModule.updateState('controls', null);
       }
       
       if (state.scene) {
           while(state.scene.children && state.scene.children.length > 0) {
               const obj = state.scene.children[0];
               if (obj.geometry) obj.geometry.dispose();
               if (obj.material) {
                   if (Array.isArray(obj.material)) {
                       obj.material.forEach(mat => mat.dispose());
                   } else {
                       obj.material.dispose();
                   }
               }
               state.scene.remove(obj);
           }
           stateModule.updateState('scene', null);
       }
       
       const canvasElements = document.querySelectorAll('canvas[data-animation-id]');
       canvasElements.forEach(canvas => {
           if (typeof canvas.cleanup === 'function') {
               canvas.cleanup();
           }
           
           const animId = canvas.getAttribute('data-animation-id');
           if (animId) {
               cancelAnimationFrame(parseInt(animId, 10));
           }
       });
       
       const noneRadioBtn = document.querySelector('input[name="bg-option"][value="none"]');
       if (noneRadioBtn) {
           noneRadioBtn.checked = true;
       }
       
       const bgPreviewCanvas = document.getElementById('bg-preview-canvas');
       const hdrPreviewCanvas = document.getElementById('hdr-preview-canvas');
       
       if (bgPreviewCanvas) bgPreviewCanvas.style.opacity = '0.3';
       if (hdrPreviewCanvas) hdrPreviewCanvas.style.opacity = '0.3';
   }, 0);
   
   return null;
}

function loadComponentHtml() {
    const worldPanelPromise = fetch('./panels/world-panel/world-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('world-tab-container').innerHTML = html;
            initWorldPanel(true);
            componentsLoaded.worldPanel = true;
        });

    const assetPanelPromise = fetch('./panels/asset-panel/asset-panel.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('asset-tab-container').innerHTML = html;
            initAssetPanel();
            componentsLoaded.assetPanel = true;
        });

    const settingsModalPromise = fetch('./modals/settings-modal/settings-modal.html')
        .then(response => response.text())
        .then(html => {
            const container = document.querySelector('settings-modal-container');
            if (container) {
                container.innerHTML = html;
                setTimeout(() => new SettingsModal(), 0);
            }
            componentsLoaded.settingsModal = true;
        });
    
    const axisIndicatorPromise = fetch('./axis-indicator/axis-indicator.html')
        .then(response => response.text())
        .then(html => {
            const axisSettingsContainer = document.getElementById('axis-settings-container');
            if (axisSettingsContainer) {
                axisSettingsContainer.innerHTML = html;
                
                const axisTabButton = document.querySelector('.settings-tab-button[data-tab="axis-settings"]');
                if (axisTabButton && axisTabButton.classList.contains('active')) {
                    const axisSettings = document.getElementById('axis-settings');
                    if (axisSettings) {
                        axisSettings.classList.add('active');
                    }
                }
            }
        });

    const htmlEditorPromise = fetch('./modals/html-editor-modal/html-editor-modal.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('html-editor-modal-container').innerHTML = html;
            
            const modalElement = document.getElementById('html-editor-modal');
            if (modalElement) {
                modalElement.style.display = 'none';
                
                if (htmlEditorModule.resetInitialization) {
                    htmlEditorModule.resetInitialization();
                }
                initHtmlEditorModal();
                initModelIntegration();
                componentsLoaded.htmlEditor = true;
            } else {
                throw new Error('HTML editor modal element not found');
            }
        });

    const meshInfoPromise = fetch('./modals/mesh-info-modal/mesh-info-modal.html')
        .then(response => {
            console.log('Mesh info modal HTML fetch response:', response.status, response.ok);
            return response.text();
        })
        .then(html => {
            console.log('Mesh info modal HTML received, length:', html.length);
            
            const container = document.getElementById('mesh-info-modal-container');
            console.log('Mesh info modal container found:', !!container);
            
            if (container) {
                container.innerHTML = html;
                console.log('Mesh info modal HTML inserted into container');
                
                const modalElement = document.getElementById('mesh-info-modal');
                console.log('Mesh info modal element now exists:', !!modalElement);
                
                if (modalElement) {
                    modalElement.style.display = 'none';
                    console.log('Mesh info modal display set to none');
                    
                    if (meshInfoModule.resetInitialization) {
                        meshInfoModule.resetInitialization();
                        console.log('Mesh info modal initialization reset');
                    }
                    
                    meshInfoModule.initMeshInfoModal();
                    console.log('Mesh info modal initialized');
                    
                    componentsLoaded.meshInfo = true;
                    console.log('Mesh info modal component marked as loaded');
                } else {
                    console.error('Mesh info modal element not found after HTML insertion');
                    throw new Error('Mesh info modal element not found');
                }
            } else {
                console.error('Mesh info modal container not found');
                throw new Error('Mesh info modal container not found');
            }
        })
        .catch(error => {
            console.error('Error loading mesh info modal:', error);
            // Don't fail the entire promise chain
            componentsLoaded.meshInfo = false;
        });

    Promise.all([
        worldPanelPromise,
        assetPanelPromise,
        settingsModalPromise,
        axisIndicatorPromise,
        htmlEditorPromise,
        meshInfoPromise
    ])
    .then(() => {
        resourcesLoaded.componentsLoaded = true;
        startDebugging();
    })
    .catch(errors => {
        resourcesLoaded.componentsLoaded = true;
        startDebugging();
    });
}

function checkAllResourcesLoaded() {
    if (resourcesLoaded.componentsLoaded && 
        resourcesLoaded.sceneInitialized && 
        resourcesLoaded.lightingLoaded && 
        resourcesLoaded.backgroundLoaded && 
        resourcesLoaded.modelLoaded &&
        resourcesLoaded.controlsReady) {
        
        if (!loadingComplete) {
            loadingComplete = true;
            hideLoadingSplash();
        }
    }
}

function initializeScene() {
    const viewport = document.getElementById('viewport');
    
    const ensureViewportSize = () => {
        if (viewport.offsetWidth === 0 || viewport.offsetHeight === 0) {
            setTimeout(ensureViewportSize, 50);
            return;
        }
        
        sceneController.initScene(viewport, false);
        sceneController.startAnimation();
        componentsLoaded.scene = true;
        resourcesLoaded.sceneInitialized = true;
        checkAllResourcesLoaded();
        
        setTimeout(() => {
            if (hasFiles() && cameraController.resetControls) {
                cameraController.resetControls();
            }
            resourcesLoaded.controlsReady = true;
            checkAllResourcesLoaded();
        }, 500);
    };
    
    ensureViewportSize();
}

function startDebugging() {
    const savedSettings = loadSettings();
    
    if (savedSettings && savedSettings.rigOptions) {
        rigController.updateRigOptions(savedSettings.rigOptions);
    }
    
    initializeDebugger(savedSettings);

    const waitForSceneAndProcessFiles = () => {
        if (!resourcesLoaded.sceneInitialized) {
            setTimeout(waitForSceneAndProcessFiles, 100);
            return;
        }
        processFilesFromState();
    };

    waitForSceneAndProcessFiles();
}

function processFilesFromState() {
    if (isPageUnloading) {
        resourcesLoaded.lightingLoaded = true;
        resourcesLoaded.backgroundLoaded = true;
        resourcesLoaded.modelLoaded = true;
        resourcesLoaded.controlsReady = true;
        checkAllResourcesLoaded();
        return;
    }
    
    const currentState = stateModule.getState();
    
    resourcesLoaded.lightingLoaded = false;
    resourcesLoaded.backgroundLoaded = false;
    resourcesLoaded.modelLoaded = false;

    let promiseChain = Promise.resolve();

    const checkContinueProcessing = () => {
        if (isPageUnloading) {
            throw new Error('Page unloading - processing aborted');
        }
        return true;
    };

    // Process lighting first
    if (stateModule.hasLightingFile() && checkContinueProcessing()) {
        const lightingFile = stateModule.getLightingFile();
        promiseChain = promiseChain.then(() => {
            return lightingManager.setupEnvironmentLighting(lightingFile)
                .then(texture => {
                    const state = stateModule.getState();
                    if (state && state.scene && texture && !state.scene.environment) {
                        state.scene.environment = texture;
                    }
                    
                    if (worldPanel.updateLightingInfo) {
                        const lightingMetadata = {
                            fileName: lightingFile.name,
                            type: lightingFile.name.split('.').pop().toUpperCase(),
                            fileSizeBytes: lightingFile.size,
                            dimensions: texture && texture.image ? {
                                width: texture.image.width || 0,
                                height: texture.image.height || 0
                            } : { width: 0, height: 0 }
                        };
                        
                        worldPanel.updateLightingInfo(lightingMetadata);
                        
                        if (worldPanel.toggleOptionVisibility) {
                            worldPanel.toggleOptionVisibility('hdr-option', true);
                        }
                    }
                    return texture;
                });
        })
        .then(() => {
            resourcesLoaded.lightingLoaded = true;
            checkAllResourcesLoaded();
        })
        .catch(error => {
            resourcesLoaded.lightingLoaded = true;
            checkAllResourcesLoaded();
        });
    } else {
        resourcesLoaded.lightingLoaded = true;
        checkAllResourcesLoaded();
    }

    // Handle background file
    if (stateModule.hasBackgroundFile() && checkContinueProcessing()) {
        const backgroundFile = stateModule.getBackgroundFile();
        promiseChain = promiseChain.then(() => {
            return backgroundManager.setupBackgroundImage(backgroundFile)
                .then(texture => {
                    if (texture) {
                        const event = new CustomEvent('background-updated', { 
                            detail: { texture, file: backgroundFile }
                        });
                        document.dispatchEvent(event);
                    }
                    return texture;
                });
        })
        .then(() => {
            resourcesLoaded.backgroundLoaded = true;
            checkAllResourcesLoaded();
        })
        .catch(error => {
            resourcesLoaded.backgroundLoaded = true;
            checkAllResourcesLoaded();
        });
    } else {
        resourcesLoaded.backgroundLoaded = true;
        checkAllResourcesLoaded();
    }

    // Handle model file
    if (stateModule.hasModelFile() && checkContinueProcessing()) {
        promiseChain = promiseChain.then(() => {
            return modelHandler.loadDebugModel();
        })
        .then(() => {
            resourcesLoaded.modelLoaded = true;
            checkAllResourcesLoaded();
        })
        .catch(error => {
            resourcesLoaded.modelLoaded = true;
            checkAllResourcesLoaded();
        });
    } else {
        resourcesLoaded.modelLoaded = true;
        checkAllResourcesLoaded();
    }

    // Handle texture files
    if ((stateModule.hasBaseColorFile() || stateModule.hasOrmFile() || stateModule.hasNormalFile()) && checkContinueProcessing()) {
        promiseChain = promiseChain.then(() => {
            const promises = [];
            
            if (stateModule.hasBaseColorFile()) {
                promises.push(textureHandler.loadTextureFromFile(stateModule.getBaseColorFile(), 'baseColor'));
            }
            if (stateModule.hasOrmFile()) {
                promises.push(textureHandler.loadTextureFromFile(stateModule.getOrmFile(), 'orm'));
            }
            if (stateModule.hasNormalFile()) {
                promises.push(textureHandler.loadTextureFromFile(stateModule.getNormalFile(), 'normal'));
            }
            
            return Promise.all(promises);
        });
    }

    // Initialize UI panels after all resources are loaded
    promiseChain = promiseChain.then(() => {
        if (worldPanel.initWorldPanel) {
            worldPanel.initWorldPanel(false);
            
            if (worldPanel.updateWorldPanel) {
                worldPanel.updateWorldPanel();
            }
            
            const state = stateModule.getState();
            if (state.lightingFile && worldPanel.toggleOptionVisibility) {
                worldPanel.toggleOptionVisibility('hdr-option', true);
                
                if (state.lightingFile && worldPanel.updateLightingInfo) {
                    const lightingMetadata = {
                        fileName: state.lightingFile.name,
                        type: state.lightingFile.name.split('.').pop().toUpperCase(),
                        fileSizeBytes: state.lightingFile.size
                    };
                    worldPanel.updateLightingInfo(lightingMetadata);
                }
                
                const noneRadio = document.querySelector('input[name="bg-option"][value="none"]');
                if (noneRadio) {
                    noneRadio.checked = true;
                }
            }
        }
        
        if (assetPanel.initAssetPanel) {
            assetPanel.initAssetPanel();
        }
    });

    return promiseChain.catch(error => {
        resourcesLoaded.lightingLoaded = true;
        resourcesLoaded.backgroundLoaded = true;
        resourcesLoaded.modelLoaded = true;
        checkAllResourcesLoaded();
    });
}

function initializeDebugger(settings) {
    const uploadSection = document.getElementById('upload-section');
    
    const checkHeaderAndInit = () => {
        const debugControls = document.querySelector('.debug-controls');
        const viewport = document.getElementById('viewport');
        const tabContainer = document.getElementById('tab-container');
        
        if (!debugControls) {
            setTimeout(checkHeaderAndInit, 50);
            return;
        }
        
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
        
        if (debugControls) {
            debugControls.style.display = 'flex';
        }
        
        if (viewport) {
            viewport.style.display = 'block';
        }
        
        if (tabContainer) {
            const isPanelHidden = settings && settings.tabPanelHidden;
            
            if (isPanelHidden) {
                tabContainer.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            } else {
                tabContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
            }
        }
        
        setupTabNavigation();
        setupTogglePanelButton();
    };
    
    checkHeaderAndInit();
}

function restartDebugging() {
    window.location.reload();
}

function setupTabNavigation() {
    const worldTabButton = document.getElementById('world-tab-button');
    const assetTabButton = document.getElementById('asset-tab-button');
    
    function getTabElements() {
        return {
            worldTab: document.getElementById('world-tab-container'),
            worldContent: document.getElementById('world-tab'),
            assetTab: document.getElementById('asset-tab-container'),
            assetContent: document.getElementById('asset-tab')
        };
    }
    
    function hideAllTabs() {
        const tabs = getTabElements();
        Object.values(tabs).forEach(tab => {
            if (tab) tab.classList.remove('active');
        });
    }
    
    if (worldTabButton) {
        worldTabButton.addEventListener('click', () => {
            worldTabButton.classList.add('active');
            assetTabButton.classList.remove('active');
            
            hideAllTabs();
            
            const tabs = getTabElements();
            if (tabs.worldTab) tabs.worldTab.classList.add('active');
            if (tabs.worldContent) tabs.worldContent.classList.add('active');
        });
    }
    
    if (assetTabButton) {
        assetTabButton.addEventListener('click', () => {
            worldTabButton.classList.remove('active');
            assetTabButton.classList.add('active');
            
            hideAllTabs();
            
            const tabs = getTabElements();
            if (tabs.assetTab) tabs.assetTab.classList.add('active');
            if (tabs.assetContent) tabs.assetContent.classList.add('active');
        });
    }
    
    activateWorldTab();
}

function activateWorldTab() {
    function getTabElements() {
        return {
            worldTab: document.getElementById('world-tab-container'),
            worldContent: document.getElementById('world-tab'),
            assetTab: document.getElementById('asset-tab-container'),
            assetContent: document.getElementById('asset-tab')
        };
    }
    
    function hideAllTabs() {
        const tabs = getTabElements();
        Object.values(tabs).forEach(tab => {
            if (tab) tab.classList.remove('active');
        });
    }
    
    hideAllTabs();
    
    const tabs = getTabElements();
    if (tabs.worldTab) tabs.worldTab.classList.add('active');
    if (tabs.worldContent) tabs.worldContent.classList.add('active');
    
    const worldTabButton = document.getElementById('world-tab-button');
    const assetTabButton = document.getElementById('asset-tab-button');
    
    if (worldTabButton) worldTabButton.classList.add('active');
    if (assetTabButton) assetTabButton.classList.remove('active');
}

function setupTogglePanelButton() {
    const DEBUG_TOGGLE_PANEL = false;
    
    const toggleButton = document.getElementById('toggle-panel');
    const tabContainer = document.getElementById('tab-container');
    
    if (!toggleButton || !tabContainer) {
        return;
    }
    
    const settings = loadSettings() || {};
    let isPanelHidden = settings.tabPanelHidden || false;
    
    if (isPanelHidden) {
        tabContainer.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
        toggleButton.classList.add('active');
        toggleButton.setAttribute('title', 'Show Side Panel');
    } else {
        tabContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
        toggleButton.classList.remove('active');
        toggleButton.setAttribute('title', 'Hide Side Panel');
    }
    
    toggleButton.addEventListener('click', function() {
        isPanelHidden = !isPanelHidden;
        
        if (isPanelHidden) {
            tabContainer.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            toggleButton.classList.add('active');
            toggleButton.setAttribute('title', 'Show Side Panel');
        } else {
            tabContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
            toggleButton.classList.remove('active');
            toggleButton.setAttribute('title', 'Hide Side Panel');
        }
        
        settings.tabPanelHidden = isPanelHidden;
        saveSettings(settings);
    });
}

function ensureCollapsibleHeadersWork() {
    const headers = document.querySelectorAll('.collapsible-header');
    
    headers.forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const content = this.nextElementSibling;
            if (!content || !content.classList.contains('metadata-content')) {
                return;
            }
            
            const currentDisplay = window.getComputedStyle(content).display;
            
            if (currentDisplay === 'none') {
                content.style.display = 'block';
                const indicator = this.querySelector('.collapse-indicator');
                if (indicator) {
                    indicator.textContent = '[-]';
                }
            } else {
                content.style.display = 'none';
                const indicator = this.querySelector('.collapse-indicator');
                if (indicator) {
                    indicator.textContent = '[+]';
                }
            }
            
            return false;
        }, true);
    });
}