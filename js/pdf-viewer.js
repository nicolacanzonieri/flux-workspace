/**
 * @file pdf-viewer.js
 * @description Handles PDF rendering with "Fit to Screen" logic, boundary clamping, and smooth gestures.
 */
class FluxPdfViewer {
    constructor() {
        this.dom = {
            overlay: document.getElementById('pdf-viewer-overlay'),
            container: document.querySelector('.pdf-container'),
            wrapper: document.querySelector('.pdf-canvas-wrapper'),
            canvas: document.getElementById('pdf-render-canvas'),
            ctx: document.getElementById('pdf-render-canvas').getContext('2d'),
            title: document.getElementById('pdf-viewer-title'),
            indicator: document.getElementById('pdf-page-indicator'),
            btnClose: document.getElementById('btn-close-pdf'),
            btnPrev: document.getElementById('btn-pdf-prev'),
            btnNext: document.getElementById('btn-pdf-next')
        };
        
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;

        // View State
        this.state = {
            zoom: 1,
            minZoom: 0.1, // Will be calculated dynamically
            maxZoom: 5,
            translateX: 0,
            translateY: 0,
            
            // Interaction State
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0,
            initialPinchDist: 0,
            initialPinchZoom: 1,
            
            // Base dimensions of the unscaled PDF page
            baseWidth: 0,
            baseHeight: 0
        };

        this.init();
    }

    init() {
        this.dom.btnClose.addEventListener('click', () => this.close());
        this.dom.btnPrev.addEventListener('click', () => this.onPrevPage());
        this.dom.btnNext.addEventListener('click', () => this.onNextPage());
        
        // Trackpad & Mouse Wheel (Zoom + Pan)
        this.dom.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Mouse Drag Panning
        this.dom.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());

        // Touch Gestures (Pinch + Pan)
        this.dom.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.dom.container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.dom.container.addEventListener('touchend', () => this.handleTouchEnd());

