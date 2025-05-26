/**
 * ZIP File Processing Utility
 * 
 * Handles extraction and classification of assets from ZIP files
 */

// Import JSZip from CDN instead of npm package
// We'll dynamically import it when needed
import { TextureClassifier, ConfidenceLevel } from '../landing-page/texture-classifier';
import { updateState } from '../scene/state';

// Supported image formats for atlas textures
const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif'];
// Supported model formats
const SUPPORTED_MODEL_FORMATS = ['.glb', '.gltf'];
// Supported environment map formats
const SUPPORTED_ENV_FORMATS = ['.hdr', '.exr'];
// Supported background image formats (includes both environment formats and regular images)
const SUPPORTED_BG_FORMATS = [...SUPPORTED_ENV_FORMATS, ...SUPPORTED_IMAGE_FORMATS];

// Pattern to match macOS metadata files
const MACOS_METADATA_PATTERN = /^__MACOSX\/|\/\._|\._/;

// Enhanced texture naming patterns for better identification
const TEXTURE_NAME_PATTERNS = {
    baseColor: /\b(base[_-]?color|diffuse|albedo|base|col|color|basecolor)\b/i,
    normalMap: /\b(normal|nrm|nor|nrml|norm)\b/i,
    ormMap: /\b(orm|occlusion|roughness|metalness|metallic|rough|metal|ao|ambient[_-]?occlusion)\b/i
};

// Background image naming patterns
const BACKGROUND_NAME_PATTERNS = /\b(background|back|bg|backdrop|environment|env|sky|hdri)\b/i;

/**
 * Dynamically load JSZip from CDN
 * @returns {Promise<any>} JSZip module
 */
async function loadJSZip() {
    try {
        // Try to use the installed package first
        try {
            const JSZipModule = await import('jszip');
            console.log('[ZIP Util] Using installed JSZip package');
            return JSZipModule.default || JSZipModule;
        } catch (e) {
            console.log('[ZIP Util] Falling back to CDN JSZip');
            // If that fails, load from CDN
            const jsZipUrl = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
            
            // Create a script element to load JSZip
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = jsZipUrl;
                script.onload = () => {
                    // JSZip should now be available on the window object
                    if (window.JSZip) {
                        console.log('[ZIP Util] JSZip loaded from CDN');
                        resolve(window.JSZip);
                    } else {
                        reject(new Error('JSZip loaded from CDN but not available on window'));
                    }
                };
                script.onerror = () => {
                    reject(new Error('Failed to load JSZip from CDN'));
                };
                document.head.appendChild(script);
            });
        }
    } catch (error) {
        console.error('[ZIP Util] Error loading JSZip:', error);
        throw new Error('Failed to load JSZip: ' + error.message);
    }
}

/**
 * Check if a file is a macOS metadata file (in __MACOSX directory or starts with ._)
 * @param {string} filename - The filename to check
 * @returns {boolean} - Whether the file is a macOS metadata file
 */
function isMacOSMetadataFile(filename) {
    return MACOS_METADATA_PATTERN.test(filename);
}

/**
 * Improved texture type detection based on filename
 * @param {string} filename - The filename to analyze
 * @returns {Object} - Object with the detected type and confidence level
 */
function detectTextureTypeFromFilename(filename) {
    const lowerFilename = filename.toLowerCase();
    const baseName = lowerFilename.split('/').pop();
    
    // Check for explicit type indicators in the filename
    if (TEXTURE_NAME_PATTERNS.baseColor.test(baseName)) {
        return { type: 'basecolor', confidence: 0.9 };
    } else if (TEXTURE_NAME_PATTERNS.normalMap.test(baseName)) {
        return { type: 'normal', confidence: 0.9 };
    } else if (TEXTURE_NAME_PATTERNS.ormMap.test(baseName)) {
        return { type: 'orm', confidence: 0.9 };
    }
    
    // Check for common naming conventions with lower confidence
    if (baseName.includes('_color') || baseName.includes('-color')) {
        return { type: 'basecolor', confidence: 0.7 };
    } else if (baseName.includes('_normal') || baseName.includes('-normal')) {
        return { type: 'normal', confidence: 0.7 };
    } else if (baseName.includes('_orm') || baseName.includes('-orm')) {
        return { type: 'orm', confidence: 0.7 };
    }
    
    // Even looser pattern matching
    if (baseName.includes('color') || baseName.includes('col') || baseName.includes('albedo')) {
        return { type: 'basecolor', confidence: 0.5 };
    } else if (baseName.includes('nrm') || baseName.includes('nor')) {
        return { type: 'normal', confidence: 0.5 };
    } else if (baseName.includes('rough') || baseName.includes('metal') || baseName.includes('ao')) {
        return { type: 'orm', confidence: 0.5 };
    }
    
    // No pattern matches, return null with zero confidence
    return { type: null, confidence: 0 };
}

