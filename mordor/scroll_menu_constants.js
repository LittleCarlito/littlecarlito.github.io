/**
 * ScrollMenuConstants - Constants for ScrollMenu
 */
export const ScrollMenuConstants = {
    ANIMATION: {
        DURATION: 0.3,        // Animation duration in seconds
        EASING: 'easeInOutCubic'
    },
    DISTANCE: {
        CAMERA_OFFSET: 5,     // Distance of menu from camera
        SCROLL_SENSITIVITY: 0.1,  // Sensitivity of scroll wheel
        ITEM_SPACING: 0.5     // Space between menu items
    },
    COLORS: {
        NORMAL: 0xffffff,     // Normal color
        HOVER: 0x00aaff,      // Hover color
        SELECTED: 0x00ff00,   // Selected color
        SPOTLIGHT: 0x00ffff   // Spotlight color
    },
    STATE: {
        IDLE: 'idle',         // Menu is idle
        SCROLLING: 'scrolling', // Menu is scrolling
        SELECTING: 'selecting'  // An item is being selected
    },
    LAYERS: {
        MENU: 10,             // Layer for menu items
        MENU_TEXT: 11         // Layer for menu text
    }
};

// Export constants individually for convenience
export const ANIMATION = ScrollMenuConstants.ANIMATION;
export const DISTANCE = ScrollMenuConstants.DISTANCE;
export const COLORS = ScrollMenuConstants.COLORS;
export const STATE = ScrollMenuConstants.STATE;
export const LAYERS = ScrollMenuConstants.LAYERS;

// Default options for the menu
export const DEFAULTS = {
    FONT_SIZE: 0.2,
    PANEL_WIDTH: 2.0,
    PANEL_HEIGHT: 0.6,
    PANEL_DEPTH: 0.05,
    PANEL_RADIUS: 0.1,
    PANEL_SEGMENTS: 8,
    VISIBLE_ITEMS: 5,
    TEXT_OFFSET_Z: 0.03,
    SCROLL_DAMPING: 0.9,
    HOVER_SCALE: 1.1,
    SELECTED_SCALE: 1.2
}; 