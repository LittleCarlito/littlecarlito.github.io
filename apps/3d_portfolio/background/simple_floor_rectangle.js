import { THREE, RAPIER } from '../common';

const SIMPLE_FLOOR_WIDTH = 15;
const SIMPLE_FLOOR_HEIGHT = 0.5;
const SIMPLE_FLOOR_DEPTH = 15;

export class SimpleFloorRectangle {
	constructor(world, parent, config = {}) {
		this.world = world;
		this.parent = parent;
		this.width = config.width || SIMPLE_FLOOR_WIDTH;
		this.height = config.height || SIMPLE_FLOOR_HEIGHT;
		this.depth = config.depth || SIMPLE_FLOOR_DEPTH;
		this.x = config.x || 0;
		this.y = config.y || -10.25;
		this.z = config.z || 0;
		this.rotation = config.rotation || { x: 0, y: 0, z: 0 };
		this.debugColor = config.debugColor || 0xff0000;
		this.name = config.name || "SimpleFloor";
		
		this.mesh = null;
		this.body = null;
		this.collider = null;
		this.transparentMaterial = null;
		this.debugMaterial = null;
		
		this.createFloor();
	}
	
	createFloor() {
		const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
		
		this.transparentMaterial = new THREE.MeshStandardMaterial({ 
			color: 0xffffff,
			transparent: true,
			opacity: 0.0,
			roughness: 0.8,
			metalness: 0.2
		});
		
		this.debugMaterial = new THREE.MeshStandardMaterial({ 
			color: this.debugColor,
			transparent: false,
			opacity: 1.0,
			roughness: 0.8,
			metalness: 0.2
		});
		
		this.mesh = new THREE.Mesh(geometry, this.debugMaterial);
		this.mesh.position.set(this.x, this.y, this.z);
		this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
		this.mesh.name = this.name;
		this.mesh.receiveShadow = true;
		this.mesh.visible = false;
		
		this.mesh.userData.enableCollisionWireframes = () => {
			this.mesh.visible = true;
			this.mesh.material = this.debugMaterial;
			this.mesh.material.needsUpdate = true;
		};
		
		this.mesh.userData.disableCollisionWireframes = () => {
			this.mesh.visible = false;
		};
		
		this.mesh.userData.collisionWireframes = true;
				
		this.parent.add(this.mesh);
		
		if (this.world) {
			this.createPhysicsBody();
		}
	}
	
	createPhysicsBody() {
		const worldPosition = new THREE.Vector3();
		const worldQuaternion = new THREE.Quaternion();
		this.mesh.getWorldPosition(worldPosition);
		this.mesh.getWorldQuaternion(worldQuaternion);
		
		const bodyDesc = RAPIER.RigidBodyDesc.fixed();
		bodyDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
		bodyDesc.setRotation(worldQuaternion);
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