/**
 * Check if a file is a background image based on its name
 * @param {string} filename - The filename to check
 * @returns {boolean} - Whether the file appears to be a background image
 */
function isLikelyBackgroundImage(filename) {
    const lowerFilename = filename.toLowerCase();
    const baseName = lowerFilename.split('/').pop();
    
    return BACKGROUND_NAME_PATTERNS.test(baseName);
}

/**
 * Process a ZIP file, extract contents, and classify textures
 * @param {File} zipFile - The ZIP file to process
 * @returns {Promise<Object>} Processing results
 */
export async function processZipContents(zipFile) {
    console.log(`[ZIP Util] Processing ZIP file: ${zipFile.name} (${zipFile.size} bytes)`);
    
    try {
        // Load JSZip dynamically
        const JSZip = await loadJSZip();
        
        // Create a new ZIP instance
        const zip = new JSZip();
        const zipData = await zip.loadAsync(zipFile);
        
        // Extract file information and categorize by type
        const extractedFiles = {
            images: [],
            models: [],
            environmentMaps: [],
            backgroundImages: [],
            otherFiles: []
        };
        
        // Track files we've processed with full metadata
        const processedFiles = [];
        
        // Process each file in the ZIP
        for (const [filename, fileObj] of Object.entries(zipData.files)) {
            // Skip directories and macOS metadata files
            if (fileObj.dir || isMacOSMetadataFile(filename)) {
                if (isMacOSMetadataFile(filename)) {
                    console.log(`[ZIP Util] Skipping macOS metadata file: ${filename}`);
                }
                continue;
            }
            
            // Extract the file extension
            const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
            
            // Log file being processed
            console.log(`[ZIP Util] Processing file: ${filename} (${extension})`);
            
            // Add to appropriate category based on extension
            if (SUPPORTED_IMAGE_FORMATS.includes(extension)) {
                // Read the file content as a blob
                const blob = await fileObj.async('blob');
                
                // Create a File object from the blob
                const file = new File([blob], filename, { type: getImageMimeType(extension) });
                
                // Detect texture type based on filename
                const detectedType = detectTextureTypeFromFilename(filename);
                
                // Check if this is likely a background image
                const isBackground = isLikelyBackgroundImage(filename);
                
                // Add to images list
                extractedFiles.images.push({
                    file,
                    name: filename,
                    extension,
                    detectedType: detectedType.type,
                    confidence: detectedType.confidence,
                    isBackground
                });
                
                // Add to background images list if it has a background name
                if (isBackground) {
                    extractedFiles.backgroundImages.push({
                        file,
                        name: filename,
                        extension,
                        isNamed: true // Flag that this was found by name matching
                    });
                    console.log(`[ZIP Util] Detected background image by name: ${filename}`);
                } else {
                    // Regular images can also be used as backgrounds, but with lower priority
                    extractedFiles.backgroundImages.push({
                        file,
                        name: filename,
                        extension,
                        isNamed: false
                    });
                }
                
                // Add to processed files list
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'image',
                    extension,
                    detectedType: detectedType.type,
                    confidence: detectedType.confidence,
                    isBackground
                });
                
                console.log(`[ZIP Util] Detected type for ${filename}: ${detectedType.type || 'unknown'} (confidence: ${detectedType.confidence})`);
            } 
            else if (SUPPORTED_MODEL_FORMATS.includes(extension)) {
                // Read the file content as a blob
                const blob = await fileObj.async('blob');
                
                // Create a File object from the blob
                const file = new File([blob], filename, { type: 'model/gltf-binary' });
                
                // Add to models list
                extractedFiles.models.push({
                    file,
                    name: filename,
                    extension
                });
                
                // Add to processed files list
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'model',
                    extension
                });
                
                console.log(`[ZIP Util] Found model file: ${filename}`);
            }
            else if (SUPPORTED_ENV_FORMATS.includes(extension)) {
                // Read the file content as a blob
                const blob = await fileObj.async('blob');
                
                // Create a File object from the blob
                const file = new File([blob], filename, { type: 'application/octet-stream' });
                
                // Add to environment maps list
                extractedFiles.environmentMaps.push({
                    file,
                    name: filename,
                    extension
                });
                
                // Environment maps can also be background images
                extractedFiles.backgroundImages.push({
                    file,
                    name: filename,
                    extension,
                    isNamed: isLikelyBackgroundImage(filename) // Check if it has a background name
                });
                
                // Add to processed files list
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'environment',
                    extension
                });
                
                console.log(`[ZIP Util] Found environment map file: ${filename}`);
            }
            else {
                // Read the file content as a blob
                const blob = await fileObj.async('blob');
                
                // Create a File object from the blob
                const file = new File([blob], filename, { type: 'application/octet-stream' });
                
                // Add to other files list
                extractedFiles.otherFiles.push({
                    file,
                    name: filename,
                    extension
                });
                
                // Add to processed files list
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'other',
                    extension
                });
            }
        }
        
        console.log(`[ZIP Util] Extraction complete. Found: ${extractedFiles.images.length} images, ${extractedFiles.models.length} models, ${extractedFiles.environmentMaps.length} environment maps`);
        
        // Determine file types with the new priority order:
        // 1. File type check (extension-based classification we did above)
        // 2. Name detection (using our new enhanced detection function)
        // 3. Content structure check (using TextureClassifier for deeper analysis)
        
        // Analyze the extracted images to find atlas textures
        const atlasResults = await determineTextureTypes(extractedFiles.images);
        
        // Find the first model file (if any)
        const modelFile = extractedFiles.models.length > 0 ? extractedFiles.models[0].file : null;
        
        // Find the first lighting file (if any)
        const lightingFile = extractedFiles.environmentMaps.length > 0 ? extractedFiles.environmentMaps[0].file : null;
        
        // Find the first background file that has a background-related name
        // Sort background images to prioritize named ones first
        extractedFiles.backgroundImages.sort((a, b) => {
            // Prioritize files marked as named backgrounds
            if (a.isNamed && !b.isNamed) return -1;
            if (!a.isNamed && b.isNamed) return 1;
            return 0;
        });
        
        // Get the first background image (if any)
        const backgroundFile = extractedFiles.backgroundImages.length > 0 ? 
            extractedFiles.backgroundImages[0].file : null;
        
        // Collect all the results
        const results = {
            success: true,
            extractedFiles,
            processedFiles,
            atlasResults,
            modelFile,
            lightingFile,
            backgroundFile,
            hasNamedBackground: extractedFiles.backgroundImages.length > 0 && extractedFiles.backgroundImages[0].isNamed
        };
        
        // Auto-load the detected files into the appropriate dropzones
        handleAutoLoad(results);
        
        return results;
    } catch (error) {
        console.error('[ZIP Util] Error processing ZIP file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Automatically load the detected files into their respective dropzones
 * @param {Object} results - The ZIP processing results
 */
function handleAutoLoad(results) {
    if (!results.success) return;
    
    // Load textures
    if (results.atlasResults) {
        if (results.atlasResults.baseColor) {
            loadTextureIntoDropzone(results.atlasResults.baseColor.file, 'basecolor');
        }
        if (results.atlasResults.normalMap) {
            loadTextureIntoDropzone(results.atlasResults.normalMap.file, 'normal');
        }
        if (results.atlasResults.ormMap) {
            loadTextureIntoDropzone(results.atlasResults.ormMap.file, 'orm');
        }
    }
    
    // Load model if available
    if (results.modelFile) {
        loadModelIntoDropzone(results.modelFile);
    }
    
    // Load lighting file if available
    if (results.lightingFile) {
        loadLightingIntoDropzone(results.lightingFile);
    }
    
    // Load background file only if it had a background-related name
    if (results.backgroundFile && results.hasNamedBackground) {
        loadBackgroundIntoDropzone(results.backgroundFile);
    }
}

/**
 * Determine texture types using all available methods in the correct order
 * 1. File type check (already done during extraction)
 * 2. Name detection (using filename patterns)
 * 3. Content structure check (analyzing pixel data)
 * 
 * @param {Array} images - Array of image files to classify
 * @returns {Promise<Object>} Classification results
 */
async function determineTextureTypes(images) {
    console.log(`[ZIP Util] Determining texture types for ${images.length} images`);
    
    // Initialize the result object
    const result = {
        baseColor: null,
        normalMap: null,
        ormMap: null,
        unclassified: []
    };
    
    // If no images, return empty result
    if (!images || images.length === 0) {
        return result;
    }
    
    // Step 1: Sort images by confidence of name detection
    const sortedImages = [...images].sort((a, b) => {
        return (b.confidence || 0) - (a.confidence || 0);
    });
    
    // Step 2: First pass - assign based on high-confidence name detection (>0.7)
    for (const image of sortedImages) {
        if (image.confidence >= 0.7) {
            if (image.detectedType === 'basecolor' && !result.baseColor) {
                result.baseColor = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_high_confidence'
                };
                console.log(`[ZIP Util] High-confidence name match for baseColor: ${image.name}`);
            } else if (image.detectedType === 'normal' && !result.normalMap) {
                result.normalMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_high_confidence'
                };
                console.log(`[ZIP Util] High-confidence name match for normalMap: ${image.name}`);
            } else if (image.detectedType === 'orm' && !result.ormMap) {
                result.ormMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_high_confidence'
                };
                console.log(`[ZIP Util] High-confidence name match for ormMap: ${image.name}`);
            }
        }
    }
    
    // Step 3: Second pass - assign based on medium-confidence name detection (0.5-0.7)
    for (const image of sortedImages) {
        if (image.confidence >= 0.5 && image.confidence < 0.7) {
            if (image.detectedType === 'basecolor' && !result.baseColor) {
                result.baseColor = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_medium_confidence'
                };
                console.log(`[ZIP Util] Medium-confidence name match for baseColor: ${image.name}`);
            } else if (image.detectedType === 'normal' && !result.normalMap) {
                result.normalMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_medium_confidence'
                };
                console.log(`[ZIP Util] Medium-confidence name match for normalMap: ${image.name}`);
            } else if (image.detectedType === 'orm' && !result.ormMap) {
                result.ormMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_medium_confidence'
                };
                console.log(`[ZIP Util] Medium-confidence name match for ormMap: ${image.name}`);
            }
        }
    }
    
    // Step 4: Final pass - use content-based classification for remaining slots
    // Only classify images that haven't been assigned yet based on name detection
    const unassignedImages = sortedImages.filter(image => {
        if (result.baseColor && result.baseColor.fileName === image.name) return false;
        if (result.normalMap && result.normalMap.fileName === image.name) return false;
        if (result.ormMap && result.ormMap.fileName === image.name) return false;
        return true;
    });
    
    if (unassignedImages.length > 0) {
        console.log(`[ZIP Util] Running texture content classification on ${unassignedImages.length} unassigned images`);
        
        // Use texture classifier for deeper analysis of remaining images
        const contentClassifications = await classifyAtlasTextures(unassignedImages);
        
        // Fill in any remaining slots with content-based classifications
        if (!result.baseColor) {
            const bestBaseColor = findBestMatch(contentClassifications, 'base_color');
            if (bestBaseColor) {
                result.baseColor = {
                    file: bestBaseColor.file,
                    fileName: bestBaseColor.name,
                    source: 'content_classification'
                };
                console.log(`[ZIP Util] Content-based match for baseColor: ${bestBaseColor.name}`);
            }
        }
        
        if (!result.normalMap) {
            const bestNormalMap = findBestMatch(contentClassifications, 'normal_map');
            if (bestNormalMap) {
                result.normalMap = {
                    file: bestNormalMap.file,
                    fileName: bestNormalMap.name,
                    source: 'content_classification'
                };
                console.log(`[ZIP Util] Content-based match for normalMap: ${bestNormalMap.name}`);
            }
        }
        
        if (!result.ormMap) {
            const bestOrmMap = findBestMatch(contentClassifications, 'orm_map');
            if (bestOrmMap) {
                result.ormMap = {
                    file: bestOrmMap.file,
                    fileName: bestOrmMap.name,
                    source: 'content_classification'
                };
                console.log(`[ZIP Util] Content-based match for ormMap: ${bestOrmMap.name}`);
            }
        }
    }
    
    // Add remaining unclassified images
    result.unclassified = sortedImages.filter(image => {
        if (result.baseColor && result.baseColor.fileName === image.name) return false;
        if (result.normalMap && result.normalMap.fileName === image.name) return false;
        if (result.ormMap && result.ormMap.fileName === image.name) return false;
        return true;
    });
    
    console.log(`[ZIP Util] Texture classification complete. Results:`, {
        baseColor: result.baseColor ? result.baseColor.fileName : 'none',
        normalMap: result.normalMap ? result.normalMap.fileName : 'none',
        ormMap: result.ormMap ? result.ormMap.fileName : 'none',
        unclassified: result.unclassified.length
    });
    
    return result;
}

