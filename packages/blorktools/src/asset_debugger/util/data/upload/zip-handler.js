import { formatFileSize } from "./file-upload-manager";
import { TextureClassifier } from "../texture-classifier";
import { updateState } from "../../state/scene-state";

const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif'];
const SUPPORTED_MODEL_FORMATS = ['.glb', '.gltf'];
const SUPPORTED_ENV_FORMATS = ['.hdr', '.exr'];
const SUPPORTED_BG_FORMATS = [...SUPPORTED_ENV_FORMATS, ...SUPPORTED_IMAGE_FORMATS];
const MACOS_METADATA_PATTERN = /^__MACOSX\/|\/\._|\._/;

const TEXTURE_NAME_PATTERNS = {
    baseColor: /\b(base[_-]?color|diffuse|albedo|base|col|color|basecolor)\b/i,
    normalMap: /\b(normal|nrm|nor|nrml|norm)\b/i,
    ormMap: /\b(orm|occlusion|roughness|metalness|metallic|rough|metal|ao|ambient[_-]?occlusion)\b/i
};

const BACKGROUND_NAME_PATTERNS = /\b(background|back|bg|backdrop|environment|env|sky|hdri)\b/i;

async function loadJSZip() {
    try {
        try {
            const JSZipModule = await import('jszip');
            return JSZipModule.default || JSZipModule;
        } catch (e) {
            const jsZipUrl = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
            
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = jsZipUrl;
                script.onload = () => {
                    if (window.JSZip) {
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
        throw new Error('Failed to load JSZip: ' + error.message);
    }
}

function isMacOSMetadataFile(filename) {
    return MACOS_METADATA_PATTERN.test(filename);
}

function detectTextureTypeFromFilename(filename) {
    const lowerFilename = filename.toLowerCase();
    const baseName = lowerFilename.split('/').pop();
    
    if (TEXTURE_NAME_PATTERNS.baseColor.test(baseName)) {
        return { type: 'basecolor', confidence: 0.9 };
    } else if (TEXTURE_NAME_PATTERNS.normalMap.test(baseName)) {
        return { type: 'normal', confidence: 0.9 };
    } else if (TEXTURE_NAME_PATTERNS.ormMap.test(baseName)) {
        return { type: 'orm', confidence: 0.9 };
    }
    
    if (baseName.includes('_color') || baseName.includes('-color')) {
        return { type: 'basecolor', confidence: 0.7 };
    } else if (baseName.includes('_normal') || baseName.includes('-normal')) {
        return { type: 'normal', confidence: 0.7 };
    } else if (baseName.includes('_orm') || baseName.includes('-orm')) {
        return { type: 'orm', confidence: 0.7 };
    }
    
    if (baseName.includes('color') || baseName.includes('col') || baseName.includes('albedo')) {
        return { type: 'basecolor', confidence: 0.5 };
    } else if (baseName.includes('nrm') || baseName.includes('nor')) {
        return { type: 'normal', confidence: 0.5 };
    } else if (baseName.includes('rough') || baseName.includes('metal') || baseName.includes('ao')) {
        return { type: 'orm', confidence: 0.5 };
    }
    
    return { type: null, confidence: 0 };
}

function isLikelyBackgroundImage(filename) {
    const lowerFilename = filename.toLowerCase();
    const baseName = lowerFilename.split('/').pop();
    
    return BACKGROUND_NAME_PATTERNS.test(baseName);
}

export async function processZipContents(zipFile) {
    try {
        const JSZip = await loadJSZip();
        
        const zip = new JSZip();
        const zipData = await zip.loadAsync(zipFile);
        
        const extractedFiles = {
            images: [],
            models: [],
            environmentMaps: [],
            backgroundImages: [],
            otherFiles: []
        };
        
        const processedFiles = [];
        
        for (const [filename, fileObj] of Object.entries(zipData.files)) {
            if (fileObj.dir || isMacOSMetadataFile(filename)) {
                continue;
            }
            
            const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
            
            if (SUPPORTED_IMAGE_FORMATS.includes(extension)) {
                const blob = await fileObj.async('blob');
                const file = new File([blob], filename, { type: getImageMimeType(extension) });
                
                const detectedType = detectTextureTypeFromFilename(filename);
                const isBackground = isLikelyBackgroundImage(filename);
                
                extractedFiles.images.push({
                    file,
                    name: filename,
                    extension,
                    detectedType: detectedType.type,
                    confidence: detectedType.confidence,
                    isBackground
                });
                
                if (isBackground) {
                    extractedFiles.backgroundImages.push({
                        file,
                        name: filename,
                        extension,
                        isNamed: true
                    });
                } else {
                    extractedFiles.backgroundImages.push({
                        file,
                        name: filename,
                        extension,
                        isNamed: false
                    });
                }
                
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'image',
                    extension,
                    detectedType: detectedType.type,
                    confidence: detectedType.confidence,
                    isBackground
                });
            } 
            else if (SUPPORTED_MODEL_FORMATS.includes(extension)) {
                const blob = await fileObj.async('blob');
                const file = new File([blob], filename, { type: 'model/gltf-binary' });
                
                extractedFiles.models.push({
                    file,
                    name: filename,
                    extension
                });
                
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'model',
                    extension
                });
            }
            else if (SUPPORTED_ENV_FORMATS.includes(extension)) {
                const blob = await fileObj.async('blob');
                const file = new File([blob], filename, { type: 'application/octet-stream' });
                
                extractedFiles.environmentMaps.push({
                    file,
                    name: filename,
                    extension
                });
                
                extractedFiles.backgroundImages.push({
                    file,
                    name: filename,
                    extension,
                    isNamed: isLikelyBackgroundImage(filename)
                });
                
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'environment',
                    extension
                });
            }
            else {
                const blob = await fileObj.async('blob');
                const file = new File([blob], filename, { type: 'application/octet-stream' });
                
                extractedFiles.otherFiles.push({
                    file,
                    name: filename,
                    extension
                });
                
                processedFiles.push({
                    file,
                    name: filename,
                    type: 'other',
                    extension
                });
            }
        }
        
        const atlasResults = await determineTextureTypes(extractedFiles.images);
        
        const modelFile = extractedFiles.models.length > 0 ? extractedFiles.models[0].file : null;
        const lightingFile = extractedFiles.environmentMaps.length > 0 ? extractedFiles.environmentMaps[0].file : null;
        
        extractedFiles.backgroundImages.sort((a, b) => {
            if (a.isNamed && !b.isNamed) return -1;
            if (!a.isNamed && b.isNamed) return 1;
            return 0;
        });
        
        const backgroundFile = extractedFiles.backgroundImages.length > 0 ? 
            extractedFiles.backgroundImages[0].file : null;
        
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
        
        handleAutoLoad(results);
        
        return results;
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

