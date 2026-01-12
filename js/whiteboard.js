/**
 * FLUX WHITEBOARD
 * Handles HTML5 Canvas logic, grid rendering, and infinite space simulation.
 */

class FluxWhiteboard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Configuration
        this.config = {
            gridEnabled: true,
            dotGap: 40, // Distance between dots
            dotRadius: 1.5
        };

        // State for panning/zooming (placeholder for future expansion)
        this.view = {
            offsetX: 0,
            offsetY: 0,
            scale: 1
        };

        this.init();
    }

    init() {
        // Resize observer to handle window resizing dynamically
        window.addEventListener('resize', () => this.resize());
        this.resize(); // Initial sizing
        
        console.log("Flux: Whiteboard module initialized.");
    }

    /**
     * Resizes canvas to full screen and redraws
     */
    resize() {
        // Handle high DPI screens (Retina)
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
        
        this.ctx.scale(dpr, dpr);
        
        this.render();
    }

    /**
     * Main Draw Loop
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.config.gridEnabled) {
            this.drawGrid();
        }
    }

    /**
     * Draws the infinite dot grid
     */
    drawGrid() {
        // Get Grid Color from CSS variable for Theme support
        const computedStyle = getComputedStyle(document.body);
        this.ctx.fillStyle = computedStyle.getPropertyValue('--grid-dot-color').trim();

        const gap = this.config.dotGap * this.view.scale;
        
        // Calculate number of dots needed
        const cols = Math.ceil(window.innerWidth / gap);
        const rows = Math.ceil(window.innerHeight / gap);

        for (let i = 0; i <= cols; i++) {
            for (let j = 0; j <= rows; j++) {
                // Calculate position (in future, add offsetX/Y here)
                const x = i * gap;
                const y = j * gap;

                this.ctx.beginPath();
                this.ctx.arc(x, y, this.config.dotRadius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    /**
     * Toggle Grid Visibility
     * @param {boolean} isEnabled 
     */
    setGridEnabled(isEnabled) {
        this.config.gridEnabled = isEnabled;
        this.render();
    }
}