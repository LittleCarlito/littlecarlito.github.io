/**
 * Texture Debugger - Main Entry Point
 * 
 * This file serves as the bridge between the HTML page and the application.
 * It imports and exports all functionality from index.js.
 */

// Import the initialization function from index.js
import init from './index.js';

// Initialize the application when loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Texture Debugger: Application loading...');
    init();
});

// Export for external use
export default init; 