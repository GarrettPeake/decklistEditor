// ========================================
// Autocomplete Functions
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { save } from './api.js';
import { setDeckList } from './deckList.js';
import { updateData } from './cardDisplay.js';

// Get information about the current line where the cursor is
export function getCurrentLineInfo() {
    const text = dom.editor.value;
    const cursorPos = dom.editor.selectionStart;

    // Find the start of the current line
    let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;

    // Find the end of the current line
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = text.length;

    const lineText = text.substring(lineStart, lineEnd);
    const cursorInLine = cursorPos - lineStart;

    return {
        lineText,
        lineStart,
        lineEnd,
        cursorInLine,
        cursorPos
    };
}

// Parse card name from a line, stripping quantity prefix
export function parseCardNameFromLine(lineText) {
    // Skip section headers
    if (lineText.trim().startsWith('#')) {
        return null;
    }

    // Skip empty lines
    if (lineText.trim() === '') {
        return null;
    }

    const tokens = lineText.trim().split(' ');
    const firstToken = tokens[0];

    // Check if first token is a quantity (number or ends with 'x')
    if (!isNaN(firstToken) || (firstToken.endsWith('x') && !isNaN(firstToken.slice(0, -1)))) {
        tokens.splice(0, 1);
        return tokens.join(' ');
    }

    return lineText.trim();
}

// Search Scryfall API with debouncing
export async function searchScryfall(query) {
    // Cancel any pending request
    if (state.autocompleteAbortController) {
        state.autocompleteAbortController.abort();
    }

    const controller = new AbortController();
    state.setAutocompleteAbortController(controller);

    try {
        const response = await fetch(
            `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`,
            { signal: controller.signal }
        );

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        // Return first 10 results with name and mana_cost
        return (data.data || []).slice(0, 10).map(card => ({
            name: card.name,
            mana_cost: card.mana_cost || ''
        }));
    } catch (error) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
            return [];
        }
        console.error('Scryfall search error:', error);
        return [];
    }
}

// Calculate dropdown position based on cursor
export function calculateDropdownPosition() {
    const lineInfo = getCurrentLineInfo();

    // Create a temporary span to measure text width
    const measureSpan = document.createElement('span');
    measureSpan.style.font = getComputedStyle(dom.editor).font;
    measureSpan.style.position = 'absolute';
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.whiteSpace = 'pre';
    measureSpan.textContent = lineInfo.lineText.substring(0, lineInfo.cursorInLine);
    document.body.appendChild(measureSpan);

    const textWidth = measureSpan.offsetWidth;
    document.body.removeChild(measureSpan);

    // Get editor position and styling
    const editorStyles = getComputedStyle(dom.editor);
    const paddingLeft = parseFloat(editorStyles.paddingLeft);
    const paddingTop = parseFloat(editorStyles.paddingTop);
    const lineHeight = parseFloat(editorStyles.lineHeight);

    // Count lines before cursor
    const textBeforeCursor = dom.editor.value.substring(0, lineInfo.cursorPos);
    const lineCount = textBeforeCursor.split('\n').length;

    // Calculate position relative to editor wrapper
    const left = paddingLeft + textWidth;
    const top = paddingTop + (lineCount * lineHeight) - dom.editor.scrollTop;

    return { left, top };
}

