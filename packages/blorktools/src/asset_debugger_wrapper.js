import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Import the original asset_debugger.js functionality
// This will remain as a global script for now, but we're wrapping it for export

class AssetDebugger {
  constructor(options = {}) {
    this.options = {
      container: null,
      modelPath: options.modelPath || '',
      texturePath: options.texturePath || '',
      ...options
    };
    
    // The original script functionality will be used when initialized
    this.initialized = false;
  }
  
  init(containerElement) {
    // The original script already has init(), we just need to make sure 
    // it's properly scoped and exports correctly
    
    // In a real implementation, we would refactor the global functions 
    // to be methods of this class, but for now we're just wrapping
    
    // Initialize is handled by simply including the script
    // which calls init() automatically
    this.initialized = true;
    
    return this;
  }
  
  // Add methods that map to functions in the original script
  toggleMeshVisibility(groupName, visible) {
    // This would call the global function toggleMeshGroupVisibility
    if (typeof toggleMeshGroupVisibility === 'function') {
      toggleMeshGroupVisibility(groupName, visible);
    }
  }
  
  switchUVMap(index) {
    // This would call the global function switchUVMap
    if (typeof switchUVMap === 'function') {
      switchUVMap(index);
    }
  }
}

// Default export for the package
export default AssetDebugger; 