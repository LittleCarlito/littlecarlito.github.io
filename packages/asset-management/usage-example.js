// Example of how to use the asset-management package in the main application

// 1. Importing from the package instead of direct files
import { 
  AssetStorage, 
  AssetSpawner, 
  AssetActivator, 
  ASSET_TYPE, 
  ASSET_CONFIGS
} from 'asset-management';  // In development, you'd use a local path like '../packages/asset-management'

// 2. Initialize Three.js scene and Rapier physics world
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Initialize Rapier physics
async function init() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
  
  // 3. Use the asset management classes
  
  // Initialize asset storage
  const assetStorage = AssetStorage.get_instance();
  
  // Load an asset
  await assetStorage.load_asset_type(ASSET_TYPE.ROOM);
  
  // Initialize asset spawner
  const spawner = AssetSpawner.get_instance(scene, world);
  
  // Spawn an asset
  const { mesh, body, instance_id } = await spawner.spawn_asset(
    ASSET_TYPE.ROOM,
    new THREE.Vector3(0, 0, 0),
    new THREE.Quaternion()
  );
  
  // Initialize asset activator
  const activator = AssetActivator.get_instance(camera, renderer);
  
  // Handle interaction with objects
  window.addEventListener('click', (event) => {
    // Process click and potentially activate an object
    activator.activate_object('some_object_name');
  });
  
  // Update physics in the animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    // Step the physics world
    world.step();
    
    // Update mesh positions based on physics
    assetStorage.update();
    
    // Render the scene
    renderer.render(scene, camera);
  }
  
  animate();
}

init(); 