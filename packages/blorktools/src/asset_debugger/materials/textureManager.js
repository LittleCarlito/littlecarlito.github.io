// Texture Manager Module
// Handles loading, managing, and applying textures to models
import * as THREE from 'three';
import { createMultiTextureMaterial } from './multiTextureMaterial.js';
import { originalUvData } from '../core/analyzer.js';
import { updateTextureInfo } from '../ui/debugPanel.js';
import { checkLoadingComplete } from '../core/loader.js';

/**
 * Load a texture from a file or URL
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
				
				// Store texture in state based on type
				state.textureObjects[textureType] = texture;
				
				// For backward compatibility, also store baseColor as textureObject
				if (textureType === 'baseColor') {
					state.textureObject = texture;
				}
				
				// Configure texture
				texture.flipY = false; // Changed from true to false - matches the monitor.glb expectations
				
				// Set encoding based on texture type
				if (textureType === 'baseColor') {
					texture.encoding = THREE.sRGBEncoding; // Ensure proper color encoding for base color
				} else if (textureType === 'normal') {
					texture.encoding = THREE.LinearEncoding; // Use linear encoding for normal maps
				} else if (textureType === 'orm') {
					texture.encoding = THREE.LinearEncoding; // Use linear encoding for ORM maps
				}
				
				// Apply to model if model is already loaded
				if (state.modelLoaded && state.modelObject) {
					applyTextureToModel(state);
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
				
				// Clean up URL
				URL.revokeObjectURL(fileUrl);
				
				// Dispatch event for texture loaded
				console.log(`Dispatching textureLoaded event with ${textureType} texture:`, texture);
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
	if (!state.modelObject) {
		console.warn('Cannot apply texture: Model not loaded');
		return;
	}
	
	if (!state.textureObjects && !state.textureObject) {
		console.warn('Cannot apply texture: No textures loaded');
		return;
	}
	
	// For backward compatibility
	if (state.textureObject && !state.textureObjects) {
		state.textureObjects = {
			baseColor: state.textureObject
		};
	}
	
	// Log all available textures
	console.log('Applying textures to model:', {
		availableTextures: Object.keys(state.textureObjects),
		baseColor: state.textureObjects.baseColor ? 'Available' : 'Missing',
		orm: state.textureObjects.orm ? 'Available' : 'Missing',
		normal: state.textureObjects.normal ? 'Available' : 'Missing'
	});
	
	// Track if any screen mesh was successfully textured
	let anyScreenMeshTextured = false;
	
	// Initialize screen meshes array if not exists
	if (!state.screenMeshes) {
		state.screenMeshes = [];
	}
	
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
			
			// For testing, treat all meshes as screens to see texture effects
			// This forces all textures to be applied to all meshes for visual debugging
			const applyTextureToAll = true; // Change to false in production
			
			if (isScreenMesh || applyTextureToAll) {
				console.log(`Applying textures to mesh: ${child.name} (${isScreenMesh ? 'is screen' : 'all meshes mode'})`);
				
				// Check available textures for debugging
				const hasBaseColor = !!state.textureObjects.baseColor;
				const hasOrm = !!state.textureObjects.orm;
				const hasNormal = !!state.textureObjects.normal;
				
				console.log('Available textures for material:', {
					baseColor: hasBaseColor,
					orm: hasOrm,
					normal: hasNormal
				});
				
				// Create the appropriate material based on available textures
				let material;
				
				// If multiple textures are available, create a PBR material
				if (Object.keys(state.textureObjects).length > 1) {
					console.log('Creating PBR material with multiple textures');
					
					// Create a new MeshStandardMaterial for multiple textures
					material = new THREE.MeshStandardMaterial({
						map: state.textureObjects.baseColor,
						transparent: true,
						alphaTest: 0.5,
					});
					
					// Configure normal map if available
					if (hasNormal) {
						console.log('Applying normal map to material with increased intensity');
						material.normalMap = state.textureObjects.normal;
						// Increase normal map intensity to make it more visible
						material.normalScale = new THREE.Vector2(2.0, 2.0); 
					}
					
					// Configure ORM map if available
					if (hasOrm) {
						console.log('Applying ORM map to material with adjusted values');
						
						// ORM map: R = Occlusion, G = Roughness, B = Metalness
						material.aoMap = state.textureObjects.orm;
						material.roughnessMap = state.textureObjects.orm;
						material.metalnessMap = state.textureObjects.orm;
						
						// Make roughness channel from green, using blue for metalness
						// Adjust values to make effects more visible for demonstration
						material.aoMapIntensity = 1.5;   // Boost AO effect
						material.roughness = 1.0;       // Full roughness effect
						material.metalness = 1.0;       // Full metalness effect
						
						// Store a reference to the ORM map for debugging
						material.userData.ormMap = state.textureObjects.orm;
						
						// Additional debug info about ORM texture
						console.log('ORM texture details:', {
							width: state.textureObjects.orm.image.width,
							height: state.textureObjects.orm.image.height,
							format: state.textureObjects.orm.format,
							type: state.textureObjects.orm.type
						});
					}
					
					// Add emission for light/screen effect
					if (hasBaseColor) {
						material.emissiveMap = state.textureObjects.baseColor;
						material.emissive = new THREE.Color(0.5, 0.5, 0.5);
					}
				} else {
					// Use basic material for single texture
					console.log('Creating basic material with single texture');
					material = new THREE.MeshBasicMaterial({
						map: state.textureObjects.baseColor || state.textureObject,
						transparent: true,
						alphaTest: 0.5,
					});
				}
				
				// Additional material settings for better PBR appearance
				if (material.type === 'MeshStandardMaterial') {
					material.envMapIntensity = 1.0;
					material.needsUpdate = true;
				}
				
				// Ensure all texture settings are correct
				Object.keys(state.textureObjects).forEach(texType => {
					const tex = state.textureObjects[texType];
					if (tex) {
						tex.flipY = false;
						tex.needsUpdate = true;
						
						// Set different encoding based on texture type
						if (texType === 'baseColor') {
							tex.encoding = THREE.sRGBEncoding;
						} else {
							tex.encoding = THREE.LinearEncoding;
						}
						
						// Ensure mipmaps are generated
						tex.generateMipmaps = true;
						
						// Use tri-linear filtering for better quality
						tex.minFilter = THREE.LinearMipmapLinearFilter;
						tex.magFilter = THREE.LinearFilter;
						
						// Set anisotropy for sharper textures at angles
						if (state.renderer) {
							const maxAnisotropy = state.renderer.capabilities.getMaxAnisotropy();
							tex.anisotropy = maxAnisotropy;
						}
						
						// Log texture settings
						console.log(`Texture ${texType} settings:`, {
							flipY: tex.flipY,
							encoding: tex.encoding === THREE.sRGBEncoding ? 'sRGB' : 'Linear',
							mipmaps: tex.generateMipmaps,
							anisotropy: tex.anisotropy
						});
					}
				});
				
				// Ensure material settings are updated
				material.needsUpdate = true;
				
				// Store original material for future reference
				child.userData.originalMaterial = child.material;
				child.material = material;
				
				// Add to screen meshes array for UV visualization
				if (!state.screenMeshes.includes(child)) {
					state.screenMeshes.push(child);
				}
				
				// Attempt progressive texture mapping strategies
				attemptProgressiveMapping(child, material, state);
				
				// Track successful texturing
				anyScreenMeshTextured = true;
				
				console.log(`Successfully applied textures to mesh: ${child.name}`);
			}
		}
	});
	
	// Make setCurrentUvRegion available in state for manual controls
	import('../ui/atlasVisualization.js').then(module => {
		state.setCurrentUvRegion = module.setCurrentUvRegion;
	});
	
	// If no mesh was successfully textured, try more aggressive fallback approaches
	if (!anyScreenMeshTextured && state.screenMeshes.length > 0) {
		console.log("No meshes were successfully textured with standard approach. Trying fallback strategies...");
		attemptFallbackStrategies(state);
	}
	
	// Log a summary of what was applied
	console.log('Texture application summary:', {
		meshesTextured: state.screenMeshes.length,
		availableTextures: Object.keys(state.textureObjects).length,
		success: anyScreenMeshTextured
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
 * Attempts progressive texture mapping strategies on a mesh
 * @param {THREE.Mesh} mesh - The mesh to apply texture to
 * @param {THREE.Material} material - The material with texture
 * @param {Object} state - Global application state
 */
