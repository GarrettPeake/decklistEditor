// ========================================
// Mobile UI Handlers
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { applyMobileRenderHeight, resetMobileRenderHeight } from './resizer.js';

// Close mobile dropdown menu
export function closeMobileMenu() {
    dom.mobileDropdown.classList.remove("open");
}

// Update the render toggle icon based on current mode
export function updateRenderToggleIcon() {
    const icon = dom.renderToggle.querySelector(".render-icon");
    if (state.isRenderMode) {
        // Show edit icon (pencil)
        icon.innerHTML = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>';
        dom.renderToggle.classList.add("active");
    } else {
        // Show grid icon (render)
        icon.innerHTML = '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>';
        dom.renderToggle.classList.remove("active");
    }
}

// Initialize mobile-specific event handlers
export function initMobileHandlers() {
    // Update mobile detection on resize
    window.addEventListener("resize", () => {
        state.setIsMobile(window.innerWidth <= 768);
        if (!state.isMobile) {
            // Reset mobile-specific states when switching to desktop
            document.body.classList.remove("render-mode");
            dom.mobileDropdown.classList.remove("open");
            state.setIsRenderMode(false);
            updateRenderToggleIcon();
            resetMobileRenderHeight();
        }
    });

    // Mobile menu toggle
    dom.mobileMenuBtn.onclick = () => {
        dom.mobileDropdown.classList.toggle("open");
    };

    // Render mode toggle (mobile)
    dom.renderToggle.onclick = () => {
        state.setIsRenderMode(!state.isRenderMode);
        document.body.classList.toggle("render-mode", state.isRenderMode);
        updateRenderToggleIcon();

        // Apply or reset mobile card display height
        if (state.isRenderMode) {
            applyMobileRenderHeight();
        } else {
            resetMobileRenderHeight();
        }
    };

    // Close mobile dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (state.isMobile &&
            !dom.mobileDropdown.contains(e.target) &&
            !dom.mobileMenuBtn.contains(e.target) &&
            dom.mobileDropdown.classList.contains("open")) {
            closeMobileMenu();
        }
    });

    // Sidebar expand button (desktop - visible when sidebar is collapsed)
    if (dom.sidebarExpand) {
        dom.sidebarExpand.onclick = () => {
            dom.sidebar.classList.remove("collapsed");
        };
    }
}