// Show autocomplete dropdown
export function showAutocomplete(results) {
    if (results.length === 0) {
        hideAutocomplete();
        return;
    }

    state.setAutocompleteResults(results);
    state.setAutocompleteSelectedIndex(-1); // -1 means no explicit selection

    // Clear and populate list
    dom.autocompleteList.innerHTML = '';
    results.forEach((result, index) => {
        const li = document.createElement('li');
        li.classList.add('autocomplete-item');
        // Visually highlight first item, but don't set selectedIndex
        if (index === 0) {
            li.classList.add('selected');
        }
        li.dataset.index = index;

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('autocomplete-item-name');
        nameSpan.textContent = result.name;

        const manaSpan = document.createElement('span');
        manaSpan.classList.add('autocomplete-item-mana');
        manaSpan.textContent = result.mana_cost;

        li.appendChild(nameSpan);
        li.appendChild(manaSpan);

        // Mouse handlers
        li.addEventListener('mouseenter', () => {
            updateAutocompleteSelection(index);
        });
        li.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur
            selectAutocomplete(index);
        });

        dom.autocompleteList.appendChild(li);
    });

    // Position the dropdown
    const position = calculateDropdownPosition();
    dom.autocompleteContainer.style.left = position.left + 'px';
    dom.autocompleteContainer.style.top = position.top + 'px';

    // Show dropdown
    dom.autocompleteContainer.classList.add('visible');
    state.setAutocompleteVisible(true);
}

// Hide autocomplete dropdown and reset all state
export function hideAutocomplete() {
    dom.autocompleteContainer.classList.remove('visible');
    state.setAutocompleteVisible(false);
    state.setAutocompleteResults([]);
    state.setAutocompleteSelectedIndex(-1);
    dom.autocompleteList.innerHTML = '';

    // Cancel any pending search
    if (state.autocompleteTimer) {
        clearTimeout(state.autocompleteTimer);
        state.setAutocompleteTimer(null);
    }

    // Cancel any pending request
    if (state.autocompleteAbortController) {
        state.autocompleteAbortController.abort();
        state.setAutocompleteAbortController(null);
    }
}

