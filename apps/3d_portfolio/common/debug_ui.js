// Debug UI for displaying framerate and performance metrics
import { FLAGS, RAPIER, THREE } from '../common';
import { BLORKPACK_FLAGS, AssetHandler } from '@littlecarlito/blorkpack';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// FPS tracking variables
let frameCount = 0;
let lastTime = performance.now();
let currentFps = 0;

// Reference to the background container
let backgroundContainer = null;

// Add scene reference
let sceneRef = null;

/**
 * Creates a debug UI that shows performance metrics
 */
export function createDebugUI() {
	// Check if debug UI already exists
	if (document.getElementById('debug-ui')) {
		return;
	}
	
	// Try to set scene reference if it's not already set
	if (!sceneRef && window.scene) {
		console.log("Automatically setting scene reference from window.scene");
		setSceneReference(window.scene);
	}
	
	// Create debug UI container
	const debugUI = document.createElement('div');
	debugUI.id = 'debug-ui';
	debugUI.style.position = 'fixed';
	debugUI.style.top = '10px';
	debugUI.style.left = '10px';
	debugUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
	debugUI.style.color = 'white';
	debugUI.style.padding = '15px';
	debugUI.style.borderRadius = '5px';
	debugUI.style.fontFamily = 'Arial, sans-serif';
	debugUI.style.fontSize = '14px';
	debugUI.style.zIndex = '1000';
	debugUI.style.display = FLAGS.DEBUG_UI ? 'block' : 'none';
	debugUI.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
	debugUI.style.minWidth = '200px';
	
	// Add event listeners to prevent click-through to elements below
	debugUI.addEventListener('mousedown', e => e.stopPropagation());
	debugUI.addEventListener('click', e => e.stopPropagation());
	debugUI.addEventListener('dblclick', e => e.stopPropagation());
	debugUI.addEventListener('mouseup', e => e.stopPropagation());
	debugUI.addEventListener('wheel', e => e.stopPropagation());
	
	// Add title
	const title = document.createElement('div');
	title.textContent = 'Debug Controls';
	title.style.fontWeight = 'bold';
	title.style.marginBottom = '10px';
	title.style.fontSize = '16px';
	title.style.borderBottom = '1px solid #555';
	title.style.paddingBottom = '5px';
	debugUI.appendChild(title);
	
	// Add FPS display - always visible
	const fpsDisplay = document.createElement('div');
	fpsDisplay.id = 'fps-display';
	fpsDisplay.textContent = 'FPS: --';
	fpsDisplay.style.fontWeight = 'bold';
	fpsDisplay.style.marginBottom = '15px';
	debugUI.appendChild(fpsDisplay);
	
	// Create a container for the debug toggles section
	const debugTogglesTitle = document.createElement('div');
	debugTogglesTitle.textContent = 'Debug Toggles';
	debugTogglesTitle.style.fontWeight = 'bold';
	debugTogglesTitle.style.marginBottom = '8px';
	debugUI.appendChild(debugTogglesTitle);
	
	// Create toggles
	addToggle(debugUI, 'COLLISION_WIREFRAMES', 'Collision Wireframes', false, (checked) => {
		FLAGS.COLLISION_WIREFRAMES = checked;
		toggleCollisionWireframes(checked);
		console.log(`Collision wireframes ${checked ? 'enabled' : 'disabled'}`);
	});
	
	addToggle(debugUI, 'RIG_VISUALIZATION', 'Rig Visualization', FLAGS.RIG_VISUALIZATION, (checked) => {
		FLAGS.RIG_VISUALIZATION = checked;
		toggleRigVisualization(checked);
		console.log(`Rig visualization ${checked ? 'enabled' : 'disabled'}`);
	});
	
	// Add keyboard shortcut info
	const shortcutInfo = document.createElement('div');
	shortcutInfo.textContent = 'Press S to toggle UI';
	shortcutInfo.style.fontSize = '12px';
	shortcutInfo.style.color = '#aaa';
	shortcutInfo.style.marginTop = '15px';
	shortcutInfo.style.textAlign = 'center';
	debugUI.appendChild(shortcutInfo);
	
	// Add to document
	document.body.appendChild(debugUI);
	
	// Start FPS counter
	updateFPS();
	
	// Force update label wireframes if they exist
	setTimeout(() => {
		console.log('Attempting to force update label wireframes...');
		if (window.viewable_container && window.viewable_container.get_overlay()) {
			if(BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log('viewable_container and overlay exist');
			}
			const labelContainer = window.viewable_container.get_overlay().label_container;
			if (labelContainer) {
				if(BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log('labelContainer exists');
				}
				if (typeof labelContainer.updateDebugVisualizations === 'function') {
					if(BLORKPACK_FLAGS.ASSET_LOGS) {
						console.log('updateDebugVisualizations method exists, calling it');
					}
					labelContainer.updateDebugVisualizations();
				} else {
					console.error('updateDebugVisualizations method does not exist on labelContainer');
					if(BLORKPACK_FLAGS.ASSET_LOGS) {
						console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(labelContainer)));
					}
				}
			} else {
				console.error('labelContainer does not exist on overlay');
				if(BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log('Overlay properties:', Object.keys(window.viewable_container.get_overlay()));
				}
			}
		} else {
			console.error('viewable_container or overlay does not exist');
			if (window.viewable_container) {
				if(BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log('viewable_container exists, but get_overlay() returned:', window.viewable_container.get_overlay());
				}
			} else {
				if(BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log('viewable_container does not exist');
				}
			}
		}
	}, 3000);
	
	// Set up periodic checks to update label wireframes
	let checkCount = 0;
	const maxChecks = 10;
	const checkInterval = setInterval(() => {
		checkCount++;
		console.log(`Periodic check ${checkCount}/${maxChecks} for label wireframes...`);
		if (window.viewable_container && window.viewable_container.get_overlay()) {
			const labelContainer = window.viewable_container.get_overlay().label_container;
			if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
				console.log('Periodic update of label wireframes');
				labelContainer.updateDebugVisualizations();
				clearInterval(checkInterval);
				console.log('Successfully updated label wireframes, stopping periodic checks');
			}
		}
		if (checkCount >= maxChecks) {
			clearInterval(checkInterval);
			console.log('Finished periodic checks for label wireframes');
		}
	}, 2000);
	
	// Add a MutationObserver to detect when viewable_container becomes available
	if (!window.viewable_container) {
		console.log('Setting up MutationObserver to detect viewable_container initialization');
		
		const checkForViewableContainer = () => {
			if (window.viewable_container) {
				console.log('viewable_container detected by observer!');
				setTimeout(() => {
					if (window.viewable_container.get_overlay()) {
						const labelContainer = window.viewable_container.get_overlay().label_container;
						if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
							console.log('Observer: Updating label wireframes after detection');
							labelContainer.updateDebugVisualizations();
						}
					}
				}, 500);
				observer.disconnect();
			}
		};
		
		const observer = new MutationObserver((mutations) => {
			checkForViewableContainer();
		});
		
		observer.observe(document, { childList: true, subtree: true });
		
		const viewableContainerInterval = setInterval(() => {
			if (window.viewable_container) {
				console.log('viewable_container detected by interval check!');
				if (window.viewable_container.get_overlay()) {
					const labelContainer = window.viewable_container.get_overlay().label_container;
					if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
						console.log('Interval check: Updating label wireframes after detection');
						labelContainer.updateDebugVisualizations();
					}
				}
				clearInterval(viewableContainerInterval);
			}
		}, 1000);
	}
	
	if(BLORKPACK_FLAGS.ASSET_LOGS) {
		console.log("Debug UI initialized. Press 's' to toggle.");
	}
	return debugUI;
}

