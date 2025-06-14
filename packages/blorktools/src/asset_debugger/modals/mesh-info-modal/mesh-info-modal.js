/**
 * Mesh Info Modal
 * 
 * This module handles the functionality of the mesh info modal.
 * It displays detailed information about a selected mesh.
 */

import * as THREE from 'three';
import { getState } from '../../util/state/scene-state.js';
import { getHtmlSettingsForMesh } from '../../util/data/mesh-html-manager.js';
import { CSS3DDebugController } from '../../util/scene/css3d-debug-controller.js';

let listenersInitialized = false;
let css3dDebugController = null;

export async function openMeshInfoModal(meshName, meshId) {
    console.log(`openMeshInfoModal called for mesh: ${meshName} (ID: ${meshId})`);
    
    const container = document.getElementById('mesh-info-modal-container');
    const modal = document.getElementById('mesh-info-modal');
    
    console.log('DOM state check:', {
        containerExists: !!container,
        containerHasContent: container ? container.innerHTML.length > 0 : false,
        modalExists: !!modal,
        modalParent: modal ? modal.parentNode?.id : 'no parent'
    });
    
    try {
        if (!modal) {
            console.error('Mesh Info Modal element not found in the DOM');
            console.error('Available modal-related elements:', 
                Array.from(document.querySelectorAll('[id*="modal"]')).map(el => el.id));
            alert('Error: Could not find Mesh Info Modal. Please try again.');
            return;
        }
        
        const meshNameEl = document.getElementById('mesh-info-mesh-name');
        const contentEl = document.getElementById('mesh-info-content');
        
        console.log('Found all required modal elements:', {
            modal: !!modal,
            meshNameEl: !!meshNameEl,
            contentEl: !!contentEl
        });
        
        if (meshNameEl) meshNameEl.textContent = meshName;
        
        modal.dataset.meshId = meshId;
        
        const infoContent = generateMeshInfoContent(meshId);
        if (contentEl) contentEl.innerHTML = infoContent;
        
        updateDebugButtonStates(meshId);
        
        modal.classList.add('visible');
        console.log('Mesh Info Modal opened successfully');
        
        try {
            const htmlSettings = await getHtmlSettingsForMesh(meshId);
            const placeholder = document.getElementById(`html-settings-placeholder-${meshId}`);
            if (placeholder) {
                let htmlSettingsContent = '';
                if (htmlSettings && Object.keys(htmlSettings).length > 0) {
                    htmlSettingsContent = `
                        <div class="info-row"><span class="info-label">Render Mode:</span> <span class="info-value">${htmlSettings.previewMode || 'threejs'}</span></div>
                        <div class="info-row"><span class="info-label">Playback Speed:</span> <span class="info-value">${htmlSettings.playbackSpeed || '1.0'}</span></div>
                        <div class="info-row"><span class="info-label">Animation:</span> <span class="info-value">${htmlSettings.animation?.type || 'none'}</span></div>
                        <div class="info-row"><span class="info-label">Show Borders:</span> <span class="info-value">${htmlSettings.display?.showBorders !== false ? 'Yes' : 'No'}</span></div>
                        <div class="info-row"><span class="info-label">Display on Mesh:</span> <span class="info-value">${htmlSettings.display?.displayOnMesh === true ? 'Yes' : 'No'}</span></div>
                        <div class="info-row"><span class="info-label">Rig Control Node:</span> <span class="info-value">${htmlSettings.display?.rigControlNode === true ? 'Yes' : 'No'}</span></div>
                    `;
                } else {
                    htmlSettingsContent = '<div class="info-row">No HTML settings configured</div>';
                }
                placeholder.innerHTML = htmlSettingsContent;
            }
        } catch (error) {
            console.error('Error loading HTML settings:', error);
            const placeholder = document.getElementById(`html-settings-placeholder-${meshId}`);
            if (placeholder) {
                placeholder.innerHTML = '<div class="info-row">Error loading HTML settings</div>';
            }
        }
        
    } catch (error) {
        console.error('Error opening Mesh Info Modal:', error);
        alert('Failed to open Mesh Info Modal. See console for details.');
    }
}

function updateDebugButtonStates(meshId) {
    updateDebugTextureButtonState(meshId);
    updateCSS3DDebugButtonState(meshId);
}

