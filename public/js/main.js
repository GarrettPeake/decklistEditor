// ========================================
// Decklist Editor - Main Entry Point
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { load, save, setOnLocked } from './api.js';
import { initRouter, setInitialUrlState } from './router.js';
import { setDeckList, switchDeck, copyShareUrl } from './deckList.js';
import { updateData } from './cardDisplay.js';
import { initAutocomplete, triggerAutocomplete, hideAutocomplete } from './autocomplete.js';
import { initResizers } from './resizer.js';
import { setupLandingPage, initLogoHandlers } from './landing.js';
import { initMobileHandlers } from './mobile.js';
import { initAuth, updateAuthUI, handleLocked, finishPendingProtect } from './auth.js';
import { me, takeAuthError } from './accounts/accounts.js';
import { openAccountDialog } from './accounts/dialog.js';

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
            dom.shareModal.onkeydown = null;
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
                dom.shareModal.onkeydown = null;
            }
        };
    }
}

// Main application start
async function start() {
    // Initialize logo click handlers (for returning to landing page)
    initLogoHandlers();

    // Header account buttons
    initAuth();

    // A GAuth sign-in that just came back with an error (?auth_error=)
    const authError = takeAuthError();

    // Handle landing page
    if (setupLandingPage(authError)) {
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

    // A save that finds the session gone keeps the edit and asks to sign in again.
    setOnLocked(handleLocked);

    // Load decks, and who's signed in
    const [loadResult, account] = await Promise.all([
        load(),
        state.isShareMode ? { signedIn: false } : me(),
    ]);
    state.setAccount(account);

    // A protected link, and not this browser's: sign in (by itself, after a GAuth session expired)
    if (loadResult?.locked) {
        handleLocked({ otherAccount: loadResult.otherAccount, error: authError });
        return;
    }

    // Back from GAuth, having set off to protect this link
    await finishPendingProtect();

    // Show/hide account buttons for this link
    updateAuthUI();

    if (authError) {
        openAccountDialog({ mode: 'signin', next: location.pathname, error: authError })
            .then(async (result) => {
                if (!result.signedIn) return;
                state.setAccount(await me());
                updateAuthUI();
            });
    }

    // Set initial URL state for history
    setInitialUrlState();

    // Switch to initial deck
    switchDeck(state.selectedDeck)();
}

// Start the application
start();
