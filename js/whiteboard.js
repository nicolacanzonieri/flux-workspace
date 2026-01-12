/**
 * FLUX WHITEBOARD - ADVANCED ENGINE
 * Handles: Infinite Pan, Smooth Zoom (Cursor-centered), and Trackpad Gestures.
 */

class FluxWhiteboard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Configuration
        this.config = {
            gridEnabled: true,
            dotGap: 40,
            dotRadius: 1.2,
            minScale: 0.1,
            maxScale: 10,
            zoomSensitivity: 0.005
        };

        // View State (The "Camera")
        this.view = {
            offsetX: window.innerWidth / 2, // Start centered
            offsetY: window.innerHeight / 2,
            scale: 1
        };

        // Interaction State
        this.interaction = {
            isPanning: false,
            lastMouseX: 0,
            lastMouseY: 0
        };

        this.init();
    }

    init() {
        // Handle window resizing
        window.addEventListener('resize', () => this.resize());

        // Mouse Events (Pan via Shift + Drag)
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());

        // Wheel Event (Trackpad Pan & Pinch to Zoom)
        // 'passive: false' is crucial to prevent browser 'back/forward' gestures
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        this.resize();
        console.log("Flux: Advanced Board Engine Ready (Pan & Zoom).");
    }

    /**
     * Handles Trackpad Scroll (Pan) and Pinch (Zoom)
     */
    handleWheel(e) {
        e.preventDefault(); // Prevent page scroll/navigation

        if (e.ctrlKey) {
            // PINCH GESTURE (or Mouse Wheel + Ctrl)
            const zoomFactor = 1 - e.deltaY * this.config.zoomSensitivity;
            this.applyZoom(zoomFactor, e.clientX, e.clientY);
        } else {
            // TRACKPAD SCROLL (Two fingers pan)
            this.view.offsetX -= e.deltaX;
            this.view.offsetY -= e.deltaY;
        }

        this.render();
    }

    /**
     * Applies zoom centered at a specific point (usually cursor)
     * @param {number} factor - Scale multiplier
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate
     */
    applyZoom(factor, x, y) {
        const newScale = Math.min(Math.max(this.view.scale * factor, this.config.minScale), this.config.maxScale);
        
        // Skip if scale didn't change (limits reached)
        if (newScale === this.view.scale) return;

        // Calculate zoom focus point relative to canvas
        const mouseWorldX = (x - this.view.offsetX) / this.view.scale;
        const mouseWorldY = (y - this.view.offsetY) / this.view.scale;

        this.view.scale = newScale;

        // Adjust offset to keep mouse point fixed
        this.view.offsetX = x - mouseWorldX * this.view.scale;
        this.view.offsetY = y - mouseWorldY * this.view.scale;
    }

    handleMouseDown(e) {
        if (e.shiftKey || e.button === 1) { // Shift+Click or Middle Click
            this.interaction.isPanning = true;
            this.interaction.lastMouseX = e.clientX;
            this.interaction.lastMouseY = e.clientY;
            this.canvas.classList.add('panning');
        }
    }

    handleMouseMove(e) {
        if (!this.interaction.isPanning) return;

        const deltaX = e.clientX - this.interaction.lastMouseX;
        const deltaY = e.clientY - this.interaction.lastMouseY;

        this.view.offsetX += deltaX;
        this.view.offsetY += deltaY;

        this.interaction.lastMouseX = e.clientX;
        this.interaction.lastMouseY = e.clientY;

        this.render();
    }

    handleMouseUp() {
        this.interaction.isPanning = false;
        this.canvas.classList.remove('panning');
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    render() {
        // 1. Clear with background color (important for light/dark transition)
        const computedStyle = getComputedStyle(document.body);
        const bgColor = computedStyle.getPropertyValue('--bg-color').trim();
        
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        // 2. Draw Grid
        if (this.config.gridEnabled) {
            this.drawInfiniteGrid();
        }
        
        // Future: Draw items (lines, shapes) here using this.view transformations
    }

    drawInfiniteGrid() {
        const computedStyle = getComputedStyle(document.body);
        this.ctx.fillStyle = computedStyle.getPropertyValue('--grid-dot-color').trim();

        // Effective gap changes with scale
        const gap = this.config.dotGap * this.view.scale;
        
        // Optimization: if dots are too close, fade them out or draw fewer
        if (gap < 10) return; 

        // Modulo math to find the first dot position on screen
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

    setGridEnabled(isEnabled) {
        this.config.gridEnabled = isEnabled;
        this.render();
    }
}