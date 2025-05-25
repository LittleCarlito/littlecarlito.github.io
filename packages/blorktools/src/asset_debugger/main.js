/**
 * Asset Debugger - Main Module
 * 
 * The main entry point that initializes all the asset debugger modules.
 * 
 * A tool to debug textures by loading three atlas types:
 * - Base Color Atlas
 * - ORM (Occlusion, Roughness, Metalness) Atlas
 * - Normal Map Atlas
 * 
 * The tool allows viewing these textures on a 3D cube with proper PBR rendering.
 */
import { initState } from './state.js';
import { initUiManager } from './util/ui-manager.js';
import { setupDropzones } from './landing-screen/file-handler.js';
// Import panel initialization functions but don't call them here
import { initAtlasPanel } from './panels/atlas-panel/atlas-panel.js';
import { initUvPanel } from './panels/uv-panel/uv-panel.js';

/**
 * Initialize the asset debugger application
 */
export function init() {
    // Initialize state
    initState();
    
    // Add global event listeners to prevent default browser behavior for drag and drop
    preventDefaultDragEvents();
    
    // Initialize UI components
    initUiManager();
    setupDropzones();
    
    // REMOVED: Calls to initialize panels
    // Panels should only be initialized when the app is in debug mode (after "Start Debugging" is clicked)
    // initAtlasPanel();
    // initUvPanel();
    
    // Handle theme switching if needed
    setupThemeSwitching();
}

/**
 * Set up global event listeners to prevent default drag and drop behavior
 */
function preventDefaultDragEvents() {
    const preventDefaults = function(e) {
        // Skip if the target is one of our dropzones or the main container dropzone
        const dropzoneIds = [
            'basecolor-dropzone', 
            'orm-dropzone', 
            'normal-dropzone',
            'model-dropzone',
            'lighting-dropzone',
            'background-dropzone',
            'upload-section' // Add the main container
        ];
        
        if (dropzoneIds.some(id => e.target.id === id || e.target.closest(`#${id}`))) {
            return; // Don't prevent default for dropzones
        }
        
        e.preventDefault();
        e.stopPropagation();
    };
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
    });
}

/**
 * Set up theme switching
 */
function setupThemeSwitching() {
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            if (html.classList.contains('dark-mode')) {
                html.classList.remove('dark-mode');
                html.classList.add('light-mode');
            } else {
                html.classList.remove('light-mode');
                html.classList.add('dark-mode');
            }
        });
    }
}

// Export for external use
export default { init }; 