/**
 * @file shortcuts.js
 * @description Handles global keyboard shortcuts for the Flux application.
 * Maps keys to FluxApp controller methods.
 */

document.addEventListener('keydown', (e) => {
    // Ensure the app is initialized
    const app = window.flux;
    if (!app || !app.state.isReady) return;

    // --- CONTEXT CHECK ---
    
    // Check if the user is currently typing in an input field, textarea, or contentEditable element.
    const target = e.target;
    const isTyping = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

    // Detect Command (Mac) or Control (Windows/Linux)
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    // --- 1. EDITOR SHORTCUTS (Cmd/Ctrl + Enter) ---
    // These must work even if focused inside the textarea
    if (isCmdOrCtrl && e.key === 'Enter') {
        // Check if Markdown Editor is open
        if (!app.dom.editorOverlay.classList.contains('hidden')) {
            e.preventDefault();
            app.saveAndCloseMarkdownEditor();
            return;
        }
        // Check if Formula/LaTeX Editor is open
        if (!app.dom.formulaOverlay.classList.contains('hidden')) {
            e.preventDefault();
            app.saveAndCloseFormulaEditor();
            return;
        }
    }

    // --- 2. GLOBAL SHORTCUTS (Modifiers) ---

    // Save Project (Cmd/Ctrl + S)
    if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); // Prevent browser "Save Page"
        if (app.state.boardActive) {
            app.downloadProjectZip();
        }
        return;
    }

    // Open/Toggle Library (Cmd/Ctrl + L)
    if (isCmdOrCtrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault(); // Prevent browser "Open Location"
        app.dom.libPopup.classList.toggle('hidden');
        return;
    }

    // Duplicate Selected (Cmd/Ctrl + D)
    if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); // Prevent browser "Add Bookmark"
        if (app.state.boardActive && !isTyping) {
            app.whiteboard.duplicateSelected();
        }
        return;
    }

    // --- 3. PDF VIEWER SHORTCUTS ---
    // These work only if the PDF viewer is open and the user isn't typing elsewhere
    const isPdfOpen = app.pdfViewer && !app.pdfViewer.dom.overlay.classList.contains('hidden');
    if (isPdfOpen && !isTyping) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            app.pdfViewer.onNextPage();
            return;
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            app.pdfViewer.onPrevPage();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            app.pdfViewer.close();
            return;
        }
    }

    // --- 4. SINGLE KEY SHORTCUTS ---
    // If typing inside an input/textarea, we STOP here to allow natural typing
    if (isTyping) return;

    // Delete Selected (Backspace or Delete)
    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (app.state.boardActive) {
            app.whiteboard.deleteSelected();
        }
        return;
    }

    // Tool Shortcuts (active only if no modifiers are pressed)
    if (!app.state.boardActive || isCmdOrCtrl || e.altKey || e.shiftKey) return;

    switch (e.key.toLowerCase()) {
        case '1':
            app.selectTool('select');
            break;
        case '2':
            app.selectTool('pan');
            break;
        case '3':
            app.selectTool('pen');
            break;
        case 'l':
            // L = Line Tool
            app.createLineAction();
            break;
        case 's':
            // S = Shape Tool (Opens modal)
            app.dom.shapesModal.classList.remove('hidden');
            break;
        case 't':
            // T = Text Tool
            app.createTextAction();
            break;
        case 'e':
            // E = Equation/Math Tool
            app.createFormulaAction();
            break;
        case 'i':
            // I = Image Tool
            app.createImageAction();
            break;
    }
});