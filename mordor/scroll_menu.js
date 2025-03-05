import { TYPES } from '../../viewport/overlay/overlay_common';
import { FLAGS, ASSET_TYPE, RAPIER, THREE } from '../../common';
import { BackgroundLighting } from '../background_lighting';
import { AssetStorage } from '../../common/asset_management/asset_storage';
import { MenuAnimator } from './menu_animator.js';
import { 
    ScrollMenuConstants, 
    ANIMATION, 
    DISTANCE, 
    COLORS, 
    STATE, 
    LAYERS,
    DEFAULTS 
} from './scroll_menu_constants.js';
import { ChainManager } from './chain_manager.js';
import { SpotlightManager } from './spotlight_manager.js';
import { ScrollMenuUI } from './scroll_menu_ui.js';
import { ScrollMenuDebug } from './scroll_menu_debug.js';

/**
 * ScrollMenu class - Manages a 3D scroll menu with chain physics and UI
 */
export class ScrollMenu {
    parent;
    camera;
    world;
    dynamic_bodies;
    
    // Container for the entire assembly
    assembly_container;
    
    // Menu components
    chainManager;
    spotlightManager;
    menuUI;
    debugVisualizer;
    
    // Mouse interaction
    raycaster;
    mouse;
    
    // Animation state
    animation_start_time = 0;
    is_animating = false;
    assembly_position = null;
    target_position = null;
    
    // Chain configuration
    CHAIN_CONFIG = {
        POSITION: {
            X: 0,
            Y: 10,
            Z: 0
        },
        SEGMENTS: {
            COUNT: 6,             // Back to 6 segments as requested
            LENGTH: 0.5,          // Keep original size
            RADIUS: 0.1,
            DAMPING: 1,
            MASS: 1,
            RESTITUTION: 0.01,
            FRICTION: 1.0,
            LINEAR_DAMPING: 0.8,
            ANGULAR_DAMPING: 1.0,
            GRAVITY_SCALE: 0.3,
            SPAWN_DELAY: 100      // Delay between segment spawns in ms
        },
        SIGN: {
            LOCAL_OFFSET: {
                X: 0,    
                Y: 3,    // Increased from 2 to position the sign further from the chain
                Z: 0
            },
            DIMENSIONS: {
                WIDTH: 2.5,   // Increased from 2 to make sign more visible
                HEIGHT: 2.5,  // Increased from 2 to make sign more visible
                DEPTH: 0.01
            },
            DAMPING: 0.8,
            MASS: 2,
            RESTITUTION: 0.01,
            FRICTION: 1.0,
            ANGULAR_DAMPING: 1.0,
            GRAVITY_SCALE: 2.0,
            IMAGE_PATH: 'images/ScrollControlMenu.svg',
            SPAWN_DELAY: 300      // Delay before spawning sign after last segment
        },
        ANIMATION: {
            DURATION: 2.0,        // Animation duration in seconds
            EASING: 0.05,         // Easing factor
            OFFSET_RIGHT: 30      // How far off-screen to the right to start
        }
    };
    
    // Debug visualizations
    debug_meshes = {
        segments: [],
        joints: [],
        sign: null,
        anchor: null,
        container: null
    };

    /**
     * Creates a new ScrollMenu
     */
    constructor(incoming_parent, incoming_camera, incoming_world, incoming_container, spawn_position) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.world = incoming_world;
        this.dynamic_bodies = incoming_container.dynamic_bodies;
        this.lighting = BackgroundLighting.getInstance(this.parent);

        // Create a container for the entire assembly
        this.assembly_container = new THREE.Object3D();
        this.assembly_container.name = "scroll_menu_assembly_container";
        this.parent.add(this.assembly_container);

        // Use spawn position
        this.CHAIN_CONFIG.POSITION.X = spawn_position.x;
        this.CHAIN_CONFIG.POSITION.Y = spawn_position.y;
        this.CHAIN_CONFIG.POSITION.Z = spawn_position.z;
        
        // Target position is the original spawn position
        this.target_position = {
            x: spawn_position.x,
            y: spawn_position.y,
            z: spawn_position.z
        };
        
        this.assembly_position = {
            x: spawn_position.x + 15,
            y: spawn_position.y,
            z: spawn_position.z
        };

        // Initialize components
        this.initializeComponents();
        
