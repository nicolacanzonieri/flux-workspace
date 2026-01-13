/**
 * FLUX WORKSPACE - MAIN CONTROLLER
 */

class FluxApp {
    constructor() {
        this.dom = {
            splash: document.getElementById('splash-screen'),
            app: document.getElementById('app'),
            menu: document.getElementById('home-menu'),
            mainTitle: document.getElementById('main-title'),
            menuContent: document.getElementById('menu-content'),
            canvas: document.getElementById('flux-canvas'),
            
            btnNew: document.getElementById('btn-new-board'),
            btnOpen: document.getElementById('btn-open-file'),
            btnSettings: document.getElementById('btn-settings-toggle'),
            btnHome: document.getElementById('btn-home'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            btnHardReset: document.getElementById('btn-hard-reset'),
            
            settingsModal: document.getElementById('settings-modal'),
            themeToggle: document.getElementById('theme-toggle'),
            gridToggle: document.getElementById('grid-toggle'),
            fileInput: document.getElementById('file-input')
        };
        
        this.state = { isReady: false, boardActive: false };
        this.whiteboard = null;

        this.init();
    }

    async init() {
        if(typeof FluxWhiteboard !== 'undefined') {
            this.whiteboard = new FluxWhiteboard('flux-canvas');
        }
        this.loadSettings();
        
        // Start the breathtaking reveal sequence
        this.revealApplication();
        this.bindEvents();
    }

    async revealApplication() {
        // Step 1: Show the app container (still hidden by splash)
        this.dom.app.classList.remove('hidden');
        this.dom.app.classList.add('visible');

        // Step 2: Fade in the Title at center
        await new Promise(r => setTimeout(r, 500));
        this.dom.mainTitle.classList.add('fade-in');

        // Step 3: Remove the black curtain
        await new Promise(r => setTimeout(r, 800));
        this.dom.splash.classList.add('fade-out');

        // Step 4: Move title to position and show menu
        await new Promise(r => setTimeout(r, 600));
        this.dom.mainTitle.classList.remove('initial-center');
        
        // Step 5: Fade in buttons and subtitle
        await new Promise(r => setTimeout(r, 400));
        this.dom.menuContent.classList.remove('invisible');
        this.dom.menuContent.classList.add('fade-in');
        
        this.state.isReady = true;
    }

    // ... Rest of the functions (loadSettings, bindEvents, etc.) remain exactly the same ...
    loadSettings() {
        const savedTheme = localStorage.getItem('flux-theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            this.dom.themeToggle.checked = true;
        }
        const savedGrid = localStorage.getItem('flux-grid');
        if (savedGrid === 'false') {
            this.dom.gridToggle.checked = false;
            if(this.whiteboard) this.whiteboard.setGridEnabled(false);
        }
    }

    bindEvents() {
        this.dom.btnNew.addEventListener('click', () => this.startNewBoard());
        this.dom.btnHome.addEventListener('click', () => this.returnToHome());
        this.dom.btnSettings.addEventListener('click', () => this.dom.settingsModal.classList.remove('hidden'));
        this.dom.btnCloseSettings.addEventListener('click', () => this.dom.settingsModal.classList.add('hidden'));
        this.dom.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.settingsModal) this.dom.settingsModal.classList.add('hidden');
        });
        this.dom.themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('light-mode');
                localStorage.setItem('flux-theme', 'light');
            } else {
                document.body.classList.remove('light-mode');
                localStorage.setItem('flux-theme', 'dark');
            }
            if(this.whiteboard) this.whiteboard.render();
        });
        this.dom.gridToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            localStorage.setItem('flux-grid', isEnabled);
            if(this.whiteboard) this.whiteboard.setGridEnabled(isEnabled);
        });
        this.dom.btnHardReset.addEventListener('click', () => this.hardResetApp());
    }

    startNewBoard() {
        this.dom.menu.classList.add('hidden');
        this.dom.canvas.classList.remove('hidden');
        this.state.boardActive = true;
        this.dom.btnHome.classList.remove('hidden');
        if(this.whiteboard) this.whiteboard.resize();
    }

    returnToHome() {
        this.dom.canvas.classList.add('hidden');
        this.state.boardActive = false;
        this.dom.btnHome.classList.add('hidden');
        this.dom.menu.classList.remove('hidden');
    }

    async hardResetApp() {
        if(!confirm("Are you sure? This will delete all local data and update the app.")) return;
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) await registration.unregister();
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        localStorage.clear();
        window.location.reload();
    }
}

document.addEventListener('DOMContentLoaded', () => { window.flux = new FluxApp(); });