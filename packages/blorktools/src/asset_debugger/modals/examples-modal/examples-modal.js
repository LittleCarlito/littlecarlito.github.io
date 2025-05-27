/**
 * Examples Modal UI Component for Asset Debugger
 * 
 * This component displays a modal with examples when no files are loaded.
 */

export class ExamplesModal {
    constructor(onExampleSelected) {
        // Store the callback function to be called when an example is selected
        this.onExampleSelected = onExampleSelected;
        
        // Wait for HTML to be loaded before initializing elements
        this.waitForElementsAndInitialize();
    }
    
    /**
     * Wait for modal elements to be available in DOM before initializing
     */
    waitForElementsAndInitialize() {
        // Check if modal container is loaded
        if (document.getElementById('examples-modal-container')) {
            // Check if modal content has been loaded into the container
            if (document.getElementById('load-example-modal')) {
                this.initializeElements();
                this.initEventListeners();
            } else {
                // Wait for content to be loaded
                setTimeout(() => this.waitForElementsAndInitialize(), 100);
            }
        } else {
            // Wait for container to be available
            setTimeout(() => this.waitForElementsAndInitialize(), 100);
        }
    }
    
    /**
     * Initialize modal elements
     */
    initializeElements() {
        // Modal elements
        this.modal = document.getElementById('load-example-modal');
        this.closeButton = document.getElementById('close-example-modal');
        this.rigExampleButton = document.getElementById('rig-example-button');
        
        console.log('Examples modal elements initialized:', !!this.modal, !!this.closeButton, !!this.rigExampleButton);
    }
    
    /**
     * Initialize all event listeners for the examples modal
     */
    initEventListeners() {
        // Close button event listener
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.closeModal());
        }
        
        // Rig example button event listener
        if (this.rigExampleButton) {
            this.rigExampleButton.addEventListener('click', () => {
                this.closeModal();
                // Call the callback with the example type
                if (this.onExampleSelected) {
                    this.onExampleSelected('rig');
                }
            });
        }
        
        // Close modal when clicking outside
        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.closeModal();
                }
            });
        }
    }
    
    /**
     * Open the examples modal
     */
    openModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
        }
    }
    
    /**
     * Close the examples modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }
    
    /**
     * Show the modal if no files are loaded
     * @param {boolean} hasFiles - Whether any files are loaded
     * @returns {boolean} - Whether the modal was shown
     */
    showIfNoFiles(hasFiles) {
        if (!hasFiles) {
            console.log('No files loaded. Showing example modal...');
            this.openModal();
            return true;
        }
        return false;
    }
}

export default ExamplesModal; 