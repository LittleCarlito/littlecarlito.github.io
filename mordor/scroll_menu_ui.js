import { THREE } from '../../common';
import { DEFAULTS, COLORS, STATE } from './scroll_menu_constants';

/**
 * ScrollMenuUI - Handles the UI elements of the scroll menu
 */
export class ScrollMenuUI {
    // Container for all UI elements
    container;
    
    // Menu items
    items = [];
    itemMeshes = [];
    textMeshes = [];
    
    // Scroll state
    scrollOffset = 0;
    targetScrollOffset = 0;
    scrollVelocity = 0;
    
    // Interaction state
    hoveredIndex = -1;
    selectedIndex = -1;
    isVisible = false;
    state = STATE.IDLE;
    
    /**
     * Creates a new ScrollMenuUI
     */
    constructor(options = {}) {
        // Merge default options with provided options
        this.options = {
            ...DEFAULTS,
            ...options
        };
        
        // Create container
        this.container = new THREE.Object3D();
        this.container.name = "scroll_menu_ui_container";
        this.container.visible = false;
        
        return this;
    }
    
    /**
     * Sets the menu items
     */
    setItems(items) {
        this.items = items;
        this.createMenuItems();
    }
    
    /**
     * Creates the menu items
     */
    createMenuItems() {
        // Clear existing items
        this.clearItems();
        
        // Create new items
        this.items.forEach((item, index) => {
            // Create panel using standard BoxGeometry instead of RoundedBoxGeometry
            const panelGeometry = new THREE.BoxGeometry(
                this.options.PANEL_WIDTH,
                this.options.PANEL_HEIGHT,
                this.options.PANEL_DEPTH
            );
            const panelMaterial = new THREE.MeshStandardMaterial({
                color: COLORS.NORMAL,
                roughness: 0.5,
                metalness: 0.2
            });
            const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
            panelMesh.name = `menu_item_${index}`;
            panelMesh.userData.index = index;
            panelMesh.userData.data = item.data;
            
            // Position panel
            panelMesh.position.y = -index * (this.options.PANEL_HEIGHT + this.options.ITEM_SPACING);
            
            // Add to container
            this.container.add(panelMesh);
            this.itemMeshes.push(panelMesh);
            
            // Create a simple plane with a canvas texture for text instead of TextGeometry
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            
            // Fill with transparent background
            context.fillStyle = 'rgba(0, 0, 0, 0)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw text
            context.font = `bold ${Math.floor(canvas.height * 0.7)}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = 'black';
            context.fillText(item.text, canvas.width / 2, canvas.height / 2);
            
            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            // Create material with the texture
            const textMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            // Create a plane for the text
            const textGeometry = new THREE.PlaneGeometry(
                this.options.PANEL_WIDTH * 0.9,
                this.options.PANEL_HEIGHT * 0.7
            );
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.name = `menu_text_${index}`;
            
            // Position text in front of panel
            textMesh.position.copy(panelMesh.position);
            textMesh.position.z += this.options.TEXT_OFFSET_Z;
            
            // Add to container
            this.container.add(textMesh);
            this.textMeshes.push(textMesh);
        });
    }
    
    /**
     * Clears all menu items
     */
    clearItems() {
        // Remove all item meshes
        this.itemMeshes.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.itemMeshes = [];
        
        // Remove all text meshes
        this.textMeshes.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
        });
        this.textMeshes = [];
    }
    
    /**
     * Shows the menu
     */
    show(camera) {
        this.isVisible = true;
        this.container.visible = true;
        
        // Reset scroll
        this.scrollOffset = 0;
        this.targetScrollOffset = 0;
        this.scrollVelocity = 0;
        
        // Reset interaction state
        this.hoveredIndex = -1;
        this.selectedIndex = -1;
        this.state = STATE.IDLE;
        
        // Update item positions
        this.updateItemPositions();
    }
    
    /**
     * Hides the menu
     */
    hide() {
        this.isVisible = false;
        this.container.visible = false;
    }
    
    /**
     * Updates the menu
     */
    update(camera) {
        if (!this.isVisible) return;
        
        // Update scroll animation
        this.updateScroll();
        
        // Update item positions
        this.updateItemPositions();
    }
    
    /**
     * Updates the scroll animation
     */
    updateScroll() {
        // Apply damping to scroll velocity
        this.scrollVelocity *= this.options.SCROLL_DAMPING;
        
        // Apply velocity to target scroll offset
        this.targetScrollOffset += this.scrollVelocity;
        
        // Clamp target scroll offset
        const maxScroll = Math.max(0, this.items.length - this.options.VISIBLE_ITEMS);
        this.targetScrollOffset = Math.max(0, Math.min(this.targetScrollOffset, maxScroll));
        
        // Smoothly interpolate current scroll offset towards target
        this.scrollOffset += (this.targetScrollOffset - this.scrollOffset) * 0.1;
    }
    
    /**
     * Updates item positions based on scroll offset
     */
    updateItemPositions() {
        this.itemMeshes.forEach((mesh, index) => {
            // Calculate position based on scroll offset
            const y = -index * (this.options.PANEL_HEIGHT + this.options.ITEM_SPACING) + this.scrollOffset * (this.options.PANEL_HEIGHT + this.options.ITEM_SPACING);
            
            // Update position
            mesh.position.y = y;
            
            // Update text position
            if (this.textMeshes[index]) {
                this.textMeshes[index].position.y = y;
            }
            
            // Update visibility based on position
            const isVisible = y > -(this.options.VISIBLE_ITEMS + 1) * (this.options.PANEL_HEIGHT + this.options.ITEM_SPACING) && 
                             y < (this.options.PANEL_HEIGHT + this.options.ITEM_SPACING);
            mesh.visible = isVisible;
            if (this.textMeshes[index]) {
                this.textMeshes[index].visible = isVisible;
            }
            
            // Update appearance based on interaction state
            if (index === this.hoveredIndex) {
                mesh.material.color.setHex(COLORS.HOVER);
                mesh.scale.set(this.options.HOVER_SCALE, this.options.HOVER_SCALE, this.options.HOVER_SCALE);
            } else if (index === this.selectedIndex) {
                mesh.material.color.setHex(COLORS.SELECTED);
                mesh.scale.set(this.options.SELECTED_SCALE, this.options.SELECTED_SCALE, this.options.SELECTED_SCALE);
            } else {
                mesh.material.color.setHex(COLORS.NORMAL);
                mesh.scale.set(1, 1, 1);
            }
        });
    }
    
    /**
     * Handles scroll input
     */
    scroll(amount) {
        if (!this.isVisible) return;
        
        // Add to scroll velocity
        this.scrollVelocity += amount;
        
        // Update state
        this.state = STATE.SCROLLING;
    }
    
    /**
     * Handles hover on menu items
     */
    handleHover(raycaster) {
        if (!this.isVisible) return -1;
        
        // Reset hovered index
        this.hoveredIndex = -1;
        
        // Check for intersections with menu items
        const intersects = raycaster.intersectObjects(this.itemMeshes);
        
        // If we have an intersection, set the hovered index
        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            this.hoveredIndex = mesh.userData.index;
        }
        
        return this.hoveredIndex;
    }
    
    /**
     * Handles click on menu items
     */
    handleClick(raycaster) {
        if (!this.isVisible) return null;
        
        // Check for intersections with menu items
        const intersects = raycaster.intersectObjects(this.itemMeshes);
        
        // If we have an intersection, set the selected index and return the item data
        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            this.selectedIndex = mesh.userData.index;
            this.state = STATE.SELECTING;
            
            // Return the item data
            return this.items[this.selectedIndex].data;
        }
        
        return null;
    }
    
    /**
     * Disposes of resources
     */
    dispose() {
        this.clearItems();
        
        if (this.container && this.container.parent) {
            this.container.parent.remove(this.container);
        }
    }
} 