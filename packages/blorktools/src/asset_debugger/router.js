// router.js - Simple SPA router
class Router {
    constructor() {
        this.routes = new Map();
        this.appDiv = document.getElementById('app');
        this.currentModuleCleanup = null;
        this.init();
    }

    addRoute(path, handler) {
        this.routes.set(path, handler);
        return this;
    }

    init() {
        // Use a flag to prevent double handling
        this.isHandlingRoute = false;
        
        window.addEventListener('hashchange', this.handleRouteDebounced.bind(this));
        window.addEventListener('load', this.handleRouteDebounced.bind(this));
        
        // Default route if no hash
        if (!window.location.hash) {
            this.navigate('/landing');
        }
    }

    // Debounced route handler to prevent double execution
    async handleRouteDebounced() {
        if (this.isHandlingRoute) {
            console.log('Route handling already in progress, skipping...');
            return;
        }
        
        this.isHandlingRoute = true;
        try {
            await this.handleRoute();
        } finally {
            this.isHandlingRoute = false;
        }
    }

    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/landing';
        const handler = this.routes.get(hash);
        
        if (handler) {
            await handler();
        } else {
            console.warn(`Route not found: ${hash}, redirecting to landing`);
            this.navigate('/landing');
        }
    }

    navigate(path) {
        window.location.hash = path;
    }

    // Navigation function with proper routing and BAZINGA log
    navigateToPage(targetPage, params = {}) {
        console.debug('BAZINGA - Router navigating to:', targetPage, 'with params:', params);
        
        // Dispatch navigation event
        const navigationEvent = new CustomEvent('routerNavigation', {
            detail: { targetPage, params, timestamp: Date.now() }
        });
        window.dispatchEvent(navigationEvent);
        
        // Route mapping
        const routeMap = {
            'asset_debugger': '/asset-debugger',
            'landing': '/landing',
            'tools': '/tools'
        };
        
        const route = routeMap[targetPage];
        if (route) {
            this.navigate(route);
        } else {
            console.warn('Unknown target page:', targetPage, 'defaulting to landing');
            this.navigate('/landing');
        }
    }

    // Cleanup previous content and modules
    async clearContent() {
        // Clean up current module if it has cleanup
        if (this.currentModuleCleanup) {
            try {
                this.currentModuleCleanup();
                console.log('Previous module cleaned up');
            } catch (error) {
                console.warn('Module cleanup failed:', error);
            }
            this.currentModuleCleanup = null;
        }

        // Clear only the app content, preserve header
        this.appDiv.innerHTML = '';
    }

    // Load HTML content into the app div
    async loadContent(url) {
        try {
            console.log('Loading content from:', url);
            
            await this.clearContent();
            await this.ensureHeaderLoaded();
            
            // Show loading state
            this.appDiv.innerHTML = '<div class="loading">Loading...</div>';
            
            // Fetch content
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const html = await response.text();
            console.log('Content fetched, size:', html.length, 'bytes');
            console.log('Content preview:', html.substring(0, 200) + '...');
            
            // Extract and insert content
            const contentToInsert = this.extractContent(html, url);
            console.log('Extracted content size:', contentToInsert.length, 'bytes');
            console.log('Extracted content preview:', contentToInsert.substring(0, 200) + '...');
            
            this.appDiv.innerHTML = contentToInsert;
            console.log('Content inserted into DOM');
            
            // Ensure DOM is ready
            await new Promise(resolve => requestAnimationFrame(resolve));
            
        } catch (error) {
            console.error('Error loading content:', error);
            this.appDiv.innerHTML = `
                <div class="loading">
                    <h1>Error</h1>
                    <p>Could not load content from ${url}</p>
                    <p>Error: ${error.message}</p>
                </div>
            `;
        }
    }

    // Extract content from HTML based on file type
    extractContent(html, url) {
        if (!html.includes('<!DOCTYPE html>')) {
            console.log(`Content is not a full HTML document, returning as-is`);
            return html;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        console.log(`Extracting content from ${url}`);
        
        // Special handling for landing page
        if (url.includes('landing-page.html')) {
            console.log('Processing landing page HTML');
            return this.extractBodyContent(doc);
        }
        
        // Special handling for asset debugger
        if (url.includes('asset_debugger.html')) {
            console.log('Processing asset debugger HTML');
            
            // For asset_debugger.html, we need to extract the .container element
            // AND the modal containers that are separate siblings
            const container = doc.querySelector('.container');
            const settingsModalContainer = doc.querySelector('#settings-modal-container');
            const htmlEditorModalContainer = doc.querySelector('#html-editor-modal-container');
            
            // Count found elements for debugging
            const foundElements = [
                container ? 'container' : null,
                settingsModalContainer ? 'settings-modal-container' : null,
                htmlEditorModalContainer ? 'html-editor-modal-container' : null
            ].filter(Boolean);
            
            console.log(`Found elements in asset_debugger.html: ${foundElements.join(', ')}`);
            
            if (container) {
                // Create a wrapper for all our content
                let content = container.outerHTML;
                
                // Add modal containers if they exist
                if (settingsModalContainer) {
                    content += settingsModalContainer.outerHTML;
                } else {
                    content += '<div id="settings-modal-container"></div>';
                    console.log('Added missing settings-modal-container');
                }
                
                if (htmlEditorModalContainer) {
                    content += htmlEditorModalContainer.outerHTML;
                } else {
                    content += '<div id="html-editor-modal-container"></div>';
                    console.log('Added missing html-editor-modal-container');
                }
                
                return content;
            }
            
            // Fallback to standard body content extraction
            console.log('Container element not found, falling back to body extraction');
            return this.extractBodyContent(doc);
        }
        
        // For all other pages, fail explicitly if we don't know how to handle them
        throw new Error(`Don't know how to extract content from ${url}. Add explicit handling for this file type.`);
    }

    // Helper to extract body content while removing unwanted elements
    extractBodyContent(doc) {
        const body = doc.body.cloneNode(true);
        
        // Remove elements that shouldn't be duplicated
        const elementsToRemove = [
            '#header-container',
            'script',
            'link[rel="stylesheet"]'
        ];
        
        elementsToRemove.forEach(selector => {
            const elements = body.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        return body.innerHTML;
    }

    // Ensure header is loaded
    async ensureHeaderLoaded() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer && headerContainer.innerHTML.trim() === '') {
            try {
                const { loadHeader } = await import('./header/header-loader.js');
                await loadHeader('header-container');
                console.log('Header loaded by router');
            } catch (error) {
                console.warn('Could not load header:', error);
            }
        }
    }

    // Initialize a module after content is loaded
    async initializeModule(modulePath, initFunctionName, routeName) {
        try {
            console.log(`Importing ${routeName} module from: ${modulePath}`);
            const module = await import(/* @vite-ignore */ `${modulePath}?t=${Date.now()}`);
                  
            console.log(`Module imported. Available exports:`, Object.keys(module));
            
            if (module[initFunctionName]) {
                console.log(`Initializing ${routeName}...`);
                const cleanup = await module[initFunctionName]();
                
                if (cleanup && typeof cleanup === 'function') {
                    this.currentModuleCleanup = cleanup;
                }
                
                console.log(`${routeName} initialized successfully`);
            } else {
                console.error(`${initFunctionName} function not found in ${routeName} module`);
                console.error('Available functions:', Object.keys(module));
            }
        } catch (error) {
            console.error(`Error importing or initializing ${routeName} module:`, error);
            console.error('Module path:', modulePath);
            console.error('Init function name:', initFunctionName);
        }
    }
}

// Initialize router
const router = new Router();

// Define routes
router
    .addRoute('/landing', async () => {
        console.log('🏠 Loading landing page...');
        await router.loadContent('./landing-page/landing-page.html');
        await router.initializeModule('./landing-page/landing-page.js', 'initalizeLandingPage', 'landing page');
    })
    .addRoute('/asset-debugger', async () => {
        console.log('🎯 Loading asset debugger...');
        await router.loadContent('./scene/asset_debugger.html');
        await router.initializeModule('./scene/asset_debugger.js', 'setupAssetDebugger', 'asset debugger');
    });

// Make router globally available
window.appRouter = router;

