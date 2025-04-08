// Texture Manager Module
// Handles loading, managing, and applying textures to models
import * as THREE from 'three';
import { createMultiTextureMaterial } from './multiTextureMaterial.js';
import { originalUvData } from '../core/analyzer.js';
import { updateTextureInfo } from '../ui/debugPanel.js';
import { checkLoadingComplete } from '../core/loader.js';

// Flag to prevent auto-application of textures when loaded
let blockAutoTextureApplication = true;

/**
 * Load a texture from a file or URL - ONLY CACHES, DOESN'T APPLY
 * @param {Object} state - Global state object
 * @param {File|String} file - File object or URL string
 * @param {String} textureType - Type of texture (baseColor, orm, normal)
 * @returns {Promise} Promise that resolves to the loaded texture
 */
export function loadTexture(state, file, textureType = 'baseColor') {
	console.log(`loadTexture called with file: ${file ? file.name : 'unknown'}, type: ${textureType}`);
	
	return new Promise((resolve, reject) => {
		if (!file) {
			reject(new Error('No texture file provided'));
			return;
		}
		
		// IMPORTANT: Intercept and block any texture application in other parts of the code
		const originalModelObject = state.modelObject;
		const originalApplyTextureToModel = state.applyTextureToModel;
		
		// Temporarily null out model object and texture application functions to prevent auto-application
		if (blockAutoTextureApplication) {
			state.modelObject = null;
			state.applyTextureToModel = null;
			state._blockingAutoTextureApplication = true;
			console.log('!!!BLOCKED AUTO TEXTURE APPLICATION!!!');
		}
		
		// Create texture loader
		const loader = new THREE.TextureLoader();
		// Create object URL from file
		const fileUrl = URL.createObjectURL(file);
		// Load texture
		loader.load(
			fileUrl,
			(texture) => {
				console.log(`Texture loaded for ${textureType}:`, texture);
				
				// Initialize textureObjects if it doesn't exist
				if (!state.textureObjects) {
					state.textureObjects = {};
				}
				
				// Important: Make sure the textures are stored in the global state
				state.textureObjects[textureType] = texture;
				console.log(`>>> STORED ${textureType} TEXTURE IN state.textureObjects`);
				
				// For backward compatibility, also store baseColor as textureObject
				if (textureType === 'baseColor') {
					state.textureObject = texture;
					console.log(">>> STORED baseColor AS textureObject IN STATE");
				}
				
				// Configure texture
				texture.flipY = false;
				
				// Set encoding based on texture type
				if (textureType === 'baseColor') {
					texture.encoding = THREE.sRGBEncoding;
				} else {
					texture.encoding = THREE.LinearEncoding;
				}
				
				// Create texture info for UI
				const textureInfo = {
					name: file.name,
					size: file.size,
					type: textureType,
					dimensions: {
						width: texture.image.width,
						height: texture.image.height
					}
				};
				
				// Update texture info in UI
				if (updateTextureInfo) {
					updateTextureInfo(textureInfo);
				}
				
				// Also store the texture directly in window for emergency access
				if (!window.debugTextures) {
					window.debugTextures = {};
				}
				window.debugTextures[textureType] = texture;
				
				// Clean up URL
				URL.revokeObjectURL(fileUrl);
				
				// Restore original model object and function AFTER textures are loaded
				if (blockAutoTextureApplication) {
					state.modelObject = originalModelObject;
					state.applyTextureToModel = originalApplyTextureToModel;
					state._blockingAutoTextureApplication = false;
					console.log('!!!RESTORED MODEL OBJECT AND FUNCTIONS AFTER TEXTURE LOAD!!!');
				}
				
				// Dispatch event for texture loaded
				console.log(`Dispatching textureLoaded event with ${textureType} texture - NO MATERIAL APPLIED YET`);
				document.dispatchEvent(new CustomEvent('textureLoaded', { 
					detail: { 
						source: 'file',
						textureType: textureType
					}
				}));
				
				resolve(texture);
			},
			undefined, // Progress callback
			(error) => {
				console.error(`Error loading ${textureType} texture:`, error);
				URL.revokeObjectURL(fileUrl);
				
				// Restore original model object and function even if there's an error
				if (blockAutoTextureApplication) {
					state.modelObject = originalModelObject;
					state.applyTextureToModel = originalApplyTextureToModel;
					state._blockingAutoTextureApplication = false;
				}
				
				reject(error);
			}
		);
	});
}

/**
 * Apply loaded textures to all materials in the model - ONLY CALLED ON START DEBUGGING
 * @param {Object} state - Global state object
 */
