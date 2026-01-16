/**
 * @class FluxWhiteboard
 * @description Advanced rendering engine for the infinite whiteboard.
 * Handles coordinates, zoom math, and high-performance canvas drawing.
 */
class FluxWhiteboard {
    /**
     * @param {string} canvasId - DOM ID of the target canvas element.
     */
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        /** @type {Object} Engine configuration */
        this.config = {
            gridEnabled: true,
            dotGap: 40,
            dotRadius: 1.2,
            minScale: 0.1,
            maxScale: 10,
            zoomSensitivity: 0.005,
            handleRadius: 10,
            handleHitThreshold: 35,
            hitThreshold: 25 
        };

        this.view = { offsetX: window.innerWidth / 2, offsetY: window.innerHeight / 2, scale: 1 };
        this.interaction = {
            isPanning: false, isDraggingHandle: false, isDraggingElements: false, isDrawingPath: false,
            isSelecting: false, selectionBox: null, selectedElements: [],
            draggedElement: null, draggedHandle: null, lastMouseX: 0, lastMouseY: 0,
            dragLastWorldPos: { x: 0, y: 0 }, initialTouchDistance: 0, initialTouchCenter: { x: 0, y: 0 },
            lastClickTime: 0,
            // Proportional scaling data
            initialWidth: 0, initialHeight: 0, aspectRatio: 1, initialFontSize: 16
        };

        this.history = {
            undoStack: [],
            redoStack: [],
            maxDepth: 50
        };

