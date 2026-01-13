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
            isDraggingElements: false, // New: dragging objects
            isSelecting: false,
            selectionBox: null,
            selectedElements: [],
            draggedElement: null,
            draggedHandle: null,
            lastMouseX: 0,
            lastMouseY: 0,
            dragLastWorldPos: { x: 0, y: 0 }, // For delta calculation
            initialTouchDistance: 0,
            initialTouchCenter: { x: 0, y: 0 }
        };

        /** @type {Array} Collection of whiteboard elements */
        this.elements = [];

        this.init();
    }

    /**
     * @method init
     * @description Sets up window listeners and input handlers.
     */
    init() {
        window.addEventListener('resize', () => this.resize());

        // Standard Mouse/Trackpad inputs
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Mobile Multi-touch inputs
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleTouchEnd());

        this.resize();
    }

    /**
     * @method clearBoard
     * @description Completely wipes elements and resets the camera view.
     */
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

    /**
     * @method screenToWorld
     * @description Converts screen pixel coordinates to world space coordinates.
     */
    screenToWorld(x, y) {
        return {
            x: (x - this.view.offsetX) / this.view.scale,
            y: (y - this.view.offsetY) / this.view.scale
        };
    }

    /**
     * @method worldToScreen
     * @description Converts world space coordinates to screen pixel coordinates.
     */
    worldToScreen(x, y) {
        return {
            x: x * this.view.scale + this.view.offsetX,
            y: y * this.view.scale + this.view.offsetY
        };
    }

    /**
     * @method addLine
     * @description Spawns a new line element in the center of the current view.
     */
    addLine(color) {
        const center = this.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        const newLine = {
            id: Date.now(),
            type: 'line',
            p1: { x: center.x - 50, y: center.y },
            p2: { x: center.x + 50, y: center.y },
            color: color,
            isAutoColor: true,
            width: 3
        };
        this.elements.push(newLine);
        this.interaction.selectedElements = [newLine]; 
        this.render();
    }

    /**
     * @method updateThemeColors
     * @description Updates all elements flagged with isAutoColor based on new theme.
     */
    updateThemeColors(isLightMode) {
        const newColor = isLightMode ? '#1a1a1d' : '#ffffff';
        this.elements.forEach(el => {
            if (el.isAutoColor) el.color = newColor;
        });
        this.render();
    }

    /**
     * @method handleWheel
     * @description Processes scrolling for either panning or zooming.
     */
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

    /**
     * @method applyZoom
     * @description Scales the view relative to a specific coordinate point.
     */
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
        let hitFound = false;

        // 1. Check for handle interaction (prioritize current selection)
        for (const el of this.interaction.selectedElements) {
            if (el.type === 'line') {
                const d1 = Math.hypot(mouse.x - el.p1.x, mouse.y - el.p1.y) * this.view.scale;
                const d2 = Math.hypot(mouse.x - el.p2.x, mouse.y - el.p2.y) * this.view.scale;

                if (d1 < this.config.handleRadius * 1.5) {
                    this.interaction.isDraggingHandle = true;
                    this.interaction.draggedElement = el;
                    this.interaction.draggedHandle = 'p1';
                    return;
                } else if (d2 < this.config.handleRadius * 1.5) {
                    this.interaction.isDraggingHandle = true;
                    this.interaction.draggedElement = el;
                    this.interaction.draggedHandle = 'p2';
                    return;
                }
            }
        }

        // 2. Check for element selection/dragging
        if (tool === 'select') {
            for (let i = this.elements.length - 1; i >= 0; i--) {
                const el = this.elements[i];
                if (el.type === 'line') {
                    const dist = this.getDistPointToSegment(mouse, el.p1, el.p2) * this.view.scale;
                    if (dist < this.config.hitThreshold) {
                        // If element isn't already in selection, make it the only selection
                        if (!this.interaction.selectedElements.includes(el)) {
                            this.interaction.selectedElements = [el];
                        }
                        this.interaction.isDraggingElements = true;
                        this.interaction.dragLastWorldPos = mouse;
                        hitFound = true;
                        break;
                    }
                }
            }

            // 3. If no hit, start marquee selection
            if (!hitFound) {
                this.interaction.selectedElements = [];
                this.interaction.isSelecting = true;
                this.interaction.selectionBox = { 
                    startX: mouse.x, startY: mouse.y, 
                    currentX: mouse.x, currentY: mouse.y 
                };
            }
        }

        // 4. Handle Panning
        if (e.shiftKey || e.button === 1 || tool === 'pan') {
            this.interaction.isPanning = true;
            this.interaction.lastMouseX = e.clientX;
            this.interaction.lastMouseY = e.clientY;
            this.canvas.classList.add('panning');
        }

        this.render();
    }

    handleMouseMove(e) {
        const mouse = this.screenToWorld(e.clientX, e.clientY);

        if (this.interaction.isDraggingHandle) {
            const el = this.interaction.draggedElement;
            const handle = this.interaction.draggedHandle;
            el[handle].x = mouse.x;
            el[handle].y = mouse.y;
            this.render();
            return;
        }

        if (this.interaction.isDraggingElements) {
            const dx = mouse.x - this.interaction.dragLastWorldPos.x;
            const dy = mouse.y - this.interaction.dragLastWorldPos.y;
            
            this.interaction.selectedElements.forEach(el => {
                if (el.type === 'line') {
                    el.p1.x += dx; el.p1.y += dy;
                    el.p2.x += dx; el.p2.y += dy;
                }
            });
            
            this.interaction.dragLastWorldPos = mouse;
            this.render();
            return;
        }

        if (this.interaction.isSelecting) {
            this.interaction.selectionBox.currentX = mouse.x;
            this.interaction.selectionBox.currentY = mouse.y;
            this.render();
            return;
        }

        if (this.interaction.isPanning) {
            const dx = e.clientX - this.interaction.lastMouseX;
            const dy = e.clientY - this.interaction.lastMouseY;
            this.view.offsetX += dx;
            this.view.offsetY += dy;
            this.interaction.lastMouseX = e.clientX;
            this.interaction.lastMouseY = e.clientY;
            this.render();
        }
    }

    handleMouseUp() {
        if (this.interaction.isSelecting) {
            this.finalizeSelection();
        }
        
        this.interaction.isSelecting = false;
        this.interaction.selectionBox = null;
        this.interaction.isPanning = false;
        this.interaction.isDraggingHandle = false;
        this.interaction.isDraggingElements = false;
        this.interaction.draggedElement = null;
        this.interaction.draggedHandle = null;
        this.canvas.classList.remove('panning');
        this.render();
    }

    /**
     * @method finalizeSelection
     * @description Checks which elements fall into the selection box.
     */
    finalizeSelection() {
        const box = this.interaction.selectionBox;
        if (!box) return;

        const x1 = Math.min(box.startX, box.currentX);
        const y1 = Math.min(box.startY, box.currentY);
        const x2 = Math.max(box.startX, box.currentX);
        const y2 = Math.max(box.startY, box.currentY);

        this.interaction.selectedElements = this.elements.filter(el => {
            if (el.type === 'line') {
                return (el.p1.x >= x1 && el.p1.x <= x2 && el.p1.y >= y1 && el.p1.y <= y2) ||
                       (el.p2.x >= x1 && el.p2.x <= x2 && el.p2.y >= y1 && el.p2.y <= y2);
            }
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
            this.handleMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0 });
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
            this.interaction.initialTouchDistance = currentDist;
            this.interaction.initialTouchCenter = currentCenter;
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
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    render() {
        const color = getComputedStyle(document.body).getPropertyValue('--bg-color').trim();
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        if (this.config.gridEnabled) this.drawInfiniteGrid();
        this.drawElements();
        this.drawSelectionMarquee();
    }

    drawInfiniteGrid() {
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--grid-dot-color').trim();
        const gap = this.config.dotGap * this.view.scale;
        if (gap < 8) return;
        const startX = (this.view.offsetX % gap) - gap;
        const startY = (this.view.offsetY % gap) - gap;
        this.ctx.beginPath();
        for (let x = startX; x < window.innerWidth + gap; x += gap) {
            for (let y = startY; y < window.innerHeight + gap; y += gap) {
                this.ctx.moveTo(x, y);
                this.ctx.arc(x, y, this.config.dotRadius * Math.sqrt(this.view.scale), 0, Math.PI * 2);
            }
        }
        this.ctx.fill();
    }

    drawElements() {
        this.elements.forEach(el => {
            if (el.type === 'line') {
                const p1 = this.worldToScreen(el.p1.x, el.p1.y);
                const p2 = this.worldToScreen(el.p2.x, el.p2.y);
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.strokeStyle = el.color;
                this.ctx.lineWidth = el.width * this.view.scale;
                this.ctx.lineCap = 'round';
                this.ctx.stroke();

                if (this.interaction.selectedElements.includes(el)) {
                    this.drawHandle(p1.x, p1.y, el.color);
                    this.drawHandle(p2.x, p2.y, el.color);
                }
            }
        });
    }

    drawSelectionMarquee() {
        if (!this.interaction.isSelecting || !this.interaction.selectionBox) return;
        
        const box = this.interaction.selectionBox;
        const p1 = this.worldToScreen(box.startX, box.startY);
        const p2 = this.worldToScreen(box.currentX, box.currentY);

        this.ctx.save();
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        
        this.ctx.globalAlpha = 0.1;
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        this.ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this.ctx.restore();
    }

    drawHandle(x, y, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.config.handleRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface-color').trim();
        this.ctx.fill();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    setGridEnabled(on) { this.config.gridEnabled = on; this.render(); }
}