import * as THREE from 'three';
import { TitleBlock } from './title_block';
import { TextContainer } from './text_container';
import { LabelColumn } from './label_column';
import { LinkContainer } from './link_container';
import { HideButton } from './hide_button';

export class OverlayContainer {
    
    constructor(incoming_parent, incoming_camera) {
        this.parent = incoming_parent;
        this.camera = incoming_camera;
        // Overlay creation
        this.overlay_container = new THREE.Object3D();
        this.title_block = new TitleBlock(this.overlay_container, this.camera);
        this.text_box_container = new TextContainer(this.overlay_container, this.camera);
        this.label_column = new LabelColumn(this.overlay_container, this.camera);
        this.link_container = new LinkContainer(this.overlay_container, this.camera);
        this.hide_button = new HideButton(this.overlay_container, this.camera);
        this.overlay_container.position.z = this.camera.position.z - 15;
        this.parent.add(this.overlay_container);
    }

    trigger_overlay() {
        this.hide_button.swap_hide_status();
        console.log(`is overlay hidden \"${this.hide_button.is_overlay_hidden}\"`);
        // Hide the overlay
        this.title_block.trigger_overlay(this.hide_button.is_overlay_hidden);
        this.label_column.trigger_overlay(this.hide_button.is_overlay_hidden);
        this.link_container.trigger_overlay(this.hide_button.is_overlay_hidden);
    }

    swap_column_sides() {
        this.label_column.swap_sides();
        this.hide_button.swap_sides(this.label_column.is_column_left);
    }

    /**
     * Resize and repositions the overlay
     * FOR USE WHEN ONSCREEN ONLY
     */
    resize_reposition() {
        // Move/resize overlay
        this.text_box_container.resize();
        this.text_box_container.reposition(this.label_column.is_column_left);
        this.label_column.reposition();
        this.link_container.reposition();
        this.title_block.resize();
        this.title_block.reposition();
        this.hide_button.reposition(this.label_column.is_column_left);
    }

    /**
     * Resize and repositions the overlay
     * FOR USE WHEN OFFSCREEN ONLY
     */
    resize_reposition_offscreen() {
        // Move/resize overlay
        this.text_box_container.resize();
        this.text_box_container.offscreen_reposition();
        this.label_column.offscreen_reposition();
        this.link_container.offscreen_reposition();
        this.title_block.resize();
        this.title_block.offscreen_reposition();
    }

    handle_hover(intersected_object) {
        this.label_column.handle_hover(intersected_object);
    }

    reset_hover() {
        this.label_column.reset_previous_intersected();
    }

    focus_text_box(incoming_name) {
        this.text_box_container.focus_text_box(incoming_name, this.label_column.is_column_left);
    }

    lose_focus_text_box(incoming_direction) {
        this.text_box_container.lose_focus_text_box(incoming_direction);
    }

    open_link(incoming_name) {
        this.link_container.open_link(incoming_name);
    }

    // Overlay getters
    is_label_column_left_side() {
        return this.label_column.is_column_left;
    }

    is_intersected() {
        return this.label_column.current_intersected;
    }

    intersected_name() {
        return this.label_column.current_intersected.name;
    }

    is_swapping_sides() {
        return this.label_column.swapping_column_sides;
    }

    is_text_active() {
        return this.text_box_container.is_text_box_active();
    }

    get_active_box() {
        if(this.is_text_active()) {
            return this.text_box_container.get_active_text_box();
        }
    }
}