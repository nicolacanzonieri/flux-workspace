/**
 * @file pdf-viewer.js
 * @description Handles PDF rendering using pdf.js.
 * Provides a single-page view with pagination controls.
 */
class FluxPdfViewer {
    constructor() {
        this.dom = {
            overlay: document.getElementById('pdf-viewer-overlay'),
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
        this.scale = 1.5; // Base scale for quality

        this.init();
    }

    init() {
        this.dom.btnClose.addEventListener('click', () => this.close());
        this.dom.btnPrev.addEventListener('click', () => this.onPrevPage());
        this.dom.btnNext.addEventListener('click', () => this.onNextPage());
        
        // Handle window resize to adjust scale if needed
        window.addEventListener('resize', () => {
            if(!this.dom.overlay.classList.contains('hidden') && this.pdfDoc) {
                this.renderPage(this.pageNum);
            }
        });
    }

    /**
     * Opens a PDF document.
     * @param {string} url - Blob URL or path to the PDF file.
     * @param {string} name - Name of the file for the header.
     */
    async open(url, name) {
        this.dom.title.textContent = name || "Document.pdf";
        this.dom.overlay.classList.remove('hidden');
        
        try {
            const loadingTask = pdfjsLib.getDocument(url);
            this.pdfDoc = await loadingTask.promise;
            this.pageNum = 1;
            this.updatePaginationUI();
            this.renderPage(this.pageNum);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Could not load PDF document.');
            this.close();
        }
    }

    close() {
        this.dom.overlay.classList.add('hidden');
        this.pdfDoc = null;
        this.dom.ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
    }

    /**
     * Renders a specific page number.
     * @param {number} num 
     */
    async renderPage(num) {
        this.pageRendering = true;
        
        // Fetch page
        const page = await this.pdfDoc.getPage(num);
        
        // Get wrapper dimensions (controlled by CSS 90% width/height)
        const wrapper = this.dom.overlay.querySelector('.pdf-canvas-wrapper');
        
        // Reset canvas to avoid layout influence before calculation
        this.dom.canvas.style.width = 'auto';
        this.dom.canvas.style.height = 'auto';

        const maxWidth = wrapper.clientWidth;
        const maxHeight = wrapper.clientHeight;
        
        // Unscaled viewport to get original ratio
        let viewport = page.getViewport({ scale: 1 });
        
        // Calculate desired scale to fit EXACTLY within the wrapper
        const scaleX = maxWidth / viewport.width;
        const scaleY = maxHeight / viewport.height;
        const scale = Math.min(scaleX, scaleY); // Fit entirely
        
        // Get viewport at the calculated scale
        viewport = page.getViewport({ scale: scale });

        // Set internal resolution matches the display size
        this.dom.canvas.height = viewport.height;
        this.dom.canvas.width = viewport.width;

        const renderContext = {
            canvasContext: this.dom.ctx,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);

        // Wait for render to finish
        try {
            await renderTask.promise;
            this.pageRendering = false;
            
            if (this.pageNumPending !== null) {
                this.renderPage(this.pageNumPending);
                this.pageNumPending = null;
            }
        } catch(e) {
            // Render cancelled
            this.pageRendering = false;
        }

        this.updatePaginationUI();
    }

    queueRenderPage(num) {
        if (this.pageRendering) {
            this.pageNumPending = num;
        } else {
            this.renderPage(num);
        }
    }

    onPrevPage() {
        if (this.pageNum <= 1) return;
        this.pageNum--;
        this.queueRenderPage(this.pageNum);
    }

    onNextPage() {
        if (this.pageNum >= this.pdfDoc.numPages) return;
        this.pageNum++;
        this.queueRenderPage(this.pageNum);
    }

    updatePaginationUI() {
        if(!this.pdfDoc) return;
        this.dom.indicator.textContent = `${this.pageNum} / ${this.pdfDoc.numPages}`;
        
        // Disable buttons at boundaries
        this.dom.btnPrev.disabled = this.pageNum <= 1;
        this.dom.btnNext.disabled = this.pageNum >= this.pdfDoc.numPages;
        
        // Visual opacity for disabled state handled by CSS usually, ensuring logic here
        this.dom.btnPrev.style.opacity = this.pageNum <= 1 ? 0.3 : 1;
        this.dom.btnNext.style.opacity = this.pageNum >= this.pdfDoc.numPages ? 0.3 : 1;
    }
}