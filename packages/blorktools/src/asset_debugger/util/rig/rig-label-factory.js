import * as THREE from 'three';
import { 
    clearLabels, 
    getLabelGroup, 
    hideLabels, 
    rigOptions, 
    setLabelGroup, 
    updateLabelPosition 
} from "./rig-controller";
import { boneVisualsGroup } from './bone-kinematics';

/**
 * Create joint labels for all joints in the scene
 * @param {Object} scene - The Three.js scene
 */
export function createJointLabels(scene) {
    console.log('Creating joint labels...');
    
    // Remove any existing labels first
    clearLabels('joint', scene);
    
    // Create a group to hold all labels
    setLabelGroup('joint', "JointLabels", scene);
    
    // Keep track of the labels created
    const labelCount = {total: 0, added: 0};
    
    // Track positions where we've already created labels to prevent duplicates
    const labelPositions = [];
    const positionTolerance = 0.001; // Tolerance for considering positions as identical
    
    // Helper function to check if a position already has a label
    const hasLabelAtPosition = (position) => {
        return labelPositions.some(pos => position.distanceTo(pos) < positionTolerance);
    };
    
    // Find all bone meshes
    boneVisualsGroup.traverse((object) => {
        if (object.userData && object.userData.bonePart === 'cap') {
            labelCount.total++;
            
            // Get world position of this joint
            const worldPos = new THREE.Vector3();
            object.getWorldPosition(worldPos);
            
            // Check if we already have a label at this position
            if (hasLabelAtPosition(worldPos)) {
                console.log('Skipping duplicate joint label at position:', worldPos);
                return;
            }
            
            // Determine which bone name to use
            let boneName = "";
            if (object.parent && object.parent.userData) {
                if (object.position.y > 0 && object.parent.userData.childBone) {
                    // Top sphere - use child bone name
                    boneName = object.parent.userData.childBone.name;
                } else if (object.position.y === 0 && object.parent.userData.parentBone) {
                    // Bottom sphere - use parent bone name
                    boneName = object.parent.userData.parentBone.name;
                }
            }
            
            if (boneName) {
                // Create a label for this joint
                const label = createSimpleLabel(boneName, object, scene);
                if (label) {
                    const jointLabelGroup = getLabelGroup('joint');
                    if (jointLabelGroup) {
                        jointLabelGroup.add(label);
                        labelCount.added++;
                        
                        // Record this position as having a label
                        labelPositions.push(worldPos);
                    }
                }
            }
        }
    });
    
    console.log(`Created ${labelCount.added} labels out of ${labelCount.total} joint spheres found`);
    return scene.getObjectByName("JointLabels");
}

/**
 * Create bone labels for all bone segments in the scene
 * @param {Object} scene - The Three.js scene
 */
export function createBoneLabels(scene) {
    console.log('Creating bone labels...');
    
    // Remove any existing bone labels
    clearLabels('bone', scene);
    
    // Create a group to hold all bone labels
    setLabelGroup('bone', "BoneLabels", scene);
    
    // Keep track of the labels created
    const labelCount = {total: 0, added: 0};
    
    // Track bone connections that already have labels to prevent duplicates
    const labeledBoneConnections = new Set();
    
    // Find all bone groups
    boneVisualsGroup.children.forEach((boneGroup) => {
        // Skip if not a bone group
        if (!boneGroup.userData || !boneGroup.userData.isVisualBone) {
            return;
        }
        
        labelCount.total++;
        
        // Get bone name information from the bone group
        let boneName = "";
        if (boneGroup.userData.parentBone && boneGroup.userData.childBone) {
            // Create a connection identifier (both directions to handle differently ordered pairs)
            const parentID = boneGroup.userData.parentBone.id || boneGroup.userData.parentBone.uuid;
            const childID = boneGroup.userData.childBone.id || boneGroup.userData.childBone.uuid;
            const connectionID = `${parentID}_${childID}`;
            const reverseConnectionID = `${childID}_${parentID}`;
            
            // Skip if we already created a label for this connection
            if (labeledBoneConnections.has(connectionID) || labeledBoneConnections.has(reverseConnectionID)) {
                console.log('Skipping duplicate bone label for connection:', 
                           `${boneGroup.userData.parentBone.name} → ${boneGroup.userData.childBone.name}`);
                return;
            }
            
            // Create a name that indicates the connection
            boneName = `${boneGroup.userData.parentBone.name} → ${boneGroup.userData.childBone.name}`;
            
            // Create a label for this bone
            const label = createSimpleLabel(boneName, boneGroup, scene, true); // Pass true to indicate it's a bone label
            if (label) {
                const boneLabelGroup = getLabelGroup('bone');
                if (boneLabelGroup) {
                    boneLabelGroup.add(label);
                    labelCount.added++;
                    
                    // Mark this connection as labeled
                    labeledBoneConnections.add(connectionID);
                    
                    // Calculate the midpoint between parent and child bones immediately
                    const parentPos = new THREE.Vector3();
                    const childPos = new THREE.Vector3();
                    
                    boneGroup.userData.parentBone.getWorldPosition(parentPos);
                    boneGroup.userData.childBone.getWorldPosition(childPos);
                    
                    // Calculate the middle point
                    const midPoint = new THREE.Vector3().addVectors(parentPos, childPos).multiplyScalar(0.5);
                    
                    // Position at the middle point immediately
                    label.position.copy(midPoint);
                    
                    // Position the label at the middle of the bone
                    if (label.userData.updatePosition) {
                        label.userData.updatePosition();
                    }
                }
            }
        }
    });
    
    console.log(`Created ${labelCount.added} labels out of ${labelCount.total} bone segments found`);
    return scene.getObjectByName("BoneLabels");
}

