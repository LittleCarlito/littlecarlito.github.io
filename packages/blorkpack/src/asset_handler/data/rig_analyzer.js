const RIG_LOGS = true;

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

    analyze(gltfData, assetType = null) {
        if (!gltfData || !gltfData.scene) {
            if (RIG_LOGS) {
                console.warn('[RigAnalyzer] Invalid GLTF data provided');
            }
            return null;
        }

        if (assetType && this.analysisCache.has(assetType)) {
            const cached = this.analysisCache.get(assetType);
            return cached;
        }

        const rigDetails = {
            bones: [],
            rigs: [],
            roots: [],
            constraints: [],
            joints: [],
            activators: [],
            hasRig: false,
            hasActivators: false,
            boneHierarchy: new Map(),
            armature: null
        };

        const bones = [];
        const activators = [];
        let armature = null;

        this.traverseForRigElements(gltfData.scene, bones, rigDetails, (node) => {
            if (this.isArmature(node) && !armature) {
                armature = node;
                rigDetails.armature = node;
                rigDetails.rigs.push(this.createRigData(node));
            }
            
            if (this.isActivator(node)) {
                activators.push(node);
                rigDetails.activators.push(this.createActivatorData(node));
            }
        });

        if (bones.length > 0) {
            this.processBones(bones, rigDetails);
            this.buildBoneHierarchy(bones, rigDetails);
            rigDetails.hasRig = true;
        }

        if (activators.length > 0) {
            rigDetails.hasActivators = true;
        }

        if (assetType && rigDetails.hasRig) {
            this.analysisCache.set(assetType, rigDetails);
        }

        return rigDetails.hasRig ? rigDetails : null;
    }

    traverseForRigElements(scene, bones, rigDetails, callback = null) {
        scene.traverse(node => {
            if (this.isBone(node)) {
                this.prepareBone(node);
                bones.push(node);
            }

            if (callback) {
                callback(node);
            }
        });
    }

    isBone(node) {
        return node.isBone || 
               node.name.toLowerCase().includes('bone') ||
               node.type === 'Bone';
    }

    isArmature(node) {
        const name = node.name.toLowerCase();
        return name.includes('rig') || 
               name.includes('armature') || 
               name.includes('skeleton');
    }

    isActivator(node) {
        return node.isMesh && node.name.toLowerCase().startsWith('activate_');
    }

    prepareBone(bone) {
        bone.userData = bone.userData || {};
        bone.userData.initialRotation = {
            x: bone.rotation.x,
            y: bone.rotation.y,
            z: bone.rotation.z,
            order: bone.rotation.order
        };

        bone.userData.rigAnalyzed = true;
    }

    processBones(bones, rigDetails) {
        bones.forEach(bone => {
            const boneData = this.createBoneData(bone);
            
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

            if (this.isRootBone(bone)) {
                rigDetails.roots.push(this.createRootData(bone));
            }
        });
    }

    createBoneData(bone) {
        return {
            name: bone.name,
            position: bone.position ? [bone.position.x, bone.position.y, bone.position.z] : null,
            rotation: bone.rotation ? [bone.rotation.x, bone.rotation.y, bone.rotation.z] : null,
            parentName: (bone.parent && this.isBone(bone.parent)) ? bone.parent.name : null,
            constraintType: 'none',
            uuid: bone.uuid,
            node: bone
        };
    }

    createRigData(rig) {
        return {
            name: rig.name,
            position: rig.position ? [rig.position.x, rig.position.y, rig.position.z] : null,
            childCount: rig.children ? rig.children.length : 0,
            node: rig
        };
    }

    createRootData(root) {
        return {
            name: root.name,
            position: root.position ? [root.position.x, root.position.y, root.position.z] : null,
            node: root
        };
    }

    createActivatorData(activator) {
        return {
            name: activator.name,
            position: activator.position ? [activator.position.x, activator.position.y, activator.position.z] : null,
            rotation: activator.rotation ? [activator.rotation.x, activator.rotation.y, activator.rotation.z] : null,
            scale: activator.scale ? [activator.scale.x, activator.scale.y, activator.scale.z] : null,
            visible: activator.visible,
            uuid: activator.uuid,
            node: activator
        };
    }

    isRootBone(bone) {
        const name = bone.name.toLowerCase();
        const hasRootInName = name.includes('root') || name.includes('hip') || name.includes('pelvis');
        const hasNoBoneParent = !bone.parent || !this.isBone(bone.parent);
        
        return hasRootInName || hasNoBoneParent;
    }

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

    parseJointConstraints(node) {
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

        if (node.extras) {
            if (node.extras.constraints || node.extras.jointType) {
                return node.extras.constraints || { type: node.extras.jointType };
            }
        }

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

    logRigSummary(rigDetails) {
        console.log(`[RigAnalyzer] Analysis Summary:`);
        console.log(`  - Bones: ${rigDetails.bones.length}`);
        console.log(`  - Roots: ${rigDetails.roots.length}`);
        console.log(`  - Constraints: ${rigDetails.constraints.length}`);
        console.log(`  - Activators: ${rigDetails.activators.length}`);
        console.log(`  - Has Rig: ${rigDetails.hasRig}`);
        console.log(`  - Has Activators: ${rigDetails.hasActivators}`);
        
        if (rigDetails.activators.length > 0) {
            console.log(`  - Activator Names: ${rigDetails.activators.map(a => a.name).join(', ')}`);
        }
        
        if (rigDetails.constraints.length > 0) {
            const constraintTypes = {};
            rigDetails.constraints.forEach(c => {
                constraintTypes[c.type] = (constraintTypes[c.type] || 0) + 1;
            });
            console.log(`  - Constraint Types:`, constraintTypes);
        }
    }

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

        const orphanedBones = rigDetails.bones.filter(bone => 
            bone.parentName && !rigDetails.bones.find(b => b.name === bone.parentName)
        );
        
        if (orphanedBones.length > 0) {
            validation.warnings.push(`Found ${orphanedBones.length} orphaned bones`);
        }

        if (rigDetails.roots.length === 0) {
            validation.warnings.push('No root bone identified');
        }

        if (rigDetails.boneHierarchy.size !== rigDetails.bones.length) {
            validation.warnings.push('Bone hierarchy mapping incomplete');
        }

        return validation;
    }

    clearCache() {
        this.analysisCache.clear();
    }

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