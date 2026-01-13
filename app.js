/**
 * @class FluxApp
 * @description Main controller for the Flux Workspace application.
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
        
        this.state = {
            isReady: false,
            boardActive: false,
            activeTool: 'select'
        };

        this.whiteboard = null;
        this.init();
    }

    async init() {
        console.log("Flux: Initializing Workspace...");
        if(typeof FluxWhiteboard !== 'undefined') {
            this.whiteboard = new FluxWhiteboard('flux-canvas');
        }
        this.loadSettings();
        this.revealApplication();
        this.bindEvents();
    }

    async revealApplication() {
        this.dom.app.classList.remove('hidden');
        this.dom.app.classList.add('visible');
        await new Promise(r => setTimeout(r, 500));
        this.dom.mainTitle.classList.add('fade-in');
        await new Promise(r => setTimeout(r, 800));
        this.dom.splash.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 600));
        this.dom.mainTitle.classList.remove('initial-center');
        await new Promise(r => setTimeout(r, 400));
        this.dom.menuContent.classList.remove('invisible');
        this.dom.menuContent.classList.add('fade-in');
        this.state.isReady = true;
    }

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

        this.dom.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');
                if (tool === 'line') {
                    this.createLineAction();
                } else {
                    this.selectTool(tool);
                }
            });
        });

        this.dom.btnSettings.addEventListener('click', () => this.dom.settingsModal.classList.remove('hidden'));
        this.dom.btnCloseSettings.addEventListener('click', () => this.dom.settingsModal.classList.add('hidden'));
        this.dom.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.dom.settingsModal) this.dom.settingsModal.classList.add('hidden');
        });

        this.dom.themeToggle.addEventListener('change', (e) => {
            const isLight = e.target.checked;
            document.body.classList.toggle('light-mode', isLight);
            localStorage.setItem('flux-theme', isLight ? 'light' : 'dark');
            if(this.whiteboard) {
                this.whiteboard.updateThemeColors(isLight);
            }
        });

        this.dom.gridToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            localStorage.setItem('flux-grid', isEnabled);
            if(this.whiteboard) this.whiteboard.setGridEnabled(isEnabled);
        });

        this.dom.btnHardReset.addEventListener('click', () => this.hardResetApp());
    }

    createLineAction() {
        if (!this.whiteboard) return;
        const isLightMode = document.body.classList.contains('light-mode');
        const lineColor = isLightMode ? '#1a1a1d' : '#ffffff';
        this.whiteboard.addLine(lineColor);
        this.selectTool('select');
    }

    selectTool(toolId) {
        this.state.activeTool = toolId;
        this.dom.toolBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tool') === toolId);
        });
        
        // Clear selection marquee if tool changes mid-way
        if (this.whiteboard) {
            this.whiteboard.render();
        }
    }

    startNewBoard() {
        this.dom.menu.classList.add('hidden');
        this.dom.canvas.classList.remove('hidden');
        this.dom.toolbar.classList.remove('hidden');
        this.state.boardActive = true;
        this.dom.btnHome.classList.remove('hidden');
        if(this.whiteboard) this.whiteboard.resize();
    }

    returnToHome() {
        this.dom.canvas.classList.add('hidden');
        this.dom.toolbar.classList.add('hidden');
        this.state.boardActive = false;
        this.dom.btnHome.classList.add('hidden');
        this.dom.menu.classList.remove('hidden');
    }

    async hardResetApp() {
        const confirmed = confirm("This action will clear all local settings and force a fresh download of Flux Workspace. Proceed?");
        if(!confirmed) return;
        try {
            if (window.navigator.serviceWorker) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let r of regs) await r.unregister();
            }
            if (window.caches) {
                const names = await caches.keys();
                for (let n of names) await caches.delete(n);
            }
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload(true);
        } catch (e) {
            console.error("Flux Reset Failed:", e);
            window.location.reload();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    window.flux = new FluxApp(); 
});