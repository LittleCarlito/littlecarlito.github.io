/**
 * Model Worker
 * 
 * This worker processes GLB model files.
 * It performs initial validation and processing of GLB files in a separate thread.
 */

/**
 * Process a GLB model file
 * @param {File} file - The GLB file to process
 * @returns {Object} An object containing processing results
 */
async function consumeGLBFile(file) {
  try {
    // Basic file validation
    if (!file || !file.name.toLowerCase().endsWith('.glb')) {
      return {
        status: 'error',
        error: 'Invalid GLB file'
      };
    }
    
    // Convert file to ArrayBuffer for processing
    const arrayBuffer = await file.arrayBuffer();
    
    // Validate GLB format
    if (arrayBuffer.byteLength < 12) {
      return {
        status: 'error',
        error: 'Invalid GLB format: File too small'
      };
    }
    
    // Check GLB magic bytes
    const headerView = new Uint8Array(arrayBuffer, 0, 4);
    const magicString = String.fromCharCode.apply(null, headerView);
    
    if (magicString !== 'glTF') {
      return {
        status: 'error',
        error: 'Invalid GLB format: Missing glTF magic bytes'
      };
    }
    
    // Get GLB version
    const dataView = new DataView(arrayBuffer);
    const version = dataView.getUint32(4, true);
    if (version !== 2) {
      return {
        status: 'error',
        error: `Unsupported GLB version: ${version}`
      };
    }
    
    // Check for JSON chunk
    const jsonChunkType = dataView.getUint32(16, true);
    if (jsonChunkType !== 0x4E4F534A) { // 'JSON' in ASCII
      return {
        status: 'error',
        error: 'Invalid GLB: First chunk is not JSON'
      };
    }
    
    // Successfully validated the GLB file
    return {
      status: 'success',
      fileName: file.name,
      fileSize: file.size,
      fileType: 'glb',
      version: version,
      // We don't need to send the full arrayBuffer back to the main thread
      // Just send validation results
      message: 'GLB file validated successfully'
    };
    
  } catch (error) {
    console.error('Error in model worker:', error);
    return {
      status: 'error',
      error: `Error processing GLB file: ${error.message || 'Unknown error'}`
    };
  }
}

// Set up message handler to process GLB files
self.onmessage = async (e) => {
  try {
    const { file, id } = e.data;
    
    // Process the file
    const result = await consumeGLBFile(file);
    
    // Add the worker ID to the result
    result.id = id;
    
    // Send the result back to the main thread
    self.postMessage(result);
  } catch (error) {
    // Send error result back to main thread
    self.postMessage({
      status: 'error',
      id: e.data.id,
      error: error.message || 'Unknown error in model worker'
    });
  }
};

// Log that the worker has started
console.log('Model worker started'); 