// Import Three.js and Rapier from blorkpack package
import { THREE, RAPIER, loadThree, loadRapier, updateTween, Easing, Tween } from 'blorkpack';

// Re-export Three.js and Rapier for existing code
// IMPORTANT: For consistency in this project:
// - Import THREE, RAPIER, loadThree, loadRapier, updateTween, Easing, and Tween from './common'
// - Import asset-related functionality (AssetStorage, AssetSpawner, etc.) directly from 'blorkpack'
export { THREE, Easing, Tween, updateTween, RAPIER, loadThree, loadRapier };

// Re-export other common utilities
export * from './flags'
export * from './app_renderer'
export * from './types'

// Asset management is now a separate package - Import these directly from 'blorkpack'
// Examples: AssetStorage, AssetSpawner, AssetActivator, ASSET_TYPE, ASSET_CONFIGS
