import { THREE } from '.';
import { FLAGS } from './flags';
/**
 *
 */
export class TextureAtlasManager {
	static instance = null;
	/**
	 *
	 */
	constructor() {
		if (TextureAtlasManager.instance) return TextureAtlasManager.instance;
		this.atlases = new Map(); // Map of atlas textures by type (diffuse, normal, etc)
		this.textureMap = new Map(); // Maps original textures to their atlas coordinates
		this.maxAtlasSize = 4096; // Maximum atlas size (adjust based on GPU capabilities)
		this.padding = 2; // Pixels of padding between textures
		TextureAtlasManager.instance = this;
	}
	/**
	 *
	 */
	static getInstance() {
		if (!TextureAtlasManager.instance) {
			TextureAtlasManager.instance = new TextureAtlasManager();
		}
		return TextureAtlasManager.instance;
	}
	/**
	 *
	 */
	async createAtlas(textures, type = 'diffuse') {
		if (FLAGS.TEXTURE_LOGS) console.log(`Creating ${type} atlas with ${textures.length} textures`);
		// Sort textures by size for better packing
		const sortedTextures = [...textures].sort((a, b) => {
			const aSize = a.image ? (a.image.width * a.image.height) : 0;
			const bSize = b.image ? (b.image.width * b.image.height) : 0;
			return bSize - aSize;
		});
		// Create canvas for the atlas
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		// First pass: calculate required atlas size
		let currentX = 0;
		let currentY = 0;
		let rowHeight = 0;
		let atlasWidth = 0;
		let atlasHeight = 0;
		for (const texture of sortedTextures) {
			if (!texture.image) continue;
			const width = texture.image.width + this.padding * 2;
			const height = texture.image.height + this.padding * 2;
			if (currentX + width > this.maxAtlasSize) {
				currentX = 0;
				currentY += rowHeight;
				rowHeight = 0;
			}
			rowHeight = Math.max(rowHeight, height);
			atlasWidth = Math.max(atlasWidth, currentX + width);
			atlasHeight = Math.max(atlasHeight, currentY + height);
			currentX += width;
		}
		// Ensure power of two dimensions
		canvas.width = THREE.MathUtils.ceilPowerOfTwo(atlasWidth);
		canvas.height = THREE.MathUtils.ceilPowerOfTwo(atlasHeight);
		if (FLAGS.TEXTURE_LOGS) {
			console.log(`Atlas dimensions: ${canvas.width}x${canvas.height}`);
		}
		// Second pass: draw textures and store UV coordinates
		currentX = 0;
		currentY = 0;
		rowHeight = 0;
		for (const texture of sortedTextures) {
			if (!texture.image) continue;
			const width = texture.image.width;
			const height = texture.image.height;
			if (currentX + width + this.padding * 2 > this.maxAtlasSize) {
				currentX = 0;
				currentY += rowHeight;
				rowHeight = 0;
			}
			// Draw texture to atlas with padding
			ctx.drawImage(
				texture.image,
				currentX + this.padding,
				currentY + this.padding,
				width,
				height
			);
			// Store UV coordinates
			const uvs = {
				x: (currentX + this.padding) / canvas.width,
				y: (currentY + this.padding) / canvas.height,
				width: width / canvas.width,
				height: height / canvas.height
			};
			this.textureMap.set(texture.uuid, uvs);
			rowHeight = Math.max(rowHeight, height + this.padding * 2);
			currentX += width + this.padding * 2;
		}
		// Create Three.js texture from atlas
		const atlasTexture = new THREE.CanvasTexture(canvas);
		atlasTexture.flipY = false;
		this.atlases.set(type, atlasTexture);
		return atlasTexture;
	}
	/**
	 *
	 */
	getTextureUVs(texture) {
		return this.textureMap.get(texture.uuid);
	}
	/**
	 *
	 */
	updateMaterialWithAtlas(material, atlasTexture, originalTexture) {
		const uvs = this.getTextureUVs(originalTexture);
		if (!uvs) return;
		// Safety check - if no material provided, return
		if (!material) return;
		// Create new UV coordinates for the mesh
		if (!material.isMesh) {
			if (FLAGS.TEXTURE_LOGS) console.warn('updateMaterialWithAtlas called with non-mesh object');
			return;
		}
		const geometry = material.geometry;
		if (!geometry || !geometry.attributes || !geometry.attributes.uv) {
			if (FLAGS.TEXTURE_LOGS) console.warn('Mesh has no geometry or UV attributes');
			return;
		}
		const originalUVs = geometry.attributes.uv.array;
		const newUVs = new Float32Array(originalUVs.length);
		for (let i = 0; i < originalUVs.length; i += 2) {
			newUVs[i] = originalUVs[i] * uvs.width + uvs.x;
			newUVs[i + 1] = originalUVs[i + 1] * uvs.height + uvs.y;
		}
		geometry.attributes.uv.array = newUVs;
		geometry.attributes.uv.needsUpdate = true;
		// Update material to use atlas texture
		if (material.material) {
			material.material.map = atlasTexture;
			material.material.needsUpdate = true;
		}
	}
	/**
	 *
	 */
	dispose() {
		for (const atlas of this.atlases.values()) {
			atlas.dispose();
		}
		this.atlases.clear();
		this.textureMap.clear();
	}
} 