/**
 * Analyze and classify atlas textures using the TextureClassifier
 * @param {Array} images - Array of image files to classify
 * @returns {Promise<Array>} Classification results
 */
async function classifyAtlasTextures(images) {
    console.log(`[ZIP Util] Running deep texture classification on ${images.length} images`);
    
    // Create a new TextureClassifier instance
    const classifier = new TextureClassifier();
    
    // Initialize an array to store classification results
    const classifications = [];
    
    // Process each image
    for (const imageInfo of images) {
        try {
            // Create an image element for the classifier
            const img = document.createElement('img');
            
            // Convert the File to a data URL
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(imageInfo.file);
            });
            
            // Wait for the image to load
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            
            // Classify the image
            let classification = null;
            
            // Check if classifier.classifyImage exists
            if (typeof classifier.classifyImage === 'function') {
                classification = classifier.classifyImage(img);
            } else {
                // Fallback classification based on filename
                console.log('[ZIP Util] Using fallback classification for:', imageInfo.name);
                const filenameLower = imageInfo.name.toLowerCase();
                
                classification = {
                    base_color: null,
                    normal_map: null,
                    orm_map: null
                };
                
                // Simple classification rules based on filename
                if (filenameLower.includes('basecolor') || 
                    filenameLower.includes('base_color') || 
                    filenameLower.includes('albedo') ||
                    filenameLower.includes('diffuse') ||
                    filenameLower.includes('color') && !filenameLower.includes('normal')) {
                    classification.base_color = { confidence: 0.8 };
                }
                
                if (filenameLower.includes('normal') || 
                    filenameLower.includes('nrm') || 
                    filenameLower.includes('nor')) {
                    classification.normal_map = { confidence: 0.8 };
                }
                
                if (filenameLower.includes('orm') || 
                    filenameLower.includes('occlusion') ||
                    filenameLower.includes('roughness') ||
                    filenameLower.includes('metallic') ||
                    filenameLower.includes('metalness')) {
                    classification.orm_map = { confidence: 0.8 };
                }
            }
            
            // Add the file and filename to the classification results
            classification.file = imageInfo.file;
            classification.name = imageInfo.name;
            
            // Add to the results array
            classifications.push(classification);
            
            console.log(`[ZIP Util] Classified ${imageInfo.name} as:`, {
                baseColor: classification.base_color ? classification.base_color.confidence : 0,
                normalMap: classification.normal_map ? classification.normal_map.confidence : 0,
                ormMap: classification.orm_map ? classification.orm_map.confidence : 0
            });
        } catch (error) {
            console.error(`[ZIP Util] Error classifying image ${imageInfo.name}:`, error);
        }
    }
    
    return classifications;
}

