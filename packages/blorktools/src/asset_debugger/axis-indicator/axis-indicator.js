import * as THREE from 'three';
import { getState } from '../util/state/scene-state';

// Add variables to track axis indicator state
let axisIndicatorCollapsed = false;
let axisIndicatorPosition = { x: null, y: null }; // null means use default position

/**
 * Create a coordinate axis indicator that blends into the scene
 * @param {Object} scene - The Three.js scene
 * @param {Object} camera - The Three.js camera
 * @param {Object} renderer - The Three.js renderer
 */
export function createAxisIndicator(scene, camera, renderer) {
    console.log('Creating modern axis indicator');
    
    // Create a new scene for the axis indicator
    const axisScene = new THREE.Scene();
    // Make background transparent to blend with main scene
    axisScene.background = null;
    
    // Create a camera for the axis indicator with wider field of view
    const axisCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 20);
    axisCamera.position.set(0, 0, 5); // Position even further back to ensure all axes visible
    axisCamera.lookAt(0, 0, 0);
    
    // Create modern axes
    const createAxis = (dir, color) => {
        const group = new THREE.Group();
        
        // Create line for positive axis direction
        const lineGeometry = new THREE.BufferGeometry();
        // Make line slightly shorter to leave space for arrow
        const endPoint = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(0.85);
        lineGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute([0, 0, 0, endPoint.x, endPoint.y, endPoint.z], 3));
        
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: color,
            linewidth: 8,  // Increased from 5 to 8
            depthTest: false,
            transparent: true,
            opacity: 1.0
        });
        
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);
        
        // Create negative axis direction (thicker, more visible dotted line)
        const negLineGeometry = new THREE.BufferGeometry();
        const negDir = new THREE.Vector3(-dir.x, -dir.y, -dir.z).multiplyScalar(0.85); // Increased from 0.7
        negLineGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute([0, 0, 0, negDir.x, negDir.y, negDir.z], 3));
        
        const dashedLineMaterial = new THREE.LineDashedMaterial({
            color: color,
            linewidth: 10, // Increased from 8
            scale: 1,
            dashSize: 0.18, // Increased from 0.15
            gapSize: 0.07,
            depthTest: false,
            transparent: true,
            opacity: 0.9  // Increased from 0.8
        });
        
        const dashedLine = new THREE.Line(negLineGeometry, dashedLineMaterial);
        dashedLine.computeLineDistances(); // Required for dashed lines
        group.add(dashedLine);
        
        // Create modern arrow head (smaller)
        const arrowGeometry = new THREE.CylinderGeometry(0, 0.1, 0.25, 8, 1); // Reduced from 0.15, 0.35
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 1.0,
            depthTest: false
        });
        
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Position at the end of the line
        arrow.position.copy(dir);
        
        // Rotate arrow to point in the right direction
        if (dir.x === 1) {
            arrow.rotation.z = -Math.PI / 2;
        } else if (dir.y === 1) {
            // Default orientation works for Y
        } else if (dir.z === 1) {
            arrow.rotation.x = Math.PI / 2;
        }
        
        group.add(arrow);
        
        // Create text label
        const text = dir.x === 1 ? 'X' : dir.y === 1 ? 'Y' : 'Z';
        const canvas = document.createElement('canvas');
        canvas.width = 192;  // Increased from 128 to 192
        canvas.height = 192; // Increased from 128 to 192
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw text with a subtle glow effect
        ctx.font = 'bold 90px Arial'; // Increased from 68px to 90px
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add a subtle glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;  // Increased from 8 to 10
        ctx.fillStyle = color;
        ctx.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        // Position text beyond the arrow
        sprite.position.copy(dir).multiplyScalar(1.5); // Increased from 1.4 to 1.5
        sprite.scale.set(0.6, 0.6, 0.6); // Increased from 0.45 to 0.6
        
        group.add(sprite);
        
        return group;
    };
    
    // Create the three axes with modern colors
    const xAxis = createAxis(new THREE.Vector3(1, 0, 0), '#ff4136'); // Vibrant red
    const yAxis = createAxis(new THREE.Vector3(0, 1, 0), '#2ecc40'); // Vibrant green
    const zAxis = createAxis(new THREE.Vector3(0, 0, 1), '#0074d9'); // Vibrant blue
    
    axisScene.add(xAxis);
    axisScene.add(yAxis);
    axisScene.add(zAxis);
    
    // Add a subtle center dot
    const centerGeometry = new THREE.SphereGeometry(0.06, 16, 16); // Increased from 0.04, 12, 12
    const centerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,  // Increased from 0.8
        depthTest: false
    });
    const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
    axisScene.add(centerSphere);
    
    // Store references for cleanup later if needed
    const state = getState();
    state.axisScene = axisScene;
    state.axisCamera = axisCamera;
    
    // Find the correct viewport container (using the viewport ID)
    let viewportContainer = document.getElementById('viewport');
    
    // Fallback to direct parent if viewport not found
    if (!viewportContainer) {
        console.log('Viewport element not found, using renderer parent');
        viewportContainer = renderer.domElement.closest('#viewport') || 
                          renderer.domElement.closest('#view-container') ||
                          renderer.domElement.closest('.view-panel') ||
                          renderer.domElement.parentElement;
    }
    
    console.log('Found viewport container:', viewportContainer);
    
    // Size for the axis indicator (proportional to viewport size)
    const size = Math.min(180, viewportContainer.offsetWidth / 4);
    
    // Create container for the entire axis indicator (header + display)
    const axisContainer = document.createElement('div');
    axisContainer.id = 'axis-indicator-container';
    axisContainer.style.position = 'absolute';
    axisContainer.style.width = `${size}px`;
    axisContainer.style.zIndex = '1000';
    axisContainer.style.pointerEvents = 'auto';
    axisContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    axisContainer.style.border = '1px solid rgba(50, 50, 50, 0.7)';
    axisContainer.style.borderRadius = '5px';
    axisContainer.style.overflow = 'hidden';
    
    // Initial position (top-right corner of the viewport)
    const margin = 10;
    if (axisIndicatorPosition.x === null || axisIndicatorPosition.y === null) {
        axisIndicatorPosition.x = viewportContainer.offsetWidth - size - margin;
        axisIndicatorPosition.y = margin;
    }
    
    axisContainer.style.left = `${axisIndicatorPosition.x}px`;
    axisContainer.style.top = `${axisIndicatorPosition.y}px`;
    
    // Create the header
    const header = document.createElement('div');
    header.id = 'axis-indicator-header';
    header.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
    header.style.color = 'white';
    header.style.padding = '5px 10px';
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.width = '100%'; // Full width
    header.style.boxSizing = 'border-box'; // Include padding in width calculation
    
    // Add title
    const title = document.createElement('span');
    title.textContent = 'Axis Indicator';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '12px';
    
    // Add collapse/expand button
    const collapseBtn = document.createElement('span');
    collapseBtn.textContent = axisIndicatorCollapsed ? '▼' : '▲';
    collapseBtn.style.fontSize = '12px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.marginLeft = '10px';
    collapseBtn.style.width = '15px';
    collapseBtn.style.textAlign = 'center';
    
    // Add collapse functionality
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering drag
        axisIndicatorCollapsed = !axisIndicatorCollapsed;
        collapseBtn.textContent = axisIndicatorCollapsed ? '▼' : '▲';
        
        // Toggle display area visibility directly
        const canvasContainer = document.getElementById('axis-indicator-canvas-container');
        if (canvasContainer) {
            canvasContainer.style.display = axisIndicatorCollapsed ? 'none' : 'block';
            // Update container height when collapsed/expanded
            updateContainerHeight();
        }
    });
    
    // Add elements to header
    header.appendChild(title);
    header.appendChild(collapseBtn);
    
    // Create canvas container for the indicator display
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'axis-indicator-canvas-container';
    canvasContainer.style.width = `${size}px`;
    canvasContainer.style.height = `${size}px`;
    canvasContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    canvasContainer.style.display = axisIndicatorCollapsed ? 'none' : 'block';
    
    // Add both elements to the container
    axisContainer.appendChild(header);
    axisContainer.appendChild(canvasContainer);
    
    // Add the container to the viewport
    viewportContainer.appendChild(axisContainer);
    
    // Function to update container height based on collapsed state
    function updateContainerHeight() {
        if (axisIndicatorCollapsed) {
            axisContainer.style.height = `${header.offsetHeight}px`;
        } else {
            axisContainer.style.height = 'auto';
        }
    }
    
    // Call once to set initial height
    updateContainerHeight();
    
    // Store scale factor for axis objects
    let axisScale = 1.0;
    const scaleMin = 0.5;
    const scaleMax = 3.0;
    
    // Add zoom functionality when hovering over the indicator
    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Determine zoom direction
        const delta = Math.sign(-e.deltaY);
        
        // Adjust scale factor
        axisScale += delta * 0.15;
        axisScale = Math.max(scaleMin, Math.min(scaleMax, axisScale));
        
        // Apply scale to all axis objects
        xAxis.scale.set(axisScale, axisScale, axisScale);
        yAxis.scale.set(axisScale, axisScale, axisScale);
        zAxis.scale.set(axisScale, axisScale, axisScale);
        centerSphere.scale.set(axisScale, axisScale, axisScale);
        
        console.log(`Axis scale: ${axisScale.toFixed(2)}`);
    });
    
    // Make the header draggable (moves the entire container)
    let isHeaderDragging = false;
    let startX, startY;
    let startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isHeaderDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(axisContainer.style.left);
        startTop = parseInt(axisContainer.style.top);
        header.style.cursor = 'grabbing';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isHeaderDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        
        // Get current viewport container dimensions
        const containerRect = viewportContainer.getBoundingClientRect();
        const maxLeft = containerRect.width - axisContainer.offsetWidth;
        const maxTop = containerRect.height - axisContainer.offsetHeight;
        
        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
        
        axisContainer.style.left = `${constrainedLeft}px`;
        axisContainer.style.top = `${constrainedTop}px`;
        
        // Update stored position
        axisIndicatorPosition.x = constrainedLeft;
        axisIndicatorPosition.y = constrainedTop;
    });
    
    document.addEventListener('mouseup', () => {
        if (isHeaderDragging) {
            isHeaderDragging = false;
            header.style.cursor = 'grab';
        }
    });
    
    // Create a separate renderer for the axis scene
    const axisRenderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true 
    });
    axisRenderer.setSize(size, size);
    axisRenderer.setClearColor(0x000000, 0);
    
    // Add the renderer to the container
    canvasContainer.appendChild(axisRenderer.domElement);
    
    // Store renderer reference 
    axisScene.renderer = axisRenderer;
    
    // Add a render callback to draw the axis indicator
    const originalRender = renderer.render;
    renderer.render = function(scene, camera) {
        // Call original render with main scene and camera
        originalRender.call(this, scene, camera);
        
        // Skip rendering if collapsed or container was removed
        const canvasContainer = document.getElementById('axis-indicator-canvas-container');
        if (axisIndicatorCollapsed || !canvasContainer) {
            return;
        }
        
        // Update rotation to match main camera
        if (state.camera) {
            const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
            const distance = axisCamera.position.length();
            axisCamera.position.copy(cameraDir).negate().multiplyScalar(distance);
            axisCamera.lookAt(0, 0, 0);
        }
        
        // Apply semi-transparency when overlaying content
        const applyTransparency = (obj, factor) => {
            if (obj.material) {
                obj.material.opacity = obj.material.opacity * factor;
            }
            if (obj.children) {
                obj.children.forEach(child => applyTransparency(child, factor));
            }
        };
        
        // Apply transparency to all objects in axis scene
        axisScene.children.forEach(obj => applyTransparency(obj, 0.7));
        
        // Render axis scene with its own renderer
        axisRenderer.render(axisScene, axisCamera);
        
        // Reset transparency after rendering
        axisScene.children.forEach(obj => {
            const resetOpacity = (o) => {
                if (o.material && o.material.opacity) {
                    o.material.opacity = o.material.opacity / 0.7;
                }
                if (o.children) {
                    o.children.forEach(child => resetOpacity(child));
                }
            };
            resetOpacity(obj);
        });
    };
    
    console.log('Modern axis indicator created with draggable header');
    
    // Reset transparency after rendering
    axisScene.children.forEach(obj => {
        const resetOpacity = (o) => {
            if (o.material && o.material.opacity) {
                o.material.opacity = o.material.opacity / 0.7;
            }
            if (o.children) {
                o.children.forEach(child => resetOpacity(child));
            }
        };
        resetOpacity(obj);
    });
    
    // Create axis indicator mode event listener
    document.addEventListener('axisIndicatorModeChange', function(e) {
        const mode = e.detail.mode;
        const intensity = e.detail.intensity || 0.7;
        console.log('Axis indicator mode changed to:', mode);
        
        // Update the state's embedded intensity if applicable
        const state = getState();
        if (state.embeddedAxisIndicator) {
            state.embeddedAxisIndicator.intensity = intensity;
        }
        
        // Toggle between windowed, embedded, and disabled modes
        if (mode === 'embedded') {
            // Hide windowed version if it exists
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'none';
            }
            
            // Create embedded version
            createEmbeddedAxisIndicator(scene, camera, renderer);
        } else if (mode === 'disabled') {
            // Hide windowed version if it exists
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'none';
            }
            
            // Remove embedded version if it exists
            removeEmbeddedAxisIndicator();
        } else {
            // Show windowed version if it exists
            const axisContainer = document.getElementById('axis-indicator-container');
            if (axisContainer) {
                axisContainer.style.display = 'block';
            }
            
            // Remove embedded version if it exists
            removeEmbeddedAxisIndicator();
        }
    });
    
    // Function to create embedded axis indicator
    function createEmbeddedAxisIndicator(scene, camera, renderer) {
        // Check if we already have an embedded axis indicator
        const state = getState();
        if (state.embeddedAxisIndicator) {
            // If it exists, just set active to true
            state.embeddedAxisIndicator.active = true;
            return;
        }
        
        console.log('Creating embedded axis indicator');
        
        // Create a new scene for the embedded axis indicator
        const embeddedAxisScene = new THREE.Scene();
        embeddedAxisScene.background = null; // Transparent background
        
        // Create a camera for the embedded axis indicator with wide FOV
        const embeddedAxisCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        embeddedAxisCamera.position.set(0, 0, 15); // Scaled back for better visibility
        embeddedAxisCamera.lookAt(0, 0, 0);
        
        // Create appropriately sized axes for background
        const axisScale = 6.0; // Reduced scale by 25% (from 8.0 to 6.0)
        
        // Create a modified axis creation function with thicker lines and smaller cones
        const createEmbeddedAxis = (dir, color) => {
            const group = new THREE.Group();
            
            // Create line for positive axis direction - MUCH THICKER
            const lineGeometry = new THREE.BufferGeometry();
            const endPoint = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(0.92); // Longer line
            lineGeometry.setAttribute('position', 
                new THREE.Float32BufferAttribute([0, 0, 0, endPoint.x, endPoint.y, endPoint.z], 3));
            
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: color,
                linewidth: 45,
                depthTest: false,
                transparent: true,
                opacity: 1.0
            });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            group.add(line);
            
            // Create negative axis direction with thicker dashed line
            const negLineGeometry = new THREE.BufferGeometry();
            const negDir = new THREE.Vector3(-dir.x, -dir.y, -dir.z).multiplyScalar(0.92); // Longer line
            negLineGeometry.setAttribute('position', 
                new THREE.Float32BufferAttribute([0, 0, 0, negDir.x, negDir.y, negDir.z], 3));
            
            const dashedLineMaterial = new THREE.LineDashedMaterial({
                color: color,
                linewidth: 45,
                scale: 1,
                dashSize: 0.2, // Larger dashes
                gapSize: 0.05, // Smaller gaps
                depthTest: false,
                transparent: true,
                opacity: 0.9
            });
            
            const dashedLine = new THREE.Line(negLineGeometry, dashedLineMaterial);
            dashedLine.computeLineDistances(); // Required for dashed lines
            group.add(dashedLine);
            
            // Create very small arrow head (cone)
            const arrowGeometry = new THREE.CylinderGeometry(0, 0.05, 0.15, 6, 1); // Tiny cone
            const arrowMaterial = new THREE.MeshBasicMaterial({ 
                color: color,
                transparent: true,
                opacity: 1.0,
                depthTest: false
            });
            
            const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
            
            // Position at the end of the line
            arrow.position.copy(dir);
            
            // Rotate arrow to point in the right direction
            if (dir.x === 1) {
                arrow.rotation.z = -Math.PI / 2;
            } else if (dir.y === 1) {
                // Default orientation works for Y
            } else if (dir.z === 1) {
                arrow.rotation.x = Math.PI / 2;
            }
            
            group.add(arrow);
            
            // Create larger and more visible text label
            const text = dir.x === 1 ? 'X' : dir.y === 1 ? 'Y' : 'Z';
            const canvas = document.createElement('canvas');
            canvas.width = 256; // Larger canvas for clearer text
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw text with a stronger glow effect
            ctx.font = 'bold 96px Arial'; // Larger font
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add a stronger glow effect
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = color;
            ctx.fillText(text, canvas.width/2, canvas.height/2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            // Position text closer to the arrow tip
            sprite.position.copy(dir).multiplyScalar(1.2); // Reduced from 1.6 to bring labels closer
            sprite.scale.set(0.6, 0.6, 0.6); // Reduced label size by 25% (from 0.8 to 0.6)
            
            group.add(sprite);
            
            return group;
        };
        
        // Create the three axes using our embedded axis creation function
        const embeddedXAxis = createEmbeddedAxis(new THREE.Vector3(1, 0, 0), '#ff4136'); // Red
        const embeddedYAxis = createEmbeddedAxis(new THREE.Vector3(0, 1, 0), '#2ecc40'); // Green
        const embeddedZAxis = createEmbeddedAxis(new THREE.Vector3(0, 0, 1), '#0074d9'); // Blue
        
        // Scale up the axes for visibility while keeping proportions reasonable
        embeddedXAxis.scale.set(axisScale, axisScale, axisScale);
        embeddedYAxis.scale.set(axisScale, axisScale, axisScale);
        embeddedZAxis.scale.set(axisScale, axisScale, axisScale);
        
        // Add axes to the embedded scene
        embeddedAxisScene.add(embeddedXAxis);
        embeddedAxisScene.add(embeddedYAxis);
        embeddedAxisScene.add(embeddedZAxis);
        
        // Create a smaller center reference point (MAKE INVISIBLE)
        const embeddedCenterGeometry = new THREE.SphereGeometry(0.05 * axisScale, 16, 16);
        const embeddedCenterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0, // Set opacity to 0 to make it invisible
            depthTest: false
        });
        const embeddedCenterSphere = new THREE.Mesh(embeddedCenterGeometry, embeddedCenterMaterial);
        embeddedAxisScene.add(embeddedCenterSphere);
        
        // Get intensity value from settings if available
        let intensity = 0.7; // Default intensity
        const savedSettings = localStorage.getItem('assetDebuggerSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.axisIndicator && settings.axisIndicator.intensity !== undefined) {
                    intensity = settings.axisIndicator.intensity;
                }
            } catch (e) {
                console.error('Error reading intensity from settings:', e);
            }
        }
        
        // Store references
        state.embeddedAxisIndicator = {
            scene: embeddedAxisScene,
            camera: embeddedAxisCamera,
            xAxis: embeddedXAxis,
            yAxis: embeddedYAxis,
            zAxis: embeddedZAxis,
            centerSphere: embeddedCenterSphere,
            scale: axisScale,
            active: true, // Mark as active
            intensity: intensity // Use intensity from settings
        };
        
        // Create a renderer for the embedded axis indicator
        const originalRender = renderer.render;
        
        // Replace the renderer.render method
        renderer.render = function(mainScene, mainCamera) {
            // Check if embedded axis indicator is active
            if (state.embeddedAxisIndicator && state.embeddedAxisIndicator.active) {
                // First clear the renderer with black background
                const oldClearColor = renderer.getClearColor(new THREE.Color());
                const oldClearAlpha = renderer.getClearAlpha();
                
                // Save auto clear settings
                const oldAutoClear = renderer.autoClear;
                const oldAutoClearColor = renderer.autoClearColor;
                const oldAutoClearDepth = renderer.autoClearDepth;
                const oldAutoClearStencil = renderer.autoClearStencil;
                
                // Clear with black background
                renderer.setClearColor(0x000000, 1);
                renderer.clear(); // Clear everything
                
                // Update embedded camera to match main camera rotation
                if (mainCamera) {
                    const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);
                    const distance = embeddedAxisCamera.position.length();
                    embeddedAxisCamera.position.copy(cameraDir).negate().multiplyScalar(distance);
                    embeddedAxisCamera.lookAt(0, 0, 0);
                    
                    // Match aspect ratio
                    embeddedAxisCamera.aspect = mainCamera.aspect;
                    embeddedAxisCamera.updateProjectionMatrix();
                }
                
                // Adjust opacity for background effect
                const applyBackgroundOpacity = (obj) => {
                    if (obj.material) {
                        // Use the stored intensity value
                        const intensity = state.embeddedAxisIndicator.intensity || 0.7;
                        obj.material.opacity = obj.material.originalOpacity * intensity;
                    }
                    if (obj.children) {
                        obj.children.forEach(child => applyBackgroundOpacity(child));
                    }
                };
                
                // Save original opacity values first time
                if (!state.embeddedAxisIndicator.opacitySaved) {
                    state.embeddedAxisIndicator.scene.traverse(obj => {
                        if (obj.material && obj.material.opacity !== undefined) {
                            obj.material.originalOpacity = obj.material.opacity;
                        }
                    });
                    state.embeddedAxisIndicator.opacitySaved = true;
                }
                
                // Apply transparency to all objects in embedded axis scene
                state.embeddedAxisIndicator.scene.traverse(applyBackgroundOpacity);
                
                // Special settings for background rendering
                renderer.autoClear = false;
                renderer.autoClearDepth = true;
                renderer.autoClearColor = false;
                renderer.autoClearStencil = false;
                
                // Render the axis scene first (as background)
                originalRender.call(this, embeddedAxisScene, embeddedAxisCamera);
                
                // Restore original material opacity
                const restoreOpacity = (obj) => {
                    if (obj.material && obj.material.originalOpacity !== undefined) {
                        obj.material.opacity = obj.material.originalOpacity;
                    }
                    if (obj.children) {
                        obj.children.forEach(child => restoreOpacity(child));
                    }
                };
                
                state.embeddedAxisIndicator.scene.traverse(restoreOpacity);
                
                // Reset settings for main scene render
                renderer.autoClear = false; // Don't clear again
                renderer.setClearColor(oldClearColor, oldClearAlpha);
                
                // Now render the main scene on top
                originalRender.call(this, mainScene, mainCamera);
                
                // Restore original settings
                renderer.autoClear = oldAutoClear;
                renderer.autoClearColor = oldAutoClearColor;
                renderer.autoClearDepth = oldAutoClearDepth;
                renderer.autoClearStencil = oldAutoClearStencil;
            } else {
                // If embedded mode not active, just render normally
                originalRender.call(this, mainScene, mainCamera);
            }
        };
        
        console.log('Full-screen embedded axis indicator created successfully with intensity:', intensity);
    }
    
    // Function to remove embedded axis indicator
    function removeEmbeddedAxisIndicator() {
        const state = getState();
        
        if (state.embeddedAxisIndicator) {
            console.log('Removing embedded axis indicator');
            
            // Mark as inactive first
            state.embeddedAxisIndicator.active = false;
            
            // If we have a scene, remove all objects to prevent memory leaks
            if (state.embeddedAxisIndicator.scene) {
                // Dispose of geometries and materials
                state.embeddedAxisIndicator.scene.traverse((object) => {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
                
                // Clear the scene
                while (state.embeddedAxisIndicator.scene.children.length > 0) {
                    state.embeddedAxisIndicator.scene.remove(state.embeddedAxisIndicator.scene.children[0]);
                }
            }
            
            // Free references to Three.js objects
            state.embeddedAxisIndicator.xAxis = null;
            state.embeddedAxisIndicator.yAxis = null;
            state.embeddedAxisIndicator.zAxis = null;
            state.embeddedAxisIndicator.centerSphere = null;
            state.embeddedAxisIndicator.scene = null;
            state.embeddedAxisIndicator.camera = null;
            
            // Keep the embeddedAxisIndicator object but mark it as inactive
            // This allows us to maintain settings like intensity
        }
    }
    
    // Check for saved settings to initialize correct mode
    const savedSettings = localStorage.getItem('assetDebuggerSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (settings.axisIndicator && settings.axisIndicator.type) {
                const mode = settings.axisIndicator.type;
                const intensity = settings.axisIndicator.intensity || 0.7;
                
                // Always forcefully trigger the mode change to ensure correct state
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('axisIndicatorModeChange', {
                        detail: { 
                            mode: mode,
                            intensity: intensity
                        }
                    }));
                    console.log('Forced axis indicator mode:', mode);
                }, 200);
            }
        } catch (e) {
            console.error('Error loading saved axis indicator settings:', e);
        }
    }
    
    // Draw a debug log to confirm axis indicator creation complete
    console.log('Modern axis indicator setup complete');
}