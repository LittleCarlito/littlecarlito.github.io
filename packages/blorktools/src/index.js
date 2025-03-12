// Export all tools from the blorktools package
export { default as AssetDebugger } from './asset_debugger_export.js';

// Main function to initialize the tools
export function initializeTools(options = {}) {
  console.log('Blorktools initialized with options:', options);
  return {
    // Return tool constructors or instances
    AssetDebugger
  };
} 