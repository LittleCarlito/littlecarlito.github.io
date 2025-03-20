// Test importing THREE and RAPIER from the blorkpack package
import { THREE, RAPIER } from '../dist/index.js';

console.log('THREE version:', THREE.REVISION);
console.log('RAPIER loaded:', RAPIER !== undefined);

// Create a simple THREE object to verify it works
const scene = new THREE.Scene();
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

console.log('Created a THREE.Scene with a cube:', scene.children.length === 1);

// Create a RAPIER world to verify it works
RAPIER.init().then(() => {
	const gravity = { x: 0.0, y: -9.81, z: 0.0 };
	const world = new RAPIER.World(gravity);
  
	console.log('Created a RAPIER.World with gravity:', world.gravity.y === -9.81);
}); 