// Event listeners module
// Handles setting up event listeners for the application

/**
 * Setup global event listeners
 * @param {Object} state - Global application state
 */
export function setupEventListeners(state) {
  // Setup window resize event
  window.addEventListener('resize', () => handleWindowResize(state));
  
  // Setup keyboard shortcuts
  window.addEventListener('keydown', (event) => handleKeyboardShortcuts(event, state));
  
  console.log('Event listeners initialized');
}

/**
 * Handle window resize event
 * @param {Object} state - Global application state
 */
function handleWindowResize(state) {
  if (!state.camera || !state.renderer) return;
  
  // Update camera aspect ratio
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  
  // Update renderer size
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Object} state - Global application state
 */
function handleKeyboardShortcuts(event, state) {
  // ESC key - Reset to drop zone
  if (event.key === 'Escape') {
    if (state.isDebugMode) {
      // Check if we have the resetToDropZone function
      if (typeof window.resetToDropZone === 'function') {
        window.resetToDropZone(state);
      } else {
        console.warn('resetToDropZone function not available');
      }
    }
  }
  
  // R key - Reset camera
  if (event.key === 'r' || event.key === 'R') {
    if (state.camera && state.controls) {
      state.camera.position.set(0, 0, 5);
      state.controls.target.set(0, 0, 0);
      state.controls.update();
    }
  }
  
  // T key - Toggle texture editor
  if (event.key === 't' || event.key === 'T') {
    if (state.isDebugMode && typeof window.toggleTextureEditor === 'function') {
      window.toggleTextureEditor(state);
    }
  }
} 