        return this.initialize();
    }
    
    /**
     * Getter for sign_mesh (for backward compatibility)
     */
    get sign_mesh() {
        return this.chainManager?.sign_mesh;
    }
    
    /**
     * Getter for sign_body (for backward compatibility)
     */
    get sign_body() {
        return this.chainManager?.sign_body;
    }
    
    /**
     * Initializes all menu components
     */
    initializeComponents() {
        // Initialize raycaster for mouse interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Initialize the chain manager
        this.chainManager = new ChainManager(this);
        
        // Initialize the spotlight manager
        this.spotlightManager = new SpotlightManager(this, this.lighting);
        
        // Initialize the debug visualizer
        this.debugVisualizer = new ScrollMenuDebug(this);
        
        // Initialize the menu UI
        this.menuUI = new ScrollMenuUI();
        
        // Set up default menu items
        this.setupMenuItems();
    }
    
    /**
     * Sets up menu items
     */
    setupMenuItems() {
        // Example menu items - replace with your actual menu items
        const menuItems = [
            { text: 'Option 1', data: { id: 1, action: 'select_option_1' } },
            { text: 'Option 2', data: { id: 2, action: 'select_option_2' } },
            { text: 'Option 3', data: { id: 3, action: 'select_option_3' } },
            { text: 'Option 4', data: { id: 4, action: 'select_option_4' } },
            { text: 'Option 5', data: { id: 5, action: 'select_option_5' } }
        ];
        
        this.menuUI.setItems(menuItems);
    }

    /**
     * Initializes the scroll menu
     */
    async initialize() {
        // Calculate rotation based on camera position
        const theta_rad = Math.atan2(
            this.camera.position.x,
            this.camera.position.z
        );
        const halfAngle = theta_rad / 2;
        const rotation = {
            x: 0,
            y: Math.sin(halfAngle),
            z: 0,
            w: Math.cos(halfAngle)
        };

        // Create anchor point for the chain
        this.chainManager.anchor_body = await this.chainManager.createAnchorPoint();
        
        // Create chain segments
        let previous_body = this.chainManager.anchor_body;
        for(let i = 0; i < this.CHAIN_CONFIG.SEGMENTS.COUNT; i++) {
            if(FLAGS.PHYSICS_LOGS) {
                console.log(`Creating chain segment ${i}`);
            }
            previous_body = await this.chainManager.createChainSegment(i, previous_body, rotation);
            // Wait for physics to settle
            await new Promise(resolve => setTimeout(resolve, this.CHAIN_CONFIG.SEGMENTS.SPAWN_DELAY));
        }

        // Wait additional time before spawning sign
        await new Promise(resolve => setTimeout(resolve, this.CHAIN_CONFIG.SIGN.SPAWN_DELAY));
        
        // Create sign
        await this.chainManager.createSign(previous_body);
        
        // Position the menu UI
        this.positionMenuUI();
        
        // Create spotlight
        this.animation_start_time = performance.now();
        this.is_animating = true;
        
        return this;
    }
    
    /**
     * Positions the menu UI on the sign
     */
    positionMenuUI() {
        if (!this.chainManager.sign_mesh) return;
        
        // Hide the menu UI initially
        this.menuUI.container.visible = false;
        
        // Position the menu UI in front of the sign
        this.menuUI.container.position.set(0, 0, 0.1);
        
        // Add the UI container to the sign mesh
        this.chainManager.sign_mesh.add(this.menuUI.container);
    }
    
    /**
     * Shows the menu UI
     */
    showMenuUI() {
        this.menuUI.show(this.camera);
    }
    
    /**
     * Hides the menu UI
     */
    hideMenuUI() {
        this.menuUI.hide();
    }
    
    /**
     * Updates the scroll menu on each frame
     */
    async update() {
        // Update the chain manager
        this.chainManager.update();
        
        // If animation is complete, create spotlight
        if (!this.is_animating && !this.spotlightManager.menu_spotlight && 
            this.chainManager.sign_mesh && !this.chainManager.chains_broken) {
            this.spotlightManager.createSpotlight();
        }
        
        // Update spotlight if it exists
        if (this.spotlightManager.menu_spotlight) {
            this.spotlightManager.updateSpotlight(this.spotlightManager.menu_spotlight);
        }
        
        // Update debug visualizations
        if (FLAGS.SIGN_VISUAL_DEBUG) {
            this.debugVisualizer.updateDebugVisualizations();
        }
        
        // During animation phase, make the menu face the camera, but stop when animation ends
        if (this.assembly_container) {
            if (this.is_animating) {
                // During animation, keep facing the camera
                this.assembly_container.lookAt(this.camera.position);
            } else if (!this.assembly_container.orientationFixed) {
                // When animation completes, fix the orientation
                this.assembly_container.lookAt(this.camera.position);
                this.assembly_container.orientationFixed = true;
            }
        }
        
        // Update menu UI
        if (this.menuUI.isVisible) {
            this.menuUI.update(this.camera);
        }
    }
    
    /**
     * Handles mouse hover on the menu
     */
    handleHover(mouseX, mouseY) {
        if (!this.menuUI.isVisible) return -1;
        
        // Update mouse position
        this.mouse.x = mouseX;
        this.mouse.y = mouseY;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Handle hover on menu items
        return this.menuUI.handleHover(this.raycaster);
    }
    
    /**
     * Handles mouse click on the menu
     */
    handleClick(mouseX, mouseY) {
        if (!this.menuUI.isVisible) return null;
        
        // Update mouse position
        this.mouse.x = mouseX;
        this.mouse.y = mouseY;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Handle click on menu items
        return this.menuUI.handleClick(this.raycaster);
    }
    
    /**
     * Handles scroll wheel
     */
    handleScroll(amount) {
        if (!this.menuUI.isVisible) return;
        
        // Normalize amount and scroll the menu
        const normalizedAmount = amount * DISTANCE.SCROLL_SENSITIVITY;
        this.menuUI.scroll(normalizedAmount);
    }
    
    /**
     * Handles when the sign is grabbed
     */
    handleSignGrabbed() {
        this.chainManager.handleSignGrabbed();
    }
    
    /**
     * Handles when the sign is released
     */
    handleSignReleased() {
        this.chainManager.handleSignReleased();
    }
    
    /**
     * Breaks the chains
     */
    async break_chains() {
        // Remove spotlight first
        if (this.spotlightManager.menu_spotlight) {
            await this.spotlightManager.removeSpotlight(this.spotlightManager.menu_spotlight);
        }
        
        // Break chains through chain manager
        await this.chainManager.break_chains();
    }
    
    /**
     * Cleans up resources
     */
    async cleanup() {
        // Clean up components
        if (this.menuUI) {
            this.menuUI.dispose();
        }
        
        if (this.debugVisualizer) {
            this.debugVisualizer.cleanup();
        }
        
        // Break chains which handles most of the cleanup
        await this.break_chains();
        
        // Remove the assembly container
        if (this.assembly_container && this.assembly_container.parent) {
            this.assembly_container.parent.remove(this.assembly_container);
        }
    }
}