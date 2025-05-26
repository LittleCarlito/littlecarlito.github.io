// LOADING FUNCTIONS

/**
 * Shows the loading splash screen
 */
export function showLoadingSplash() {
    // First check if the splash already exists
    let loadingSplash = document.getElementById('loading-splash');
    
    if (!loadingSplash) {
        // Create and add the loading splash screen from our HTML template
        fetch('../loading-splash/loading-splash.html')
            .then(response => response.text())
            .then(html => {
                document.body.insertAdjacentHTML('beforeend', html);
                // Make sure it's visible
                loadingSplash = document.getElementById('loading-splash');
                if (loadingSplash) {
                    loadingSplash.style.display = 'flex';
                }
            })
            .catch(error => {
                console.error('Error loading splash screen:', error);
            });
    } else {
        // If it exists, make sure it's visible
        loadingSplash.style.display = 'flex';
        loadingSplash.classList.remove('fade-out');
    }
}

/**
 * Updates the loading progress text on the splash screen
 * @param {string} text - The progress message to display
 */
export function updateLoadingProgress(text) {
    const progressText = document.getElementById('loading-progress-text');
    if (progressText) {
        progressText.textContent = text;
    }
}

/**
 * Hides the loading splash screen with a fade-out animation
 */
export function hideLoadingSplash() {
    const loadingSplash = document.getElementById('loading-splash');
    if (loadingSplash) {
        // Add fade-out class for smooth transition
        loadingSplash.classList.add('fade-out');
        
        // Remove the element after the animation completes
        setTimeout(() => {
            loadingSplash.remove();
        }, 600); // Match the transition duration in CSS
    }
}