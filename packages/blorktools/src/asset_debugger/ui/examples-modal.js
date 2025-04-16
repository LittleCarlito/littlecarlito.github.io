/**
 * Examples Modal UI Component for Asset Debugger
 * 
 * This component displays a modal with examples when no files are loaded.
 */

export class ExamplesModal {
    constructor(onExampleSelected) {
        // Store the callback function to be called when an example is selected
        this.onExampleSelected = onExampleSelected;
        
        // Modal elements
        this.modal = document.getElementById('load-example-modal');
        this.closeButton = document.getElementById('close-example-modal');
        this.rigExampleButton = document.getElementById('rig-example-button');
        
        // Initialize event listeners
        this.initEventListeners();
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
                // Call the callback function when an example is selected
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