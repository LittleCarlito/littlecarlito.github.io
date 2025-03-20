import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
	gracefulShutdownPlugin, 
	createEmptyModuleStubs, 
	createEvalWarningHandler,
	timestampPlugin
} from '../../scripts/vite-plugins.js';
import baseConfig from '../../vite.config.base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, 'dist/index.js');

// Problematic files in Three.js that we want to exclude
const EXCLUDED_FILES = [
	'node_modules/three/examples/jsm/libs/lottie_canvas.module.js',
	'node_modules/three/examples/jsm/libs/chevrotain.module.min.js'
];

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
			},
			onwarn: createEvalWarningHandler()
		}
	},
	server: {
		open: '/index.html',
		port: 3001,
		strictPort: true
	},
	plugins: [
		// Add empty module stubs for problematic files
		createEmptyModuleStubs(),
    
		// Add graceful shutdown handling
		gracefulShutdownPlugin(),
    
		// Add the timestamp plugin
		timestampPlugin(outputPath)
	]
}); 