export class TextureOptimizer {
	static optimizeForMobile(texture, maxSize = 1024) {
		if (texture.image && (texture.image.width > maxSize || texture.image.height > maxSize)) {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			
			const scale = Math.min(maxSize / texture.image.width, maxSize / texture.image.height);
			canvas.width = texture.image.width * scale;
			canvas.height = texture.image.height * scale;
			
			ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
			texture.image = canvas;
			texture.needsUpdate = true;
		}
		
		texture.generateMipmaps = false;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		
		return texture;
	}
	
	static compressTexture(texture) {
		const renderer = window.app_renderer?.get_renderer();
		if (renderer) {
			const extensions = renderer.extensions;
			if (extensions.get('WEBGL_compressed_texture_s3tc')) {
				texture.format = THREE.CompressedRGBFormat;
			}
		}
		return texture;
	}
}