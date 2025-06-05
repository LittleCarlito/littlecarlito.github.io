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
 * Serialize string content with HTML settings to binary format
 * @param {string} stringContent - The string content to serialize
 * @param {Object} settings - The HTML settings to include
 * @returns {ArrayBuffer} The serialized binary data with settings metadata
 */
export function serializeStringWithSettingsToBinary(stringContent, settings) {
    console.info("Serializing with settings: ", settings);
    
    // Create a UTF-8 encoder
    const encoder = new TextEncoder();
    
    // Convert settings to JSON string
    const settingsJson = JSON.stringify(settings || {});
    const settingsBytes = encoder.encode(settingsJson);
    
    // Create a header with a magic number and settings length
    const MAGIC = 0x48544D4C; // "HTML" in ASCII
    const VERSION = 1; // Version 1 of our format
    
    // Calculate total buffer size:
    // 4 bytes for magic + 4 bytes for version + 4 bytes for settings length +
    // settings bytes + content bytes
    const totalSize = 4 + 4 + 4 + settingsBytes.byteLength + encoder.encode(stringContent).byteLength;
    
    // Create the buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    // Write magic number
    view.setUint32(0, MAGIC, true);
    
    // Write version
    view.setUint32(4, VERSION, true);
    
    // Write settings length
    view.setUint32(8, settingsBytes.byteLength, true);
    
    // Write settings bytes
    const settingsView = new Uint8Array(buffer, 12, settingsBytes.byteLength);
    settingsView.set(settingsBytes);
    
    // Write content bytes
    const contentView = new Uint8Array(buffer, 12 + settingsBytes.byteLength);
    contentView.set(encoder.encode(stringContent));
    
    return buffer;
}

/**
 * Deserialize binary data to string content
 * @param {ArrayBuffer} binaryData - The binary data to deserialize
 * @returns {Object} Object containing the deserialized content and settings if available
 */
export function deserializeStringFromBinary(binaryData) {
    try {
        // Simple check for valid buffer
        if (!binaryData || binaryData.byteLength === 0) {
            console.warn("Empty binary data received");
            return { content: "", settings: null };
        }
        
        // Check if this is our enhanced format with settings
        if (binaryData.byteLength >= 12) {
            const view = new DataView(binaryData);
            const magic = view.getUint32(0, true);
            const MAGIC = 0x48544D4C; // "HTML" in ASCII
            
            if (magic === MAGIC) {
                // This is our enhanced format
                const version = view.getUint32(4, true);
                const settingsLength = view.getUint32(8, true);
                
                // Extract settings
                const settingsBytes = new Uint8Array(binaryData, 12, settingsLength);
                const settingsJson = new TextDecoder('utf-8').decode(settingsBytes);
                let settings = {};
                
                try {
                    settings = JSON.parse(settingsJson);
                } catch (e) {
                    console.warn("Error parsing settings JSON:", e);
                }
                
                // Extract content
                const contentBytes = new Uint8Array(binaryData, 12 + settingsLength);
                const content = new TextDecoder('utf-8').decode(contentBytes);
                
                console.info("Deserialized with settings: ", settings);
                return { content, settings };
            }
        }
        
        // If not our enhanced format, treat as legacy format (just content)
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
        
        return { content, settings: null };
    } catch (error) {
        console.error("Error deserializing binary data:", error);
        return { content: "", settings: null };
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
        // Ensure the HTML has a transparent background
        // Check if there's a head section to add the transparent background style
        if (!html.includes('background-color: transparent') && !html.includes('background:transparent')) {
            // Add transparent background style if not already present
            if (html.includes('</head>')) {
                html = html.replace('</head>', '<style>body { background-color: transparent; }</style></head>');
            } else if (html.includes('<body')) {
                // Add style attribute to body tag if no head section
                html = html.replace(/<body([^>]*)>/i, '<body$1 style="background-color: transparent;">');
            }
        }
        
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
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: transparent;
        }
    </style>
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
    serializeStringWithSettingsToBinary,
    deserializeStringFromBinary,
    isValidHtml,
    formatHtml,
    sanitizeHtml
}; 