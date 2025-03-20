import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { gracefulShutdownPlugin } from '../../scripts/vite-plugins.js'

// Helper function to get HTML files in tools directory
/**
 *
 */
function getToolsEntryPoints() {
	const toolsDir = path.resolve(__dirname, 'tools');
	const entries = {};
	// Check if tools directory exists
	if (fs.existsSync(toolsDir)) {
		const files = fs.readdirSync(toolsDir);
		files.forEach(file => {
			if (file.endsWith('.html')) {
				// Create an entry point for each HTML file in tools directory
				const entryName = `tools_${path.basename(file, '.html')}`;
				entries[entryName] = path.resolve(toolsDir, file);
			}
		});
	}
	return entries;
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
		fs.mkdirSync(dest, { recursive: true });
	}
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirectory(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// Plugin to create a virtual module for blorkpack during development
/**
 *
 */
function createVirtualBlorkpackPlugin() {
	const virtualModuleId = '@littlecarlito/blorkpack';
	const resolvedVirtualModuleId = '\0' + virtualModuleId;
	const blorkpackPath = path.resolve(__dirname, '../../packages/blorkpack/dist/index.js');
	const blorkpackDir = path.resolve(__dirname, '../../packages/blorkpack/dist');
	// Simple status tracking - no need for complex verification
	let isUsingRealModule = false;
	let moduleWatcher = null;
	// Check if module exists initially
	try {
		isUsingRealModule = fs.existsSync(blorkpackPath) && fs.statSync(blorkpackPath).size > 0;
	} catch (e) {
		isUsingRealModule = false;
	}
	return {
		name: 'virtual-blorkpack',
		enforce: 'pre',
		resolveId(id) {
			// Handle the main module
			if (id === virtualModuleId) {
				if (isUsingRealModule) {
					return blorkpackPath;
				}
				return resolvedVirtualModuleId;
			}
			// Handle subpaths
			if (id.startsWith(`${virtualModuleId}/`)) {
				const subpath = id.slice(virtualModuleId.length + 1);
				const targetPath = path.join(blorkpackDir, `${subpath}.js`);
				if (isUsingRealModule && fs.existsSync(targetPath)) {
					return targetPath;
				}
				return `${resolvedVirtualModuleId}/${subpath}`;
			}
			return null;
		},
		load(id) {
			// Load virtual module or submodule
			if (id === resolvedVirtualModuleId) {
				console.log('Using virtual blorkpack (stub implementation)');
				return `
          // This is a stub implementation until the real module is built by Turbo
          export const THREE = { 
            Object3D: class Object3D { 
              constructor() { this.children = []; }
              add() {} 
              remove() {}
            },
            Scene: class Scene extends class Object3D { 
              constructor() { this.children = []; }
              add() {} 
              remove() {}
            } {},
            WebGLRenderer: class WebGLRenderer { 
              constructor() {} 
              setSize() {}
              render() {}
            },
            PerspectiveCamera: class PerspectiveCamera {},
            Vector3: class Vector3 {}
          };
          
          export const RAPIER = {};
          export function initThree() { return Promise.resolve(THREE); }
          export function initRapier() { return Promise.resolve(RAPIER); }
          export const Easing = { Linear: { None: (k) => k } };
          export const Tween = { Tween: class Tween {} };
          export function updateTween() {}
          export class AppRenderer { static async init() {} constructor() {} }
          export class AssetStorage { static async init() {} constructor() {} }
          export class AssetActivator { static async init() {} constructor() {} }
          export class AssetSpawner { static async init() {} constructor() {} }
          export const ASSET_TYPE = {};
          export const ASSET_CONFIGS = {};
          export const BLORKPACK_FLAGS = {};
          export const ManifestManager = class ManifestManager {};
        `;
			}
			if (id.startsWith(resolvedVirtualModuleId + '/')) {
				const subpath = id.slice(resolvedVirtualModuleId.length + 1);
				return `
          // Virtual submodule for ${subpath}
          export default {};
          export const ASSET_TYPE = {};
          export const ASSET_CONFIGS = {};
          export const BLORKPACK_FLAGS = {};
        `;
			}
			return null;
		},
		configureServer(server) {
			// Set up a simple watcher to detect when the real module becomes available
			moduleWatcher = fs.watch(path.dirname(blorkpackPath), { persistent: true }, (eventType, filename) => {
				if (filename === 'index.js') {
					try {
						const exists = fs.existsSync(blorkpackPath) && fs.statSync(blorkpackPath).size > 0;
						// If the module has become available and we weren't using it before
						if (exists && !isUsingRealModule) {
							isUsingRealModule = true;
							console.log('✅ Blorkpack module is now available, triggering HMR');
							// Use Vite's module rewrite to trigger HMR for affected modules
							server.moduleGraph.onFileChange(blorkpackPath);
							// Invalidate modules that depend on blorkpack to force reloading
							for (const [key, module] of server.moduleGraph.idToModuleMap) {
								if (key.includes('blorkpack') || 
                    (module.importers && 
                     [...module.importers].some(imp => imp.id && imp.id.includes('blorkpack')))) {
									server.moduleGraph.invalidateModule(module);
								}
							}
							// Trigger full reload only if needed
							server.ws.send({ type: 'full-reload' });
						}
					} catch (e) {
						console.error('Error checking blorkpack module:', e);
					}
				}
			});
			// Clean up watcher on close
			server.httpServer.on('close', () => {
				if (moduleWatcher) moduleWatcher.close();
			});
		}
	};
}

export default defineConfig(({ command }) => {
	const isProduction = command === 'build';
	// Skip optimization for blorkpack entirely
	const optimizeDepsConfig = {
		exclude: ['@littlecarlito/blorkpack']
	};
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
				}
			} : undefined,
			rollupOptions: {
				output: {
					manualChunks: {
						'three-core': ['three'],
						'three-addons': [
							'three/examples/jsm/controls/OrbitControls',
							'three/examples/jsm/Addons.js',
							'three/examples/jsm/libs/tween.module.js'
						]
					},
					globals: {
						'three': 'THREE'
					}
				},
				external: ['three'],
				input: {
					main: 'index.html',
					...(isProduction ? {} : { 
						packageTest: 'tests/package-test.html',
						// Include tools HTML files only in development mode
						...(!isProduction ? getToolsEntryPoints() : {})
					})
				}
			},
			sourcemap: !isProduction, // Only generate source maps in development
			chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
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
						// Copy manifest from public/resources to dist/resources
						const manifestSrc = path.resolve(__dirname, 'public/resources/manifest.json');
						const manifestDest = path.resolve(__dirname, 'dist/resources/manifest.json');
						if (fs.existsSync(manifestSrc)) {
							// Create resources directory if it doesn't exist
							const resourcesDir = path.resolve(__dirname, 'dist/resources');
							if (!fs.existsSync(resourcesDir)) {
								fs.mkdirSync(resourcesDir, { recursive: true });
							}
							console.log(`Copying manifest from ${manifestSrc} to ${manifestDest}`);
							fs.copyFileSync(manifestSrc, manifestDest);
						} else {
							console.warn('No manifest.json found in public/resources directory');
						}
						// Copy other static assets needed
						const pagesSrc = path.resolve(__dirname, 'pages');
						const pagesDest = path.resolve(__dirname, 'dist/pages');
						console.log(`Copying pages from ${pagesSrc} to ${pagesDest}`);
						copyDirectory(pagesSrc, pagesDest);
					}
				}
			}
		].filter(Boolean)
	};
}) 