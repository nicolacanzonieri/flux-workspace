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
            
            // Library Components
            libNav: document.querySelector('.top-left-nav'),
            btnLibToggle: document.getElementById('btn-library-toggle'),
            libPopup: document.getElementById('library-popup'),
            libBoardList: document.getElementById('library-board-list'),
            btnLibNewBoard: document.getElementById('btn-lib-new-board'),

            btnCloseSettings: document.getElementById('btn-close-settings'),
            btnHardReset: document.getElementById('btn-hard-reset'),
            toolBtns: document.querySelectorAll('.bottom-toolbar .tool-btn'),
            
            settingsModal: document.getElementById('settings-modal'),
            colorModal: document.getElementById('color-modal'),
            strokeModal: document.getElementById('stroke-modal'),
            shapesModal: document.getElementById('shapes-modal'),
            
            // Markdown Editor
            editorOverlay: document.getElementById('markdown-editor-overlay'),
            mdInput: document.getElementById('md-input'),
            btnCloseEditor: document.getElementById('btn-close-editor'),
            mdBtns: document.querySelectorAll('.md-btn'), 

            // Formula Editor
            formulaOverlay: document.getElementById('formula-editor-overlay'),
            formulaInput: document.getElementById('formula-input'),
            btnCloseFormula: document.getElementById('btn-close-formula'),
            latexBtns: document.querySelectorAll('.latex-btn'),

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
        
        this.state = { 
            isReady: false, 
            boardActive: false, 
            activeTool: 'select', 
            pickingMode: 'stroke',
            activeBoardId: null,
            editingElementId: null
        };

        this.project = {
            name: "Untitled Project",
            boards: []
        };
        
        this.katexStyles = "";
        this.whiteboard = null;
        this.init();
    }

    async init() {
        console.log("Flux: Initializing Workspace...");
        this.loadExternalStyles();
        if(typeof FluxWhiteboard !== 'undefined') this.whiteboard = new FluxWhiteboard('flux-canvas');
        this.loadSettings(); this.revealApplication(); this.bindEvents();
    }

    async loadExternalStyles() {
        try {
            const response = await fetch('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css');
            if (response.ok) {
                this.katexStyles = await response.text();
            }
        } catch (e) {
            console.warn("Flux: Failed to load KaTeX styles.", e);
        }
    }

    async revealApplication() {
        this.dom.app.classList.remove('hidden'); this.dom.app.classList.add('visible');
        await new Promise(r => setTimeout(r, 500)); this.dom.mainTitle.classList.add('fade-in');
        await new Promise(r => setTimeout(r, 800)); this.dom.splash.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 600)); this.dom.mainTitle.classList.remove('initial-center');
        await new Promise(r => setTimeout(r, 400)); this.dom.menuContent.classList.remove('invisible');
        this.dom.menuContent.classList.add('fade-in'); this.state.isReady = true;
    }

    saveCurrentBoardState() {
        if (this.state.activeBoardId && this.whiteboard) {
            const board = this.project.boards.find(b => b.id === this.state.activeBoardId);
            if (board) {
                const currentState = this.whiteboard.getState();
                board.elements = currentState.elements;
                board.view = currentState.view;
            }
        }
    }

    loadSettings() {
        const t = localStorage.getItem('flux-theme'); if(t==='light'){ document.body.classList.add('light-mode'); this.dom.themeToggle.checked=true; }
        const g = localStorage.getItem('flux-grid'); if(g==='false'){ this.dom.gridToggle.checked=false; if(this.whiteboard) this.whiteboard.setGridEnabled(false); }
    }

    bindEvents() {
        this.dom.btnNew.addEventListener('click', () => this.startNewBoard());
        this.dom.btnHome.addEventListener('click', () => this.returnToHome());

        this.dom.btnLibToggle.addEventListener('click', (e) => { e.stopPropagation(); this.dom.libPopup.classList.toggle('hidden'); });
        window.addEventListener('click', () => this.dom.libPopup.classList.add('hidden'));
        this.dom.libPopup.addEventListener('click', (e) => e.stopPropagation());

        this.dom.btnLibNewBoard.addEventListener('click', () => {
            this.dom.libPopup.classList.add('hidden');
            this.addNewBoardToProject();
        });

        this.dom.toolBtns.forEach(btn => btn.addEventListener('click', () => {
            const t = btn.getAttribute('data-tool');
            if(t === 'line') this.createLineAction();
            else if(t === 'shape') this.dom.shapesModal.classList.remove('hidden');
            else if(t === 'text') this.createTextAction();
            else if(t === 'formula') this.createFormulaAction();
            else this.selectTool(t);
        }));

        this.dom.btnSettings.addEventListener('click', () => this.dom.settingsModal.classList.remove('hidden'));
        this.dom.btnColorPicker.addEventListener('click', () => { this.state.pickingMode = 'stroke'; document.getElementById('color-modal-title').textContent = 'Color'; this.dom.colorModal.classList.remove('hidden'); });
        this.dom.btnFillPicker.addEventListener('click', () => { this.state.pickingMode = 'fill'; document.getElementById('color-modal-title').textContent = 'Fill Color'; this.dom.colorModal.classList.remove('hidden'); });
        this.dom.btnStrokePicker.addEventListener('click', () => this.dom.strokeModal.classList.remove('hidden'));
        
        [this.dom.btnCloseSettings, this.dom.btnCloseColor, this.dom.btnCloseStroke, this.dom.btnCloseShapes].forEach(b => b.addEventListener('click', () => b.closest('.modal-overlay').classList.add('hidden')));

        this.dom.btnEditText.addEventListener('click', () => {
            const sel = this.whiteboard.interaction.selectedElements[0];
            if (sel) this.routeToEditor(sel);
        });

        this.dom.btnCloseEditor.addEventListener('click', () => this.saveAndCloseMarkdownEditor());
        this.dom.mdBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleMarkdownButton(btn.getAttribute('data-md'));
            });
        });

        this.dom.btnCloseFormula.addEventListener('click', () => this.saveAndCloseFormulaEditor());
        this.dom.latexBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLatexButton(btn.getAttribute('data-latex'));
            });
        });
        
        this.dom.canvas.addEventListener('flux-doubleclick', (e) => {
             const el = e.detail.element;
             if (el && el.type === 'text') {
                 this.whiteboard.interaction.selectedElements = [el];
                 this.updateEditBar();
                 this.routeToEditor(el);
             }
        });

        this.dom.themeToggle.addEventListener('change', e => {
            const isL = e.target.checked; document.body.classList.toggle('light-mode', isL);
            localStorage.setItem('flux-theme', isL ? 'light' : 'dark'); 
            if(this.whiteboard) {
                this.whiteboard.updateThemeColors(isL);
                this.whiteboard.elements.forEach(el => { if(el.type === 'text') el.renderedImage = null; });
                this.whiteboard.render();
            }
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
                if (el.type === 'text') el.renderedImage = null;
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

        this.dom.btnTextSizeUp.addEventListener('click', () => this.updateSelectedProperty(el => { el.fontSize += 2; if(el.type === 'text') el.renderedImage = null; }));
        this.dom.btnTextSizeDown.addEventListener('click', () => this.updateSelectedProperty(el => { el.fontSize = Math.max(8, el.fontSize - 2); if(el.type === 'text') el.renderedImage = null; }));

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

    /**
     * @method routeToEditor
     * @description Determines if the element is a LaTeX formula or Markdown text and opens the correct editor.
     */
    routeToEditor(el) {
        if (!el || el.type !== 'text') return;
        const content = el.content.trim();
        if (content.startsWith('$$') && content.endsWith('$$')) {
            this.openFormulaEditor();
        } else {
            this.openMarkdownEditor();
        }
    }

    openMarkdownEditor() {
        const el = this.whiteboard.interaction.selectedElements[0];
        if (!el || el.type !== 'text') return;
        this.state.editingElementId = el.id;
        this.dom.mdInput.value = el.content;
        this.dom.editorOverlay.classList.remove('hidden');
        this.dom.editBar.classList.add('hidden');
        this.dom.toolbar.classList.add('hidden');
        setTimeout(() => this.dom.mdInput.focus(), 100);
    }

    saveAndCloseMarkdownEditor() {
        const text = this.dom.mdInput.value;
        const elId = this.state.editingElementId;
        if (elId && this.whiteboard) {
            const el = this.whiteboard.elements.find(e => e.id === elId);
            if (el) {
                el.content = text;
                el.renderedImage = null; 
                this.whiteboard.render();
            }
        }
        this.state.editingElementId = null;
        this.dom.editorOverlay.classList.add('hidden');
        this.dom.toolbar.classList.remove('hidden');
        this.updateEditBar();
    }

    handleMarkdownButton(type) {
        const input = this.dom.mdInput;
        const start = input.selectionStart, end = input.selectionEnd, text = input.value, selected = text.substring(start, end);
        let prefix = '', suffix = '';
        switch(type) {
            case 'asterisk': prefix = '*'; break;
            case 'backslash': prefix = '\\'; break;
            case 'hash': prefix = '#'; break;
            case 'list': prefix = '- '; break;
            case 'task': prefix = '- [ ] '; break;
            case 'code': prefix = '```\n'; suffix = '\n```'; break;
            case 'math-inline': prefix = '$'; suffix = '$'; break;
            case 'math-block': prefix = '$$'; suffix = '$$'; break;
        }
        const replacement = prefix + selected + suffix;
        input.setRangeText(replacement);
        input.focus();
        if (selected.length === 0) input.setSelectionRange(start + prefix.length, start + prefix.length);
        else input.setSelectionRange(start, start + replacement.length);
    }

    createFormulaAction() {
        if (this.whiteboard) {
            const isL = document.body.classList.contains('light-mode');
            this.whiteboard.addFormula(isL ? '#1a1a1d' : '#ffffff');
            this.openFormulaEditor();
        }
    }

    openFormulaEditor() {
        const el = this.whiteboard.interaction.selectedElements[0];
        if (!el || el.type !== 'text') return;
        this.state.editingElementId = el.id;
        let content = el.content;
        if (content.startsWith('$$') && content.endsWith('$$')) {
            content = content.substring(2, content.length - 2).trim();
        }
        this.dom.formulaInput.value = content;
        this.dom.formulaOverlay.classList.remove('hidden');
        this.dom.editBar.classList.add('hidden');
        this.dom.toolbar.classList.add('hidden');
        setTimeout(() => this.dom.formulaInput.focus(), 100);
    }

    saveAndCloseFormulaEditor() {
        const rawLatex = this.dom.formulaInput.value;
        const elId = this.state.editingElementId;
        if (elId && this.whiteboard) {
            const el = this.whiteboard.elements.find(e => e.id === elId);
            if (el) {
                el.content = `$$ ${rawLatex} $$`;
                el.renderedImage = null; 
                this.whiteboard.render();
            }
        }
        this.state.editingElementId = null;
        this.dom.formulaOverlay.classList.add('hidden');
        this.dom.toolbar.classList.remove('hidden');
        this.updateEditBar();
        this.selectTool('select');
    }

    handleLatexButton(latex) {
        const input = this.dom.formulaInput;
        const start = input.selectionStart;
        let insertText = latex, cursorOffset = latex.length;
        if (latex.includes('{}')) cursorOffset = latex.indexOf('{}') + 1; 
        else if (latex.endsWith('{}')) cursorOffset = latex.length - 1;
        input.setRangeText(insertText);
        input.focus();
        input.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }

    syncStrokeUI(v) { this.dom.btnStrokePicker.textContent = `${v}px`; this.dom.strokeSlider.value = v; this.dom.strokeNumber.value = v; }
    syncPickerButtonAppearance(btn, c, isA) { if(isA){ btn.className='color-dot auto'; btn.style.background=''; } else if(c==='transparent'){ btn.className='color-dot transparent'; btn.style.background=''; } else { btn.className='color-dot'; btn.style.background=c; } }
    updateSelectedProperty(cb) { if(this.whiteboard) { this.whiteboard.interaction.selectedElements.forEach(cb); this.whiteboard.render(); this.updateEditBar(); } }

    updateEditBar() {
        if (this.state.editingElementId) {
            this.dom.editBar.classList.add('hidden');
            return;
        }
        if(!this.whiteboard) return;
        const sel = this.whiteboard.interaction.selectedElements;
        if(sel.length > 0) {
            this.dom.editBar.classList.remove('hidden');
            if(sel.length === 1) {
                const el = sel[0];
                const isL = el.type === 'line', isS = el.type === 'shape', isT = el.type === 'text';
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

    renderLibrary() {
        this.dom.libBoardList.innerHTML = '';
        this.project.boards.forEach(board => {
            const item = document.createElement('div');
            item.className = `library-item ${board.id === this.state.activeBoardId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="lib-item-info">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>
                    <span>${board.name}</span>
                </div>
                <div class="lib-actions">
                    <button class="lib-mini-btn rename" title="Rename">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-text-cursor-icon lucide-text-cursor"><path d="M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1"/><path d="M7 22h1a4 4 0 0 0 4-4v-1"/><path d="M7 2h1a4 4 0 0 1 4 4v1"/></svg>
                    </button>
                    <button class="lib-mini-btn delete danger" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
            item.querySelector('.lib-item-info').addEventListener('click', () => { this.switchToBoard(board.id); this.dom.libPopup.classList.add('hidden'); });
            item.querySelector('.rename').addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = prompt("Rename Board", board.name);
                if(newName && newName.trim() !== "") { board.name = newName.trim(); this.renderLibrary(); }
            });
            item.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if(confirm(`Are you sure you want to delete "${board.name}"?`)) {
                    this.project.boards = this.project.boards.filter(b => b.id !== board.id);
                    if (this.project.boards.length === 0) this.returnToHome();
                    else if(this.state.activeBoardId === board.id) this.switchToBoard(this.project.boards[this.project.boards.length - 1].id);
                    else this.renderLibrary();
                }
            });
            this.dom.libBoardList.appendChild(item);
        });
    }

    switchToBoard(id) {
        this.saveCurrentBoardState();
        this.state.activeBoardId = id;
        const board = this.project.boards.find(b => b.id === id);
        if (this.whiteboard && board) {
            this.whiteboard.loadState({ elements: board.elements, view: board.view });
            this.updateEditBar();
            this.whiteboard.render();
        }
        this.renderLibrary();
    }

    selectTool(t) {
        this.state.activeTool = t; this.dom.toolBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tool') === t));
        if(this.whiteboard){ this.whiteboard.render(); if(t !== 'select'){ this.dom.editBar.classList.add('hidden'); this.whiteboard.interaction.selectedElements = []; } }
    }

    startNewBoard() {
        if (this.project.boards.length === 0) this.addNewBoardToProject("Initial Board");
        this.dom.menu.classList.add('hidden');
        this.dom.canvas.classList.remove('hidden');
        this.dom.toolbar.classList.remove('hidden');
        this.dom.btnHome.classList.remove('hidden');
        this.dom.libNav.classList.remove('hidden');
        if(this.whiteboard) this.whiteboard.resize();
        this.state.boardActive = true;
        this.renderLibrary();
    }

    addNewBoardToProject(name) {
        this.saveCurrentBoardState();
        const id = Date.now();
        const boardName = name || `Board ${this.project.boards.length + 1}`;
        const newBoard = { id, name: boardName, elements: [], view: { offsetX: window.innerWidth / 2, offsetY: window.innerHeight / 2, scale: 1 } };
        this.project.boards.push(newBoard);
        this.state.activeBoardId = id;
        if(this.whiteboard) this.whiteboard.clearBoard();
        this.renderLibrary();
    }

    returnToHome() {
        this.project = { name: "Untitled Project", boards: [] };
        this.state.activeBoardId = null;
        this.dom.canvas.classList.add('hidden'); 
        this.dom.toolbar.classList.add('hidden'); 
        this.dom.editBar.classList.add('hidden');
        this.dom.btnHome.classList.add('hidden'); 
        this.dom.libNav.classList.add('hidden'); 
        this.state.boardActive = false; 
        this.dom.menu.classList.remove('hidden');
        this.renderLibrary();
    }

    async hardResetApp() { if(!confirm("Reset app?")) return; try { if(navigator.serviceWorker){ const rs=await navigator.serviceWorker.getRegistrations(); for(let r of rs) await r.unregister(); } if(window.caches){ const ns=await caches.keys(); for(let n of ns) await caches.delete(n); } localStorage.clear(); sessionStorage.clear(); location.reload(true); } catch(e){ location.reload(); } }
}
document.addEventListener('DOMContentLoaded', () => window.flux = new FluxApp());