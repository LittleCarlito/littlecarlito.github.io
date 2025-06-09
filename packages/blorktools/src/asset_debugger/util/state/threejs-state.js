export let pendingTextureUpdate = false;
export let previewPlane;
export let animationPreviewScene, animationPreviewCamera, animationPreviewRenderer;
export let animationCss3dScene, animationCss3dRenderer, animationCss3dObject;
export let frameBuffer = [];
export let previewRenderTarget = null;

export function setAnimationCss3dScene(incomingValue) {
    animationCss3dScene = incomingValue;
}

export function setAnimationCss3dRenderer(incomingValue) {
    animationCss3dRenderer = incomingValue;
}

export function setAnimationCss3dObject(incomingValue) {
    animationCss3dObject = incomingValue;
}

export function setAnimationPreviewScene(incomingValue) {
    animationPreviewScene = incomingValue;
}

export function setAnimationPreviewRenderer(incomingValue) {
    animationPreviewRenderer = incomingValue;
}

export function setPreviewPlane(incomingValue) {
    previewPlane = incomingValue;
}

export function setPreviewRenderTarget(incomingValue) {
    previewRenderTarget = incomingValue;
}

export function setAnimationPreviewCamera(incomingValue) {
    animationPreviewCamera = incomingValue;
}

export function setPendingTextureUpdate(incomingValue) {
    pendingTextureUpdate = incomingValue;
}

export function resetThreeJsState() {
    previewPlane = null;
    animationPreviewScene = null;
    animationPreviewCamera = null;
    animationPreviewRenderer = null;
    animationCss3dScene = null;
    animationCss3dRenderer = null;
    animationCss3dObject = null;
    previewRenderTarget = null;
    frameBuffer = [];
}