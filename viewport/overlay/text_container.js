import { clamp } from 'three/src/math/MathUtils.js';
import { TextFrame, IFRAME } from './text_frame';
import { get_screen_size, get_associated_position, NORTH, SOUTH, EAST, WEST, CATEGORIES, extract_type, PAN_SPEED, TYPES, VALID_DIRECTIONS } from './overlay_common';
import { Easing, FLAGS, ASSET_TYPE, THREE, Tween, AssetSpawner } from '../../common';
import { ASSET_CONFIGS } from '../../common/asset_management/asset_type';
import { AssetStorage } from '../../common/asset_management/asset_storage';

export class TextContainer {
    container_width;
    container_height;
    text_frames = new Map();
    focused_text_name = "";
    particles = [];
    asset_spawner;

    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        this.text_box_container = new THREE.Object3D();
        this.asset_spawner = AssetSpawner.get_instance();
        // Create text displays
        this.parent.add(this.text_box_container);
        // Creat background private method
        const create_background = (incoming_category, incoming_box) => {
            this.container_width = this.get_text_box_width();
            this.container_height = this.get_text_box_height();
            const box_geometry = new THREE.BoxGeometry(this.container_width, this.container_height, .01);
            const box_material = new THREE.MeshBasicMaterial({
                color: incoming_category.color,
                depthTest: false,
                transparent: true
            });
            const text_box_background = new THREE.Mesh(box_geometry, box_material);
            text_box_background.name = `${TYPES.BACKGROUND}${incoming_category.value}`;
            text_box_background.renderOrder = -1;
            incoming_box.add(text_box_background);
        };
        // Create frame private method
        const create_text_frame = (incoming_category, incoming_box) => {
            const new_frame = new TextFrame(incoming_box, this.camera, this.container_width, this.container_height);
            new_frame.simple_name = incoming_category.value;
            new_frame.name = `${TYPES.TEXT_BLOCK}${incoming_category.value}`;
            this.text_frames.set(new_frame.name, new_frame);
        };
        
        // Create asset background private method
        const create_asset_background = async (incoming_box, asset_type, options = {}) => {
            // Calculate dimensions to match where the background would be
            this.container_width = this.get_text_box_width();
            this.container_height = this.get_text_box_height();
            
            // Default configuration that can be overridden with options
            const config = {
                horizontalStretch: 1.0,
                verticalStretch: 1.0,
                position: new THREE.Vector3(0, 0, -0.05),
                positionOffsetX: 0,
                positionOffsetY: 0,
                positionOffsetZ: 0,
                scaleFactor: 0.12,
                ...options
            };
            
            // Apply position offsets if provided
            config.position.x += config.positionOffsetX;
            config.position.y += config.positionOffsetY;
            config.position.z += config.positionOffsetZ;
            
            // Load the asset
            const asset_config = ASSET_CONFIGS[asset_type];
            const gltf = await AssetStorage.get_instance().loader.loadAsync(asset_config.PATH);
            
            // Create instance
            const asset = gltf.scene.clone();
            
            // Calculate scale to match the background dimensions
            const asset_bounding_box = new THREE.Box3().setFromObject(asset);
            const asset_width = (asset_bounding_box.max.x - asset_bounding_box.min.x);
            const asset_height = asset_bounding_box.max.y - asset_bounding_box.min.y;
            
            // Scale to match the container width
            const width_scale = this.container_width / asset_width * config.scaleFactor;
            const height_scale = this.container_height / asset_height * config.scaleFactor;
            
            // Apply stretch factors to the scales
            const final_width_scale = width_scale * config.horizontalStretch;
            const final_height_scale = height_scale * config.verticalStretch;
            
            // Use the smaller scale to ensure it fits within the container
            const base_scale = Math.min(final_width_scale, final_height_scale) * asset_config.scale;
            
            // Apply scaling
            if (config.horizontalStretch !== config.verticalStretch) {
                const x_scale = base_scale * (config.horizontalStretch / config.verticalStretch);
                const y_scale = base_scale;
                asset.scale.set(x_scale, y_scale, base_scale);
            } else {
                asset.scale.set(base_scale, base_scale, base_scale);
            }
            
            // Position and rotate
            asset.position.copy(config.position);
            // Only apply rotation if it was provided in options
            if (config.rotation) {
                asset.rotation.copy(config.rotation);
            }
            
            // Handle materials
            asset.traverse((child) => {
                if (child.isMesh) {
                    // Hide collision mesh
                    if (child.name.startsWith('col_')) {
                        child.visible = false;
                        return;
                    }
                    
                    // Get the original material's properties
                    const original_material = child.material;
                    if (FLAGS.ASSET_LOGS) console.log('Original material:', {
                        name: child.name,
                        map: original_material.map?.image?.src,
                        color: original_material.color?.getHexString()
                    });
                    
                    // Try using the original material but with basic properties
                    child.material = new THREE.MeshBasicMaterial();
                    child.material.copy(original_material);
                    child.material.needsUpdate = true;
                    
                    // Force some UI-specific properties
                    child.material.transparent = true;
                    child.material.depthTest = false;
                    child.material.side = THREE.DoubleSide;
                    child.renderOrder = 998; // Set to 998 so iframe (999) appears in front
                    
                    if (FLAGS.ASSET_LOGS) console.log('New material:', {
                        name: child.name,
                        map: child.material.map?.image?.src,
                        color: child.material.color?.getHexString()
                    });
                }
            });
            
            // Add asset to the box
            incoming_box.add(asset);
            
            return asset;
        };
        