        // Handle resize
        window.addEventListener('resize', () => {
            if(!this.dom.overlay.classList.contains('hidden') && this.pdfDoc) {
                this.recalculateBounds();
            }
        });
    }

    async open(url, name) {
        this.dom.title.textContent = name || "Document.pdf";
        this.dom.overlay.classList.remove('hidden');
        
        // Reset state before loading
        this.state.translateX = 0;
        this.state.translateY = 0;
        this.state.zoom = 1;

        try {
            const loadingTask = pdfjsLib.getDocument(url);
            this.pdfDoc = await loadingTask.promise;
            this.pageNum = 1;
            this.renderPage(this.pageNum);
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.close();
        }
    }

    close() {
        this.dom.overlay.classList.add('hidden');
        this.pdfDoc = null;
        this.dom.ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
    }

    // --- VIEW CALCULATION & BOUNDARIES ---

    /**
     * Calculates the minimum zoom needed to fit the page in the container
     * and sets the initial view.
     */
    resetToFit() {
        if (!this.state.baseWidth || !this.state.baseHeight) return;

        const containerW = this.dom.container.clientWidth;
        const containerH = this.dom.container.clientHeight;

        // Calculate ratios
        const scaleX = containerW / this.state.baseWidth;
        const scaleY = containerH / this.state.baseHeight;
        
        // "Fit to screen" means the smaller of the two scales
        // We reduce it slightly (0.95) to leave a small margin
        const fitScale = Math.min(scaleX, scaleY) * 0.95;

        this.state.minZoom = fitScale;
        this.state.zoom = fitScale;
        
        // Center the view
        this.state.translateX = 0;
        this.state.translateY = 0;

        this.applyTransform();
    }

    /**
     * Called on window resize to ensure we don't lose the page
     */
    recalculateBounds() {
        if (!this.state.baseWidth) return;
        
        // Recalculate min zoom based on new container size
        const containerW = this.dom.container.clientWidth;
        const containerH = this.dom.container.clientHeight;
        const scaleX = containerW / this.state.baseWidth;
        const scaleY = containerH / this.state.baseHeight;
        this.state.minZoom = Math.min(scaleX, scaleY) * 0.95;

        // If current zoom is less than new min, fix it
        if (this.state.zoom < this.state.minZoom) {
            this.state.zoom = this.state.minZoom;
        }

        // Re-clamp coordinates
        this.clampTranslation();
        this.applyTransform();
    }

    /**
     * Ensures the PDF stays inside the viewport (no infinite scrolling).
     * If content < viewport, it centers it.
     * If content > viewport, it prevents edges from leaving the viewport.
     */
    clampTranslation() {
        const currentW = this.state.baseWidth * this.state.zoom;
        const currentH = this.state.baseHeight * this.state.zoom;
        const containerW = this.dom.container.clientWidth;
        const containerH = this.dom.container.clientHeight;

        // Helper to clamp a value between min and max
        const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

        // Horizontal Clamping
        if (currentW <= containerW) {
            // If content is smaller than container, force center
            this.state.translateX = 0; 
        } else {
            // If content is larger, allow panning but stop at edges
            // Max positive translation (left edge aligns with left container)
            const maxTx = (currentW - containerW) / 2;
            // Min negative translation (right edge aligns with right container)
            const minTx = -maxTx;
            this.state.translateX = clamp(this.state.translateX, minTx, maxTx);
        }

        // Vertical Clamping
        if (currentH <= containerH) {
            this.state.translateY = 0;
        } else {
            const maxTy = (currentH - containerH) / 2;
            const minTy = -maxTy;
            this.state.translateY = clamp(this.state.translateY, minTy, maxTy);
        }
    }

    applyTransform() {
        // Apply transform via CSS.
        // translate3d for GPU acceleration.
        this.dom.wrapper.style.transform = `translate3d(${this.state.translateX}px, ${this.state.translateY}px, 0) scale(${this.state.zoom})`;
    }

    // --- RENDERING ---

    async renderPage(num) {
        if (!this.pdfDoc) return;
        this.pageRendering = true;
        
        const page = await this.pdfDoc.getPage(num);
        
        // 1. Get the viewport at scale 1.0 to determine natural size (Points)
        const unscaledViewport = page.getViewport({ scale: 1 });
        this.state.baseWidth = unscaledViewport.width;
        this.state.baseHeight = unscaledViewport.height;

        // 2. Render at High DPI (e.g., Scale 2.5) for crisp text when zoomed
        // This affects the internal canvas pixels, not the CSS size
        const renderScale = 2.5; 
        const renderViewport = page.getViewport({ scale: renderScale });

        this.dom.canvas.height = renderViewport.height;
        this.dom.canvas.width = renderViewport.width;

        // 3. Set the CSS size of the canvas to the BASE (natural) size
        // The zoom transformation will act upon this base size
        this.dom.canvas.style.width = `${this.state.baseWidth}px`;
        this.dom.canvas.style.height = `${this.state.baseHeight}px`;

        const renderContext = {
            canvasContext: this.dom.ctx,
            viewport: renderViewport
        };
        
        try {
            await page.render(renderContext).promise;
            this.pageRendering = false;
            
            // Once rendered, calculate the "Fit to Screen" zoom and apply boundaries
            this.resetToFit(); 

            if (this.pageNumPending !== null) {
                this.renderPage(this.pageNumPending);
                this.pageNumPending = null;
            }
        } catch(e) {
            console.error(e);
            this.pageRendering = false;
        }

        this.updatePaginationUI();
    }

    // --- INTERACTION HANDLERS ---

    handleWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey) {
            // Pinch-to-zoom (Trackpad)
            // Use exponent to smooth out delta values
            const zoomFactor = Math.exp(-e.deltaY * 0.01);
            this.zoomAtPoint(zoomFactor, e.clientX, e.clientY);
        } else {
            // Pan (Trackpad 2-finger scroll or Mouse Wheel)
            this.state.translateX -= e.deltaX;
            this.state.translateY -= e.deltaY;
            this.clampTranslation();
            this.applyTransform();
        }
    }

    zoomAtPoint(factor, clientX, clientY) {
        const oldZoom = this.state.zoom;
        let newZoom = oldZoom * factor;

        // Enforce Min/Max Zoom
        newZoom = Math.max(this.state.minZoom, Math.min(newZoom, this.state.maxZoom));
        
        if (newZoom === oldZoom) return;

        // Calculate mouse position relative to the container center
        const rect = this.dom.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Mouse offset from center
        const mouseX = clientX - rect.left - centerX;
        const mouseY = clientY - rect.top - centerY;

        // Determine how much the "world" under the mouse moves due to zoom change
        // We need to adjust translate so the point under mouse stays stationary
        // Formula: NewTx = Mouse - (Mouse - OldTx) * (NewZoom / OldZoom)
        // Simplified relative to center:
        // tx -= (mouseX - tx) * (scaleChange - 1)
        
        const scaleChange = newZoom / oldZoom;
        this.state.translateX -= (mouseX - this.state.translateX) * (scaleChange - 1);
        this.state.translateY -= (mouseY - this.state.translateY) * (scaleChange - 1);
        
        this.state.zoom = newZoom;
        this.clampTranslation();
        this.applyTransform();
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;
        this.state.isDragging = true;
        this.state.lastMouseX = e.clientX;
        this.state.lastMouseY = e.clientY;
        this.dom.container.style.cursor = 'grabbing';
    }

    handleMouseMove(e) {
        if (!this.state.isDragging) return;
        const dx = e.clientX - this.state.lastMouseX;
        const dy = e.clientY - this.state.lastMouseY;
        
        this.state.translateX += dx;
        this.state.translateY += dy;
        this.state.lastMouseX = e.clientX;
        this.state.lastMouseY = e.clientY;
        
        this.clampTranslation();
        this.applyTransform();
    }

    handleMouseUp() {
        this.state.isDragging = false;
        this.dom.container.style.cursor = 'default';
    }

    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.state.isDragging = true;
            this.state.lastMouseX = e.touches[0].clientX;
            this.state.lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            this.state.isDragging = false;
            this.state.initialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.state.initialPinchZoom = this.state.zoom;
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.state.isDragging) {
            const dx = e.touches[0].clientX - this.state.lastMouseX;
            const dy = e.touches[0].clientY - this.state.lastMouseY;
            
            this.state.translateX += dx;
            this.state.translateY += dy;
            this.state.lastMouseX = e.touches[0].clientX;
            this.state.lastMouseY = e.touches[0].clientY;
            
            this.clampTranslation();
            this.applyTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            const factor = dist / this.state.initialPinchDist;
            
            // Calculate midpoint of fingers
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            const targetZoom = this.state.initialPinchZoom * factor;
            
            // Apply zoom targeting the center of the pinch
            // Calculate effective factor relative to current state
            const relativeFactor = targetZoom / this.state.zoom;
            this.zoomAtPoint(relativeFactor, centerX, centerY);
        }
    }

    handleTouchEnd() {
        this.state.isDragging = false;
    }

    onPrevPage() {
        if (this.pageNum <= 1 || this.pageRendering) return;
        this.pageNum--;
        this.renderPage(this.pageNum); // renderPage calls resetToFit internally
    }

    onNextPage() {
        if (this.pageNum >= this.pdfDoc.numPages || this.pageRendering) return;
        this.pageNum++;
        this.renderPage(this.pageNum);
    }

    updatePaginationUI() {
        if(!this.pdfDoc) return;
        this.dom.indicator.textContent = `${this.pageNum} / ${this.pdfDoc.numPages}`;
        this.dom.btnPrev.disabled = this.pageNum <= 1;
        this.dom.btnNext.disabled = this.pageNum >= this.pdfDoc.numPages;
        this.dom.btnPrev.style.opacity = this.pageNum <= 1 ? 0.3 : 1;
        this.dom.btnNext.style.opacity = this.pageNum >= this.pdfDoc.numPages ? 0.3 : 1;
    }
}