function updateDebugTextureButtonState(meshId) {
    const debugBtn = document.getElementById('mesh-info-debug-texture');
    if (!debugBtn) return;
    
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        debugBtn.textContent = 'Enable Debug Texture';
        debugBtn.disabled = true;
        return;
    }
    
    debugBtn.disabled = false;
    
    const hasDebugTexture = mesh.userData && mesh.userData.hasDebugTexture;
    
    if (hasDebugTexture) {
        debugBtn.textContent = 'Disable Debug Texture';
        debugBtn.classList.add('debug-active');
    } else {
        debugBtn.textContent = 'Enable Debug Texture';
        debugBtn.classList.remove('debug-active');
    }
}

function updateCSS3DDebugButtonState(meshId) {
    const css3dBtn = document.getElementById('mesh-info-css3d-debug');
    if (!css3dBtn) return;
    
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        css3dBtn.textContent = 'Enable CSS3D Debug';
        css3dBtn.disabled = true;
        return;
    }
    
    const isDisplayMesh = mesh.name && mesh.name.toLowerCase().includes('display');
    
    if (!isDisplayMesh) {
        css3dBtn.textContent = 'Enable CSS3D Debug';
        css3dBtn.disabled = true;
        css3dBtn.title = 'CSS3D Debug only available for display meshes';
        return;
    }
    
    css3dBtn.disabled = false;
    css3dBtn.title = 'Toggle CSS3D Debug Frame';
    
    const hasCSS3DDebug = css3dDebugController && css3dDebugController.isActive();
    
    if (hasCSS3DDebug) {
        css3dBtn.textContent = 'Disable CSS3D Debug';
        css3dBtn.classList.add('debug-active');
    } else {
        css3dBtn.textContent = 'Enable CSS3D Debug';
        css3dBtn.classList.remove('debug-active');
    }
}

function handleDebugTextureToggle() {
    const modal = document.getElementById('mesh-info-modal');
    const meshId = parseInt(modal.dataset.meshId);
    
    if (isNaN(meshId)) {
        console.error('Invalid mesh ID');
        return;
    }
    
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        console.error(`Mesh not found at index ${meshId}`);
        return;
    }
    
    const hasDebugTexture = mesh.userData && mesh.userData.hasDebugTexture;
    
    if (hasDebugTexture) {
        disableDebugTexture(meshId);
    } else {
        enableDebugTexture(meshId);
    }
    
    updateDebugTextureButtonState(meshId);
}

function handleCSS3DDebugToggle() {
    const modal = document.getElementById('mesh-info-modal');
    const meshId = parseInt(modal.dataset.meshId);
    
    if (isNaN(meshId)) {
        console.error('Invalid mesh ID');
        return;
    }
    
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        console.error(`Mesh not found at index ${meshId}`);
        return;
    }
    
    const isDisplayMesh = mesh.name && mesh.name.toLowerCase().includes('display');
    
    if (!isDisplayMesh) {
        console.error('CSS3D Debug is only available for display meshes');
        return;
    }
    
    const isActive = css3dDebugController && css3dDebugController.isActive();
    
    if (isActive) {
        disableCSS3DDebug();
    } else {
        enableCSS3DDebug();
    }
    
    updateCSS3DDebugButtonState(meshId);
}

function enableCSS3DDebug() {
    try {
        if (!css3dDebugController) {
            css3dDebugController = new CSS3DDebugController();
        }
        
        if (css3dDebugController.isActive()) {
            console.log('CSS3D Debug already active');
            return;
        }
        
        const mainContainer = document.getElementById('main-container') || document.body;
        css3dDebugController.init(mainContainer);
        
        console.log('CSS3D Debug enabled');
    } catch (error) {
        console.error('Error enabling CSS3D Debug:', error);
    }
}

function disableCSS3DDebug() {
    try {
        if (css3dDebugController && css3dDebugController.isActive()) {
            css3dDebugController.cleanup();
            console.log('CSS3D Debug disabled');
        }
    } catch (error) {
        console.error('Error disabling CSS3D Debug:', error);
    }
}

function enableDebugTexture(meshId) {
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh || !mesh.material) {
        console.error('Cannot enable debug texture: mesh or material not found');
        return;
    }
    
    if (!mesh.userData.originalMaterial) {
        if (Array.isArray(mesh.material)) {
            mesh.userData.originalMaterial = mesh.material.map(mat => mat.clone());
        } else {
            mesh.userData.originalMaterial = mesh.material.clone();
        }
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.fillStyle = '#ffff00';
    for (let i = 0; i < 512; i += 64) {
        ctx.fillRect(i, 0, 32, 512);
    }
    
    const debugTexture = new THREE.CanvasTexture(canvas);
    debugTexture.encoding = THREE.sRGBEncoding;
    debugTexture.wrapS = THREE.RepeatWrapping;
    debugTexture.wrapT = THREE.RepeatWrapping;
    debugTexture.needsUpdate = true;
    
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(material => {
            material.map = debugTexture;
            material.color = new THREE.Color(0xffffff);
            material.needsUpdate = true;
        });
    } else {
        mesh.material.map = debugTexture;
        mesh.material.color = new THREE.Color(0xffffff);
        mesh.material.needsUpdate = true;
    }
    
    mesh.userData.hasDebugTexture = true;
    
    console.log(`Debug texture enabled for mesh ${meshId}`);
}

