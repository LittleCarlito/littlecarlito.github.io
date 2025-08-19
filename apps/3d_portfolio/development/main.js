// Set the path to your HDR or EXR file here
const sample_resource = 'images/brown_photostudio_02_4k.exr'; // Change this to your file path

// Set to true to display a cube instead of the default spheres and torus
const showCube = true; // Change this to true to show cube instead

// Global variables
let scene, camera, renderer, pmremGenerator;
let controls;
let envMap;
let objects = []; // Renamed from spheres to objects since it might not always be spheres
let loadingManager;

// Initialize the scene
function init() {
    // Create loading manager to track progress
    loadingManager = new THREE.LoadingManager(
        // On load
        () => {
            document.getElementById('loadingText').style.display = 'none';
        },
        // On progress
        (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal * 100).toFixed(0);
            document.getElementById('loadingText').textContent = `Loading: ${progress}%`;
        }
    );

    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 0, 10);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.minDistance = 5;
    controls.maxDistance = 30;
    
    // Create FPS counter manually instead of using Stats.js
    const fpsDiv = document.createElement('div');
    fpsDiv.style.position = 'absolute';
    fpsDiv.style.top = '0px';
    fpsDiv.style.right = '0px';
    fpsDiv.style.background = 'rgba(0,0,0,0.5)';
    fpsDiv.style.color = 'white';
    fpsDiv.style.padding = '5px';
    fpsDiv.style.borderRadius = '3px';
    fpsDiv.textContent = 'FPS: --';
    document.body.appendChild(fpsDiv);
    
    // Variables for FPS calculation
    let frameCount = 0;
    let lastTime = performance.now();
    
    // Update FPS display
    setInterval(() => {
        const currentTime = performance.now();
        const elapsedTime = (currentTime - lastTime) / 1000; // Convert to seconds
        const fps = Math.round(frameCount / elapsedTime);
        
        fpsDiv.textContent = `FPS: ${fps}`;
        
        frameCount = 0;
        lastTime = currentTime;
    }, 1000);
    
    // Track frame count in animation loop
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = function(callback) {
        return originalRequestAnimationFrame(function(time) {
            frameCount++;
            callback(time);
        });
    };
    
    // Create PMREM Generator for environment mapping
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Add sample geometry to the scene based on showCube flag
    if (showCube) {
        createCube();
    } else {
        createDefaultObjects();
    }
    
    // Load the specified HDR/EXR file
    loadEnvironmentMap(sample_resource);

    // Add info about current display mode
    const modeInfo = document.createElement('div');
    modeInfo.style.position = 'absolute';
    modeInfo.style.bottom = '10px';
    modeInfo.style.left = '10px';
    modeInfo.style.background = 'rgba(0,0,0,0.5)';
    modeInfo.style.color = 'white';
    modeInfo.style.padding = '5px';
    modeInfo.style.borderRadius = '3px';
    modeInfo.textContent = showCube ? 'Mode: Cube Only' : 'Mode: Default Objects';
    document.body.appendChild(modeInfo);
}

// Create a cube with different materials on each face
function createCube() {
    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create a cube with different materials on each face
    const cubeGeometry = new THREE.BoxGeometry(4, 4, 4);
    
    // Create different materials for each face
    const materials = [
        new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2, metalness: 0.8 }), // Right face (+X)
        new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.2, metalness: 0.8 }), // Left face (-X)
        new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.2, metalness: 0.8 }), // Top face (+Y)
        new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.2, metalness: 0.8 }), // Bottom face (-Y)
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 }), // Front face (+Z)
        new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.2, metalness: 0.8 })  // Back face (-Z)
    ];
    
    // Create cube with materials
    const cube = new THREE.Mesh(cubeGeometry, materials);
    cube.position.set(0, 0, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    
    objects.push(cube);

    // Add material property controls
    const roughnessSlider = createSlider('Roughness', 0, 1, 0.2, (value) => {
        materials.forEach(material => material.roughness = value);
    });
    roughnessSlider.style.top = '70px';
    
    const metalnessSlider = createSlider('Metalness', 0, 1, 0.8, (value) => {
        materials.forEach(material => material.metalness = value);
    });
    metalnessSlider.style.top = '120px';
}