        this.elements = [];
        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleTouchEnd());
        this.resize();
    }

    /**
     * @method getState
     * @description Returns the current state of the whiteboard for saving.
     */
    getState() {
        const cleanElements = this.elements.map(el => {
            const copy = { ...el };
            if (copy.renderedImage) delete copy.renderedImage;
            if (copy.imgObj) delete copy.imgObj; 
            return copy;
        });

        return {
            elements: JSON.parse(JSON.stringify(cleanElements)),
            view: { ...this.view }
        };
    }

    /**
     * @method loadState
     * @description Loads a previously saved state and re-renders.
     */
    loadState(state) {
        if (!state) return;
        this.elements = state.elements || [];
        this.view = state.view || { offsetX: window.innerWidth / 2, offsetY: window.innerHeight / 2, scale: 1 };
        this.interaction.selectedElements = [];
        this.render();
    }

    clearBoard() {
        this.elements = []; this.interaction.selectedElements = []; this.interaction.selectionBox = null;
        this.view.offsetX = window.innerWidth / 2; this.view.offsetY = window.innerHeight / 2; this.view.scale = 1;
        this.render();
    }

    /**
     * @method getPointerPos
     * @description Normalizes pointer coordinates relative to the canvas element.
     */
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    screenToWorld(x, y) { return { x: (x - this.view.offsetX) / this.view.scale, y: (y - this.view.offsetY) / this.view.scale }; }
    worldToScreen(x, y) { return { x: x * this.view.scale + this.view.offsetX, y: y * this.view.scale + this.view.offsetY }; }

    /**
     * @method saveHistory
     * @description Salva lo stato attuale degli elementi prima di una modifica.
     */
    saveHistory() {
        const snapshot = JSON.stringify(this.elements);
        if (this.history.undoStack.length > 0 && this.history.undoStack[this.history.undoStack.length - 1] === snapshot) return;
        this.history.undoStack.push(snapshot);
        this.history.redoStack = []; 
        if (this.history.undoStack.length > this.history.maxDepth) this.history.undoStack.shift();
        if(window.flux) window.flux.syncHistoryUI();
    }

    undo() {
        if (this.history.undoStack.length === 0) return;
        this.history.redoStack.push(JSON.stringify(this.elements));
        const previousState = this.history.undoStack.pop();
        this.elements = JSON.parse(previousState);
        this.interaction.selectedElements = [];
        this.render();
        if(window.flux) { window.flux.syncHistoryUI(); window.flux.updateEditBar(); }
    }

    redo() {
        if (this.history.redoStack.length === 0) return;
        this.history.undoStack.push(JSON.stringify(this.elements));
        const nextState = this.history.redoStack.pop();
        this.elements = JSON.parse(nextState);
        this.interaction.selectedElements = [];
        this.render();
        if(window.flux) { window.flux.syncHistoryUI(); window.flux.updateEditBar(); }
    }

    addLine(color) {
        this.saveHistory();
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newLine = { id: Date.now(), type: 'line', p1: { x: center.x - 50, y: center.y }, p2: { x: center.x + 50, y: center.y }, color, isAutoColor: true, width: 3, dashStyle: 'solid', arrowStart: false, arrowEnd: false };
        this.elements.push(newLine); this.interaction.selectedElements = [newLine]; this.render(); if(window.flux) window.flux.updateEditBar();
    }

    startPath(color) {
        const newLine = { id: Date.now(), type: 'pen', points: [], color, isAutoColor: true, width: 3, dashStyle: 'solid' };
        this.elements.push(newLine); this.interaction.draggedElement = newLine; this.interaction.isDrawingPath = true;
    }

    addShape(shapeType, color) {
        this.saveHistory();
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newShape = { id: Date.now(), type: 'shape', shapeType, x: center.x - 100, y: center.y - 100, width: 200, height: 200, color, fillColor: 'transparent', isAutoColor: true, isAutoFill: false, strokeWidth: 3, dashStyle: 'solid' };
        this.elements.push(newShape); this.interaction.selectedElements = [newShape]; this.render(); if(window.flux) window.flux.updateEditBar();
    }

    addText(color) {
        this.saveHistory();
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newText = { id: Date.now(), type: 'text', content: "# New Text\nType **Markdown** or $LaTeX$ here...", x: center.x - 125, y: center.y - 75, width: 250, height: 150, color, isAutoColor: true, fontSize: 16, renderedImage: null };
        this.elements.push(newText); this.interaction.selectedElements = [newText]; this.render(); if(window.flux) window.flux.updateEditBar();
    }

    addFormula(color) {
        this.saveHistory();
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newFormula = { id: Date.now(), type: 'text', content: "$$ x = 0 $$", x: center.x - 100, y: center.y - 50, width: 200, height: 100, color, isAutoColor: true, fontSize: 16, renderedImage: null };
        this.elements.push(newFormula); this.interaction.selectedElements = [newFormula]; this.render(); if(window.flux) window.flux.updateEditBar();
    }

    addImage(src) {
        this.saveHistory();
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newImg = { id: Date.now(), type: 'image', src, x: center.x - 150, y: center.y - 150, width: 300, height: 300, imgObj: null };
        
        const temp = new Image();
        temp.onload = () => {
            const ratio = temp.width / temp.height;
            if (ratio > 1) newImg.height = newImg.width / ratio;
            else newImg.width = newImg.height * ratio;
            newImg.imgObj = temp;
            this.render();
        };
        temp.src = src;

        this.elements.push(newImg);
        this.interaction.selectedElements = [newImg];
        this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    /**
     * @method addPDF
     * @param {string} fileName - Name of the PDF file
     * @param {string} fileUrl - Base64 or Blob URL of the PDF file data
     */
    addPDF(fileName, fileUrl) {
        this.saveHistory();
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newPDF = {
            id: Date.now(),
            type: 'pdf',
            name: fileName,
            src: fileUrl, 
            x: center.x - 155, 
            y: center.y - 45,  
            width: 310,
            height: 90, 
            renderedImage: null
        };
        this.elements.push(newPDF);
        this.interaction.selectedElements = [newPDF];
        this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    duplicateSelected() {
        this.saveHistory();
        const newSelected = [];
        this.interaction.selectedElements.forEach(el => {
            const clone = JSON.parse(JSON.stringify(el)); clone.id = Date.now() + Math.random();
            const offset = 20 / this.view.scale;
            if (clone.type === 'line') { clone.p1.x += offset; clone.p1.y += offset; clone.p2.x += offset; clone.p2.y += offset; }
            else if (clone.type === 'pen') { clone.points.forEach(p => { p.x += offset; p.y += offset; }); }
            else if (clone.type === 'shape' || clone.type === 'text' || clone.type === 'image' || clone.type === 'pdf') { clone.x += offset; clone.y += offset; }
            if (clone.type === 'text' || clone.type === 'pdf') clone.renderedImage = null;
            this.elements.push(clone); newSelected.push(clone);
        });
        this.interaction.selectedElements = newSelected; this.render();
    }

    deleteSelected() {
        this.saveHistory();
        this.elements = this.elements.filter(el => !this.interaction.selectedElements.includes(el));
        this.interaction.selectedElements = []; this.render(); if(window.flux) window.flux.updateEditBar();
    }

    updateThemeColors(isLightMode) {
        const newColor = isLightMode ? '#1a1a1d' : '#ffffff';
        this.elements.forEach(el => { if (el.isAutoColor) el.color = newColor; if (el.isAutoFill) el.fillColor = newColor; });
        this.render();
    }

    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) this.applyZoom(1 - e.deltaY * this.config.zoomSensitivity, e.clientX, e.clientY);
        else { this.view.offsetX -= e.deltaX; this.view.offsetY -= e.deltaY; }
        this.render();
    }

    applyZoom(factor, x, y) {
        const newScale = Math.min(Math.max(this.view.scale * factor, this.config.minScale), this.config.maxScale);
        if (newScale === this.view.scale) return;
        const pointer = this.getPointerPos({ clientX: x, clientY: y });
        const mouseWorld = this.screenToWorld(pointer.x, pointer.y); 
        this.view.scale = newScale;
        this.view.offsetX = pointer.x - mouseWorld.x * this.view.scale; 
        this.view.offsetY = pointer.y - mouseWorld.y * this.view.scale;
    }

    handleMouseDown(e) {
        const pos = this.getPointerPos(e);
        const mouse = this.screenToWorld(pos.x, pos.y);
        const tool = window.flux.state.activeTool;

        // 1. PANNING
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (e.shiftKey || e.button === 1 || tool === 'pan') {
            this.interaction.isPanning = true; 
            this.interaction.lastMouseX = clientX;
            this.interaction.lastMouseY = clientY; 
            this.canvas.classList.add('panning');
            this.render(); return;
        }

        const now = Date.now();
        if (now - this.interaction.lastClickTime < 300) {
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const el = this.elements[i];
                if (this.isPointInElement(mouse, el) && el.type === 'text') {
                    this.canvas.dispatchEvent(new CustomEvent('flux-doubleclick', { detail: { element: el } }));
                    return;
                }
            }
        }
        this.interaction.lastClickTime = now;

        // 3. PEN TOOL
        if (tool === 'pen') {
            this.saveHistory();
            this.interaction.selectedElements = [];
            const isLight = document.body.classList.contains('light-mode');
            this.startPath(isLight ? '#1a1a1d' : '#ffffff');
            this.interaction.draggedElement.points.push({ x: mouse.x, y: mouse.y });
            this.render(); return;
        }

        // 4. DRAG HANDLE (Resizing)
        for (const el of this.interaction.selectedElements) {
            const handles = this.getElementHandles(el);
            for (let i = 0; i < handles.length; i++) {
                const h = handles[i];
                if (Math.hypot(mouse.x - h.x, mouse.y - h.y) * this.view.scale < this.config.handleHitThreshold) {
                    this.saveHistory();
                    this.interaction.isDraggingHandle = true; 
                    this.interaction.draggedElement = el;
                    this.interaction.draggedHandle = (h.id !== undefined) ? h.id : i; 
                    this.interaction.initialWidth = el.width || 0;
                    this.interaction.initialHeight = el.height || 0;
                    this.interaction.aspectRatio = (el.width / el.height) || 1;
                    this.interaction.initialFontSize = el.fontSize || 16;
                    return;
                }
            }
        }

        if (tool === 'select') {
            let hitFound = false;
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const el = this.elements[i];
                if (this.isPointInElement(mouse, el)) {
                    // PDF Preview Button Click Detection
                    if (el.type === 'pdf') {
                        const btnXStart = el.x + (el.width * 0.20);
                        const btnXEnd = el.x + (el.width * 0.60);
                        const btnYStart = el.y + (el.height * 0.45);
                        const btnYEnd = el.y + (el.height * 0.90);

                        if (mouse.x >= btnXStart && mouse.x <= btnXEnd &&
                            mouse.y >= btnYStart && mouse.y <= btnYEnd) {
                            this.canvas.dispatchEvent(new CustomEvent('flux-pdf-preview', { detail: { element: el } }));
                            return; // Stop drag action
                        }
                    }

                    if (!this.interaction.selectedElements.includes(el)) this.interaction.selectedElements = [el];
                    this.saveHistory();
                    this.interaction.isDraggingElements = true; 
                    this.interaction.dragLastWorldPos = mouse;
                    hitFound = true; break;
                }
            }
            if (!hitFound) { 
                this.interaction.selectedElements = []; this.interaction.isSelecting = true; 
                this.interaction.selectionBox = { startX: mouse.x, startY: mouse.y, currentX: mouse.x, currentY: mouse.y }; 
            }
        }
        this.render(); if(window.flux) window.flux.updateEditBar();
    }

    handleMouseMove(e) {
        const pos = this.getPointerPos(e);
        const mouse = this.screenToWorld(pos.x, pos.y);
        
        // Change cursor over PDF button
        let cursorSet = false;
        if (!this.interaction.isPanning && !this.interaction.isDraggingHandle && !this.interaction.isDrawingPath && window.flux.state.activeTool === 'select') {
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const el = this.elements[i];
                if (el.type === 'pdf' && this.isPointInElement(mouse, el)) {
                    const btnXStart = el.x + (el.width * 0.20);
                    const btnXEnd = el.x + (el.width * 0.60);
                    const btnYStart = el.y + (el.height * 0.45);
                    const btnYEnd = el.y + (el.height * 0.90);
                    if (mouse.x >= btnXStart && mouse.x <= btnXEnd && mouse.y >= btnYStart && mouse.y <= btnYEnd) {
                        this.canvas.style.cursor = 'pointer';
                        cursorSet = true;
                        break;
                    }
                }
            }
        }
        if (!cursorSet && !this.interaction.isPanning) {
            this.canvas.style.cursor = 'default';
        }

        if (this.interaction.isPanning) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.view.offsetX += clientX - this.interaction.lastMouseX; 
            this.view.offsetY += clientY - this.interaction.lastMouseY;
            this.interaction.lastMouseX = clientX; 
            this.interaction.lastMouseY = clientY; 
            this.render(); return;
        }
        if (this.interaction.isDrawingPath) { this.interaction.draggedElement.points.push({ x: mouse.x, y: mouse.y }); this.render(); return; }
        if (this.interaction.isDraggingHandle) { this.resizeElement(this.interaction.draggedElement, this.interaction.draggedHandle, mouse); this.render(); return; }
        if (this.interaction.isDraggingElements) {
            const dx = mouse.x - this.interaction.dragLastWorldPos.x, dy = mouse.y - this.interaction.dragLastWorldPos.y;
            this.interaction.selectedElements.forEach(el => {
                if (el.type === 'line') { el.p1.x += dx; el.p1.y += dy; el.p2.x += dx; el.p2.y += dy; }
                else if (el.type === 'pen') { el.points.forEach(p => { p.x += dx; p.y += dy; }); }
                else if (el.type === 'shape' || el.type === 'text' || el.type === 'image' || el.type === 'pdf') { el.x += dx; el.y += dy; }
            });
            this.interaction.dragLastWorldPos = mouse; this.render(); return;
        }
        if (this.interaction.isSelecting) { this.interaction.selectionBox.currentX = mouse.x; this.interaction.selectionBox.currentY = mouse.y; this.render(); return; }
    }

    handleMouseUp() {
        if (this.interaction.isSelecting) this.finalizeSelection();
        if (this.interaction.isDrawingPath) this.interaction.selectedElements = [this.interaction.draggedElement];
        this.interaction.isSelecting = false; this.interaction.isDrawingPath = false; this.interaction.isPanning = false;
        this.interaction.isDraggingHandle = false; this.interaction.isDraggingElements = false;
        this.interaction.draggedElement = null; this.interaction.draggedHandle = null;
        this.canvas.classList.remove('panning'); this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    getElementHandles(el) {
        if (el.type === 'line') return [el.p1, el.p2];
        
        // Handles only on corners for PDF
        if (el.type === 'pdf') {
            const {x, y, width: w, height: h} = el;
            return [
                {x, y, id: 0}, 
                {x: x+w, y, id: 2}, 
                {x: x+w, y: y+h, id: 4}, 
                {x, y: y+h, id: 6}
            ];
        }

        if (el.type === 'shape' || el.type === 'text' || el.type === 'image') {
            const {x, y, width: w, height: h} = el;
            return [
                {x, y, id: 0}, {x: x+w/2, y, id: 1}, {x: x+w, y, id: 2}, 
                {x: x+w, y: y+h/2, id: 3}, {x: x+w, y: y+h, id: 4}, {x: x+w/2, y: y+h, id: 5}, 
                {x, y: y+h, id: 6}, {x, y: y+h/2, id: 7}
            ];
        }
        return [];
    }

    resizeElement(el, handleIdx, mouse) {
        if (el.renderedImage) el.renderedImage = null; 
        if (el.type === 'line') { const key = handleIdx === 0 ? 'p1' : 'p2'; el[key].x = mouse.x; el[key].y = mouse.y; return; }
        
        if (el.type === 'shape' || el.type === 'text' || el.type === 'image' || el.type === 'pdf') {
            const minSize = 20;
            const right = el.x + el.width;
            const bottom = el.y + el.height;
            const isCorner = [0, 2, 4, 6].includes(handleIdx);
            const ratio = this.interaction.aspectRatio;

            // 1. Calculate base new dimensions
            switch(handleIdx) {
                case 0: el.width = right - mouse.x; el.height = bottom - mouse.y; break;
                case 1: el.height = bottom - mouse.y; break;
                case 2: el.width = mouse.x - el.x; el.height = bottom - mouse.y; break;
                case 3: el.width = mouse.x - el.x; break;
                case 4: el.width = mouse.x - el.x; el.height = mouse.y - el.y; break;
                case 5: el.height = mouse.y - el.y; break;
                case 6: el.width = right - mouse.x; el.height = mouse.y - el.y; break;
                case 7: el.width = right - mouse.x; break;
            }

            // 2. Enforce Proportional scaling
            if (isCorner && el.type !== 'text') {
                if (el.type === 'image' || el.type === 'pdf') {
                     if (el.width / ratio > el.height) el.height = el.width / ratio;
                     else el.width = el.height * ratio;
                } else {
                    if (el.width / ratio > el.height) el.height = el.width / ratio;
                    else el.width = el.height * ratio;
                }
            }

            // 3. Prevent going below minSize
            if (el.width < minSize) { 
                el.width = minSize; 
                if (isCorner && el.type !== 'text') el.height = el.width / ratio; 
            }
            if (el.height < minSize) { 
                el.height = minSize; 
                if (isCorner && el.type !== 'text') el.width = el.height * ratio; 
            }

            // 4. Reposition based on anchor
            if (handleIdx === 0) { el.x = right - el.width; el.y = bottom - el.height; }
            else if (handleIdx === 1) { el.y = bottom - el.height; }
            else if (handleIdx === 2) { el.y = bottom - el.height; }
            else if (handleIdx === 6) { el.x = right - el.width; }
            else if (handleIdx === 7) { el.x = right - el.width; }
        }
    }

    isPointInElement(p, el) {
        if (el.type === 'line' || el.type === 'pen') {
            const effectiveHitThreshold = Math.max(this.config.hitThreshold, ((el.strokeWidth || el.width || 3) * this.view.scale) / 2 + 15);
            if (el.type === 'line') return this.getDistPointToSegment(p, el.p1, el.p2) * this.view.scale < effectiveHitThreshold;
            return el.points.some((pt, idx) => idx < el.points.length - 1 && this.getDistPointToSegment(p, pt, el.points[idx+1]) * this.view.scale < effectiveHitThreshold);
        }
        if (el.type === 'shape' || el.type === 'text' || el.type === 'image' || el.type === 'pdf') return p.x >= el.x && p.x <= el.x + el.width && p.y >= el.y && p.y <= el.y + el.height;
        return false;
    }

    finalizeSelection() {
        const box = this.interaction.selectionBox; if (!box) return;
        const x1 = Math.min(box.startX, box.currentX), y1 = Math.min(box.startY, box.currentY);
        const x2 = Math.max(box.startX, box.currentX), y2 = Math.max(box.startY, box.currentY);
        this.interaction.selectedElements = this.elements.filter(el => {
            if (el.type === 'line') return el.p1.x >= x1 && el.p1.x <= x2 && el.p1.y >= y1 && el.p1.y <= y2;
            if (el.type === 'pen') return el.points.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
            if (el.type === 'shape' || el.type === 'text' || el.type === 'image' || el.type === 'pdf') return el.x >= x1 && el.x + el.width <= x2 && el.y >= y1 && el.y + el.height <= y2;
            return false;
        });
    }

    getDistPointToSegment(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault(); this.interaction.isPanning = true;
            this.interaction.initialTouchDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            this.interaction.initialTouchCenter = { x: (e.touches[0].pageX + e.touches[1].pageX)/2, y: (e.touches[0].pageY + e.touches[1].pageY)/2 };
        } else if (e.touches.length === 1) {
            this.handleMouseDown(e); // Pass original event, getPointerPos handles it
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 2 && this.interaction.isPanning) {
            e.preventDefault();
            const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            const center = { x: (e.touches[0].pageX + e.touches[1].pageX)/2, y: (e.touches[0].pageY + e.touches[1].pageY)/2 };
            this.applyZoom(dist / this.interaction.initialTouchDistance, center.x, center.y);
            this.view.offsetX += center.x - this.interaction.initialTouchCenter.x; this.view.offsetY += center.y - this.interaction.initialTouchCenter.y;
            this.interaction.initialTouchDistance = dist; this.interaction.initialTouchCenter = center; this.render();
        } else if (e.touches.length === 1) {
            e.preventDefault(); // Prevents scrolling/refresh behavior
            this.handleMouseMove(e); // Pass original event
        }
    }

    handleTouchEnd() { this.handleMouseUp(); }

    resize() { 
        this.canvas.width = window.innerWidth * devicePixelRatio; 
        this.canvas.height = window.innerHeight * devicePixelRatio; 
        this.ctx.scale(devicePixelRatio, devicePixelRatio); 
        this.ctx.imageSmoothingEnabled = true; // Optimization
        this.render(); 
    }

    render() {
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-color').trim();
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        if (this.config.gridEnabled) this.drawInfiniteGrid();
        this.drawElements(); this.drawSelectionMarquee();
    }

    drawInfiniteGrid() {
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--grid-dot-color').trim();
        const gap = this.config.dotGap * this.view.scale; if (gap < 8) return;
        const sX = (this.view.offsetX % gap) - gap, sY = (this.view.offsetY % gap) - gap;
        this.ctx.beginPath();
        for (let x = sX; x < window.innerWidth + gap; x += gap) for (let y = sY; y < window.innerHeight + gap; y += gap) {
            this.ctx.moveTo(x, y); this.ctx.arc(x, y, this.config.dotRadius * Math.sqrt(this.view.scale), 0, Math.PI * 2);
        }
        this.ctx.fill();
    }

    drawElements() {
        this.elements.forEach(el => {
            this.ctx.save();
            const isSelected = this.interaction.selectedElements.includes(el);
            
            if (el.type === 'line' || el.type === 'pen') {
                this.ctx.strokeStyle = el.color;
                this.ctx.lineWidth = (el.strokeWidth || el.width || 3) * this.view.scale;
                this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
                if (el.dashStyle === 'dashed') this.ctx.setLineDash([15 * this.view.scale, 10 * this.view.scale]);
                else if (el.dashStyle === 'dotted') this.ctx.setLineDash([2 * this.view.scale, 8 * this.view.scale]);
                
                if (el.type === 'line') {
                    const sP1 = this.worldToScreen(el.p1.x, el.p1.y), sP2 = this.worldToScreen(el.p2.x, el.p2.y);
                    const ang = Math.atan2(sP2.y-sP1.y, sP2.x-sP1.x), hL = (el.width*4+6)*this.view.scale;
                    let x1 = sP1.x, y1 = sP1.y, x2 = sP2.x, y2 = sP2.y;
                    if (el.arrowStart) { x1 += hL*0.8*Math.cos(ang); y1 += hL*0.8*Math.sin(ang); }
                    if (el.arrowEnd) { x2 -= hL*0.8*Math.cos(ang); y2 -= hL*0.8*Math.sin(ang); }
                    this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
                    if (el.arrowStart) this.drawArrowhead(el.p2, el.p1, el.color, el.width);
                    if (el.arrowEnd) this.drawArrowhead(el.p1, el.p2, el.color, el.width);
                    if (isSelected) { this.drawHandle(sP1.x, sP1.y, el.color); this.drawHandle(sP2.x, sP2.y, el.color); }
                } else {
                    this.ctx.beginPath(); const st = this.worldToScreen(el.points[0].x, el.points[0].y); this.ctx.moveTo(st.x, st.y);
                    el.points.forEach(p => { const sp = this.worldToScreen(p.x, p.y); this.ctx.lineTo(sp.x, sp.y); }); this.ctx.stroke();
                    if (isSelected) { this.ctx.globalAlpha = 0.3; this.ctx.lineWidth += 10 * this.view.scale; this.ctx.stroke(); }
                }
            } else if (el.type === 'shape') {
                this.ctx.strokeStyle = el.color;
                this.ctx.lineWidth = (el.strokeWidth || 3) * this.view.scale;
                const sP = this.worldToScreen(el.x, el.y), sW = el.width * this.view.scale, sH = el.height * this.view.scale;
                this.ctx.beginPath(); this.drawShapePath(el.shapeType, sP.x, sP.y, sW, sH);
                if (el.fillColor !== 'transparent') { this.ctx.fillStyle = el.fillColor; this.ctx.fill(); }
                if (el.color !== 'transparent') this.ctx.stroke();
                if (isSelected) this.getElementHandles(el).forEach(h => { const sh = this.worldToScreen(h.x, h.y); this.drawHandle(sh.x, sh.y, el.color !== 'transparent' ? el.color : '#888'); });
            } else if (el.type === 'text') {
                this.drawTextElement(el, isSelected);
            } else if (el.type === 'image') {
                this.drawImageElement(el, isSelected);
            } else if (el.type === 'pdf') {
                this.drawPDFElement(el, isSelected);
            }
            this.ctx.restore();
        });
    }

    /**
     * @method drawImageElement
     */
    drawImageElement(el, isSelected) {
        const sPos = this.worldToScreen(el.x, el.y);
        const sW = el.width * this.view.scale;
        const sH = el.height * this.view.scale;

        if (el.imgObj) {
            this.ctx.drawImage(el.imgObj, sPos.x, sPos.y, sW, sH);
        } else {
            const img = new Image();
            img.onload = () => { el.imgObj = img; this.render(); };
            img.src = el.src;
        }

        if (isSelected) {
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-color');
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(sPos.x, sPos.y, sW, sH);
            this.ctx.setLineDash([]);
            this.getElementHandles(el).forEach(h => {
                const sh = this.worldToScreen(h.x, h.y);
                this.drawHandle(sh.x, sh.y, getComputedStyle(document.body).getPropertyValue('--accent-color'));
            });
        }
    }

    /**
     * @method drawPDFElement
     */
    drawPDFElement(el, isSelected) {
        const sPos = this.worldToScreen(el.x, el.y);
        const sW = el.width * this.view.scale;
        const sH = el.height * this.view.scale;

        if (el.renderedImage) {
            this.ctx.drawImage(el.renderedImage, sPos.x, sPos.y, sW, sH);
        } else {
            this.renderPDFToImage(el);
        }

        if (isSelected) {
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-color');
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(sPos.x, sPos.y, sW, sH);
            this.ctx.setLineDash([]);
            this.getElementHandles(el).forEach(h => {
                const sh = this.worldToScreen(h.x, h.y);
                this.drawHandle(sh.x, sh.y, getComputedStyle(document.body).getPropertyValue('--accent-color'));
            });
        }
    }

    /**
     * @method renderPDFToImage
     * @description Creates a DOM-like image for the PDF box using foreignObject
     */
    renderPDFToImage(el) {
        if (el.isRendering) return;
        el.isRendering = true;

        const fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const isLight = document.body.classList.contains('light-mode');
        
        // Colors derived from main CSS logic but inline for SVG
        const bgColor = isLight ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.03)";
        const borderColor = isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)";
        const textColor = isLight ? "#1a1a1d" : "#ffffff";
        const btnColor = isLight ? "#1a1a1d" : "#ffffff";
        
        // UPDATED: Scaling Logic for content
        // Base width for PDF box is 310. Calculate scale factor.
        const baseWidth = 310;
        const scale = el.width / baseWidth;
        
        const fontSize = 14 * scale;
        const btnFontSize = 11 * scale;
        const paddingY = 12 * scale;
        const paddingX = 16 * scale;
        const gap = 14 * scale;
        const iconSize = 32 * scale;
        const iconWrapperSize = 40 * scale;
        const borderRadius = 18 * scale;
        const btnPaddingY = 6 * scale;
        const btnPaddingX = 16 * scale;
        const btnBorderRadius = 8 * scale;
        const borderWidth = Math.max(1, 1 * scale); // Ensure at least 1px

        const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${el.width}" height="${el.height}">
            <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml" style="
                    font-family: ${fontFamily};
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    background: ${bgColor};
                    border: ${borderWidth}px solid ${borderColor};
                    border-radius: ${borderRadius}px;
                    padding: ${paddingY}px ${paddingX}px;
                    box-sizing: border-box;
                    gap: ${gap}px;
                    overflow: hidden;
                ">
                    <style>
                        .icon-wrapper {
                            display: flex; align-items: center; justify-content: center;
                            background: transparent; height: 100%; width: ${iconWrapperSize}px;
                            flex-shrink: 0; color: ${textColor};
                        }
                        .content {
                            display: flex; flex-direction: column; justify-content: center;
                            gap: ${7 * scale}px; overflow: hidden; flex: 1;
                        }
                        .title {
                            color: ${textColor}; font-size: ${fontSize}px; font-weight: 500;
                            margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                        }
                        .btn {
                            background: transparent; color: ${btnColor};
                            border: ${borderWidth}px solid ${isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'};
                            border-radius: ${btnBorderRadius}px; padding: ${btnPaddingY}px ${btnPaddingX}px;
                            font-size: ${btnFontSize}px; font-weight: 600; text-transform: uppercase;
                            letter-spacing: ${0.6 * scale}px; width: fit-content;
                        }
                    </style>
                    <div class="icon-wrapper">
                        <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                            <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                            <path d="M10 9H8"/>
                            <path d="M16 13H8"/>
                            <path d="M16 17H8"/>
                        </svg>
                    </div>
                    <div class="content">
                        <div class="title">${el.name}</div>
                        <div class="btn">Preview</div>
                    </div>
                </div>
            </foreignObject>
        </svg>`;

        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            el.renderedImage = img;
            el.isRendering = false;
            URL.revokeObjectURL(url);
            this.render();
        };
        img.src = url;
    }

    drawTextElement(el, isSelected) {
        const sPos = this.worldToScreen(el.x, el.y);
        const sW = el.width * this.view.scale;
        const sH = el.height * this.view.scale;
        
        // Draw selection box first (if selected)
        if (isSelected) { 
            this.ctx.lineWidth = 1; 
            this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-color'); 
            this.ctx.setLineDash([5, 5]); 
            this.ctx.strokeRect(sPos.x, sPos.y, sW, sH); 
            this.ctx.setLineDash([]); 
            this.getElementHandles(el).forEach(h => { 
                const sh = this.worldToScreen(h.x, h.y); 
                this.drawHandle(sh.x, sh.y, getComputedStyle(document.body).getPropertyValue('--accent-color')); 
            });
        }
        if (el.renderedImage) {
            this.ctx.drawImage(el.renderedImage, sPos.x, sPos.y, sW, sH);
        } else {
            this.renderMarkdownToImage(el);
        }
    }

    /**
     * @method renderMarkdownToImage
     * @description Converts Markdown+LaTeX to an SVG Image object and caches it on the element.
     */
    renderMarkdownToImage(el) {
        if (el.isRendering) return;
        el.isRendering = true;
        let htmlContent = "";
        if (window.marked) htmlContent = window.marked.parse(el.content);
        else htmlContent = `<p>${el.content}</p>`;

        if (window.katex) {
            htmlContent = htmlContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
                try { return window.katex.renderToString(tex, { displayMode: true, throwOnError: false }); } catch(e){ return match; }
            });
            htmlContent = htmlContent.replace(/\$([^\$\n]+?)\$/g, (match, tex) => {
                try { return window.katex.renderToString(tex, { displayMode: false, throwOnError: false }); } catch(e){ return match; }
            });
        }

        const fontSize = el.fontSize;
        const color = el.color;
        const computedStyle = getComputedStyle(document.body);
        const fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const katexCSS = (window.flux && window.flux.katexStyles) ? window.flux.katexStyles : "";

        const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${el.width}" height="${el.height}">
            <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml" style="
                    font-family: ${fontFamily};
                    font-size: ${fontSize}px;
                    color: ${color};
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    word-wrap: break-word;
                ">
                    <style>
                        ${katexCSS}
                        p { margin: 0 0 0.5em 0; }
                        h1, h2, h3 { margin: 0 0 0.5em 0; font-weight: 600; line-height: 1.2; }
                        h1 { font-size: 1.5em; } h2 { font-size: 1.3em; } h3 { font-size: 1.1em; }
                        ul, ol { margin: 0 0 0.5em 0; padding-left: 1.2em; }
                        blockquote { border-left: 3px solid ${color}; padding-left: 10px; opacity: 0.8; margin: 0; }
                        code { background: rgba(127,127,127,0.2); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
                        .katex-mathml { display: none !important; }
                    </style>
                    ${htmlContent}
                </div>
            </foreignObject>
        </svg>`;

        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            el.renderedImage = img;
            el.isRendering = false;
            URL.revokeObjectURL(url);
            this.render();
        };
        img.onerror = () => { el.isRendering = false; };
        img.src = url;
    }

    drawShapePath(t, x, y, w, h) {
        switch(t) {
            case 'rect': this.ctx.rect(x,y,w,h); break;
            case 'circle': this.ctx.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, Math.PI*2); break;
            case 'triangle': this.ctx.moveTo(x+w/2,y); this.ctx.lineTo(x+w,y+h); this.ctx.lineTo(x,y+h); this.ctx.closePath(); break;
            case 'diamond': this.ctx.moveTo(x+w/2,y); this.ctx.lineTo(x+w,y+h/2); this.ctx.lineTo(x+w/2,y+h); this.ctx.lineTo(x,y+h/2); this.ctx.closePath(); break;
            case 'hexagon': const hx=w*0.25; this.ctx.moveTo(x+hx,y); this.ctx.lineTo(x+w-hx,y); this.ctx.lineTo(x+w,y+h/2); this.ctx.lineTo(x+w-hx,y+h); this.ctx.lineTo(x+hx,y+h); this.ctx.lineTo(x,y+h/2); this.ctx.closePath(); break;
            case 'star': const cx=x+w/2,cy=y+h/2,sp=5,oR=w/2,iR=w/4; let rot=Math.PI/2*3,st=Math.PI/sp; this.ctx.moveTo(cx,cy-oR); for(let i=0;i<sp;i++){ this.ctx.lineTo(cx+Math.cos(rot)*oR,cy+Math.sin(rot)*oR); rot+=st; this.ctx.lineTo(cx+Math.cos(rot)*iR,cy+Math.sin(rot)*iR); rot+=st; } this.ctx.closePath(); break;
        }
    }

    drawArrowhead(f, t, c, w) {
        const hL=(w*4+6)*this.view.scale, a=Math.atan2(t.y-f.y,t.x-f.x), sT=this.worldToScreen(t.x,t.y);
        this.ctx.beginPath(); this.ctx.moveTo(sT.x, sT.y);
        this.ctx.lineTo(sT.x-hL*Math.cos(a-Math.PI/6), sT.y-hL*Math.sin(a-Math.PI/6));
        this.ctx.lineTo(sT.x-hL*Math.cos(a+Math.PI/6), sT.y-hL*Math.sin(a+Math.PI/6));
        this.ctx.closePath(); this.ctx.fillStyle=c; this.ctx.fill();
    }

    drawSelectionMarquee() {
        if (!this.interaction.isSelecting || !this.interaction.selectionBox) return;
        const b = this.interaction.selectionBox; const p1=this.worldToScreen(b.startX,b.startY),p2=this.worldToScreen(b.currentX,b.currentY);
        this.ctx.save(); this.ctx.setLineDash([5,5]); this.ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--accent-color');
        this.ctx.lineWidth=1; this.ctx.strokeRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);
        this.ctx.globalAlpha=0.1; this.ctx.fillStyle=this.ctx.strokeStyle; this.ctx.fillRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y); this.ctx.restore();
    }

    drawHandle(x,y,c) { this.ctx.beginPath(); this.ctx.arc(x,y,this.config.handleRadius,0,Math.PI*2); this.ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--surface-color'); this.ctx.fill(); this.ctx.strokeStyle=c; this.ctx.lineWidth=2; this.ctx.stroke(); }
    setGridEnabled(on) { this.config.gridEnabled = on; this.render(); }
}