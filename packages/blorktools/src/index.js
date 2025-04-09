/**
 * Copyright (C) 2024 Steven & Bennett Meier
 * 
 * NON-COMMERCIAL LICENSE
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * 1. The above copyright notice and this permission notice shall be included in all
 *    copies or substantial portions of the Software.
 * 
 * 2. The Software shall be used for non-commercial purposes only. For purposes of
 *    this license, "non-commercial" means that the Software is not used for, or
 *    intended for use in, any commercial, for-profit, or revenue-generating
 *    activity or purpose.
 * 
 * 3. Any derivative works of the Software must maintain these same license terms
 *    and conditions.
 * 
 * COMMERCIAL LICENSE
 * 
 * Any commercial use of the Software requires explicit written permission from
 * the copyright holders. Commercial licenses may be obtained by contacting:
 * steven.meier77@gmail.com
 */
/**
 * Blorktools - 3D Asset Development Toolset
 * Main entry point for the package
 */
// Re-export core functionality from each tool
export * from './asset_debugger/index.js';
// Export individual tools
export const tools = {
	// Asset Debugger Tool
	assetDebugger: {
		init: () => import('./asset_debugger/index.js').then(module => module.init())
	}
};
// Export utility functions that might be useful for consumers
export { formatFileSize, getFileExtension, createElement } from './asset_debugger/utils/helpers.js';
// Version information
export const VERSION = '1.0.0'; 