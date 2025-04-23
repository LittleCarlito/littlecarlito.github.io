/**
 * Model Worker
 * 
 * A web worker for processing model files (GLB) asynchronously.
 */

// Listen for messages from the main thread
self.onmessage = async function(e) {
  try {
    const { file, id } = e.data;
    console.log(`[Model Worker] Processing model: ${file.name}`);
    
    // In a real implementation, this would parse the GLB file
    // and extract useful information and metadata
    // Since we can't load Three.js in a worker directly, we'll send back
    // just the file metadata and let the main thread do the actual 3D processing
    
    // Create an ArrayBuffer from the file
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // For GLB files, we could extract the header information here if needed
    // For now, just send back basic information
    self.postMessage({
      status: 'success',
      id,
      fileName: file.name,
      fileSize: file.size,
      // We could include extracted metadata in a real implementation
      metadata: {
        type: 'glb',
        hasAnimations: false, // Would be determined by parsing the file
        hasMorphTargets: false // Would be determined by parsing the file
      }
    });
  } catch (error) {
    console.error('[Model Worker] Error:', error);
    self.postMessage({
      status: 'error',
      error: error.message || 'Unknown error processing model'
    });
  }
};

/**
 * Read a file as an ArrayBuffer
 * @param {File} file - The file to read
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the ArrayBuffer
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    
    reader.onerror = function() {
      reject(new Error('Failed to read model file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
} 