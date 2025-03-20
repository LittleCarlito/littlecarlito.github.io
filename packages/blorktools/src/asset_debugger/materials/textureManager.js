// Texture Manager Module
// Handles loading, managing, and applying textures to models
import * as THREE from 'three';
import { createMultiTextureMaterial } from './multiTextureMaterial.js';
import { originalUvData } from '../core/analyzer.js';
import { updateTextureInfo } from '../ui/debugPanel.js';
/**
 * Load texture from file
 * @param {Object} state - Global state object
 * @param {File} file - Texture file to load
 * @returns {Promise} - Promise that resolves when texture is loaded
 */
export async function loadTexture(state, file) {
	return new Promise((resolve, reject) => {
		if (!file) {
			reject(new Error('No texture file provided'));
			return;
		}
		// Create texture loader
		const loader = new THREE.TextureLoader();
		// Create object URL from file
		const fileUrl = URL.createObjectURL(file);
		// Load texture
		loader.load(
			fileUrl,
			(texture) => {
				console.log('Texture loaded:', texture);
				// Store texture in state
				state.textureObject = texture;
				// Configure texture
				texture.flipY = false; // Changed from true to false - matches the monitor.glb expectations
				texture.encoding = THREE.sRGBEncoding; // Ensure proper color encoding
				// Apply to model if model is already loaded
				if (state.modelLoaded && state.modelObject) {
					applyTextureToModel(state);
				}
				// Create texture info for UI
				const textureInfo = {
					name: file.name,
					size: file.size,
					dimensions: {
						width: texture.image.width,
						height: texture.image.height
					}
				};
				// Update texture info in UI
				if (updateTextureInfo) {
					updateTextureInfo(textureInfo);
				}
				// Clean up URL
				URL.revokeObjectURL(fileUrl);
				// Dispatch event for texture loaded
				document.dispatchEvent(new CustomEvent('textureLoaded'));
				resolve(texture);
			},
			undefined, // Progress callback
			(error) => {
				console.error('Error loading texture:', error);
				URL.revokeObjectURL(fileUrl);
				reject(error);
			}
		);
	});
}
/**
 * Apply loaded texture to all materials in the model
 * @param {Object} state - Global state object
 */
export function applyTextureToModel(state) {
	if (!state.modelObject || !state.textureObject) {
		console.warn('Cannot apply texture: Model or texture not loaded', {
			modelExists: !!state.modelObject,
			textureExists: !!state.textureObject
		});
		return;
	}
	console.log('Applying texture to model', state.textureObject);
	// Find all screen meshes and store their original materials
	state.modelObject.traverse((child) => {
		if (child.isMesh && child.material) {
			// Store original material for later reference
			if (!child.userData.originalMaterial) {
				child.userData.originalMaterial = child.material.clone();
			}
			// Check if this is a screen/display/monitor mesh
			const isScreenMesh = child.name.toLowerCase().includes('screen') || 
                         child.name.toLowerCase().includes('display') ||
                         child.name.toLowerCase().includes('monitor');
			if (isScreenMesh) {
				console.log(`Setting up screen mesh: ${child.name}`);
				// Log available UV sets on this mesh
				if (child.geometry) {
					let uvSetInfo = 'UV Sets: ';
					// Check for any UV attributes directly
					const potentialUvAttributes = [];
					for (let i = 0; i < 8; i++) {
						potentialUvAttributes.push(i === 0 ? 'uv' : `uv${i+1}`);
					}
					potentialUvAttributes.forEach(attrName => {
						if (child.geometry.attributes[attrName]) {
							uvSetInfo += `${attrName}, `;
						}
					});
					console.log(uvSetInfo);
				}
				// Create a fresh material to avoid affecting other meshes
				const material = new THREE.MeshStandardMaterial();
				// Copy important properties from original material if available
				if (child.userData.originalMaterial) {
					material.roughness = child.userData.originalMaterial.roughness || 0.1;
					material.metalness = child.userData.originalMaterial.metalness || 0.2;
				} else {
					material.roughness = 0.1; // Make it slightly glossy
					material.metalness = 0.2;
				}
				// Apply the texture - IMPORTANT: Clone to avoid cross-mesh references
				material.map = state.textureObject.clone();
				// Ensure texture properties are correctly set
				material.map.flipY = false; // Important for proper orientation
				material.map.encoding = THREE.sRGBEncoding;
				material.map.wrapS = THREE.ClampToEdgeWrapping;
				material.map.wrapT = THREE.ClampToEdgeWrapping;
				material.map.minFilter = THREE.LinearFilter;
				material.map.magFilter = THREE.LinearFilter;
				// Make sure screen is visible with emissive
				material.emissiveMap = material.map;
				material.emissive.set(1, 1, 1); // Full emissive intensity
				// Start with no offset/repeat modification
				material.map.offset.set(0, 0);
				material.map.repeat.set(1, 1);
				material.emissiveMap.offset.set(0, 0);
				material.emissiveMap.repeat.set(1, 1);
				// Make sure texture settings are applied
				material.map.needsUpdate = true;
				material.emissiveMap.needsUpdate = true;
				material.needsUpdate = true;
				// Apply to mesh
				child.material = material;
				// Add to state.screenMeshes for tracking
				if (!state.screenMeshes) {
					state.screenMeshes = [];
				}
				if (!state.screenMeshes.includes(child)) {
					state.screenMeshes.push(child);
				}
			}
		}
	});
	// Force a render update
	if (state.renderer && state.camera && state.scene) {
		console.log('Forcing render update');
		state.renderer.render(state.scene, state.camera);
		// Automatically show the texture atlas visualization
		try {
			// Import and call createAtlasVisualization asynchronously to avoid circular dependencies
			import('../ui/atlasVisualization.js').then(module => {
				console.log('Auto-showing texture atlas visualization');
				module.createAtlasVisualization(state);
				// Force another render to ensure atlas is visible
				if (state.renderer && state.camera && state.scene) {
					setTimeout(() => {
						state.renderer.render(state.scene, state.camera);
						console.log('Atlas visualization should now be visible');
					}, 100);
				}
			});
		} catch (error) {
			console.error('Failed to auto-show atlas visualization:', error);
		}
	}
}
/**
 * Apply texture to a specific material
 * @param {THREE.Material} material - Three.js material
 * @param {THREE.Texture} texture - Three.js texture
 */
