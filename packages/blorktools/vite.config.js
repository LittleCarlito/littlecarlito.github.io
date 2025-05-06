import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { gracefulShutdownPlugin } from '../../scripts/vite-plugins.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper function to find all HTML files in src directory
/**
 *
 */
function findHtmlEntries() {
	const srcDir = path.resolve(__dirname, 'src');
	const entries = {};

	/**
	 *
	 */
	function scanDirectory(dir) {
		if (!fs.existsSync(dir)) return;
		const files = fs.readdirSync(dir, { withFileTypes: true });
		for (const file of files) {
			const fullPath = path.join(dir, file.name);
			if (file.isDirectory()) {
				scanDirectory(fullPath);
			} else if (file.name.endsWith('.html')) {
				const relativePath = path.relative(srcDir, fullPath);
				const entryName = relativePath.replace(/\.html$/, '');
				entries[entryName] = fullPath;
			}
		}
	}

	scanDirectory(srcDir);
	return entries;
}

export default defineConfig({
	// Set the root directory to the source files for development
	root: path.resolve(__dirname, 'src'),
	// For production build, configure as a library
	build: {
		lib: {
			entry: path.resolve(__dirname, 'src/index.js'),
			name: 'blorktools',
			fileName: 'index'
		},
		outDir: path.resolve(__dirname, 'dist'),
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: ['three', 'jszip'],
			output: {
				globals: {
					three: 'THREE',
					jszip: 'JSZip'
				}
			}
		}
	},
	server: {
		open: '/index.html',
		port: 3001,
		strictPort: true,
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..', '../..'],
		}
	},
	plugins: [
		gracefulShutdownPlugin()
	],
	// Better handling of dynamic imports and externals
	optimizeDeps: {
		exclude: ['jszip'], // Let the dynamic import handle this
		esbuildOptions: {
			// Define global names for externalized dependencies
			define: {
				global: 'globalThis',
			}
		}
	},
	// Handle CDN fallbacks in development
	resolve: {
		alias: {
			// If needed, define aliases here
		}
	}
}); 