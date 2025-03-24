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

// Determine if building for GitHub Pages
const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const base = isGitHubPages ? '/threejs_site/' : '/'

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
		base: base,
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
						'three': ['three'],
						'three-addons': [
							'three/examples/jsm/controls/OrbitControls',
							'three/examples/jsm/Addons.js'
						]
					},
					globals: {
						'three': 'THREE'
					},
					format: 'es',
					entryFileNames: '[name].js',
					chunkFileNames: '[name].[hash].js',
					assetFileNames: '[name].[hash].[ext]'
				},
				external: [],
				input: {
					main: 'index.html',
					...(isProduction ? {} : { 
						packageTest: 'tests/package-test.html'
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
			sourcemap: !isProduction,
			chunkSizeWarningLimit: 1000,
			reportCompressedSize: false,
			target: 'esnext',
			modulePreload: false,
			cssCodeSplit: true,
			write: true,
			watch: false,
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
			port: parseInt(process.env.PORT || '3000', 10),
			strictPort: true,
			open: false
		},
		plugins: [
			createVirtualBlorkpackPlugin(),
			gracefulShutdownPlugin(),
			{
				name: 'blorkpack-hmr-helper',
				transformIndexHtml(html) {
					// First add the error handler script
					let updatedHtml = html.replace('</head>', `
            <script>
              window.__BLORKPACK_ERROR_HANDLER = (error) => {
                if (error && error.message && error.message.includes('blorkpack')) {
                  console.log('Blorkpack module error detected, HMR will handle it');
                }
              };
              
              window.addEventListener('error', (e) => window.__BLORKPACK_ERROR_HANDLER(e.error));
              window.addEventListener('unhandledrejection', (e) => window.__BLORKPACK_ERROR_HANDLER(e.reason));
            </script>
          </head>`);
					
					// Then make sure script paths use the correct base
					if (isGitHubPages) {
						updatedHtml = updatedHtml.replace(
							/<script\s+type="module"\s+src="\.\/([^"]+)"/g, 
							`<script type="module" src="${base}$1"`
						);
					}
					
					return updatedHtml;
				}
			},
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
					console.log('✅ Build bundle completed successfully');
				},
			},
			{
				name: 'general-error-handler',
				configResolved(config) {
					process.on('unhandledRejection', (reason, promise) => {
						console.error('⚠️ Unhandled Rejection during build:');
						console.error(reason);
					});

					process.on('uncaughtException', (error) => {
						console.error('⚠️ Uncaught Exception during build:');
						console.error(error);
					});
				},
				options(options) {
					if (!options.plugins) {
						options.plugins = [];
					}
					options.plugins.push({
						name: 'rollup-error-detector',
						buildStart() {
							console.log('📦 Rollup build started');
						},
						moduleParsed(moduleInfo) {
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
			isProduction && ViteImageOptimizer({
				png: { quality: 80 },
				jpeg: { quality: 80 },
				jpg: { quality: 80 },
				webp: { lossless: true },
				avif: { lossless: true },
				gif: { optimizationLevel: 3 },
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
							const manifestSrc = path.resolve(__dirname, 'public/resources/manifest.json');
							const manifestDest = path.resolve(__dirname, 'dist/resources/manifest.json');
							if (fs.existsSync(manifestSrc)) {
								const resourcesDir = path.resolve(__dirname, 'dist/resources');
								if (!fs.existsSync(resourcesDir)) {
									fs.mkdirSync(resourcesDir, { recursive: true });
								}
								fs.copyFileSync(manifestSrc, manifestDest);
							} else {
								console.warn('⚠️ No manifest.json found in public/resources directory');
							}
							const pagesSrc = path.resolve(__dirname, 'public/pages');
							const pagesDest = path.resolve(__dirname, 'dist/pages');
							copyDirectory(pagesSrc, pagesDest);
							console.log('✅ Static resources copied successfully');
						} catch (error) {
							console.error('❌ Error copying resources:', error.message);
							throw error;
						}
					}
					return Promise.resolve();
				}
			},
			{
				name: 'copy-extra-files',
				closeBundle() {
					console.log('✅ Copying additional files to dist');
					// Copy custom_types.json to the dist root
					try {
						fs.copyFileSync(
							path.resolve(__dirname, 'custom_types.json'),
							path.resolve(__dirname, 'dist/custom_types.json')
						);
						console.log('✓ Copied custom_types.json to dist root');
							
						// Copy .nojekyll file to disable Jekyll processing on GitHub Pages
						fs.writeFileSync(
							path.resolve(__dirname, 'dist/.nojekyll'),
							''
						);
						console.log('✓ Created .nojekyll file in dist root');
					} catch (error) {
						console.error('Failed to copy extra files:', error);
					}
				}
			},
			{
				name: 'process-terminator',
				closeBundle() {
					setTimeout(() => {
						process.exit(0);
					}, 100);
				}
			}
		].filter(Boolean)
	};
}) 