/**
 * Find the best match for a given texture type
 * @param {Array} classifications - Array of classification results
 * @param {string} textureType - The texture type to find
 * @returns {Object|null} The best match or null if none found
 */
function findBestMatch(classifications, textureType) {
    if (!classifications || classifications.length === 0) {
        return null;
    }
    
    // Filter to only include classifications with the requested texture type
    const matches = classifications.filter(c => c[textureType]);
    
    if (matches.length === 0) {
        return null;
    }
    
    // Sort by confidence (highest first)
    matches.sort((a, b) => {
        const confidenceA = a[textureType] ? a[textureType].confidence : 0;
        const confidenceB = b[textureType] ? b[textureType].confidence : 0;
        return confidenceB - confidenceA;
    });
    
    // Return the best match
    return matches[0];
}

/**
 * Get the MIME type for an image extension
 * @param {string} extension - The file extension
 * @returns {string} The corresponding MIME type
 */
function getImageMimeType(extension) {
    switch (extension.toLowerCase()) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.tiff':
        case '.tif':
            return 'image/tiff';
        default:
            return 'application/octet-stream';
    }
}

/**
 * Load a texture file into the appropriate dropzone
 * @param {File} file - The texture file to load
 * @param {string} type - The texture type ('basecolor', 'normal', or 'orm')
 */
