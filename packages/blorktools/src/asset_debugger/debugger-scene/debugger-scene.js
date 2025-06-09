// Import all dependencies at the top
import { loadSettings, saveSettings } from '../util/data/localstorage-manager.js';
import { SettingsModal } from '../modals/settings-modal/settings-modal.js';
import { initAssetPanel } from '../panels/asset-panel/asset-panel.js';
import { initModelIntegration } from '../modals/html-editor-modal/model-integration.js';
import { initHtmlEditorModal } from '../modals/html-editor-modal/html-editor-modal.js';
import { initWorldPanel } from '../panels/world-panel/world-panel.js';
import { getState, printStateReport, hasFiles } from '../util/state/scene-state.js';
import { initUiManager } from '../util/scene/ui-manager.js';
import { hideLoadingSplash, showLoadingSplash, updateLoadingProgress } from '../loading-splash/loading-splash.js';
import { setupDropzones } from '../util/upload/file-upload-manager.js';
import { terminateAllWorkers } from '../util/workers/worker-manager.js';
import * as sceneController from '../util/scene/threejs-scene-controller.js';
import * as cameraController from '../util/scene/camera-controller.js';
import * as rigController from '../util/scene/rig/rig-controller.js';
import * as lightingManager from '../util/scene/lighting-manager.js';
import * as backgroundManager from '../util/scene/background-manager.js';
import * as modelHandler from '../util/scene/model-handler.js';
import * as textureHandler from '../util/upload/handlers/texture-file-handler.js';
import * as worldPanel from '../panels/world-panel/world-panel.js';
import * as assetPanel from '../panels/asset-panel/asset-panel.js';
import * as htmlEditorModule from '../modals/html-editor-modal/html-editor-modal.js';
import * as stateModule from '../util/state/scene-state.js';

// Debug flags
const DEBUG_LIGHTING = false;

// Component loading state tracker
const componentsLoaded = {
    worldPanel: false,
    assetPanel: false,
    settingsModal: false,
    htmlEditor: false,
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
    
    // Reset HTML editor initialization flag
    if (htmlEditorModule.resetInitialization) {
        htmlEditorModule.resetInitialization();
    }
    
    // Hide UI elements immediately
    const debugControls = document.querySelector('.debug-controls');
    if (debugControls) {
        debugControls.style.display = 'none';
    }
    
    // Force terminate any active workers
    terminateAllWorkers();
    
    // Schedule non-critical cleanup asynchronously
    setTimeout(() => {
        // Clean up World Panel event listeners
        if (worldPanel.cleanupWorldPanel) {
            worldPanel.cleanupWorldPanel();
        }
        
        // Clear all file state
        if (stateModule.clearAllFiles) {
            stateModule.clearAllFiles(true);
        }
        
        const state = stateModule.getState();
        
        // Stop animation loop
        if (state.animating && sceneController.stopAnimation) {
            sceneController.stopAnimation();
        }
        
        // Dispose ThreeJS resources
        if (state.renderer) {
            state.renderer.dispose();
            stateModule.updateState('renderer', null);
        }
        
        // Dispose of controls
        if (state.controls) {
            if (cameraController.disposeControls) {
                cameraController.disposeControls();
            }
            state.controls.dispose();
            stateModule.updateState('controls', null);
        }
        
        // Clean up scene
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
        
        // Clean up canvas elements
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
        
        // Reset UI state
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

    Promise.all([
        worldPanelPromise,
        assetPanelPromise,
        axisIndicatorPromise,
        htmlEditorPromise
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