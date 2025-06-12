export function validateGLBHeader(dataView) {
    if (dataView.byteLength < 12) {
        throw new Error('Invalid GLB: File too small');
    }
    
    const magic = dataView.getUint32(0, true);
    const expectedMagic = 0x46546C67;
    if (magic !== expectedMagic) {
        throw new Error('Invalid GLB: Incorrect magic bytes');
    }
    
    const version = dataView.getUint32(4, true);
    if (version !== 2) {
        throw new Error(`Unsupported GLB version: ${version}`);
    }
}

export function validateJSONChunk(dataView, jsonChunkLength) {
    const jsonChunkType = dataView.getUint32(16, true);
    
    if (jsonChunkType !== 0x4E4F534A) {
        throw new Error('Invalid GLB: First chunk is not JSON');
    }
    
    const jsonStart = 20;
    const jsonEnd = jsonStart + jsonChunkLength;
    
    if (jsonEnd > dataView.byteLength) {
        throw new Error('Invalid GLB: JSON chunk extends beyond file size');
    }
}

export function validateBinaryChunk(dataView, binaryChunkOffset) {
    if (dataView.byteLength <= binaryChunkOffset + 8) {
        return false;
    }
    
    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
    if (binaryChunkType !== 0x004E4942) {
        throw new Error('Invalid GLB: Second chunk is not BIN');
    }
    
    return true;
}

export function isRemovalOperation(binaryData) {
    return !binaryData || binaryData.byteLength === 0;
}

export function hasExtension(gltf, extensionName) {
    return gltf.extensions && gltf.extensions[extensionName];
}

export function hasBufferURI(buffer) {
    return buffer.uri;
}

export function isDataURI(uri) {
    return uri.startsWith('data:');
}

export function getChunkInfo(dataView) {
    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonChunkType = dataView.getUint32(16, true);
    
    return {
        jsonChunkLength,
        jsonChunkType,
        jsonStart: 20,
        jsonEnd: 20 + jsonChunkLength,
        binaryChunkOffset: 20 + jsonChunkLength
    };
}