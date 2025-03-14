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
            const resourceSrc = path.resolve(__dirname, 'resources');
            const resourceDest = path.resolve(__dirname, 'dist/resources');
            console.log(`Copying resources from ${resourceSrc} to ${resourceDest}`);
            copyDirectory(resourceSrc, resourceDest);
            
            // Also copy any other static assets needed
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