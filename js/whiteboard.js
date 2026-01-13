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

        /** @type {Object} Virtual camera state */
        this.view = {
            offsetX: window.innerWidth / 2,
            offsetY: window.innerHeight / 2,
            scale: 1
        };

        /** @type {Object} Real-time interaction data */
        this.interaction = {
            isPanning: false,
            isDraggingHandle: false,
            isDraggingElements: false,
            isDrawingPath: false,
            isSelecting: false,
            selectionBox: null,
            selectedElements: [],
            draggedElement: null,
            draggedHandle: null, 
            lastMouseX: 0,
            lastMouseY: 0,
            dragLastWorldPos: { x: 0, y: 0 },
            initialTouchDistance: 0,
            initialTouchCenter: { x: 0, y: 0 }
        };

        /** @type {Array} Collection of whiteboard elements */
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

    clearBoard() {
        this.elements = [];
        this.interaction.selectedElements = [];
        this.interaction.selectionBox = null;
        this.interaction.isSelecting = false;
        this.view.offsetX = window.innerWidth / 2;
        this.view.offsetY = window.innerHeight / 2;
        this.view.scale = 1;
        this.render();
    }

    screenToWorld(x, y) {
        return {
            x: (x - this.view.offsetX) / this.view.scale,
            y: (y - this.view.offsetY) / this.view.scale
        };
    }

    worldToScreen(x, y) {
        return {
            x: x * this.view.scale + this.view.offsetX,
            y: y * this.view.scale + this.view.offsetY
        };
    }

    addLine(color) {
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newLine = {
            id: Date.now(),
            type: 'line',
            p1: { x: center.x - 50, y: center.y },
            p2: { x: center.x + 50, y: center.y },
            color: color,
            isAutoColor: true,
            width: 3,
            dashStyle: 'solid',
            arrowStart: false,
            arrowEnd: false
        };
        this.elements.push(newLine);
        this.interaction.selectedElements = [newLine]; 
        this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    startPath(color) {
        const newLine = {
            id: Date.now(),
            type: 'pen',
            points: [],
            color: color,
            isAutoColor: true,
            width: 3,
            dashStyle: 'solid'
        };
        this.elements.push(newLine);
        this.interaction.draggedElement = newLine;
        this.interaction.isDrawingPath = true;
    }

    addShape(shapeType, color) {
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newShape = {
            id: Date.now(),
            type: 'shape',
            shapeType: shapeType,
            x: center.x - 100,
            y: center.y - 100,
            width: 200,
            height: 200,
            color: color,
            fillColor: 'transparent',
            isAutoColor: true,
            isAutoFill: false,
            strokeWidth: 3,
            dashStyle: 'solid'
        };
        this.elements.push(newShape);
        this.interaction.selectedElements = [newShape];
        this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    duplicateSelected() {
        const newSelected = [];
        this.interaction.selectedElements.forEach(el => {
            const clone = JSON.parse(JSON.stringify(el));
            clone.id = Date.now() + Math.random();
            const offset = 20 / this.view.scale;
            if (clone.type === 'line') {
                clone.p1.x += offset; clone.p1.y += offset;
                clone.p2.x += offset; clone.p2.y += offset;
            } else if (clone.type === 'pen') {
                clone.points.forEach(p => { p.x += offset; p.y += offset; });
            } else if (clone.type === 'shape') {
                clone.x += offset; clone.y += offset;
            }
            this.elements.push(clone);
            newSelected.push(clone);
        });
        this.interaction.selectedElements = newSelected;
        this.render();
    }

    deleteSelected() {
        this.elements = this.elements.filter(el => !this.interaction.selectedElements.includes(el));
        this.interaction.selectedElements = [];
        this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    updateThemeColors(isLightMode) {
        const newColor = isLightMode ? '#1a1a1d' : '#ffffff';
        this.elements.forEach(el => {
            if (el.isAutoColor) el.color = newColor;
            if (el.isAutoFill) el.fillColor = newColor;
        });
        this.render();
    }

    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const factor = 1 - e.deltaY * this.config.zoomSensitivity;
            this.applyZoom(factor, e.clientX, e.clientY);
        } else {
            this.view.offsetX -= e.deltaX;
            this.view.offsetY -= e.deltaY;
        }
        this.render();
    }

    applyZoom(factor, x, y) {
        const newScale = Math.min(Math.max(this.view.scale * factor, this.config.minScale), this.config.maxScale);
        if (newScale === this.view.scale) return;
        const mouseWorld = this.screenToWorld(x, y);
        this.view.scale = newScale;
        this.view.offsetX = x - mouseWorld.x * this.view.scale;
        this.view.offsetY = y - mouseWorld.y * this.view.scale;
    }

    handleMouseDown(e) {
        const mouse = this.screenToWorld(e.clientX, e.clientY);
        const tool = window.flux.state.activeTool;
        
        if (e.shiftKey || e.button === 1 || tool === 'pan') {
            this.interaction.isPanning = true;
            this.interaction.lastMouseX = e.clientX;
            this.interaction.lastMouseY = e.clientY;
            this.canvas.classList.add('panning');
            this.render();
            return;
        }

        if (tool === 'pen') {
            this.interaction.selectedElements = [];
            const isLight = document.body.classList.contains('light-mode');
            const color = isLight ? '#1a1a1d' : '#ffffff';
            this.startPath(color);
            this.interaction.draggedElement.points.push({ x: mouse.x, y: mouse.y });
            this.render();
            return;
        }

        for (const el of this.interaction.selectedElements) {
            const handles = this.getElementHandles(el);
            for (let i = 0; i < handles.length; i++) {
                const h = handles[i];
                const d = Math.hypot(mouse.x - h.x, mouse.y - h.y) * this.view.scale;
                if (d < this.config.handleHitThreshold) {
                    this.interaction.isDraggingHandle = true;
                    this.interaction.draggedElement = el;
                    this.interaction.draggedHandle = i;
                    return;
                }
            }
        }

        if (tool === 'select') {
            let hitFound = false;
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const el = this.elements[i];
                if (this.isPointInElement(mouse, el)) {
                    if (!this.interaction.selectedElements.includes(el)) {
                        this.interaction.selectedElements = [el];
                    }
                    this.interaction.isDraggingElements = true;
                    this.interaction.dragLastWorldPos = mouse;
                    hitFound = true;
                    break;
                }
            }
            if (!hitFound) {
                this.interaction.selectedElements = [];
                this.interaction.isSelecting = true;
                this.interaction.selectionBox = { startX: mouse.x, startY: mouse.y, currentX: mouse.x, currentY: mouse.y };
            }
        }

        this.render();
        if(window.flux) window.flux.updateEditBar();
    }

    handleMouseMove(e) {
        const mouse = this.screenToWorld(e.clientX, e.clientY);
        if (this.interaction.isPanning) {
            const dx = e.clientX - this.interaction.lastMouseX;
            const dy = e.clientY - this.interaction.lastMouseY;
            this.view.offsetX += dx; this.view.offsetY += dy;
            this.interaction.lastMouseX = e.clientX; this.interaction.lastMouseY = e.clientY;
            this.render(); return;
        }
        if (this.interaction.isDrawingPath) {
            this.interaction.draggedElement.points.push({ x: mouse.x, y: mouse.y });
            this.render(); return;
        }
        if (this.interaction.isDraggingHandle) {
            this.resizeElement(this.interaction.draggedElement, this.interaction.draggedHandle, mouse);
            this.render(); return;
        }
        if (this.interaction.isDraggingElements) {
            const dx = mouse.x - this.interaction.dragLastWorldPos.x;
            const dy = mouse.y - this.interaction.dragLastWorldPos.y;
            this.interaction.selectedElements.forEach(el => {
                if (el.type === 'line') { el.p1.x += dx; el.p1.y += dy; el.p2.x += dx; el.p2.y += dy; }
                else if (el.type === 'pen') { el.points.forEach(p => { p.x += dx; p.y += dy; }); }
                else if (el.type === 'shape') { el.x += dx; el.y += dy; }
            });
            this.interaction.dragLastWorldPos = mouse;
            this.render(); return;
        }
        if (this.interaction.isSelecting) {
            this.interaction.selectionBox.currentX = mouse.x; this.interaction.selectionBox.currentY = mouse.y;
            this.render(); return;
        }
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
        if (el.type === 'shape') {
            const {x, y, width: w, height: h} = el;
            return [
                {x, y}, {x: x+w/2, y}, {x: x+w, y},
                {x: x+w, y: y+h/2}, {x: x+w, y: y+h},
                {x: x+w/2, y: y+h}, {x, y: y+h},
                {x, y: y+h/2}
            ];
        }
        return [];
    }

    resizeElement(el, handleIdx, mouse) {
        if (el.type === 'line') {
            const key = handleIdx === 0 ? 'p1' : 'p2';
            el[key].x = mouse.x; el[key].y = mouse.y;
            return;
        }
        if (el.type === 'shape') {
            const minSize = 10;
            const right = el.x + el.width; const bottom = el.y + el.height;
            switch(handleIdx) {
                case 0: el.width = right - mouse.x; el.height = bottom - mouse.y; el.x = mouse.x; el.y = mouse.y; break;
                case 1: el.height = bottom - mouse.y; el.y = mouse.y; break;
                case 2: el.width = mouse.x - el.x; el.height = bottom - mouse.y; el.y = mouse.y; break;
                case 3: el.width = mouse.x - el.x; break;
                case 4: el.width = mouse.x - el.x; el.height = mouse.y - el.y; break;
                case 5: el.height = mouse.y - el.y; break;
                case 6: el.width = right - mouse.x; el.height = mouse.y - el.y; el.x = mouse.x; break;
                case 7: el.width = right - mouse.x; el.x = mouse.x; break;
            }
            if (el.width < minSize) el.width = minSize; if (el.height < minSize) el.height = minSize;
        }
    }

    isPointInElement(p, el) {
        const thicknessThreshold = ((el.strokeWidth || el.width || 3) * this.view.scale) / 2 + 15;
        const effectiveHitThreshold = Math.max(this.config.hitThreshold, thicknessThreshold);
        if (el.type === 'line') {
            const dist = this.getDistPointToSegment(p, el.p1, el.p2) * this.view.scale;
            return dist < effectiveHitThreshold && Math.hypot(p.x - el.p1.x, p.y - el.p1.y) * this.view.scale > this.config.handleHitThreshold && Math.hypot(p.x - el.p2.x, p.y - el.p2.y) * this.view.scale > this.config.handleHitThreshold;
        }
        if (el.type === 'pen') {
            for (let j = 0; j < el.points.length - 1; j++) {
                if (this.getDistPointToSegment(p, el.points[j], el.points[j+1]) * this.view.scale < effectiveHitThreshold) return true;
            }
        }
        if (el.type === 'shape') {
            return p.x >= el.x && p.x <= el.x + el.width && p.y >= el.y && p.y <= el.y + el.height;
        }
        return false;
    }

    finalizeSelection() {
        const box = this.interaction.selectionBox;
        if (!box) return;
        const x1 = Math.min(box.startX, box.currentX), y1 = Math.min(box.startY, box.currentY);
        const x2 = Math.max(box.startX, box.currentX), y2 = Math.max(box.startY, box.currentY);
        this.interaction.selectedElements = this.elements.filter(el => {
            if (el.type === 'line') return el.p1.x >= x1 && el.p1.x <= x2 && el.p1.y >= y1 && el.p1.y <= y2;
            if (el.type === 'pen') return el.points.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
            if (el.type === 'shape') return el.x >= x1 && el.x + el.width <= x2 && el.y >= y1 && el.y + el.height <= y2;
            return false;
        });
    }

    getDistPointToSegment(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            this.interaction.isPanning = true;
            this.interaction.initialTouchDistance = this.getTouchDistance(e.touches);
            this.interaction.initialTouchCenter = this.getTouchCenter(e.touches);
        } else if (e.touches.length === 1) {
            const t = e.touches[0];
            this.handleMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0, shiftKey: false });
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 2 && this.interaction.isPanning) {
            e.preventDefault();
            const currentDist = this.getTouchDistance(e.touches);
            const currentCenter = this.getTouchCenter(e.touches);
            this.applyZoom(currentDist / this.interaction.initialTouchDistance, currentCenter.x, currentCenter.y);
            this.view.offsetX += currentCenter.x - this.interaction.initialTouchCenter.x;
            this.view.offsetY += currentCenter.y - this.interaction.initialTouchCenter.y;
            this.interaction.initialTouchDistance = currentDist; this.interaction.initialTouchCenter = currentCenter;
            this.render();
        } else if (e.touches.length === 1) {
            const t = e.touches[0];
            this.handleMouseMove({ clientX: t.clientX, clientY: t.clientY });
        }
    }

    handleTouchEnd() { this.handleMouseUp(); }
    getTouchDistance(t) { return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY); }
    getTouchCenter(t) { return { x: (t[0].pageX + t[1].pageX)/2, y: (t[0].pageY + t[1].pageY)/2 }; }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr; this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr); this.render();
    }

    render() {
        const color = getComputedStyle(document.body).getPropertyValue('--bg-color').trim();
        this.ctx.fillStyle = color; this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        if (this.config.gridEnabled) this.drawInfiniteGrid();
        this.drawElements(); this.drawSelectionMarquee();
    }

    drawInfiniteGrid() {
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--grid-dot-color').trim();
        const gap = this.config.dotGap * this.view.scale; if (gap < 8) return;
        const startX = (this.view.offsetX % gap) - gap; const startY = (this.view.offsetY % gap) - gap;
        this.ctx.beginPath();
        for (let x = startX; x < window.innerWidth + gap; x += gap) {
            for (let y = startY; y < window.innerHeight + gap; y += gap) {
                this.ctx.moveTo(x, y); this.ctx.arc(x, y, this.config.dotRadius * Math.sqrt(this.view.scale), 0, Math.PI * 2);
            }
        }
        this.ctx.fill();
    }

    drawElements() {
        this.elements.forEach(el => {
            this.ctx.save();
            if (el.dashStyle === 'dashed') this.ctx.setLineDash([15 * this.view.scale, 10 * this.view.scale]);
            else if (el.dashStyle === 'dotted') this.ctx.setLineDash([2 * this.view.scale, 8 * this.view.scale]);
            else this.ctx.setLineDash([]);

            this.ctx.strokeStyle = el.color;
            this.ctx.lineWidth = (el.strokeWidth || el.width || 3) * this.view.scale;
            this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';

            if (el.type === 'line') {
                const sP1 = this.worldToScreen(el.p1.x, el.p1.y), sP2 = this.worldToScreen(el.p2.x, el.p2.y);
                const angle = Math.atan2(sP2.y - sP1.y, sP2.x - sP1.x);
                const headlen = (el.width * 4 + 6) * this.view.scale;
                let startX = sP1.x, startY = sP1.y, endX = sP2.x, endY = sP2.y;
                if (el.arrowStart) { startX += headlen * 0.8 * Math.cos(angle); startY += headlen * 0.8 * Math.sin(angle); }
                if (el.arrowEnd) { endX -= headlen * 0.8 * Math.cos(angle); endY -= headlen * 0.8 * Math.sin(angle); }
                this.ctx.beginPath(); this.ctx.moveTo(startX, startY); this.ctx.lineTo(endX, endY); this.ctx.stroke();
                if (el.arrowStart) this.drawArrowhead(el.p2, el.p1, el.color, el.width);
                if (el.arrowEnd) this.drawArrowhead(el.p1, el.p2, el.color, el.width);
                if (this.interaction.selectedElements.includes(el)) { this.drawHandle(sP1.x, sP1.y, el.color); this.drawHandle(sP2.x, sP2.y, el.color); }
            } else if (el.type === 'pen') {
                if (el.points.length < 2) { this.ctx.restore(); return; }
                this.ctx.beginPath(); const start = this.worldToScreen(el.points[0].x, el.points[0].y); this.ctx.moveTo(start.x, start.y);
                for (let i = 1; i < el.points.length; i++) { const p = this.worldToScreen(el.points[i].x, el.points[i].y); this.ctx.lineTo(p.x, p.y); }
                this.ctx.stroke();
                if (this.interaction.selectedElements.includes(el)) { this.ctx.globalAlpha = 0.3; this.ctx.lineWidth += 10 * this.view.scale; this.ctx.stroke(); }
            } else if (el.type === 'shape') {
                const sPos = this.worldToScreen(el.x, el.y);
                const sW = el.width * this.view.scale, sH = el.height * this.view.scale;
                this.ctx.beginPath();
                this.drawShapePath(el.shapeType, sPos.x, sPos.y, sW, sH);
                
                // Draw Fill only if not transparent
                if (el.fillColor !== 'transparent') {
                    this.ctx.fillStyle = el.fillColor;
                    this.ctx.fill();
                }
                
                // Draw Stroke only if not transparent
                if (el.color !== 'transparent') {
                    this.ctx.stroke();
                }

                if (this.interaction.selectedElements.includes(el)) {
                    this.getElementHandles(el).forEach(h => { const sh = this.worldToScreen(h.x, h.y); this.drawHandle(sh.x, sh.y, el.color !== 'transparent' ? el.color : '#888'); });
                }
            }
            this.ctx.restore();
        });
    }

    drawShapePath(type, x, y, w, h) {
        switch(type) {
            case 'rect': this.ctx.rect(x, y, w, h); break;
            case 'circle': this.ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2); break;
            case 'triangle': this.ctx.moveTo(x + w/2, y); this.ctx.lineTo(x + w, y + h); this.ctx.lineTo(x, y + h); this.ctx.closePath(); break;
            case 'diamond': this.ctx.moveTo(x + w/2, y); this.ctx.lineTo(x + w, y + h/2); this.ctx.lineTo(x + w/2, y + h); this.ctx.lineTo(x, y + h/2); this.ctx.closePath(); break;
            case 'hexagon':
                const hx = w * 0.25;
                this.ctx.moveTo(x + hx, y); this.ctx.lineTo(x + w - hx, y); this.ctx.lineTo(x + w, y + h/2);
                this.ctx.lineTo(x + w - hx, y + h); this.ctx.lineTo(x + hx, y + h); this.ctx.lineTo(x, y + h/2); this.ctx.closePath();
                break;
            case 'star':
                const cx = x + w/2, cy = y + h/2, spikes = 5, outerR = w/2, innerR = w/4;
                let rot = Math.PI / 2 * 3, step = Math.PI / spikes;
                this.ctx.moveTo(cx, cy - outerR);
                for (let i = 0; i < spikes; i++) {
                    this.ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step;
                    this.ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step;
                }
                this.ctx.closePath();
                break;
        }
    }

    drawArrowhead(from, to, color, width) {
        const headlen = (width * 4 + 6) * this.view.scale;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const screenTo = this.worldToScreen(to.x, to.y);
        this.ctx.beginPath(); this.ctx.moveTo(screenTo.x, screenTo.y);
        this.ctx.lineTo(screenTo.x - headlen * Math.cos(angle - Math.PI / 6), screenTo.y - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(screenTo.x - headlen * Math.cos(angle + Math.PI / 6), screenTo.y - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.closePath(); this.ctx.fillStyle = color; this.ctx.fill();
    }

    drawSelectionMarquee() {
        if (!this.interaction.isSelecting || !this.interaction.selectionBox) return;
        const box = this.interaction.selectionBox;
        const p1 = this.worldToScreen(box.startX, box.startY), p2 = this.worldToScreen(box.currentX, box.currentY);
        this.ctx.save(); this.ctx.setLineDash([5, 5]); this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        this.ctx.lineWidth = 1; this.ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this.ctx.globalAlpha = 0.1; this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        this.ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y); this.ctx.restore();
    }

    drawHandle(x, y, color) {
        this.ctx.beginPath(); this.ctx.arc(x, y, this.config.handleRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface-color').trim();
        this.ctx.fill(); this.ctx.strokeStyle = color; this.ctx.lineWidth = 2; this.ctx.stroke();
    }

    setGridEnabled(on) { this.config.gridEnabled = on; this.render(); }
}