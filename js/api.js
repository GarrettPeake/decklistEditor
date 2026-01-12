// ========================================
// API & Storage Functions
// ========================================

import * as state from './state.js';
import { loadPanelSizes } from './resizer.js';

let saveTimer;

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
        // Load user decks (returns array of {id, text} objects)
        await fetch(`/api/${state.currentUser}`)
            .then(e => e.json())
            .then(js => {
                state.setData(js);
            });

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

    state.setLinkCache(JSON.parse(localStorage.getItem("link_cache")) || {});

    // Load saved panel sizes
    loadPanelSizes();
}

// Save data to API (debounced)
export async function save() {
    // Don't save in share mode
    if (state.isShareMode) return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        fetch(`/api/${state.currentUser}`, {
            method: "put",
            body: JSON.stringify(state.data)
        });
    }, 500);

    localStorage.setItem("link_cache", JSON.stringify(state.link_cache));
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

    const resp = await (await fetch("https://api.scryfall.com/cards/named?exact=" + cardName)).json();
    const cardData = {
        link: resp["scryfall_uri"],
        imgfront: resp["card_faces"]?.[0]?.["image_uris"]?.["border_crop"] || resp["image_uris"]?.["border_crop"],
        imgback: resp["card_faces"]?.[1]?.["image_uris"]?.["border_crop"]
    };

    state.link_cache[cardName] = cardData;
    return cardData;
}
