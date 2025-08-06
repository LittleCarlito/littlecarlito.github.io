console.log('Three.js orbital system initializing...');

const statusElement = document.querySelector('.status');

const messages = [
    'System initializing...',
    'Loading orbital parameters...',
    'Establishing connection to Three.js runtime...',
    'Ready for orbital rendering...'
];

let messageIndex = 0;

function updateStatus() {
    if (messageIndex < messages.length) {
        statusElement.textContent = messages[messageIndex];
        messageIndex++;
        setTimeout(updateStatus, 1000);
    }
}

updateStatus();