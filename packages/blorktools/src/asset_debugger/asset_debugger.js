import { clearSessionData } from '../util/localstorage-util.js';

export function initAssetDebugger() {
    console.debug('Initializing asset debugger...');
    
    // Initialize new state
    const state = initState();
    console.debug('New debug session started with ID:', state.sessionId);
    
    // Initialize the scene
    initScene();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start the render loop
    animate();
}

function setupEventListeners() {
    // ... existing event listener setup code ...
    
    // File drop handlers
    dropZone.addEventListener('drop', (event) => {
        // ... drop handler code ...
    });
    
    // File input handlers
    fileInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            // ... change handler code ...
        });
    });
    
    // Add exit button handler
    const exitButton = document.querySelector('.exit-button');
    if (exitButton) {
        exitButton.addEventListener('click', () => {
            console.debug('Exit button clicked, clearing session data...');
            clearSessionData();
            // Navigate back to toolbox
            window.location.href = '/toolbox';
        });
    }
}

// ... rest of the file ... 