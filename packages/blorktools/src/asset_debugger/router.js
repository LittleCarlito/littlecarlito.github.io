// router.js - SPA router that loads content into div
class Router {
    constructor() {
        this.routes = new Map();
        this.appDiv = document.getElementById('app');
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

    async loadContent(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            this.appDiv.innerHTML = html;
            this.executeScripts();
        } catch (error) {
            this.appDiv.innerHTML = `<div class="loading"><h1>Error</h1><p>Could not load content: ${error.message}</p></div>`;
        }
    }

    executeScripts() {
        const scripts = this.appDiv.querySelectorAll('script');
        console.log('Found scripts:', scripts.length);
        
        scripts.forEach((script, index) => {
            console.log(`Script ${index}:`, {
                src: script.src,
                type: script.type,
                textContent: script.textContent.substring(0, 100)
            });
            
            const newScript = document.createElement('script');
            
            // Copy all attributes
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy script content
            if (script.src) {
                newScript.src = script.src;
                newScript.onload = () => console.log(`Script loaded: ${script.src}`);
                newScript.onerror = (e) => console.error(`Script failed: ${script.src}`, e);
            } else {
                newScript.textContent = script.textContent;
            }
            
            // Replace old script with new one
            script.parentNode.replaceChild(newScript, script);
        });
    }
}



// Initialize router
const router = new Router();

router
router
    .addRoute('/landing', async () => {
        await router.loadContent('./landing-page/landing-page.html');
        
        // Directly import and execute the landing page module
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