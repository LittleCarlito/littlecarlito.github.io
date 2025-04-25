/**
 * Lighting Worker
 * 
 * A web worker for processing lighting files (HDR/EXR) asynchronously.
 */

// Listen for messages from the main thread
self.onmessage = async function(e) {
  try {
    const { file, id } = e.data;
    console.log(`[Lighting Worker] Processing lighting file: ${file.name}`);
    
    // For HDR/EXR files, we can't directly parse them in a worker
    // without additional libraries, so we'll pass the array buffer back
    // to the main thread for processing with Three.js
    
    // Read file as array buffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Extract file extension to determine type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    self.postMessage({
      status: 'success',
      id,
      fileName: file.name,
      fileSize: file.size,
      fileType: fileExtension,
      // We need to transfer the arrayBuffer to avoid copying
      // This makes it unusable in the worker after transfer
      arrayBuffer: arrayBuffer
    }, [arrayBuffer]);
  } catch (error) {
    console.error('[Lighting Worker] Error:', error);
    self.postMessage({
      status: 'error',
      error: error.message || 'Unknown error processing lighting file'
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
      reject(new Error('Failed to read lighting file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
} 