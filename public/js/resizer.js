// ========================================
// Panel Resizing
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';

let isResizing = false;
let currentResizer = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

// DOM references for mobile resizer (added dynamically)
let mobileRenderResizer = null;

// Load saved panel sizes from localStorage
export function loadPanelSizes() {
    const savedSizes = JSON.parse(localStorage.getItem("decklister_panel_sizes") || "{}");

    if (savedSizes.sidebarWidth && dom.sidebar) {
        dom.sidebar.style.width = savedSizes.sidebarWidth + "px";
    }
    if (savedSizes.displayWidth && dom.dispArea) {
        dom.dispArea.style.width = savedSizes.displayWidth + "px";
        dom.dispArea.style.minWidth = savedSizes.displayWidth + "px";
    }
    if (savedSizes.mobileCardDisplayHeight) {
        // Store for later use in render mode
        localStorage.setItem("decklister_mobile_card_height", savedSizes.mobileCardDisplayHeight);
    }
}

// Save panel sizes to localStorage
export function savePanelSizes() {
    const sizes = {};
    if (dom.sidebar && dom.sidebar.offsetWidth > 0 && !dom.sidebar.classList.contains('collapsed')) {
        sizes.sidebarWidth = dom.sidebar.offsetWidth;
    }
    if (dom.dispArea && dom.dispArea.offsetWidth > 0) {
        sizes.displayWidth = dom.dispArea.offsetWidth;
    }
    // Save mobile card display height if set
    const mobileHeight = localStorage.getItem("decklister_mobile_card_height");
    if (mobileHeight) {
        sizes.mobileCardDisplayHeight = mobileHeight;
    }
    localStorage.setItem("decklister_panel_sizes", JSON.stringify(sizes));
}

// Handle resize movement
function handleResize(e) {
    if (!isResizing) return;

    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);

    if (currentResizer === "sidebar") {
        const deltaX = clientX - startX;
        const newWidth = Math.max(150, Math.min(400, startWidth + deltaX));
        dom.sidebar.style.width = newWidth + "px";
    } else if (currentResizer === "display") {
        const deltaX = clientX - startX;
        // Display resizer is on left edge, so dragging left increases width
        const newDisplayWidth = Math.max(200, Math.min(600, startWidth - deltaX));
        dom.dispArea.style.width = newDisplayWidth + "px";
        dom.dispArea.style.minWidth = newDisplayWidth + "px";
    } else if (currentResizer === "mobileRender") {
        const deltaY = clientY - startY;
        // Dragging down increases card display height
        const newHeight = Math.max(100, Math.min(window.innerHeight * 0.6, startHeight + deltaY));
        dom.dispArea.style.height = newHeight + "px";
        dom.dispArea.style.minHeight = newHeight + "px";
        localStorage.setItem("decklister_mobile_card_height", newHeight);
    }
}

// Stop resizing
function stopResize() {
    if (isResizing) {
        isResizing = false;
        currentResizer = null;
        document.body.classList.remove("resizing", "resizing-vertical");
        savePanelSizes();
    }
}

// Start resizing (generic)
function startResize(e, resizerType) {
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);

    isResizing = true;
    currentResizer = resizerType;
    startX = clientX;
    startY = clientY;

    if (resizerType === "sidebar") {
        startWidth = dom.sidebar.offsetWidth;
        document.body.classList.add("resizing");
    } else if (resizerType === "display") {
        startWidth = dom.dispArea.offsetWidth;
        document.body.classList.add("resizing");
    } else if (resizerType === "mobileRender") {
        startHeight = dom.dispArea.offsetHeight;
        document.body.classList.add("resizing-vertical");
    }

    e.preventDefault();
}

// Initialize resize handlers
export function initResizers() {
    // Get mobile render resizer element
    mobileRenderResizer = document.getElementById("mobileRenderResizer");

    // Sidebar resizer (desktop only)
    if (dom.sidebarResizer) {
        dom.sidebarResizer.addEventListener("mousedown", (e) => {
            if (state.isMobile) return;
            startResize(e, "sidebar");
        });

        dom.sidebarResizer.addEventListener("touchstart", (e) => {
            if (state.isMobile) return;
            startResize(e, "sidebar");
        }, { passive: false });
    }

    // Display resizer (desktop only)
    if (dom.displayResizer) {
        dom.displayResizer.addEventListener("mousedown", (e) => {
            if (state.isMobile) return;
            startResize(e, "display");
        });

        dom.displayResizer.addEventListener("touchstart", (e) => {
            if (state.isMobile) return;
            startResize(e, "display");
        }, { passive: false });
    }

    // Mobile render mode resizer
    if (mobileRenderResizer) {
        mobileRenderResizer.addEventListener("mousedown", (e) => {
            if (!state.isMobile || !state.isRenderMode) return;
            startResize(e, "mobileRender");
        });

        mobileRenderResizer.addEventListener("touchstart", (e) => {
            if (!state.isMobile || !state.isRenderMode) return;
            startResize(e, "mobileRender");
        }, { passive: false });
    }

    // Mouse move handler
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("touchmove", (e) => {
        if (isResizing) {
            handleResize(e);
        }
    }, { passive: false });

    // Mouse up handler
    document.addEventListener("mouseup", stopResize);
    document.addEventListener("touchend", stopResize);
}

// Apply saved mobile card display height when entering render mode
export function applyMobileRenderHeight() {
    const savedHeight = localStorage.getItem("decklister_mobile_card_height");
    if (savedHeight && dom.dispArea) {
        dom.dispArea.style.height = savedHeight + "px";
        dom.dispArea.style.minHeight = savedHeight + "px";
    }
}

// Reset mobile card display height when exiting render mode
export function resetMobileRenderHeight() {
    if (dom.dispArea) {
        dom.dispArea.style.height = "";
        dom.dispArea.style.minHeight = "";
    }
}