/**
 * Updates the label wireframes if they exist
 */
export function updateLabelWireframes() {
	if (window.viewable_container && window.viewable_container.get_overlay()) {
		const labelContainer = window.viewable_container.get_overlay().label_container;
		if (labelContainer && typeof labelContainer.updateDebugVisualizations === 'function') {
			console.log('Updating label wireframes via direct call');
			labelContainer.updateDebugVisualizations();
			return true;
		}
	}
	return false;
}

/**
 * Sets the background container reference for debug UI
 */
export function setBackgroundContainer(container) {
	backgroundContainer = container;
}

/**
 * Updates the FPS counter
 */
function updateFPS() {
	const now = performance.now();
	frameCount++;
	const elapsed = now - lastTime;
	
	if (elapsed >= 1000) {
		currentFps = Math.round((frameCount * 1000) / elapsed);
		frameCount = 0;
		lastTime = now;
		
		const fpsDisplay = document.getElementById('fps-display');
		if (fpsDisplay) {
			fpsDisplay.textContent = `FPS: ${currentFps}`;
			
			// Set color based on FPS
			if (currentFps < 30) {
				fpsDisplay.style.color = '#FF3B30'; // Red for low FPS
			} else if (currentFps < 50) {
				fpsDisplay.style.color = '#FF9500'; // Orange for medium FPS
			} else {
				fpsDisplay.style.color = '#32CD32'; // Green for high FPS
			}
		}
	}
	
	// Request next frame
	requestAnimationFrame(updateFPS);
}

