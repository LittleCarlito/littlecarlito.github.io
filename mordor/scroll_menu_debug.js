import * as THREE from 'three';
import { FLAGS } from '../../common';

/**
 * Handles debug visualizations for the ScrollMenu
 */
export class ScrollMenuDebug {
    menu;
    debug_meshes = {
        segments: [],
        joints: [],
        sign: null,
        anchor: null,
        container: null
    };

    /**
     * Creates a new ScrollMenuDebug instance
     * @param {ScrollMenu} scrollMenu - The ScrollMenu instance to debug
     */
    constructor(scrollMenu) {
        this.menu = scrollMenu;
    }

    /**
     * Creates debug visualization meshes for the chain
     */
    createChainDebugMeshes() {
        if (!FLAGS.SIGN_VISUAL_DEBUG) return;

        // Create debug container for debug meshes if needed
        if (!this.debug_meshes.container) {
            this.debug_meshes.container = new THREE.Group();
            this.debug_meshes.container.name = "scroll_menu_debug_container";
            this.menu.assembly_container.add(this.debug_meshes.container);
        }

        // Create debug visualization for anchor
        if (this.menu.chainManager.anchor_body) {
            const anchorGeometry = new THREE.SphereGeometry(0.2);
            const anchorMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                wireframe: true,
                transparent: true,
                opacity: 1.0,
                depthTest: false,
                depthWrite: false
            });
            this.debug_meshes.anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
            const anchorPos = this.menu.chainManager.anchor_body.translation();
            const anchorRot = this.menu.chainManager.anchor_body.rotation();
            this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
            this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
            this.debug_meshes.anchor.renderOrder = 999;
            this.debug_meshes.container.add(this.debug_meshes.anchor);
        }

        // Create debug visualization for chain segments
        const chainSegments = this.menu.dynamic_bodies.filter(data => 
            data.type === 'scroll_menu_chain'
        );

        chainSegments.forEach(segment => {
            const segmentGeometry = new THREE.SphereGeometry(this.menu.CHAIN_CONFIG.SEGMENTS.RADIUS);
            const segmentMaterial = new THREE.MeshBasicMaterial({
                color: 0x0000ff,
                wireframe: true,
                depthTest: false,
                transparent: true,
                opacity: 0.8
            });
            const debugSegment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            
            if (segment.body) {
                const pos = segment.body.translation();
                const rot = segment.body.rotation();
                debugSegment.position.set(pos.x, pos.y, pos.z);
                debugSegment.quaternion.set(rot.x, rot.y, rot.z, rot.w);
            }
            
            this.debug_meshes.segments.push(debugSegment);
            this.debug_meshes.container.add(debugSegment);
        });

        // Create debug visualization for joints between segments
        for (let i = 0; i < chainSegments.length - 1; i++) {
            const jointGeometry = new THREE.SphereGeometry(0.1);
            const jointMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                wireframe: true,
                depthTest: false,
                transparent: true,
                opacity: 0.8
            });
            const jointDebug = new THREE.Mesh(jointGeometry, jointMaterial);
            
            if (chainSegments[i].body && chainSegments[i+1].body) {
                const pos1 = chainSegments[i].body.translation();
                const pos2 = chainSegments[i+1].body.translation();
                jointDebug.position.set(
                    (pos1.x + pos2.x) / 2,
                    (pos1.y + pos2.y) / 2,
                    (pos1.z + pos2.z) / 2
                );
            }
            
            this.debug_meshes.joints.push(jointDebug);
            this.debug_meshes.container.add(jointDebug);
        }

        // Create debug visualization for sign and joint to last chain segment
        if (this.menu.chainManager.sign_mesh && this.menu.chainManager.sign_body) {
            this.createSignDebugMesh();
        }
    }

    /**
     * Updates all debug visualization meshes
     */
    updateDebugVisualizations() {
        const debugEnabled = FLAGS.SIGN_VISUAL_DEBUG;
        
        // Skip all debug updates if not enabled
        if (!debugEnabled && this.debug_meshes.container) {
            this.debug_meshes.container.visible = false;
            return;
        } else if (this.debug_meshes.container) {
            this.debug_meshes.container.visible = true;
        }
        
        // Create debug visualizations if needed
        if (debugEnabled && !this.debug_meshes.container) {
            this.createChainDebugMeshes();
        }
        
        // Skip everything if no debug container exists
        if (!this.debug_meshes.container) return;
        
        // Update anchor debug mesh
        this.updateAnchorDebugMesh();
        
        // Update chain segment and joint debug meshes
        this.updateChainDebugMeshes();
        
        // Update sign debug mesh
        this.updateSignDebugMesh();
    }

    /**
     * Updates the anchor debug mesh
     */
    updateAnchorDebugMesh() {
        if (this.debug_meshes.anchor && this.menu.chainManager.anchor_body) {
            const anchorPos = this.menu.chainManager.anchor_body.translation();
            const anchorRot = this.menu.chainManager.anchor_body.rotation();
            this.debug_meshes.anchor.position.set(anchorPos.x, anchorPos.y, anchorPos.z);
            this.debug_meshes.anchor.quaternion.set(anchorRot.x, anchorRot.y, anchorRot.z, anchorRot.w);
            this.debug_meshes.anchor.visible = FLAGS.SIGN_VISUAL_DEBUG;
        }
    }

    /**
     * Updates the chain segment and joint debug meshes
     */
    updateChainDebugMeshes() {
        const chainData = this.menu.dynamic_bodies.filter(data => 
            data.type === 'scroll_menu_chain' && data.body && typeof data.body.translation === 'function'
        );
        
        // Update segment debug meshes
        this.debug_meshes.segments.forEach((debugMesh, index) => {
            if (index < chainData.length) {
                const data = chainData[index];
                if (data.body) {
                    const pos = data.body.translation();
                    const rot = data.body.rotation();
                    debugMesh.position.set(pos.x, pos.y, pos.z);
                    debugMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                }
            }
            debugMesh.visible = FLAGS.SIGN_VISUAL_DEBUG;
        });
        
        // Update joint debug meshes
        this.debug_meshes.joints.forEach((debugMesh, index) => {
            if (index < chainData.length - 1) {
                const body1 = chainData[index].body;
                const body2 = chainData[index + 1].body;
                if (body1 && body2) {
                    const pos1 = body1.translation();
                    const pos2 = body2.translation();
                    debugMesh.position.set(
                        (pos1.x + pos2.x) / 2,
                        (pos1.y + pos2.y) / 2,
                        (pos1.z + pos2.z) / 2
                    );
                }
            } else if (index === chainData.length - 1 && this.menu.chainManager.sign_body) {
                // Update sign joint position
                const lastChainBody = chainData[chainData.length - 1].body;
                const signBody = this.menu.chainManager.sign_body;
                if (lastChainBody && signBody) {
                    const chainPos = lastChainBody.translation();
                    const signPos = signBody.translation();
                    
                    debugMesh.position.set(
                        (chainPos.x + signPos.x) / 2,
                        (chainPos.y - this.menu.CHAIN_CONFIG.SEGMENTS.LENGTH/2 + 
                         signPos.y + this.menu.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT/2) / 2,
                        (chainPos.z + signPos.z) / 2
                    );
                }
            }
            debugMesh.visible = FLAGS.SIGN_VISUAL_DEBUG;
        });
    }

    /**
     * Updates the sign debug mesh
     */
    updateSignDebugMesh() {
        // Update sign debug mesh if it exists and sign body exists
        if (this.debug_meshes.sign && this.menu.chainManager.sign_body) {
            const signPos = this.menu.chainManager.sign_body.translation();
            const signRot = this.menu.chainManager.sign_body.rotation();
            
            this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
            this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
            this.debug_meshes.sign.visible = FLAGS.SIGN_VISUAL_DEBUG;
        } else if (!this.debug_meshes.sign && this.menu.chainManager.sign_mesh && FLAGS.SIGN_VISUAL_DEBUG) {
            // Create sign debug mesh if it doesn't exist but should
            this.createSignDebugMesh();
        }
    }

    /**
     * Creates the sign debug mesh
     */
    createSignDebugMesh() {
        if (!this.menu.chainManager.sign_mesh || !this.debug_meshes.container) return;
        
        const signGeometry = new THREE.BoxGeometry(
            this.menu.CHAIN_CONFIG.SIGN.DIMENSIONS.WIDTH,
            this.menu.CHAIN_CONFIG.SIGN.DIMENSIONS.HEIGHT,
            this.menu.CHAIN_CONFIG.SIGN.DIMENSIONS.DEPTH
        );
        const signMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            wireframe: true,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        
        this.debug_meshes.sign = new THREE.Mesh(signGeometry, signMaterial);
        
        if (this.menu.chainManager.sign_body) {
            const signPos = this.menu.chainManager.sign_body.translation();
            const signRot = this.menu.chainManager.sign_body.rotation();
            this.debug_meshes.sign.position.set(signPos.x, signPos.y, signPos.z);
            this.debug_meshes.sign.quaternion.set(signRot.x, signRot.y, signRot.z, signRot.w);
        } else {
            this.debug_meshes.sign.position.copy(this.menu.chainManager.sign_mesh.position);
            this.debug_meshes.sign.quaternion.copy(this.menu.chainManager.sign_mesh.quaternion);
        }
        
        this.debug_meshes.container.add(this.debug_meshes.sign);
    }

    /**
     * Cleans up debug resources
     */
    cleanup() {
        // Remove all debug meshes
        if (this.debug_meshes.anchor) {
            this.debug_meshes.container.remove(this.debug_meshes.anchor);
            if (this.debug_meshes.anchor.geometry) this.debug_meshes.anchor.geometry.dispose();
            if (this.debug_meshes.anchor.material) this.debug_meshes.anchor.material.dispose();
            this.debug_meshes.anchor = null;
        }
        
        // Clean up segment debug meshes
        this.debug_meshes.segments.forEach(mesh => {
            if (mesh && mesh.parent) {
                mesh.parent.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            }
        });
        this.debug_meshes.segments = [];
        
        // Clean up joint debug meshes
        this.debug_meshes.joints.forEach(mesh => {
            if (mesh && mesh.parent) {
                mesh.parent.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            }
        });
        this.debug_meshes.joints = [];
        
        // Clean up sign debug mesh
        if (this.debug_meshes.sign) {
            this.debug_meshes.container.remove(this.debug_meshes.sign);
            if (this.debug_meshes.sign.geometry) this.debug_meshes.sign.geometry.dispose();
            if (this.debug_meshes.sign.material) this.debug_meshes.sign.material.dispose();
            this.debug_meshes.sign = null;
        }
        
        // Remove debug container
        if (this.debug_meshes.container && this.debug_meshes.container.parent) {
            this.debug_meshes.container.parent.remove(this.debug_meshes.container);
            this.debug_meshes.container = null;
        }
    }
} 