export function handleAutoLoad(results) {
    if (!results.success) return;
    
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
    
    if (results.modelFile) {
        loadModelIntoDropzone(results.modelFile);
    }
    
    if (results.lightingFile) {
        loadLightingIntoDropzone(results.lightingFile);
    }
    
    if (results.backgroundFile && results.hasNamedBackground) {
        loadBackgroundIntoDropzone(results.backgroundFile);
    }
}

async function determineTextureTypes(images) {
    const result = {
        baseColor: null,
        normalMap: null,
        ormMap: null,
        unclassified: []
    };
    
    if (!images || images.length === 0) {
        return result;
    }
    
    const sortedImages = [...images].sort((a, b) => {
        return (b.confidence || 0) - (a.confidence || 0);
    });
    
    for (const image of sortedImages) {
        if (image.confidence >= 0.7) {
            if (image.detectedType === 'basecolor' && !result.baseColor) {
                result.baseColor = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_high_confidence'
                };
            } else if (image.detectedType === 'normal' && !result.normalMap) {
                result.normalMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_high_confidence'
                };
            } else if (image.detectedType === 'orm' && !result.ormMap) {
                result.ormMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_high_confidence'
                };
            }
        }
    }
    
    for (const image of sortedImages) {
        if (image.confidence >= 0.5 && image.confidence < 0.7) {
            if (image.detectedType === 'basecolor' && !result.baseColor) {
                result.baseColor = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_medium_confidence'
                };
            } else if (image.detectedType === 'normal' && !result.normalMap) {
                result.normalMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_medium_confidence'
                };
            } else if (image.detectedType === 'orm' && !result.ormMap) {
                result.ormMap = {
                    file: image.file,
                    fileName: image.name,
                    source: 'name_detection_medium_confidence'
                };
            }
        }
    }
    
    const unassignedImages = sortedImages.filter(image => {
        if (result.baseColor && result.baseColor.fileName === image.name) return false;
        if (result.normalMap && result.normalMap.fileName === image.name) return false;
        if (result.ormMap && result.ormMap.fileName === image.name) return false;
        return true;
    });
    
    if (unassignedImages.length > 0) {
        const contentClassifications = await classifyAtlasTextures(unassignedImages);
        
        if (!result.baseColor) {
            const bestBaseColor = findBestMatch(contentClassifications, 'base_color');
            if (bestBaseColor) {
                result.baseColor = {
                    file: bestBaseColor.file,
                    fileName: bestBaseColor.name,
                    source: 'content_classification'
                };
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
            }
        }
    }
    
    result.unclassified = sortedImages.filter(image => {
        if (result.baseColor && result.baseColor.fileName === image.name) return false;
        if (result.normalMap && result.normalMap.fileName === image.name) return false;
        if (result.ormMap && result.ormMap.fileName === image.name) return false;
        return true;
    });
    
    return result;
}

