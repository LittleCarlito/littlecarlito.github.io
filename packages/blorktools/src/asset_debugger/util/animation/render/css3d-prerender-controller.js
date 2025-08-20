import { showStatus } from "../../../modals/html-editor-modal/html-editor-modal";
import { createMeshInfoPanel } from "../../../widgets/mesh-info-widget";
import { updateMeshTexture } from "../playback/animation-playback-controller";
import { 
    animationCaptureStartTime,
    animationDuration, 
    animationPlaybackStartTime, 
    finalProgressAnimation, 
    finalProgressDuration, 
    finalProgressStartTime, 
    isAnimationFinite, 
    isPreviewActive, 
    preRenderedFrames, 
    preRenderingInProgress, 
    preRenderMaxDuration, 
    setAnimationCaptureStartTime, 
    setAnimationDuration, 
    setAnimationPlaybackStartTime, 
    setFinalProgressAnimation, 
    setFinalProgressStartTime, 
    setIsAnimationFinite, 
    setIsPreviewAnimationPaused, 
    setPreRenderedFrames, 
    setPreRenderingInProgress 
} from "../../state/animation-state";
import { logAnimationAnalysisReport } from "../../state/log-util";
import { injectUnifiedAnimationDetectionScript } from "../../data/animation-classifier";

/**
 * Start pre-rendering for CSS3D content
 * @param {HTMLIFrameElement} iframe - The iframe containing the content
 * @param {Function} callback - Function to call when pre-rendering is complete
 * @param {HTMLElement} progressBar - Optional progress bar element to update
 * @param {Object} settings - Optional settings object
 * @param {THREE.Mesh} previewPlane - The mesh to apply textures to
 */
