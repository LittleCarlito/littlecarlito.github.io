/**
 * Worker Manager
 * 
 * This module manages the creation and communication with web workers for file processing.
 */

// Track active workers by ID
const activeWorkers = new Map();

// Counter for generating unique worker IDs
let workerIdCounter = 0;

/**
 * Get a unique ID for a worker
 * @returns {string} A unique worker ID
 */
function getWorkerId() {
  return `worker_${Date.now()}_${workerIdCounter++}`;
}

/**
 * Process a texture file using a web worker
 * @param {File} file - The texture file to process
 * @param {string} textureType - The type of texture (baseColor, orm, normal)
 * @returns {Promise<Object>} A promise that resolves with the worker result
 */
export function processTextureFile(file, textureType) {
  return new Promise((resolve, reject) => {
    try {
      const workerId = getWorkerId();
      
      // Create a new worker
      const worker = new Worker(new URL('./texture-worker.js', import.meta.url), { type: 'module' });
      
      // Set up message handler for receiving results
      worker.onmessage = (e) => {
        const result = e.data;
        
        if (result.status === 'success') {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Unknown error in texture worker'));
        }
        
        // Clean up
        cleanupWorker(workerId);
      };
      
      // Set up error handler
      worker.onerror = (error) => {
        console.error('Texture worker error:', error);
        reject(new Error('Worker error: ' + (error.message || 'Unknown error')));
        cleanupWorker(workerId);
      };
      
      // Store the worker in the map
      activeWorkers.set(workerId, worker);
      
      // Send the file to the worker
      worker.postMessage({
        file,
        textureType,
        id: workerId
      });
      
    } catch (error) {
      console.error('Error starting texture worker:', error);
      reject(error);
    }
  });
}

/**
 * Process a model file using a web worker
 * @param {File} file - The model file to process
 * @returns {Promise<Object>} A promise that resolves with the worker result
 */
export function processModelFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const workerId = getWorkerId();
      
      // Create a new worker
      const worker = new Worker(new URL('./model-worker.js', import.meta.url), { type: 'module' });
      
      // Set up message handler for receiving results
      worker.onmessage = (e) => {
        const result = e.data;
        
        if (result.status === 'success') {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Unknown error in model worker'));
        }
        
        // Clean up
        cleanupWorker(workerId);
      };
      
      // Set up error handler
      worker.onerror = (error) => {
        console.error('Model worker error:', error);
        reject(new Error('Worker error: ' + (error.message || 'Unknown error')));
        cleanupWorker(workerId);
      };
      
      // Store the worker in the map
      activeWorkers.set(workerId, worker);
      
      // Send the file to the worker
      worker.postMessage({
        file,
        id: workerId
      });
      
    } catch (error) {
      console.error('Error starting model worker:', error);
      reject(error);
    }
  });
}

/**
 * Process a lighting file using a web worker
 * @param {File} file - The lighting file to process
 * @returns {Promise<Object>} A promise that resolves with the worker result
 */
export function processLightingFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const workerId = getWorkerId();
      
      // Create a new worker
      const worker = new Worker(new URL('./lighting-worker.js', import.meta.url), { type: 'module' });
      
      // Set up message handler for receiving results
      worker.onmessage = (e) => {
        const result = e.data;
        
        if (result.status === 'success') {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Unknown error in lighting worker'));
        }
        
        // Clean up
        cleanupWorker(workerId);
      };
      
      // Set up error handler
      worker.onerror = (error) => {
        console.error('Lighting worker error:', error);
        reject(new Error('Worker error: ' + (error.message || 'Unknown error')));
        cleanupWorker(workerId);
      };
      
      // Store the worker in the map
      activeWorkers.set(workerId, worker);
      
      // Send the file to the worker
      worker.postMessage({
        file,
        id: workerId
      });
      
    } catch (error) {
      console.error('Error starting lighting worker:', error);
      reject(error);
    }
  });
}

/**
 * Clean up a worker by ID
 * @param {string} workerId - The ID of the worker to clean up
 */
function cleanupWorker(workerId) {
  if (activeWorkers.has(workerId)) {
    const worker = activeWorkers.get(workerId);
    worker.terminate();
    activeWorkers.delete(workerId);
    console.log(`Worker ${workerId} terminated and cleaned up`);
  }
}

/**
 * Check if there are any active workers
 * @returns {boolean} True if there are active workers, false otherwise
 */
export function hasActiveWorkers() {
  return activeWorkers.size > 0;
}

/**
 * Terminate all active workers
 */
export function terminateAllWorkers() {
  for (const [id, worker] of activeWorkers.entries()) {
    worker.terminate();
    console.log(`Worker ${id} terminated`);
  }
  activeWorkers.clear();
  console.log('All workers terminated');
}

export default {
  processTextureFile,
  processModelFile,
  processLightingFile,
  hasActiveWorkers,
  terminateAllWorkers
}; 