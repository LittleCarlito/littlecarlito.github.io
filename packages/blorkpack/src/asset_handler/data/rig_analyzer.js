const RIG_LOGS = true;

/**
 * RigAnalyzer - Detects and analyzes rig structures in loaded GLB files
 * 
 * This module scans GLTF scene graphs for bones, armatures, and constraints,
 * providing detailed rig information for visualization and interaction systems.
 */
export class RigAnalyzer {
    static #instance = null;

    constructor() {
        if (RigAnalyzer.#instance) {
            return RigAnalyzer.#instance;
        }
        this.analysisCache = new Map();
        RigAnalyzer.#instance = this;
    }

    static get_instance() {
        if (!RigAnalyzer.#instance) {
            RigAnalyzer.#instance = new RigAnalyzer();
        }
        return RigAnalyzer.#instance;
    }

    /**
     * Analyzes a GLTF model for rig structures
     * @param {Object} gltfData - The loaded GLTF data with scene
     * @param {string} assetType - Asset type for caching
     * @returns {Object|null} Rig details object or null if no rig found
     */
    analyze(gltfData, assetType = null) {
        if (!gltfData || !gltfData.scene) {
            if (RIG_LOGS) {
                console.warn('[RigAnalyzer] Invalid GLTF data provided');
            }
            return null;
        }

        // Check cache first
        if (assetType && this.analysisCache.has(assetType)) {
            const cached = this.analysisCache.get(assetType);
            if (RIG_LOGS) {
                console.log(`[RigAnalyzer] Using cached analysis for ${assetType}`);
            }
            return cached;
        }

        const rigDetails = {
            bones: [],
            rigs: [],
            roots: [],
            constraints: [],
            joints: [],          // Initialize joints array here
            hasRig: false,
            boneHierarchy: new Map(),
            armature: null
        };

        const bones = [];
        let armature = null;

        // First pass: Find armature and collect bones
        this.traverseForRigElements(gltfData.scene, bones, rigDetails, (node) => {
            // Check for armature
            if (this.isArmature(node) && !armature) {
                armature = node;
                rigDetails.armature = node;
                rigDetails.rigs.push(this.createRigData(node));
            }
        });

        // Process bones if found
        if (bones.length > 0) {
            this.processBones(bones, rigDetails);
            this.buildBoneHierarchy(bones, rigDetails);
            rigDetails.hasRig = true;

            if (RIG_LOGS) {
                console.log(`[RigAnalyzer] Found rig in ${assetType || 'model'} with ${bones.length} bones`);
                this.logRigSummary(rigDetails);
            }
        }

        // Cache the result
        if (assetType && rigDetails.hasRig) {
            this.analysisCache.set(assetType, rigDetails);
        }

        return rigDetails.hasRig ? rigDetails : null;
    }

    /**
     * Traverses scene graph looking for rig elements
     * @param {Object} scene - Three.js scene or object to traverse
     * @param {Array} bones - Array to collect bones
     * @param {Object} rigDetails - Rig details object to populate
     * @param {Function} callback - Callback for additional processing
     */
    traverseForRigElements(scene, bones, rigDetails, callback = null) {
        scene.traverse(node => {
            // Process bones
            if (this.isBone(node)) {
                this.prepareBone(node);
                bones.push(node);
            }

            // Additional callback processing
            if (callback) {
                callback(node);
            }
        });
    }

    /**
     * Checks if a node is a bone
     * @param {Object} node - Three.js object
     * @returns {boolean} True if node is a bone
     */
    isBone(node) {
        return node.isBone || 
               node.name.toLowerCase().includes('bone') ||
               node.type === 'Bone';
    }

    /**
     * Checks if a node is an armature
     * @param {Object} node - Three.js object
     * @returns {boolean} True if node is an armature
     */
    isArmature(node) {
        const name = node.name.toLowerCase();
        return name.includes('rig') || 
               name.includes('armature') || 
               name.includes('skeleton');
    }

    /**
     * Prepares a bone node for analysis
     * @param {Object} bone - Bone node to prepare
     */
    prepareBone(bone) {
        // Store initial rotation for reset functionality
        bone.userData = bone.userData || {};
        bone.userData.initialRotation = {
            x: bone.rotation.x,
            y: bone.rotation.y,
            z: bone.rotation.z,
            order: bone.rotation.order
        };

        // Mark as analyzed
        bone.userData.rigAnalyzed = true;
    }

    /**
     * Processes collected bones and extracts detailed information
     * @param {Array} bones - Array of bone nodes
     * @param {Object} rigDetails - Rig details object to populate
     */
    processBones(bones, rigDetails) {
        bones.forEach(bone => {
            const boneData = this.createBoneData(bone);
            
            // Check for constraints
            const constraints = this.parseJointConstraints(bone);
            if (constraints) {
                boneData.constraintType = constraints.type;
                rigDetails.constraints.push({
                    boneName: bone.name,
                    type: constraints.type,
                    data: constraints
                });
            }

            rigDetails.bones.push(boneData);

            // Check if root bone
            if (this.isRootBone(bone)) {
                rigDetails.roots.push(this.createRootData(bone));
            }
        });
    }

    /**
     * Creates bone data object
     * @param {Object} bone - Bone node
     * @returns {Object} Bone data object
     */
    createBoneData(bone) {
        return {
            name: bone.name,
            position: bone.position ? [bone.position.x, bone.position.y, bone.position.z] : null,
            rotation: bone.rotation ? [bone.rotation.x, bone.rotation.y, bone.rotation.z] : null,
            parentName: (bone.parent && this.isBone(bone.parent)) ? bone.parent.name : null,
            constraintType: 'none',
            uuid: bone.uuid,
            node: bone // Direct reference for visualization
        };
    }

