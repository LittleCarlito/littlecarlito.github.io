import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'AssetManagement',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['three', '@dimforge/rapier3d-compat'],
      output: {
        globals: {
          three: 'THREE',
          '@dimforge/rapier3d-compat': 'RAPIER'
        }
      }
    }
  }
}); 