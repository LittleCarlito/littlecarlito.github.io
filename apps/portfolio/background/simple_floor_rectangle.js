import { THREE, RAPIER } from '../common';

const SIMPLE_FLOOR_WIDTH = 15;
const SIMPLE_FLOOR_HEIGHT = 0.5;
const SIMPLE_FLOOR_DEPTH = 15;
const SIMPLE_FLOOR_X = 0;
const SIMPLE_FLOOR_Y = -10.25;
const SIMPLE_FLOOR_Z = 0;

export class SimpleFloorRectangle {
	constructor(world, parent) {
		this.world = world;
		this.parent = parent;
		this.width = SIMPLE_FLOOR_WIDTH;
		this.height = SIMPLE_FLOOR_HEIGHT;
		this.depth = SIMPLE_FLOOR_DEPTH;
		this.x = SIMPLE_FLOOR_X;
		this.y = SIMPLE_FLOOR_Y;
		this.z = SIMPLE_FLOOR_Z;
		
		this.mesh = null;
		this.body = null;
		this.collider = null;
		this.transparentMaterial = null;
		this.debugMaterial = null;
		
		console.log(`SimpleFloorRectangle: Creating floor at position (${this.x}, ${this.y}, ${this.z})`);
		this.createFloor();
	}
	
	createFloor() {
		const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
		
		// Create transparent material (default)
		this.transparentMaterial = new THREE.MeshStandardMaterial({ 
			color: 0xffffff,
			transparent: true,
			opacity: 0.0,
			roughness: 0.8,
			metalness: 0.2
		});
		
		// Create debug material (red for collision visualization)
		this.debugMaterial = new THREE.MeshStandardMaterial({ 
			color: 0xff0000,
			transparent: false,
			opacity: 1.0,
			roughness: 0.8,
			metalness: 0.2
		});
		
		this.mesh = new THREE.Mesh(geometry, this.transparentMaterial);
		this.mesh.position.set(this.x, this.y, this.z);
		this.mesh.name = "SimpleFloor";
		this.mesh.receiveShadow = true;
		
		// Add collision wireframe methods to userData
		this.mesh.userData.enableCollisionWireframes = () => {
			this.mesh.material = this.debugMaterial;
			this.mesh.material.needsUpdate = true;
		};
		
		this.mesh.userData.disableCollisionWireframes = () => {
			this.mesh.material = this.transparentMaterial;
			this.mesh.material.needsUpdate = true;
		};
		
		// Mark this mesh as having collision wireframes
		this.mesh.userData.collisionWireframes = true;
		
		console.log(`SimpleFloorRectangle: Mesh positioned at (${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z})`);
		
		this.parent.add(this.mesh);
		
		if (this.world) {
			this.createPhysicsBody();
		}
	}
	
	createPhysicsBody() {
		const worldPosition = new THREE.Vector3();
		this.mesh.getWorldPosition(worldPosition);
		
		const bodyDesc = RAPIER.RigidBodyDesc.fixed();
		bodyDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
		this.body = this.world.createRigidBody(bodyDesc);
		
		const colliderDesc = RAPIER.ColliderDesc.cuboid(
			this.width / 2, 
			this.height / 2, 
			this.depth / 2
		);
		colliderDesc.setRestitution(0.3);
		colliderDesc.setFriction(0.8);
		colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
		
		this.collider = this.world.createCollider(colliderDesc, this.body);
		
		const bodyPos = this.body.translation();
		console.log(`SimpleFloorRectangle: Physics body positioned at (${bodyPos.x}, ${bodyPos.y}, ${bodyPos.z})`);
		console.log(`Created simple floor: ${SIMPLE_FLOOR_WIDTH}x${SIMPLE_FLOOR_HEIGHT}x${SIMPLE_FLOOR_DEPTH} at (${SIMPLE_FLOOR_X}, ${SIMPLE_FLOOR_Y}, ${SIMPLE_FLOOR_Z})`);
	}
	
	dispose() {
		if (this.collider) {
			this.world.removeCollider(this.collider, true);
		}
		if (this.body) {
			this.world.removeRigidBody(this.body);
		}
		if (this.mesh) {
			this.parent.remove(this.mesh);
			this.mesh.geometry.dispose();
			if (this.transparentMaterial) {
				this.transparentMaterial.dispose();
			}
			if (this.debugMaterial) {
				this.debugMaterial.dispose();
			}
		}
	}
}