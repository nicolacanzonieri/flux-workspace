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
            zoomSensitivity: 0.005
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
            lastMouseX: 0,
            lastMouseY: 0,
            initialTouchDistance: 0,
            initialTouchCenter: { x: 0, y: 0 }
        };

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
     * @method handleWheel
     * @description Processes scrolling for either panning or zooming (if Ctrl is held).
     */
    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            // Pinch-to-zoom simulation or actual wheel zoom
            const factor = 1 - e.deltaY * this.config.zoomSensitivity;
            this.applyZoom(factor, e.clientX, e.clientY);
        } else {
            // Horizontal/Vertical Trackpad panning
            this.view.offsetX -= e.deltaX;
            this.view.offsetY -= e.deltaY;
        }
        this.render();
    }

    /**
     * @method applyZoom
     * @description Scales the view relative to a specific coordinate point.
     * @param {number} factor - Scale factor multiplier.
     * @param {number} x - Anchor point X (screen space).
     * @param {number} y - Anchor point Y (screen space).
     */
    applyZoom(factor, x, y) {
        const newScale = Math.min(Math.max(this.view.scale * factor, this.config.minScale), this.config.maxScale);
        if (newScale === this.view.scale) return;

        // Conver Screen position to World position before scaling
        const mouseWorldX = (x - this.view.offsetX) / this.view.scale;
        const mouseWorldY = (y - this.view.offsetY) / this.view.scale;

        this.view.scale = newScale;

        // Shift offsets to keep World point fixed under the cursor
        this.view.offsetX = x - mouseWorldX * this.view.scale;
        this.view.offsetY = y - mouseWorldY * this.view.scale;
    }

    /* --- INPUT HANDLERS (Omitted for brevity, comments added in original logic) --- */

    handleMouseDown(e) {
        if (e.shiftKey || e.button === 1) {
            this.interaction.isPanning = true;
            this.interaction.lastMouseX = e.clientX;
            this.interaction.lastMouseY = e.clientY;
            this.canvas.classList.add('panning');
        }
    }

    handleMouseMove(e) {
        if (!this.interaction.isPanning) return;
        const dx = e.clientX - this.interaction.lastMouseX;
        const dy = e.clientY - this.interaction.lastMouseY;
        this.view.offsetX += dx;
        this.view.offsetY += dy;
        this.interaction.lastMouseX = e.clientX;
        this.interaction.lastMouseY = e.clientY;
        this.render();
    }

    handleMouseUp() {
        this.interaction.isPanning = false;
        this.canvas.classList.remove('panning');
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            this.interaction.isPanning = true;
            this.interaction.initialTouchDistance = this.getTouchDistance(e.touches);
            this.interaction.initialTouchCenter = this.getTouchCenter(e.touches);
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
        }
    }

    handleTouchEnd() { this.interaction.isPanning = false; }
    getTouchDistance(t) { return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY); }
    getTouchCenter(t) { return { x: (t[0].pageX + t[1].pageX)/2, y: (t[0].pageY + t[1].pageY)/2 }; }

    /**
     * @method resize
     * @description Synchronizes canvas size with window and DPR.
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    /**
     * @method render
     * @description Core draw loop. Clears frame and invokes sub-renderers.
     */
    render() {
        // Clear with CSS background color
        const color = getComputedStyle(document.body).getPropertyValue('--bg-color').trim();
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        if (this.config.gridEnabled) this.drawInfiniteGrid();
    }

    /**
     * @method drawInfiniteGrid
     * @description Renders a modulo-based dot grid to simulate infinite space.
     */
    drawInfiniteGrid() {
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--grid-dot-color').trim();
        const gap = this.config.dotGap * this.view.scale;
        if (gap < 8) return; // Performance limit for density

        // Start drawing from the remainder of camera offset
        const startX = (this.view.offsetX % gap) - gap;
        const startY = (this.view.offsetY % gap) - gap;

        this.ctx.beginPath();
        for (let x = startX; x < window.innerWidth + gap; x += gap) {
            for (let y = startY; y < window.innerHeight + gap; y += gap) {
                this.ctx.moveTo(x, y);
                // Dot size scales slightly for better visibility
                this.ctx.arc(x, y, this.config.dotRadius * Math.sqrt(this.view.scale), 0, Math.PI * 2);
            }
        }
        this.ctx.fill();
    }

    setGridEnabled(on) { this.config.gridEnabled = on; this.render(); }
}