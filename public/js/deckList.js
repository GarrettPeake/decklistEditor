// ========================================
// Deck List Management
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { save, shareDeck as apiShareDeck } from './api.js';
import { updateUrl } from './router.js';
import { updateData } from './cardDisplay.js';
import { hideAutocomplete } from './autocomplete.js';
import { trapFocus } from './auth.js';
import { closeMobileMenu } from './mobile.js';

// Render the deck list in sidebar and mobile dropdown
export function setDeckList() {
    // In share mode, don't show deck list
    if (state.isShareMode) return;

    // Clear both deck lists
    dom.decklist.innerHTML = "";
    dom.mobileDecklist.innerHTML = "";

    // Create header container for add button and toggle (stays fixed)
    const headerContainer = document.createElement("div");
    headerContainer.classList.add("deck-list-header");

    // Create scrollable items container
    const itemsContainer = document.createElement("div");
    itemsContainer.classList.add("deck-list-items");

    // Create add deck button
    const addDeckButton = document.createElement("button");
    addDeckButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path d="M12 5v14M5 12h14"/></svg><span>Add Deck</span>`;
    addDeckButton.classList.add("DeckButton", "add-deck-btn");
    addDeckButton.onclick = () => {
        // Create new deck with UUID
        const newDeck = { id: crypto.randomUUID(), text: "" };
        state.setData([newDeck].concat(state.data));
        switchDeck(0)();
        closeMobileMenu();
    };

    // Create sidebar toggle button (hamburger icon)
    const toggleButton = document.createElement("button");
    toggleButton.classList.add("sidebar-toggle-btn");
    toggleButton.setAttribute("aria-label", "Toggle sidebar");
    toggleButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toggle-icon"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
    toggleButton.onclick = () => {
        dom.sidebar.classList.toggle("collapsed");
    };

    headerContainer.appendChild(addDeckButton);
    headerContainer.appendChild(toggleButton);

    // Add header and items containers to deck list
    dom.decklist.appendChild(headerContainer);
    dom.decklist.appendChild(itemsContainer);

    // Clone for mobile
    const mobileAddButton = addDeckButton.cloneNode(true);
    mobileAddButton.onclick = () => {
        const newDeck = { id: crypto.randomUUID(), text: "" };
        state.setData([newDeck].concat(state.data));
        switchDeck(0)();
        closeMobileMenu();
    };
    dom.mobileDecklist.appendChild(mobileAddButton);

    // Add each deck as a button with inline action icons
    for (let i = 0; i < state.data.length; i++) {
        const deckname = state.getDeckText(i).split("\n")[0] || "Untitled";

        // Create deck item container
        const deckItem = document.createElement("div");
        deckItem.classList.add("deck-item");
        if (i === state.selectedDeck) {
            deckItem.classList.add("active");
        }

        // Deck name button
        const button = document.createElement("button");
        button.classList.add("DeckButton", "deck-name-btn");
        button.onclick = switchDeck(i);
        button.textContent = deckname;

        // Share button (icon only)
        const shareBtn = document.createElement("button");
        shareBtn.classList.add("deck-action-btn", "share-action-btn");
        shareBtn.title = "Share deck";
        shareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
        const shareIdx = i;
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            state.setSelectedDeck(shareIdx);
            shareDeck();
        };

        // Delete button (icon only)
        const deleteBtn = document.createElement("button");
        deleteBtn.classList.add("deck-action-btn", "delete-action-btn");
        deleteBtn.title = "Delete deck";
        deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;
        const delIdx = i;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const deckName = state.getDeckText(delIdx).split("\n")[0] || "Untitled";
            if (confirm(`Are you sure you want to delete "${deckName}"?`)) {
                state.data.splice(delIdx, 1);
                if (state.selectedDeck >= state.data.length) {
                    state.setSelectedDeck(Math.max(0, state.data.length - 1));
                }
                switchDeck(state.selectedDeck)();
            }
        };

        deckItem.appendChild(button);
        deckItem.appendChild(shareBtn);
        deckItem.appendChild(deleteBtn);
        itemsContainer.appendChild(deckItem);

        // Clone for mobile
        const mobileItem = deckItem.cloneNode(true);
        const idx = i;
        mobileItem.querySelector(".deck-name-btn").onclick = () => {
            switchDeck(idx)();
            closeMobileMenu();
        };
        mobileItem.querySelector(".share-action-btn").onclick = (e) => {
            e.stopPropagation();
            state.setSelectedDeck(idx);
            shareDeck();
            closeMobileMenu();
        };
        mobileItem.querySelector(".delete-action-btn").onclick = (e) => {
            e.stopPropagation();
            const deckName = state.getDeckText(idx).split("\n")[0] || "Untitled";
            if (confirm(`Are you sure you want to delete "${deckName}"?`)) {
                state.data.splice(idx, 1);
                if (state.selectedDeck >= state.data.length) {
                    state.setSelectedDeck(Math.max(0, state.data.length - 1));
                }
                switchDeck(state.selectedDeck)();
                closeMobileMenu();
            }
        };
        dom.mobileDecklist.appendChild(mobileItem);
    }
}

// Switch to a different deck
export function switchDeck(index) {
    return () => {
        state.setSelectedDeck(index);

        // Handle empty decks state
        if (state.data.length === 0) {
            if (!state.isShareMode) {
                dom.editor.value = "";
                dom.editor.disabled = true;
                dom.editor.placeholder = "Add a new deck to start editing";
                dom.editor.classList.add("editor-disabled");
                state.setLastEditorValue("");
                updateUrl(null);
            }
            setDeckList();
            updateData("");
            save();
            hideAutocomplete();
            return;
        }

        // Re-enable editor if it was disabled
        if (!state.isShareMode && dom.editor.disabled) {
            dom.editor.disabled = false;
            dom.editor.placeholder = "Start typing here to create a new deck. The first line is the title\n\nCard links will appear to the right as you type. Click a link to open the card's scryfall page or just hover over it to see the card\n\nYou can add section headers like #header and card quantities like '4x Rat'";
            dom.editor.classList.remove("editor-disabled");
        }

        const deckText = state.getDeckText(state.selectedDeck);
        const deckId = state.getDeckId(state.selectedDeck);

        if (!state.isShareMode) {
            dom.editor.value = deckText;
            state.setLastEditorValue(dom.editor.value);
            dom.editor.style.height = "";
            dom.editor.style.height = dom.editor.scrollHeight + "px";
            updateUrl(deckId);
        }
        setDeckList();
        updateData(deckText);
        save();
        hideAutocomplete();
    };
}

// Share the current deck
export async function shareDeck() {
    const shareUrl = await apiShareDeck();
    if (shareUrl) {
        // Show modal with share URL
        dom.shareUrlInput.value = shareUrl;
        dom.shareModal.classList.add("open");
        // Trap focus within share modal
        const modalContent = dom.shareModal.querySelector('.share-modal-content');
        if (modalContent) {
            trapFocus(dom.shareModal, modalContent);
        }
    }
}

// Copy share URL to clipboard
export function copyShareUrl() {
    dom.shareUrlInput.select();
    document.execCommand('copy');
    dom.copyShareBtn.textContent = "Copied!";
    setTimeout(() => {
        dom.copyShareBtn.textContent = "Copy";
    }, 2000);
}
