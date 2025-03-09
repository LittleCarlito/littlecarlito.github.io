// Example of using the asset-management package
import { 
    AssetStorage, 
    AssetSpawner, 
    AssetActivator, 
    ASSET_TYPE, 
    ASSET_CONFIGS,
    THREE,
    RAPIER,
    AssetUtils
} from 'asset-management';

console.log('Asset Management Package Test');
console.log('Available ASSET_TYPEs:', Object.keys(ASSET_TYPE));

// Initialize basic scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Position camera
camera.position.z = 5;

// Initialize Rapier physics
let world;

async function init() {
    console.log('Initializing...');
    
    // Initialize Rapier
    await RAPIER.init();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    
    // Get asset storage instance
    const assetStorage = AssetStorage.get_instance();
    console.log('Asset Storage created:', assetStorage);
    
    // Initialize asset spawner
    const spawner = AssetSpawner.get_instance(scene, world);
    console.log('Asset Spawner created:', spawner);
    
    // Initialize asset activator
    const activator = AssetActivator.get_instance(camera, renderer);
    console.log('Asset Activator created:', activator);
    
    // Attempt to load and spawn an asset
    try {
        // Example loading (would normally use real assets)
        console.log('Spawning asset...');
        const position = new THREE.Vector3(0, 0, 0);
        const rotation = new THREE.Quaternion();
        
        // For the demo, we'll create a simple cube instead of loading a model
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        // Register with asset storage
        const instance_id = assetStorage.add_object(cube, null);
        console.log('Created cube with instance_id:', instance_id);
        
        // Simple animation loop
        function animate() {
            requestAnimationFrame(animate);
            
            // Update physics world
            world.step();
            
            // Update physics objects
            assetStorage.update();
            
            // Rotate cube
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            
            // Render
            renderer.render(scene, camera);
        }
        
        animate();
        
        console.log('Asset Management package test complete!');
    } catch (error) {
        console.error('Error in test:', error);
    }
}

init(); 