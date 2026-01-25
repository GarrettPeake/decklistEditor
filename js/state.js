// ========================================
// Application State
// ========================================

// Core data
export let data = []; // Array of {id, text} objects
export let link_cache = {};
export let selectedDeck = 0;
export let currentCardData = null;

// Auth state
export let authToken = localStorage.getItem('decklister_auth_token') || null;
export let currentUsername = localStorage.getItem('decklister_username') || null;
export let isAuthenticated = !!authToken;

// UI state
export let isMobile = window.innerWidth <= 768;
export let isRenderMode = false;

// Autocomplete state
export let autocompleteResults = [];       // Current search results from Scryfall
export let autocompleteSelectedIndex = -1; // Explicitly selected index (-1 = none)
export let autocompleteTimer = null;       // Debounce timer for API calls
export let autocompleteVisible = false;    // Dropdown visibility state
export let lastCursorPosition = -1;        // Track cursor position
export let autocompleteAbortController = null; // AbortController for canceling requests
export let lastEditorValue = '';           // Track editor value for change detection

// URL parsing
export const isShareMode = window.location.pathname.startsWith('/share/');
export const shareId = isShareMode ? window.location.pathname.split('/share/')[1] : null;

// Parse user and deckId from URL: /{user} or /{user}/{deckId}
const pathParts = window.location.pathname.split('/').filter(p => p);
export const currentUser = !isShareMode ? pathParts[0] : null;
export const initialDeckId = !isShareMode && pathParts[1] ? pathParts[1] : null;

// Check if we're on the landing page (root path with no user)
export const isLandingPage = window.location.pathname === '/' && !isShareMode;

// ========================================
// State Setters (for mutable state)
// ========================================

export function setData(newData) {
    data = newData;
}

export function setLinkCache(newCache) {
    link_cache = newCache;
}

export function setSelectedDeck(index) {
    selectedDeck = index;
}

export function setCurrentCardData(cardData) {
    currentCardData = cardData;
}

export function setIsMobile(value) {
    isMobile = value;
}

export function setIsRenderMode(value) {
    isRenderMode = value;
}

export function setAutocompleteResults(results) {
    autocompleteResults = results;
}

export function setAutocompleteSelectedIndex(index) {
    autocompleteSelectedIndex = index;
}

export function setAutocompleteTimer(timer) {
    autocompleteTimer = timer;
}

export function setAutocompleteVisible(visible) {
    autocompleteVisible = visible;
}

export function setLastCursorPosition(position) {
    lastCursorPosition = position;
}

export function setAutocompleteAbortController(controller) {
    autocompleteAbortController = controller;
}

export function setLastEditorValue(value) {
    lastEditorValue = value;
}

export function setAuthToken(token) {
    authToken = token;
    isAuthenticated = !!token;
    if (token) {
        localStorage.setItem('decklister_auth_token', token);
    } else {
        localStorage.removeItem('decklister_auth_token');
    }
}

export function setCurrentUsername(username) {
    currentUsername = username;
    if (username) {
        localStorage.setItem('decklister_username', username);
    } else {
        localStorage.removeItem('decklister_username');
    }
}

export function clearAuth() {
    authToken = null;
    currentUsername = null;
    isAuthenticated = false;
    localStorage.removeItem('decklister_auth_token');
    localStorage.removeItem('decklister_username');
}

// ========================================
// Helper Functions
// ========================================

export function getDeckText(index) {
    if (isShareMode) {
        return data[index]; // In share mode, data is just text
    }
    return data[index]?.text || "";
}

export function getDeckId(index) {
    return data[index]?.id;
}
