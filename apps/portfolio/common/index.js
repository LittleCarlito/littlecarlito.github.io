// Import Three.js and Rapier from blorkpack package
import { THREE, RAPIER, load_three, updateTween, Easing, Tween, AppRenderer, initRapier } from '@littlecarlito/blorkpack';

// Re-export Three.js and Rapier for existing code
// IMPORTANT: For consistency in this project:
// - Import THREE, RAPIER, load_three, initRapier, updateTween, Easing, and Tween from './common'
// - Import asset-related functionality (AssetStorage, AssetSpawner, etc.) directly from '@littlecarlito/blorkpack'
export { THREE, Easing, Tween, updateTween, RAPIER, load_three, initRapier, AppRenderer };

// Re-export other common utilities
export * from './flags'
export * from './types'

// Asset management is now a separate package - Import these directly from '@littlecarlito/blorkpack'
// Examples: AssetStorage, AssetSpawner, AssetActivator, ASSET_TYPE, ASSET_CONFIGS
