// Multi-Texture Material Module
// Handles creation of custom shader materials for blending multiple textures

import * as THREE from 'three';
import { originalUvData } from '../core/analyzer.js';

// Create a multi-texture shader material
export function createMultiTextureMaterial(textures, mesh, state) {
	if (!textures || !textures.length) return null;
  
	// Maximum number of textures supported by the shader
	const MAX_TEXTURES = 5;
  
	// Handle original UV data
	if (mesh && mesh.geometry) {
		const geometry = mesh.geometry;
    
		// For each active texture, handle special UV indices
		textures.forEach(texInfo => {
			const uvIndex = texInfo.uvIndex || 0;
      
			// Store original UV if needed
			if (uvIndex > 0 && geometry.getAttribute('uv') && !originalUvData.has(mesh)) {
				const originalUv = geometry.getAttribute('uv').clone();
				originalUvData.set(mesh, originalUv);
				console.log('Stored original UV for multi-texture material', mesh.name || 'unnamed');
			}
      
			// If using default UV, restore the original
			if (uvIndex === 0 && originalUvData.has(mesh)) {
				const originalUv = originalUvData.get(mesh);
				geometry.setAttribute('uv', originalUv);
				console.log('Restored original UV for multi-texture material', mesh.name || 'unnamed');
			}
      
			// Apply higher UV channels if needed
			if (uvIndex === 1 && geometry.getAttribute('uv2')) {
				// Using UV2 for this texture
				// We'll handle this in the shader
			} else if (uvIndex === 2 && geometry.getAttribute('uv3')) {
				// Using UV3 for this texture
				// We'll handle this in the shader
			}
		});
	}
  
	// Generate uniforms
	const uniforms = {
		time: { value: 0.0 },
		textureCount: { value: Math.min(textures.length, MAX_TEXTURES) }
	};
  
	// Add uniform for each texture
	for (let i = 0; i < Math.min(textures.length, MAX_TEXTURES); i++) {
		const texInfo = textures[i];
    
		// Add texture, blend mode and intensity uniforms
		uniforms[`texture${i}`] = { value: texInfo.texture };
		uniforms[`blendMode${i}`] = { value: getBlendModeValue(texInfo.blendMode) };
		uniforms[`intensity${i}`] = { value: texInfo.intensity || 1.0 };
		uniforms[`uvIndex${i}`] = { value: texInfo.uvIndex || 0 };
    
		console.log(`Added texture${i} with blend mode ${texInfo.blendMode} (${getBlendModeValue(texInfo.blendMode)}) and intensity ${texInfo.intensity}`);
	}
  
	// Generate the shader code
	const { vertexShader, fragmentShader } = generateShaderCode(textures, mesh);
  
	// Create the material
	const material = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		transparent: true,
		side: THREE.DoubleSide
	});
  
	return material;
}

// Generate shader code based on the provided textures
function generateShaderCode(textures, mesh) {
	// Check if the mesh has UV2 and UV3 channels
	const hasUv2 = mesh && mesh.geometry && mesh.geometry.getAttribute('uv2');
	const hasUv3 = mesh && mesh.geometry && mesh.geometry.getAttribute('uv3');
  
	// Generate vertex shader code
	let vertexShader = `
    varying vec2 vUv;
    ${hasUv2 ? 'attribute vec2 uv2; varying vec2 vUv2;' : ''}
    ${hasUv3 ? 'attribute vec2 uv3; varying vec2 vUv3;' : ''}
    
    void main() {
      vUv = uv;
      ${hasUv2 ? 'vUv2 = uv2;' : ''}
      ${hasUv3 ? 'vUv3 = uv3;' : ''}
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
	// Start fragment shader
	let fragmentShader = `
    uniform float time;
    uniform int textureCount;
    
    varying vec2 vUv;
    ${hasUv2 ? 'varying vec2 vUv2;' : ''}
    ${hasUv3 ? 'varying vec2 vUv3;' : ''}
    
    // Define blend modes
    // 0 = normal, 1 = add, 2 = multiply, 3 = screen, 4 = overlay
    
    // Texture uniforms
    ${generateTextureUniforms(textures.length)}
    
    // Apply blend mode function
    vec4 applyBlendMode(vec4 base, vec4 blend, int mode, float intensity) {
      // Normal blend
      if (mode == 0) {
        return mix(base, blend, blend.a * intensity);
      }
      // Add blend
      else if (mode == 1) {
        return base + blend * intensity;
      }
      // Multiply blend
      else if (mode == 2) {
        return base * mix(vec4(1.0), blend, intensity);
      }
      // Screen blend
      else if (mode == 3) {
        return base + (vec4(1.0) - base) * blend * intensity;
      }
      // Overlay blend
      else if (mode == 4) {
        vec4 result;
        if (base.r < 0.5) result.r = 2.0 * base.r * blend.r;
        else result.r = 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r);
        
        if (base.g < 0.5) result.g = 2.0 * base.g * blend.g;
        else result.g = 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g);
        
        if (base.b < 0.5) result.b = 2.0 * base.b * blend.b;
        else result.b = 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b);
        
        result.a = base.a;
        return mix(base, result, intensity);
      }
      // Default to normal
      return mix(base, blend, blend.a * intensity);
    }
    
    // Get the texture coordinates based on UV index
    vec2 getUvCoords(int uvIndex) {
      if (uvIndex == 1) {
        ${hasUv2 ? 'return vUv2;' : 'return vUv;'}
      }
      else if (uvIndex == 2) {
        ${hasUv3 ? 'return vUv3;' : 'return vUv;'}
      }
      return vUv;
    }
    
    void main() {
      // Start with base texture
      vec4 finalColor = texture2D(texture0, getUvCoords(uvIndex0));
      
      // Apply additional textures based on blend modes
      ${generateTextureBlending(textures.length)}
      
      gl_FragColor = finalColor;
    }
  `;
  
	return { vertexShader, fragmentShader };
}

// Generate texture uniform declarations
function generateTextureUniforms(count) {
	let code = '';
	const maxTextures = Math.min(count, 5); // Maximum 5 textures
  
	for (let i = 0; i < maxTextures; i++) {
		code += `
      uniform sampler2D texture${i};
      uniform int blendMode${i};
      uniform float intensity${i};
      uniform int uvIndex${i};
    `;
	}
  
	return code;
}

// Generate code for blending textures
function generateTextureBlending(count) {
	let code = '';
	const maxTextures = Math.min(count, 5); // Maximum 5 textures
  
	// Skip the first texture as it's the base
	for (let i = 1; i < maxTextures; i++) {
		code += `
      if (textureCount > ${i}) {
        vec4 color${i} = texture2D(texture${i}, getUvCoords(uvIndex${i}));
        finalColor = applyBlendMode(finalColor, color${i}, blendMode${i}, intensity${i});
      }
    `;
	}
  
	return code;
}

// Convert blend mode string to numeric value for shader
function getBlendModeValue(blendMode) {
	switch (blendMode?.toLowerCase()) {
	case 'normal': return 0;
	case 'add': return 1;
	case 'multiply': return 2;
	case 'screen': return 3;
	case 'overlay': return 4;
	default: return 0; // Default to normal
	}
}

// Update shader material time uniform for animations
export function updateShaderTime(material, time) {
	if (material && material.isShaderMaterial && material.uniforms && material.uniforms.time) {
		material.uniforms.time.value = time;
	}
} 