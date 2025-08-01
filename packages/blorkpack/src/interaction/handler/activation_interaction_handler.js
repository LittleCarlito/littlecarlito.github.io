const LogLevel = {
    DEBUG: 'debug',
    WARN: 'warn',
    INFO: 'info',
    ERROR: 'error'
};

export class ActivationInteractionHandler {
    static LOG_FLAG = true;
    
    constructor() {
        this.current_hovered_category = null;
        this.window = null;
        this.activated_assets = [];
    }

    initialize(window) {
        this.window = window;
    }

    dispose() {
        this.deactivate_all_assets();
        this.current_hovered_category = null;
        this.window = null;
        this.activated_assets = [];
    }

    handle_category_hover(labelName) {
        const category = this.extract_category_from_label(labelName);
        if (category && category !== this.current_hovered_category) {
            this.deactivate_current_category();
            this.current_hovered_category = category;
            this.log_category_assets(category);
            this.activate_category_assets(category);
        }
    }

    handle_category_hover_exit() {
        this.deactivate_current_category();
        this.current_hovered_category = null;
    }

    activate_category_assets(category) {
        if (!this.window || !this.window.background_container) {
            this.#logString("Background container not available for activation", LogLevel.WARN);
            return;
        }
        
        const categoryAssets = this.window.background_container.getAssetsByCategory(category);
        
        if (categoryAssets.length === 0) {
            this.#logString(`No assets found for category: ${category}`, LogLevel.DEBUG);
            return;
        }

        this.#logString(`Activating ${categoryAssets.length} assets for category: ${category}`, LogLevel.DEBUG);
        
        categoryAssets.forEach((asset) => {
            if (asset.mesh && asset.mesh.userData && asset.mesh.userData.showActivateMesh) {
                asset.mesh.userData.showActivateMesh();
                this.activated_assets.push(asset);
                this.#logString(`Activated mesh: ${asset.mesh.name}`, LogLevel.DEBUG);
            }
        });
    }

    deactivate_current_category() {
        if (this.activated_assets.length === 0) {
            return;
        }

        this.#logString(`Deactivating ${this.activated_assets.length} assets`, LogLevel.DEBUG);
        
        this.activated_assets.forEach((asset) => {
            if (asset.mesh && asset.mesh.userData && asset.mesh.userData.hideActivateMesh) {
                asset.mesh.userData.hideActivateMesh();
                this.#logString(`Deactivated mesh: ${asset.mesh.name}`, LogLevel.DEBUG);
            }
        });
        
        this.activated_assets = [];
    }

    deactivate_all_assets() {
        if (!this.window || !this.window.background_container) {
            return;
        }
        
        const allCategories = this.window.background_container.getAllCategorizedAssets();
        
        Object.keys(allCategories).forEach(category => {
            const categoryAssets = allCategories[category];
            categoryAssets.forEach((asset) => {
                if (asset.mesh && asset.mesh.userData && asset.mesh.userData.hideActivateMesh) {
                    asset.mesh.userData.hideActivateMesh();
                }
            });
        });
        
        this.activated_assets = [];
    }

    log_category_assets(category) {
        if (!this.window || !this.window.background_container) {
            this.#logString("Background container not available", LogLevel.WARN);
            return;
        }
        
        const categoryAssets = this.window.background_container.getAssetsByCategory(category);
        
        if (categoryAssets.length === 0) {
            // this.#logString(`No assets found for category: ${category}`, LogLevel.INFO);
            return;
        }

        // this.#logString(`=== Assets for category: ${category.toUpperCase()} ===`, LogLevel.INFO);
        // categoryAssets.forEach((asset, index) => {
        //     const assetInfo = {
        //         index: index + 1,
        //         name: asset.mesh.name,
        //         position: {
        //             x: asset.mesh.position.x.toFixed(2),
        //             y: asset.mesh.position.y.toFixed(2),
        //             z: asset.mesh.position.z.toFixed(2)
        //         },
        //         hasPhysics: asset.body !== null,
        //         visible: asset.mesh.visible,
        //         hasActivateMesh: asset.mesh.userData && asset.mesh.userData.showActivateMesh !== undefined
        //     };
            // this.#logString(`  ${assetInfo.index}. ${assetInfo.name}`, LogLevel.INFO);
            // this.#logString(`     Position: (${assetInfo.position.x}, ${assetInfo.position.y}, ${assetInfo.position.z})`, LogLevel.INFO);
            // this.#logString(`     Physics: ${assetInfo.hasPhysics ? 'Yes' : 'No'}, Visible: ${assetInfo.visible}, Activate Mesh: ${assetInfo.hasActivateMesh ? 'Yes' : 'No'}`, LogLevel.INFO);
        // });
        // this.#logString(`=== Total: ${categoryAssets.length} assets ===`, LogLevel.INFO);
    }

    extract_category_from_label(labelName) {
        const parts = labelName.split('_');
        if (parts.length >= 2) {
            return parts[1];
        }
        const match = labelName.match(/label_(\w+)/);
        if (match) {
            return match[1];
        }
        return null;
    }

    #logString(incomingString, incomingLevel, forceLog = false) {
        if(ActivationInteractionHandler.LOG_FLAG || forceLog) {
            switch(incomingLevel) {
                case LogLevel.DEBUG:
                    console.debug(incomingString);
                    break;
                case LogLevel.WARN:
                    console.warn(incomingString);
                    break;
                case LogLevel.INFO:
                    console.info(incomingString);
                    break;
                case LogLevel.ERROR:
                    console.error(incomingString);
                    break;
            }
        }
    }
}