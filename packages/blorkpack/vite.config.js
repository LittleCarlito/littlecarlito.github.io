import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'BlorkPack',
      formats: ['es'],
      fileName: 'index'
    },
    sourcemap: true,
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