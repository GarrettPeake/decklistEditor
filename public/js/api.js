// ========================================
// API & Storage Functions
// ========================================

import * as state from './state.js';
import { loadPanelSizes } from './resizer.js';

let saveTimer;
let onLocked = () => {};

/** What to do when a save finds the link locked (the session ended mid-edit). */
export function setOnLocked(handler) {
    onLocked = handler;
}

// Edits a save couldn't store because the session ended: kept in this tab until
// the owner signs in again (load() puts them back).
const unsavedKey = () => `decklister.unsaved.${state.currentUser}`;

// Load data from API
export async function load() {
    if (state.isShareMode) {
        // Load shared deck (backend resolves reference and returns text only)
        const response = await fetch(`/api/share/${state.shareId}`);
        if (response.ok) {
            const deckText = await response.text();
            state.setData([deckText]); // Share mode still uses plain text
        } else {
            state.setData(["# Shared deck not found"]);
        }
    } else if (state.currentUser) {
        // Load user decks (returns array of {id, text} objects). The session cookie
        // goes along: a protected link opens only in its owner's session.
        const response = await fetch(`/api/${state.currentUser}`);

        if (response.status === 401 || response.status === 403) {
            const result = await response.json().catch(() => ({}));
            if (result.protected) {
                return { locked: true, otherAccount: !!result.otherAccount };
            }
        }

        if (response.ok) {
            const js = await response.json();
            state.setData(js);
            const unsaved = sessionStorage.getItem(unsavedKey());
            if (unsaved) {
                sessionStorage.removeItem(unsavedKey());
                state.setData(JSON.parse(unsaved));
                save();
            }
            state.setLinkProtected(response.headers.get('X-Link-Protected') === '1');

            // Find initial deck by ID if specified in URL
            if (state.initialDeckId && state.data.length > 0) {
                const deckIndex = state.data.findIndex(d => d.id === state.initialDeckId);
                if (deckIndex !== -1) {
                    state.setSelectedDeck(deckIndex);
                }
            }

            // Save user ID to localStorage
            localStorage.setItem("decklister_user_id", state.currentUser);
        }
    }

    state.setLinkCache(JSON.parse(localStorage.getItem("link_cache")) || {});

    // Load saved panel sizes
    loadPanelSizes();

    return { locked: false };
}

// Save data to API (debounced)
export async function save() {
    // Don't save in share mode
    if (state.isShareMode) return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const body = JSON.stringify(state.data);
        fetch(`/api/${state.currentUser}`, {
            method: "put",
            body,
            headers: { 'Content-Type': 'application/json' }
        }).then(async (response) => {
            if (response.status !== 401 && response.status !== 403) return;
            const result = await response.json().catch(() => ({}));
            if (!result.protected) return;
            try {
                sessionStorage.setItem(unsavedKey(), body);
            } catch {
                // Too big for session storage: the dialog still lets them sign back in.
            }
            onLocked({ otherAccount: !!result.otherAccount });
        }).catch(() => {});
        try {
            localStorage.setItem("link_cache", JSON.stringify(state.link_cache));
        } catch {
            // Handle QuotaExceededError gracefully
        }
    }, 500);
}

// Create a share link for current deck
export async function shareDeck() {
    const deck = state.data[state.selectedDeck];
    if (!deck || !deck.id) {
        alert("No deck to share");
        return;
    }

    try {
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: state.currentUser, deckId: deck.id })
        });
        if (!response.ok) {
            const errorResult = await response.json();
            alert(errorResult.error || 'Failed to create share link');
            return null;
        }
        const result = await response.json();
        return `${window.location.origin}/share/${result.uuid}`;
    } catch (err) {
        alert("Failed to create share link");
        return null;
    }
}

// Fetch card data from Scryfall
export async function getCard(cardName) {
    if (state.link_cache[cardName]) {
        return state.link_cache[cardName];
    }

    try {
        const resp = await (await fetch("https://api.scryfall.com/cards/named?exact=" + encodeURIComponent(cardName))).json();
        const cardData = {
            link: resp["scryfall_uri"],
            imgfront: resp["card_faces"]?.[0]?.["image_uris"]?.["border_crop"] || resp["image_uris"]?.["border_crop"],
            imgback: resp["card_faces"]?.[1]?.["image_uris"]?.["border_crop"]
        };

        if (cardData.link) {
            state.link_cache[cardName] = cardData;
        }
        return cardData;
    } catch {
        return { link: null, imgfront: null, imgback: null };
    }
}
