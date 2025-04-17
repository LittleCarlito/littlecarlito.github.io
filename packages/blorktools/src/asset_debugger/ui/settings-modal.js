/**
 * Settings Modal UI Component for Asset Debugger
 */
import { saveSettings, loadSettings, getDefaultSettings } from '../data/localstorage-util.js';
import { updateRigOptions } from '../core/rig/rig-manager.js';

export class SettingsModal {
    constructor(settings = null) {
        // Create the modal HTML structure
        this.createModalHTML();
        
        // Modal elements
        this.modal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-button');
        this.closeBtn = document.getElementById('close-settings-modal');
        this.cancelBtn = document.getElementById('cancel-settings');
        this.saveBtn = document.getElementById('save-settings');
        this.resetRigBtn = document.getElementById('reset-rig');
        
        // Form elements
        this.axisIndicatorSelect = document.getElementById('axis-indicator-type');
        this.intensitySlider = document.getElementById('axis-intensity');
        this.intensityValue = document.getElementById('axis-intensity-value');
        this.displayRig = document.getElementById('display-rig');
        this.forceZ = document.getElementById('force-z');
        this.fillWireframe = document.getElementById('fill-wireframe');
        this.primaryColor = document.getElementById('primary-color');
        this.secondaryColor = document.getElementById('secondary-color');
        this.jointColor = document.getElementById('joint-color');
        this.showJointLabels = document.getElementById('show-joint-labels');
        this.normalColor = document.getElementById('normal-color');
        this.hoverColor = document.getElementById('hover-color');
        this.activeColor = document.getElementById('active-color');
        
        // Other UI elements
        this.secondaryColorOption = document.getElementById('secondary-color-option');
        this.embeddedSettings = document.getElementById('embedded-axis-settings');
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Apply settings
        if (settings) {
            // Use provided settings
            this.applySettings(settings);
        } else {
            // No settings provided, use defaults
            const defaults = getDefaultSettings();
            this.applyAxisIndicatorSetting(defaults.axisIndicator.type, defaults.axisIndicator.intensity);
            this.initializeRigOptions();
        }
    }
    
