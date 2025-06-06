import * as THREE from 'three';
import { getHtmlSettingsForMesh } from '../mesh-data-util';
import { setupCSS3DScene } from './css3d-scene-helper';
import { resetAnimationState, resetReverseAnimationFrameId, reverseAnimationFrameId } from './css3d-state';

/**
* Initialize CSS3D animation renderer
* @param {HTMLElement} container - The container element for the renderers
* @param {HTMLIFrameElement} iframe - The iframe containing the HTML content
* @param {number} currentMeshId - The ID of the current mesh
* @param {boolean} createInfoPanel - Whether to create the info panel
*/
export function initCSS3DAnimation(container, iframe, currentMeshId, createInfoPanel = true) {
   import('three/examples/jsm/renderers/CSS3DRenderer.js')
       .then(module => {
           const { CSS3DRenderer, CSS3DObject } = module;
           setupCSS3DScene(container, iframe, CSS3DRenderer, CSS3DObject, currentMeshId, createInfoPanel);
       });
}

export function cleanupCSS3D(targetElement = null) {
   resetAnimationState();
   
   if (reverseAnimationFrameId) {
       cancelAnimationFrame(reverseAnimationFrameId);
       resetReverseAnimationFrameId();
   }
   
   const iframe = targetElement || document.getElementById('css3d-panel-iframe');
   if (iframe) {
       if (iframe.restartTimer) {
           clearInterval(iframe.restartTimer);
           iframe.restartTimer = null;
       }
       
       if (iframe._animationStartHandler && iframe.contentDocument) {
           iframe.contentDocument.removeEventListener('animationstart', iframe._animationStartHandler);
           iframe._animationStartHandler = null;
       }
       
       if (iframe._transitionStartHandler && iframe.contentDocument) {
           iframe.contentDocument.removeEventListener('transitionstart', iframe._transitionStartHandler);
           iframe._transitionStartHandler = null;
       }
       
       if (iframe.mutationObserver) {
           iframe.mutationObserver.disconnect();
           iframe.mutationObserver = null;
       }
   }
}