    /**
     * Creates rig data object
     * @param {Object} rig - Rig/armature node
     * @returns {Object} Rig data object
     */
    createRigData(rig) {
        return {
            name: rig.name,
            position: rig.position ? [rig.position.x, rig.position.y, rig.position.z] : null,
            childCount: rig.children ? rig.children.length : 0,
            node: rig
        };
    }

    /**
     * Creates root bone data object
     * @param {Object} root - Root bone node
     * @returns {Object} Root data object
     */
    createRootData(root) {
        return {
            name: root.name,
            position: root.position ? [root.position.x, root.position.y, root.position.z] : null,
            node: root
        };
    }

    /**
     * Checks if a bone is a root bone
     * @param {Object} bone - Bone node to check
     * @returns {boolean} True if root bone
     */
    isRootBone(bone) {
        const name = bone.name.toLowerCase();
        const hasRootInName = name.includes('root') || name.includes('hip') || name.includes('pelvis');
        const hasNoBoneParent = !bone.parent || !this.isBone(bone.parent);
        
        return hasRootInName || hasNoBoneParent;
    }

    /**
     * Builds bone hierarchy map for easy traversal
     * @param {Array} bones - Array of bone nodes
     * @param {Object} rigDetails - Rig details object
     */
    buildBoneHierarchy(bones, rigDetails) {
        bones.forEach(bone => {
            const children = bones.filter(b => b.parent === bone);
            rigDetails.boneHierarchy.set(bone.uuid, {
                bone: bone,
                children: children,
                parent: this.isBone(bone.parent) ? bone.parent : null
            });
        });
    }

    /**
     * Parses joint constraint data from various sources
     * @param {Object} node - Bone node to examine
     * @returns {Object|null} Constraint data or null
     */
    parseJointConstraints(node) {
        // Check userData for constraints
        if (node.userData) {
            if (node.userData.constraints || node.userData.boneConstraints) {
                return node.userData.constraints || node.userData.boneConstraints;
            }
            
            if (node.userData.limitRotation || node.userData.rotationLimits) {
                return {
                    type: 'limitRotation',
                    limits: node.userData.limitRotation || node.userData.rotationLimits
                };
            }
        }

        // Check GLTF extras
        if (node.extras) {
            if (node.extras.constraints || node.extras.jointType) {
                return node.extras.constraints || { type: node.extras.jointType };
            }
        }

        // Infer from naming conventions
        const lowerName = node.name.toLowerCase();
        
        if (lowerName.includes('fixed') || lowerName.includes('rigid')) {
            return { type: 'fixed' };
        }
        
        if (lowerName.includes('hinge') || lowerName.includes('elbow') || lowerName.includes('knee')) {
            return {
                type: 'hinge',
                axis: lowerName.includes('_x') ? 'x' : (lowerName.includes('_z') ? 'z' : 'y'),
                min: -Math.PI/2,
                max: Math.PI/2
            };
        }
        
        if (lowerName.includes('spring') || lowerName.includes('bounce')) {
            return {
                type: 'spring',
                stiffness: 50,
                damping: 5,
                gravity: 1.0
            };
        }

        return null;
    }

    /**
     * Logs a summary of the analyzed rig
     * @param {Object} rigDetails - Rig details to log
     */
    logRigSummary(rigDetails) {
        console.log(`[RigAnalyzer] Rig Summary:`);
        console.log(`  - Bones: ${rigDetails.bones.length}`);
        console.log(`  - Roots: ${rigDetails.roots.length}`);
        console.log(`  - Constraints: ${rigDetails.constraints.length}`);
        
        if (rigDetails.constraints.length > 0) {
            const constraintTypes = {};
            rigDetails.constraints.forEach(c => {
                constraintTypes[c.type] = (constraintTypes[c.type] || 0) + 1;
            });
            console.log(`  - Constraint Types:`, constraintTypes);
        }
    }

    /**
     * Validates rig structure for completeness
     * @param {Object} rigDetails - Rig details to validate
     * @returns {Object} Validation result with warnings/errors
     */
    validateRig(rigDetails) {
        const validation = {
            valid: true,
            warnings: [],
            errors: []
        };

        if (!rigDetails || !rigDetails.hasRig) {
            validation.valid = false;
            validation.errors.push('No rig structure found');
            return validation;
        }

        // Check for orphaned bones
        const orphanedBones = rigDetails.bones.filter(bone => 
            bone.parentName && !rigDetails.bones.find(b => b.name === bone.parentName)
        );
        
        if (orphanedBones.length > 0) {
            validation.warnings.push(`Found ${orphanedBones.length} orphaned bones`);
        }

        // Check for missing root
        if (rigDetails.roots.length === 0) {
            validation.warnings.push('No root bone identified');
        }

        // Check for bone hierarchy issues
        if (rigDetails.boneHierarchy.size !== rigDetails.bones.length) {
            validation.warnings.push('Bone hierarchy mapping incomplete');
        }

        return validation;
    }

    /**
     * Clears the analysis cache
     */
    clearCache() {
        this.analysisCache.clear();
        if (RIG_LOGS) {
            console.log('[RigAnalyzer] Cache cleared');
        }
    }

    /**
     * Disposes of the analyzer instance
     */
    dispose() {
        this.clearCache();
        RigAnalyzer.#instance = null;
    }

    static dispose_instance() {
        if (RigAnalyzer.#instance) {
            RigAnalyzer.#instance.dispose();
        }
    }
}