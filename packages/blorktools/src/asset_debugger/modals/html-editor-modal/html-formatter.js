/**
 * HTML Formatter
 * 
 * This module provides HTML formatting capabilities.
 * It uses js-beautify for HTML formatting.
 */

import jsBeautify from 'js-beautify';
const { html: beautifyHtml, css: beautifyCss } = jsBeautify;

/**
 * Format HTML code with proper indentation
 * @param {string} html - The HTML code to format
 * @param {Object} options - Formatting options (tabWidth, useTabs)
 * @returns {string} The formatted HTML
 */
export function formatHtml(html, options = {}) {
    if (!html || html.trim() === '') return '';
    
    try {
        const tabWidth = options.tabWidth || 2;
        const useTabs = options.useTabs || false;
        
        // Check if input is partial CSS (not complete HTML)
        const isPartialCss = html.trim().startsWith('body') || 
                           html.trim().startsWith('.') || 
                           html.trim().startsWith('#') ||
                           (html.includes('{') && !html.includes('<'));
        
        // Beautify options
        const beautifyOptions = {
            indent_size: tabWidth,
            indent_with_tabs: useTabs,
            preserve_newlines: true,
            max_preserve_newlines: 2,
            wrap_line_length: 0,
            end_with_newline: true,
            indent_inner_html: true,
            extra_liners: []
        };
        
        // Format based on content type
        if (isPartialCss) {
            return beautifyCss(html, beautifyOptions);
        } else {
            return beautifyHtml(html, beautifyOptions);
        }
    } catch (error) {
        console.error('Error formatting HTML:', error);
        // Fallback to returning the original HTML if formatting fails
        return html;
    }
}

/**
 * Check if external formatter is available
 * @returns {boolean} Always true since we use js-beautify
 */
export function hasExternalFormatter() {
    return true;
}

/**
 * Initialize the HTML formatter
 * @returns {Promise<void>}
 */
export async function initHtmlFormatter() {
    console.log('HTML formatter initialized (js-beautify)');
    return Promise.resolve();
}

export default {
    formatHtml,
    initHtmlFormatter,
    hasExternalFormatter
}; 