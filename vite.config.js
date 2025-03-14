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

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';
  
  return {
    base: command === 'serve' ? '' : '/threejs_site/',
    resolve: {
      // In development, alias @littlecarlito/blorkpack to the local package
      // In production, don't alias it so it resolves from node_modules
      alias: isProduction ? {} : {
        '@littlecarlito/blorkpack': path.resolve(__dirname, 'packages/blorkpack/dist/index.js')
      }
    },
    optimizeDeps: {
      // In development, include the local package for optimization
      include: isProduction ? [] : ['@littlecarlito/blorkpack']
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: {
            'three-core': ['three'],
            'three-addons': [
              'three/examples/jsm/controls/OrbitControls',
              'three/examples/jsm/Addons.js',
              'three/examples/jsm/libs/tween.module.js'
            ],
            'physics': ['@dimforge/rapier3d-compat']
          }
        },
        // During production builds, don't treat @littlecarlito/blorkpack as external
        // This ensures it's properly included in the bundle from node_modules
        external: [], 
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
    }
  };
}) 