// Create a slider control
function createSlider(name, min, max, defaultValue, onChange) {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '10px';
    container.style.width = '200px';
    container.style.padding = '10px';
    container.style.background = 'rgba(0,0,0,0.5)';
    container.style.color = 'white';
    container.style.borderRadius = '5px';
    
    const label = document.createElement('div');
    label.textContent = `${name}: ${defaultValue}`;
    container.appendChild(label);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = 0.01;
    slider.value = defaultValue;
    slider.style.width = '100%';
    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value);
        label.textContent = `${name}: ${value.toFixed(2)}`;
        onChange(value);
    });
    container.appendChild(slider);
    
    document.body.appendChild(container);
    return container;
}

// Create default test objects (spheres and torus)
function createDefaultObjects() {
    // Add a ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create materials with varying properties
    const materials = [
        new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            roughness: 0,
            metalness: 1
        }),
        new THREE.MeshStandardMaterial({ 
            color: 0xff0000, 
            roughness: 0.2,
            metalness: 0.8 
        }),
        new THREE.MeshStandardMaterial({ 
            color: 0x00ff00, 
            roughness: 0.5,
            metalness: 0.5 
        }),
        new THREE.MeshStandardMaterial({ 
            color: 0x0000ff, 
            roughness: 0.8,
            metalness: 0.2 
        }),
        new THREE.MeshStandardMaterial({ 
            color: 0xffff00, 
            roughness: 1.0,
            metalness: 0.0 
        })
    ];
    
    // Add spheres with different materials
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    
    for (let i = 0; i < materials.length; i++) {
        const sphere = new THREE.Mesh(sphereGeometry, materials[i]);
        sphere.position.x = (i - 2) * 2.5;
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        scene.add(sphere);
        objects.push(sphere);
    }
    
    // Add a torus knot to showcase lighting
    const torusGeometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const torusMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.7
    });
    const torusKnot = new THREE.Mesh(torusGeometry, torusMaterial);
    torusKnot.position.set(0, 2, 0);
    torusKnot.castShadow = true;
    scene.add(torusKnot);
    objects.push(torusKnot);
}

// Load HDR or EXR environment map
function loadEnvironmentMap(path) {
    // Update the file name display
    const fileName = path.split('/').pop();
    document.getElementById('fileName').textContent = `Loading: ${fileName}`;
    
    // Choose loader based on file extension
    const extension = path.split('.').pop().toLowerCase();
    let loader;
    
    if (extension === 'hdr') {
        loader = new THREE.RGBELoader(loadingManager);
    } else if (extension === 'exr') {
        loader = new THREE.EXRLoader(loadingManager);
    } else {
        alert('Unsupported file format. Please use .hdr or .exr files.');
        document.getElementById('loadingText').textContent = 'Error: Unsupported file format';
        return;
    }
    
    // Set texture parameters for the loader
    loader.setDataType(THREE.FloatType);
    
    // Load the file
    loader.load(path, function(texture) {
        // Update display
        document.getElementById('fileName').textContent = `Loaded: ${fileName}`;
        
        // Generate environment map
        envMap = pmremGenerator.fromEquirectangular(texture).texture;
        
        // Set scene background and environment
        scene.background = envMap;
        scene.environment = envMap;
        
        // Apply envMap to all materials
        scene.traverse((object) => {
            if (object.isMesh) {
                object.material.envMap = envMap;
                object.material.needsUpdate = true;
            }
        });
        
        // Clean up
        texture.dispose();
        pmremGenerator.dispose();
    }, 
    undefined, // onProgress callback
    function(error) {
        console.error('Error loading environment map:', error);
        document.getElementById('loadingText').textContent = 'Error loading file';
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate objects slightly
    const time = Date.now() * 0.001;
    objects.forEach((object, i) => {
        object.rotation.y = time * (0.1 + i * 0.05);
        object.rotation.x = time * (0.05 + i * 0.03);
    });
    
    controls.update();
    renderer.render(scene, camera);
}

// Initialize and start animation
init();
animate();