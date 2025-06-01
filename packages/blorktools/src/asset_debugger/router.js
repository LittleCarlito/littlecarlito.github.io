// router.js - Simple SPA router
class Router {
    constructor() {
        this.routes = new Map();
        this.appDiv = document.getElementById('app');
        this.currentCleanupFunctions = [];
        this.init();
    }

    addRoute(path, handler) {
        this.routes.set(path, handler);
        return this;
    }

    init() {
        window.addEventListener('hashchange', this.handleRoute.bind(this));
        window.addEventListener('load', this.handleRoute.bind(this));
        // Default route if no hash
        if (!window.location.hash) {
            this.navigate('/landing');
        }
    }

    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/landing';
        const handler = this.routes.get(hash);
        
        if (handler) {
            await handler();
        } else {
            this.navigate('/landing');
        }
    }

    navigate(path) {
        window.location.hash = path;
    }

    // Simple cleanup - just clear the app content
    clearContent() {
        // Run any cleanup functions from the previous page
        this.currentCleanupFunctions.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.warn('Cleanup function failed:', error);
            }
        });
        this.currentCleanupFunctions = [];

        // Simple clear
        this.appDiv.innerHTML = '';
        
        // Clear header container if it exists
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            headerContainer.innerHTML = '';
        }
        
        return Promise.resolve();
    }

    async loadContent(url) {
        try {
            // Clear previous content
            await this.clearContent();
            
            // Add loading state
            this.appDiv.innerHTML = '<div class="loading">Loading...</div>';
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const html = await response.text();
            
            // Clear loading and set new content
            this.appDiv.innerHTML = '';
            
            // Handle full HTML documents vs partial content
            if (url.endsWith('index.html') || html.includes('<!DOCTYPE html>')) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                this.appDiv.innerHTML = doc.body.innerHTML;
            } else {
                this.appDiv.innerHTML = html;
            }
            
            // Execute any scripts in the loaded content
            this.executeScripts();
            
        } catch (error) {
            this.appDiv.innerHTML = `<div class="loading"><h1>Error</h1><p>Could not load content: ${error.message}</p></div>`;
        }
    }

    executeScripts() {
        const scripts = this.appDiv.querySelectorAll('script');
        
        scripts.forEach((script) => {
            const newScript = document.createElement('script');
            
            // Copy attributes
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy content
            if (script.src) {
                newScript.src = script.src;
            } else {
                newScript.textContent = script.textContent;
            }
            
            // Replace old script with new one
            script.parentNode.replaceChild(newScript, script);
        });
    }

    // Method to register cleanup functions
    addCleanupFunction(cleanupFn) {
        this.currentCleanupFunctions.push(cleanupFn);
    }
}

// Initialize router
const router = new Router();

router
    .addRoute('/landing', async () => {
        await router.loadContent('./landing-page/landing-page.html');
        try {
            const module = await import('./landing-page/landing-page.js');
            if (module.initalizeLandingPage) {
                module.initalizeLandingPage();
            }
            console.log('Landing page initialized');
        } catch (error) {
            console.error('Error importing landing page module:', error);
        }
    })
    .addRoute('/tools', async () => {
        await router.loadContent('./index.html');
        console.log('Development tools page loaded');
    })
    .addRoute('/js', async () => {
        await router.loadContent('./landing-page/landing-page.html');
        try {
            const module = await import('./landing-page/landing-page.js');
            if (module.initalizeLandingPage) {
                module.initalizeLandingPage();
            }
        } catch (error) {
            console.error('Error importing landing page module:', error);
        }
    });