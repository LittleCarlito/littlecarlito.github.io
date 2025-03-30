import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
	gracefulShutdownPlugin, 
	timestampPlugin,
	createVirtualBlorkpackPlugin
} from '../../scripts/vite-plugins.js';
import baseConfig from '../../vite.config.base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, 'dist/index.js');

export default defineConfig({
	...baseConfig,
	build: {
		...baseConfig.build,
		lib: {
			entry: './src/index.js',
			formats: ['es']
		},
		outDir: 'dist',
		sourcemap: true,
		minify: false,
		rollupOptions: {
			external: ['three'],
			preserveEntrySignatures: 'exports-only',
			output: {
				exports: 'named',
				entryFileNames: '[name].js',
				chunkFileNames: '[name]-[hash].js',
				globals: {
					three: 'THREE'
				}
			}
		}
	},
	server: {
		open: '/index.html',
		port: 3001,
		strictPort: true
	},
	plugins: [
		// Add graceful shutdown handling
		gracefulShutdownPlugin(),
		// Add the timestamp plugin
		timestampPlugin(outputPath),
		// Add the virtual Blorkpack plugin
		createVirtualBlorkpackPlugin()
	]
}); 