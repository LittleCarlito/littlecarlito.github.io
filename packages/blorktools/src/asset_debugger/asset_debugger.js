/**
 * Asset Debugger Tool - Legacy Entry Point
 * 
 * This file serves as a backward-compatible entry point for the Asset Debugger tool.
 * It delegates to the modularized implementation for better maintainability.
 * 
 * For new projects, please import directly from the modular structure:
 * import { init } from './index.js';
 */

// Import from index.js
import { init, state } from './index.js';
import { autoShowAtlasVisualization } from './ui/debugPanel.js';

// Listen for texture loaded event to show atlas visualization
document.addEventListener('textureLoaded', () => {
  if (state.textureObject && state.modelObject) {
    autoShowAtlasVisualization(state);
  }
});

// Listen for model loaded event to show atlas visualization
document.addEventListener('modelLoaded', () => {
  if (state.textureObject && state.modelObject) {
    autoShowAtlasVisualization(state);
  }
});

// Export state and main functions for backward compatibility
export function getExportedMethods() {
  return {
    getState: () => state,
    getScene: () => state.scene,
    getRenderer: () => state.renderer,
    getCamera: () => state.camera,
    getControls: () => state.controls,
    getModelObject: () => state.modelObject,
    getTextureObject: () => state.textureObject,
  };
} 