async function classifyAtlasTextures(images) {
    const classifier = new TextureClassifier();
    const classifications = [];
    
    for (const imageInfo of images) {
        try {
            const img = document.createElement('img');
            
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(imageInfo.file);
            });
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            
            let classification = null;
            
            if (typeof classifier.classifyImage === 'function') {
                classification = classifier.classifyImage(img);
            } else {
                const filenameLower = imageInfo.name.toLowerCase();
                
                classification = {
                    base_color: null,
                    normal_map: null,
                    orm_map: null
                };
                
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
            
            classification.file = imageInfo.file;
            classification.name = imageInfo.name;
            
            classifications.push(classification);
        } catch (error) {
            // Classification failed for this image
        }
    }
    
    return classifications;
}

function findBestMatch(classifications, textureType) {
    if (!classifications || classifications.length === 0) {
        return null;
    }
    
    const matches = classifications.filter(c => c[textureType]);
    
    if (matches.length === 0) {
        return null;
    }
    
    matches.sort((a, b) => {
        const confidenceA = a[textureType] ? a[textureType].confidence : 0;
        const confidenceB = b[textureType] ? b[textureType].confidence : 0;
        return confidenceB - confidenceA;
    });
    
    return matches[0];
}

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

export function loadTextureIntoDropzone(file, type) {
    if (!file) return;
    
    if (!['basecolor', 'normal', 'orm'].includes(type)) {
        return;
    }
    
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    const dropzone = document.getElementById(`${type}-dropzone`);
    
    if (dropzone) {
        dropzone.dispatchEvent(dropEvent);
    }
}

export function loadModelIntoDropzone(file) {
    if (!file) return;
    
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    const dropzone = document.getElementById('model-dropzone');
    
    if (dropzone) {
        dropzone.dispatchEvent(dropEvent);
    }
}

export function loadLightingIntoDropzone(file) {
    if (!file) return;
    
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    const dropzone = document.getElementById('lighting-dropzone');
    
    if (dropzone) {
        dropzone.dispatchEvent(dropEvent);
    }
}

export function loadBackgroundIntoDropzone(file) {
    if (!file) return;
    
    const fileList = {
        0: file,
        length: 1,
        item: (index) => index === 0 ? file : null
    };
    
    const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true
    });
    
    Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
            files: fileList
        }
    });
    
    const dropzone = document.getElementById('background-dropzone');
    
    if (dropzone) {
        dropzone.dispatchEvent(dropEvent);
    }
}

export function updateStateWithBestTextures(atlasResults) {
    if (!atlasResults) return;
    
    if (atlasResults.baseColor) {
        updateState({
            textureObjects: {
                baseColor: atlasResults.baseColor.file
            }
        });
    }
    
    if (atlasResults.normalMap) {
        updateState({
            textureObjects: {
                normal: atlasResults.normalMap.file
            }
        });
    }
    
    if (atlasResults.ormMap) {
        updateState({
            textureObjects: {
                orm: atlasResults.ormMap.file
            }
        });
    }
}

export function updateStateWithOtherAssets(results) {
    if (!results || !results.success) return;
    
    const updates = {};
    
    if (results.modelFile) {
        updates.modelFile = results.modelFile;
        updates.useCustomModel = true;
    }
    
    if (results.lightingFile) {
        updates.lightingFile = results.lightingFile;
    }
    
    if (results.backgroundFile && results.hasNamedBackground) {
        updates.backgroundFile = results.backgroundFile;
    }
    
    if (Object.keys(updates).length > 0) {
        updateState(updates);
    }
}

export function handleZipUpload(file, infoElement, previewElement, dropzone) {
    updateState('zipFile', file);
    
    const zipInfoElement = document.getElementById('zip-info');
    if (zipInfoElement) {
        zipInfoElement.textContent = `ZIP file received: ${file.name} (${formatFileSize(file.size)})`;
        zipInfoElement.style.display = 'block';
        zipInfoElement.style.color = '';
        
        setTimeout(() => {
            zipInfoElement.style.display = 'none';
        }, 5000);
    }
    
    processZipContents(file);
    
    const event = new CustomEvent('zip-uploaded', { 
        detail: { file }
    });
    document.dispatchEvent(event);
}