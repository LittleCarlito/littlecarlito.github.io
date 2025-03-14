import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// Helper function to get HTML files in tools directory
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

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';
  
  return {
    base: command === 'serve' ? '' : '/threejs_site/',
    resolve: {
      alias: {
        '@littlecarlito/blorkpack': path.resolve(__dirname, 'packages/blorkpack/dist')
      }
    },
    optimizeDeps: {
      include: ['@littlecarlito/blorkpack']
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
            'three-addons': [
              'three/examples/jsm/controls/OrbitControls',
              'three/examples/jsm/Addons.js',
              'three/examples/jsm/libs/tween.module.js'
            ],
            'physics': ['@dimforge/rapier3d-compat']
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
    // Server configuration for development
    server: {
      hmr: {
        overlay: true, // Show errors as overlay
        timeout: 10000, // Extended timeout for larger modules
      },
      watch: {
        usePolling: true, // Enable polling for file changes
        interval: 1000, // Check every second
        ignored: ['!**/node_modules/@littlecarlito/blorkpack/**', '**/node_modules/**'],
      }
    },
    // Custom copy function for resources
    plugins: [
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
    ]
  };
}) 