/**
 * Toggles the visibility of the debug UI
 */
export function toggleDebugUI(show) {
	// If show parameter is not provided, toggle based on current state
	if (show === undefined) {
		FLAGS.DEBUG_UI = !FLAGS.DEBUG_UI;
	} else {
		FLAGS.DEBUG_UI = show;
	}
	
	// Find existing UI
	const existingUI = document.getElementById('debug-ui');
	if (FLAGS.DEBUG_UI) {
		// Try to set scene reference if it's not already set
		if (!sceneRef && window.scene) {
			console.log("Setting scene reference during UI toggle");
			setSceneReference(window.scene);
		}
		// If UI should be shown but doesn't exist, create it
		if (!existingUI) {
			createDebugUI();
		} else {
			existingUI.style.display = 'block';
		}
	} else {
		// If UI should be hidden and exists, hide it
		if (existingUI) {
			existingUI.style.display = 'none';
		}
	}
	return FLAGS.DEBUG_UI;
}

/**
 * Gets the current FPS
 */
export function getCurrentFPS() {
	return currentFps;
}

/**
 * Sets the scene reference for debug UI functions
 */
export function setSceneReference(scene) {
	console.log("Setting scene reference for debug UI");
	sceneRef = scene;
}

/**
 * Adds a toggle switch for a debug flag
 */
function addToggle(parent, flagName, label, initialState, onChange) {
	const toggleContainer = document.createElement('div');
	toggleContainer.style.display = 'flex';
	toggleContainer.style.justifyContent = 'space-between';
	toggleContainer.style.alignItems = 'center';
	toggleContainer.style.marginBottom = '5px';
	
	const toggleLabel = document.createElement('span');
	toggleLabel.textContent = label;
	toggleContainer.appendChild(toggleLabel);
	
	const toggle = document.createElement('label');
	toggle.className = 'switch';
	toggle.style.position = 'relative';
	toggle.style.display = 'inline-block';
	toggle.style.width = '30px';
	toggle.style.height = '17px';
	
	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	// Use provided initial state or get from FLAGS or BLORKPACK_FLAGS
	let isChecked = initialState !== undefined ? initialState : false;
	isChecked = FLAGS[flagName] || false;
	checkbox.checked = isChecked;
	checkbox.style.opacity = '0';
	checkbox.style.width = '0';
	checkbox.style.height = '0';
	
	const slider = document.createElement('span');
	slider.className = 'slider';
	slider.style.position = 'absolute';
	slider.style.cursor = 'pointer';
	slider.style.top = '0';
	slider.style.left = '0';
	slider.style.right = '0';
	slider.style.bottom = '0';
	slider.style.backgroundColor = isChecked ? '#4CAF50' : '#ccc';
	slider.style.transition = '.4s';
	slider.style.borderRadius = '17px';
	
	// Create the circle on the slider
	const circle = document.createElement('span');
	circle.style.position = 'absolute';
	circle.style.height = '13px';
	circle.style.width = '13px';
	circle.style.left = isChecked ? '13px' : '2px';
	circle.style.bottom = '2px';
	circle.style.backgroundColor = 'white';
	circle.style.transition = '.4s';
	circle.style.borderRadius = '50%';
	slider.appendChild(circle);
	
	// Add event listener to toggle the flag
	checkbox.addEventListener('change', function() {
		const checked = this.checked;
		slider.style.backgroundColor = checked ? '#4CAF50' : '#ccc';
		circle.style.left = checked ? '13px' : '2px';
		
		// For all other flags, update FLAGS as before
		if (flagName in FLAGS) {
			FLAGS[flagName] = checked;
			console.log(`${flagName} set to ${checked}`);
			
			// Call specific update functions based on the flag
			if (flagName === 'SIGN_VISUAL_DEBUG') {
				if (backgroundContainer) {
					backgroundContainer.updateSignDebugVisualizations();
				}
			}
		}
		
		// Call onChange callback if provided
		if (onChange && typeof onChange === 'function') {
			onChange(checked);
		}
	});
	
	toggle.appendChild(checkbox);
	toggle.appendChild(slider);
	toggleContainer.appendChild(toggle);
	parent.appendChild(toggleContainer);
} 

