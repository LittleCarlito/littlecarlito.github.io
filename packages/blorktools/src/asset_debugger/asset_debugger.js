/**
 * Asset Debugger Tool - Legacy Entry Point
 * 
 * This file serves as a backward-compatible entry point for the Asset Debugger tool.
 * It delegates to the modularized implementation for better maintainability.
 * 
 * For new projects, please import directly from the modular structure:
 * import { init } from './index.js';
 */

import { init, state } from './index.js';

// Export state and main functions for backward compatibility
export const scene = () => state.scene;
export const camera = () => state.camera;
export const renderer = () => state.renderer;
export const modelObject = () => state.modelObject;
export const textureObject = () => state.textureObject;

// Export the init function as default for legacy imports
export default function() {
  console.warn('Warning: You are using the legacy asset_debugger.js entry point. ' +
               'Consider upgrading to the modular version imported from index.js');
  
  // Initialize the application
  init();
  
  // Return an API for backward compatibility
  return {
    getState: () => state,
    getScene: () => state.scene,
    getCamera: () => state.camera,
    getRenderer: () => state.renderer,
    getModelObject: () => state.modelObject,
    getTextureObject: () => state.textureObject,
  };
} 