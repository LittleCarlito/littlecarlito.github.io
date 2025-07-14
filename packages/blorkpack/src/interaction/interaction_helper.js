import { THREE } from '../index';

export class InteractionHelper {
	static #instance = null;
	raycaster = null;
	mouse = null;
	dragStartPosition = null;
	dragPlane = null;
	dragOffset = null;
	dragTargetPosition = null;
	isDragging = false;
	dragTarget = null;
	assetContainer = null;
	interactionManager = null;

	constructor() {
		if (InteractionHelper.#instance) {
			throw new Error('InteractionHelper is a singleton. Use InteractionHelper.getInstance() instead.');
		}
		this.initializeObjects();
		InteractionHelper.#instance = this;
	}

	static getInstance() {
		if (!InteractionHelper.#instance) {
			InteractionHelper.#instance = new InteractionHelper();
		}
		return InteractionHelper.#instance;
	}

	initializeObjects() {
		if (!this.dragStartPosition) this.dragStartPosition = new THREE.Vector3();
		if (!this.dragPlane) this.dragPlane = new THREE.Plane();
		if (!this.dragOffset) this.dragOffset = new THREE.Vector3();
		if (!this.dragTargetPosition) this.dragTargetPosition = new THREE.Vector3();
		if (!this.raycaster) this.raycaster = new THREE.Raycaster();
		if (!this.mouse) this.mouse = new THREE.Vector2();
	}

	setInteractionManager(interactionManager) {
		this.interactionManager = interactionManager;
	}

	updateMousePosition(clientX, clientY, renderer) {
		const rect = renderer.domElement.getBoundingClientRect();
		this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
	}

	updateRaycaster(camera) {
		if (camera) {
			this.raycaster.setFromCamera(this.mouse, camera);
		}
	}

	findAssetContainer(object) {
		if (this.assetContainer) return this.assetContainer;
		
		let currentParent = object.parent;
		
		while (currentParent) {
			if (currentParent.name === 'asset_container' || 
				(currentParent.userData && currentParent.userData.isAssetContainer)) {
				this.assetContainer = currentParent;
				return this.assetContainer;
			}
			currentParent = currentParent.parent;
		}
		
		return null;
	}

	startDrag(object, intersection, camera, options = {}) {
		if (!object) return false;

		this.initializeObjects();
		this.isDragging = true;
		this.dragTarget = object;

		const container = options.container || this.findAssetContainer(object);
		if (container) {
			this.assetContainer = container;
		}

		this.dragTargetPosition.copy(object.position);

		let worldObjectPosition = this.dragTargetPosition.clone();
		if (this.assetContainer) {
			this.assetContainer.localToWorld(worldObjectPosition);
		}

		const planeNormal = options.planeNormal || 
			new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
		this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, worldObjectPosition);

		const dragIntersectionPoint = new THREE.Vector3();
		this.raycaster.ray.intersectPlane(this.dragPlane, dragIntersectionPoint);
		this.dragOffset.subVectors(worldObjectPosition, dragIntersectionPoint);

		if (options.onDragStart) {
			options.onDragStart(object, worldObjectPosition);
		}

