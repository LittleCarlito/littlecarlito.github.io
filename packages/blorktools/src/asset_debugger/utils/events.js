// Event management and setup for the application

import { startDebugging } from '../ui/debugPanel.js';

// Set up event listeners for the application
export function setupEventListeners(state) {
  // Add event listener for window click and keyboard events if needed
  window.addEventListener('keydown', (e) => handleKeyboardShortcuts(e, state));
  
  // Add other application-wide event listeners as needed
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e, state) {
  // Example: Escape key to toggle debug panel
  if (e.key === 'Escape' && state.isDebugMode) {
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
      debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  // Example: 'H' key to toggle UI visibility
  if (e.key === 'h' || e.key === 'H') {
    toggleUIVisibility();
  }
}

// Toggle visibility of all UI panels
function toggleUIVisibility() {
  const uiElements = [
    document.getElementById('debug-panel'),
    document.getElementById('multi-texture-editor'),
    document.getElementById('asset-debug-info'),
    document.getElementById('atlas-visualization')
  ];
  
  // Check if any are visible
  const someVisible = uiElements.some(el => el && el.style.display !== 'none');
  
  // Toggle all UI elements
  uiElements.forEach(el => {
    if (el) {
      el.style.display = someVisible ? 'none' : 'block';
    }
  });
} 