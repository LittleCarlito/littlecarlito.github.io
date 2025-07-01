import { processModelFile } from "../../workers/worker-manager";

/**
 * Process a GLB model file using web workers
 * @param {File} file - The GLB file to process
 * @returns {Promise} A promise that resolves when processing is complete
 */
export async function processGLBFile(file) {
    // Basic file validation client-side before sending to worker
    if (!file || !file.name.toLowerCase().endsWith('.glb')) {
        throw new Error('Invalid GLB file');
    }
    
    try {
        // Process the file using the worker-manager
        // This handles the file in a separate thread
        const result = await processModelFile(file);
        
        if (result.status !== 'success') {
            throw new Error(result.error || 'Unknown error processing GLB file');
        }
        
        // Convert file to array buffer for further processing
        const arrayBuffer = await file.arrayBuffer();
        
        return {
            arrayBuffer,
            fileName: file.name,
            fileSize: file.size,
            ...result // Include any additional metadata from worker
        };
    } catch (error) {
        console.error('Error in processGLBModel:', error);
        throw error;
    }
}