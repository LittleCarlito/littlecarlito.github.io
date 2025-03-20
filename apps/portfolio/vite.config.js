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
		console.error(`Error reading tools directory: ${error.message}`)
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
			console.error(`Failed to create destination directory: ${error.message}`);
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
					// Reduce verbosity - only log directory copying, not each file
				} catch (error) {
					console.error(`Failed to copy file ${path.basename(srcPath)}: ${error.message}`);
				}
			}
		}
	} catch (error) {
		console.error(`Error reading directory: ${error.message}`);
	}
}

export default defineConfig(({ command }) => {
	const isProduction = command === 'build'
	console.log(`Starting ${isProduction ? 'production' : 'development'} build...`)
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
						// Can't include 'three' in manualChunks when it's set as external
						// 'three-core': ['three'],
						'three-addons': [
							'three/examples/jsm/controls/OrbitControls',
							'three/examples/jsm/Addons.js'
						]
						// Removing three-tween as it's generating an empty chunk
						// 'three-tween': ['three/examples/jsm/libs/tween.module.js']
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
					// Only log critical warnings, skip eval warnings from three.js libs
					if (warning.code === 'EVAL' && warning.id.includes('node_modules/three')) {
						return;
					}
					console.warn(`Build warning: ${warning.message}`);
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
			watch: false, // Explicitly set to false instead of null
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
			// Error logger plugin to capture build failures
			{
				name: 'build-error-logger',
				buildStart() {
					console.log('🚀 Starting build process...');
				},
				buildEnd(error) {
					if (error) {
						console.error('⛔ BUILD ERROR ⛔');
						console.error(`Error: ${error.message}`);
						if (error.stack) {
							console.error(`Stack: ${error.stack.split('\n')[0]}`);
						}
						if (error.loc) {
							console.error(`Location: ${error.loc.file}:${error.loc.line}:${error.loc.column}`);
						}
						console.error('⛔ END BUILD ERROR ⛔');
					}
				},
				renderError(error) {
					console.error('⛔ RENDER ERROR ⛔');
					console.error(`Error: ${error.message}`);
					if (error.frame) {
						console.error(`Context: ${error.frame}`);
					}
					if (error.id) {
						console.error(`File: ${error.id}`);
					}
					console.error('⛔ END RENDER ERROR ⛔');
					return null;
				},
				closeBundle() {
					// This only runs on successful builds
					console.log('✅ Build bundle completed successfully');
				},
			},
			// Debug plugin to catch and log transform errors
			{
				name: 'transform-error-catcher',
				transform(code, id) {
					// Return null to let Vite handle the transformation
					return null;
				},
				transformIndexHtml: {
					enforce: 'pre',
					transform(html, ctx) {
						// Check if the entry point file exists and is accessible
						if (ctx.path === '/index.html') {
							try {
								const entryPoint = path.resolve(__dirname, 'index.html');
								if (!fs.existsSync(entryPoint)) {
									console.error(`⛔ ERROR: Entry point file ${entryPoint} does not exist`);
								}
							} catch (error) {
								console.error(`⛔ ERROR checking entry point: ${error.message}`);
							}
						}
						return html;
					}
				}
			},
			// Add a general error handler
			{
				name: 'general-error-handler',
				configResolved(config) {
					// Add this to intercept and log unhandled promise rejections
					process.on('unhandledRejection', (reason, promise) => {
						console.error('⚠️ Unhandled Rejection during build:');
						console.error(reason);
					});

					// Also handle uncaught exceptions
					process.on('uncaughtException', (error) => {
						console.error('⚠️ Uncaught Exception during build:');
						console.error(error);
					});
				},
				options(options) {
					// Add a Rollup plugin that hooks into all phases for error detection
					options.plugins.push({
						name: 'rollup-error-detector',
						buildStart() {
							// This runs when the bundle starts building
							console.log('📦 Rollup build started');
						},
						moduleParsed(moduleInfo) {
							// Check for syntax errors in modules
							if (moduleInfo.isEntry) {
								console.log(`✓ Parsed entry module: ${path.basename(moduleInfo.id)}`);
							}
						},
						buildEnd(error) {
							if (error) {
								console.error('⛔ ROLLUP BUILD ERROR ⛔');
								console.error(error);
							}
						}
					});
					return options;
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
						console.log('🔄 Copying static resources...');
						try {
							// Copy manifest from public/resources to dist/resources
							const manifestSrc = path.resolve(__dirname, 'public/resources/manifest.json');
							const manifestDest = path.resolve(__dirname, 'dist/resources/manifest.json');
							if (fs.existsSync(manifestSrc)) {
								// Create resources directory if it doesn't exist
								const resourcesDir = path.resolve(__dirname, 'dist/resources');
								if (!fs.existsSync(resourcesDir)) {
									fs.mkdirSync(resourcesDir, { recursive: true });
								}
								fs.copyFileSync(manifestSrc, manifestDest);
							} else {
								console.warn('⚠️ No manifest.json found in public/resources directory');
							}
							// Copy other static assets needed
							const pagesSrc = path.resolve(__dirname, 'public/pages');
							const pagesDest = path.resolve(__dirname, 'dist/pages');
							copyDirectory(pagesSrc, pagesDest);
							console.log('✅ Static resources copied successfully');
						} catch (error) {
							console.error('❌ Error copying resources:', error.message);
							throw error;
						}
					}
					// Explicitly return a resolved promise to ensure the hook completes
					return Promise.resolve();
				}
			},
			// Add a plugin to handle process termination
			{
				name: 'process-terminator',
				closeBundle() {
					// Force process to exit after build completes
					setTimeout(() => {
						process.exit(0);
					}, 100);
				}
			}
		].filter(Boolean)
	};
}) 