/**
 * Create or get an error log container
 * @param {HTMLElement} container - Parent container for the error log
 * @param {string} [logId] - Custom ID for the error log element
 * @param {string} [className] - Custom class name for styling
 * @returns {HTMLElement} The error log element
 */
export function createErrorLog(container, logId = 'error-log', className = 'error-log') {
    if (!container) throw new Error('Container element is required');
    
    let errorLog = container.querySelector(`#${logId}`);
    
    if (!errorLog) {
        errorLog = document.createElement('div');
        errorLog.id = logId;
        errorLog.className = className;
        errorLog.style.display = 'none';
        container.appendChild(errorLog);
    }
    
    return errorLog;
}

/**
 * Add an error entry to an error log
 * @param {HTMLElement} errorLog - The error log container
 * @param {string} message - Error message to display
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showTimestamp=true] - Whether to show timestamp
 * @param {string} [options.entryClassName='error-entry'] - Class name for the entry
 * @param {string} [options.timeClassName='error-time'] - Class name for the timestamp
 */
export function addErrorEntry(errorLog, message, options = {}) {
    const {
        showTimestamp = true,
        entryClassName = 'error-entry',
        timeClassName = 'error-time'
    } = options;
    
    if (!errorLog) throw new Error('Error log element is required');
    
    const errorEntry = document.createElement('div');
    errorEntry.className = entryClassName;
    errorEntry.textContent = message;
    
    if (showTimestamp) {
        const timestamp = new Date().toLocaleTimeString();
        const timeSpan = document.createElement('span');
        timeSpan.className = timeClassName;
        timeSpan.textContent = `[${timestamp}] `;
        errorEntry.prepend(timeSpan);
    }
    
    errorLog.appendChild(errorEntry);
    errorLog.style.display = 'block';
}

/**
 * Log an error to a container with automatic error log creation
 * @param {string} message - Error message to display
 * @param {HTMLElement} container - Container for the error log
 * @param {Object} [options] - Configuration options
 * @param {string} [options.logId] - Custom ID for error log
 * @param {string} [options.logClassName] - Custom class for error log
 * @param {Function} [options.statusCallback] - Function to call for status updates
 * @param {boolean} [options.consoleLog=true] - Whether to also log to console
 * @param {Object} [options.entryOptions] - Options passed to addErrorEntry
 */
export function logError(message, container, options = {}) {
    const {
        logId = 'error-log',
        logClassName = 'error-log',
        statusCallback,
        consoleLog = true,
        entryOptions = {}
    } = options;
    
    if (!container) throw new Error('Container element is required');
    
    const errorLog = createErrorLog(container, logId, logClassName);
    addErrorEntry(errorLog, message, entryOptions);
    
    if (statusCallback && typeof statusCallback === 'function') {
        statusCallback(message, 'error');
    }
    
    if (consoleLog) {
        console.error(message);
    }
}

/**
 * Clear all entries from an error log
 * @param {HTMLElement} errorLog - The error log to clear
 * @param {boolean} [hide=true] - Whether to hide the log after clearing
 */
export function clearErrorLog(errorLog, hide = true) {
    if (!errorLog) return;
    
    errorLog.innerHTML = '';
    if (hide) {
        errorLog.style.display = 'none';
    }
}

/**
 * Get all error entries from an error log
 * @param {HTMLElement} errorLog - The error log to read from
 * @returns {string[]} Array of error messages
 */
export function getErrorEntries(errorLog) {
    if (!errorLog) return [];
    
    const entries = errorLog.querySelectorAll('.error-entry');
    return Array.from(entries).map(entry => entry.textContent);
}

/**
 * Utility function to get caller information from stack trace
 * @param {number} [skipLevels=1] - Number of stack levels to skip (default skips the getCaller function itself)
 * @returns {string} Caller information in format "function@file.js:line"
 */
export function getCaller(skipLevels = 1) {
    try {
        const stack = new Error().stack;
        const lines = stack.split('\n');
        
        // Skip this function and any additional levels requested
        const callerLine = lines[skipLevels + 1];
        if (!callerLine) return 'no-stack';
        
        // Quick extraction - prioritize speed over perfection
        // Look for common patterns: "at function (file:line)" or "function@file:line"
        if (callerLine.includes('at ')) {
            const atMatch = callerLine.match(/at\s+([^(]+?)(?:\s+\(.*?([^\/\\]+):(\d+)|.*?([^\/\\]+):(\d+))/);
            if (atMatch) {
                const func = atMatch[1]?.trim() || 'anonymous';
                const file = atMatch[2] || atMatch[4];
                const line = atMatch[3] || atMatch[5];
                return file && line ? `${func}@${file}:${line}` : func;
            }
        } else if (callerLine.includes('@')) {
            const atMatch = callerLine.match(/([^@]+)@.*?([^\/\\]+):(\d+)/);
            if (atMatch) return `${atMatch[1]}@${atMatch[2]}:${atMatch[3]}`;
        }
        
        // Fallback: just show a truncated version of the line
        return callerLine.substring(callerLine.lastIndexOf('/') + 1, callerLine.length).trim() || 'unknown';
    } catch (e) {
        return 'error';
    }
}

// Debug reporting function for animation analysis
export function logAnimationAnalysisReport(renderType, data) {
    const {
        frameCount,
        duration,
        isFinite,
        loopDetected,
        endDetected,
        analysisTime,
        metrics
    } = data;
    
    console.debug(
        `%c Animation Analysis Report: ${renderType} %c`,
        'background: #4285f4; color: white; padding: 2px 6px; border-radius: 2px; font-weight: bold;',
        'background: transparent;'
    );
    
    console.debug({
        renderType,
        framesAnalyzed: frameCount,
        duration: duration ? `${(duration/1000).toFixed(2)}s` : 'unknown',
        isFiniteAnimation: isFinite,
        loopDetected,
        endDetected,
        analysisTime: `${(analysisTime/1000).toFixed(2)}s`,
        metrics
    });
}

/**
 * Log errors specifically for preview context using generic logging
 */
export function logPreviewError(message, previewContent, existingErrorLog, statusCallback) {
    logError(message, previewContent, {
        logId: 'html-preview-error-log',
        logClassName: 'preview-error-log',
        statusCallback: statusCallback || showStatus,
        entryOptions: {
            entryClassName: 'error-entry',
            timeClassName: 'error-time'
        }
    });
}