export function startCss3dPreRendering(iframe, callback, progressBar = null, settings = null, previewPlane = null) {
    if (!iframe) {
        console.error('No iframe provided for CSS3D pre-rendering');
        if (callback) callback();
        return;
    }
    
    // Reset and initialize state
    setPreRenderingInProgress(true);
    setPreRenderedFrames([]);
    
    // Tracking variables
    let domSnapshotFrames = [];
    const preRenderStartTime = Date.now();
    
    // Progress tracking
    let lastProgressUpdate = 0;
    let progressUpdateInterval = 100; // Update progress every 100ms
    let maxProgressBeforeFinalAnimation = 92; // Cap progress at this value until final animation
    setFinalProgressAnimation(false);
    setFinalProgressStartTime(0);
    
    // Analysis metrics tracking
    let loopDetected = false;
    let endDetected = false;
    let analysisMetrics = {};
    let detectedLoopSize = 0;
    
    // Track the last capture time to pace captures similar to image2texture
    let lastCaptureTime = 0;
    let captureInterval = 350; // Start with 350ms between captures
    
    // Track total frames estimate
    let totalFramesEstimate = 120; // Initial estimate
    
    console.log('Starting CSS3D pre-rendering analysis...');
    
    // Get animation settings from passed settings object instead of DOM
    let isLongExposureMode = false;
    let playbackSpeed = 1.0;
    
    if (settings) {
        // Use settings parameters instead of DOM elements
        isLongExposureMode = settings.isLongExposureMode;
        playbackSpeed = settings.playbackSpeed || 1.0;
    } else {
        // Fallback to DOM access if settings not provided (for backward compatibility)
        const animationTypeSelect = document.getElementById('html-animation-type');
        isLongExposureMode = animationTypeSelect && animationTypeSelect.value === 'longExposure';
    }
    
    // Set flag if we're capturing for long exposure
    if (isLongExposureMode) {
        setCapturingForLongExposure(true);
        
        // Temporarily disable borders during capture
        const originalBorderSetting = window.showPreviewBorders;
        window.showPreviewBorders = false;
        console.log('Borders temporarily disabled for long exposure capture');
        
        // Store original setting to restore later
        window._originalBorderSetting = originalBorderSetting;
    }
    
    // Function to update progress bar
    const updateProgress = (percent) => {
        if (progressBar) {
            // Ensure progress never exceeds maxProgressBeforeFinalAnimation unless in final animation
            if (!finalProgressAnimation && percent > maxProgressBeforeFinalAnimation) {
                percent = maxProgressBeforeFinalAnimation;
            }
            progressBar.style.width = `${percent}%`;
        }
    };
    
    // Function to create the long exposure texture and apply it
    const createAndApplyCss3dLongExposure = () => {
        if (domSnapshotFrames.length > 0) {
            // Use playbackSpeed from settings instead of DOM
            const longExposureTexture = createLongExposureTexture(domSnapshotFrames, playbackSpeed);
            
            // Update the iframe with the long exposure texture
            if (previewPlane) {
                updateMeshTexture(longExposureTexture, previewPlane);
            }
            
            // Show a message about the long exposure
            showStatus(`CSS3D Long exposure created from ${domSnapshotFrames.length} frames`, 'success');
            
            // Pause animation since we just want to display the static image
            setIsPreviewAnimationPaused(true);
        }
    };
    
    // Function to start final progress animation
    const startFinalProgressAnimation = () => {
        if (finalProgressAnimation) return; // Already animating
        
        setFinalProgressAnimation(true);
        setFinalProgressStartTime(Date.now());
        
        // Start the animation loop
        animateFinalProgress();
    };
    
    // Function to animate progress to 100%
    const animateFinalProgress = () => {
        const now = Date.now();
        const elapsed = now - finalProgressStartTime;
        
        if (elapsed >= finalProgressDuration) {
            // Animation complete, set to 100%
            updateProgress(100);
            
            // Log animation analysis report
            logAnimationAnalysisReport('CSS3D', {
                frameCount: domSnapshotFrames.length,
                duration: animationDuration,
                isFinite: isAnimationFinite,
                loopDetected,
                endDetected,
                analysisTime: now - preRenderStartTime,
                metrics: {
                    ...analysisMetrics,
                    loopSize: detectedLoopSize,
                    domSnapshotCount: domSnapshotFrames.length
                }
            });
            
            // Store the DOM snapshot frames in the preRenderedFrames array for compatibility
            setPreRenderedFrames(domSnapshotFrames);
            
            // Hide loading overlay with fade out
            const loadingOverlay = document.getElementById('pre-rendering-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.transition = 'opacity 0.5s ease';
                loadingOverlay.style.opacity = '0';
                
                // Remove after fade out
                setTimeout(() => {
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.parentNode.removeChild(loadingOverlay);
                    }
                    
                    // CRITICAL: Initialize playback timing for ALL animation types
                    initializePlaybackTiming();
                    
                    // Now create the info panel after pre-rendering is complete
                    const canvasContainer = document.querySelector('#html-preview-content');
                    if (canvasContainer) {
                        const modal = document.getElementById('html-editor-modal');
                        const currentMeshId = parseInt(modal.dataset.meshId);
                        createMeshInfoPanel(canvasContainer, currentMeshId);
                    }
                    
                    // Handle different animation types
                    if (isLongExposureMode && preRenderedFrames.length > 0) {
                        // For long exposure, create the static image
                        const longExposureTexture = createLongExposureTexture(preRenderedFrames, playbackSpeed);
                        
                        if (previewPlane) {
                            updateMeshTexture(longExposureTexture, previewPlane);
                        }
                        
                        showStatus(`Long exposure created from ${preRenderedFrames.length} frames`, 'success');
                        setIsPreviewAnimationPaused(true);
                    } else {
                        // For all other types, start playback
                        setIsPreviewAnimationPaused(false);
                        
                        const typeDescription = isAnimationFinite ? 
                            `finite (${(animationDuration/1000).toFixed(1)}s)` : 
                            'static/infinite';
                            
                        showStatus(`Animation playback starting - ${typeDescription}, ${preRenderedFrames.length} frames at ${playbackSpeed}x speed`, 'success');
                    }
                    
                    // Execute the callback if provided
                    if (typeof callback === 'function') {
                        callback();
                    }
                }, 500);
                
                // Don't continue the animation
                return;
            } else {
                // If no loading overlay found, still execute the callback
                if (typeof callback === 'function') {
                    console.log('Executing CSS3D pre-rendering callback (no overlay)');
                    callback();
                }
            }
        } else {
            // Calculate progress based on easing function
            const progress = easeOutCubic(elapsed / finalProgressDuration);
            const currentProgress = maxProgressBeforeFinalAnimation + (100 - maxProgressBeforeFinalAnimation) * progress;
            updateProgress(currentProgress);
            
            // Update loading text
            const progressText = document.getElementById('loading-progress-text');
            if (progressText) {
                if (isLongExposureMode) {
                    progressText.textContent = 'Creating CSS3D long exposure...';
                } else {
                    progressText.textContent = 'Finalizing CSS3D animation...';
                }
            }
            
            // Continue animation
            requestAnimationFrame(animateFinalProgress);
        }
    };
    
    // Easing function for smooth animation
    const easeOutCubic = (x) => {
        return 1 - Math.pow(1 - x, 3);
    };
    
    // Create a DOM snapshot from the iframe
    const createDomSnapshot = (iframe) => {
        try {
            if (!iframe || !iframe.contentDocument || !iframe.contentDocument.documentElement) {
                return null;
            }
            
            // Clone the DOM for snapshot
            const domClone = iframe.contentDocument.documentElement.cloneNode(true);
            
            // Calculate a hash of the DOM to detect changes
            const domHash = calculateDomHash(domClone);
            
            return {
                domSnapshot: domClone,
                hash: domHash
            };
        } catch (error) {
            console.error('Error creating DOM snapshot:', error);
            return null;
        }
    };
    
    // Calculate a hash of the DOM to detect changes
    const calculateDomHash = (domElement) => {
        try {
            // Extract relevant attributes for comparison
            const attributes = [];
            
            // Track animation state separately
            let hasAnimations = false;
            let hasTransitions = false;
            
            // Process element and its children recursively
            const processElement = (element) => {
                // Skip script elements
                if (element.tagName === 'SCRIPT') return;
                
                // Get element attributes
                const tagName = element.tagName || '';
                const className = element.className || '';
                const id = element.id || '';
                const style = element.style ? element.style.cssText : '';
                
                // Check for animations and transitions in style
                if (style.includes('animation') || style.includes('keyframes')) {
                    hasAnimations = true;
                }
                if (style.includes('transition')) {
                    hasTransitions = true;
                }
                
                // Extract more detailed style information
                const transform = style.match(/transform:[^;]+/) || '';
                const opacity = style.match(/opacity:[^;]+/) || '';
                const position = style.match(/((left|top|right|bottom):[^;]+)/) || '';
                const animation = style.match(/animation:[^;]+/) || '';
                const transition = style.match(/transition:[^;]+/) || '';
                const backgroundColor = style.match(/background-color:[^;]+/) || '';
                const color = style.match(/color:[^;]+/) || '';
                
                // Add element info to attributes array with more details
                attributes.push(`${tagName}#${id}.${className}[${transform}][${opacity}][${position}][${animation}][${transition}][${backgroundColor}][${color}]`);
                
                // Process child elements
                if (element.children) {
                    for (let i = 0; i < element.children.length; i++) {
                        processElement(element.children[i]);
                    }
                }
            };
            
            // Start processing from the root element
            processElement(domElement);
            
            // Join all attributes and hash them
            const attributesString = attributes.join('|');
            
            // Add animation state to the hash
            const stateInfo = `animations:${hasAnimations}|transitions:${hasTransitions}`;
            const fullString = attributesString + '|' + stateInfo;
            
            // Create a simple hash
            let hash = 0;
            for (let i = 0; i < fullString.length; i++) {
                const char = fullString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            
            return hash.toString();
        } catch (e) {
            console.error('Error calculating DOM hash:', e);
            return Math.random().toString(); // Fallback to random hash
        }
    };
    
    // Calculate the difference between two DOM hashes
    const calculateDomHashDifference = (hash1, hash2) => {
        if (!hash1 || !hash2) return 1;
        
        try {
            // Convert hashes to numbers
            const num1 = parseInt(hash1);
            const num2 = parseInt(hash2);
            
            // Calculate normalized difference (0-1)
            // Use a more conservative normalization factor
            const diff = Math.abs(num1 - num2) / (Math.pow(2, 30) - 1);
            return Math.min(1, diff);
        } catch (e) {
            console.error('Error calculating hash difference:', e);
            return 1;
        }
    };
    
    // Detect CSS3D animation loops
    const detectCSS3DAnimationLoop = (frames, currentHash) => {
        // Need at least 30 frames to detect a loop (increased from 20)
        if (frames.length < 30) {
            return { loopDetected: false, loopSize: 0 };
        }
        
        // Use a much more conservative threshold for CSS3D
        const minLoopSize = 6;  // Increased minimum loop size (was 4)
        const maxLoopSize = Math.floor(frames.length / 3); // Reduced from frames.length/2
        const loopThreshold = 0.2; // Much more conservative threshold (was 0.1)
        
        // Try different loop sizes
        for (let loopSize = minLoopSize; loopSize <= maxLoopSize; loopSize++) {
            let isLoop = true;
            let matchScore = 0;
            
            // Compare the last loopSize frames with the previous loopSize frames
            for (let i = 0; i < loopSize; i++) {
                const currentIndex = frames.length - 1 - i;
                const previousIndex = currentIndex - loopSize;
                
                if (previousIndex < 0) {
                    isLoop = false;
                    break;
                }
                
                const currentFrameHash = i === 0 ? currentHash : frames[currentIndex].hash;
                const previousFrameHash = frames[previousIndex].hash;
                
                // Calculate difference
                const diff = calculateDomHashDifference(currentFrameHash, previousFrameHash);
                
                // If hashes are different by more than the threshold, it's not a loop
                if (diff > loopThreshold) {
                    isLoop = false;
                    break;
                }
                
                // Track how close the match is
                matchScore += (1 - diff);
            }
            
            // Only consider it a loop if we have a good match score
            const avgMatchScore = matchScore / loopSize;
            if (isLoop && avgMatchScore > 0.7) { // Require at least 70% match confidence
                console.log(`Detected CSS3D animation loop of ${loopSize} frames with match score ${avgMatchScore.toFixed(2)}`);
                return { loopDetected: true, loopSize, matchScore: avgMatchScore };
            }
        }
        
        return { loopDetected: false, loopSize: 0, matchScore: 0 };
    };
    
    // Function to analyze CSS3D animation state
    const analyzeCSS3DAnimation = (iframe, domSnapshotFrames, currentHash) => {
        try {
            if (!iframe || !iframe.contentWindow || !iframe.contentWindow.__css3dAnimationDetection) {
                return {
                    isAnimating: false,
                    metrics: {}
                };
            }
            
            const detection = iframe.contentWindow.__css3dAnimationDetection;
            const now = Date.now();
            
            // Check if there are active animations
            const hasActiveTimeouts = detection.activeTimeouts > 0;
            const hasActiveIntervals = detection.activeIntervals > 0;
            const hasActiveRAF = detection.rAF > 0 && detection.animationFrameIds.size > 0;
            const hasCssAnimations = detection.cssAnimations && detection.cssAnimations.size > 0;
            const hasCssTransitions = detection.cssTransitions && detection.cssTransitions.size > 0;
            
            // Check for recent DOM changes
            const timeSinceLastDomChange = now - (detection.lastDomChange || 0);
            const hasRecentDomChanges = timeSinceLastDomChange < 500; // Consider DOM changes in last 500ms as active
            
            // Determine if animation is active
            const isAnimating = hasActiveTimeouts || hasActiveIntervals || hasActiveRAF || 
                               hasCssAnimations || hasCssTransitions || hasRecentDomChanges;
            
            // Check for loop patterns in DOM snapshots
            let loopDetected = false;
            let loopSize = 0;
            let matchScore = 0;
            
            // Only try to detect loops if we have enough frames and animation seems to be happening
            if (domSnapshotFrames.length >= 30 && (isAnimating || detection.domChanges > 10)) {
                const result = detectCSS3DAnimationLoop(domSnapshotFrames, currentHash);
                loopDetected = result.loopDetected;
                loopSize = result.loopSize;
                matchScore = result.matchScore;
            }
            
            return {
                isAnimating,
                loopDetected,
                loopSize,
                matchScore,
                metrics: {
                    activeTimeouts: detection.activeTimeouts,
                    activeIntervals: detection.activeIntervals,
                    rAF: detection.rAF,
                    cssAnimations: detection.cssAnimations ? detection.cssAnimations.size : 0,
                    cssTransitions: detection.cssTransitions ? detection.cssTransitions.size : 0,
                    domChanges: detection.domChanges,
                    timeSinceLastDomChange,
                    matchScore
                }
            };
        } catch (e) {
            console.error('Error analyzing CSS3D animation:', e);
            return {
                isAnimating: false,
                metrics: {}
            };
        }
    };
    
    // Function to capture DOM snapshots until animation completes or times out
    const captureDomSnapshots = async () => {
        if (!isPreviewActive || !preRenderingInProgress) {
            setPreRenderingInProgress(false);
            startFinalProgressAnimation();
            return;
        }
        
        const now = Date.now();
        
        // Check if enough time has passed since last capture
        // This ensures we capture at a similar rate to image2texture
        const timeSinceLastCapture = now - lastCaptureTime;
        if (timeSinceLastCapture < captureInterval) {
            // Schedule next check
            requestAnimationFrame(captureDomSnapshots);
            return;
        }
        
        // Update last capture time
        lastCaptureTime = now;
        
        // Update progress based on more accurate metrics
        if (now - lastProgressUpdate > progressUpdateInterval) {
            lastProgressUpdate = now;
            
            // Calculate elapsed time percentage
            const elapsedTime = now - preRenderStartTime;
            const timeProgress = Math.min(90, (elapsedTime / preRenderMaxDuration) * 100);
            
            // Calculate frame-based progress
            let frameProgress = Math.min(90, (domSnapshotFrames.length / totalFramesEstimate) * 100);
            
            // Use a weighted combination of time and frame progress
            // Cap at maxProgressBeforeFinalAnimation to leave room for final animation
            const combinedProgress = Math.min(
                maxProgressBeforeFinalAnimation, 
                (timeProgress * 0.3) + (frameProgress * 0.7)
            );
            updateProgress(combinedProgress);
            
            // Update the loading text to show more information
            const progressText = document.getElementById('loading-progress-text');
            if (progressText) {
                progressText.textContent = `Analyzing CSS3D animation... ${domSnapshotFrames.length} snapshots captured`;
            }
        }
        
        // Inject animation detection script if not already done
        if (domSnapshotFrames.length === 0) {
            injectUnifiedAnimationDetectionScript(iframe, 'css3d');
        }
        
        // Create a DOM snapshot
        const snapshot = createDomSnapshot(iframe);
        
        if (snapshot) {
            // Add snapshot to frames
            domSnapshotFrames.push({
                ...snapshot,
                timestamp: now
            });
            
            // Only start analyzing after we have enough frames
            // Use same threshold as image2texture (20 frames)
            if (domSnapshotFrames.length >= 20) {
                // Analyze the CSS3D animation
                const analysis = analyzeCSS3DAnimation(
                    iframe, 
                    domSnapshotFrames.slice(0, -1), 
                    snapshot.hash
                );
                
                // Store analysis metrics
                analysisMetrics = analysis.metrics;
                
                // Check if we've detected a loop with high confidence
                if (analysis.loopDetected && analysis.matchScore > 0.7) {
                    console.log('CSS3D animation loop detected after ' + domSnapshotFrames.length + ' snapshots with match score ' + analysis.matchScore.toFixed(2));
                    setPreRenderingInProgress(false);
                    setIsAnimationFinite(true);
                    setAnimationDuration(domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp);
                    
                    // Update analysis metrics
                    loopDetected = true;
                    detectedLoopSize = analysis.loopSize;
                    
                    // Show success message
                    if (isLongExposureMode) {
                        showStatus(`CSS3D animation loop detected, creating long exposure from ${domSnapshotFrames.length} frames`, 'info');
                    } else {
                        showStatus(`CSS3D animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                    }
                    
                    // Start final progress animation
                    startFinalProgressAnimation();
                    return;
                }
                
                // Check if animation has ended (no changes for a while)
                if (domSnapshotFrames.length > 20 && !analysis.isAnimating) {
                    // Check if there have been no significant changes in the last few frames
                    let noChanges = true;
                    const recentFrames = domSnapshotFrames.slice(-5);
                    
                    for (let i = 1; i < recentFrames.length; i++) {
                        const diff = calculateDomHashDifference(recentFrames[i].hash, recentFrames[i-1].hash);
                        if (diff > 0.01) { // Small threshold for changes
                            noChanges = false;
                            break;
                        }
                    }
                    
                    if (noChanges) {
                        console.log('CSS3D animation end detected after ' + domSnapshotFrames.length + ' snapshots');
                        setPreRenderingInProgress(false);
                        setIsAnimationFinite(true);
                        setAnimationDuration(domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp);
                        
                        // Update analysis metrics
                        endDetected = true;
                        
                        // Show success message
                        showStatus(`CSS3D animation end detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                        
                        // Start final progress animation
                        startFinalProgressAnimation();
                        return;
                    }
                }
            }
        }
        
        // Check if we've exceeded the maximum pre-rendering time
        if (now - preRenderStartTime > preRenderMaxDuration) {
            console.log('CSS3D analysis time limit reached after ' + preRenderMaxDuration + 'ms');
            setPreRenderingInProgress(false);
            
            const analysis = analyzeCSS3DAnimation(iframe, domSnapshotFrames, null);
            
            // Store final analysis metrics
            analysisMetrics = analysis.metrics;
            
            if (analysis.loopDetected) {
                setIsAnimationFinite(true);
                setAnimationDuration(domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp);
                console.log(`CSS3D animation loop detected, duration: ${animationDuration}ms, ${domSnapshotFrames.length} snapshots captured`);
                showStatus(`CSS3D animation loop detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                
                // Update analysis metrics
                loopDetected = true;
                detectedLoopSize = analysis.loopSize;
            } else if (!analysis.isAnimating) {
                setIsAnimationFinite(true);
                setAnimationDuration(domSnapshotFrames[domSnapshotFrames.length - 1].timestamp - domSnapshotFrames[0].timestamp);
                console.log(`CSS3D animation appears to have ended, duration: ${animationDuration}ms, ${domSnapshotFrames.length} snapshots captured`);
                showStatus(`CSS3D animation end detected (${(animationDuration/1000).toFixed(1)}s), ${domSnapshotFrames.length} snapshots captured`, 'success');
                
                // Update analysis metrics
                endDetected = true;
            } else {
                console.log(`No CSS3D animation end detected, ${domSnapshotFrames.length} snapshots captured`);
                showStatus(`CSS3D animation appears infinite, ${domSnapshotFrames.length} snapshots captured for playback`, 'info');
            }
            
            // Start final progress animation
            startFinalProgressAnimation();
            return;
        }
        
        // Continue capturing snapshots with requestAnimationFrame
        // The timing is controlled by the captureInterval check at the beginning
        requestAnimationFrame(captureDomSnapshots);
    };
    
    // Start capturing DOM snapshots
    captureDomSnapshots();
    
    // Store callback to be called after final animation completes
    window._preRenderCallback = callback;
    
    // Store the DOM snapshot frames in the preRenderedFrames array for compatibility
    setPreRenderedFrames(domSnapshotFrames);
}

/**
 * Initialize playback timing - called when preview starts playing
 * This should be called regardless of animation type (finite/infinite)
 */
function initializePlaybackTiming() {
    const now = Date.now();
    setAnimationPlaybackStartTime(now);
    
    // Calculate the capture start time from the first frame if available
    if (preRenderedFrames.length > 0) {
        setAnimationCaptureStartTime(preRenderedFrames[0].timestamp);
    } else {
        setAnimationCaptureStartTime(now);
    }
    
    console.log('Playback timing initialized:', {
        playbackStart: animationPlaybackStartTime,
        captureStart: animationCaptureStartTime,
        framesAvailable: preRenderedFrames.length
    });
}