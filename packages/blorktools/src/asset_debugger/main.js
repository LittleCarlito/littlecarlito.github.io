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
import { initState } from './core/state.js';
import { initUiManager } from './ui/ui-manager.js';
import { setupDropzones } from './ui/file-handler.js';
import { initAtlasPanel } from './ui/scripts/atlas-panel.js';
import { initUvPanel } from './ui/scripts/uv-panel.js';

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
    initAtlasPanel();
    initUvPanel();
    
    // Handle theme switching if needed
    setupThemeSwitching();
}

/**
 * Set up global event listeners to prevent default drag and drop behavior
 */
function preventDefaultDragEvents() {
    const preventDefaults = function(e) {
        // Skip if the target is one of our dropzones
        const dropzoneIds = [
            'basecolor-dropzone', 
            'orm-dropzone', 
            'normal-dropzone',
            'model-dropzone',
            'lighting-dropzone'
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

// For backward compatibility, automatically initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.assetDebuggerState || !window.assetDebuggerState.isInitializing) {
        console.log('Asset Debugger: Auto-initializing for backward compatibility.');
        init();
    }
});

// Export for external use
export default { init }; 