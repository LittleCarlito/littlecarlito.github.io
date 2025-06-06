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