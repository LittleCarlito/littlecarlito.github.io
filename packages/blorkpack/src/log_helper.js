export class LogHelper {
    static #instance = null;

    constructor() {
        if (LogHelper.#instance) {
            return LogHelper.#instance;
        }
        LogHelper.#instance = this;
    }

    static getInstance() {
        if (!LogHelper.#instance) {
            LogHelper.#instance = new LogHelper();
        }
        return LogHelper.#instance;
    }

    logVector3(vector3, name = 'Vector3') {
        if (!vector3) return 'null';
        if (typeof vector3.x !== 'undefined' && typeof vector3.y !== 'undefined' && typeof vector3.z !== 'undefined') {
            return `${name}: (${vector3.x.toFixed(3)}, ${vector3.y.toFixed(3)}, ${vector3.z.toFixed(3)})`;
        }
        return `${name}: invalid vector`;
    }

    logObjectPosition(object, name = 'Object') {
        if (!object) return `${name}: null`;
        
        const result = {
            name: object.name || 'unnamed',
            localPosition: this.extractVector3(object.position),
        };

        if (object.getWorldPosition && typeof object.getWorldPosition === 'function') {
            try {
                const worldPos = { x: 0, y: 0, z: 0 };
                object.getWorldPosition(worldPos);
                result.worldPosition = this.extractVector3(worldPos);
            } catch (e) {
                result.worldPosition = 'error getting world position';
            }
        }

        return result;
    }

    logIntersection(intersection, index = 0) {
        if (!intersection) return `Intersection ${index}: null`;
        
        return {
            index,
            objectName: intersection.object?.name || 'unnamed',
            point: this.extractVector3(intersection.point),
            distance: intersection.distance?.toFixed(3) || 'unknown'
        };
    }

    extractVector3(vector) {
        if (!vector) return 'null';
        if (typeof vector.x !== 'undefined' && typeof vector.y !== 'undefined' && typeof vector.z !== 'undefined') {
            return {
                x: parseFloat(vector.x.toFixed(3)),
                y: parseFloat(vector.y.toFixed(3)),
                z: parseFloat(vector.z.toFixed(3))
            };
        }
        return 'invalid vector';
    }

    logMouseEvent(event, context = '') {
        return {
            context,
            button: event.button,
            clientX: event.clientX,
            clientY: event.clientY,
            timestamp: Date.now()
        };
    }

    logDragUpdate(dragTarget, localPosition, worldPosition, oldPosition) {
        return {
            objectName: dragTarget?.name || 'unnamed',
            localPosition: this.extractVector3(localPosition),
            worldPosition: this.extractVector3(worldPosition),
            oldPosition: this.extractVector3(oldPosition),
            positionChanged: this.hasPositionChanged(oldPosition, localPosition)
        };
    }

    hasPositionChanged(pos1, pos2, threshold = 0.001) {
        if (!pos1 || !pos2) return true;
        
        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        const dz = Math.abs(pos1.z - pos2.z);
        
        return dx > threshold || dy > threshold || dz > threshold;
    }

    logAssetGrab(asset, intersection, mouseEvent) {
        const assetInfo = this.logObjectPosition(asset, 'Asset');
        const intersectionInfo = this.logIntersection(intersection);
        const mouseInfo = this.logMouseEvent(mouseEvent, 'grab');
        
        return {
            action: 'asset_grab_start',
            asset: assetInfo,
            intersection: intersectionInfo,
            mouse: mouseInfo
        };
    }

    logAssetRelease(asset) {
        return {
            action: 'asset_grab_end',
            asset: this.logObjectPosition(asset, 'Released Asset')
        };
    }

    log(prefix, data) {
        console.log(`[${prefix}]`, data);
    }

    warn(prefix, message) {
        console.warn(`[${prefix}] ${message}`);
    }

    error(prefix, message, error = null) {
        console.error(`[${prefix}] ${message}`, error || '');
    }
}