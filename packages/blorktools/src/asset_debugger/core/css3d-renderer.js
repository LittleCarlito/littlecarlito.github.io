/**
 * CSS3D Renderer for Three.js
 * 
 * This is a local fallback version of the CSS3DRenderer from Three.js examples.
 * It's used when the CDN sources fail to load.
 * 
 * Based on Three.js r149 CSS3DRenderer.js
 * https://github.com/mrdoob/three.js/blob/r149/examples/js/renderers/CSS3DRenderer.js
 */

// Import Three.js the same way as other files in the codebase
import * as THREE from 'three';

// Make sure THREE is defined
if (typeof THREE === 'undefined') {
    console.error('THREE is not defined. CSS3DRenderer requires THREE.');
}

// Export CSS3D objects and check if they're available
let CSS3DRenderer, CSS3DObject, CSS3DSprite;

// Only define if not already defined
if (THREE && !THREE.CSS3DObject) {
    // Convert prototype-based constructor to class
    class CSS3DObjectClass extends THREE.Object3D {
        constructor(element) {
            super();
            this.element = element || document.createElement('div');
            this.element.style.position = 'absolute';
            this.element.style.pointerEvents = 'auto';
            
            this.addEventListener('removed', function () {
                this.traverse(function (object) {
                    if (object.element instanceof Element && object.element.parentNode !== null) {
                        object.element.parentNode.removeChild(object.element);
                    }
                });
            });
        }
        
        copy(source, recursive) {
            THREE.Object3D.prototype.copy.call(this, source, recursive);
            this.element = source.element.cloneNode(true);
            return this;
        }
    }
    
    class CSS3DSpriteClass extends CSS3DObjectClass {
        constructor(element) {
            super(element);
        }
    }
    
    // Assign the classes to the variables
    CSS3DObject = CSS3DObjectClass;
    CSS3DSprite = CSS3DSpriteClass;
    
    // CSS3DRenderer as a class
    class CSS3DRendererClass {
        constructor() {
            let _width, _height;
            let _widthHalf, _heightHalf;
            
            const matrix = new THREE.Matrix4();
            
            const cache = {
                camera: { fov: 0, style: '' },
                objects: new WeakMap()
            };
            
            const domElement = document.createElement('div');
            domElement.style.overflow = 'hidden';
            
            this.domElement = domElement;
            
            const cameraElement = document.createElement('div');
            cameraElement.style.transformStyle = 'preserve-3d';
            cameraElement.style.pointerEvents = 'none';
            
            domElement.appendChild(cameraElement);
            
            this.getSize = function () {
                return {
                    width: _width,
                    height: _height
                };
            };
            
            this.setSize = function (width, height) {
                _width = width;
                _height = height;
                _widthHalf = _width / 2;
                _heightHalf = _height / 2;
                
                domElement.style.width = width + 'px';
                domElement.style.height = height + 'px';
                
                cameraElement.style.width = width + 'px';
                cameraElement.style.height = height + 'px';
            };
            
            const getCameraCSSMatrix = function (matrix) {
                const elements = matrix.elements;
                
                return 'matrix3d(' +
                    elements[0] + ',' +
                    -elements[1] + ',' +
                    elements[2] + ',' +
                    elements[3] + ',' +
                    elements[4] + ',' +
                    -elements[5] + ',' +
                    elements[6] + ',' +
                    elements[7] + ',' +
                    elements[8] + ',' +
                    -elements[9] + ',' +
                    elements[10] + ',' +
                    elements[11] + ',' +
                    elements[12] + ',' +
                    -elements[13] + ',' +
                    elements[14] + ',' +
                    elements[15] +
                    ')';
            };
            
            const getObjectCSSMatrix = function (matrix) {
                const elements = matrix.elements;
                const matrix3d = 'matrix3d(' +
                    elements[0] + ',' +
                    elements[1] + ',' +
                    elements[2] + ',' +
                    elements[3] + ',' +
                    -elements[4] + ',' +
                    -elements[5] + ',' +
                    -elements[6] + ',' +
                    -elements[7] + ',' +
                    elements[8] + ',' +
                    elements[9] + ',' +
                    elements[10] + ',' +
                    elements[11] + ',' +
                    elements[12] + ',' +
                    elements[13] + ',' +
                    elements[14] + ',' +
                    elements[15] +
                    ')';
                
                return 'translate(-50%,-50%)' + matrix3d;
            };
            
            const renderObject = function (object, scene, camera, cameraCSSMatrix) {
                if (object instanceof CSS3DObject) {
                    let style;
                    
                    if (object instanceof CSS3DSprite) {
                        // http://swiftcoder.wordpress.com/2008/11/25/constructing-a-billboard-matrix/
                        
                        matrix.copy(camera.matrixWorldInverse);
                        matrix.transpose();
                        matrix.copyPosition(object.matrixWorld);
                        matrix.scale(object.scale);
                        
                        matrix.elements[3] = 0;
                        matrix.elements[7] = 0;
                        matrix.elements[11] = 0;
                        matrix.elements[15] = 1;
                        
                        style = getObjectCSSMatrix(matrix);
                    } else {
                        style = getObjectCSSMatrix(object.matrixWorld);
                    }
                    
                    const element = object.element;
                    const cachedObject = cache.objects.get(object);
                    
                    if (cachedObject === undefined || cachedObject.style !== style) {
                        element.style.transform = style;
                        
                        const objectData = { style: style };
                        cache.objects.set(object, objectData);
                    }
                    
                    element.style.display = object.visible ? '' : 'none';
                    
                    if (element.parentNode !== cameraElement) {
                        cameraElement.appendChild(element);
                    }
                }
                
                for (let i = 0, l = object.children.length; i < l; i++) {
                    renderObject(object.children[i], scene, camera, cameraCSSMatrix);
                }
            };
            
            this.render = function (scene, camera) {
                const fov = camera.projectionMatrix.elements[5] * _heightHalf;
                
                if (cache.camera.fov !== fov) {
                    domElement.style.perspective = fov + 'px';
                    cache.camera.fov = fov;
                }
                
                if (scene.autoUpdate === true) scene.updateMatrixWorld();
                if (camera.parent === null) camera.updateMatrixWorld();
                
                camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
                
                const cameraCSSMatrix = 'translateZ(' + fov + 'px)' + getCameraCSSMatrix(camera.matrixWorldInverse);
                
                const style = cameraCSSMatrix + 'translate(' + _widthHalf + 'px,' + _heightHalf + 'px)';
                
                if (cache.camera.style !== style) {
                    cameraElement.style.transform = style;
                    cache.camera.style = style;
                }
                
                renderObject(scene, scene, camera, cameraCSSMatrix);
            };
        }
    }
    
    // Assign the class to the variable
    CSS3DRenderer = CSS3DRendererClass;
    
    console.log('Local CSS3DRenderer loaded successfully as ES6 classes');
} else {
    // If THREE.CSS3DObject already exists, use the existing implementations
    CSS3DObject = THREE.CSS3DObject;
    CSS3DSprite = THREE.CSS3DSprite;
    CSS3DRenderer = THREE.CSS3DRenderer;
}

/**
 * Check if CSS3DRenderer is available
 * @returns {boolean} Whether CSS3DRenderer is available
 */
export function isCSS3DRendererAvailable() {
    return CSS3DRenderer !== undefined;
}

// Export CSS3D classes
export { CSS3DRenderer, CSS3DObject, CSS3DSprite }; 