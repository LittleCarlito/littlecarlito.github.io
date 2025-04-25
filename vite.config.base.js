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
 * Copyright (C) 2024 Blorkfield LLC
 *
 * This file is part of ${pkg.name}
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * See the LICENSE file in the project root for full license information.
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