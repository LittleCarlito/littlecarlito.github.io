// Add animation stack tracking variables at the top of the file
export let animationStack = [];
export let isReversingAnimations = false;
// Add flag to disable animation capture during reversal
export let isCapturingAnimations = true;
// Store animation properties to properly reverse them
export let animationProperties = {};
// Store timestamps for calculating delays
export let lastAnimationTime = 0;
// Animation frame tracking
export let reverseAnimationFrameId = null;
// Add animation batch tracking for composite effects
export let currentAnimationBatch = [];
export let batchTimeWindow = 50; // ms window to consider animations as part of the same batch
export let lastBatchTime = 0;

export function resetAnimationStack() {
    animationStack = [];
}

export function pushAnimationStack(incomingValue) {
    if(!incomingValue) {
        return;
    }
    animationStack.push(incomingValue);
}

export function setReversingAnimation(incomingValue) {
    isReversingAnimations = incomingValue;
}

export function setCapturingAnimations(incomingValue) {
    isCapturingAnimations = incomingValue;
}

export function resetAnimationProperties() {
    animationProperties = {};
}

export function setLastAnimationTime(incomingValue) {
    if(!incomingValue) {
        return;
    }
    lastAnimationTime = incomingValue;
}

export function resetCurrentAniamtionBatch() {
    currentAnimationBatch = [];
}

export function pushAnimationBatch(incomingValue) {
    if(!incomingValue){
        return;
    }
    currentAnimationBatch.push(incomingValue);
}

export function resetLastBatchTime() {
    lastBatchTime = 0;
}

export function setLastBatchTime(incomingValue) {
    lastBatchTime = incomingValue;
}

export function resetReverseAnimationFrameId() {
    reverseAnimationFrameId = null;
}

export function setReverseAnimationFrameId(incomingValue) {
    reverseAnimationFrameId = incomingValue;
}

export function resetAnimationState() {
        // Clear existing animation stack
        resetAnimationStack();
        setReversingAnimation(false);
        setCapturingAnimations(true);
        resetAnimationProperties();
        setLastAnimationTime(Date.now());
        resetCurrentAniamtionBatch();
        resetLastBatchTime();
}