function attemptProgressiveMapping(mesh, material, state) {
	// Strategy 1: Check if mesh has UV2 or UV3 and try those first
	const tryAlternativeUVs = () => {
		if (mesh.geometry.attributes.uv2) {
			console.log(`Trying UV2 channel for ${mesh.name}`);
			// Create temporary attributes to swap
			const tempUV = mesh.geometry.attributes.uv;
			mesh.geometry.attributes.uv = mesh.geometry.attributes.uv2.clone();
			mesh.geometry.attributes.uv2 = tempUV;
			return true;
		} else if (mesh.geometry.attributes.uv3) {
			console.log(`Trying UV3 channel for ${mesh.name}`);
			// Create temporary attributes to swap
			const tempUV = mesh.geometry.attributes.uv;
			mesh.geometry.attributes.uv = mesh.geometry.attributes.uv3.clone();
			mesh.geometry.attributes.uv3 = tempUV;
			return true;
		}
		return false;
	};
	
	// Strategy 2: Analyze UV bounds and adjust if they're outside normal range
	const analyzeAndAdjustUVs = () => {
		if (!mesh.geometry.attributes.uv) return false;
		
		// Analyze UV bounds
		const uvAttribute = mesh.geometry.attributes.uv;
		let minU = Infinity, minV = Infinity;
		let maxU = -Infinity, maxV = -Infinity;
		
		for (let i = 0; i < uvAttribute.count; i++) {
			const u = uvAttribute.getX(i);
			const v = uvAttribute.getY(i);
			minU = Math.min(minU, u);
			minV = Math.min(minV, v);
			maxU = Math.max(maxU, u);
			maxV = Math.max(maxV, v);
		}
		
		console.log(`UV bounds for ${mesh.name}: U(${minU.toFixed(2)}-${maxU.toFixed(2)}), V(${minV.toFixed(2)}-${maxV.toFixed(2)})`);
		
		// If UVs are outside [0,1] range or in a very small portion, adjust them
		if (minU < 0 || minV < 0 || maxU > 1 || maxV > 1 || 
			(maxU - minU < 0.2) || (maxV - minV < 0.2)) {
			console.log(`Adjusting UVs to fit texture for ${mesh.name}`);
			
			// Calculate scale and offset to fit [0,1] range
			const rangeU = maxU - minU;
			const rangeV = maxV - minV;
			
			if (rangeU > 0 && rangeV > 0) {
				// Apply scaling to material instead of modifying geometry
				material.map.repeat.set(1/rangeU, 1/rangeV);
				material.map.offset.set(-minU/rangeU, -minV/rangeV);
				
				// Only set emissiveMap properties if it exists
				if (material.emissiveMap) {
					material.emissiveMap.repeat.set(1/rangeU, 1/rangeV);
					material.emissiveMap.offset.set(-minU/rangeU, -minV/rangeV);
				}
				return true;
			}
		}
		return false;
	};
	
	// Strategy 3: Try atlas segmentation approach - assume texture might be an atlas
	const tryAtlasSegmentation = () => {
		// Common atlas segments to try (from top-left): full, quarters, and thirds
		const segments = [
			{ u: 0, v: 0, w: 1, h: 1 },      // Full texture
			{ u: 0, v: 0, w: 0.5, h: 0.5 },   // Top-left quarter
			{ u: 0.5, v: 0, w: 0.5, h: 0.5 }, // Top-right quarter
			{ u: 0, v: 0.5, w: 0.5, h: 0.5 }, // Bottom-left quarter
			{ u: 0.5, v: 0.5, w: 0.5, h: 0.5 }, // Bottom-right quarter
			{ u: 0, v: 0, w: 0.33, h: 0.33 },   // Top-left ninth
			{ u: 0.33, v: 0, w: 0.33, h: 0.33 } // Top-center ninth
		];
		
		console.log(`Trying atlas segmentation for ${mesh.name}`);
		
		// Check if map exists before using it
		if (material.map) {
			// Apply first segment (full texture) initially
			const segment = segments[0];
			material.map.offset.set(segment.u, segment.v);
			material.map.repeat.set(segment.w, segment.h);
			
			// Only set emissiveMap properties if it exists
			if (material.emissiveMap) {
				material.emissiveMap.offset.set(segment.u, segment.v);
				material.emissiveMap.repeat.set(segment.w, segment.h);
			}
			
			// Store segments for potential cycling
			mesh.userData.atlasSegments = segments;
			mesh.userData.currentSegment = 0;
			
			return true;
		}
		
		return false;
	};
	
	// Try strategies in sequence
	let success = false;
	
	// Only log once per strategy
	if (!success) success = tryAlternativeUVs();
	if (!success) success = analyzeAndAdjustUVs();
	if (!success) success = tryAtlasSegmentation();
	
	// Always mark texture for update if it exists
	if (material.map) {
		material.map.needsUpdate = true;
	}
	material.needsUpdate = true;
	
	return success;
}

