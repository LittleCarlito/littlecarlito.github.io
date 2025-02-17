import { get_screen_size, get_associated_position, SOUTH } from './overlay/overlay_common';
import { Easing, FLAGS, THREE, Tween } from '../common';

const ARTIST_BLOCK = {
    DIMENSIONS: {
        WIDTH: 6,
        HEIGHT: 1,
        DEPTH: 0.2
    },
    POSITION: {
        X_OFFSET: 3.5,     // Distance from screen edge
        Y_SCALE: 0.4,      // Percentage of screen height from bottom
        Z: 0
    }
};

export class ArtistBlock {
    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        
        // Create wireframe box
        const artist_geometry = new THREE.BoxGeometry(
            ARTIST_BLOCK.DIMENSIONS.WIDTH,
            ARTIST_BLOCK.DIMENSIONS.HEIGHT,
            ARTIST_BLOCK.DIMENSIONS.DEPTH
        );
        const artist_material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            wireframe: true
        });
        
        this.artist_box = new THREE.Mesh(artist_geometry, artist_material);
        
        // Position calculation mirroring link container
        const screen_size = get_screen_size(this.camera);
        this.artist_box.position.set(
            -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET,
            -(ARTIST_BLOCK.POSITION.Y_SCALE * screen_size.y),
            ARTIST_BLOCK.POSITION.Z
        );
        
        // Ensure it renders on top
        this.artist_box.renderOrder = 999;
        this.artist_box.material.depthTest = false;
        
        this.parent.add(this.artist_box);
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
        new Tween(this.artist_box.position)
            .to({ 
                x: -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET,
                y: -(ARTIST_BLOCK.POSITION.Y_SCALE * screen_size.y)
            })
            .easing(Easing.Elastic.Out)
            .start();
    }

    offscreen_reposition() {
        const screen_size = get_screen_size(this.camera);
        this.artist_box.position.y = get_associated_position(SOUTH, this.camera);
        this.artist_box.position.x = -(screen_size.x / 2) + ARTIST_BLOCK.POSITION.X_OFFSET;
    }
}