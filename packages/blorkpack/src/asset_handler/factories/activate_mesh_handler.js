import * as THREE from 'three';

export class ActivateMeshHandler {
	static createActivatorMaterial() {
		return new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.8,
			metalness: 0.0,
			side: THREE.DoubleSide
		});
	}

	static processActivateMeshes(model) {
		const activateMeshes = [];
		
		model.traverse((child) => {
			if (child.isMesh && child.name.startsWith('activate_')) {
				child.visible = false;
				const activatorMaterial = this.createActivatorMaterial();
				child.material = activatorMaterial;
				activateMeshes.push(child);
			}
		});

		return activateMeshes;
	}

	static reapplyActivatorMaterials(activateMeshes) {
		activateMeshes.forEach(mesh => {
			const activatorMaterial = this.createActivatorMaterial();
			mesh.material = activatorMaterial;
		});
	}

	static addActivateMeshMethods(model, activateMeshes) {
		if (activateMeshes.length === 0) return;

		model.userData.activateMeshes = activateMeshes;
		
		model.userData.showActivateMesh = (meshName = null) => {
			if (meshName) {
				const targetMesh = activateMeshes.find(mesh => 
					mesh.name === meshName || 
					mesh.name === `activate_${meshName}` ||
					mesh.name.endsWith(`_${meshName}`)
				);
				if (targetMesh) {
					targetMesh.visible = true;
				} else {
					console.warn(`Activate mesh "${meshName}" not found`);
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.visible = true;
				});
			}
		};

		model.userData.hideActivateMesh = (meshName = null) => {
			if (meshName) {
				const targetMesh = activateMeshes.find(mesh => 
					mesh.name === meshName || 
					mesh.name === `activate_${meshName}` ||
					mesh.name.endsWith(`_${meshName}`)
				);
				if (targetMesh) {
					targetMesh.visible = false;
				} else {
					console.warn(`Activate mesh "${meshName}" not found`);
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.visible = false;
				});
			}
		};

		model.userData.toggleActivateMesh = (meshName = null) => {
			if (meshName) {
				const targetMesh = activateMeshes.find(mesh => 
					mesh.name === meshName || 
					mesh.name === `activate_${meshName}` ||
					mesh.name.endsWith(`_${meshName}`)
				);
				if (targetMesh) {
					targetMesh.visible = !targetMesh.visible;
				} else {
					console.warn(`Activate mesh "${meshName}" not found`);
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.visible = !mesh.visible;
				});
			}
		};

		model.userData.getActivateMeshes = () => {
			return activateMeshes.map(mesh => ({
				name: mesh.name,
				visible: mesh.visible,
				mesh: mesh
			}));
		};

		model.userData.isActivateMeshVisible = (meshName = null) => {
			if (meshName) {
				const targetMesh = activateMeshes.find(mesh => 
					mesh.name === meshName || 
					mesh.name === `activate_${meshName}` ||
					mesh.name.endsWith(`_${meshName}`)
				);
				return targetMesh ? targetMesh.visible : false;
			} else {
				return activateMeshes.some(mesh => mesh.visible);
			}
		};
	}

	static addActivateMeshMethodsToResult(result, activateMeshes) {
		if (activateMeshes.length === 0) return;

		result.showActivateMesh = result.mesh.userData.showActivateMesh;
		result.hideActivateMesh = result.mesh.userData.hideActivateMesh;
		result.toggleActivateMesh = result.mesh.userData.toggleActivateMesh;
		result.getActivateMeshes = result.mesh.userData.getActivateMeshes;
		result.isActivateMeshVisible = result.mesh.userData.isActivateMeshVisible;
	}
}