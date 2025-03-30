// Dashboard initialization
document.addEventListener('DOMContentLoaded', async function() {
	try {
		// Replace console port placeholder
		const url = new URL(window.location.href);
		document.body.innerHTML = document.body.innerHTML.replace('{{consolePort}}', url.port);

		// Fetch project status cards
		const statusResponse = await fetch('/api/projects/status');
		const statusData = await statusResponse.json();
    
		if (statusData.statusCards && statusData.statusCards.length > 0) {
			document.body.innerHTML = document.body.innerHTML.replace('{{projectStatuses}}', statusData.statusCards.join(''));
		} else {
			document.body.innerHTML = document.body.innerHTML.replace('{{projectStatuses}}', '<p>No project statuses available</p>');
		}

		// Fetch project cards
		const cardsResponse = await fetch('/api/projects/cards');
		const cardsData = await cardsResponse.json();
    
		if (cardsData.projectCards && cardsData.projectCards.length > 0) {
			// Apply proper row-based layout with explicit wrapper divs if needed
			const projectCards = cardsData.projectCards;
			const projectCardsHTML = projectCards.join('\n');
      
			document.body.innerHTML = document.body.innerHTML.replace('{{projectCards}}', projectCardsHTML);
			document.body.innerHTML = document.body.innerHTML.replace('{{noProjectsMessage}}', '');
      
			// Make sure cards have proper dimensions
			setTimeout(() => {
				const cardContainers = document.querySelectorAll('.project-card');
				cardContainers.forEach(card => {
					card.style.minHeight = '220px';
				});
			}, 100);
		} else {
			document.body.innerHTML = document.body.innerHTML.replace('{{projectCards}}', '');
			document.body.innerHTML = document.body.innerHTML.replace(
				'{{noProjectsMessage}}',
				'<div class="no-projects">No projects available</div>'
			);
		}
    
		// Start checking services periodically
		startServiceChecks();
	} catch (error) {
		console.error('Error initializing dashboard:', error);
		document.body.innerHTML = document.body.innerHTML
			.replace('{{projectStatuses}}', '<p>Error loading project statuses</p>')
			.replace('{{projectCards}}', '')
			.replace('{{noProjectsMessage}}', '<div class="error-message">Error loading projects. Please try refreshing the page.</div>');
	}
});

// Check if services are actually available
/**
 *
 */
async function checkService(url, cardId, port) {
	try {
		const response = await fetch(url, { 
			mode: 'no-cors',
			timeout: 2000 // 2 second timeout
		});
    
		// Update UI to show service is available
		const card = document.getElementById(cardId);
		if (card) {
			card.classList.remove('unavailable');
			const portInfo = card.querySelector(`[data-port="${port}"]`);
			if (portInfo) {
				portInfo.textContent = 'Listening on port ' + port;
			}
		}
    
		// Also update the status in the overview section
		const statusDiv = document.querySelector(`[data-port="${port}"]`);
		if (statusDiv) {
			statusDiv.textContent = 'Running on port: ' + port;
		}
	} catch (error) {
		// Update UI to show service is unavailable
		const card = document.getElementById(cardId);
		if (card) {
			card.classList.add('unavailable');
			const portInfo = card.querySelector(`[data-port="${port}"]`);
			if (portInfo) {
				portInfo.textContent = 'Service unavailable';
			}
		}
    
		// Also update the status in the overview section
		const statusDiv = document.querySelector(`[data-port="${port}"]`);
		if (statusDiv) {
			statusDiv.textContent = 'Service unavailable';
		}
	}
}

// Check services periodically
/**
 *
 */
function startServiceChecks() {
	const checkAllServices = () => {
		// Get all service checks from the data attribute
		const serviceChecks = document.querySelectorAll('[data-service-check]');
		serviceChecks.forEach(check => {
			const url = check.dataset.url;
			const cardId = check.dataset.cardId;
			const port = check.dataset.port;
			if (url && cardId && port) {
				checkService(url, cardId, parseInt(port, 10));
			}
		});
	};
  
	// Check every 5 seconds
	setInterval(checkAllServices, 5000);
} 