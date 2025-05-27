/**
 * Setup dropzones for file input
 */
export function setupDropzones() {
    console.log('Setting up dropzones for file input...');
    
    // Get dropzone elements
    const baseColorDropzone = document.getElementById('basecolor-dropzone');
    const ormDropzone = document.getElementById('orm-dropzone');
    const normalDropzone = document.getElementById('normal-dropzone');
    const modelDropzone = document.getElementById('model-dropzone');
    const lightingDropzone = document.getElementById('lighting-dropzone');
    const backgroundDropzone = document.getElementById('background-dropzone');
    
    console.log('Dropzone elements found:', {
        baseColor: !!baseColorDropzone,
        orm: !!ormDropzone,
        normal: !!normalDropzone,
        model: !!modelDropzone,
        lighting: !!lightingDropzone,
        background: !!backgroundDropzone
    });
    
    // Get info elements
    const baseColorInfo = document.getElementById('basecolor-info');
    const ormInfo = document.getElementById('orm-info');
    const normalInfo = document.getElementById('normal-info');
    const modelInfo = document.getElementById('model-info');
    const lightingInfo = document.getElementById('lighting-info');
    const backgroundInfo = document.getElementById('background-info');
    
    // Set up each dropzone using the configuration
    const dropzones = [
        { element: baseColorDropzone, type: 'baseColor', info: baseColorInfo },
        { element: ormDropzone, type: 'orm', info: ormInfo },
        { element: normalDropzone, type: 'normal', info: normalInfo },
        { element: modelDropzone, type: 'model', info: modelInfo },
        { element: lightingDropzone, type: 'lighting', info: lightingInfo },
        { element: backgroundDropzone, type: 'background', info: backgroundInfo }
    ];
    
    dropzones.forEach(dz => {
        if (dz.element && dz.info) {
            setupDropzone(dz.element, dz.type, dz.info);
        } else if (dz.element) {
            // If info element not found, still set up the dropzone
            console.warn(`Info element for ${dz.type} not found, setting up with null infoElement`);
            setupDropzone(dz.element, dz.type, null);
        }
    });
    
    console.log('Dropzones setup complete');
}

/**
 * Set up a single dropzone with event handlers
 * @param {HTMLElement} dropzone - The dropzone element
 * @param {string} fileType - The type of file this dropzone accepts
 * @param {HTMLElement} infoElement - Element to display file info
 */
export function setupDropzone(dropzone, fileType, infoElement) {
    if (!dropzone) {
        console.error(`Error: dropzone is null or undefined for type ${fileType}`);
        return;
    }
    
    // First remove any existing event listeners to prevent duplicates
    const clone = dropzone.cloneNode(true);
    dropzone.parentNode.replaceChild(clone, dropzone);
    dropzone = clone;

    const config = FILE_TYPE_CONFIG[fileType];
    
    if (!config) {
        console.error(`No configuration found for file type: ${fileType}`);
        return;
    }
    
    // Refresh infoElement reference if it's null (likely after clearing)
    if (!infoElement) {
        infoElement = document.getElementById(fileType.toLowerCase() + '-info');
    }
    
    // Set up the drop event for this dropzone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        dropzone.classList.add('active');
    }
    
    function unhighlight(e) {
        dropzone.classList.remove('active');
    }
    
    // Handle file drop
    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        
        const dt = event.dataTransfer;
        const files = dt.files;
        
        if (files.length === 0) {
            return false;
        }
        
        const file = files[0]; // Use only the first file
        
        // Check if file extension is valid for this dropzone
        const validExtensions = config.acceptedFileTypes;
        const isValidFile = file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (isValidFile) {
            // Use the handler function from the configuration
            // For texture uploads, we need to pass the actual texture type string
            if (['baseColor', 'orm', 'normal'].includes(fileType)) {
                config.handler(file, fileType, infoElement, null, dropzone);
            } else {
                // Ensure we pass the current dropzone element to the handler
                config.handler(file, infoElement, null, dropzone);
            }
        } else if (file) {
            alert(`Please upload a valid file format: ${validExtensions.join(', ')}`);
            return false;
        }
        
        return false;
    }, false);
    
    // Handle click to select file using file input
    dropzone.addEventListener('click', (event) => {
        // If the click was on a clear button, don't do anything
        if (event.target.classList.contains('clear-preview-button')) {
            return;
        }
        
        // If the dropzone has a file (has-file class), only allow drag and drop to replace or clear button
        if (dropzone.classList.contains('has-file')) {
            // Check if the click was on a preview element (for example, the 3D model preview or image)
            // Don't open file dialog if click is on any preview element or inside a preview container
            const isOnPreview = event.target.closest('.preview') || 
                               event.target.classList.contains('texture-preview-img') || 
                               event.target.classList.contains('hdr-preview-canvas') ||
                               event.target.classList.contains('texture-preview-container') ||
                               event.target.classList.contains('hdr-preview-container');
            
            if (isOnPreview) {
                // If this is a click on a preview element, just return without opening the file picker
                return;
            }
            
            // If we get here, this is a click on the dropzone but not on a preview element
            // Since the dropzone already has a file, do nothing (don't open file dialog)
            return;
        }
        
        // Create a file input element - only for empty dropzones
        const input = document.createElement('input');
        input.type = 'file';
        
        // Set accept attribute based on file type
        input.accept = config.acceptedFileTypes.join(',');
        
        // Handle file selection
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const isValidFile = config.acceptedFileTypes.some(ext => file.name.toLowerCase().endsWith(ext));
            
            if (isValidFile) {
                // Pass the dropzone element to the handler
                // For texture uploads, we need to pass the actual texture type string
                if (['baseColor', 'orm', 'normal'].includes(fileType)) {
                    config.handler(file, fileType, infoElement, null, dropzone);
                } else {
                    // Make sure to pass the dropzone parameter for all handlers
                    config.handler(file, infoElement, null, dropzone);
                }
            } else {
                alert(`Please upload a valid file format: ${config.acceptedFileTypes.join(', ')}`);
            }
        };
        
        input.click();
    });
}