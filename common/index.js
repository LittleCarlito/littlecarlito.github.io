// Import Three.js and Rapier from blorkpack package
import { THREE, RAPIER, load_three, load_rapier, updateTween, Easing, Tween, AppRenderer } from '@littlecarlito/blorkpack';
// Re-export Three.js and Rapier for existing code
// IMPORTANT: For consistency in this project:
// - Import THREE, RAPIER, load_three, load_rapier, updateTween, Easing, and Tween from './common'
// - Import asset-related functionality (AssetStorage, AssetHandler, etc.) directly from '@littlecarlito/blorkpack'
export { THREE, Easing, Tween, updateTween, RAPIER, load_three, load_rapier, AppRenderer };
// Re-export other common utilities
export * from './flags'
export * from './types'
// Asset management is now a separate package - Import these directly from '@littlecarlito/blorkpack'
