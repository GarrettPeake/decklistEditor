// ========================================
// Decklist Editor - Main Entry Point
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { load, save } from './api.js';
import { initRouter, setInitialUrlState } from './router.js';
import { setDeckList, switchDeck, copyShareUrl } from './deckList.js';
import { updateData } from './cardDisplay.js';
import { initAutocomplete, triggerAutocomplete, hideAutocomplete } from './autocomplete.js';
import { initResizers } from './resizer.js';
import { setupLandingPage, initLogoHandlers } from './landing.js';
import { initMobileHandlers } from './mobile.js';
import { initAuth, updateAuthUI } from './auth.js';

// Initialize editor input handler
function initEditor() {
    dom.editor.oninput = (e) => {
        dom.editor.style.height = "";
        dom.editor.style.height = dom.editor.scrollHeight + "px";
        updateData(dom.editor.value);
        setDeckList();
        save();

        // Only trigger autocomplete if text content actually changed
        if (!state.isShareMode && dom.editor.value !== state.lastEditorValue) {
            state.setLastEditorValue(dom.editor.value);
            triggerAutocomplete();
        }
    };
}

// Initialize share modal
function initShareModal() {
    if (dom.closeShareModal) {
        dom.closeShareModal.onclick = () => {
            dom.shareModal.classList.remove("open");
        };
    }
    if (dom.copyShareBtn) {
        dom.copyShareBtn.onclick = copyShareUrl;
    }
    // Close modal when clicking outside
    if (dom.shareModal) {
        dom.shareModal.onclick = (e) => {
            if (e.target === dom.shareModal) {
                dom.shareModal.classList.remove("open");
            }
        };
    }
}

// Main application start
async function start() {
    // Initialize logo click handlers (for returning to landing page)
    initLogoHandlers();

    // Initialize auth (needed for landing page login button)
    initAuth();

    // Handle landing page
    if (setupLandingPage()) {
        return;
    }

    // Set up share mode UI
    if (state.isShareMode) {
        document.body.classList.add("share-mode");
    }

    // Initialize all modules
    initRouter();
    initShareModal();
    initResizers();
    initMobileHandlers();
    initAutocomplete();
    initEditor();

    // Load data from API
    const loadResult = await load();

    // If auth is required, the load function will redirect
    if (loadResult?.authRequired) {
        return;
    }

    // Update auth UI (show/hide buttons based on auth state)
    updateAuthUI();

    // Set initial URL state for history
    setInitialUrlState();

    // Switch to initial deck
    switchDeck(state.selectedDeck)();
}

// Start the application
start();