export function loadTextureIntoDropzone(file, type) {
    if (!file) return;
    
    console.log(`[ZIP Util] Loading ${type} texture into dropzone:`, file.name);
    
    // Validate type
    if (!['basecolor', 'normal', 'orm'].includes(type)) {
        console.warn(`[ZIP Util] Invalid texture type: ${type}`);
        return;
    }
    
    // Create a FileList-like object
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    // Create a drop event
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    // Add dataTransfer property with files
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    // Get the dropzone element
    const dropzone = document.getElementById(`${type}-dropzone`);
    
    if (dropzone) {
        // Dispatch the drop event on the dropzone
        dropzone.dispatchEvent(dropEvent);
        console.log(`[ZIP Util] Dispatched drop event for ${type} dropzone`);
    } else {
        console.warn(`[ZIP Util] Could not find ${type} dropzone element`);
    }
}

/**
 * Load a model file into the model dropzone
 * @param {File} file - The model file to load
 */
export function loadModelIntoDropzone(file) {
    if (!file) return;
    
    console.log(`[ZIP Util] Loading model into model dropzone:`, file.name);
    
    // Create a FileList-like object
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    // Create a drop event
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    // Add dataTransfer property with files
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    // Get the dropzone element
    const dropzone = document.getElementById('model-dropzone');
    
    if (dropzone) {
        // Dispatch the drop event on the dropzone
        dropzone.dispatchEvent(dropEvent);
        console.log(`[ZIP Util] Dispatched drop event for model dropzone`);
    } else {
        console.warn(`[ZIP Util] Could not find model dropzone element`);
    }
}

