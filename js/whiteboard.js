/**
 * FLUX WHITEBOARD - PRO ENGINE
 * Handles: Mouse, Trackpad, and Multi-Touch (Pinch/Pan)
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
            zoomSensitivity: 0.005,
            touchZoomSensitivity: 0.01
        };

        // View State
        this.view = {
            offsetX: window.innerWidth / 2,
            offsetY: window.innerHeight / 2,
            scale: 1
        };

        // Interaction State
        this.interaction = {
            isPanning: false,
            lastMouseX: 0,
            lastMouseY: 0,
            // Touch specific
            initialTouchDistance: 0,
            initialTouchCenter: { x: 0, y: 0 }
        };

        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.resize());

        // Mouse/Trackpad Events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch Events (Mobile/Tablet)
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleTouchEnd());

        this.resize();
        console.log("Flux Whiteboard: Touch Controls Armed.");
    }

    /* --- MOUSE & TRACKPAD LOGIC --- */

    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const zoomFactor = 1 - e.deltaY * this.config.zoomSensitivity;
            this.applyZoom(zoomFactor, e.clientX, e.clientY);
        } else {
            this.view.offsetX -= e.deltaX;
            this.view.offsetY -= e.deltaY;
        }
        this.render();
    }

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

    /* --- TOUCH LOGIC (iPad/iPhone) --- */

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
            
            const currentDistance = this.getTouchDistance(e.touches);
            const currentCenter = this.getTouchCenter(e.touches);

            // 1. Handle Zoom (Pinch)
            const zoomFactor = currentDistance / this.interaction.initialTouchDistance;
            this.applyZoom(zoomFactor, currentCenter.x, currentCenter.y);
            
            // 2. Handle Pan
            const deltaX = currentCenter.x - this.interaction.initialTouchCenter.x;
            const deltaY = currentCenter.y - this.interaction.initialTouchCenter.y;
            this.view.offsetX += deltaX;
            this.view.offsetY += deltaY;

            // Update for next frame
            this.interaction.initialTouchDistance = currentDistance;
            this.interaction.initialTouchCenter = currentCenter;

            this.render();
        }
    }

    handleTouchEnd() {
        this.interaction.isPanning = false;
    }

    // Helper: Distance between two fingers
    getTouchDistance(touches) {
        return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
    }

    // Helper: Midpoint between two fingers
    getTouchCenter(touches) {
        return {
            x: (touches[0].pageX + touches[1].pageX) / 2,
            y: (touches[0].pageY + touches[1].pageY) / 2
        };
    }

    /* --- CORE RENDERING --- */

    applyZoom(factor, x, y) {
        const newScale = Math.min(Math.max(this.view.scale * factor, this.config.minScale), this.config.maxScale);
        if (newScale === this.view.scale) return;

        const mouseWorldX = (x - this.view.offsetX) / this.view.scale;
        const mouseWorldY = (y - this.view.offsetY) / this.view.scale;

        this.view.scale = newScale;
        this.view.offsetX = x - mouseWorldX * this.view.scale;
        this.view.offsetY = y - mouseWorldY * this.view.scale;
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    render() {
        const computedStyle = getComputedStyle(document.body);
        const bgColor = computedStyle.getPropertyValue('--bg-color').trim();
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        if (this.config.gridEnabled) {
            this.drawInfiniteGrid();
        }
    }

    drawInfiniteGrid() {
        const computedStyle = getComputedStyle(document.body);
        this.ctx.fillStyle = computedStyle.getPropertyValue('--grid-dot-color').trim();
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

    setGridEnabled(isEnabled) {
        this.config.gridEnabled = isEnabled;
        this.render();
    }
}