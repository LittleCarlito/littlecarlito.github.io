import { get_screen_size, get_associated_position, SOUTH } from './overlay_common';
import { Easing, FLAGS, THREE, Tween, TYPES } from '../../common';
import { clamp } from 'three/src/math/MathUtils.js';

const ARTIST_BLOCK = {
    DIMENSIONS: {
        MIN_WIDTH: 6,
        MAX_WIDTH: 8,
        WIDTH_SCALE: 0.2, // Percent based
        HEIGHT: 1,
        DEPTH: 0.2
    },
    POSITION: {
        X_OFFSET: 1,
        Y_SCALE: 0.45, // Percent based
        Z: 0,
        MIN_PADDING: 3
    }
};

export class ArtistBlock {
    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        // Create wireframe box with calculated width
        const artist_geometry = new THREE.BoxGeometry(
            this.get_artist_width(),
            ARTIST_BLOCK.DIMENSIONS.HEIGHT,
            ARTIST_BLOCK.DIMENSIONS.DEPTH
        );
        const artist_material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            wireframe: true
        });
        this.artist_box = new THREE.Mesh(artist_geometry, artist_material);
        // Initial position calculation without padding
        const screen_size = get_screen_size(this.camera);
        const initial_width = this.get_artist_width();
        this.artist_box.position.set(
            -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET + (initial_width / 2),
            -(ARTIST_BLOCK.POSITION.Y_SCALE * screen_size.y),
            ARTIST_BLOCK.POSITION.Z
        );
        // Ensure it renders on top
        this.artist_box.renderOrder = 999;
        this.artist_box.material.depthTest = false;
        this.parent.add(this.artist_box);
        // Trigger reposition animation to move to proper padded position
        this.reposition();
    }

    get_artist_width() {
        return clamp(
            get_screen_size(this.camera).x * ARTIST_BLOCK.DIMENSIONS.WIDTH_SCALE,
            ARTIST_BLOCK.DIMENSIONS.MIN_WIDTH,
            ARTIST_BLOCK.DIMENSIONS.MAX_WIDTH
        );
    }

    resize() {
        // Dispose of old geometry and create new one
        this.artist_box.geometry.dispose();
        this.artist_box.geometry = new THREE.BoxGeometry(
            this.get_artist_width(),
            ARTIST_BLOCK.DIMENSIONS.HEIGHT,
            ARTIST_BLOCK.DIMENSIONS.DEPTH
        );
    }

    /**
     * Gets the correct artist block Y position when hidden
     * @returns {number} The Y position for the artist block when hidden
     */
    get_artist_y() {
        return get_associated_position(SOUTH, this.camera);
    }

    trigger_overlay(is_overlay_hidden, tween_map) {
        const target_y = is_overlay_hidden ? 
            get_associated_position(SOUTH, this.camera) : 
            -(ARTIST_BLOCK.POSITION.Y_SCALE * get_screen_size(this.camera).y);
        
        if(!is_overlay_hidden && FLAGS.LAYER) {
            this.artist_box.layers.set(0);
        }
        
        const new_tween = new Tween(this.artist_box.position)
            .to({ y: target_y }, 680)  // Same duration as link container
            .easing(Easing.Elastic.InOut)
            .start()
            .onComplete(() => {
                if(is_overlay_hidden && FLAGS.LAYER) {
                    this.artist_box.layers.set(1);
                }
                tween_map.delete(this.artist_box.name);
            });
        
        tween_map.set(this.artist_box.name, new_tween);
    }

    reposition() {
        const screen_size = get_screen_size(this.camera);
        const current_width = this.get_artist_width();
        
        // Get link container's x position (it's positioned from right edge)
        const link_x = (screen_size.x / 2) - 7;  // This matches LinkContainer's calculation
        
        // Calculate our x position from left edge, ensuring minimum padding from link container
        const max_x = link_x - ARTIST_BLOCK.POSITION.MIN_PADDING - (current_width / 2);
        const desired_x = Math.min(
            max_x,
            -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET + (current_width / 2)
        );
        
        new Tween(this.artist_box.position)
            .to({ 
                x: desired_x,
                y: -(ARTIST_BLOCK.POSITION.Y_SCALE * screen_size.y)
            })
            .easing(Easing.Elastic.Out)
            .start();
    }

    offscreen_reposition() {
        const screen_size = get_screen_size(this.camera);
        const current_width = this.get_artist_width();
        this.artist_box.position.y = get_associated_position(SOUTH, this.camera);
        this.artist_box.position.x = -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET + (current_width / 2);
    }
}