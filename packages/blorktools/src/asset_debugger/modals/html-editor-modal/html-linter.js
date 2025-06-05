/**
 * HTML Linter
 * 
 * This module provides HTML linting capabilities using a built-in implementation.
 * No external dependencies are used.
 */


// Store current lint errors
let currentLintErrors = [];

/**
 * Initialize the HTML linter (no-op since we don't need initialization)
 * @returns {Promise<void>}
 */
export async function initHtmlLinter() {
    console.log('HTML linter initialized (built-in)');
    return Promise.resolve();
}

/**
 * Lint the HTML content in the editor
 */
export async function lintHtmlContent() {
    const modal = document.getElementById('html-editor-modal');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
    const errorContainer = modal ? modal.querySelector('#html-editor-errors') : null;
    
    if (!textarea) return;
    
    const html = textarea.value;
    
    try {
        // Run the linter
        const errors = await lintHtml(html);
        currentLintErrors = errors;
        
        // Clear previous error indicators
        clearErrorIndicators();
        
        // Create error container if it doesn't exist
        const container = errorContainer || createErrorContainer();
        
        // Display errors if any
        if (errors && errors.length > 0) {
            displayLintErrors(errors);
            container.style.display = 'block';
        } else {
            if (container) container.style.display = 'none';
        }
    } catch (error) {
        console.error('Error linting HTML:', error);
    }
}

/**
 * Built-in HTML validation
 * @param {string} html - The HTML to validate
 * @returns {Array} Array of lint errors/warnings
 */
function validateHtml(html) {
    const errors = [];
    
    if (!html || html.trim() === '') {
        return errors;
    }
    
    // Split into lines for better error reporting
    const lines = html.split('\n');
    
    // Check for basic HTML structure
    if (!html.includes('<')) {
        errors.push({
            line: 1,
            col: 1,
            message: 'No HTML tags found',
            rule: 'tag-required',
            severity: 'error'
        });
    }
    
    // Track open tags to check for proper nesting and closure
    const openTags = [];
    let lineNum = 0;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        lineNum = i + 1; // 1-based line numbers
        
        // Extract tags from the line
        const tagMatches = line.match(/<\/?[a-z][a-z0-9]*(?:\s+[^>]*)?>/gi) || [];
        
        // Process each tag in the line
        for (const tag of tagMatches) {
            const colNum = line.indexOf(tag) + 1; // 1-based column numbers
            
            // Check if it's a closing tag
            if (tag.match(/<\//)) {
                const tagName = tag.match(/<\/([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
                
                if (!tagName) {
                    errors.push({
                        line: lineNum,
                        col: colNum,
                        message: 'Invalid closing tag format',
                        rule: 'tag-format',
                        severity: 'error'
                    });
                    continue;
                }
                
                // Check if this closing tag matches the last opened tag
                if (openTags.length === 0) {
                    errors.push({
                        line: lineNum,
                        col: colNum,
                        message: `Closing tag </${tagName}> without matching opening tag`,
                        rule: 'tag-pair',
                        severity: 'error'
                    });
                } else if (openTags[openTags.length - 1].name !== tagName) {
                    const lastOpenTag = openTags[openTags.length - 1].name;
                    errors.push({
                        line: lineNum,
                        col: colNum,
                        message: `Expected closing tag </${lastOpenTag}>, found </${tagName}>`,
                        rule: 'tag-pair',
                        severity: 'error'
                    });
                } else {
                    // Correct closing tag, remove from stack
                    openTags.pop();
                }
            }
            // Check if it's a self-closing tag
            else if (tag.endsWith('/>') || 
                     tag.match(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s|>)/i)) {
                // Self-closing tags are fine, no need to track
            }
            // It's an opening tag
            else {
                const tagName = tag.match(/<([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
                
                if (!tagName) {
                    errors.push({
                        line: lineNum,
                        col: colNum,
                        message: 'Invalid opening tag format',
                        rule: 'tag-format',
                        severity: 'error'
                    });
                    continue;
                }
                
                // Check for attribute format issues
                const attributeText = tag.slice(tagName.length + 1, -1).trim();
                if (attributeText) {
                    const attrMatches = attributeText.match(/([a-z][a-z0-9\-_]*)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi) || [];
                    
                    // Check for duplicate attributes
                    const attrNames = [];
                    for (const attr of attrMatches) {
                        const attrName = attr.split('=')[0].toLowerCase();
                        if (attrNames.includes(attrName)) {
                            errors.push({
                                line: lineNum,
                                col: colNum,
                                message: `Duplicate attribute '${attrName}' in tag`,
                                rule: 'attr-no-duplication',
                                severity: 'error'
                            });
                        }
                        attrNames.push(attrName);
                    }
                }
                
                // Add to open tags stack
                openTags.push({
                    name: tagName,
                    line: lineNum,
                    col: colNum
                });
            }
        }
    }
    
    // Check for unclosed tags
    for (const tag of openTags) {
        errors.push({
            line: tag.line,
            col: tag.col,
            message: `Unclosed tag <${tag.name}>`,
            rule: 'tag-pair',
            severity: 'error'
        });
    }
    
    return errors;
}

/**
 * Lint HTML code to find errors and warnings
 * @param {string} html - The HTML to lint
 * @returns {Promise<Array>} Array of lint errors/warnings
 */
async function lintHtml(html) {
    if (!html) return [];
    
    try {
        return validateHtml(html);
    } catch (error) {
        console.error('Error linting HTML:', error);
        return [{
            line: 1,
            col: 1,
            message: `Linting error: ${error.message}`,
            rule: 'internal-error',
            severity: 'error'
        }];
    }
}

/**
 * Clear error indicators from the editor
 */
function clearErrorIndicators() {
    const modal = document.getElementById('html-editor-modal');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
    if (!textarea) return;
    
    // Remove any existing error styling
    textarea.classList.remove('has-errors');
    
    // Clear the error container
    const errorContainer = modal ? modal.querySelector('#html-editor-errors') : null;
    if (errorContainer) {
        errorContainer.innerHTML = '';
    }
}

/**
 * Display lint errors in the editor
 * @param {Array} errors - The lint errors to display
 */
function displayLintErrors(errors) {
    const modal = document.getElementById('html-editor-modal');
    const textarea = modal ? modal.querySelector('#html-editor-textarea') : null;
    const errorContainer = modal ? modal.querySelector('#html-editor-errors') : null;
    
    if (!textarea || !errorContainer) return;
    
    // Add error class to textarea
    textarea.classList.add('has-errors');
    
    // Create error messages
    const errorList = document.createElement('ul');
    errorList.style.margin = '0';
    errorList.style.padding = '0 0 0 20px';
    
    errors.forEach(error => {
        const errorItem = document.createElement('li');
        errorItem.textContent = `Line ${error.line}, Col ${error.col}: ${error.message}`;
        errorItem.style.cursor = 'pointer';
        
        // Add click handler to navigate to the error position
        errorItem.addEventListener('click', () => {
            navigateToErrorPosition(textarea, error.line, error.col);
        });
        
        errorList.appendChild(errorItem);
    });
    
    errorContainer.innerHTML = '';
    errorContainer.appendChild(errorList);
}