function toggleRigVisualization(enabled) {
    console.log(`Rig visualization ${enabled ? 'enabled' : 'disabled'}`);
    
    // Update rig config and state through asset handler
    if (window.asset_handler) {
        window.asset_handler.updateRigConfig({ displayRig: enabled });
        window.asset_handler.setRigVisualizationEnabled(enabled);
    }
    
    if (sceneRef) {
        sceneRef.traverse((object) => {
            if (object.name === "RigVisualization") {
                object.visible = enabled;
            }
            if (object.name === "RigControlHandle") {
                object.visible = enabled;
            }
        });
    }

    if (window.asset_handler && window.asset_handler.activeRigVisualizations) {
        window.asset_handler.activeRigVisualizations.forEach((rigData) => {
            if (rigData.visualization && rigData.visualization.group) {
                rigData.visualization.group.visible = enabled;
            }
            if (rigData.visualization && rigData.visualization.handles) {
                rigData.visualization.handles.forEach(handle => {
                    handle.visible = enabled;
                });
            }
        });
    }
}

function toggleCollisionWireframes(enabled) {
	console.log(`Collision wireframes ${enabled ? 'enabled' : 'disabled'}`);
	
	// Update all assets in the scene that have collision wireframes
	if (sceneRef) {
		sceneRef.traverse((object) => {
			// Check if this object has collision wireframe methods
			if (object.userData && object.userData.collisionWireframes) {
				if (enabled) {
					object.userData.enableCollisionWireframes();
				} else {
					object.userData.disableCollisionWireframes();
				}
			}
		});
	}
	
	// Also check background container if it exists
	if (backgroundContainer) {
		// Get all categorized assets
		const allAssets = backgroundContainer.getAllCategorizedAssets();
		Object.values(allAssets).forEach(categoryAssets => {
			categoryAssets.forEach(assetData => {
				if (assetData.mesh && assetData.mesh.userData && assetData.mesh.userData.collisionWireframes) {
					if (enabled) {
						assetData.mesh.userData.enableCollisionWireframes();
					} else {
						assetData.mesh.userData.disableCollisionWireframes();
					}
				}
			});
		});
		
		// Also check the main asset container
		if (backgroundContainer.asset_container) {
			backgroundContainer.asset_container.traverse((object) => {
				if (object.userData && object.userData.collisionWireframes) {
					if (enabled) {
						object.userData.enableCollisionWireframes();
					} else {
						object.userData.disableCollisionWireframes();
					}
				}
			});
		}
	}
	
	// Update AssetHandler managed assets if available
	if (window.asset_handler && window.asset_handler.storage) {
		const allAssets = window.asset_handler.storage.get_all_assets();
		allAssets.forEach(asset => {
			if (asset.mesh && asset.mesh.userData && asset.mesh.userData.collisionWireframes) {
				if (enabled) {
					asset.mesh.userData.enableCollisionWireframes();
				} else {
					asset.mesh.userData.disableCollisionWireframes();
				}
			}
		});
	}
}