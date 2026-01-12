// ========================================
// Landing Page & Navigation
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';

// Handle logo click - set flag for intentional navigation
export function handleLogoClick(e) {
    sessionStorage.setItem("decklister_intentional_home", "true");
}

// Setup landing page behavior
export function setupLandingPage() {
    if (state.isLandingPage) {
        // Check if user has a saved ID and didn't intentionally navigate home
        const savedUserId = localStorage.getItem("decklister_user_id");
        const intentionalHome = sessionStorage.getItem("decklister_intentional_home");

        // Clear the intentional home flag
        sessionStorage.removeItem("decklister_intentional_home");

        if (savedUserId && !intentionalHome) {
            // Redirect to their saved page
            window.location.href = "/" + savedUserId;
            return true;
        }

        // Show landing page
        document.body.classList.add("landing-mode");

        if (dom.getStartedBtn) {
            dom.getStartedBtn.onclick = () => {
                const newUserId = crypto.randomUUID();
                localStorage.setItem("decklister_user_id", newUserId);
                window.location.href = "/" + newUserId;
            };
        }

        return true;
    }

    return false;
}

// Initialize logo click handlers
export function initLogoHandlers() {
    if (dom.logoLink) {
        dom.logoLink.onclick = handleLogoClick;
    }
    if (dom.mobileLogoLink) {
        dom.mobileLogoLink.onclick = handleLogoClick;
    }
}
