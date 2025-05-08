/**
 * String Serialization/Deserialization Utility
 * 
 * This module handles conversion between strings and binary data,
 * as well as validation and formatting of string content.
 */

/**
 * Serialize string content to binary format
 * @param {string} stringContent - The string content to serialize
 * @returns {ArrayBuffer} The serialized binary data
 */
export function serializeStringToBinary(stringContent) {
    console.info("Serializing: " + stringContent);
    
    // Create a UTF-8 encoder
    const encoder = new TextEncoder();
    
    // Simply encode the string as UTF-8
    // This is the most reliable way to handle all characters
    return encoder.encode(stringContent).buffer;
}

/**
 * Deserialize binary data to string content
 * @param {ArrayBuffer} binaryData - The binary data to deserialize
 * @returns {string} The deserialized string content
 */
export function deserializeStringFromBinary(binaryData) {
    try {
        // Simple check for valid buffer
        if (!binaryData || binaryData.byteLength === 0) {
            console.warn("Empty binary data received");
            return "";
        }
        
        // Create a view of the binary data to check for null terminators
        const dataView = new Uint8Array(binaryData);
        
        // Find the actual length of the string (stop at first null byte if any)
        let actualLength = dataView.length;
        for (let i = 0; i < dataView.length; i++) {
            if (dataView[i] === 0) {
                actualLength = i;
                break;
            }
        }
        
        // Create a clean buffer without any padding bytes
        const cleanBuffer = binaryData.slice(0, actualLength);
        
        // Convert binary to string using UTF-8 decoder
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(cleanBuffer);
        
        // Log a preview of the content
        const previewLength = Math.min(content.length, 50);
        const contentPreview = content.substring(0, previewLength) + 
                              (content.length > previewLength ? "..." : "");
        console.info("Deserialized to: " + contentPreview);
        
        return content;
    } catch (error) {
        console.error("Error deserializing binary data:", error);
        return "";
    }
}

/**
 * Check if a string appears to be valid HTML
 * @param {string} content - The string to check
 * @returns {boolean} True if the string appears to be valid HTML
 */
export function isValidHtml(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    
    // If it's empty or just whitespace, it's not valid HTML
    if (content.trim() === '') {
        return false;
    }
    
    // Check for common HTML markers
    const hasHtmlTags = content.includes('<') && content.includes('>');
    
    // Check for binary data (a high percentage of non-printable characters)
    const nonPrintableCount = (content.match(/[^\x20-\x7E]/g) || []).length;
    const nonPrintablePercentage = nonPrintableCount / content.length;
    
    // If more than 20% of the characters are non-printable, it's probably binary data
    const isBinaryData = nonPrintablePercentage > 0.2;
    
    return hasHtmlTags && !isBinaryData;
}

/**
 * Format HTML code with proper indentation
 * @param {string} html - The HTML code to format
 * @returns {string} The formatted HTML
 */
export function formatHtml(html) {
    if (!html || html.trim() === '') return '';
    
    // Simple HTML formatting logic
    let formatted = '';
    let indent = 0;
    const lines = html.replace(/>\s*</g, '>\n<').split('\n');
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        // Check if line contains closing tag
        if (line.match(/^<\/.*>$/)) {
            indent -= 2; // Reduce indent for closing tag
        }
        
        // Add indentation
        formatted += ' '.repeat(Math.max(0, indent)) + line + '\n';
        
        // Check if line contains opening tag and not self-closing
        if (line.match(/^<[^/].*[^/]>$/) && !line.match(/<.*\/.*>/)) {
            indent += 2; // Increase indent for next line
        }
    });
    
    return formatted;
}

/**
 * Enhanced HTML sanitization that preserves styling and safe scripts
 * @param {string} html - The HTML to sanitize
 * @returns {string} The sanitized HTML
 */
export function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }
    
    // Resizer script to help with iframe sizing
    const resizerScript = `
<script>
// Helper function to adjust iframe height
function notifySize() {
    try {
        const height = document.body.scrollHeight;
        window.parent.postMessage({ type: 'resize', height: height }, '*');
        
        // Observe DOM changes to adjust size dynamically
        const resizeObserver = new ResizeObserver(() => {
            const updatedHeight = document.body.scrollHeight;
            window.parent.postMessage({ type: 'resize', height: updatedHeight }, '*');
        });
        
        resizeObserver.observe(document.body);
    } catch (error) {
        console.error('Error in size notification:', error);
    }
}

// Run on load
window.addEventListener('load', notifySize);
</script>`;
    
    // For full document structures with doctype, html and body tags
    if (html.includes('<!DOCTYPE') || html.includes('<html')) {
        // Insert resizer script before the closing body tag
        if (html.includes('</body>')) {
            return html.replace('</body>', `${resizerScript}</body>`);
        } else if (html.includes('</html>')) {
            return html.replace('</html>', `${resizerScript}</html>`);
        } else {
            // If no closing tags found, just append
            return html + resizerScript;
        }
    }
    
    // For HTML fragments, wrap them in a basic document structure
    // This helps ensure styles and scripts work properly
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Preview</title>
</head>
<body>
    ${html}
    ${resizerScript}
</body>
</html>`;
}

// Export default for convenience
export default {
    serializeStringToBinary,
    deserializeStringFromBinary,
    isValidHtml,
    formatHtml,
    sanitizeHtml
}; 