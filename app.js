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
            editBar: document.getElementById('edit-bar'),
            
            btnNew: document.getElementById('btn-new-board'),
            btnOpen: document.getElementById('btn-open-file'),
            btnSettings: document.getElementById('btn-settings-toggle'),
            btnHome: document.getElementById('btn-home'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            btnHardReset: document.getElementById('btn-hard-reset'),
            toolBtns: document.querySelectorAll('.bottom-toolbar .tool-btn'),
            
            settingsModal: document.getElementById('settings-modal'),
            colorModal: document.getElementById('color-modal'),
            strokeModal: document.getElementById('stroke-modal'),
            shapesModal: document.getElementById('shapes-modal'),
            btnCloseColor: document.getElementById('btn-close-color'),
            btnCloseStroke: document.getElementById('btn-close-stroke'),
            btnCloseShapes: document.getElementById('btn-close-shapes'),
            
            themeToggle: document.getElementById('theme-toggle'),
            gridToggle: document.getElementById('grid-toggle'),
            fileInput: document.getElementById('file-input'),

            btnColorPicker: document.getElementById('btn-color-picker'),
            btnFillPicker: document.getElementById('btn-fill-picker'),
            btnStrokePicker: document.getElementById('btn-stroke-picker'),
            colorDots: document.querySelectorAll('#color-modal .color-dot'),
            colorOptEmpty: document.getElementById('color-opt-empty'),
            shapeOptBtns: document.querySelectorAll('.shape-opt-btn'),
            
            strokeSlider: document.getElementById('input-stroke-slider'),
            strokeNumber: document.getElementById('input-stroke-number'),
            btnStrokeMinus: document.getElementById('btn-stroke-minus'),
            btnStrokePlus: document.getElementById('btn-stroke-plus'),

            styleBtns: document.querySelectorAll('[data-style]'),
            arrowBtns: document.querySelectorAll('[data-arrow]'),
            btnDuplicate: document.getElementById('btn-duplicate'),
            btnDelete: document.getElementById('btn-delete')
        };
        
        this.state = {
            isReady: false,
            boardActive: false,
            activeTool: 'select',
            pickingMode: 'stroke'
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
                if (tool === 'line') this.createLineAction();
                else if (tool === 'shape') this.dom.shapesModal.classList.remove('hidden');
                else this.selectTool(tool);
            });
        });

        this.dom.btnSettings.addEventListener('click', () => this.dom.settingsModal.classList.remove('hidden'));
        this.dom.btnCloseSettings.addEventListener('click', () => this.dom.settingsModal.classList.add('hidden'));
        
        this.dom.btnColorPicker.addEventListener('click', () => {
            this.state.pickingMode = 'stroke';
            document.getElementById('color-modal-title').textContent = 'Stroke Color';
            this.dom.colorModal.classList.remove('hidden');
        });
        
        this.dom.btnFillPicker.addEventListener('click', () => {
            this.state.pickingMode = 'fill';
            document.getElementById('color-modal-title').textContent = 'Fill Color';
            this.dom.colorModal.classList.remove('hidden');
        });
        
        this.dom.btnCloseColor.addEventListener('click', () => this.dom.colorModal.classList.add('hidden'));
        this.dom.btnStrokePicker.addEventListener('click', () => this.dom.strokeModal.classList.remove('hidden'));
        this.dom.btnCloseStroke.addEventListener('click', () => this.dom.strokeModal.classList.add('hidden'));
        this.dom.btnCloseShapes.addEventListener('click', () => this.dom.shapesModal.classList.add('hidden'));

        [this.dom.settingsModal, this.dom.colorModal, this.dom.strokeModal, this.dom.shapesModal].forEach(modal => {
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
        });

        this.dom.themeToggle.addEventListener('change', (e) => {
            const isLight = e.target.checked;
            document.body.classList.toggle('light-mode', isLight);
            localStorage.setItem('flux-theme', isLight ? 'light' : 'dark');
            if(this.whiteboard) this.whiteboard.updateThemeColors(isLight);
        });

        this.dom.gridToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            localStorage.setItem('flux-grid', isEnabled);
            if(this.whiteboard) this.whiteboard.setGridEnabled(isEnabled);
        });

        this.dom.btnHardReset.addEventListener('click', () => this.hardResetApp());

        this.dom.colorDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const color = dot.getAttribute('data-color');
                const isStroke = this.state.pickingMode === 'stroke';
                
                this.updateSelectedProperty(el => {
                    if (isStroke) {
                        if (color === 'auto') {
                            const isLight = document.body.classList.contains('light-mode');
                            el.color = isLight ? '#1a1a1d' : '#ffffff'; el.isAutoColor = true;
                        } else { el.color = color; el.isAutoColor = false; }
                    } else {
                        if (color === 'auto') {
                            const isLight = document.body.classList.contains('light-mode');
                            el.fillColor = isLight ? '#1a1a1d' : '#ffffff'; el.isAutoFill = true;
                        } else { el.fillColor = color; el.isAutoFill = false; }
                    }
                });
                this.dom.colorModal.classList.add('hidden');
                this.updateEditBar();
            });
        });

        const handleWidthChange = (val) => {
            const num = Math.min(Math.max(parseInt(val) || 1, 1), 50);
            this.updateSelectedProperty(el => {
                if (el.type === 'shape') el.strokeWidth = num;
                else el.width = num;
            });
            this.syncStrokeUI(num);
        };

        this.dom.strokeSlider.addEventListener('input', (e) => handleWidthChange(e.target.value));
        this.dom.strokeNumber.addEventListener('change', (e) => handleWidthChange(e.target.value));
        this.dom.btnStrokeMinus.addEventListener('click', () => handleWidthChange(parseInt(this.dom.strokeNumber.value) - 1));
        this.dom.btnStrokePlus.addEventListener('click', () => handleWidthChange(parseInt(this.dom.strokeNumber.value) + 1));

        this.dom.shapeOptBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-shape');
                const isLight = document.body.classList.contains('light-mode');
                this.whiteboard.addShape(type, isLight ? '#1a1a1d' : '#ffffff');
                this.dom.shapesModal.classList.add('hidden');
                this.selectTool('select');
            });
        });

        this.dom.styleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const style = btn.getAttribute('data-style');
                this.updateSelectedProperty(el => el.dashStyle = style);
                this.dom.styleBtns.forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        this.dom.arrowBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-arrow');
                this.updateSelectedProperty(el => {
                    if (type === 'start') el.arrowStart = !el.arrowStart;
                    if (type === 'end') el.arrowEnd = !el.arrowEnd;
                });
                btn.classList.toggle('active');
            });
        });

        this.dom.btnDuplicate.addEventListener('click', () => this.whiteboard.duplicateSelected());
        this.dom.btnDelete.addEventListener('click', () => this.whiteboard.deleteSelected());
    }

    syncStrokeUI(val) {
        this.dom.btnStrokePicker.textContent = `${val}px`;
        this.dom.strokeSlider.value = val;
        this.dom.strokeNumber.value = val;
    }

    syncPickerButtonAppearance(btn, color, isAuto) {
        if (isAuto) { btn.className = 'color-dot auto'; btn.style.background = ''; }
        else if (color === 'transparent') { btn.className = 'color-dot transparent'; btn.style.background = ''; }
        else { btn.className = 'color-dot'; btn.style.background = color; }
    }

    updateSelectedProperty(callback) {
        if (!this.whiteboard) return;
        this.whiteboard.interaction.selectedElements.forEach(callback);
        this.whiteboard.render();
    }

    updateEditBar() {
        if (!this.whiteboard) return;
        const selected = this.whiteboard.interaction.selectedElements;
        if (selected.length > 0) {
            this.dom.editBar.classList.remove('hidden');
            if (selected.length === 1) {
                const el = selected[0];
                this.syncStrokeUI(el.strokeWidth || el.width || 3);
                this.dom.styleBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-style') === el.dashStyle));
                
                const isLine = el.type === 'line';
                const isShape = el.type === 'shape';

                this.dom.arrowBtns.forEach(b => {
                    b.style.display = isLine ? 'flex' : 'none';
                    const type = b.getAttribute('data-arrow');
                    b.classList.toggle('active', isLine && ((type === 'start' && el.arrowStart) || (type === 'end' && el.arrowEnd)));
                });
                const arrowDivider = this.dom.arrowBtns[0].parentElement.previousElementSibling;
                if(arrowDivider) arrowDivider.style.display = isLine ? 'block' : 'none';
                
                // Show Empty Option in Color Modal ONLY for Shapes
                this.dom.colorOptEmpty.style.display = isShape ? 'flex' : 'none';

                this.dom.btnFillPicker.style.display = isShape ? 'flex' : 'none';
                if (isShape) {
                    this.syncPickerButtonAppearance(this.dom.btnFillPicker, el.fillColor, el.isAutoFill);
                }

                this.syncPickerButtonAppearance(this.dom.btnColorPicker, el.color, el.isAutoColor);
            } else {
                this.dom.arrowBtns.forEach(b => b.style.display = 'none');
            }
        } else {
            this.dom.editBar.classList.add('hidden');
            this.dom.colorModal.classList.add('hidden');
            this.dom.strokeModal.classList.add('hidden');
            this.dom.shapesModal.classList.add('hidden');
        }
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
        this.dom.toolBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tool') === toolId));
        if (this.whiteboard) {
            this.whiteboard.render();
            if (toolId !== 'select') { this.dom.editBar.classList.add('hidden'); this.whiteboard.interaction.selectedElements = []; }
        }
    }

    startNewBoard() {
        if(this.whiteboard) this.whiteboard.clearBoard();
        this.dom.menu.classList.add('hidden');
        this.dom.canvas.classList.remove('hidden');
        this.dom.toolbar.classList.remove('hidden');
        this.state.boardActive = true;
        this.dom.btnHome.classList.remove('hidden');
        if(this.whiteboard) this.whiteboard.resize();
    }

    returnToHome() {
        this.dom.canvas.classList.add('hidden'); this.dom.toolbar.classList.add('hidden'); this.dom.editBar.classList.add('hidden');
        this.state.boardActive = false; this.dom.btnHome.classList.add('hidden'); this.dom.menu.classList.remove('hidden');
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
            localStorage.clear(); sessionStorage.clear(); window.location.reload(true);
        } catch (e) { console.error("Flux Reset Failed:", e); window.location.reload(); }
    }
}

document.addEventListener('DOMContentLoaded', () => { window.flux = new FluxApp(); });