		return true;
	}

	updateDrag(options = {}) {
		if (!this.isDragging || !this.dragTarget) return false;

		this.initializeObjects();

		const worldIntersection = new THREE.Vector3();
		
		if (this.raycaster.ray.intersectPlane(this.dragPlane, worldIntersection)) {
			worldIntersection.add(this.dragOffset);

			let localIntersection = worldIntersection.clone();
			if (this.assetContainer) {
				this.assetContainer.worldToLocal(localIntersection);
			}

			const oldPosition = this.dragTarget.position.clone();
			this.dragTarget.position.copy(localIntersection);

			if (options.onDragUpdate) {
				const worldTargetPosition = localIntersection.clone();
				if (this.assetContainer) {
					this.assetContainer.localToWorld(worldTargetPosition);
				}
				options.onDragUpdate(this.dragTarget, localIntersection, worldTargetPosition, oldPosition);
			}

			return true;
		}

		return false;
	}

	stopDrag(options = {}) {
		if (!this.isDragging || !this.dragTarget) return false;

		const draggedObject = this.dragTarget;
		const finalPosition = this.dragTarget.position.clone();

		this.isDragging = false;
		
		if (options.onDragEnd) {
			options.onDragEnd(draggedObject, finalPosition);
		}

		this.dragTarget = null;
		return true;
	}

	getDragState() {
		return {
			isDragging: this.isDragging,
			dragTarget: this.dragTarget,
			dragPosition: this.dragTarget ? this.dragTarget.position.clone() : null
		};
	}

	transformWorldToLocal(worldPosition, container = null) {
		const targetContainer = container || this.assetContainer;
		if (!targetContainer) return worldPosition.clone();
		
		const localPosition = worldPosition.clone();
		targetContainer.worldToLocal(localPosition);
		return localPosition;
	}

	transformLocalToWorld(localPosition, container = null) {
		const targetContainer = container || this.assetContainer;
		if (!targetContainer) return localPosition.clone();
		
		const worldPosition = localPosition.clone();
		targetContainer.localToWorld(worldPosition);
		return worldPosition;
	}

	createDragPlaneFromNormal(normal, point) {
		this.initializeObjects();
		this.dragPlane.setFromNormalAndCoplanarPoint(normal, point);
		return this.dragPlane;
	}

	createCameraDragPlane(camera, point) {
		const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
		return this.createDragPlaneFromNormal(planeNormal, point);
	}

	getWorldIntersectionOnPlane(plane = null) {
		const targetPlane = plane || this.dragPlane;
		const intersection = new THREE.Vector3();
		
		if (this.raycaster.ray.intersectPlane(targetPlane, intersection)) {
			return intersection;
		}
		
		return null;
	}

	moveObjectToWorldPosition(object, worldPosition, options = {}) {
		const container = options.container || this.findAssetContainer(object);
		
		if (container) {
			const localPosition = worldPosition.clone();
			container.worldToLocal(localPosition);
			object.position.copy(localPosition);
		} else {
			object.position.copy(worldPosition);
		}

		if (options.onPositionUpdate) {
			options.onPositionUpdate(object, worldPosition);
		}
	}

	constrainDragToAxis(axis, localPosition, startPosition) {
		const constrainedPosition = startPosition.clone();
		
		switch(axis.toLowerCase()) {
		case 'x':
			constrainedPosition.x = localPosition.x;
			break;
		case 'y':
			constrainedPosition.y = localPosition.y;
			break;
		case 'z':
			constrainedPosition.z = localPosition.z;
			break;
		case 'xy':
			constrainedPosition.x = localPosition.x;
			constrainedPosition.y = localPosition.y;
			break;
		case 'xz':
			constrainedPosition.x = localPosition.x;
			constrainedPosition.z = localPosition.z;
			break;
		case 'yz':
			constrainedPosition.y = localPosition.y;
			constrainedPosition.z = localPosition.z;
			break;
		default:
			return localPosition;
		}
		
		return constrainedPosition;
	}

	snapToGrid(position, gridSize = 1.0) {
		return new THREE.Vector3(
			Math.round(position.x / gridSize) * gridSize,
			Math.round(position.y / gridSize) * gridSize,
			Math.round(position.z / gridSize) * gridSize
		);
	}

	clampDragToBounds(position, bounds) {
		return new THREE.Vector3(
			THREE.MathUtils.clamp(position.x, bounds.min.x, bounds.max.x),
			THREE.MathUtils.clamp(position.y, bounds.min.y, bounds.max.y),
			THREE.MathUtils.clamp(position.z, bounds.min.z, bounds.max.z)
		);
	}

	getDistanceFromCamera(object, camera) {
		const objectWorldPos = new THREE.Vector3();
		object.getWorldPosition(objectWorldPos);
		return camera.position.distanceTo(objectWorldPos);
	}

	screenToWorldRay(screenX, screenY, camera, renderer) {
		const rect = renderer.domElement.getBoundingClientRect();
		const mouse = new THREE.Vector2(
			((screenX - rect.left) / rect.width) * 2 - 1,
			-((screenY - rect.top) / rect.height) * 2 + 1
		);
		
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, camera);
		return raycaster.ray;
	}

	worldToScreen(worldPosition, camera, renderer) {
		const vector = worldPosition.clone();
		vector.project(camera);
		
		const widthHalf = renderer.domElement.width / 2;
		const heightHalf = renderer.domElement.height / 2;
		
		return new THREE.Vector2(
			(vector.x * widthHalf) + widthHalf,
			-(vector.y * heightHalf) + heightHalf
		);
	}

	dispose() {
		this.stopDrag();
		this.raycaster = null;
		this.mouse = null;
		this.dragStartPosition = null;
		this.dragPlane = null;
		this.dragOffset = null;
		this.dragTargetPosition = null;
		this.assetContainer = null;
		this.interactionManager = null;
		InteractionHelper.#instance = null;
	}
}