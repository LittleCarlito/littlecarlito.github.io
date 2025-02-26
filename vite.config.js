import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '' : '/threejs_site/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['three/examples/jsm/libs/tween.module.js'],
          'three-core': ['three'],
          'three-addons': [
            'three/examples/jsm/controls/OrbitControls',
            'three/examples/jsm/Addons.js'
          ],
          'physics': ['@dimforge/rapier3d-compat']
        },
        external: [
          /^development\/.*/  // Excludes anything in the development folder
        ]
      }
    },
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
  }
})) 