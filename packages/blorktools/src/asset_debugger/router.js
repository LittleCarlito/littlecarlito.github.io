// Add this import at the top of router.js
import { showLoadingSplash, updateLoadingProgress, hideLoadingSplash } from './loading-splash/loading-splash';

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
            'debugger-scene': '/debugger-scene',
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
                // Call cleanup but don't wait for it to finish
                const result = this.currentModuleCleanup();
                console.log('Previous module cleanup initiated');
                
                // Reset currentModuleCleanup immediately
                this.currentModuleCleanup = null;
            } catch (error) {
                console.warn('Module cleanup failed:', error);
                this.currentModuleCleanup = null;
            }
        }

        // Clear only the app content, preserve header
        this.appDiv.innerHTML = '';
    }

    // Load HTML content into the app div
    async loadContent(url) {
        console.log('Loading content from:', url);
        
        await this.clearContent();
        await this.ensureHeaderLoaded();
                
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const html = await response.text();
        console.log('Content fetched, size:', html.length, 'bytes');
                
        const contentToInsert = this.extractContent(html, url);
        console.log('Extracted content size:', contentToInsert.length, 'bytes');
        
        this.appDiv.innerHTML = contentToInsert;
        console.log('Content inserted into DOM');
        
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    // Extract content from HTML based on file type
    extractContent(html, url) {
        if (!html.includes('<!DOCTYPE html>')) {
            return html;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
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
                const { loadHeader } = await import('./header/header.js');
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
    .addRoute('/debugger-scene', async () => {
        console.log('🎯 Loading asset debugger...');
        await router.loadContent('./debugger-scene/debugger-scene.html');
        await router.initializeModule('./debugger-scene/debugger-scene.js', 'setupDebuggerScene', 'debugger scene');
    });

// Make router globally available
window.appRouter = router;