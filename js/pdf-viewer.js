/**
 * @class FluxPdfViewer
 * @description Manages the PDF overlay interface.
 * Features:
 * - PDF Rendering using pdf.js
 * - Pagination and Zoom
 * - Annotation System (Highlight, Eraser)
 * - ID-based persistence to ensure annotations are saved to the correct Project Board element.
 */
class FluxPdfViewer {
    constructor() {
        this.dom = {
            overlay: document.getElementById('pdf-viewer-overlay'),
            container: document.querySelector('.pdf-container'),
            wrapper: document.querySelector('.pdf-canvas-wrapper'),
            
            // Layer 1: The rendered PDF Page
            canvas: document.getElementById('pdf-render-canvas'),
            ctx: document.getElementById('pdf-render-canvas').getContext('2d'),
            
            // Layer 2: Annotations (Canvas overlay)
            annotationCanvas: document.getElementById('pdf-annotation-canvas'),
            annotationCtx: document.getElementById('pdf-annotation-canvas').getContext('2d'),
            
            bottomToolbar: document.getElementById('toolbar'),

            // UI Controls
            title: document.getElementById('pdf-viewer-title'),
            indicator: document.getElementById('pdf-page-indicator'),
            btnClose: document.getElementById('btn-close-pdf'),
            btnMinimize: document.getElementById('btn-minimize-pdf'),
            btnPrev: document.getElementById('btn-pdf-prev'),
            btnNext: document.getElementById('btn-pdf-next'),
            pill: document.getElementById('pdf-minimized-pill'),
            pillTitle: document.getElementById('pdf-pill-title'),
            toolBtns: document.querySelectorAll('.pdf-tool-btn'),

            // Goto Page Modal
            gotoModal: document.getElementById('pdf-goto-modal'),
            gotoInput: document.getElementById('input-goto-page'),
            gotoConfirm: document.getElementById('btn-confirm-goto'),
            gotoClose: document.getElementById('btn-close-goto'),
            gotoRangeText: document.getElementById('goto-page-range')
        };
        
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;
        this.fileName = "Document.pdf";

        // Reference to the whiteboard element ID to save data back
        this.elementId = null;

        // Viewport & Interaction State
        this.state = {
            zoom: 1,
            minZoom: 0.1,
            maxZoom: 5,
            translateX: 0,
            translateY: 0,
            activePdfTool: 'select', 
            isDragging: false, 
            isDrawingAnnotation: false, 
            lastMouseX: 0,
            lastMouseY: 0,
            annotationStart: { x: 0, y: 0 },
            currentAnnotationRect: null,
            baseWidth: 0, 
            baseHeight: 0,
            renderScale: 2.5,  // High DPI rendering
            zoomSensitivity: 0.008, 
            panSensitivity: 1.1,
            initialPinchDist: 0,
            initialPinchZoom: 1
        };

        this.annotations = []; 
        this.init();
    }

