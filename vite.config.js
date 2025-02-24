import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '' : '/threejs_site/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat']
        },
        external: [
          /^development\/.*/  // Excludes anything in the development folder
        ]
      }
    },
    sourcemap: true,
  }
})) 