// ========================================
// Panel Resizing
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';

let isResizing = false;
let currentResizer = null;
let startX = 0;
let startWidth = 0;
let startDisplayWidth = 0;

// Load saved panel sizes from localStorage
export function loadPanelSizes() {
    const savedSizes = JSON.parse(localStorage.getItem("decklister_panel_sizes") || "{}");

    if (savedSizes.sidebarWidth && dom.sidebar) {
        dom.sidebar.style.width = savedSizes.sidebarWidth + "px";
    }
    if (savedSizes.editorFlex && dom.editor) {
        dom.editor.style.flex = "0 0 " + savedSizes.editorFlex + "%";
    }
    if (savedSizes.displayWidth && dom.dispArea) {
        dom.dispArea.style.width = savedSizes.displayWidth + "px";
    }
}

// Save panel sizes to localStorage
export function savePanelSizes() {
    const sizes = {};
    if (dom.sidebar && dom.sidebar.offsetWidth > 0) {
        sizes.sidebarWidth = dom.sidebar.offsetWidth;
    }
    if (dom.editor) {
        const flexValue = dom.editor.style.flex;
        if (flexValue) {
            const match = flexValue.match(/[\d.]+%/);
            if (match) {
                sizes.editorFlex = parseFloat(match[0]);
            }
        }
    }
    if (dom.dispArea && dom.dispArea.offsetWidth > 0) {
        sizes.displayWidth = dom.dispArea.offsetWidth;
    }
    localStorage.setItem("decklister_panel_sizes", JSON.stringify(sizes));
}

// Handle resize movement
function handleResize(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;

    if (currentResizer === "sidebar") {
        const newWidth = Math.max(150, Math.min(400, startWidth + deltaX));
        dom.sidebar.style.width = newWidth + "px";
    } else if (currentResizer === "editor") {
        const containerWidth = dom.editorContainer.offsetWidth;
        const newEditorWidth = startWidth + deltaX;
        const percentage = Math.max(20, Math.min(80, (newEditorWidth / containerWidth) * 100));
        dom.editor.style.flex = "0 0 " + percentage + "%";
    } else if (currentResizer === "display") {
        const newDisplayWidth = Math.max(200, Math.min(600, startDisplayWidth - deltaX));
        dom.dispArea.style.width = newDisplayWidth + "px";
    }
}

// Stop resizing
function stopResize() {
    if (isResizing) {
        isResizing = false;
        currentResizer = null;
        document.body.classList.remove("resizing");
        savePanelSizes();
    }
}

// Initialize resize handlers
export function initResizers() {
    // Sidebar resizer (desktop only)
    if (dom.sidebarResizer) {
        dom.sidebarResizer.addEventListener("mousedown", (e) => {
            if (state.isMobile) return;
            isResizing = true;
            currentResizer = "sidebar";
            startX = e.clientX;
            startWidth = dom.sidebar.offsetWidth;
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Editor resizer (between editor and card-links)
    if (dom.editorResizer) {
        dom.editorResizer.addEventListener("mousedown", (e) => {
            if (state.isMobile) return;
            isResizing = true;
            currentResizer = "editor";
            startX = e.clientX;
            startWidth = dom.editor.offsetWidth;
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Display resizer (between editor-container and card-display)
    if (dom.displayResizer) {
        dom.displayResizer.addEventListener("mousedown", (e) => {
            if (state.isMobile) return;
            isResizing = true;
            currentResizer = "display";
            startX = e.clientX;
            startWidth = dom.editorContainer.offsetWidth;
            startDisplayWidth = dom.dispArea.offsetWidth;
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Touch support for resizers
    [dom.sidebarResizer, dom.editorResizer, dom.displayResizer].forEach(resizer => {
        if (!resizer) return;
        resizer.addEventListener("touchstart", (e) => {
            if (state.isMobile) return;
            const resizerType = resizer.id.replace("Resizer", "");

            isResizing = true;
            currentResizer = resizerType;
            startX = e.touches[0].clientX;

            if (currentResizer === "sidebar") {
                startWidth = dom.sidebar.offsetWidth;
            } else if (currentResizer === "editor") {
                startWidth = dom.editor.offsetWidth;
            } else if (currentResizer === "display") {
                startWidth = dom.editorContainer.offsetWidth;
                startDisplayWidth = dom.dispArea.offsetWidth;
            }

            document.body.classList.add("resizing");
            e.preventDefault();
        }, { passive: false });
    });

    // Mouse move handler
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("touchmove", (e) => {
        if (isResizing) {
            handleResize({ clientX: e.touches[0].clientX });
        }
    }, { passive: false });

    // Mouse up handler
    document.addEventListener("mouseup", stopResize);
    document.addEventListener("touchend", stopResize);
}