        Object.values(CATEGORIES).forEach((category, i) => {
            if (typeof category === 'function') return; // Skip helper methods
            const text_box = new THREE.Object3D();
            text_box.position.x = get_associated_position(WEST, this.camera) * 2;
            text_box.position.y = this.get_text_box_y();
            text_box.simple_name = category.value;
            text_box.name = `${TYPES.TEXT}${category.value}`;
            if (FLAGS.LAYER) {
                text_box.layers.set(1);
            }
            this.text_box_container.add(text_box);
            switch (category.value) {
                case CATEGORIES.EDUCATION.value:
                    const rotation = new THREE.Euler(-Math.PI / 2, Math.PI, Math.PI, 'XYZ');
                    const position_one_offset = new THREE.Vector3(0, 3, 0);
                    const position_two_offset = new THREE.Vector3(0, -3, 0);
                    // Create diplomas with specific UI handling
                    (async () => {
                        // Load assets first
                        const top_asset_config = ASSET_CONFIGS[ASSET_TYPE.DIPLOMA_TOP];
                        const top_gltf = await AssetStorage.get_instance().loader.loadAsync(top_asset_config.PATH);
                        // Create top diploma
                        [position_one_offset].forEach(position => {
                            const top_diploma = top_gltf.scene.clone();
                            top_diploma.scale.set(top_asset_config.ui_scale, top_asset_config.ui_scale, top_asset_config.ui_scale);
                            top_diploma.position.copy(position);
                            top_diploma.rotation.copy(rotation);
                            // Add debug logging
                            console.log('Top Diploma UI Scale:', top_asset_config.ui_scale);
                            console.log('Top Diploma Applied Scale:', top_diploma.scale);
                            // Handle materials
                            top_diploma.traverse((child) => {
                                if (child.isMesh) {
                                    // Hide collision mesh
                                    if (child.name.startsWith('col_')) {
                                        child.visible = false;
                                        return;
                                    }
                                    // Get the original material's properties
                                    const originalMaterial = child.material;
                                    if (FLAGS.ASSET_LOGS) console.log('Original material:', {
                                        name: child.name,
                                        map: originalMaterial.map?.image?.src,
                                        color: originalMaterial.color.getHexString()
                                    });
                                    // Try using the original material but with basic properties
                                    child.material = new THREE.MeshBasicMaterial();
                                    child.material.copy(originalMaterial);
                                    child.material.needsUpdate = true;
                                    // Force some UI-specific properties
                                    child.material.transparent = true;
                                    child.material.depthTest = false;
                                    child.material.side = THREE.DoubleSide;
                                    child.renderOrder = 999;
                                    if (FLAGS.ASSET_LOGS) console.log('New material:', {
                                        name: child.name,
                                        map: child.material.map?.image?.src,
                                        color: child.material.color.getHexString()
                                    });
                                }
                            });
                            text_box.add(top_diploma);
                        });
                        // Load assets first
                        const bot_asset_config = ASSET_CONFIGS[ASSET_TYPE.DIPLOMA_BOT];
                        const bot_gltf = await AssetStorage.get_instance().loader.loadAsync(bot_asset_config.PATH);
                        // Create bottom diploma
                        [position_two_offset].forEach(position => {
                            const bot_diploma = bot_gltf.scene.clone();
                            bot_diploma.scale.set(bot_asset_config.ui_scale, bot_asset_config.ui_scale, bot_asset_config.ui_scale);
                            bot_diploma.position.copy(position);
                            bot_diploma.rotation.copy(rotation);
                            // Add debug logging
                            console.log('Bottom Diploma UI Scale:', bot_asset_config.ui_scale);
                            console.log('Bottom Diploma Applied Scale:', bot_diploma.scale);
                            // Handle materials
                            bot_diploma.traverse((child) => {
                                if (child.isMesh) {
                                    // Hide collision mesh
                                    if (child.name.startsWith('col_')) {
                                        child.visible = false;
                                        return;
                                    }
                                    // Get the original material's properties
                                    const originalMaterial = child.material;
                                    if (FLAGS.ASSET_LOGS) console.log('Original material:', {
                                        name: child.name,
                                        map: originalMaterial.map?.image?.src,
                                        color: originalMaterial.color.getHexString()
                                    });
                                    // Try using the original material but with basic properties
                                    child.material = new THREE.MeshBasicMaterial();
                                    child.material.copy(originalMaterial);
                                    child.material.needsUpdate = true;
                                    // Force some UI-specific properties
                                    child.material.transparent = true;
                                    child.material.depthTest = false;
                                    child.material.side = THREE.DoubleSide;
                                    child.renderOrder = 999;
                                    if (FLAGS.ASSET_LOGS) console.log('New material:', {
                                        name: child.name,
                                        map: child.material.map?.image?.src,
                                        color: child.material.color.getHexString()
                                    });
                                }
                            });
                            text_box.add(bot_diploma);
                        });
                    })();
                    // Log text_box properties before adding diplomas
                    console.log('Text Box Container Scale:', text_box.scale);
                    console.log('Text Box Container Size:', text_box.geometry ? text_box.geometry.parameters : 'No geometry');
                    create_background(category, text_box);
                    break;
                case CATEGORIES.CONTACT.value:
                    // For contact, we want the tablet.glb with iframe but NO background
                    (async () => {
                        await create_asset_background(text_box, ASSET_TYPE.TABLET, {
                            horizontalStretch: 1.1,
                            verticalStretch: 0.6,
                            rotation: new THREE.Euler(-Math.PI / 2, 0, Math.PI, 'XYZ')
                        });
                    })();
                    // Create iframe but NO background
                    create_text_frame(category, text_box);
                    break;
                case CATEGORIES.ABOUT.value:
                    // About doesn't want any background asset or box
                    create_text_frame(category, text_box);
                    break;
                case CATEGORIES.WORK.value:
                    // Use monitor as background with iframe
                    let workFrame; // Declare outside async function to access later
                    
                    // Create text frame first to ensure it exists before we try to reference it
                    create_text_frame(category, text_box);
                    workFrame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${category.value}`);
                    
                    // Custom width and height adjustments for work iframe
                    const workWidthFactor = 1.2;  // Increase width by 50%
                    const workHeightFactor = 1.0; // Default height (can be adjusted)
                    
                    // Apply custom sizing to the work iframe
                    if (workFrame) {
                        const adjustedWidth = this.container_width * workWidthFactor;
                        const adjustedHeight = this.container_height * workHeightFactor;
                        workFrame.update_size(adjustedWidth, adjustedHeight);
                        // Store adjustment factors for use during resize
                        workFrame.widthFactor = workWidthFactor;
                        workFrame.heightFactor = workHeightFactor;
                        // Store the original dimensions and container width for comparison during resize
                        workFrame.original_width = adjustedWidth;
                        workFrame.original_height = adjustedHeight;
                        workFrame.initial_container_width = this.container_width;
                    }
                    
                    // Create monitor asset background after setting up the iframe
                    (async () => {
                        await create_asset_background(text_box, ASSET_TYPE.MONITOR, {
                            horizontalStretch: 2,
                            verticalStretch: 2,
                            positionOffsetX: 2.85,
                            positionOffsetY: -9.27,
                            positionOffsetZ: 0,
                            rotation: new THREE.Euler(Math.PI, Math.PI, Math.PI, 'XYZ')
                        });
                        
                        // Now the monitor model should be created, so capture its scale
                        setTimeout(() => {
                            // Find the created monitor model and store its initial scale for reference during resize
                            const monitorModels = text_box.children.filter(child => child.name?.includes('monitor'));
                            if (monitorModels.length > 0 && monitorModels[0].children.length > 0) {
                                const monitorModel = monitorModels[0].children[0];
                                
                                if (workFrame) {
                                    workFrame.originalMonitorScale = {
                                        x: monitorModel.scale.x,
                                        y: monitorModel.scale.y,
                                        z: monitorModel.scale.z
                                    };
                                    workFrame.originalMonitorRatio = monitorModel.scale.x / monitorModel.scale.y;
                                }
                            }
                        }, 100); // Small delay to ensure monitor is fully loaded
                    })();
                    break;
                default:
                    create_background(category, text_box);
                    create_text_frame(category, text_box);
                    break;
            }
        });
    }

    /** Brings the text box associated with the given name into focus
     ** container column MUST be on the right side
    */
    focus_text_box(incoming_name, is_column_left) {
        // Get text box name
        const found_index = incoming_name.indexOf('_');
        const new_name = TYPES.TEXT + incoming_name.substring(found_index + 1);

        if (FLAGS.SELECT_LOGS) {
            console.log('Focusing text box:', {
                incoming_name,
                new_name,
                category: incoming_name.substring(found_index + 1),
                available_frames: Array.from(this.text_frames.keys()),
                is_column_left
            });
        }

        // If the column is on the left side, we should simply return
        // Instead of checking !is_column_left which might lead to inconsistent behavior
        if (is_column_left) {
            if (FLAGS.SELECT_LOGS) {
                console.log('Cannot focus text box while column is on left side');
            }
            // We'll opt to lose focus instead
            this.lose_focus_text_box(WEST);
            return;
        }

        // Only proceed with focus changes if it's a new text box
        if (new_name != this.focused_text_name) {
            // If existing focus text box move it
            if (this.focused_text_name != "") {
                // Stop any running animations in the current frame before switching
                const currentCategory = this.focused_text_name.replace(TYPES.TEXT, '');
                const currentFrame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${currentCategory}`);
                if (currentFrame && currentFrame.iframe.contentWindow) {
                    // Send visibility:false message to the current frame
                    try {
                        currentFrame.iframe.contentWindow.postMessage(
                            { type: 'visibility', visible: false },
                            '*'
                        );
                    } catch (e) {
                        console.error('Error sending visibility message:', e);
                    }

                    // Only trigger visibility change for education page
                    if (currentFrame.simple_name === CATEGORIES.EDUCATION.value) {
                        const visibilityEvent = new Event('visibilitychange');
                        Object.defineProperty(currentFrame.iframe.contentDocument, 'hidden', {
                            value: true,
                            writable: false
                        });
                        currentFrame.iframe.contentDocument.dispatchEvent(visibilityEvent);
                    }
                }
                this.lose_focus_text_box(SOUTH);
            }
            this.focused_text_name = new_name;

            // Get the category and find corresponding frame
            const category = incoming_name.substring(found_index + 1);
            const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${category}`);

            if (FLAGS.SELECT_LOGS) {
                console.log('Frame lookup:', {
                    category,
                    frameKey: `${TYPES.TEXT_BLOCK}${category}`,
                    frameFound: !!frame,
                    frameWindow: frame?.iframe?.contentWindow ? 'exists' : 'missing',
                    hasAnimation: frame?.iframe?.contentWindow?.trigger_frame_animation ? 'yes' : 'no'
                });
            }

            // Send visibility:true message to the new frame
            if (frame && frame.iframe.contentWindow) {
                try {
                    frame.iframe.contentWindow.postMessage(
                        { type: 'visibility', visible: true },
                        '*'
                    );
                } catch (e) {
                    console.error('Error sending visibility message:', e);
                }

                // Trigger frame animation
                if (typeof frame.iframe.contentWindow.trigger_frame_animation === 'function') {
                    frame.iframe.contentWindow.trigger_frame_animation();
                }
            }
        }
        // Get and move text box
        const selected_text_box = this.text_box_container.getObjectByName(this.focused_text_name);
        if (selected_text_box) {
            if (FLAGS.LAYER) {
                this.set_content_layer(this.focused_text_name, 0);
            }
            new Tween(selected_text_box.position)
                .to({ x: this.get_focused_text_x() }, 285)
                .easing(Easing.Sinusoidal.Out)
                .start();
        } else if (FLAGS.SELECT_LOGS) {
            console.error(`Failed to find text box: ${this.focused_text_name}`);
        }
    }

    // Method to tween focused_text_name to offscreen and set to empty string
    lose_focus_text_box(move_direction = "") {
        if (this.focused_text_name != "") {
            if (move_direction == "" || VALID_DIRECTIONS.includes(move_direction)) {
                const existing_focus_box = this.text_box_container.getObjectByName(this.focused_text_name);

                // Send visibility:false message when losing focus
                const category = this.focused_text_name.replace(TYPES.TEXT, '');
                const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${category}`);
                if (frame && frame.iframe.contentWindow) {
                    try {
                        frame.iframe.contentWindow.postMessage(
                            { type: 'visibility', visible: false },
                            '*'
                        );
                    } catch (e) {
                        console.error('Error sending visibility message:', e);
                    }
                }

