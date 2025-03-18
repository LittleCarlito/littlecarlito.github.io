import { defineConfig } from 'vite';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      ...LicenseWebpackPlugin.default,
      apply: 'build',
      options: {
        outputFilename: 'LICENSE.txt',
        addBanner: true,
        renderBanner: (filename, pkg) => {
          return `/**
 * Copyright (C) 2024 Steven Meier
 * 
 * This file is part of ${pkg.name}
 * 
 * NON-COMMERCIAL LICENSE
 * This software is free for non-commercial use. See LICENSE file in the project root
 * for full license information and terms of use.
 * 
 * COMMERCIAL LICENSE
 * Commercial use requires explicit written permission from the copyright holder.
 * Contact: steven.meier77@gmail.com
 */
`;
        }
      }
    }
  ],
  build: {
    sourcemap: true,
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      formats: ['es']
    }
  }
}); 