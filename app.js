/**
 * @class FluxApp
 * @description Main controller for the Flux Workspace application.
 * Manages the application lifecycle, UI state, and tool coordination.
 */
class FluxApp {
    constructor() {
        /** @type {Object} References to key DOM elements */
        this.dom = {
            splash: document.getElementById('splash-screen'),
            app: document.getElementById('app'),
            menu: document.getElementById('home-menu'),
            mainTitle: document.getElementById('main-title'),
            menuContent: document.getElementById('menu-content'),
            canvas: document.getElementById('flux-canvas'),
            toolbar: document.getElementById('toolbar'),
            
            btnNew: document.getElementById('btn-new-board'),
            btnOpen: document.getElementById('btn-open-file'),
            btnSettings: document.getElementById('btn-settings-toggle'),
            btnHome: document.getElementById('btn-home'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            btnHardReset: document.getElementById('btn-hard-reset'),
            toolBtns: document.querySelectorAll('.tool-btn'),
            
            settingsModal: document.getElementById('settings-modal'),
            themeToggle: document.getElementById('theme-toggle'),
            gridToggle: document.getElementById('grid-toggle'),
            fileInput: document.getElementById('file-input')
        };
        
        /** @type {Object} Core application state */
        this.state = {
            isReady: false,
            boardActive: false,
            activeTool: 'select'
        };

        /** @type {FluxWhiteboard|null} Reference to the whiteboard engine */
        this.whiteboard = null;

        this.init();
    }

    /**
     * @async
     * @method init
     * @description Initializes modules, loads user settings, and triggers the reveal sequence.
     */
    async init() {
        console.log("Flux: Initializing Workspace...");
        
        if(typeof FluxWhiteboard !== 'undefined') {
            this.whiteboard = new FluxWhiteboard('flux-canvas');
        }

        this.loadSettings();
        this.revealApplication();
        this.bindEvents();
    }

    /**
     * @async
     * @method revealApplication
     * @description Coordinates the cinematic intro sequence: Curtain fade -> Title Reveal -> Menu Entry.
     */
    async revealApplication() {
        this.dom.app.classList.remove('hidden');
        this.dom.app.classList.add('visible');

        // Allow some time for resources to settle
        await new Promise(r => setTimeout(r, 500));
        
        // Phase 1: Center Title fade in
        this.dom.mainTitle.classList.add('fade-in');

        // Phase 2: Curtain opens (Fade out splash)
        await new Promise(r => setTimeout(r, 800));
        this.dom.splash.classList.add('fade-out');

        // Phase 3: Title moves to its menu position
        await new Promise(r => setTimeout(r, 600));
        this.dom.mainTitle.classList.remove('initial-center');
        
        // Phase 4: Subtitle and buttons appear
        await new Promise(r => setTimeout(r, 400));
        this.dom.menuContent.classList.remove('invisible');
        this.dom.menuContent.classList.add('fade-in');
        
        this.state.isReady = true;
    }

    /**
     * @method loadSettings
     * @description Restores user preferences (Theme, Grid) from LocalStorage.
     */
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

    /**
     * @method bindEvents
     * @description Attaches event listeners for navigation, settings, and tools.
     */
    bindEvents() {
        // Global Navigation
        this.dom.btnNew.addEventListener('click', () => this.startNewBoard());
        this.dom.btnHome.addEventListener('click', () => this.returnToHome());

        // Toolbar Interaction
        this.dom.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');
                this.selectTool(tool);
            });
        });

        // Settings Modal Controls
        this.dom.btnSettings.addEventListener('click', () => this.dom.settingsModal.classList.remove('hidden'));
        this.dom.btnCloseSettings.addEventListener('click', () => this.dom.settingsModal.classList.add('hidden'));
        this.dom.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.settingsModal) this.dom.settingsModal.classList.add('hidden');
        });

        // Feature Toggles
        this.dom.themeToggle.addEventListener('change', (e) => {
            const isLight = e.target.checked;
            document.body.classList.toggle('light-mode', isLight);
            localStorage.setItem('flux-theme', isLight ? 'light' : 'dark');
            if(this.whiteboard) this.whiteboard.render(); // Redraw grid for color updates
        });

        this.dom.gridToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            localStorage.setItem('flux-grid', isEnabled);
            if(this.whiteboard) this.whiteboard.setGridEnabled(isEnabled);
        });

        this.dom.btnHardReset.addEventListener('click', () => this.hardResetApp());
    }

    /**
     * @method selectTool
     * @param {string} toolId - The unique ID of the tool to activate.
     */
    selectTool(toolId) {
        this.state.activeTool = toolId;
        console.log(`Flux: Switching to tool [${toolId}]`);

        this.dom.toolBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tool') === toolId);
        });
    }

    /**
     * @method startNewBoard
     * @description Transitions UI from Menu to Active Board mode.
     */
    startNewBoard() {
        this.dom.menu.classList.add('hidden');
        this.dom.canvas.classList.remove('hidden');
        this.dom.toolbar.classList.remove('hidden');
        
        this.state.boardActive = true;
        this.dom.btnHome.classList.remove('hidden');
        
        if(this.whiteboard) this.whiteboard.resize();
    }

    /**
     * @method returnToHome
     * @description Transitions UI from Board back to the Main Menu.
     */
    returnToHome() {
        this.dom.canvas.classList.add('hidden');
        this.dom.toolbar.classList.add('hidden');
        
        this.state.boardActive = false;
        this.dom.btnHome.classList.add('hidden');
        this.dom.menu.classList.remove('hidden');
    }

    /**
     * @async
     * @method hardResetApp
     * @description Wipes SW, Cache, and Storage to force a clean update from the server.
     */
    async hardResetApp() {
        if(!confirm("Warning: This will clear all data and update Flux. Proceed?")) return;

        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let r of regs) await r.unregister();
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        localStorage.clear();
        window.location.reload();
    }
}

// Global App Initialization
document.addEventListener('DOMContentLoaded', () => { window.flux = new FluxApp(); });