function disableDebugTexture(meshId) {
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        console.error('Cannot disable debug texture: mesh not found');
        return;
    }
    
    if (mesh.userData.originalMaterial) {
        if (Array.isArray(mesh.userData.originalMaterial)) {
            mesh.material = mesh.userData.originalMaterial.map(mat => mat.clone());
        } else {
            mesh.material = mesh.userData.originalMaterial.clone();
        }
    } else {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(material => {
                material.map = null;
                material.color = new THREE.Color(0xcccccc);
                material.needsUpdate = true;
            });
        } else {
            mesh.material.map = null;
            mesh.material.color = new THREE.Color(0xcccccc);
            mesh.material.needsUpdate = true;
        }
    }
    
    mesh.userData.hasDebugTexture = false;
    
    console.log(`Debug texture disabled for mesh ${meshId}`);
}

function generateMeshInfoContent(meshId) {
    const state = getState();
    const mesh = state.meshes ? state.meshes[meshId] : null;
    
    if (!mesh) {
        return '<div class="info-section">Mesh not found</div>';
    }
    
    const sections = [];
    
    sections.push(`
        <div class="info-section">
            <strong>Basic Information</strong>
            <div class="info-row"><span class="info-label">Name:</span> <span class="info-value">${mesh.name || 'Unnamed'}</span></div>
            <div class="info-row"><span class="info-label">ID:</span> <span class="info-value">${meshId}</span></div>
            <div class="info-row"><span class="info-label">Visible:</span> <span class="info-value">${mesh.visible ? 'Yes' : 'No'}</span></div>
        </div>
    `);
    
    let dimensionsContent = '';
    if (mesh.geometry) {
        if (!mesh.geometry.boundingBox) {
            mesh.geometry.computeBoundingBox();
        }
        
        if (mesh.geometry.boundingBox) {
            const box = mesh.geometry.boundingBox;
            const width = box.max.x - box.min.x;
            const height = box.max.y - box.min.y;
            const depth = box.max.z - box.min.z;
            
            dimensionsContent = `
                <div class="info-row"><span class="info-label">Width (X):</span> <span class="info-value transform-value">${width.toFixed(3)}</span></div>
                <div class="info-row"><span class="info-label">Height (Y):</span> <span class="info-value transform-value">${height.toFixed(3)}</span></div>
                <div class="info-row"><span class="info-label">Depth (Z):</span> <span class="info-value transform-value">${depth.toFixed(3)}</span></div>
            `;
        } else {
            dimensionsContent = '<div class="info-row">Unable to calculate dimensions</div>';
        }
    } else {
        dimensionsContent = '<div class="info-row">No geometry data available</div>';
    }
    
    sections.push(`
        <div class="info-section">
            <strong>Dimensions</strong>
            ${dimensionsContent}
        </div>
    `);
    
    let geometryContent = '';
    if (mesh.geometry) {
        const vertexCount = mesh.geometry.attributes && mesh.geometry.attributes.position ? 
            mesh.geometry.attributes.position.count : 'Unknown';
        
        let faceCount = 'Unknown';
        if (mesh.geometry.index) {
            faceCount = Math.floor(mesh.geometry.index.count / 3);
        } else if (mesh.geometry.attributes && mesh.geometry.attributes.position) {
            faceCount = Math.floor(mesh.geometry.attributes.position.count / 3);
        }
        
        geometryContent = `
            <div class="geometry-info">
                <div class="info-row"><span class="info-label">Type:</span> <span class="info-value">${mesh.geometry.type || 'Unknown'}</span></div>
                <div class="info-row"><span class="info-label">Vertices:</span> <span class="info-value">${vertexCount}</span></div>
                <div class="info-row"><span class="info-label">Faces:</span> <span class="info-value">${faceCount}</span></div>
            </div>
        `;
    } else {
        geometryContent = '<div class="info-row">No geometry data available</div>';
    }
    
    sections.push(`
        <div class="info-section">
            <strong>Geometry</strong>
            ${geometryContent}
        </div>
    `);
    
    let materialContent = '';
    if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        materialContent = `<div class="material-info">`;
        materialContent += `<div class="info-row"><span class="info-label">Count:</span> <span class="info-value">${materials.length}</span></div>`;
        
        materials.forEach((material, index) => {
            if (materials.length > 1) {
                materialContent += `<div class="info-row" style="margin-top: 10px;"><strong>Material ${index + 1}:</strong></div>`;
            }
            
            materialContent += `<div class="info-row"><span class="info-label">Type:</span> <span class="info-value">${material.type || 'Unknown'}</span></div>`;
            materialContent += `<div class="info-row"><span class="info-label">Double Sided:</span> <span class="info-value">${material.side === THREE.DoubleSide ? 'Yes' : 'No'}</span></div>`;
            materialContent += `<div class="info-row"><span class="info-label">Transparent:</span> <span class="info-value">${material.transparent ? 'Yes' : 'No'}</span></div>`;
            
            if (material.color) {
                const colorHex = '#' + material.color.getHexString();
                materialContent += `<div class="info-row"><span class="info-label">Color:</span> <span class="color-swatch" style="background-color:${colorHex}"></span><span class="info-value">${colorHex}</span></div>`;
            }
        });
        
        materialContent += `</div>`;
    } else {
        materialContent = '<div class="info-row">No material data available</div>';
    }
    
    sections.push(`
        <div class="info-section">
            <strong>Material</strong>
            ${materialContent}
        </div>
    `);
    
    const transformContent = `
        <div class="info-row">
            <span class="info-label">Position:</span> 
            X:<span class="transform-value">${mesh.position.x.toFixed(3)}</span>
            Y:<span class="transform-value">${mesh.position.y.toFixed(3)}</span>
            Z:<span class="transform-value">${mesh.position.z.toFixed(3)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Rotation:</span> 
            X:<span class="transform-value">${(mesh.rotation.x * 180 / Math.PI).toFixed(1)}°</span>
            Y:<span class="transform-value">${(mesh.rotation.y * 180 / Math.PI).toFixed(1)}°</span>
            Z:<span class="transform-value">${(mesh.rotation.z * 180 / Math.PI).toFixed(1)}°</span>
        </div>
        <div class="info-row">
            <span class="info-label">Scale:</span> 
            X:<span class="transform-value">${mesh.scale.x.toFixed(3)}</span>
            Y:<span class="transform-value">${mesh.scale.y.toFixed(3)}</span>
            Z:<span class="transform-value">${mesh.scale.z.toFixed(3)}</span>
        </div>
    `;
    
    sections.push(`
        <div class="info-section">
            <strong>Transform</strong>
            ${transformContent}
        </div>
    `);
    
    sections.push(`
        <div class="info-section">
            <strong>HTML Settings</strong>
            <div id="html-settings-placeholder-${meshId}" class="html-settings-info">
                <div class="info-row">Loading...</div>
            </div>
        </div>
    `);
    
    
    return sections.join('');
}

