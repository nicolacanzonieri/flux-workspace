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

            // Text Editing Controls
            groupTextActions: document.getElementById('group-text-actions'),
            dividerTextActions: document.getElementById('divider-text-actions'),
            btnEditText: document.getElementById('btn-edit-text'),
            btnTextSizeUp: document.getElementById('btn-text-size-up'),
            btnTextSizeDown: document.getElementById('btn-text-size-down'),

            styleBtns: document.querySelectorAll('[data-style]'),
            arrowBtns: document.querySelectorAll('[data-arrow]'),
            btnDuplicate: document.getElementById('btn-duplicate'),
            btnDelete: document.getElementById('btn-delete')
        };
        
        this.state = { isReady: false, boardActive: false, activeTool: 'select', pickingMode: 'stroke' };
        this.whiteboard = null;
        this.init();
    }

    async init() {
        console.log("Flux: Initializing Workspace...");
        if(typeof FluxWhiteboard !== 'undefined') this.whiteboard = new FluxWhiteboard('flux-canvas');
        this.loadSettings(); this.revealApplication(); this.bindEvents();
    }

    async revealApplication() {
        this.dom.app.classList.remove('hidden'); this.dom.app.classList.add('visible');
        await new Promise(r => setTimeout(r, 500)); this.dom.mainTitle.classList.add('fade-in');
        await new Promise(r => setTimeout(r, 800)); this.dom.splash.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 600)); this.dom.mainTitle.classList.remove('initial-center');
        await new Promise(r => setTimeout(r, 400)); this.dom.menuContent.classList.remove('invisible');
        this.dom.menuContent.classList.add('fade-in'); this.state.isReady = true;
    }

    loadSettings() {
        const t = localStorage.getItem('flux-theme'); if(t==='light'){ document.body.classList.add('light-mode'); this.dom.themeToggle.checked=true; }
        const g = localStorage.getItem('flux-grid'); if(g==='false'){ this.dom.gridToggle.checked=false; if(this.whiteboard) this.whiteboard.setGridEnabled(false); }
    }

    bindEvents() {
        this.dom.btnNew.addEventListener('click', () => this.startNewBoard());
        this.dom.btnHome.addEventListener('click', () => this.returnToHome());

        this.dom.toolBtns.forEach(btn => btn.addEventListener('click', () => {
            const t = btn.getAttribute('data-tool');
            if(t === 'line') this.createLineAction();
            else if(t === 'shape') this.dom.shapesModal.classList.remove('hidden');
            else if(t === 'text') this.createTextAction();
            else this.selectTool(t);
        }));

        this.dom.btnSettings.addEventListener('click', () => this.dom.settingsModal.classList.remove('hidden'));
        this.dom.btnColorPicker.addEventListener('click', () => { this.state.pickingMode = 'stroke'; document.getElementById('color-modal-title').textContent = 'Color'; this.dom.colorModal.classList.remove('hidden'); });
        this.dom.btnFillPicker.addEventListener('click', () => { this.state.pickingMode = 'fill'; document.getElementById('color-modal-title').textContent = 'Fill Color'; this.dom.colorModal.classList.remove('hidden'); });
        this.dom.btnStrokePicker.addEventListener('click', () => this.dom.strokeModal.classList.remove('hidden'));
        [this.dom.btnCloseSettings, this.dom.btnCloseColor, this.dom.btnCloseStroke, this.dom.btnCloseShapes].forEach(b => b.addEventListener('click', () => b.closest('.modal-overlay').classList.add('hidden')));
        [this.dom.settingsModal, this.dom.colorModal, this.dom.strokeModal, this.dom.shapesModal].forEach(m => m.addEventListener('click', e => { if(e.target === m) m.classList.add('hidden'); }));

        this.dom.themeToggle.addEventListener('change', e => {
            const isL = e.target.checked; document.body.classList.toggle('light-mode', isL);
            localStorage.setItem('flux-theme', isL ? 'light' : 'dark'); if(this.whiteboard) this.whiteboard.updateThemeColors(isL);
        });

        this.dom.gridToggle.addEventListener('change', e => { localStorage.setItem('flux-grid', e.target.checked); if(this.whiteboard) this.whiteboard.setGridEnabled(e.target.checked); });
        this.dom.btnHardReset.addEventListener('click', () => this.hardResetApp());

        this.dom.colorDots.forEach(dot => dot.addEventListener('click', () => {
            const color = dot.getAttribute('data-color');
            this.updateSelectedProperty(el => {
                if(this.state.pickingMode === 'stroke') {
                    if(color === 'auto') { el.color = document.body.classList.contains('light-mode') ? '#1a1a1d' : '#ffffff'; el.isAutoColor = true; }
                    else { el.color = color; el.isAutoColor = false; }
                } else {
                    if(color === 'auto') { el.fillColor = document.body.classList.contains('light-mode') ? '#1a1a1d' : '#ffffff'; el.isAutoFill = true; }
                    else { el.fillColor = color; el.isAutoFill = false; }
                }
            });
            this.dom.colorModal.classList.add('hidden'); this.updateEditBar();
        }));

        const handleWidth = v => { const n = Math.min(Math.max(parseInt(v)||1, 1), 50); this.updateSelectedProperty(el => { if(el.type==='shape') el.strokeWidth=n; else el.width=n; }); this.syncStrokeUI(n); };
        this.dom.strokeSlider.addEventListener('input', e => handleWidth(e.target.value));
        this.dom.strokeNumber.addEventListener('change', e => handleWidth(e.target.value));
        this.dom.btnStrokeMinus.addEventListener('click', () => handleWidth(parseInt(this.dom.strokeNumber.value)-1));
        this.dom.btnStrokePlus.addEventListener('click', () => handleWidth(parseInt(this.dom.strokeNumber.value)+1));

        this.dom.shapeOptBtns.forEach(btn => btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-shape');
            this.whiteboard.addShape(type, document.body.classList.contains('light-mode') ? '#1a1a1d' : '#ffffff');
            this.dom.shapesModal.classList.add('hidden'); this.selectTool('select');
        }));

        // Text Size Events
        this.dom.btnTextSizeUp.addEventListener('click', () => this.updateSelectedProperty(el => el.fontSize += 2));
        this.dom.btnTextSizeDown.addEventListener('click', () => this.updateSelectedProperty(el => el.fontSize = Math.max(8, el.fontSize - 2)));
        this.dom.btnEditText.addEventListener('click', () => {
            // Placeholder for future markdown editor logic
            console.log("Flux: Opening Markdown Editor Placeholder...");
        });

        this.dom.styleBtns.forEach(btn => btn.addEventListener('click', () => {
            const s = btn.getAttribute('data-style'); this.updateSelectedProperty(el => el.dashStyle = s);
            this.dom.styleBtns.forEach(b => b.classList.toggle('active', b === btn));
        }));

        this.dom.arrowBtns.forEach(btn => btn.addEventListener('click', () => {
            const t = btn.getAttribute('data-arrow'); this.updateSelectedProperty(el => { if(t==='start') el.arrowStart=!el.arrowStart; if(t==='end') el.arrowEnd=!el.arrowEnd; }); btn.classList.toggle('active');
        }));

        this.dom.btnDuplicate.addEventListener('click', () => this.whiteboard.duplicateSelected());
        this.dom.btnDelete.addEventListener('click', () => this.whiteboard.deleteSelected());
    }

    syncStrokeUI(v) { this.dom.btnStrokePicker.textContent = `${v}px`; this.dom.strokeSlider.value = v; this.dom.strokeNumber.value = v; }
    syncPickerButtonAppearance(btn, c, isA) { if(isA){ btn.className='color-dot auto'; btn.style.background=''; } else if(c==='transparent'){ btn.className='color-dot transparent'; btn.style.background=''; } else { btn.className='color-dot'; btn.style.background=c; } }
    updateSelectedProperty(cb) { if(this.whiteboard) { this.whiteboard.interaction.selectedElements.forEach(cb); this.whiteboard.render(); this.updateEditBar(); } }

    updateEditBar() {
        if(!this.whiteboard) return;
        const sel = this.whiteboard.interaction.selectedElements;
        if(sel.length > 0) {
            this.dom.editBar.classList.remove('hidden');
            if(sel.length === 1) {
                const el = sel[0];
                const isL = el.type === 'line', isS = el.type === 'shape', isT = el.type === 'text';
                
                // Toggle sections visibility
                this.dom.dividerTextActions.style.display = isT ? 'block' : 'none';
                this.dom.groupTextActions.style.display = isT ? 'flex' : 'none';
                
                document.getElementById('divider-stroke').style.display = isT ? 'none' : 'block';
                document.getElementById('group-stroke').style.display = isT ? 'none' : 'flex';
                document.getElementById('divider-style').style.display = isT ? 'none' : 'block';
                document.getElementById('group-style').style.display = isT ? 'none' : 'flex';
                document.getElementById('divider-arrows').style.display = isL ? 'block' : 'none';
                document.getElementById('group-arrows').style.display = isL ? 'flex' : 'none';

                this.dom.btnFillPicker.style.display = isS ? 'flex' : 'none';
                this.dom.colorOptEmpty.style.display = isS ? 'flex' : 'none';

                if(!isT) this.syncStrokeUI(el.strokeWidth || el.width || 3);
                if(isS) this.syncPickerButtonAppearance(this.dom.btnFillPicker, el.fillColor, el.isAutoFill);
                this.syncPickerButtonAppearance(this.dom.btnColorPicker, el.color, el.isAutoColor);
            }
        } else this.dom.editBar.classList.add('hidden');
    }

    createLineAction() { if(this.whiteboard){ const isL = document.body.classList.contains('light-mode'); this.whiteboard.addLine(isL ? '#1a1a1d' : '#ffffff'); this.selectTool('select'); } }
    createTextAction() { if(this.whiteboard){ const isL = document.body.classList.contains('light-mode'); this.whiteboard.addText(isL ? '#1a1a1d' : '#ffffff'); this.selectTool('select'); } }

    selectTool(t) {
        this.state.activeTool = t; this.dom.toolBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tool') === t));
        if(this.whiteboard){ this.whiteboard.render(); if(t !== 'select'){ this.dom.editBar.classList.add('hidden'); this.whiteboard.interaction.selectedElements = []; } }
    }

    startNewBoard() { if(this.whiteboard) this.whiteboard.clearBoard(); this.dom.menu.classList.add('hidden'); this.dom.canvas.classList.remove('hidden'); this.dom.toolbar.classList.remove('hidden'); this.state.boardActive = true; this.dom.btnHome.classList.remove('hidden'); if(this.whiteboard) this.whiteboard.resize(); }
    returnToHome() { this.dom.canvas.classList.add('hidden'); this.dom.toolbar.classList.add('hidden'); this.dom.editBar.classList.add('hidden'); this.state.boardActive = false; this.dom.btnHome.classList.add('hidden'); this.dom.menu.classList.remove('hidden'); }
    async hardResetApp() { if(!confirm("Reset app?")) return; try { if(navigator.serviceWorker){ const rs=await navigator.serviceWorker.getRegistrations(); for(let r of rs) await r.unregister(); } if(window.caches){ const ns=await caches.keys(); for(let n of ns) await caches.delete(n); } localStorage.clear(); sessionStorage.clear(); location.reload(true); } catch(e){ location.reload(); } }
}
document.addEventListener('DOMContentLoaded', () => window.flux = new FluxApp());