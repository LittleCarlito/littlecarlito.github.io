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
import { init } from './index.js';
import { analyzeUvChannels, createDebugPanel } from './ui/debugPanel.js';
import { createUvChannelPanel, updateUvChannelPanel } from './ui/uvChannelPanel.js';
import { createAtlasVisualization, updateAtlasVisualization } from './ui/atlasVisualization.js';
import { createRigVisualization, updateRigVisualization } from './ui/rigVisualization.js';

// Initialize or modify global state object
if (!window.assetDebuggerState) {
	window.assetDebuggerState = {
		camera: null,
		controls: null,
		renderer: null,
		scene: null,
		screenMeshes: [],
		modelLoaded: false,
		textureLoaded: false,
		
		// New multi-texture support
		textureFiles: {
			baseColor: null,
			orm: null,
			normal: null
		},
		textureObjects: {}, // Will store textures by type: baseColor, orm, normal
		
		// For backwards compatibility
		textureObject: null,
		textureFile: null,
		
		// State tracking
		currentUvRegion: { min: [0, 0], max: [1, 1] },
		isDebugMode: false
	};
}

// Use the global state
const state = window.assetDebuggerState;

// Initialize debug logging
console.log('Asset Debugger entry point loaded, setting up event listeners');

// Initialize all panels at startup - this ensures they're visible immediately
document.addEventListener('DOMContentLoaded', () => {
	console.log('DOM loaded, initializing all panels');
	// Create Asset Debug Info panel
	createDebugPanel(state);
	// Create UV Channel panel
	createUvChannelPanel(state);
	// Create Atlas Visualization panel
	createAtlasVisualization(state);
	// Create Rig Visualization panel
	createRigVisualization(state);
});

// Listen for texture loaded event
document.addEventListener('textureLoaded', (event) => {
	const source = event.detail?.source || 'unknown';
	const textureType = event.detail?.textureType || 'baseColor';
	console.log(`Texture loaded event received from ${source} for type ${textureType}`);
	console.log('State when texture loaded:', {
		textureObjects: state.textureObjects ? Object.keys(state.textureObjects).join(', ') : 'None',
		textureObject: state.textureObject ? 'Available' : 'Missing',
		modelObject: state.modelObject ? 'Available' : 'Missing',
		textureLoaded: state.textureLoaded,
		modelLoaded: state.modelLoaded
	});
	
	// Always update the texture visualization when a texture is loaded
	console.log('Updating atlas visualization with texture');
	updateAtlasVisualization(state);
	
	// REMOVED AUTO-APPLICATION: This was causing textures to be applied automatically
	// We now only apply textures when "Start debugging" is explicitly pressed
	// If we have a model loaded, reapply all textures
	// if (state.modelObject) {
	//     console.log('Model is loaded - applying all available textures');
	//     // Import dynamically to avoid circular dependencies
	//     import('./materials/textureManager.js').then(module => {
	//         module.applyTextureToModel(state);
	//     });
	// }
	console.log('Texture loaded - WAITING for Start Debugging button to apply textures');
	
	// Update debug panel's texture info via global function if available
	if (state.updateTextureInfo) {
		// Get the appropriate texture file for the loaded type
		const textureFile = textureType === 'baseColor' ? 
			(state.textureFiles.baseColor || state.textureFile) : 
			state.textureFiles[textureType];
			
		if (textureFile) {
			console.log(`Updating texture info in debug panel for ${textureType}`);
			state.updateTextureInfo({
				name: textureFile.name,
				size: textureFile.size,
				type: textureType,
				dimensions: state.textureObjects[textureType] ? {
					width: state.textureObjects[textureType].image.width,
					height: state.textureObjects[textureType].image.height
				} : undefined
			});
		} else {
			console.warn(`Cannot update texture info - missing file for ${textureType}`);
		}
	} else {
		console.warn('Cannot update texture info - missing updateTextureInfo', {
			updateTextureInfo: !!state.updateTextureInfo
		});
	}
	
	// If model is already loaded, analyze UV channels
	if (state.modelObject) {
		console.log('Model already loaded, analyzing UV channels and updating panels');
		analyzeUvChannels(state);
		updateUvChannelPanel(state);
	} else {
		console.log('No model loaded yet, skipping UV analysis');
	}
});

// Listen for model loaded event
document.addEventListener('modelLoaded', (event) => {
	console.log('Model loaded event received');
	console.log('State when model loaded:', {
		textureObject: state.textureObject ? 'Available' : 'Missing',
		modelObject: state.modelObject ? 'Available' : 'Missing',
		textureLoaded: state.textureLoaded,
		modelLoaded: state.modelLoaded
	});
	
	// Update model info via global function if available
	if (state.updateModelInfo && state.modelFile) {
		console.log('Updating model info in debug panel');
		state.updateModelInfo({
			name: state.modelFile.name,
			size: state.modelFile.size,
			uvSets: state.availableUvSets || [],
			meshes: state.modelObject ? getMeshesFromModel(state.modelObject) : []
		});
	} else {
		console.warn('Cannot update model info - missing updateModelInfo or modelFile', {
			updateModelInfo: !!state.updateModelInfo,
			modelFile: !!state.modelFile
		});
	}
	
	// Always analyze UV channels when a model is loaded
	console.log('Analyzing UV channels for new model');
	analyzeUvChannels(state);
	console.log('Updating UV channel panel with analyzed data');
	updateUvChannelPanel(state);
	
	// Update atlas visualization if texture is already loaded
	if (state.textureObject) {
		console.log('Texture already loaded, updating atlas visualization');
		updateAtlasVisualization(state);
	} else {
		console.log('No texture loaded yet, skipping atlas visualization update');
	}
	
	// Always update rig visualization when a model is loaded
	console.log('Updating rig visualization with model data');
	updateRigVisualization(state);
});

// Helper function to get meshes from model
/**
 *
 */
function getMeshesFromModel(model) {
	console.log('Getting meshes from model:', model ? 'Model available' : 'No model');
	
	const meshes = [];
	if (!model) return meshes;
	
	try {
		// Safely traverse the model
		model.traverse((child) => {
			if (child.isMesh) {
				console.log('Found mesh:', child.name || 'Unnamed mesh');
				meshes.push(child);
			}
		});
		
		console.log(`Total meshes found: ${meshes.length}`);
	} catch (error) {
		console.error('Error traversing model:', error);
	}
	
	return meshes;
}

// Export state and main functions for backward compatibility
/**
 *
 */
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