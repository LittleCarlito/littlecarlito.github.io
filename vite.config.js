import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

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
      sourcemap: true,
      chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
    },
    // Custom copy function for resources
    plugins: [
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