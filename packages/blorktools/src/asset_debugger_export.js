// This file imports the original asset_debugger.js (which runs as a script)
// and then exports the necessary functionality

// Import the original asset_debugger.js
import './asset_debugger.js';

// Create a wrapper class that exposes the global functions
class AssetDebugger {
  constructor(options = {}) {
    this.options = options;
  }
  
  init(container) {
    // The init() function is already called when the script is loaded
    return this;
  }
  
  toggleMeshVisibility(groupName, visible) {
    if (typeof window.toggleMeshGroupVisibility === 'function') {
      window.toggleMeshGroupVisibility(groupName, visible);
    }
  }
  
  switchUVMap(index) {
    if (typeof window.switchUVMap === 'function') {
      window.switchUVMap(index);
    }
  }
}

export default AssetDebugger; 