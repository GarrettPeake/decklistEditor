// ========================================
// Landing Page & Navigation
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { initLandingAccount, newLink } from './auth.js';

// Handle logo click - set flag for intentional navigation
export function handleLogoClick(e) {
    sessionStorage.setItem("decklister_intentional_home", "true");
}

// Setup landing page behavior. `authError`: a GAuth sign-in from here just failed.
export function setupLandingPage(authError) {
    if (state.isLandingPage) {
        const params = new URLSearchParams(window.location.search);

        // Check if user has a saved ID and didn't intentionally navigate home
        const savedUserId = localStorage.getItem("decklister_user_id");
        const intentionalHome = sessionStorage.getItem("decklister_intentional_home");

        // Clear the intentional home flag
        sessionStorage.removeItem("decklister_intentional_home");

        // Back from signing in (or failing to): stay for the account part.
        const signingIn = authError || params.has('signed-in');
        if (savedUserId && !intentionalHome && !signingIn) {
            // Redirect to their saved page
            window.location.href = "/" + savedUserId;
            return true;
        }

        // Show landing page
        document.body.classList.add("landing-mode");

        if (dom.getStartedBtn) {
            dom.getStartedBtn.onclick = newLink;
        }

        initLandingAccount(authError);
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