                if (move_direction == "") {
                    existing_focus_box.position.x = get_associated_position(WEST, this.camera);
                } else {
                    // Tween in given direction off screen
                    const move_position = get_associated_position(move_direction, this.camera);
                    const determined_speed = PAN_SPEED * .2;
                    switch (move_direction) {
                        case NORTH:
                            new Tween(existing_focus_box.position)
                                .to({ y: move_position }, determined_speed)
                                .easing(Easing.Sinusoidal.Out)
                                .start()
                                .onComplete(() => {
                                    if (FLAGS.LAYER) {
                                        this.set_content_layer(existing_focus_box.name, 1);
                                    }
                                    existing_focus_box.position.y = this.get_text_box_y();
                                    existing_focus_box.position.x = get_associated_position(WEST, this.camera);
                                });
                            break;
                        case SOUTH:
                            new Tween(existing_focus_box.position)
                                .to({ y: move_position }, determined_speed)
                                .easing(Easing.Sinusoidal.Out)
                                .start()
                                .onComplete(() => {
                                    if (FLAGS.LAYER) {
                                        this.set_content_layer(existing_focus_box.name, 1);
                                    }
                                    existing_focus_box.position.y = this.get_text_box_y();
                                    existing_focus_box.position.x = 2 * get_associated_position(WEST, this.camera);
                                });
                            break;
                        case EAST:
                            new Tween(existing_focus_box.position)
                                .to({ x: move_position }, determined_speed)
                                .easing(Easing.Sinusoidal.Out)
                                .start()
                                .onComplete(() => {
                                    if (FLAGS.LAYER) {
                                        this.set_content_layer(existing_focus_box.name, 1);
                                    }
                                    existing_focus_box.position.x = (get_associated_position(WEST, this.camera))
                                });
                            break;
                        case WEST:
                            new Tween(existing_focus_box.position)
                                .to({ x: move_position }, determined_speed)
                                .easing(Easing.Sinusoidal.Out)
                                .start().onComplete(() => {
                                    if (FLAGS.LAYER) {
                                        this.set_content_layer(existing_focus_box.name, 1);
                                    }
                                });
                            break;
                    }
                }
                // Lose focus on box
                this.focused_text_name = "";
            }
        }
    }

    resize() {
        // Store previous container dimensions for comparison
        const prevWidth = this.container_width;
        const prevHeight = this.container_height;
        
        // Update current container dimensions
        this.container_width = this.get_text_box_width(this.camera);
        this.container_height = this.get_text_box_height(this.camera);
        
        const new_text_geometry = new THREE.BoxGeometry(this.container_width, this.container_height, 0);
        this.text_box_container.children.forEach(c => {
            c.children.forEach(inner_c => {
                if (!inner_c || !inner_c.name) return;
                const type = extract_type(inner_c);
                switch (type) {
                    case TYPES.BACKGROUND:
                        inner_c.geometry.dispose();
                        inner_c.geometry = new_text_geometry;
                        break;
                    case IFRAME:
                        if (inner_c.simple_name) {
                            let width = this.container_width;
                            let height = this.container_height;
                            
                            // Apply category-specific sizing
                            const frame = this.text_frames.get(`${TYPES.TEXT_BLOCK}${inner_c.simple_name}`);
                            if (frame) {
                                if (inner_c.simple_name === CATEGORIES.WORK.value && frame.widthFactor) {
                                    // Find the monitor model to maintain proper aspect ratio
                                    const monitorModels = this.text_box_container.children
                                        .filter(child => child.name?.includes('monitor'))
                                        .map(child => child.children[0]);
                                    
                                    // If we found the monitor model, use its scale to inform the iframe size
                                    if (monitorModels.length > 0) {
                                        const monitorModel = monitorModels[0];
                                        
                                        // Store original monitor scale if not already stored
                                        if (!frame.originalMonitorScale && monitorModel.scale) {
                                            frame.originalMonitorScale = {
                                                x: monitorModel.scale.x,
                                                y: monitorModel.scale.y,
                                                z: monitorModel.scale.z
                                            };
                                            frame.originalMonitorRatio = monitorModel.scale.x / monitorModel.scale.y;
                                        }
                                        
                                        if (frame.originalMonitorScale) {
                                            // Calculate current monitor scale ratio compared to original
                                            const currentXRatio = monitorModel.scale.x / frame.originalMonitorScale.x;
                                            const currentYRatio = monitorModel.scale.y / frame.originalMonitorScale.y;
                                            
                                            // Apply these same ratios to the iframe size calculation
                                            // This ensures the iframe scales proportionally with the monitor
                                            if (frame.original_width && frame.original_height) {
                                                width = frame.original_width * currentXRatio;
                                                height = frame.original_height * currentYRatio;
                                            } else {
                                                // Fallback to standard calculation with adjustment for aspect ratio
                                                width = this.container_width * frame.widthFactor * currentXRatio;
                                                height = this.container_height * frame.heightFactor;
                                            }
                                        } else {
                                            // Fallback to standard calculation if we don't have the original monitor scale
                                            width = this.container_width * frame.widthFactor;
                                            height = this.container_height * frame.heightFactor;
                                        }
                                    } else {
                                        // Fallback to standard calculation if monitor not found
                                        width = this.container_width * frame.widthFactor;
                                        height = this.container_height * frame.heightFactor;
                                    }
                                    
                                    // Detect if we're back at original window size (within 5% tolerance)
                                    if (frame.original_width && frame.original_height && 
                                        Math.abs(this.container_width - prevWidth) > 5 && // Only check after significant changes
                                        Math.abs(this.container_width - frame.initial_container_width) < 5) {
                                        // We're back at the original window size, restore original iframe dimensions
                                        width = frame.original_width;
                                        height = frame.original_height;
                                    } else if (!frame.initial_container_width) {
                                        // First resize - store the initial container width for future comparison
                                        frame.initial_container_width = this.container_width;
                                    }
                                }
                            }
                            
                            this.update_iframe_size(inner_c.simple_name, width, height);
                        }
                        break;
                }
            })
        });
    }

    update_iframe_size(incoming_simple_name, incoming_width, incoming_height) {
        const matched_frame = Array.from(this.text_frames.values()).find(frame => (frame.simple_name == incoming_simple_name));
        if (matched_frame) {
            // Store previous width before update for comparison
            const previousWidth = matched_frame.pixel_width || 0;

            // For Work iframe, adjust based on monitor scale if available
            if (incoming_simple_name === CATEGORIES.WORK.value && matched_frame.originalMonitorScale) {
                // Try to find the monitor model to get current scale
                const monitorModels = this.text_box_container.children
                    .filter(child => child.name?.includes('monitor'))
                    .map(child => child.children[0]);
                
                if (monitorModels.length > 0 && monitorModels[0]) {
                    const monitorModel = monitorModels[0];
                    
                    // Calculate current monitor scale ratio compared to original
                    const currentXRatio = monitorModel.scale.x / matched_frame.originalMonitorScale.x;
                    const currentYRatio = monitorModel.scale.y / matched_frame.originalMonitorScale.y;
                    
                    // Apply these same ratios to the iframe size
                    if (matched_frame.original_width && matched_frame.original_height) {
                        incoming_width = matched_frame.original_width * currentXRatio;
                        incoming_height = matched_frame.original_height * currentYRatio;
                    }
                }
            }

            matched_frame.update_size(incoming_width, incoming_height);

            // Special handling for contact iframe - notify it about resize
            // but keep other properties intact to preserve initial positioning
            if (incoming_simple_name === CATEGORIES.CONTACT.value && matched_frame.iframe.contentWindow) {
                // Detect extreme resize (from very small to large)
                const isExtremeResize = previousWidth < 500 && matched_frame.pixel_width > 800;

                // Send resize message to iframe with additional info for extreme cases
                matched_frame.iframe.contentWindow.postMessage(
                    isExtremeResize ? 'extreme-resize' : 'resize',
                    '*'
                );

                // For extreme resize, also adjust the tablet position slightly
                if (isExtremeResize) {
                    // Find the tablet model if available
                    const tabletModels = this.text_box_container.children
                        .filter(child => child.name?.includes('tablet'))
                        .map(child => child.children[0]);

                    if (tabletModels.length > 0) {
                        // Apply subtle scale increase to ensure content fits
                        tabletModels.forEach(model => {
                            // Smoothly adjust scale
                            if (!model.userData.originalScale) {
                                model.userData.originalScale = model.scale.clone();
                            }

                            // Apply a slight scale increase for extreme resize
                            const scaleMultiplier = 1.02;
                            model.scale.set(
                                model.userData.originalScale.x * scaleMultiplier,
                                model.userData.originalScale.y * scaleMultiplier,
                                model.userData.originalScale.z * scaleMultiplier
                            );
                        });
                    }
                }
            }
        }
    }

    reposition(is_column_left) {
        if (this.focused_text_name != "") {
            this.focus_text_box(this.focused_text_name, is_column_left);
        }
        this.text_box_container.children.forEach(c => {
            if (c.name != this.focused_text_name) {
                c.position.x = get_associated_position(WEST, this.camera) * 2;
                c.position.y = this.get_text_box_y(this.camera);
            }
        });
    }

    offscreen_reposition() {
        const offscreen_x = -(this.container_width * 3);
        const y_position = this.get_text_box_y(this.camera);

        this.text_box_container.children.forEach(c => {
            // If this is the focused text box, keep it in its focused position
            if (this.focused_text_name && c.name === this.focused_text_name) {
                new Tween(c.position)
                    .to({ x: this.get_focused_text_x(), y: y_position })
                    .easing(Easing.Elastic.Out)
                    .start();
            } else {
                c.position.x = offscreen_x;
                c.position.y = y_position;
            }
        });
    }

    set_content_layer(incoming_object_name, incoming_layer) {
        const existing_object = this.text_box_container.getObjectByName(incoming_object_name);
        existing_object.children.forEach(c => {
            c.layers.set(incoming_layer);
        });
    }

    // Text box getters
    /** Calculates the selected text boxes x position based off camera position and window size */
    get_focused_text_x() {
        return -(get_screen_size(this.camera).x / 2 * .36)
    }

    /** Calculates the text boxes y position based off camera position and window size */
    get_text_box_y() {
        return -(get_screen_size(this.camera).y * 0.05);
    }
    /** Calculates the text boxes height based off camera position and window size */
    get_text_box_height() {
        return get_screen_size(this.camera).y * .6;
    }

    /** Calculates the text boxes width based off camera position and window size */
    get_text_box_width() {
        return clamp(get_screen_size(this.camera).x * .5, 12, 18);
    }

    /** Returns if there is an active text box or not */
    is_text_box_active() {
        return this.focused_text_name != "";
    }

    /** Returns active text box */
    get_active_text_box() {
        return this.text_box_container.getObjectByName(this.focused_text_name);
    }

    trigger_overlay(is_overlay_hidden, tween_map) {
        const current_pos = this.text_box_container.position.clone();
        const target_y = is_overlay_hidden ? get_associated_position(SOUTH, this.camera) : this.get_text_box_y();

        if (FLAGS.TWEEN_LOGS) {
            console.log(`Text Container - Starting overlay animation:
                Hidden: ${is_overlay_hidden}
                Current Position: (${current_pos.x.toFixed(2)}, ${current_pos.y.toFixed(2)}, ${current_pos.z.toFixed(2)})
                Target Y: ${target_y.toFixed(2)}
                Map Size: ${tween_map.size}`);
        }

        if (!is_overlay_hidden && FLAGS.LAYER) {
            this.set_content_layer(0);
        }

        const new_tween = new Tween(this.text_box_container.position)
            .to({ y: target_y }, 680)
            .easing(Easing.Elastic.InOut)
            .start()
            .onComplete(() => {
                const final_pos = this.text_box_container.position.clone();
                if (FLAGS.TWEEN_LOGS) {
                    console.log(`Text Container - Completed overlay animation:
                        Hidden: ${is_overlay_hidden}
                        Final Position: (${final_pos.x.toFixed(2)}, ${final_pos.y.toFixed(2)}, ${final_pos.z.toFixed(2)})`);
                }
                this.current_tween = null;
                if (is_overlay_hidden && FLAGS.LAYER) {
                    this.set_content_layer(1);
                }
                tween_map.delete(this.text_box_container.name);
            });
        tween_map.set(this.text_box_container.name, new_tween);
    }
}