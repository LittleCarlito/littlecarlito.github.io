import { 
    ANALYSIS_DURATION_MS,
    animationDuration,
    isAnimationFinite,
    isPlaybackActive, 
    playbackStartTime, 
    preRenderedFrames, 
    setIsPlaybackActive, 
    setIsPreviewAnimationPaused, 
    setPlaybackStartTime 
} from "../state/animation-state";

/**
 * Start playback timing - called when preview should begin playing
 */
export function startPlayback() {
    setPlaybackStartTime(Date.now());
    setIsPlaybackActive(true);
    console.log('Playback started at:', playbackStartTime);
}

/**
 * Stop playback timing
 */
export function stopPlayback() {
    setIsPlaybackActive(false);
    console.log('Playback stopped');
}

/**
 * Get current frame based on elapsed playback time
 */
export function getCurrentFrameForPlayback(playbackSpeed = 1.0, animationType = 'play') {
    if (!isPlaybackActive || preRenderedFrames.length === 0) {
        return preRenderedFrames.length > 0 ? preRenderedFrames[preRenderedFrames.length - 1] : null;
    }
    
    const now = Date.now();
    const playbackElapsed = now - playbackStartTime;
    const adjustedElapsed = playbackElapsed * playbackSpeed;
    
    // Use the analysis duration as our animation duration
    // This represents the full time period we analyzed for animation
    const naturalDuration = isAnimationFinite && animationDuration > 0 ? 
        animationDuration : ANALYSIS_DURATION_MS;
    
    let normalizedTime;
    
    switch (animationType) {
        case 'play':
            if (adjustedElapsed >= naturalDuration) {
                setIsPreviewAnimationPaused(true);
                return preRenderedFrames[preRenderedFrames.length - 1];
            }
            normalizedTime = adjustedElapsed / naturalDuration;
            break;
            
        case 'loop':
            normalizedTime = (adjustedElapsed % naturalDuration) / naturalDuration;
            break;
            
        case 'bounce':
            const cycle = Math.floor(adjustedElapsed / naturalDuration);
            const position = (adjustedElapsed % naturalDuration) / naturalDuration;
            normalizedTime = (cycle % 2 === 0) ? position : (1 - position);
            break;
            
        default:
            normalizedTime = (adjustedElapsed % naturalDuration) / naturalDuration;
            break;
    }
    
    const frameIndex = Math.min(
        Math.floor(normalizedTime * preRenderedFrames.length),
        preRenderedFrames.length - 1
    );
    
    return preRenderedFrames[frameIndex];
}



/**
 * Update the mesh texture with the given texture
 * @param {THREE.Texture} texture - The texture to apply to the mesh
 * @param {THREE.Mesh} previewPlane - The mesh to update with the texture
 */
export function updateMeshTexture(texture, previewPlane) {
    if (!texture || !previewPlane || !previewPlane.material) return;
    
    let needsUpdate = false;
    
    if (Array.isArray(previewPlane.material)) {
        previewPlane.material.forEach(material => {
            if (material.map !== texture) {
                material.map = texture;
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            previewPlane.material.forEach(material => {
                material.needsUpdate = true;
            });
        }
    } else {
        if (previewPlane.material.map !== texture) {
            previewPlane.material.map = texture;
            previewPlane.material.needsUpdate = true;
        }
    }
}