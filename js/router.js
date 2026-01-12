// ========================================
// URL Routing & History Management
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { setDeckList } from './deckList.js';
import { updateData } from './cardDisplay.js';

// Update browser URL when switching decks
export function updateUrl(deckId) {
    if (state.isShareMode || !state.currentUser) return;

    const newPath = deckId ? `/${state.currentUser}/${deckId}` : `/${state.currentUser}`;
    if (window.location.pathname !== newPath) {
        history.pushState({ deckId }, '', newPath);
    }
}

// Initialize popstate listener for browser back/forward
export function initRouter() {
    window.addEventListener('popstate', (e) => {
        if (state.isShareMode) return;

        const deckId = e.state?.deckId;
        if (deckId) {
            const deckIndex = state.data.findIndex(d => d.id === deckId);
            if (deckIndex !== -1) {
                state.setSelectedDeck(deckIndex);
                dom.editor.value = state.getDeckText(state.selectedDeck);
                state.setLastEditorValue(dom.editor.value);
                dom.editor.style.height = "";
                dom.editor.style.height = dom.editor.scrollHeight + "px";
                setDeckList();
                updateData(state.getDeckText(state.selectedDeck));
            }
        } else if (state.data.length > 0) {
            state.setSelectedDeck(0);
            dom.editor.value = state.getDeckText(0);
            state.setLastEditorValue(dom.editor.value);
            dom.editor.style.height = "";
            dom.editor.style.height = dom.editor.scrollHeight + "px";
            setDeckList();
            updateData(state.getDeckText(0));
        }
    });
}

// Set initial URL state for history
export function setInitialUrlState() {
    if (!state.isShareMode && state.data.length > 0) {
        const deckId = state.getDeckId(state.selectedDeck);
        history.replaceState(
            { deckId },
            '',
            deckId ? `/${state.currentUser}/${deckId}` : `/${state.currentUser}`
        );
    }
}
