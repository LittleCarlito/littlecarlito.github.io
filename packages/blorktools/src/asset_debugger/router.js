import { showLoadingSplash, updateLoadingProgress, hideLoadingSplash } from './loading-splash/loading-splash';

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
        this.isHandlingRoute = false;
        
        window.addEventListener('hashchange', this.handleRouteDebounced.bind(this));
        window.addEventListener('load', this.handleRouteDebounced.bind(this));
        
        if (!window.location.hash) {
            this.navigate('/landing');
        }
    }

    async handleRouteDebounced() {
        if (this.isHandlingRoute) {
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
            this.navigate('/landing');
        }
    }

    navigate(path) {
        window.location.hash = path;
    }

    navigateToPage(targetPage, params = {}) {
        const navigationEvent = new CustomEvent('routerNavigation', {
            detail: { targetPage, params, timestamp: Date.now() }
        });
        window.dispatchEvent(navigationEvent);
        
        const routeMap = {
            'debugger-scene': '/debugger-scene',
            'landing': '/landing',
            'tools': '/tools'
        };
        
        const route = routeMap[targetPage];
        if (route) {
            this.navigate(route);
        } else {
            this.navigate('/landing');
        }
    }

    async clearContent() {
        if (this.currentModuleCleanup) {
            try {
                const result = this.currentModuleCleanup();
                this.currentModuleCleanup = null;
            } catch (error) {
                this.currentModuleCleanup = null;
            }
        }

        this.cleanupCSS3DElements();
        this.appDiv.innerHTML = '';
    }

    cleanupCSS3DElements() {
        const css3dRenderers = document.querySelectorAll('div[style*="position: absolute"][style*="z-index: 1000"]');
        css3dRenderers.forEach(renderer => {
            if (renderer.parentNode && renderer !== this.appDiv) {
                renderer.parentNode.removeChild(renderer);
            }
        });

        const css3dIframes = document.querySelectorAll('iframe[style*="border: 2px solid #00ff88"]');
        css3dIframes.forEach(iframe => {
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        });

        const css3dElements = document.querySelectorAll('[style*="pointer-events: none"][style*="position: absolute"]');
        css3dElements.forEach(element => {
            if (element.parentNode && element !== this.appDiv && element.style.zIndex === '1000') {
                element.parentNode.removeChild(element);
            }
        });
    }

    async loadContent(url) {
        await this.clearContent();
        await this.ensureHeaderLoaded();
                
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const html = await response.text();
        const contentToInsert = this.extractContent(html, url);
        this.appDiv.innerHTML = contentToInsert;
        
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    extractContent(html, url) {
        if (!html.includes('<!DOCTYPE html>')) {
            return html;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body.cloneNode(true);
        
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

    async ensureHeaderLoaded() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer && headerContainer.innerHTML.trim() === '') {
            try {
                const { loadHeader } = await import('./header/header.js');
                await loadHeader('header-container');
            } catch (error) {
                // Header loading failed
            }
        }
    }

    async initializeModule(modulePath, initFunctionName, routeName) {
        try {
            const module = await import(/* @vite-ignore */ `${modulePath}?t=${Date.now()}`);
            
            if (module[initFunctionName]) {
                const cleanup = await module[initFunctionName]();
                
                if (cleanup && typeof cleanup === 'function') {
                    this.currentModuleCleanup = cleanup;
                }
            }
        } catch (error) {
            // Module initialization failed
        }
    }
}

const router = new Router();

router
    .addRoute('/landing', async () => {
        await router.loadContent('./landing-page/landing-page.html');
        await router.initializeModule('./landing-page/landing-page.js', 'initalizeLandingPage', 'landing page');
    })
    .addRoute('/debugger-scene', async () => {
        await router.loadContent('./debugger-scene/debugger-scene.html');
        await router.initializeModule('./debugger-scene/debugger-scene.js', 'setupDebuggerScene', 'debugger scene');
    });

window.appRouter = router;