    init() {
        // UI Bindings
        this.dom.btnClose.addEventListener('click', () => this.close());
        this.dom.btnMinimize.addEventListener('click', () => this.minimize());
        this.dom.pill.addEventListener('click', () => this.restore());
        this.dom.btnPrev.addEventListener('click', () => this.onPrevPage());
        this.dom.btnNext.addEventListener('click', () => this.onNextPage());
        
        // Goto Page Modal
        this.dom.indicator.addEventListener('click', () => this.openGotoModal());
        this.dom.gotoClose.addEventListener('click', () => this.dom.gotoModal.classList.add('hidden'));
        this.dom.gotoConfirm.addEventListener('click', () => this.handleGotoPage());
        
        // Tool Selection
        this.dom.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.getAttribute('data-pdf-tool'));
            });
        });

        // Mouse Events
        this.dom.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.dom.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Touch Events
        this.dom.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.dom.container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.dom.container.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Modal inputs
        this.dom.gotoModal.addEventListener('click', (e) => {
            if (e.target === this.dom.gotoModal) this.dom.gotoModal.classList.add('hidden');
        });
        this.dom.gotoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleGotoPage();
        });

        // Auto-recalculate bounds on window resize
        window.addEventListener('resize', () => {
            if(!this.dom.overlay.classList.contains('hidden') && this.pdfDoc) {
                this.recalculateBounds();
            }
        });
    }

    /**
     * @method saveAnnotations
     * @description Saves current annotations back to the global Project state.
     * Uses ID lookup to find the correct element even if it's on a background board.
     */
    saveAnnotations() {
        if (!this.elementId || !window.flux) return;

        // Create a deep copy of current annotations
        const newAnnotations = JSON.parse(JSON.stringify(this.annotations));
        let savedCount = 0;

        // 1. Update the PROJECT DATA (Source of Truth)
        if (window.flux.project && window.flux.project.boards) {
            window.flux.project.boards.forEach(board => {
                const targetElement = board.elements.find(el => el.id === this.elementId);
                if (targetElement) {
                    targetElement.annotations = newAnnotations;
                    savedCount++;
                }
            });
        }

        // 2. Update the ACTIVE CANVAS (Visual State)
        if (window.flux.whiteboard) {
            const liveElement = window.flux.whiteboard.elements.find(el => el.id === this.elementId);
            if (liveElement) {
                liveElement.annotations = newAnnotations;
                savedCount++;
            }
        }

        console.log(`PDF Annotations saved. Updated ${savedCount} references for ID: ${this.elementId}`);
    }

    selectTool(tool) {
        this.state.activePdfTool = tool;
        this.dom.toolBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-pdf-tool') === tool);
        });
        this.state.isDragging = false;
        this.state.isDrawingAnnotation = false;
        this.dom.container.style.cursor = tool === 'select' ? 'default' : 'crosshair';
        
        this.drawAnnotations();
    }

    /**
     * @method open
     * @description Loads a PDF element into the viewer.
     * @param {Object} element - The PDF element object from the whiteboard.
     */
    async open(element) {
        if (!element || !element.src) {
            console.error("Invalid PDF element passed to open()");
            return;
        }

        // Ensure overlay is in the DOM
        if(this.dom.overlay.parentElement) {
            document.body.appendChild(this.dom.overlay);
        }

        console.log("PDF Viewer: Opening", element.name);
        
        this.elementId = element.id;
        this.fileName = element.name || "Document.pdf";
        
        // Load existing annotations or init empty
        this.annotations = element.annotations ? JSON.parse(JSON.stringify(element.annotations)) : [];

        // Update UI
        this.dom.title.textContent = this.fileName;
        this.dom.pillTitle.textContent = this.fileName;
        
        this.dom.overlay.classList.remove('hidden');
        this.dom.overlay.style.display = 'flex';
        this.dom.pill.classList.add('hidden');
        
        // Reset View
        this.state.translateX = 0;
        this.state.translateY = 0;
        this.state.zoom = 1;

        try {
            if (typeof pdfjsLib === 'undefined') throw new Error("PDF.js library not loaded");

            const loadingTask = pdfjsLib.getDocument(element.src);
            this.pdfDoc = await loadingTask.promise;
            this.pageNum = 1;
            this.renderPage(this.pageNum);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert("Could not load PDF. Check console.");
            this.close();
        }
    }

    close() {
        this.saveAnnotations();
        this.dom.overlay.classList.add('hidden');
        this.dom.pill.classList.add('hidden');
        
        // Cleanup
        this.pdfDoc = null;
        this.annotations = []; 
        this.elementId = null;
        this.dom.ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
        this.dom.annotationCtx.clearRect(0, 0, this.dom.annotationCanvas.width, this.dom.annotationCanvas.height);
    }

    minimize() {
        this.saveAnnotations();
        this.dom.overlay.classList.add('hidden');
        this.dom.pill.classList.remove('hidden');
        this.dom.bottomToolbar.classList.remove('hidden');
    }

    restore() {
        if(this.dom.overlay.parentElement) {
            document.body.appendChild(this.dom.overlay);
        }
        this.dom.pill.classList.add('hidden');
        this.dom.overlay.classList.remove('hidden');
        this.dom.overlay.style.display = 'flex';

        if(this.pdfDoc) {
            this.recalculateBounds();
        }
    }

    // --- COORDINATE MATH ---

    /**
     * @method screenToBase
     * @description Converts screen client coordinates to PDF base coordinates (0 to baseWidth).
     * Compensates for CSS Scale and Translate transforms.
     */
    screenToBase(clientX, clientY) {
        const rect = this.dom.wrapper.getBoundingClientRect();
        
        // Relative to the wrapper visual size
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        
        // Calculate the scale factor between visual pixels and PDF base points
        const scaleX = this.state.baseWidth / rect.width;
        const scaleY = this.state.baseHeight / rect.height;

        return { 
            x: relX * scaleX, 
            y: relY * scaleY 
        };
    }

    // --- MOUSE INTERACTION ---

    handleMouseDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        
        if (this.state.activePdfTool === 'select') {
            // Pan Mode
            this.state.isDragging = true;
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
            this.dom.container.style.cursor = 'grabbing';
        } else {
            // Annotation Mode
            this.state.isDrawingAnnotation = true;
            this.state.annotationStart = this.screenToBase(e.clientX, e.clientY);
            this.state.currentAnnotationRect = { 
                x: this.state.annotationStart.x, 
                y: this.state.annotationStart.y, 
                w: 0, 
                h: 0 
            };
        }
    }

    handleMouseMove(e) {
        if (this.state.isDragging) {
            const dx = e.clientX - this.state.lastMouseX;
            const dy = e.clientY - this.state.lastMouseY;
            this.state.translateX += dx;
            this.state.translateY += dy;
            this.state.lastMouseX = e.clientX;
            this.state.lastMouseY = e.clientY;
            this.clampTranslation();
            this.applyTransform();
        } else if (this.state.isDrawingAnnotation) {
            const current = this.screenToBase(e.clientX, e.clientY);
            this.state.currentAnnotationRect = {
                x: Math.min(this.state.annotationStart.x, current.x),
                y: Math.min(this.state.annotationStart.y, current.y),
                w: Math.abs(current.x - this.state.annotationStart.x),
                h: Math.abs(current.y - this.state.annotationStart.y)
            };
            this.drawAnnotations();
        }
    }

    handleMouseUp(e) {
        if (this.state.isDrawingAnnotation) this.finalizeAnnotation();
        this.state.isDragging = false;
        this.state.isDrawingAnnotation = false;
        if(this.state.activePdfTool === 'select') this.dom.container.style.cursor = 'default';
    }

    openGotoModal() {
        if (!this.pdfDoc) return;
        this.dom.gotoModal.style.zIndex = 7000;
        this.dom.gotoRangeText.textContent = `Inserisci un numero tra 1 e ${this.pdfDoc.numPages}`;
        this.dom.gotoInput.value = this.pageNum;
        this.dom.gotoInput.max = this.pdfDoc.numPages;
        this.dom.gotoModal.classList.remove('hidden');
        setTimeout(() => this.dom.gotoInput.select(), 100);
    }

    handleGotoPage() {
        const targetPage = parseInt(this.dom.gotoInput.value);
        if (targetPage >= 1 && targetPage <= this.pdfDoc.numPages) {
            this.dom.gotoModal.classList.add('hidden');
            if (targetPage !== this.pageNum) {
                this.renderPage(targetPage);
            }
        } else {
            alert(`Pagina non valida. Inserire un numero tra 1 e ${this.pdfDoc.numPages}`);
        }
    }

    finalizeAnnotation() {
        const rect = this.state.currentAnnotationRect;
        // Ignore tiny accidental clicks
        if (!rect || (rect.w < 1 && rect.h < 1)) {
            this.state.currentAnnotationRect = null;
            this.drawAnnotations();
            return;
        }

        if (this.state.activePdfTool === 'highlighter') {
            // Add new highlight
            this.annotations.push({
                page: this.pageNum,
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                type: 'highlight'
            });
        } else if (this.state.activePdfTool === 'eraser') {
            // Remove intersecting highlights (AABB check)
            this.annotations = this.annotations.filter(ann => {
                if (ann.page !== this.pageNum) return true; 
                
                const noOverlap = (
                    rect.x > ann.x + ann.w ||
                    rect.x + rect.w < ann.x ||
                    rect.y > ann.y + ann.h ||
                    rect.y + rect.h < ann.y
                );
                
                return noOverlap;
            });
        }

        this.state.currentAnnotationRect = null;
        this.drawAnnotations();
    }

    // --- RENDERING ---

    async renderPage(num) {
        if (!this.pdfDoc) return;
        this.pageRendering = true;
        this.pageNum = num;

        const page = await this.pdfDoc.getPage(num);
        
        // 1. Calculate natural dimensions
        const unscaledViewport = page.getViewport({ scale: 1 });
        this.state.baseWidth = unscaledViewport.width;
        this.state.baseHeight = unscaledViewport.height;

        // 2. High DPI Render scale setup
        const renderScale = this.state.renderScale; 
        const renderViewport = page.getViewport({ scale: renderScale });
        
        // 3. Setup PDF Canvas
        this.dom.canvas.height = renderViewport.height;
        this.dom.canvas.width = renderViewport.width;
        this.dom.canvas.style.width = `${this.state.baseWidth}px`;
        this.dom.canvas.style.height = `${this.state.baseHeight}px`;

        // 4. Setup Annotation Canvas (Overlay)
        this.dom.annotationCanvas.height = renderViewport.height;
        this.dom.annotationCanvas.width = renderViewport.width;
        this.dom.annotationCanvas.style.width = `${this.state.baseWidth}px`;
        this.dom.annotationCanvas.style.height = `${this.state.baseHeight}px`;

        try {
            await page.render({ canvasContext: this.dom.ctx, viewport: renderViewport }).promise;
            this.pageRendering = false;
            
            // Auto-fit only on initial load
            if(this.state.zoom === 1) this.resetToFit();
            
            this.drawAnnotations();
            
            if (this.pageNumPending !== null) {
                this.renderPage(this.pageNumPending);
                this.pageNumPending = null;
            }
        } catch(e) {
            this.pageRendering = false;
        }
        this.updatePaginationUI();
    }

    drawAnnotations() {
        if (!this.pdfDoc) return;
        
        const ctx = this.dom.annotationCtx;
        const scale = this.state.renderScale; // e.g. 2.5
        
        // Clear
        ctx.clearRect(0, 0, this.dom.annotationCanvas.width, this.dom.annotationCanvas.height);
        
        // 1. Draw stored highlights for this page
        this.annotations.forEach(ann => {
            if (ann.page === this.pageNum && ann.type === 'highlight') {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.4)'; // Transparent yellow
                ctx.fillRect(ann.x * scale, ann.y * scale, ann.w * scale, ann.h * scale);
            }
        });

        // 2. Draw current interaction rectangle (Preview)
        const rect = this.state.currentAnnotationRect;
        if (this.state.isDrawingAnnotation && rect) {
            ctx.save();
            if (this.state.activePdfTool === 'highlighter') {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
                ctx.fillRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
                ctx.strokeStyle = '#e6e600';
                ctx.lineWidth = 1 * scale;
                ctx.strokeRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
            } else if (this.state.activePdfTool === 'eraser') {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.fillRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.lineWidth = 2 * scale;
                ctx.setLineDash([5 * scale, 5 * scale]);
                ctx.strokeRect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
            }
            ctx.restore();
        }
    }

    // --- HELPER FUNCTIONS ---

    handleWheel(e) {
        e.preventDefault();
        // Zoom on Ctrl+Wheel
        if (e.ctrlKey) {
            const zoomFactor = Math.exp(-e.deltaY * 0.01);
            this.zoomAtPoint(zoomFactor, e.clientX, e.clientY);
        } else {
            // Pan
            this.state.translateX -= e.deltaX;
            this.state.translateY -= e.deltaY;
            this.clampTranslation();
            this.applyTransform();
        }
    }

    zoomAtPoint(factor, clientX, clientY) {
        const oldZoom = this.state.zoom;
        let newZoom = Math.max(this.state.minZoom, Math.min(oldZoom * factor, this.state.maxZoom));
        if (newZoom === oldZoom) return;
        
        const rect = this.dom.container.getBoundingClientRect();
        const mouseX = clientX - rect.left - rect.width / 2;
        const mouseY = clientY - rect.top - rect.height / 2;
        
        // Adjust translation to keep point under mouse
        const scaleChange = newZoom / oldZoom;
        this.state.translateX -= (mouseX - this.state.translateX) * (scaleChange - 1);
        this.state.translateY -= (mouseY - this.state.translateY) * (scaleChange - 1);
        
        this.state.zoom = newZoom;
        this.clampTranslation();
        this.applyTransform();
    }

    clampTranslation() {
        const currentW = this.state.baseWidth * this.state.zoom;
        const currentH = this.state.baseHeight * this.state.zoom;
        const containerW = this.dom.container.clientWidth;
        const containerH = this.dom.container.clientHeight;
        
        const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
        
        // Center if smaller than viewport, else clamp edges
        if (currentW <= containerW) this.state.translateX = 0;
        else { const maxTx = (currentW - containerW) / 2; this.state.translateX = clamp(this.state.translateX, -maxTx, maxTx); }
        
        if (currentH <= containerH) this.state.translateY = 0;
        else { const maxTy = (currentH - containerH) / 2; this.state.translateY = clamp(this.state.translateY, -maxTy, maxTy); }
    }

    applyTransform() {
        this.dom.wrapper.style.transform = `translate3d(${this.state.translateX}px, ${this.state.translateY}px, 0) scale(${this.state.zoom})`;
    }

    resetToFit() {
        if (!this.state.baseWidth) return;
        // Fit within container with margin
        const scale = Math.min(this.dom.container.clientWidth / this.state.baseWidth, this.dom.container.clientHeight / this.state.baseHeight) * 0.95;
        this.state.minZoom = scale;
        this.state.zoom = scale;
        this.state.translateX = 0;
        this.state.translateY = 0;
        this.applyTransform();
    }

    recalculateBounds() {
        if (!this.state.baseWidth) return;
        this.state.minZoom = Math.min(this.dom.container.clientWidth / this.state.baseWidth, this.dom.container.clientHeight / this.state.baseHeight) * 0.95;
        if (this.state.zoom < this.state.minZoom) this.state.zoom = this.state.minZoom;
        this.clampTranslation(); this.applyTransform();
    }

    // --- TOUCH HANDLERS ---
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.handleMouseDown(e.touches[0]);
        } else if (e.touches.length === 2) {
            this.state.isDragging = false;
            this.state.isDrawingAnnotation = false;
            this.state.initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            this.state.initialPinchZoom = this.state.zoom;
        }
    }

    handleTouchMove(e) {
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 1) {
            this.handleMouseMove(e.touches[0]);
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            if (this.state.initialPinchDist) {
                this.zoomAtPoint(dist / this.state.initialPinchDist / (this.state.zoom / this.state.initialPinchZoom), centerX, centerY);
            }
        }
    }

    handleTouchEnd(e) { this.handleMouseUp(e); }

    onPrevPage() { if (this.pageNum > 1 && !this.pageRendering) this.renderPage(this.pageNum - 1); }
    onNextPage() { if (this.pageNum < this.pdfDoc.numPages && !this.pageRendering) this.renderPage(this.pageNum + 1); }

    updatePaginationUI() {
        if(!this.pdfDoc) return;
        this.dom.indicator.textContent = `${this.pageNum} / ${this.pdfDoc.numPages}`;
        this.dom.btnPrev.disabled = this.pageNum <= 1;
        this.dom.btnNext.disabled = this.pageNum >= this.pdfDoc.numPages;
    }
}