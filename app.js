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
        
        // Initialize Whiteboard Module (but keep hidden)
        if(typeof FluxWhiteboard !== 'undefined') {
            this.whiteboard = new FluxWhiteboard('flux-canvas');
        }

        // Load saved settings from localStorage (Theme, Grid)
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
        
        // --- Settings Modal ---
        this.dom.btnSettings.addEventListener('click', () => {
            this.dom.settingsModal.classList.remove('hidden');
        });

        this.dom.btnCloseSettings.addEventListener('click', () => {
            this.dom.settingsModal.classList.add('hidden');
        });

        // Close modal when clicking outside content
        this.dom.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.settingsModal) {
                this.dom.settingsModal.classList.add('hidden');
            }
        });

        // --- Toggle Features ---
        
        // 1. Theme Toggle (Eclipse Animation logic handled in CSS, we just need class)
        this.dom.themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('light-mode');
                localStorage.setItem('flux-theme', 'light');
            } else {
                document.body.classList.remove('light-mode');
                localStorage.setItem('flux-theme', 'dark');
            }
            // Redraw grid to update dot color
            if(this.whiteboard) this.whiteboard.render();
        });

        // 2. Grid Toggle
        this.dom.gridToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            localStorage.setItem('flux-grid', isEnabled);
            if(this.whiteboard) this.whiteboard.setGridEnabled(isEnabled);
        });

        // 3. HARD RESET (Clear Cache & SW)
        this.dom.btnHardReset.addEventListener('click', () => this.hardResetApp());
    }

    startNewBoard() {
        console.log("Flux: Starting new board...");
        
        // Animation: Fade out menu, Fade in Canvas
        this.dom.menu.style.opacity = '0';
        this.dom.menu.style.pointerEvents = 'none';
        
        setTimeout(() => {
            this.dom.menu.classList.add('hidden');
            this.dom.canvas.classList.remove('hidden');
            this.state.boardActive = true;
            
            // Force a resize/render to ensure full screen
            if(this.whiteboard) this.whiteboard.resize();
        }, 300);
    }

    async hardResetApp() {
        if(!confirm("Are you sure? This will delete all local data and update the app.")) return;

        console.log("Flux: Initiating Hard Reset...");

        // 1. Unregister Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // 2. Delete all Caches
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }

        // 3. Clear LocalStorage
        localStorage.clear();

        // 4. Reload page (forces re-fetch from Vercel)
        window.location.reload();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flux = new FluxApp();
});