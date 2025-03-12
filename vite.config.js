import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';
  
  return {
    base: command === 'serve' ? '' : '/threejs_site/',
    resolve: {
      alias: {
        '@littlecarlito/blorkpack': isProduction ? 
          '@littlecarlito/blorkpack' : 
          path.resolve(__dirname, 'packages/blorkpack/dist/index.js')
      }
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
        // During production builds, treat @littlecarlito/blorkpack as external
        // This allows it to be resolved from node_modules
        external: [
          /^development\/.*/,  // Excludes anything in the development folder
          ...(isProduction ? ['@littlecarlito/blorkpack'] : [])
        ],
        input: {
          main: 'index.html',
          ...(isProduction ? {} : { packageTest: 'tests/package-test.html' })
        }
      },
      sourcemap: true,
      chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
    }
  };
}) 