/**
 * Load a lighting file (HDR/EXR) into the lighting dropzone
 * @param {File} file - The lighting file to load
 */
export function loadLightingIntoDropzone(file) {
    if (!file) return;
    
    console.log(`[ZIP Util] Loading lighting file into lighting dropzone:`, file.name);
    
    // Create a FileList-like object
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    // Create a drop event
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    // Add dataTransfer property with files
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    // Get the dropzone element
    const dropzone = document.getElementById('lighting-dropzone');
    
    if (dropzone) {
        // Dispatch the drop event on the dropzone
        dropzone.dispatchEvent(dropEvent);
        console.log(`[ZIP Util] Dispatched drop event for lighting dropzone`);
    } else {
        console.warn(`[ZIP Util] Could not find lighting dropzone element`);
    }
}

/**
 * Load a background image into the background dropzone
 * @param {File} file - The background image to load
 */
export function loadBackgroundIntoDropzone(file) {
    if (!file) return;
    
    console.log(`[ZIP Util] Loading background image into background dropzone:`, file.name);
    
    // Create a FileList-like object
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    // Create a drop event
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    // Add dataTransfer property with files
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    // Get the dropzone element
    const dropzone = document.getElementById('background-dropzone');
    
    if (dropzone) {
        // Dispatch the drop event on the dropzone
        dropzone.dispatchEvent(dropEvent);
        console.log(`[ZIP Util] Dispatched drop event for background dropzone`);
    } else {
        console.warn(`[ZIP Util] Could not find background dropzone element`);
    }
}

/**
 * Update application state with the best textures from atlas results
 * @param {Object} atlasResults - The atlas texture classification results
 */
export function updateStateWithBestTextures(atlasResults) {
    if (!atlasResults) return;
    
    console.log('[ZIP Util] Updating state with best textures:', atlasResults);
    
    // Update state with base color
    if (atlasResults.baseColor) {
        updateState({
            textureObjects: {
                baseColor: atlasResults.baseColor.file
            }
        });
    }
    
    // Update state with normal map
    if (atlasResults.normalMap) {
        updateState({
            textureObjects: {
                normal: atlasResults.normalMap.file
            }
        });
    }
    
    // Update state with ORM map
    if (atlasResults.ormMap) {
        updateState({
            textureObjects: {
                orm: atlasResults.ormMap.file
            }
        });
    }
}

/**
 * Update application state with model, lighting, and background files
 * @param {Object} results - The ZIP processing results
 */
export function updateStateWithOtherAssets(results) {
    if (!results || !results.success) return;
    
    const updates = {};
    
    // Update model file if found
    if (results.modelFile) {
        updates.modelFile = results.modelFile;
        updates.useCustomModel = true;
    }
    
    // Update lighting file if found
    if (results.lightingFile) {
        updates.lightingFile = results.lightingFile;
    }
    
    // Update background file if found (and it had a background-related name)
    if (results.backgroundFile && results.hasNamedBackground) {
        updates.backgroundFile = results.backgroundFile;
    }
    
    // Apply all updates at once
    if (Object.keys(updates).length > 0) {
        console.log('[ZIP Util] Updating state with additional assets:', updates);
        updateState(updates);
    }
} 