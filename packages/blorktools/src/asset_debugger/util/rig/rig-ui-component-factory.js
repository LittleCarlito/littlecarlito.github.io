/**
 * Disable the Apply Changes button
 * @param {HTMLElement} button - The button to disable
 */
export function disableApplyButton(button) {
    button.disabled = true;
    button.style.backgroundColor = 'rgba(0,0,0,0.2)';
    button.style.color = '#ccc';
    button.style.cursor = 'not-allowed';
    button.style.opacity = '0.5';
}

/**
 * Enable the Apply Changes button
 * @param {HTMLElement} button - The button to enable
 */
export function enableApplyButton(button) {
    if (button) {
        button.removeAttribute('disabled');
        button.classList.remove('disabled');
        
        // Restore visual appearance to match enabled state
        button.style.backgroundColor = '#3f51b5'; // Standard blue button color
        button.style.color = '#ffffff'; // White text
        button.style.cursor = 'pointer';
        button.style.opacity = '1.0';
    }
}