/**
 * Attempts more aggressive fallback strategies across all meshes
 * @param {Object} state - Global application state
 */
function attemptFallbackStrategies(state) {
	// For each screen mesh, try a different atlas segment
	state.screenMeshes.forEach(mesh => {
		if (mesh.userData.atlasSegments && mesh.material && mesh.material.map) {
			// Cycle to next segment
			mesh.userData.currentSegment = (mesh.userData.currentSegment + 1) % mesh.userData.atlasSegments.length;
			const segment = mesh.userData.atlasSegments[mesh.userData.currentSegment];
			
			console.log(`Trying atlas segment ${mesh.userData.currentSegment} for ${mesh.name}: `, segment);
			
			// Apply segment
			mesh.material.map.offset.set(segment.u, segment.v);
			mesh.material.map.repeat.set(segment.w, segment.h);
			
			// Only set emissiveMap properties if it exists
			if (mesh.material.emissiveMap) {
				mesh.material.emissiveMap.offset.set(segment.u, segment.v);
				mesh.material.emissiveMap.repeat.set(segment.w, segment.h);
			}
			
			mesh.material.map.needsUpdate = true;
			mesh.material.needsUpdate = true;
		}
	});
	
	// Add a cycler function to state for UI to call
	state.cycleAtlasSegments = () => {
		state.screenMeshes.forEach(mesh => {
			if (mesh.userData.atlasSegments && mesh.material && mesh.material.map) {
				// Cycle to next segment
				mesh.userData.currentSegment = (mesh.userData.currentSegment + 1) % mesh.userData.atlasSegments.length;
				const segment = mesh.userData.atlasSegments[mesh.userData.currentSegment];
				
				// Apply segment
				mesh.material.map.offset.set(segment.u, segment.v);
				mesh.material.map.repeat.set(segment.w, segment.h);
				
				// Only set emissiveMap properties if it exists
				if (mesh.material.emissiveMap) {
					mesh.material.emissiveMap.offset.set(segment.u, segment.v);
					mesh.material.emissiveMap.repeat.set(segment.w, segment.h);
				}
				
				mesh.material.map.needsUpdate = true;
				mesh.material.needsUpdate = true;
			}
		});
	};
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
/**
 *
 */
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
/**
 *
 */
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
/**
 *
 */
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
/**
 *
 */
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