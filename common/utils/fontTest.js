/**
 * Test file for the font utilities
 */
import { getFontPath, isProduction } from './fontUtils.js';

// Test function that logs a font path
export function testFontPath(fontName) {
    console.log(`Production environment: ${isProduction()}`);
    console.log(`Standard font path: ${getFontPath(fontName)}`);
    console.log(`Relative font path: ${getFontPath(fontName, true)}`);
    return getFontPath(fontName);
} 