// router.js - Simple SPA router
class Router {
    constructor() {
        this.routes = new Map();
        this.appDiv = document.getElementById('app');
        this.currentCleanupFunctions = [];
        this.currentModuleCleanup = null;
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

    // Navigation function with proper routing
    navigateToPage(targetPage, params = {}) {
        console.debug('BAZINGA - Router navigating to:', targetPage, 'with params:', params);
        
        // Dispatch a custom event to notify other parts of the app about navigation
        const navigationEvent = new CustomEvent('routerNavigation', {
            detail: {
                targetPage: targetPage,
                params: params,
                timestamp: Date.now()
            }
        });
        
        // Emit the event before navigation
        window.dispatchEvent(navigationEvent);
        
        // Handle different target pages
        switch(targetPage) {
            case 'asset_debugger':
                this.navigate('/asset-debugger');
                break;
            case 'landing':
                this.navigate('/landing');
                break;
            case 'tools':
                this.navigate('/tools');
                break;
            default:
                console.warn('Unknown target page:', targetPage, 'defaulting to landing');
                this.navigate('/landing');
        }
    }

    // Simple cleanup - just clear the app content but preserve header
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

        // Clean up current module if it has cleanup
        if (this.currentModuleCleanup) {
            try {
                this.currentModuleCleanup();
            } catch (error) {
                console.warn('Module cleanup failed:', error);
            }
            this.currentModuleCleanup = null;
        }

        // Clear only the app content, preserve header
        this.appDiv.innerHTML = '';
        
        return Promise.resolve();
    }

    async loadContent(url) {
        try {
            console.log('Loading content from:', url);
            
            // Clear previous content but preserve header
            await this.clearContent();
            
            // Load header if it doesn't exist
            await this.ensureHeaderLoaded();
            
            // Add loading state
            this.appDiv.innerHTML = '<div class="loading">Loading...</div>';
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const html = await response.text();
            console.log('Content fetched, parsing...');
            
            // Parse and insert content
            const contentToInsert = this.extractContent(html);
            this.appDiv.innerHTML = contentToInsert;
            console.log('Content inserted into DOM');
            
            // Small delay to ensure DOM is ready
            await new Promise(resolve => requestAnimationFrame(resolve));
            
        } catch (error) {
            console.error('Error loading content:', error);
            this.appDiv.innerHTML = `<div class="loading"><h1>Error</h1><p>Could not load content: ${error.message}</p></div>`;
        }
    }

    extractContent(html) {
        // Handle full HTML documents vs partial content
        if (html.includes('<!DOCTYPE html>')) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // For landing-page.html, we want the entire body content since it's designed as a page
            if (html.includes('Upload Section - Asset Debugger')) {
                console.log('Extracting landing page content from body');
                const body = doc.body;
                if (body) {
                    // Remove any header containers and scripts
                    const headerContainer = body.querySelector('#header-container');
                    if (headerContainer) {
                        headerContainer.remove();
                    }
                    
                    const scripts = body.querySelectorAll('script');
                    scripts.forEach(script => script.remove());
                    
                    return body.innerHTML;
                }
            }
            
            // Extract only the app content for other pages
            const sourceAppDiv = doc.getElementById('app');
            if (sourceAppDiv) {
                return sourceAppDiv.innerHTML;
            } else {
                // Fallback: use body content but exclude header-related elements
                const bodyContent = doc.body.cloneNode(true);
                
                // Use querySelector instead of getElementById on the cloned node
                const headerContainer = bodyContent.querySelector('#header-container');
                if (headerContainer) {
                    headerContainer.remove();
                }
                
                // Remove any scripts that might interfere
                const scripts = bodyContent.querySelectorAll('script');
                scripts.forEach(script => script.remove());
                
                return bodyContent.innerHTML;
            }
        } else {
            return html;
        }
    }

    async ensureHeaderLoaded() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer && headerContainer.innerHTML.trim() === '') {
            try {
                // Dynamically import and load the header
                const { loadHeader } = await import('./header/header-loader.js');
                await loadHeader('header-container');
                console.log('Header loaded by router');
            } catch (error) {
                console.warn('Could not load header:', error);
            }
        }
    }

    // Method to register cleanup functions
    addCleanupFunction(cleanupFn) {
        this.currentCleanupFunctions.push(cleanupFn);
    }

    // Method to register module cleanup
    setModuleCleanup(cleanupFn) {
        this.currentModuleCleanup = cleanupFn;
    }
}

// Initialize router
const router = new Router();

// Route handlers that properly wait for content to load before initializing modules
router
    .addRoute('/landing', async () => {
        console.log('Loading landing page route...');
        await router.loadContent('./landing-page/landing-page.html');
        
        // Initialize directly after content is loaded
        try {
            console.log('Importing landing page module...');
            const module = await import('./landing-page/landing-page.js?t=' + Date.now());
            console.log('Landing page module imported, initializing...');
            
            if (module.initalizeLandingPage) {
                const cleanup = await module.initalizeLandingPage();
                if (cleanup) {
                    router.setModuleCleanup(cleanup);
                }
                console.log('Landing page initialized successfully');
            } else {
                console.error('initalizeLandingPage function not found in module');
            }
        } catch (error) {
            console.error('Error importing or initializing landing page module:', error);
        }
    })
    .addRoute('/asset-debugger', async () => {
        console.log('Loading asset debugger route...');
        await router.loadContent('./scene/asset_debugger.html');
        
        try {
            console.log('Importing asset debugger module...');
            // Import and initialize the asset debugger module
            const module = await import('./scene/asset_debugger.js?t=' + Date.now());
            
            if (module.initializeAssetDebugger) {
                const cleanup = await module.initializeAssetDebugger();
                if (cleanup) {
                    router.setModuleCleanup(cleanup);
                }
                console.log('Asset debugger initialized successfully');
            } else {
                console.error('initializeAssetDebugger function not found in module');
            }
        } catch (error) {
            console.error('Error importing or initializing asset debugger module:', error);
        }
    })
    .addRoute('/tools', async () => {
        await router.loadContent('./index.html');
        console.log('Development tools page loaded');
    })
    .addRoute('/js', async () => {
        console.log('Loading js route (landing page)...');
        await router.loadContent('./landing-page/landing-page.html');
        
        try {
            console.log('Importing landing page module for js route...');
            const module = await import('./landing-page/landing-page.js?t=' + Date.now());
            
            if (module.initalizeLandingPage) {
                const cleanup = await module.initalizeLandingPage();
                if (cleanup) {
                    router.setModuleCleanup(cleanup);
                }
                console.log('Landing page initialized successfully for js route');
            } else {
                console.error('initalizeLandingPage function not found in module for js route');
            }
        } catch (error) {
            console.error('Error importing or initializing landing page module for js route:', error);
        }
    });

// Make router globally available
window.appRouter = router;