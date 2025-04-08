/**
 * Texture Debugger Tool - Main Entry Point
 * 
 * This module exports the texture debugger tool functionality
 * for use in other parts of the application or external imports.
 */

// Import and re-export the init function
import { init } from './texture_debugger.js';

// Export the init function as the primary API
export { init };

// Default export for convenience
export default {
    init
}; 