    /**
     * Create the modal HTML structure and append it to the document body
     */
    createModalHTML() {
        const modalHTML = `
            <!-- Settings Modal -->
            <div id="settings-modal" class="modal-overlay">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 class="modal-title">Settings</h3>
                        <button id="close-settings-modal" class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- Settings tabs -->
                        <div class="settings-tabs">
                            <button class="settings-tab-button active" data-tab="world-settings">World</button>
                            <button class="settings-tab-button" data-tab="general-settings">General</button>
                            <button class="settings-tab-button" data-tab="rig-settings">Rig</button>
                        </div>
                        
                        <!-- World Settings Tab -->
                        <div id="world-settings" class="settings-tab-content active">
                            <div class="settings-row">
                                <div class="settings-subheading">Physics</div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option full-width">
                                    <label for="world-gravity">Gravity:</label>
                                    <div class="slider-container">
                                        <input type="range" id="world-gravity" class="settings-slider" min="-10" max="10" step="0.1" value="1.0">
                                        <span id="world-gravity-value">1.0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option">
                                    <label for="world-gravity-input">Custom Gravity:</label>
                                    <input type="number" id="world-gravity-input" class="settings-input" min="-10" max="10" step="0.1" value="1.0" style="width: 80px;">
                                </div>
                            </div>
                            <div class="settings-row" style="font-size: 12px; color: var(--label-text);">
                                <p>Positive values pull down, negative values push up. Range: -10 to 10.</p>
                                <p>Changes apply to spring-constrained bones only.</p>
                            </div>
                        </div>
                        
                        <!-- General Settings Tab -->
                        <div id="general-settings" class="settings-tab-content">
                            <div class="settings-row">
                                <div class="settings-subheading">Axis Indicator</div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option">
                                    <label for="axis-indicator-type">Type:</label>
                                    <select id="axis-indicator-type" class="settings-select">
                                        <option value="disabled">Disabled</option>
                                        <option value="corner">Corner</option>
                                        <option value="embedded">Embedded</option>
                                    </select>
                                </div>
                            </div>
                            <div id="embedded-axis-settings" class="settings-row" style="display: none;">
                                <div class="settings-option full-width">
                                    <label for="axis-intensity">Intensity:</label>
                                    <div class="slider-container">
                                        <input type="range" id="axis-intensity" class="settings-slider" min="0.1" max="1" step="0.1" value="0.7">
                                        <span id="axis-intensity-value">0.7</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Rig Settings Tab -->
                        <div id="rig-settings" class="settings-tab-content">
                            <div class="settings-row">
                                <div class="settings-subheading">Rig Visualization</div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option">
                                    <label for="display-rig">Display Rig:</label>
                                    <input type="checkbox" id="display-rig" class="settings-checkbox">
                                </div>
                                <div class="settings-option">
                                    <label for="force-z">Force Z-index:</label>
                                    <input type="checkbox" id="force-z" class="settings-checkbox">
                                </div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option">
                                    <label for="fill-wireframe">Fill Mode:</label>
                                    <input type="checkbox" id="fill-wireframe" class="settings-checkbox">
                                </div>
                                <div class="settings-option">
                                    <label for="show-joint-labels">Show Labels:</label>
                                    <input type="checkbox" id="show-joint-labels" class="settings-checkbox">
                                </div>
                            </div>
                            
                            <div class="settings-row">
                                <div class="settings-subheading">Rig Colors</div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option">
                                    <label for="primary-color">Primary Color:</label>
                                    <input type="color" id="primary-color" class="settings-color-picker">
                                </div>
                                <div id="secondary-color-option" class="settings-option">
                                    <label for="secondary-color">Secondary Color:</label>
                                    <input type="color" id="secondary-color" class="settings-color-picker">
                                </div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-option">
                                    <label for="joint-color">Joint Color:</label>
                                    <input type="color" id="joint-color" class="settings-color-picker">
                                </div>
                            </div>
                            
                            <div class="settings-row">
                                <div class="collapsible-header">
                                    <div class="settings-subheading">Control Handle Colors</div>
                                    <span class="collapse-indicator">▶</span>
                                </div>
                            </div>
                            <div class="settings-row collapsible-content" style="display: none;">
                                <div class="settings-option">
                                    <label for="normal-color">Normal:</label>
                                    <input type="color" id="normal-color" class="settings-color-picker">
                                </div>
                                <div class="settings-option">
                                    <label for="hover-color">Hover:</label>
                                    <input type="color" id="hover-color" class="settings-color-picker">
                                </div>
                                <div class="settings-option">
                                    <label for="active-color">Active:</label>
                                    <input type="color" id="active-color" class="settings-color-picker">
                                </div>
                            </div>
                            
                            <div class="settings-row text-center">
                                <button id="reset-rig" class="reset-button">Reset Rig Physics</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancel-settings" class="modal-btn modal-btn-secondary">Cancel</button>
                        <button id="save-settings" class="modal-btn modal-btn-primary">Save Settings</button>
                    </div>
                </div>
            </div>
        `;
        
        // Create a container element to hold the modal HTML
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        
        // Append the modal to the document body
        document.body.appendChild(modalContainer.firstElementChild);
    }
    
