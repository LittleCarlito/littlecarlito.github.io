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
    if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
    }
    
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    mesh.localToWorld(center);

    const meshMatrix = mesh.matrixWorld.clone();
    
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    
    meshMatrix.decompose(position, quaternion, scale);
    
    // Calculate dimensions to find which axis is thin (the normal)
    const box = geometry.boundingBox;
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    const depth = box.max.z - box.min.z;
    
    const dimensions = [
        { size: width, axis: 'x' },
        { size: height, axis: 'y' },
        { size: depth, axis: 'z' }
    ];
    
    dimensions.sort((a, b) => a.size - b.size);
    
    const tolerance = 0.01;
    if (dimensions[0].size > tolerance) {
        throw new Error(`Display mesh is not rectangular - smallest dimension (${dimensions[0].axis}: ${dimensions[0].size.toFixed(4)}) is too large`);
    }
    
    // Determine which plane the mesh lies in based on the thin axis
    const thinAxis = dimensions[0].axis;
    
    // CSS3DObject defaults to facing forward (Z+), but we need to rotate it to match the mesh orientation
    let correctionRotation = new THREE.Quaternion();
    
    if (thinAxis === 'z') {
        // Mesh is thin along Z, so it lies in XY plane - no correction needed
        correctionRotation.identity();
    } else if (thinAxis === 'y') {
        // Mesh is thin along Y, so it lies in XZ plane - rotate 90° around X to lay flat
        correctionRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    } else if (thinAxis === 'x') {
        // Mesh is thin along X, so it lies in YZ plane - rotate 90° around Y to face forward
        correctionRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    }
    
    // Combine the mesh's rotation with the correction rotation
    const finalQuaternion = quaternion.clone().multiply(correctionRotation);

    return {
        position: center,
        rotation: new THREE.Euler().setFromQuaternion(finalQuaternion),
        quaternion: finalQuaternion
    };
}