/**
 * @file shortcuts.js
 * @description Handles global keyboard shortcuts for the Flux application.
 * This module listens to 'keydown' events and maps specific key combinations
 * to FluxApp controller methods.
 * 
 * SHORTCUT MAP:
 * - Cmd/Ctrl + Enter: Save & Close Editor (Markdown/Formula)
 * - Cmd/Ctrl + S: Save Project
 * - Cmd/Ctrl + L: Toggle Library
 * - Cmd/Ctrl + D: Duplicate Selected
 * - Arrow Keys: PDF Navigation (if open)
 * - Escape: Close PDF Viewer
 * - Backspace/Delete: Delete Selected Elements
 * - 1, 2, 3: Tool selection (Select, Pan, Pen)
 * - L, S, T, E, I: Quick tool selection (Line, Shape, Text, Equation, Image)
 */

document.addEventListener('keydown', (e) => {
    // Ensure the app is initialized and attached to the window
    const app = window.flux;
    if (!app || !app.state.isReady) return;

    // --- CONTEXT CHECK ---
    // Detect if the user is interacting with a text input field to avoid
    // triggering shortcuts while typing (e.g. pressing 'L' in a text box).
    const target = e.target;
    const isTyping = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

    // Detect platform-agnostic modifier key (Command on Mac, Control on Win/Linux)
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    // --- 1. EDITOR SHORTCUTS (Cmd/Ctrl + Enter) ---
    // These specific shortcuts must work EVEN IF the user is typing in a textarea.
    if (isCmdOrCtrl && e.key === 'Enter') {
        // Case A: Markdown Editor is open
        if (!app.dom.editorOverlay.classList.contains('hidden')) {
            e.preventDefault();
            app.saveAndCloseMarkdownEditor();
            return;
        }
        // Case B: Formula/LaTeX Editor is open
        if (!app.dom.formulaOverlay.classList.contains('hidden')) {
            e.preventDefault();
            app.saveAndCloseFormulaEditor();
            return;
        }
    }

    // --- 2. GLOBAL SYSTEM SHORTCUTS ---
    
    // Save Project (Cmd/Ctrl + S)
    if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); // Prevent browser "Save Page" dialog
        if (app.state.boardActive) {
            app.downloadProjectZip();
        }
        return;
    }

    // Open/Toggle Library (Cmd/Ctrl + L)
    if (isCmdOrCtrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault(); // Prevent browser location bar focus
        app.dom.libPopup.classList.toggle('hidden');
        return;
    }

    // Duplicate Selected Element (Cmd/Ctrl + D)
    if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); // Prevent browser bookmark dialog
        if (app.state.boardActive && !isTyping) {
            app.whiteboard.duplicateSelected();
        }
        return;
    }

    // Minimize/Restore PDF Viewer (Cmd/Ctrl + M)
    if (isCmdOrCtrl && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        
        if (app.pdfViewer && app.pdfViewer.pdfDoc) {
            const isFullOpen = !app.pdfViewer.dom.overlay.classList.contains('hidden');
            const isMinimized = !app.pdfViewer.dom.pill.classList.contains('hidden');
            
            if (isFullOpen) {
                app.pdfViewer.minimize();
            } else if (isMinimized) {
                app.pdfViewer.restore();
            }
        }
        return;
    }
    
    const isPdfOpen = app.pdfViewer && !app.pdfViewer.dom.overlay.classList.contains('hidden');

    // --- 3. PDF VIEWER CONTEXT SHORTCUTS ---
    if (isPdfOpen) {
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
    }

    // --- 4. SINGLE KEY TOOL SHORTCUTS ---
    // If the user is typing in a text field, we stop here to allow normal input.
    if (isTyping) return;

    // Delete Selected (Backspace or Delete)
    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (app.state.boardActive) {
            app.whiteboard.deleteSelected();
        }
        return;
    }

    // Tool Shortcuts (only active if no modifiers are pressed)
    // Prevents conflict with browser shortcuts like Ctrl+T (New Tab).
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
            // S = Shape Tool (Opens selection modal)
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
            // I = Image Tool (Triggers file picker)
            app.createImageAction();
            break;
    }
});