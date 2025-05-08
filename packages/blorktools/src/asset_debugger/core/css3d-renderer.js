/**
 * CSS3D Renderer for Three.js
 * 
 * This is a local fallback version of the CSS3DRenderer from Three.js examples.
 * It's used when the CDN sources fail to load.
 * 
 * Based on Three.js r149 CSS3DRenderer.js
 * https://github.com/mrdoob/three.js/blob/r149/examples/js/renderers/CSS3DRenderer.js
 */

// Make sure THREE is defined
if (typeof THREE === 'undefined') {
    console.error('THREE is not defined. CSS3DRenderer requires THREE.');
}

// Only define if not already defined
if (THREE && !THREE.CSS3DObject) {
    THREE.CSS3DObject = function (element) {
        THREE.Object3D.call(this);
        
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
    };
    
    THREE.CSS3DObject.prototype = Object.assign(Object.create(THREE.Object3D.prototype), {
        constructor: THREE.CSS3DObject,
        copy: function (source, recursive) {
            THREE.Object3D.prototype.copy.call(this, source, recursive);
            this.element = source.element.cloneNode(true);
            return this;
        }
    });
    
    THREE.CSS3DSprite = function (element) {
        THREE.CSS3DObject.call(this, element);
    };
    
    THREE.CSS3DSprite.prototype = Object.create(THREE.CSS3DObject.prototype);
    THREE.CSS3DSprite.prototype.constructor = THREE.CSS3DSprite;
    
    THREE.CSS3DRenderer = function () {
        const _this = this;
        
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
        
        function getCameraCSSMatrix(matrix) {
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
        }
        
        function getObjectCSSMatrix(matrix) {
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
        }
        
        function renderObject(object, scene, camera, cameraCSSMatrix) {
            if (object instanceof THREE.CSS3DObject) {
                let style;
                
                if (object instanceof THREE.CSS3DSprite) {
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
        }
        
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
    };
    
    console.log('Local CSS3DRenderer loaded successfully');
} 