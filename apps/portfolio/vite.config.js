import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { 
	gracefulShutdownPlugin, 
	timestampPlugin,
	createVirtualBlorkpackPlugin
} from '../../scripts/vite-plugins.js'
import baseConfig from '../../vite.config.base.js'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.resolve(__dirname, 'dist/index.js')

// Helper function to get entry points for tools HTML files
function getToolsEntryPoints() {
	const toolsDir = path.resolve(__dirname, 'tools')
	const entryPoints = {}
	try {
		const files = fs.readdirSync(toolsDir)
		files.forEach(file => {
			if (file.endsWith('.html')) {
				const name = path.basename(file, '.html')
				entryPoints[name] = path.resolve(toolsDir, file)
			}
		})
	} catch (error) {
		console.error(`Error reading directory ${toolsDir}:`, error)
	}
	return entryPoints
}

// Helper function to copy directory contents to the dist folder
/**
 *
 */
function copyDirectory(src, dest) {
	if (!fs.existsSync(src)) {
		console.warn(`Source directory ${src} doesn't exist`);
		return;
	}
	if (!fs.existsSync(dest)) {
		try {
			fs.mkdirSync(dest, { recursive: true });
		} catch (error) {
			console.error(`Failed to create destination directory ${dest}:`, error);
			return;
		}
	}
	try {
		const entries = fs.readdirSync(src, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);
			if (entry.isDirectory()) {
				copyDirectory(srcPath, destPath);
			} else {
				try {
					fs.copyFileSync(srcPath, destPath);
					console.log(`Copied ${srcPath} to ${destPath}`);
				} catch (error) {
					console.error(`Failed to copy file ${srcPath} to ${destPath}:`, error);
				}
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${src}:`, error);
	}
}

export default defineConfig(({ command }) => {
	const isProduction = command === 'build'
	console.log('Starting build configuration...')
	// Skip optimization for blorkpack entirely
	const optimizeDepsConfig = {}
	return {
		base: isProduction ? '/threejs_site/' : '/',
		optimizeDeps: optimizeDepsConfig,
		resolve: {
			// Let the virtual module plugin handle resolution
			alias: {
				'@littlecarlito/blorkpack': '@littlecarlito/blorkpack'
			}
		},
		build: {
			outDir: 'dist',
			assetsDir: 'assets',
			emptyOutDir: true,
			minify: isProduction ? 'terser' : false,
			terserOptions: isProduction ? {
				compress: {
					drop_console: false,
					drop_debugger: true
				},
				format: {
					comments: false
				}
			} : undefined,
			rollupOptions: {
				output: {
					manualChunks: {
						'three-core': ['three'],
						'three-addons': [
							'three/examples/jsm/controls/OrbitControls',
							'three/examples/jsm/Addons.js'
						],
						'three-tween': ['three/examples/jsm/libs/tween.module.js']
					},
					globals: {
						'three': 'THREE'
					},
					format: 'es',
					entryFileNames: '[name].js',
					chunkFileNames: '[name].js',
					assetFileNames: '[name].[ext]'
				},
				external: ['three'],
				input: {
					main: 'index.html',
					...(isProduction ? {} : { 
						packageTest: 'tests/package-test.html',
						// Include tools HTML files only in development mode
						...(!isProduction ? getToolsEntryPoints() : {})
					})
				},
				onwarn(warning, warn) {
					// Log warnings but don't fail the build
					console.warn('Rollup warning:', warning);
					warn(warning);
				}
			},
			sourcemap: !isProduction, // Only generate source maps in development
			chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
			reportCompressedSize: false, // Disable compressed size reporting for better performance
			target: 'esnext', // Use modern JavaScript features
			modulePreload: false, // Disable module preload to avoid potential issues
			cssCodeSplit: true, // Enable CSS code splitting
			write: true, // Ensure files are written to disk
			watch: null, // Disable watch mode during build
			commonjsOptions: {
				include: [/node_modules/],
				transformMixedEsModules: true,
				requireReturnsDefault: 'auto'
			}
		},
		server: {
			hmr: {
				overlay: true,
			},
			port: 3000,
			strictPort: true,
			// Let Turbo handle browser opening
			open: false
		},
		plugins: [
			// Always use the plugin that properly handles the module state
			createVirtualBlorkpackPlugin(),
			// Add graceful shutdown handling
			gracefulShutdownPlugin(),
			// Handle HTML transformations
			{
				name: 'blorkpack-hmr-helper',
				transformIndexHtml(html) {
					// Add a small helper to handle live reload more gracefully
					return html.replace('</head>', `
            <script>
              window.__BLORKPACK_ERROR_HANDLER = (error) => {
                // If the error is from blorkpack, let the page naturally reload
                if (error && error.message && error.message.includes('blorkpack')) {
                  console.log('Blorkpack module error detected, HMR will handle it');
                }
              };
              
              window.addEventListener('error', (e) => window.__BLORKPACK_ERROR_HANDLER(e.error));
              window.addEventListener('unhandledrejection', (e) => window.__BLORKPACK_ERROR_HANDLER(e.reason));
            </script>
          </head>`);
				}
			},
			// Only use image optimizer in production
			isProduction && ViteImageOptimizer({
				// Image optimization options
				png: {
					quality: 80,
				},
				jpeg: {
					quality: 80,
				},
				jpg: {
					quality: 80,
				},
				webp: {
					lossless: true,
				},
				avif: {
					lossless: true,
				},
				gif: {
					optimizationLevel: 3,
				},
				svg: {
					multipass: true,
					plugins: [
						{
							name: 'preset-default',
							params: {
								overrides: {
									removeViewBox: false,
								},
							},
						},
					],
				},
			}),
			{
				name: 'copy-resources',
				closeBundle() {
					if (isProduction) {
						console.log('Starting closeBundle hook...');
						try {
							// Copy manifest from public/resources to dist/resources
							const manifestSrc = path.resolve(__dirname, 'public/resources/manifest.json');
							const manifestDest = path.resolve(__dirname, 'dist/resources/manifest.json');
							if (fs.existsSync(manifestSrc)) {
								// Create resources directory if it doesn't exist
								const resourcesDir = path.resolve(__dirname, 'dist/resources');
								if (!fs.existsSync(resourcesDir)) {
									console.log(`Creating resources directory: ${resourcesDir}`);
									fs.mkdirSync(resourcesDir, { recursive: true });
								}
								console.log(`Copying manifest from ${manifestSrc} to ${manifestDest}`);
								fs.copyFileSync(manifestSrc, manifestDest);
							} else {
								console.warn('No manifest.json found in public/resources directory');
							}
							// Copy other static assets needed
							const pagesSrc = path.resolve(__dirname, 'public/pages');
							const pagesDest = path.resolve(__dirname, 'dist/pages');
							console.log(`Copying pages from ${pagesSrc} to ${pagesDest}`);
							copyDirectory(pagesSrc, pagesDest);
							console.log('Successfully completed closeBundle hook');
						} catch (error) {
							console.error('Error in closeBundle hook:', error);
							throw error;
						}
					}
				}
			}
		].filter(Boolean)
	};
}) 