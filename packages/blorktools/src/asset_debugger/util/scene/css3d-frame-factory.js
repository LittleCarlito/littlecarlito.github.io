import * as THREE from 'three';
import { CSS3DObject } from "three/examples/jsm/Addons";

export function createCSS3DFrame(config) {
    const {
        width,
        height,
        htmlContent,
        borderColor = '#00ff88',
        borderWidth = '2px',
        borderRadius = '8px',
        boxShadow = null,
        pointerEvents = 'auto'
    } = config;

    const iframe = document.createElement('iframe');
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    iframe.style.border = `${borderWidth} solid ${borderColor}`;
    iframe.style.borderRadius = borderRadius;
    iframe.style.overflow = 'hidden';
    iframe.style.pointerEvents = pointerEvents;
    
    if (boxShadow) {
        iframe.style.boxShadow = boxShadow;
    } else {
        iframe.style.boxShadow = `0 0 20px rgba(0, 255, 136, 0.3)`;
    }

    const css3dObject = new CSS3DObject(iframe);

    setTimeout(() => {
        if (iframe.contentDocument && htmlContent) {
            iframe.contentDocument.open();
            iframe.contentDocument.write(htmlContent);
            iframe.contentDocument.close();
        }
    }, 100);

    return css3dObject;
}

export function calculateMeshTransform(mesh, offsetDistance) {
    if (!mesh || !mesh.geometry) {
        return {
            position: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Euler(0, 0, 0),
            quaternion: new THREE.Quaternion()
        };
    }

    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    mesh.localToWorld(center);

    const meshMatrix = mesh.matrixWorld.clone();
    
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    
    meshMatrix.decompose(position, quaternion, scale);
    
    let normal = new THREE.Vector3(0, 0, 1);
    if (geometry.attributes.normal) {
        const normalAttribute = geometry.attributes.normal;
        if (normalAttribute.count > 0) {
            normal.fromBufferAttribute(normalAttribute, 0);
            normal.transformDirection(meshMatrix);
            normal.normalize();
        }
    }

    const offsetPosition = center.clone();
    offsetPosition.add(normal.clone().multiplyScalar(offsetDistance));

    return {
        position: offsetPosition,
        rotation: new THREE.Euler().setFromQuaternion(quaternion),
        quaternion: quaternion
    };
}