function applyTextureToMaterial(material, texture) {
	if (!material) return;
	console.log(`Applying texture to material type: ${material.type}`);
	// Clone texture to avoid affecting other materials
	const textureClone = texture.clone();
	textureClone.needsUpdate = true;
	// Set basic properties for all material types
	material.map = textureClone;
	// For MeshStandardMaterial (most common)
	if (material.type === 'MeshStandardMaterial') {
		// Use texture for all common map types as a starting point
		material.roughnessMap = textureClone;
		material.roughness = 0.8;
		material.metalnessMap = textureClone;
		material.metalness = 0.2;
	} 
	// For MeshBasicMaterial
	else if (material.type === 'MeshBasicMaterial') {
		material.color.set(0xffffff); // Reset color to white to show texture properly
	}
	// Make sure to update the material
	material.needsUpdate = true;
}
/**
 * Toggle texture editor UI
 * @param {Object} state - Global state object
 */
export function toggleTextureEditor(state) {
	// Implementation will be in a separate file (textureEditor.js)
	console.log('Toggle texture editor requested - implementation in textureEditor.js');
	// Display a message if texture editor is not yet implemented
	alert('Texture editor will be implemented in a future update');
}
// Load additional texture (for multi-texture support)
export function loadAdditionalTexture(file, state, uvIndex = 0) {
	// Create a URL from the file
	const textureUrl = URL.createObjectURL(file);
	// Create a new texture loader
	const loader = new THREE.TextureLoader();
	// Initialize additional textures array if it doesn't exist
	if (!state.additionalTextures) {
		state.additionalTextures = [];
	}
	// Load the texture
	loader.load(textureUrl, (texture) => {
		// Set texture parameters
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		// Create a texture info object
		const textureInfo = {
			texture: texture,
			file: file,
			uvIndex: uvIndex,
			enabled: true,
			blendMode: 'normal',  // normal, add, multiply, etc.
			intensity: 1.0
		};
		// Add to additional textures array
		state.additionalTextures.push(textureInfo);
		// If in multi-texture mode, update the material
		if (state.multiTextureMode) {
			applyMultiTextureMaterial(state);
		}
		// Revoke the object URL to free up memory
		URL.revokeObjectURL(textureUrl);
		console.log('Added additional texture:', textureInfo);
	}, 
	undefined, // onProgress callback not needed
	(error) => {
		console.error('Error loading additional texture:', error);
		alert('Error loading the additional texture file. Please try a different file.');
	});
}
// Remove a texture from additional textures
export function removeTexture(index, state) {
	if (!state.additionalTextures || index >= state.additionalTextures.length) return;
	// Remove the texture at the specified index
	state.additionalTextures.splice(index, 1);
	// If in multi-texture mode, update the material
	if (state.multiTextureMode) {
		applyMultiTextureMaterial(state);
	}
	console.log('Removed texture at index:', index);
}
// Update texture settings (uvIndex, enabled, blendMode, intensity)
export function updateTextureSettings(index, settings, state) {
	if (!state.additionalTextures || index >= state.additionalTextures.length) return;
	// Update the settings for the texture
	const textureInfo = state.additionalTextures[index];
	Object.assign(textureInfo, settings);
	// If in multi-texture mode, update the material
	if (state.multiTextureMode) {
		applyMultiTextureMaterial(state);
	}
	console.log('Updated texture settings at index:', index, settings);
}
// Apply multi-texture material to the model
export function applyMultiTextureMaterial(state) {
	if (!state.modelObject) return;
	// Get all active textures
	const activeTextures = [
		{ texture: state.textureObject, uvIndex: 0, enabled: true, blendMode: 'normal', intensity: 1.0 }
	];
	if (state.additionalTextures) {
		// Add enabled additional textures
		state.additionalTextures.forEach(texInfo => {
			if (texInfo.enabled) {
				activeTextures.push(texInfo);
			}
		});
	}
	// Apply multi-texture material to all meshes
	state.modelObject.traverse((node) => {
		if (node.isMesh) {
			// Save original UV data if not already saved
			const geometry = node.geometry;
			if (geometry && geometry.getAttribute('uv')) {
				// Store original UV data if not already stored
				activeTextures.forEach(texInfo => {
					if (texInfo.uvIndex > 0 && !originalUvData.has(node)) {
						const originalUv = geometry.getAttribute('uv').clone();
						originalUvData.set(node, originalUv);
					}
				});
				// Create and apply custom shader material
				node.material = createMultiTextureMaterial(activeTextures, node, state);
			}
		}
	});
	console.log('Applied multi-texture material with textures:', activeTextures);
} 