    /**
     * Initialize all event listeners for the settings modal
     */
    initEventListeners() {
        // Open modal
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => this.openModal());
        }
        
        // Close modal buttons
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.closeModal());
        }
        
        // Save settings
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        // Reset rig
        if (this.resetRigBtn) {
            this.resetRigBtn.addEventListener('click', () => {
                const event = new CustomEvent('resetRig');
                document.dispatchEvent(event);
            });
        }
        
        // Intensity slider changes
        if (this.intensitySlider && this.intensityValue) {
            this.intensitySlider.addEventListener('input', () => {
                this.intensityValue.textContent = this.intensitySlider.value;
            });
        }
        
        // Axis indicator type changes
        if (this.axisIndicatorSelect) {
            this.axisIndicatorSelect.addEventListener('change', () => {
                this.toggleEmbeddedSettings(this.axisIndicatorSelect.value);
            });
        }
        
        // Fill wireframe changes
        if (this.fillWireframe) {
            this.fillWireframe.addEventListener('change', () => {
                this.toggleSecondaryColorVisibility(this.fillWireframe.checked);
            });
        }
        
        // Setup tabs in settings modal
        const settingsTabs = document.querySelectorAll('.settings-tab-button');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                settingsTabs.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Hide all tab content
                document.querySelectorAll('.settings-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show the selected tab content
                const tabId = tab.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });
        
        // Setup collapsible sections
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
        collapsibleHeaders.forEach(header => {
            header.addEventListener('click', () => {
                // Toggle expanded class
                header.classList.toggle('expanded');
                
                // Update the collapse indicator with proper symbol
                const indicator = header.querySelector('.collapse-indicator');
                if (header.classList.contains('expanded')) {
                    indicator.textContent = '▼'; // Down arrow when expanded
                } else {
                    indicator.textContent = '▶'; // Right arrow when collapsed
                }
                
                // Toggle the visibility of the next sibling (collapsible content)
                const content = header.closest('.settings-row').nextElementSibling;
                if (content && content.classList.contains('collapsible-content')) {
                    content.style.display = header.classList.contains('expanded') ? 'block' : 'none';
                }
            });
        });
    }
    
    /**
     * Open the settings modal
     */
    openModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
        }
    }
    
    /**
     * Close the settings modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }
    
    /**
     * Save settings from form values
     */
    saveSettings() {
        // Get values from axis indicator settings
        const axisIndicatorType = this.axisIndicatorSelect ? this.axisIndicatorSelect.value : 'disabled';
        const axisIntensity = this.intensitySlider ? parseFloat(this.intensitySlider.value) : 0.7;
        
        // Get values from rig options settings
        const displayRig = this.displayRig ? this.displayRig.checked : false;
        const forceZ = this.forceZ ? this.forceZ.checked : false;
        const fillWireframe = this.fillWireframe ? this.fillWireframe.checked : false;
        const primaryColor = this.primaryColor ? this.primaryColor.value : '#FF00FF';
        const secondaryColor = this.secondaryColor ? this.secondaryColor.value : '#FFFF00';
        const jointColor = this.jointColor ? this.jointColor.value : '#00FFFF';
        const showJointLabels = this.showJointLabels ? this.showJointLabels.checked : false;
        
        // Get control handle colors
        const normalColor = this.normalColor ? this.normalColor.value : '#FF0000';
        const hoverColor = this.hoverColor ? this.hoverColor.value : '#00FF00';
        const activeColor = this.activeColor ? this.activeColor.value : '#0000FF';
        
        // Store settings
        const settings = {
            axisIndicator: {
                type: axisIndicatorType,
                intensity: axisIntensity
            },
            rigOptions: {
                displayRig: displayRig,
                forceZ: forceZ,
                wireframe: !fillWireframe, // Invert logic - wireframe is opposite of fill
                primaryColor: parseInt(primaryColor.replace('#', '0x'), 16),
                secondaryColor: parseInt(secondaryColor.replace('#', '0x'), 16),
                jointColor: parseInt(jointColor.replace('#', '0x'), 16),
                showJointLabels: showJointLabels,
                normalColor: parseInt(normalColor.replace('#', '0x'), 16),
                hoverColor: parseInt(hoverColor.replace('#', '0x'), 16),
                activeColor: parseInt(activeColor.replace('#', '0x'), 16)
            }
        };
        
        // Store settings using the utility function
        saveSettings(settings);
        
        // Update rig options directly
        updateRigOptions(settings.rigOptions);
        
        // Apply settings immediately
        this.applyAxisIndicatorSetting(axisIndicatorType, axisIntensity);
        this.applyRigOptionsSetting(settings.rigOptions);
        
        // Close the modal
        this.closeModal();
        
        // Notify that settings were saved
        console.log('Settings saved:', settings);
    }
    
    /**
     * Apply axis indicator settings
     * @param {string} type - The axis indicator type
     * @param {number} intensity - The intensity value (0-1)
     */
    applyAxisIndicatorSetting(type, intensity = 0.7) {
        // Trigger event to notify application of setting change
        const event = new CustomEvent('axisIndicatorModeChange', {
            detail: { 
                mode: type,
                intensity: intensity
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Apply rig options settings
     * @param {Object} options - The rig options to apply
     */
    applyRigOptionsSetting(options) {
        // Trigger event to notify application of setting change
        const event = new CustomEvent('rigOptionsChange', {
            detail: options
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Toggle secondary color visibility based on fill wireframe option
     * @param {boolean} show - Whether to show the secondary color option
     */
    toggleSecondaryColorVisibility(show) {
        if (this.secondaryColorOption) {
            this.secondaryColorOption.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Toggle embedded settings visibility
     * @param {string} type - The axis indicator type
     */
    toggleEmbeddedSettings(type) {
        if (this.embeddedSettings) {
            this.embeddedSettings.style.display = type === 'embedded' ? 'block' : 'none';
        }
    }
    
    /**
     * Initialize rig options with default values
     */
    initializeRigOptions() {
        const defaults = getDefaultSettings().rigOptions;
        
        // Set default values
        if (this.displayRig) this.displayRig.checked = defaults.displayRig;
        if (this.forceZ) this.forceZ.checked = defaults.forceZ;
        if (this.fillWireframe) this.fillWireframe.checked = !defaults.wireframe;
        if (this.primaryColor) this.primaryColor.value = '#' + defaults.primaryColor.toString(16).padStart(6, '0');
        if (this.secondaryColor) this.secondaryColor.value = '#' + defaults.secondaryColor.toString(16).padStart(6, '0');
        if (this.jointColor) this.jointColor.value = '#' + defaults.jointColor.toString(16).padStart(6, '0');
        if (this.showJointLabels) this.showJointLabels.checked = defaults.showJointLabels;
        if (this.normalColor) this.normalColor.value = '#' + defaults.normalColor.toString(16).padStart(6, '0');
        if (this.hoverColor) this.hoverColor.value = '#' + defaults.hoverColor.toString(16).padStart(6, '0');
        if (this.activeColor) this.activeColor.value = '#' + defaults.activeColor.toString(16).padStart(6, '0');
        
        // Hide secondary color option initially
        this.toggleSecondaryColorVisibility(!defaults.wireframe);
    }
    
    /**
     * Apply provided settings to the UI
     * @param {Object} settings - Settings object to apply
     */
    applySettings(settings) {
        // Apply axis indicator settings if available
        if (settings.axisIndicator && settings.axisIndicator.type) {
            // Update the dropdown to match saved setting
            if (this.axisIndicatorSelect) {
                this.axisIndicatorSelect.value = settings.axisIndicator.type;
            }
            
            // Update intensity slider if available
            if (settings.axisIndicator.intensity !== undefined && this.intensitySlider && this.intensityValue) {
                this.intensitySlider.value = settings.axisIndicator.intensity;
                this.intensityValue.textContent = settings.axisIndicator.intensity;
            }
            
            // Apply the setting
            this.applyAxisIndicatorSetting(
                settings.axisIndicator.type, 
                settings.axisIndicator.intensity || 0.7
            );
            
            // Show/hide embedded settings based on selection
            this.toggleEmbeddedSettings(settings.axisIndicator.type);
        }
        
        // Apply rig options settings if available
        if (settings.rigOptions) {
            // Update rig options using the dedicated function
            updateRigOptions(settings.rigOptions);
            
            // Update the form values
            if (this.displayRig && settings.rigOptions.displayRig !== undefined) {
                this.displayRig.checked = settings.rigOptions.displayRig;
            }
            
            if (this.forceZ && settings.rigOptions.forceZ !== undefined) {
                this.forceZ.checked = settings.rigOptions.forceZ;
            }
            
            if (this.fillWireframe && settings.rigOptions.wireframe !== undefined) {
                this.fillWireframe.checked = !settings.rigOptions.wireframe; // Invert logic
                this.toggleSecondaryColorVisibility(!settings.rigOptions.wireframe);
            }
            
            if (this.primaryColor && settings.rigOptions.primaryColor !== undefined) {
                this.primaryColor.value = '#' + settings.rigOptions.primaryColor.toString(16).padStart(6, '0');
            }
            
            if (this.secondaryColor && settings.rigOptions.secondaryColor !== undefined) {
                this.secondaryColor.value = '#' + settings.rigOptions.secondaryColor.toString(16).padStart(6, '0');
            }
            
            if (this.jointColor && settings.rigOptions.jointColor !== undefined) {
                this.jointColor.value = '#' + settings.rigOptions.jointColor.toString(16).padStart(6, '0');
            }
            
            if (this.showJointLabels && settings.rigOptions.showJointLabels !== undefined) {
                this.showJointLabels.checked = settings.rigOptions.showJointLabels;
            }
            
            // Set control handle colors if available
            if (this.normalColor && settings.rigOptions.normalColor !== undefined) {
                this.normalColor.value = '#' + settings.rigOptions.normalColor.toString(16).padStart(6, '0');
            }
            
            if (this.hoverColor && settings.rigOptions.hoverColor !== undefined) {
                this.hoverColor.value = '#' + settings.rigOptions.hoverColor.toString(16).padStart(6, '0');
            }
            
            if (this.activeColor && settings.rigOptions.activeColor !== undefined) {
                this.activeColor.value = '#' + settings.rigOptions.activeColor.toString(16).padStart(6, '0');
            }
            
            // Still trigger the event for other components that listen for changes
            this.applyRigOptionsSetting(settings.rigOptions);
        } else {
            // Set default values for rig options
            this.initializeRigOptions();
        }
    }
} 