export function applyTextureToModel(state) {
	console.log('START DEBUGGING PRESSED - APPLYING TEXTURES NOW');
	console.log('CURRENT STATE:', state);
	
	if (!state.modelObject) {
		console.warn('Cannot apply texture: Model not loaded');
		return;
	}
	
	console.log('TEXTURES IN STATE:', state.textureObjects);
	console.log('WINDOW DEBUG TEXTURES:', window.debugTextures);
	
	// CRITICAL FIX: If state.textureObjects doesn't exist or is empty, try to recover textures
	if (!state.textureObjects || Object.keys(state.textureObjects).length === 0) {
		console.warn('No textures found in state.textureObjects - trying recovery options');
		
		// Attempt to recover textures from window debug storage
		if (window.debugTextures && Object.keys(window.debugTextures).length > 0) {
			console.log('RECOVERY: Found textures in window.debugTextures, using those');
			state.textureObjects = window.debugTextures;
		}
		// Backward compatibility
		else if (state.textureObject) {
			console.log('RECOVERY: Found texture in state.textureObject, using as baseColor');
			state.textureObjects = {
				baseColor: state.textureObject
			};
		}
	}
	
	if (!state.textureObjects || Object.keys(state.textureObjects).length === 0) {
		console.error('CRITICAL: No textures found even after recovery attempts!');
		console.error('state object:', state);
		alert('No textures found. Please try again.');
		return;
	}
	
	// Check available textures with explicit logging
	const hasBaseColor = !!state.textureObjects.baseColor;
	const hasNormal = !!state.textureObjects.normal;
	const hasOrm = !!state.textureObjects.orm;
	
	// Log available textures at time of application
	console.log('Creating materials with textures:', {
		baseColor: hasBaseColor ? 'Available' : 'Missing',
		orm: hasOrm ? 'Available' : 'Missing',
		normal: hasNormal ? 'Available' : 'Missing'
	});
	
	if (hasBaseColor) console.log('baseColor texture:', state.textureObjects.baseColor);
	if (hasOrm) console.log('orm texture:', state.textureObjects.orm);
	if (hasNormal) console.log('normal texture:', state.textureObjects.normal);
	
	// Initialize screen meshes array if not exists
	if (!state.screenMeshes) {
		state.screenMeshes = [];
	}
	
	// First, reset all materials to their original state
	console.log('RESETTING ALL MATERIALS BEFORE APPLYING NEW TEXTURES');
	state.modelObject.traverse((child) => {
		if (child.isMesh && child.userData.originalMaterial) {
			child.material = child.userData.originalMaterial.clone();
			console.log(`Reset material for mesh: ${child.name}`);
		}
	});
	
	let meshesProcessed = 0;
	let meshesTextured = 0;
	
	// Now apply new materials with all textures
	console.log('APPLYING NEW MATERIALS WITH ALL TEXTURES');
	state.modelObject.traverse((child) => {
		if (child.isMesh && child.material) {
			meshesProcessed++;
			
			// Store original material for later reference if not already stored
			if (!child.userData.originalMaterial) {
				child.userData.originalMaterial = child.material.clone();
			}
			
			console.log(`Processing mesh: ${child.name}`);
			
			// CRITICAL: Set up UV2 for aoMap to work correctly
			if (!child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
				console.log(`Creating UV2 coordinates for mesh: ${child.name}`);
				child.geometry.setAttribute('uv2', child.geometry.attributes.uv.clone());
			}
			
			// PREPARE ALL TEXTURES FIRST - with clear logging of what we're using
			// Clone textures to ensure no shared references
			const baseColorMap = hasBaseColor ? state.textureObjects.baseColor.clone() : null;
			const normalMap = hasNormal ? state.textureObjects.normal.clone() : null;
			const ormMap = hasOrm ? state.textureObjects.orm.clone() : null;
			
			console.log(`Textures for ${child.name}:`, {
				baseColorMap: baseColorMap ? 'Created' : 'Missing',
				normalMap: normalMap ? 'Created' : 'Missing', 
				ormMap: ormMap ? 'Created' : 'Missing'
			});
			
			if (baseColorMap) {
				baseColorMap.flipY = false;
				baseColorMap.encoding = THREE.sRGBEncoding;
				baseColorMap.generateMipmaps = true;
				baseColorMap.minFilter = THREE.LinearMipmapLinearFilter;
				baseColorMap.magFilter = THREE.LinearFilter;
				baseColorMap.needsUpdate = true;
				if (state.renderer) {
					baseColorMap.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
				}
			}
			
			if (normalMap) {
				normalMap.flipY = false;
				normalMap.encoding = THREE.LinearEncoding;
				normalMap.generateMipmaps = true;
				normalMap.minFilter = THREE.LinearMipmapLinearFilter;
				normalMap.magFilter = THREE.LinearFilter;
				normalMap.needsUpdate = true;
				if (state.renderer) {
					normalMap.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
				}
			}
			
			if (ormMap) {
				ormMap.flipY = false;
				ormMap.encoding = THREE.LinearEncoding;
				ormMap.generateMipmaps = true;
				ormMap.minFilter = THREE.LinearMipmapLinearFilter;
				ormMap.magFilter = THREE.LinearFilter;
				ormMap.needsUpdate = true;
				if (state.renderer) {
					ormMap.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
				}
			}
			
			// CREATE MATERIAL EXACTLY LIKE WORKING EXAMPLE
			console.log(`Creating material for mesh: ${child.name}`);
			const material = new THREE.MeshStandardMaterial({
				map: baseColorMap,
				normalMap: normalMap,
				aoMap: ormMap,
				roughnessMap: ormMap,
				metalnessMap: ormMap,
				roughness: 1.0,
				metalness: 1.0
			});
			
			// Force material update
			material.needsUpdate = true;
			
			// Apply the material to the mesh
			child.material = material;
			
			// Add to screen meshes array for reference
			if (!state.screenMeshes.includes(child)) {
				state.screenMeshes.push(child);
			}
			
			meshesTextured++;
			console.log(`Successfully applied textures to mesh: ${child.name}`);
		}
	});
	
	// Log a summary of what was applied
	console.log('Texture application summary:', {
		meshesProcessed,
		meshesTextured,
		availableTextures: Object.keys(state.textureObjects).length
	});
	
	// Try to hide loading elements now that textures are applied
	checkLoadingComplete(state);
	
	// Hide loading text that might be visible
	const loadingTexts = document.querySelectorAll('.loading-text');
	loadingTexts.forEach(el => el.style.display = 'none');
	
	// Ensure renderer is visible
	if (state.renderer && state.renderer.domElement) {
		state.renderer.domElement.style.display = 'block';
	}
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