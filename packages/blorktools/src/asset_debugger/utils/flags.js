// Debugging Flags for Asset Debugger UI Components
// This file contains flags that can be toggled for debugging purposes

/**
 * UI Component debugging flags
 */
export const UIDebugFlags = {
	// When true, adds a red overlay to panels when they're detected as off-screen
	showOffscreenIndicators: true,
    
	// Controls the opacity of the off-screen indicator overlay
	offscreenIndicatorOpacity: 0.4,
    
	// When true, logs additional information about panel positions to console
	logPositionInfo: false
};

/**
 * Helper function to toggle a debug flag by name
 * @param {string} flagName - The name of the flag to toggle
 * @returns {boolean} The new value of the flag
 */
export function toggleDebugFlag(flagName) {
	if (flagName in UIDebugFlags) {
		UIDebugFlags[flagName] = !UIDebugFlags[flagName];
		console.log(`Debug flag '${flagName}' set to: ${UIDebugFlags[flagName]}`);
		return UIDebugFlags[flagName];
	} else {
		console.warn(`Unknown debug flag: ${flagName}`);
		return false;
	}
} 