/**
 * Create both joint and bone labels and set their visibility
 * @param {Object} scene - The Three.js scene
 */
export function createLabels(scene) {
    // Create joint labels
    console.log('Setting up joint labels');
    createJointLabels(scene);
    
    // Check if joint labels should be visible based on option
    if (!rigOptions.showJointLabels) {
        hideLabels('joint');
    }
    
    // Create bone labels
    console.log('Setting up bone labels');
    createBoneLabels(scene);
    
    // Check if bone labels should be visible based on option
    if (!rigOptions.showBoneLabels) {
        hideLabels('bone');
    }
}

/**
 * Create a simple text label as a sprite
 * @param {string} text - Text to display
 * @param {Object} joint - Joint object to attach to
 * @param {Object} scene - Three.js scene
 * @param {boolean} isBoneLabel - Whether this is a bone label (true) or joint label (false)
 * @returns {Object} The created label sprite
 */
function createSimpleLabel(text, joint, scene, isBoneLabel = false) {
    console.log(`Creating label for ${isBoneLabel ? 'bone' : 'joint'}: ${text}`);

    // Create a canvas for the label
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 256;
    // Increase height for bone labels to accommodate multiple lines
    canvas.height = isBoneLabel ? 96 : 64;
    
    // Different styling for bone vs joint labels - ONLY VISUAL DIFFERENCES HERE
    const labelConfig = {
        bgColor: isBoneLabel ? 'rgba(30, 136, 229, 0.8)' : 'rgba(76, 175, 80, 0.8)',
        gradientStops: isBoneLabel ? 
            [{ pos: 0, color: 'rgba(40, 40, 80, 0.4)' }, { pos: 1, color: 'rgba(20, 20, 40, 0.6)' }] : 
            [{ pos: 0, color: 'rgba(30, 60, 30, 0.4)' }, { pos: 1, color: 'rgba(10, 30, 10, 0.6)' }],
        borderColor: isBoneLabel ? '#88AAFF' : '#AAFFAA',
        scrollThumbColor: isBoneLabel ? '#88AAFF' : '#AAFFAA',
        headerText: isBoneLabel ? 'BONE' : 'JOINT'
    };
    
    // Background fill
    ctx.fillStyle = labelConfig.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    labelConfig.gradientStops.forEach(stop => {
        gradient.addColorStop(stop.pos, stop.color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.strokeStyle = labelConfig.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Header line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, 18);
    
    // Header text
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#DDDDDD';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelConfig.headerText, 6, 9);
    
    // Main text
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // For bone labels, format as multiple lines if it contains an arrow
    if (isBoneLabel && text.includes('→')) {
        const parts = text.split('→');
        const parent = parts[0].trim();
        const child = parts[1].trim();
        
        // Calculate max width to check if parts need scrolling
        const parentWidth = ctx.measureText(parent).width;
        const childWidth = ctx.measureText(child).width;
        const maxWidth = canvas.width - 20; // 10px padding on each side
        
        // First line: parent
        let parentText = parent;
        if (parentWidth > maxWidth) {
            parentText = parent.length > 25 ? parent.substring(0, 22) + '...' : parent;
        }
        ctx.fillText(parentText, canvas.width / 2, 35);
        
        // Arrow line
        ctx.fillText('↓', canvas.width / 2, 55);
        
        // Third line: child
        let childText = child;
        if (childWidth > maxWidth) {
            childText = child.length > 25 ? child.substring(0, 22) + '...' : child;
        }
        ctx.fillText(childText, canvas.width / 2, 75);
        
        // If either part was truncated, add a scroll indicator
        if (parentWidth > maxWidth || childWidth > maxWidth) {
            // Draw scroll indicator
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(10, canvas.height - 8, canvas.width - 20, 4);
            
            // Draw scrollbar thumb
            const contentWidth = Math.max(parentWidth, childWidth);
            const thumbWidth = Math.max(30, (maxWidth / contentWidth) * (canvas.width - 20));
            ctx.fillStyle = labelConfig.scrollThumbColor;
            ctx.fillRect(10, canvas.height - 8, thumbWidth, 4);
        }
    } else {
        // Regular single-line text handling (for joint labels or non-arrow bone labels)
        // Calculate text width to check if it needs scrolling
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const maxWidth = canvas.width - 20; // 10px padding on each side
        
        // If text is too long, implement scrolling behavior
        if (textWidth > maxWidth) {
            // Indicate text is scrollable with ellipsis
            const displayText = text.length > 25 ? text.substring(0, 22) + '...' : text;
            ctx.fillText(displayText, canvas.width / 2, canvas.height / 2 + 5);
            
            // Draw scroll indicator
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(10, canvas.height - 8, canvas.width - 20, 4);
            
            // Draw scrollbar thumb
            const thumbWidth = Math.max(30, (maxWidth / textWidth) * (canvas.width - 20));
            ctx.fillStyle = labelConfig.scrollThumbColor;
            ctx.fillRect(10, canvas.height - 8, thumbWidth, 4);
        } else {
            // Text fits, just display it
            ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 5);
        }
    }
    
    // Create sprite material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.userData.isBoneLabel = isBoneLabel;
    sprite.userData.isJointLabel = !isBoneLabel;
    sprite.userData.targetJoint = joint;
    sprite.userData.labelText = text; // Store original text
    
    // Add hover handling for label headers
    sprite.userData.isInteractive = true;
    sprite.userData.isLabelHeader = true;
    sprite.userData.headerHeight = 18; // Height of the header section in pixels
    sprite.userData.canvasHeight = canvas.height;
    sprite.userData.canvasWidth = canvas.width;
    
    // Add mouse event handling to prevent propagation when over the header
    sprite.userData.onMouseMove = (event) => {
        // Check if mouse is over the header area
        if (sprite.userData.isMouseOverHeader) {
            // Prevent event propagation to stop camera controls
            event.stopPropagation();
        }
    };
    
    // This function calculates if mouse is over the header or the content area
    sprite.userData.checkHeaderHover = (mousePos) => {
        if (!mousePos) return false;
        
        // The sprite's coordinates go from -0.5 to 0.5 in both dimensions
        // So we need to convert from local sprite coordinates to canvas coordinates
        
        // Calculate the overall dimensions in world units
        const totalHeight = sprite.scale.y;
        
        // Convert mousePos.y from local coordinates (-0.5 to 0.5) to normalized height (0 to 1)
        // In THREE.js, sprite local coords have origin at center, Y+ is up
        // -0.5 is bottom, 0.5 is top, so we need to flip and shift
        const normalizedY = 0.5 - mousePos.y; // Convert to 0 at top, 1 at bottom
        
        // Now convert to canvas pixel coordinates
        const canvasY = normalizedY * canvas.height;
        
        // Check if we're in the header region (top 18px of the canvas)
        const isOverHeader = canvasY >= 0 && canvasY <= sprite.userData.headerHeight;
        
        return isOverHeader;
    };
    
    // Set initial position safely - updateLabelPosition now has defensive coding
    updateLabelPosition(sprite, joint);
    
    // FIXED SIZE FOR ALL LABELS - no dependency on underlying object geometry
    const fixedScale = 0.3;
    // Adjust height for bone labels to accommodate multiple lines
    const heightFactor = isBoneLabel ? 0.4 : 0.25;
    sprite.scale.set(fixedScale, fixedScale * heightFactor, 1);
    
    // Set initial visibility based on appropriate option
    sprite.visible = isBoneLabel ? rigOptions.showBoneLabels : rigOptions.showJointLabels;
    if (!sprite.visible) {
        console.log(`Label for ${text} is initially hidden`);
    }
    
    // Set up the update function - customize for bone labels
    sprite.userData.updatePosition = () => {
        // For bone labels, we want to position them in the middle of the bone
        if (isBoneLabel) {
            // Get the bone group which should have parent and child bone references
            const boneGroup = joint.userData && joint.userData.isVisualBone ? 
                joint : (joint.parent && joint.parent.userData && joint.parent.userData.isVisualBone ? 
                    joint.parent : null);
            
            if (boneGroup && boneGroup.userData && 
                boneGroup.userData.parentBone && boneGroup.userData.childBone) {
                
                // Get world positions of parent and child bones
                const parentPos = new THREE.Vector3();
                const childPos = new THREE.Vector3();
                
                boneGroup.userData.parentBone.getWorldPosition(parentPos);
                boneGroup.userData.childBone.getWorldPosition(childPos);
                
                // Calculate the middle point
                const midPoint = new THREE.Vector3().addVectors(parentPos, childPos).multiplyScalar(0.5);
                
                // Position exactly at the midpoint without any offset
                sprite.position.copy(midPoint);
            } else {
                // Fallback for when we can't find the proper bone references
                const worldPos = new THREE.Vector3();
                joint.getWorldPosition(worldPos);
                sprite.position.copy(worldPos);
            }
        } else {
            // For joint labels, use the standard update function
            updateLabelPosition(sprite, joint);
        }
    };
    
    // Initialize the position
    if (sprite.userData.updatePosition) {
        sprite.userData.updatePosition();
    }
    
    // Make sure the sprite renders on top
    sprite.renderOrder = isBoneLabel ? 990 : 1000; // Joint labels show on top of bone labels
    
    return sprite;
}