// Update visual selection in dropdown
export function updateAutocompleteSelection(index) {
    const items = dom.autocompleteList.querySelectorAll('.autocomplete-item');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });
    state.setAutocompleteSelectedIndex(index);

    // Scroll selected item into view
    if (index >= 0 && items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

// Select an autocomplete suggestion and insert it
export function selectAutocomplete(index) {
    if (index < 0 || index >= state.autocompleteResults.length) {
        // If no selection, use first result
        if (state.autocompleteResults.length > 0) {
            index = 0;
        } else {
            hideAutocomplete();
            return;
        }
    }

    const selectedCard = state.autocompleteResults[index];
    const lineInfo = getCurrentLineInfo();

    // Parse the current line to get quantity prefix
    const lineText = lineInfo.lineText;
    const tokens = lineText.trim().split(' ');
    const firstToken = tokens[0];

    let newLineText;
    if (!isNaN(firstToken) || (firstToken.endsWith('x') && !isNaN(firstToken.slice(0, -1)))) {
        // Preserve quantity prefix
        newLineText = firstToken + ' ' + selectedCard.name;
    } else {
        // No quantity prefix
        newLineText = selectedCard.name;
    }

    // Replace the current line with the new text
    const beforeLine = dom.editor.value.substring(0, lineInfo.lineStart);
    const afterLine = dom.editor.value.substring(lineInfo.lineEnd);
    dom.editor.value = beforeLine + newLineText + afterLine;
    state.setLastEditorValue(dom.editor.value);

    // Set cursor to end of inserted text
    const newCursorPos = lineInfo.lineStart + newLineText.length;
    dom.editor.selectionStart = newCursorPos;
    dom.editor.selectionEnd = newCursorPos;

    // Update last cursor position
    state.setLastCursorPosition(newCursorPos);

    // Hide autocomplete
    hideAutocomplete();

    // Trigger data update and save
    updateData(dom.editor.value);
    setDeckList();
    save();

    // Focus back on editor
    dom.editor.focus();
}

// Trigger autocomplete search (debounced)
export function triggerAutocomplete() {
    // Cancel any pending search
    if (state.autocompleteTimer) {
        clearTimeout(state.autocompleteTimer);
    }

    const lineInfo = getCurrentLineInfo();
    const cardName = parseCardNameFromLine(lineInfo.lineText);

    // Don't search if card name is too short or invalid
    if (!cardName || cardName.length < 3) {
        hideAutocomplete();
        return;
    }

    // Update last cursor position
    state.setLastCursorPosition(lineInfo.cursorPos);

    // Debounce the API call (300ms)
    const timer = setTimeout(async () => {
        const results = await searchScryfall(cardName);

        // Only show if we're still on the same position and have results
        if (dom.editor.selectionStart === state.lastCursorPosition && results.length > 0) {
            showAutocomplete(results);
        } else if (results.length === 0) {
            hideAutocomplete();
        }
    }, 300);

    state.setAutocompleteTimer(timer);
}

// Handle keyboard events for autocomplete
export function handleAutocompleteKeydown(e) {
    if (!state.autocompleteVisible) {
        return false;
    }

    switch (e.key) {
        case 'Tab':
            e.preventDefault();
            const tabIndex = state.autocompleteSelectedIndex >= 0 ? state.autocompleteSelectedIndex : 0;
            selectAutocomplete(tabIndex);
            return true;

        case 'ArrowDown':
            e.preventDefault();
            const nextIndex = state.autocompleteSelectedIndex < state.autocompleteResults.length - 1
                ? state.autocompleteSelectedIndex + 1
                : 0;
            updateAutocompleteSelection(nextIndex);
            return true;

        case 'ArrowUp':
            e.preventDefault();
            const prevIndex = state.autocompleteSelectedIndex > 0
                ? state.autocompleteSelectedIndex - 1
                : state.autocompleteResults.length - 1;
            updateAutocompleteSelection(prevIndex);
            return true;

        case 'Enter':
            // Only intercept Enter if an item is explicitly selected
            if (state.autocompleteSelectedIndex >= 0) {
                e.preventDefault();
                selectAutocomplete(state.autocompleteSelectedIndex);
                return true;
            }
            // Otherwise, hide autocomplete and let Enter add newline
            hideAutocomplete();
            return false;

        case 'Escape':
            e.preventDefault();
            hideAutocomplete();
            return true;
    }

    return false;
}

// Check if cursor has moved and hide autocomplete if it has
export function checkCursorMovement() {
    if (!state.autocompleteVisible) return;

    const currentPos = dom.editor.selectionStart;

    // Check if cursor moved to a different line
    const lastLineInfo = (() => {
        const text = dom.editor.value;
        let lineStart = text.lastIndexOf('\n', state.lastCursorPosition - 1) + 1;
        return lineStart;
    })();

    const currentLineStart = dom.editor.value.lastIndexOf('\n', currentPos - 1) + 1;

    // Hide if cursor moved to different line
    if (currentLineStart !== lastLineInfo) {
        hideAutocomplete();
    }
}

// Initialize autocomplete event listeners
export function initAutocomplete() {
    // Keyboard event handler for autocomplete navigation
    dom.editor.addEventListener('keydown', (e) => {
        // Handle autocomplete keyboard navigation
        if (handleAutocompleteKeydown(e)) {
            return;
        }

        // Hide autocomplete on Enter (newline)
        if (e.key === 'Enter' && state.autocompleteVisible) {
            hideAutocomplete();
        }
    });

    // Hide autocomplete when cursor moves via click
    dom.editor.addEventListener('click', () => {
        checkCursorMovement();
    });

    // Hide autocomplete when selection changes
    dom.editor.addEventListener('keyup', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            checkCursorMovement();
        }
    });

    // Hide autocomplete on blur
    dom.editor.addEventListener('blur', () => {
        setTimeout(() => {
            if (!dom.autocompleteContainer.contains(document.activeElement)) {
                hideAutocomplete();
            }
        }, 150);
    });

    // Reposition dropdown when scrolling
    dom.editor.addEventListener('scroll', () => {
        if (state.autocompleteVisible) {
            const position = calculateDropdownPosition();
            dom.autocompleteContainer.style.left = position.left + 'px';
            dom.autocompleteContainer.style.top = position.top + 'px';
        }
    });
}
