/**
 * Texture Worker
 * 
 * A web worker for processing texture files asynchronously.
 */

// Listen for messages from the main thread
self.onmessage = async function(e) {
  try {
    const { file, textureType, id } = e.data;
    console.log(`[Texture Worker] Processing ${textureType} texture: ${file.name}`);
    
    // Generate a preview data URL
    const previewDataUrl = await createPreviewDataUrl(file);
    
    // Process the texture (in a real implementation, this would do the heavy processing)
    // Here we just post the preview data URL back
    self.postMessage({
      status: 'success',
      id,
      textureType,
      previewDataUrl,
      fileName: file.name,
      fileSize: file.size
    });
  } catch (error) {
    console.error('[Texture Worker] Error:', error);
    self.postMessage({
      status: 'error',
      error: error.message || 'Unknown error processing texture'
    });
  }
};

/**
 * Create a preview data URL from a file
 * @param {File} file - The file to create a preview for
 * @returns {Promise<string>} A promise that resolves to the data URL
 */
function createPreviewDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    
    reader.onerror = function(e) {
      reject(new Error('Failed to read texture file'));
    };
    
    reader.readAsDataURL(file);
  });
} 