export function initMeshInfoModal() {
    console.log('Initializing Mesh Info Modal');
    
    const modal = document.getElementById('mesh-info-modal');
    const closeBtn = document.getElementById('mesh-info-close');
    const okBtn = document.getElementById('mesh-info-ok');
    const debugBtn = document.getElementById('mesh-info-debug-texture');
    const css3dBtn = document.getElementById('mesh-info-css3d-debug');
    
    window.openMeshInfoModal = openMeshInfoModal;
    console.log('Registered global function: window.openMeshInfoModal =', 
                typeof window.openMeshInfoModal === 'function' ? 'Function successfully registered' : 'Failed to register function');

    if (!modal) {
        console.error('Mesh Info Modal not found in the DOM');
        return;
    }

    if (listenersInitialized) {
        console.log('Mesh Info Modal event listeners already initialized, skipping');
        return;
    }

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);
    
    if (debugBtn) {
        debugBtn.addEventListener('click', handleDebugTextureToggle);
    }
    
    if (css3dBtn) {
        css3dBtn.addEventListener('click', handleCSS3DDebugToggle);
    }
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    listenersInitialized = true;
    console.log('Mesh Info Modal event listeners initialized successfully');
}

function closeModal() {
    const modal = document.getElementById('mesh-info-modal');
    modal.classList.remove('visible');
    console.log('Mesh Info Modal closed');
}

export function resetInitialization() {
    listenersInitialized = false;
    console.log('Mesh Info Modal initialization flag reset');
}