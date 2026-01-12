/**
 * FLUX WORKSPACE - MAIN CONTROLLER
 */

class FluxApp {
    constructor() {
        // DOM Elements
        this.dom = {
            splash: document.getElementById('splash-screen'),
            app: document.getElementById('app'),
            menu: document.getElementById('home-menu'),
            canvas: document.getElementById('flux-canvas'),
            
            // Buttons
            btnNew: document.getElementById('btn-new-board'),
            btnOpen: document.getElementById('btn-open-file'),
            btnSettings: document.getElementById('btn-settings-toggle'),
            btnHome: document.getElementById('btn-home'), // NEW HOME BUTTON
            btnCloseSettings: document.getElementById('btn-close-settings'),
            btnHardReset: document.getElementById('btn-hard-reset'),
            
            // Inputs/Modals
            settingsModal: document.getElementById('settings-modal'),
            themeToggle: document.getElementById('theme-toggle'),
            gridToggle: document.getElementById('grid-toggle'),
            fileInput: document.getElementById('file-input')
        };
        
        // State
        this.state = {
            isReady: false,
            boardActive: false
        };

        // Module Placeholder
        this.whiteboard = null;

        this.init();
    }

    async init() {
        console.log("Flux: Booting system...");
        
        // Initialize Whiteboard Module
        if(typeof FluxWhiteboard !== 'undefined') {
            this.whiteboard = new FluxWhiteboard('flux-canvas');
        }

        this.loadSettings();

        // System simulated check
        await new Promise(r => setTimeout(r, 1000));

        this.revealApplication();
        this.bindEvents();
    }

    loadSettings() {
        // Theme
        const savedTheme = localStorage.getItem('flux-theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            this.dom.themeToggle.checked = true;
        }

        // Grid
        const savedGrid = localStorage.getItem('flux-grid');
        if (savedGrid === 'false') {
            this.dom.gridToggle.checked = false;
            if(this.whiteboard) this.whiteboard.setGridEnabled(false);
        }
    }

    revealApplication() {
        this.dom.splash.classList.add('fade-out');
        setTimeout(() => {
            this.dom.app.classList.remove('hidden');
            this.dom.app.classList.add('visible');
            this.state.isReady = true;
        }, 500);
    }

    bindEvents() {
        // --- Navigation ---
        this.dom.btnNew.addEventListener('click', () => this.startNewBoard());
        
        // HOME BUTTON LISTENER
        this.dom.btnHome.addEventListener('click', () => this.returnToHome());

        // --- Settings Modal ---
        this.dom.btnSettings.addEventListener('click', () => {
            this.dom.settingsModal.classList.remove('hidden');
        });

        this.dom.btnCloseSettings.addEventListener('click', () => {
            this.dom.settingsModal.classList.add('hidden');
        });

        this.dom.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.settingsModal) {
                this.dom.settingsModal.classList.add('hidden');
            }
        });

        // --- Toggle Features ---
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
        console.log("Flux: Starting new board...");
        
        // 1. Hide Menu
        this.dom.menu.classList.add('hidden');
        
        // 2. Show Canvas
        this.dom.canvas.classList.remove('hidden');
        this.state.boardActive = true;
        
        // 3. Show Home Button (Expand)
        this.dom.btnHome.classList.remove('hidden');
        
        // 4. Update Canvas Size
        if(this.whiteboard) this.whiteboard.resize();
    }

    returnToHome() {
        console.log("Flux: Returning to home...");

        // 1. Hide Canvas
        this.dom.canvas.classList.add('hidden');
        this.state.boardActive = false;

        // 2. Hide Home Button (Collapse)
        this.dom.btnHome.classList.add('hidden');

        // 3. Show Menu
        this.dom.menu.classList.remove('hidden');
    }

    async hardResetApp() {
        if(!confirm("Are you sure? This will delete all local data and update the app.")) return;

        console.log("Flux: Initiating Hard Reset...");

        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }

        localStorage.clear();
        window.location.reload();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flux = new FluxApp();
});