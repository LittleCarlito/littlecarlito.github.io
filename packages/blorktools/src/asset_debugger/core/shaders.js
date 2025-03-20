// Shaders module
// Handles creation and management of shaders for the asset debugger
import * as THREE from 'three';
/**
 * Create default shader material for model viewing
 * @param {Object} state - Global state object
 * @returns {THREE.ShaderMaterial} - Created shader material
 */
export function createDefaultShader(state) {
	// Default vertex shader
	const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    // UV channel selection
    uniform int uvChannel;
    
    void main() {
      // Select UV set based on channel
      if (uvChannel == 0) {
        vUv = uv;
      } else if (uvChannel == 1 && uv2) {
        vUv = uv2;
      } else if (uvChannel == 2 && uv3) {
        vUv = uv3;
      } else {
        vUv = uv;
      }
      
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
	// Default fragment shader
	const fragmentShader = `
    uniform sampler2D diffuseMap;
    uniform vec3 color;
    uniform float useTexture;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      vec4 texColor = texture2D(diffuseMap, vUv);
      
      // Calculate lighting (simple diffuse)
      vec3 light = normalize(vec3(1.0, 1.0, 1.0));
      float diffuse = max(0.0, dot(vNormal, light));
      float ambient = 0.3;
      float lighting = ambient + diffuse * 0.7;
      
      // Final color
      vec3 finalColor;
      if (useTexture > 0.5) {
        finalColor = texColor.rgb * lighting;
      } else {
        finalColor = color * lighting;
      }
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;
	// Create shader material
	const shader = new THREE.ShaderMaterial({
		uniforms: {
			diffuseMap: { value: null },
			color: { value: new THREE.Color(0x808080) },
			useTexture: { value: 0.0 },
			uvChannel: { value: 0 }
		},
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		side: THREE.DoubleSide
	});
	// Store in state
	state.shader = shader;
	return shader;
}
/**
 * Create a UV visualization shader
 * @param {Object} options - Shader options
 * @returns {THREE.ShaderMaterial} - Created shader material
 */
export function createUvVisualizationShader(options = {}) {
	const gridSize = options.gridSize || 10.0;
	const lineWidth = options.lineWidth || 0.05;
	const gridColor = options.gridColor || new THREE.Color(0x000000);
	const backgroundColor = options.backgroundColor || new THREE.Color(0xffffff);
	// Vertex shader
	const vertexShader = `
    varying vec2 vUv;
    
    // UV channel selection
    uniform int uvChannel;
    
    void main() {
      // Select UV set based on channel
      if (uvChannel == 0) {
        vUv = uv;
      } else if (uvChannel == 1 && uv2) {
        vUv = uv2;
      } else if (uvChannel == 2 && uv3) {
        vUv = uv3;
      } else {
        vUv = uv;
      }
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
	// Fragment shader for UV visualization
	const fragmentShader = `
    varying vec2 vUv;
    
    uniform float gridSize;
    uniform float lineWidth;
    uniform vec3 gridColor;
    uniform vec3 backgroundColor;
    
    void main() {
      // Grid pattern
      vec2 grid = fract(vUv * gridSize);
      float line = step(lineWidth, grid.x) * step(lineWidth, grid.y);
      
      // Grid lines at UV edges (0 and 1)
      float edge = step(1.0 - lineWidth * 2.0, vUv.x) + step(1.0 - lineWidth * 2.0, vUv.y) + 
                 (1.0 - step(lineWidth * 2.0, vUv.x)) + (1.0 - step(lineWidth * 2.0, vUv.y));
      edge = clamp(edge, 0.0, 1.0);
      
      // Color mixing
      vec3 color = mix(gridColor, backgroundColor, line);
      
      // Highlight edges
      color = mix(vec3(1.0, 0.0, 0.0), color, 1.0 - edge);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;
	// Create shader material
	return new THREE.ShaderMaterial({
		uniforms: {
			gridSize: { value: gridSize },
			lineWidth: { value: lineWidth },
			gridColor: { value: gridColor },
			backgroundColor: { value: backgroundColor },
			uvChannel: { value: 0 }
		},
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		side: THREE.DoubleSide
	});
}
/**
 * Create texture atlas visualization shader
 * @param {THREE.Texture} texture - Texture to visualize
 * @returns {THREE.ShaderMaterial} - Created shader material
 */
export function createAtlasVisualizationShader(texture) {
	// Vertex shader
	const vertexShader = `
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
	// Fragment shader for atlas visualization
	const fragmentShader = `
    varying vec2 vUv;
    
    uniform sampler2D diffuseMap;
    uniform float opacity;
    uniform vec2 highlightMin;
    uniform vec2 highlightMax;
    
    void main() {
      // Get the texture color
      vec4 texColor = texture2D(diffuseMap, vUv);
      
      // Draw a grid
      float gridSize = 10.0;
      float lineWidth = 0.01;
      vec2 grid = fract(vUv * gridSize);
      float line = step(lineWidth, grid.x) * step(lineWidth, grid.y);
      
      // Grid lines at 0.0 and 0.5 intervals
      vec2 halfGrid = fract(vUv * 2.0);
      float halfLine = step(0.99, halfGrid.x) + step(0.99, halfGrid.y);
      halfLine = clamp(halfLine, 0.0, 1.0);
      
      // Coordinates to display
      float showCoords = 0.0;
      if (vUv.x < 0.05 && vUv.y > 0.95) showCoords = 1.0; // Show 0.0, 1.0
      if (vUv.x > 0.45 && vUv.x < 0.55 && vUv.y > 0.95) showCoords = 1.0; // Show 0.5, 1.0
      if (vUv.x > 0.95 && vUv.y > 0.95) showCoords = 1.0; // Show 1.0, 1.0
      if (vUv.x < 0.05 && vUv.y > 0.45 && vUv.y < 0.55) showCoords = 1.0; // Show 0.0, 0.5
      if (vUv.x > 0.95 && vUv.y > 0.45 && vUv.y < 0.55) showCoords = 1.0; // Show 1.0, 0.5
      if (vUv.x < 0.05 && vUv.y < 0.05) showCoords = 1.0; // Show 0.0, 0.0
      if (vUv.x > 0.45 && vUv.x < 0.55 && vUv.y < 0.05) showCoords = 1.0; // Show 0.5, 0.0
      if (vUv.x > 0.95 && vUv.y < 0.05) showCoords = 1.0; // Show 1.0, 0.0
      
      // Check if current UV point is in the highlight area (current selected UV area)
      float isHighlighted = 0.0;
      if (vUv.x >= highlightMin.x && vUv.x <= highlightMax.x && 
          vUv.y >= highlightMin.y && vUv.y <= highlightMax.y) {
        
        // Create a highlight border
        float borderWidth = 0.005;
        if (vUv.x < highlightMin.x + borderWidth || vUv.x > highlightMax.x - borderWidth ||
            vUv.y < highlightMin.y + borderWidth || vUv.y > highlightMax.y - borderWidth) {
          isHighlighted = 1.0;
        }
      }
      
      // Mix texColor with grid
      vec3 color = mix(texColor.rgb, vec3(0.0, 0.0, 0.0), 1.0 - line * 0.7);
      
      // Highlight major grid lines (0.0, 0.5, 1.0)
      color = mix(color, vec3(0.0, 0.0, 0.0), halfLine * 0.7);
      
      // Add coordinate markers
      color = mix(color, vec3(1.0, 1.0, 1.0), showCoords);
      
      // Add highlight (red border)
      color = mix(color, vec3(1.0, 0.0, 0.0), isHighlighted);
      
      gl_FragColor = vec4(color, texColor.a * opacity);
    }
  `;
	// Create shader material
	return new THREE.ShaderMaterial({
		uniforms: {
			diffuseMap: { value: texture },
			opacity: { value: 1.0 },
			highlightMin: { value: new THREE.Vector2(0.7, 0.7) }, // Default highlight area
			highlightMax: { value: new THREE.Vector2(0.8, 0.8) }
		},
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		transparent: true,
		side: THREE.DoubleSide
	});
} 