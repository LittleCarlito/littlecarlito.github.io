/**
 * Texture Debugger Tool - Main Entry Point
 * 
 * This module exports the texture debugger tool functionality
 * for use in other parts of the application or external imports.
 */

// Import and re-export the init function from the main module
import { init } from './main.js';

// Prevent default drag-and-drop behavior for the entire document
function preventDefaultDragBehavior() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Texture Debugger: Index loaded');
    // Prevent browser default drag-and-drop behavior
    preventDefaultDragBehavior();
    // Initialize the texture debugger
    init();
});

// Export for backward compatibility
export default init; 