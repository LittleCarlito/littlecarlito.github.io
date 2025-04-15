
/**
 * Apply inverse kinematics to bone chain
 * @param {Object} targetBone - The bone being controlled
 * @param {THREE.Vector3} targetPosition - The target world position
 */
function applyInverseKinematics(targetBone, targetPosition) {
    if (!targetBone) return;
    
    try {
        // Get bone positions with fallbacks in case worldPos is not working
        let bonePosition = worldPos || new THREE.Vector3();
        targetBone.getWorldPosition(bonePosition);
        
        // Direction from current bone to target
        let targetDir = new THREE.Vector3().subVectors(targetPosition, bonePosition).normalize();
        
        // Get rotation with fallback
        let boneRotation = worldRot || new THREE.Quaternion();
        targetBone.getWorldQuaternion(boneRotation);
        
        // Current bone forward direction (assuming Y)
        let boneDir = new THREE.Vector3(0, 1, 0).applyQuaternion(boneRotation).normalize();
        
        // Cross product to get rotation axis
        let rotationAxis = new THREE.Vector3().crossVectors(boneDir, targetDir).normalize();
        
        // Calculate rotation angle (use MathUtils.clamp to fix the bug)
        const dotProduct = boneDir.dot(targetDir);
        const rotationAngle = Math.acos(Math.min(1, Math.max(-1, dotProduct))) * IK_WEIGHT;
        
        // Only rotate if we have a valid rotation
        if (rotationAxis.lengthSq() > 0.0001 && !isNaN(rotationAngle)) {
            // Create rotation quaternion
            const q = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
            
            // Apply to bone local rotation
            targetBone.quaternion.premultiply(q);
            
            // Update all bones to ensure proper propagation
            updateAllBoneMatrices();
        }
    } catch (error) {
        console.error('Error in applyInverseKinematics:', error);
    }
}