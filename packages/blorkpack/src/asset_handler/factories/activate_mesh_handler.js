import * as THREE from 'three';

// ACTIVATE MESH CONTROLS
const ACTIVATE_MESH_CONFIG = {
	DEFAULT_COLOR: 0x00ff88,
	DEFAULT_EMISSIVE_INTENSITY: 2.5,
	DEFAULT_LIGHT_INTENSITY: 20,
	DEFAULT_LIGHT_DISTANCE: 15,
	INTENSITY_MULTIPLIER: 5
};

export class ActivateMeshHandler {
	static createActivatorMaterial() {
		return new THREE.MeshStandardMaterial({
			color: ACTIVATE_MESH_CONFIG.DEFAULT_COLOR,
			emissive: ACTIVATE_MESH_CONFIG.DEFAULT_COLOR,
			emissiveIntensity: ACTIVATE_MESH_CONFIG.DEFAULT_EMISSIVE_INTENSITY,
			roughness: 0.0,
			metalness: 0.0,
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 1.0
		});
	}

	static createLightMaterial(mesh) {
		const light = new THREE.PointLight(ACTIVATE_MESH_CONFIG.DEFAULT_COLOR, ACTIVATE_MESH_CONFIG.DEFAULT_LIGHT_INTENSITY, ACTIVATE_MESH_CONFIG.DEFAULT_LIGHT_DISTANCE);
		light.position.copy(mesh.position);
		light.userData.isActivatorLight = true;
		light.userData.targetMesh = mesh;
		light.castShadow = true;
		light.shadow.mapSize.width = 512;
		light.shadow.mapSize.height = 512;
		return light;
	}

	static processActivateMeshes(model) {
		const activateMeshes = [];
		
		model.traverse((child) => {
			if (child.isMesh && child.name.startsWith('activate_')) {
				child.visible = false;
				const activatorMaterial = this.createActivatorMaterial();
				child.material = activatorMaterial;
				
				const light = this.createLightMaterial(child);
				light.visible = false;
				child.userData.activatorLight = light;
				child.parent.add(light);
				
				activateMeshes.push(child);
			}
		});

		return activateMeshes;
	}

	static reapplyActivatorMaterials(activateMeshes) {
		activateMeshes.forEach(mesh => {
			const activatorMaterial = this.createActivatorMaterial();
			mesh.material = activatorMaterial;
			
			if (mesh.userData.activatorLight) {
				mesh.userData.activatorLight.color.setHex(ACTIVATE_MESH_CONFIG.DEFAULT_COLOR);
				mesh.userData.activatorLight.intensity = ACTIVATE_MESH_CONFIG.DEFAULT_LIGHT_INTENSITY;
			}
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
					if (targetMesh.userData.activatorLight) {
						targetMesh.userData.activatorLight.visible = true;
					}
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.visible = true;
					if (mesh.userData.activatorLight) {
						mesh.userData.activatorLight.visible = true;
					}
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
					if (targetMesh.userData.activatorLight) {
						targetMesh.userData.activatorLight.visible = false;
					}
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.visible = false;
					if (mesh.userData.activatorLight) {
						mesh.userData.activatorLight.visible = false;
					}
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
					if (targetMesh.userData.activatorLight) {
						targetMesh.userData.activatorLight.visible = targetMesh.visible;
					}
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.visible = !mesh.visible;
					if (mesh.userData.activatorLight) {
						mesh.userData.activatorLight.visible = mesh.visible;
					}
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

		model.userData.setActivateMeshColor = (color, meshName = null) => {
			const colorHex = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
			
			if (meshName) {
				const targetMesh = activateMeshes.find(mesh => 
					mesh.name === meshName || 
					mesh.name === `activate_${meshName}` ||
					mesh.name.endsWith(`_${meshName}`)
				);
				if (targetMesh) {
					targetMesh.material.color.setHex(colorHex);
					targetMesh.material.emissive.setHex(colorHex);
					if (targetMesh.userData.activatorLight) {
						targetMesh.userData.activatorLight.color.setHex(colorHex);
					}
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.material.color.setHex(colorHex);
					mesh.material.emissive.setHex(colorHex);
					if (mesh.userData.activatorLight) {
						mesh.userData.activatorLight.color.setHex(colorHex);
					}
				});
			}
		};

		model.userData.setActivateMeshIntensity = (intensity, meshName = null) => {
			if (meshName) {
				const targetMesh = activateMeshes.find(mesh => 
					mesh.name === meshName || 
					mesh.name === `activate_${meshName}` ||
					mesh.name.endsWith(`_${meshName}`)
				);
				if (targetMesh) {
					targetMesh.material.emissiveIntensity = intensity;
					if (targetMesh.userData.activatorLight) {
						targetMesh.userData.activatorLight.intensity = intensity * ACTIVATE_MESH_CONFIG.INTENSITY_MULTIPLIER;
					}
				}
			} else {
				activateMeshes.forEach(mesh => {
					mesh.material.emissiveIntensity = intensity;
					if (mesh.userData.activatorLight) {
						mesh.userData.activatorLight.intensity = intensity * ACTIVATE_MESH_CONFIG.INTENSITY_MULTIPLIER;
					}
				});
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
		result.setActivateMeshColor = result.mesh.userData.setActivateMeshColor;
		result.setActivateMeshIntensity = result.mesh.userData.setActivateMeshIntensity;
	}
}