var data = []; // Array of {id, text} objects
var link_cache = {}
var selectedDeck = 0;
var isMobile = window.innerWidth <= 768;
var isRenderMode = false;
var currentCardData = null;

// Autocomplete state
var autocompleteResults = [];       // Current search results from Scryfall
var autocompleteSelectedIndex = -1; // Explicitly selected index (-1 = none, Enter adds newline)
var autocompleteTimer = null;       // Debounce timer for API calls
var autocompleteVisible = false;    // Dropdown visibility state
var lastCursorPosition = -1;        // Track cursor position for hiding on movement
var autocompleteAbortController = null; // AbortController for canceling pending requests
var lastEditorValue = '';           // Track editor value to detect actual text changes

// URL parsing
var isShareMode = window.location.pathname.startsWith('/share/');
var shareId = isShareMode ? window.location.pathname.split('/share/')[1] : null;

// Parse user and deckId from URL: /{user} or /{user}/{deckId}
var pathParts = window.location.pathname.split('/').filter(p => p);
var currentUser = !isShareMode ? pathParts[0] : null;
var initialDeckId = !isShareMode && pathParts[1] ? pathParts[1] : null;

// Check if we're on the landing page (root path with no user)
var isLandingPage = window.location.pathname === '/' && !isShareMode;

// DOM Elements
var editor = document.getElementById("editor");
var decklist = document.getElementById("decks");
var mobileDecklist = document.getElementById("mobileDecks");
var cardLinks = document.getElementById("hovers");
var dispArea = document.getElementById("display");
var emptyState = document.getElementById("emptyState");
var cardPreviewContainer = document.getElementById("cardPreviewContainer");
var cardImagesContainer = document.getElementById("cardImagesContainer");
var connectionLine = document.getElementById("connectionLine");
var sidebar = document.getElementById("sidebar");
var sidebarToggle = document.getElementById("sidebarToggle");
var sidebarExpand = document.getElementById("sidebarExpand");
var mobileMenuBtn = document.getElementById("mobileMenuBtn");
var mobileDropdown = document.getElementById("mobileDropdown");
var renderToggle = document.getElementById("renderToggle");
var shareModal = document.getElementById("shareModal");
var shareUrlInput = document.getElementById("shareUrl");
var copyShareBtn = document.getElementById("copyShareBtn");
var closeShareModal = document.getElementById("closeShareModal");
var landingPage = document.getElementById("landingPage");
var getStartedBtn = document.getElementById("getStartedBtn");
var logoLink = document.getElementById("logoLink");
var mobileLogoLink = document.getElementById("mobileLogoLink");
var desktopHeader = document.getElementById("desktopHeader");
var bookmarkWarning = document.getElementById("bookmarkWarning");

// Autocomplete elements
var autocompleteContainer = document.getElementById("autocompleteContainer");
var autocompleteList = document.getElementById("autocompleteList");

// Resize elements
var sidebarResizer = document.getElementById("sidebarResizer");
var editorResizer = document.getElementById("editorResizer");
var displayResizer = document.getElementById("displayResizer");
var editorContainer = document.getElementById("syncScroll");
var mainContent = document.getElementById("mainContent");

// Update mobile detection on resize
window.addEventListener("resize", () => {
    isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        // Reset mobile-specific states when switching to desktop
        document.body.classList.remove("render-mode");
        mobileDropdown.classList.remove("open");
        isRenderMode = false;
        updateRenderToggleIcon();
    }
});

// Helper to get current deck text
function getDeckText(index) {
    if (isShareMode) {
        return data[index]; // In share mode, data is still just text
    }
    return data[index]?.text || "";
}

// Helper to get current deck id
function getDeckId(index) {
    return data[index]?.id;
}

async function load(){
    if (isShareMode) {
        // Load shared deck (backend resolves reference and returns text only)
        const response = await fetch(`/api/share/${shareId}`);
        if (response.ok) {
            const deckText = await response.text();
            data = [deckText]; // Share mode still uses plain text
        } else {
            data = ["# Shared deck not found"];
        }
    } else if (currentUser) {
        // Load user decks (now returns array of {id, text} objects)
        await fetch(`/api/${currentUser}`)
        .then(e => e.json()).then(js => {
            data = js;
        });

        // Find initial deck by ID if specified in URL
        if (initialDeckId && data.length > 0) {
            const deckIndex = data.findIndex(d => d.id === initialDeckId);
            if (deckIndex !== -1) {
                selectedDeck = deckIndex;
            }
        }

        // Save user ID to localStorage
        localStorage.setItem("decklister_user_id", currentUser);
    }
    link_cache = JSON.parse(localStorage.getItem("link_cache")) || {};

    // Load saved panel sizes
    loadPanelSizes();
}

var saveTimer;
async function save(){
    // Don't save in share mode
    if (isShareMode) return;

    if(saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            fetch(`/api/${currentUser}`, {
                method: "put",
                body: JSON.stringify(data)
            })
        }, 500);
    localStorage.setItem("link_cache", JSON.stringify(link_cache));
}

// Update browser URL when switching decks
function updateUrl(deckId) {
    if (isShareMode || !currentUser) return;

    const newPath = deckId ? `/${currentUser}/${deckId}` : `/${currentUser}`;
    if (window.location.pathname !== newPath) {
        history.pushState({ deckId }, '', newPath);
    }
}

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
    if (isShareMode) return;

    const deckId = e.state?.deckId;
    if (deckId) {
        const deckIndex = data.findIndex(d => d.id === deckId);
        if (deckIndex !== -1) {
            selectedDeck = deckIndex;
            editor.value = getDeckText(selectedDeck);
            lastEditorValue = editor.value;
            editor.style.height = "";
            editor.style.height = editor.scrollHeight + "px";
            setDeckList();
            updateData(getDeckText(selectedDeck));
        }
    } else if (data.length > 0) {
        selectedDeck = 0;
        editor.value = getDeckText(0);
        lastEditorValue = editor.value;
        editor.style.height = "";
        editor.style.height = editor.scrollHeight + "px";
        setDeckList();
        updateData(getDeckText(0));
    }
});

async function shareDeck(){
    const deck = data[selectedDeck];
    if (!deck || !deck.id) {
        alert("No deck to share");
        return;
    }

    try {
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser, deckId: deck.id })
        });
        const result = await response.json();
        const shareUrl = `${window.location.origin}/share/${result.uuid}`;

        // Show modal with share URL
        shareUrlInput.value = shareUrl;
        shareModal.classList.add("open");
    } catch (err) {
        alert("Failed to create share link");
    }
}

function copyShareUrl(){
    shareUrlInput.select();
    document.execCommand('copy');
    copyShareBtn.textContent = "Copied!";
    setTimeout(() => {
        copyShareBtn.textContent = "Copy";
    }, 2000);
}

function setDeckList(){
    // In share mode, don't show deck list
    if (isShareMode) return;

    // Clear both deck lists
    decklist.innerHTML = "";
    mobileDecklist.innerHTML = "";

    // Create add deck button
    var addDeckButton = document.createElement("button")
    addDeckButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path d="M12 5v14M5 12h14"/></svg><span>Add Deck</span>`;
    addDeckButton.classList.add("DeckButton", "add-deck-btn");
    decklist.appendChild(addDeckButton);
    addDeckButton.onclick = () => {
        // Create new deck with UUID
        const newDeck = { id: crypto.randomUUID(), text: "" };
        data = [newDeck].concat(data);
        switchDeck(0)();
        closeMobileMenu();
    }

    // Clone for mobile
    var mobileAddButton = addDeckButton.cloneNode(true);
    mobileAddButton.onclick = () => {
        const newDeck = { id: crypto.randomUUID(), text: "" };
        data = [newDeck].concat(data);
        switchDeck(0)();
        closeMobileMenu();
    }
    mobileDecklist.appendChild(mobileAddButton);

    // Add each deck as a button with inline action icons
    for(var i = 0; i < data.length; i++){
        var deckname = getDeckText(i).split("\n")[0] || "Untitled";

        // Create deck item container
        const deckItem = document.createElement("div");
        deckItem.classList.add("deck-item");
        if (i === selectedDeck) {
            deckItem.classList.add("active");
        }

        // Deck name button
        const button = document.createElement("button");
        button.classList.add("DeckButton", "deck-name-btn");
        button.onclick = switchDeck(i);
        button.innerHTML = deckname;

        // Share button (icon only)
        const shareBtn = document.createElement("button");
        shareBtn.classList.add("deck-action-btn", "share-action-btn");
        shareBtn.title = "Share deck";
        shareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
        const shareIdx = i;
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            selectedDeck = shareIdx;
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
            const deckName = getDeckText(delIdx).split("\n")[0] || "Untitled";
            if(confirm(`Are you sure you want to delete "${deckName}"?`)){
                data.splice(delIdx, 1);
                if (selectedDeck >= data.length) {
                    selectedDeck = Math.max(0, data.length - 1);
                }
                switchDeck(selectedDeck)();
            }
        };

        deckItem.appendChild(button);
        deckItem.appendChild(shareBtn);
        deckItem.appendChild(deleteBtn);
        decklist.appendChild(deckItem);

        // Clone for mobile
        var mobileItem = deckItem.cloneNode(true);
        const idx = i;
        mobileItem.querySelector(".deck-name-btn").onclick = () => {
            switchDeck(idx)();
            closeMobileMenu();
        };
        mobileItem.querySelector(".share-action-btn").onclick = (e) => {
            e.stopPropagation();
            selectedDeck = idx;
            shareDeck();
            closeMobileMenu();
        };
        mobileItem.querySelector(".delete-action-btn").onclick = (e) => {
            e.stopPropagation();
            const deckName = getDeckText(idx).split("\n")[0] || "Untitled";
            if(confirm(`Are you sure you want to delete "${deckName}"?`)){
                data.splice(idx, 1);
                if (selectedDeck >= data.length) {
                    selectedDeck = Math.max(0, data.length - 1);
                }
                switchDeck(selectedDeck)();
                closeMobileMenu();
            }
        };
        mobileDecklist.appendChild(mobileItem);
    }
}

function display_card(cardData){
    return (e) => {
        currentCardData = cardData;

        // Hide empty state and show card preview container
        if (emptyState) emptyState.style.display = "none";
        if (cardPreviewContainer) {
            cardPreviewContainer.classList.add("active");
        }

        // Clear previous card images
        if (cardImagesContainer) {
            cardImagesContainer.innerHTML = "";
        }

        var cardfront = document.createElement("img")
        cardfront.setAttribute("src", cardData.imgfront);
        cardfront.classList.add("card-image");

        // Add click handler for mobile - tap image to open Scryfall
        if (isMobile && cardData.link) {
            cardfront.classList.add("card-image-clickable");
            cardfront.onclick = () => {
                window.open(cardData.link, "_blank");
            };
        }

        if(cardData.imgback){
            var cardback = document.createElement("img")
            cardback.setAttribute("src", cardData.imgback);
            cardfront.classList.add("twoCard");
            cardback.classList.add("twoCard", "card-image");

            if (isMobile && cardData.link) {
                cardback.classList.add("card-image-clickable");
                cardback.onclick = () => {
                    window.open(cardData.link, "_blank");
                };
            }

            cardImagesContainer.appendChild(cardback);
        } else {
            cardfront.classList.add("oneCard");
        }
        cardImagesContainer.appendChild(cardfront);
    }
}

var updateTimer;
function updateData(newData){
    if(newData !== undefined && newData !== null){
        // Update deck text
        if (isShareMode) {
            data[selectedDeck] = newData;
        } else {
            if (data[selectedDeck]) {
                data[selectedDeck].text = newData;
            }
        }

        if(updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            var cards = newData.split("\n");
            cardLinks.innerHTML = "";

            const title = document.createElement("p")
            title.innerHTML = cards[0];
            title.classList.add("deck-title");
            cardLinks.appendChild(title);

            var currentStack = null;

            for(var i = 1; i < cards.length; i++){
                const lineText = cards[i];
                if(lineText != ""){
                    if(lineText[0] == "#"){
                        // Close previous stack
                        if (currentStack) {
                            cardLinks.appendChild(currentStack);
                            currentStack = null;
                        }

                        const header = document.createElement("p")
                        header.classList.add("header");
                        header.innerHTML = lineText.substring(1).trim();
                        cardLinks.appendChild(header);

                        // Start new stack for this section
                        currentStack = document.createElement("div");
                        currentStack.classList.add("card-stack");
                    } else {
                        // Parse card quantity and name
                        var cardQuantity = "";
                        var cardName;
                        var tokens = lineText.split(" ");

                        // Check if first token is a number or ends with 'x'
                        var firstToken = tokens[0];
                        if (!isNaN(firstToken) || (firstToken.endsWith('x') && !isNaN(firstToken.slice(0, -1)))) {
                            cardQuantity = firstToken.replace('x', '');
                            tokens.splice(0, 1);
                            cardName = tokens.join(" ");
                        } else {
                            cardQuantity = "1";
                            cardName = lineText;
                        }

                        if (!currentStack) {
                            currentStack = document.createElement("div");
                            currentStack.classList.add("card-stack");
                        }

                        // Create stacked card item
                        const cardItem = document.createElement("div");
                        cardItem.classList.add("card-item");

                        const quantityBox = document.createElement("div");
                        quantityBox.classList.add("card-quantity");
                        quantityBox.textContent = cardQuantity;

                        const cardNameSpan = document.createElement("div");
                        cardNameSpan.classList.add("card-name");
                        cardNameSpan.textContent = cardName;

                        cardItem.appendChild(quantityBox);
                        cardItem.appendChild(cardNameSpan);

                        // Fetch card data
                        get_card(cardName).then(cardData => {
                            if(cardData.link){
                                // Desktop: hover to show, click to open
                                if (!isMobile) {
                                    cardItem.addEventListener("mouseenter", (e) => {
                                        display_card(cardData)();
                                        showConnectionLine(cardItem);
                                    });
                                    cardItem.addEventListener("mouseleave", (e) => {
                                        hideConnectionLine();
                                    });
                                    cardItem.onclick = () => {
                                        window.open(cardData.link, "_blank");
                                    };
                                }
                                // Mobile: tap to show card art (tap image to open Scryfall)
                                else {
                                    cardItem.onclick = (e) => {
                                        e.preventDefault();
                                        display_card(cardData)();
                                    };
                                }
                            } else {
                                cardNameSpan.classList.add("unfoundCard");
                            }
                        });

                        currentStack.appendChild(cardItem);
                    }
                } else {
                    // Empty line - close current stack if exists
                    if (currentStack) {
                        cardLinks.appendChild(currentStack);
                        currentStack = null;
                    }
                }
            }

            // Append any remaining stack
            if (currentStack) {
                cardLinks.appendChild(currentStack);
            }
        }, 500);
    }
}

// Show connection line from card to display
function showConnectionLine(cardElement) {
    if (isMobile || !connectionLine || !dispArea) return;

    const cardRect = cardElement.getBoundingClientRect();
    const displayRect = dispArea.getBoundingClientRect();

    const startX = cardRect.right;
    const startY = cardRect.top + (cardRect.height / 2);
    const endX = displayRect.left;

    connectionLine.style.left = startX + 'px';
    connectionLine.style.top = startY + 'px';
    connectionLine.style.width = (endX - startX) + 'px';
    connectionLine.classList.add('active');
}

// Hide connection line
function hideConnectionLine() {
    if (connectionLine) {
        connectionLine.classList.remove('active');

        // Hide card preview and show empty state
        if (cardPreviewContainer) {
            cardPreviewContainer.classList.remove("active");
        }
        if (emptyState) {
            emptyState.style.display = "flex";
        }
    }
}

async function get_card(cardName){
    if(link_cache[cardName]){
        return link_cache[cardName]
    }
    var resp = await (await fetch("https://api.scryfall.com/cards/named?exact=" + cardName)).json();
    var cardData = {
        link: resp["scryfall_uri"],
        imgfront: resp["card_faces"]?.[0]?.["image_uris"]?.["border_crop"] || resp["image_uris"]?.["border_crop"],
        imgback: resp["card_faces"]?.[1]?.["image_uris"]?.["border_crop"]
    };
    link_cache[cardName] = cardData;
    return cardData;
}

// ========================================
// Autocomplete Functions
// ========================================

// Get information about the current line where the cursor is
function getCurrentLineInfo() {
    const text = editor.value;
    const cursorPos = editor.selectionStart;

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
function parseCardNameFromLine(lineText) {
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
async function searchScryfall(query) {
    // Cancel any pending request
    if (autocompleteAbortController) {
        autocompleteAbortController.abort();
    }

    autocompleteAbortController = new AbortController();

    try {
        const response = await fetch(
            `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`,
            { signal: autocompleteAbortController.signal }
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
function calculateDropdownPosition() {
    const lineInfo = getCurrentLineInfo();

    // Create a temporary span to measure text width
    const measureSpan = document.createElement('span');
    measureSpan.style.font = getComputedStyle(editor).font;
    measureSpan.style.position = 'absolute';
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.whiteSpace = 'pre';
    measureSpan.textContent = lineInfo.lineText.substring(0, lineInfo.cursorInLine);
    document.body.appendChild(measureSpan);

    const textWidth = measureSpan.offsetWidth;
    document.body.removeChild(measureSpan);

    // Get editor position and styling
    const editorRect = editor.getBoundingClientRect();
    const editorStyles = getComputedStyle(editor);
    const paddingLeft = parseFloat(editorStyles.paddingLeft);
    const paddingTop = parseFloat(editorStyles.paddingTop);
    const lineHeight = parseFloat(editorStyles.lineHeight);

    // Count lines before cursor
    const textBeforeCursor = editor.value.substring(0, lineInfo.cursorPos);
    const lineCount = textBeforeCursor.split('\n').length;

    // Calculate position relative to editor wrapper
    const left = paddingLeft + textWidth;
    const top = paddingTop + (lineCount * lineHeight) - editor.scrollTop;

    return { left, top };
}

// Show autocomplete dropdown
function showAutocomplete(results) {
    if (results.length === 0) {
        hideAutocomplete();
        return;
    }

    autocompleteResults = results;
    autocompleteSelectedIndex = -1; // -1 means no explicit selection (Enter adds newline)

    // Clear and populate list
    autocompleteList.innerHTML = '';
    results.forEach((result, index) => {
        const li = document.createElement('li');
        li.classList.add('autocomplete-item');
        // Visually highlight first item, but don't set selectedIndex
        // This way Tab selects it, but Enter still adds newline
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

        autocompleteList.appendChild(li);
    });

    // Position the dropdown
    const position = calculateDropdownPosition();
    autocompleteContainer.style.left = position.left + 'px';
    autocompleteContainer.style.top = position.top + 'px';

    // Show dropdown
    autocompleteContainer.classList.add('visible');
    autocompleteVisible = true;
}

// Hide autocomplete dropdown and reset all state
function hideAutocomplete() {
    autocompleteContainer.classList.remove('visible');
    autocompleteVisible = false;
    autocompleteResults = [];
    autocompleteSelectedIndex = -1; // Reset to -1 (no explicit selection)
    autocompleteList.innerHTML = '';

    // Cancel any pending search
    if (autocompleteTimer) {
        clearTimeout(autocompleteTimer);
        autocompleteTimer = null;
    }

    // Cancel any pending request
    if (autocompleteAbortController) {
        autocompleteAbortController.abort();
        autocompleteAbortController = null;
    }
}

// Update visual selection in dropdown
function updateAutocompleteSelection(index) {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });
    autocompleteSelectedIndex = index;

    // Scroll selected item into view
    if (index >= 0 && items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

// Select an autocomplete suggestion and insert it
function selectAutocomplete(index) {
    if (index < 0 || index >= autocompleteResults.length) {
        // If no selection, use first result
        if (autocompleteResults.length > 0) {
            index = 0;
        } else {
            hideAutocomplete();
            return;
        }
    }

    const selectedCard = autocompleteResults[index];
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
    const beforeLine = editor.value.substring(0, lineInfo.lineStart);
    const afterLine = editor.value.substring(lineInfo.lineEnd);
    editor.value = beforeLine + newLineText + afterLine;
    lastEditorValue = editor.value;

    // Set cursor to end of inserted text
    const newCursorPos = lineInfo.lineStart + newLineText.length;
    editor.selectionStart = newCursorPos;
    editor.selectionEnd = newCursorPos;

    // Update last cursor position
    lastCursorPosition = newCursorPos;

    // Hide autocomplete
    hideAutocomplete();

    // Trigger data update and save
    updateData(editor.value);
    setDeckList();
    save();

    // Focus back on editor
    editor.focus();
}

// Trigger autocomplete search (debounced)
function triggerAutocomplete() {
    // Cancel any pending search
    if (autocompleteTimer) {
        clearTimeout(autocompleteTimer);
    }

    const lineInfo = getCurrentLineInfo();
    const cardName = parseCardNameFromLine(lineInfo.lineText);

    // Don't search if card name is too short or invalid
    if (!cardName || cardName.length < 3) {
        hideAutocomplete();
        return;
    }

    // Update last cursor position
    lastCursorPosition = lineInfo.cursorPos;

    // Debounce the API call (300ms)
    autocompleteTimer = setTimeout(async () => {
        const results = await searchScryfall(cardName);

        // Only show if we're still on the same position and have results
        if (editor.selectionStart === lastCursorPosition && results.length > 0) {
            showAutocomplete(results);
        } else if (results.length === 0) {
            hideAutocomplete();
        }
    }, 300);
}

// Handle keyboard events for autocomplete
function handleAutocompleteKeydown(e) {
    if (!autocompleteVisible) {
        return false;
    }

    switch (e.key) {
        case 'Tab':
            e.preventDefault();
            // Select first item if none selected, otherwise select current
            const tabIndex = autocompleteSelectedIndex >= 0 ? autocompleteSelectedIndex : 0;
            selectAutocomplete(tabIndex);
            return true;

        case 'ArrowDown':
            e.preventDefault();
            const nextIndex = autocompleteSelectedIndex < autocompleteResults.length - 1
                ? autocompleteSelectedIndex + 1
                : 0;
            updateAutocompleteSelection(nextIndex);
            return true;

        case 'ArrowUp':
            e.preventDefault();
            const prevIndex = autocompleteSelectedIndex > 0
                ? autocompleteSelectedIndex - 1
                : autocompleteResults.length - 1;
            updateAutocompleteSelection(prevIndex);
            return true;

        case 'Enter':
            // Only intercept Enter if an item is explicitly selected
            if (autocompleteSelectedIndex >= 0) {
                e.preventDefault();
                selectAutocomplete(autocompleteSelectedIndex);
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
function checkCursorMovement() {
    if (!autocompleteVisible) return;

    const currentPos = editor.selectionStart;

    // Check if cursor moved to a different line
    const currentLineInfo = getCurrentLineInfo();
    const lastLineInfo = (() => {
        const text = editor.value;
        let lineStart = text.lastIndexOf('\n', lastCursorPosition - 1) + 1;
        return lineStart;
    })();

    const currentLineStart = editor.value.lastIndexOf('\n', currentPos - 1) + 1;

    // Hide if cursor moved to different line
    if (currentLineStart !== lastLineInfo) {
        hideAutocomplete();
    }
}

editor.oninput = (e) => {
    editor.style.height = "";
    editor.style.height = editor.scrollHeight + "px";
    updateData(editor.value);
    setDeckList();
    save();

    // Only trigger autocomplete if text content actually changed (not just cursor movement)
    if (!isShareMode && editor.value !== lastEditorValue) {
        lastEditorValue = editor.value;
        triggerAutocomplete();
    }
}

// Keyboard event handler for autocomplete navigation
editor.addEventListener('keydown', (e) => {
    // Handle autocomplete keyboard navigation
    if (handleAutocompleteKeydown(e)) {
        return;
    }

    // Hide autocomplete on Enter (newline)
    if (e.key === 'Enter' && autocompleteVisible) {
        hideAutocomplete();
    }
});

// Hide autocomplete when cursor moves via click
editor.addEventListener('click', () => {
    checkCursorMovement();
});

// Hide autocomplete when selection changes (arrow keys without autocomplete, etc.)
editor.addEventListener('keyup', (e) => {
    // Only check for navigation keys that might move cursor
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        checkCursorMovement();
    }
});

// Hide autocomplete on blur (with small delay to allow click selection)
editor.addEventListener('blur', () => {
    setTimeout(() => {
        if (!autocompleteContainer.contains(document.activeElement)) {
            hideAutocomplete();
        }
    }, 150);
});

// Hide autocomplete when scrolling the editor
editor.addEventListener('scroll', () => {
    if (autocompleteVisible) {
        // Reposition the dropdown when scrolling
        const position = calculateDropdownPosition();
        autocompleteContainer.style.left = position.left + 'px';
        autocompleteContainer.style.top = position.top + 'px';
    }
});

function switchDeck(index){
    return () => {
        selectedDeck = index;
        const deckText = getDeckText(selectedDeck);
        const deckId = getDeckId(selectedDeck);

        if (!isShareMode) {
            editor.value = deckText;
            lastEditorValue = editor.value;
            editor.style.height = "";
            editor.style.height = editor.scrollHeight + "px";
            updateUrl(deckId);
        }
        setDeckList();
        updateData(deckText);
        save();
        hideAutocomplete();
    }
}

// Sidebar toggle (desktop)
sidebarToggle.onclick = () => {
    sidebar.classList.add("collapsed");
    sidebarExpand.classList.add("visible");
};

// Sidebar expand button
sidebarExpand.onclick = () => {
    sidebar.classList.remove("collapsed");
    sidebarExpand.classList.remove("visible");
};

// Mobile menu toggle
function closeMobileMenu() {
    mobileDropdown.classList.remove("open");
}

mobileMenuBtn.onclick = () => {
    mobileDropdown.classList.toggle("open");
};

// Close mobile dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (isMobile &&
        !mobileDropdown.contains(e.target) &&
        !mobileMenuBtn.contains(e.target) &&
        mobileDropdown.classList.contains("open")) {
        closeMobileMenu();
    }
});

// Render mode toggle (mobile)
function updateRenderToggleIcon() {
    const icon = renderToggle.querySelector(".render-icon");
    if (isRenderMode) {
        // Show edit icon (pencil)
        icon.innerHTML = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>';
        renderToggle.classList.add("active");
    } else {
        // Show grid icon (render)
        icon.innerHTML = '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>';
        renderToggle.classList.remove("active");
    }
}

renderToggle.onclick = () => {
    isRenderMode = !isRenderMode;
    document.body.classList.toggle("render-mode", isRenderMode);
    updateRenderToggleIcon();
};

// ========================================
// Panel Resizing
// ========================================
var isResizing = false;
var currentResizer = null;
var startX = 0;
var startY = 0;
var startWidth = 0;
var startDisplayWidth = 0;

function loadPanelSizes() {
    const savedSizes = JSON.parse(localStorage.getItem("decklister_panel_sizes") || "{}");

    if (savedSizes.sidebarWidth && sidebar) {
        sidebar.style.width = savedSizes.sidebarWidth + "px";
    }
    if (savedSizes.editorFlex && editor) {
        editor.style.flex = "0 0 " + savedSizes.editorFlex + "%";
    }
    if (savedSizes.displayWidth && dispArea) {
        dispArea.style.width = savedSizes.displayWidth + "px";
    }
}

function savePanelSizes() {
    const sizes = {};
    if (sidebar && sidebar.offsetWidth > 0) {
        sizes.sidebarWidth = sidebar.offsetWidth;
    }
    if (editor) {
        // Extract percentage from flex basis
        const flexValue = editor.style.flex;
        if (flexValue) {
            const match = flexValue.match(/[\d.]+%/);
            if (match) {
                sizes.editorFlex = parseFloat(match[0]);
            }
        }
    }
    if (dispArea && dispArea.offsetWidth > 0) {
        sizes.displayWidth = dispArea.offsetWidth;
    }
    localStorage.setItem("decklister_panel_sizes", JSON.stringify(sizes));
}

function initResizers() {
    // Sidebar resizer (desktop only)
    if (sidebarResizer) {
        sidebarResizer.addEventListener("mousedown", (e) => {
            if (isMobile) return;
            isResizing = true;
            currentResizer = "sidebar";
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Editor resizer (between editor and card-links)
    if (editorResizer) {
        editorResizer.addEventListener("mousedown", (e) => {
            if (isMobile) return;
            isResizing = true;
            currentResizer = "editor";
            startX = e.clientX;
            startWidth = editor.offsetWidth;
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Display resizer (between editor-container and card-display)
    if (displayResizer) {
        displayResizer.addEventListener("mousedown", (e) => {
            if (isMobile) return;
            isResizing = true;
            currentResizer = "display";
            startX = e.clientX;
            startWidth = editorContainer.offsetWidth;
            startDisplayWidth = dispArea.offsetWidth;
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Touch support for resizers
    [sidebarResizer, editorResizer, displayResizer].forEach(resizer => {
        if (!resizer) return;
        resizer.addEventListener("touchstart", (e) => {
            if (isMobile) return;
            const resizerType = resizer.id.replace("Resizer", "");

            isResizing = true;
            currentResizer = resizerType;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;

            if (currentResizer === "sidebar") {
                startWidth = sidebar.offsetWidth;
            } else if (currentResizer === "editor") {
                startWidth = editor.offsetWidth;
            } else if (currentResizer === "display") {
                startWidth = editorContainer.offsetWidth;
                startDisplayWidth = dispArea.offsetWidth;
            }

            document.body.classList.add("resizing");
            e.preventDefault();
        }, { passive: false });
    });

    // Mouse move handler
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("touchmove", (e) => {
        if (isResizing) {
            handleResize({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        }
    }, { passive: false });

    // Mouse up handler
    document.addEventListener("mouseup", stopResize);
    document.addEventListener("touchend", stopResize);
}

function handleResize(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;

    if (currentResizer === "sidebar") {
        const newWidth = Math.max(150, Math.min(400, startWidth + deltaX));
        sidebar.style.width = newWidth + "px";
    } else if (currentResizer === "editor") {
        const containerWidth = editorContainer.offsetWidth;
        const newEditorWidth = startWidth + deltaX;
        const percentage = Math.max(20, Math.min(80, (newEditorWidth / containerWidth) * 100));
        editor.style.flex = "0 0 " + percentage + "%";
    } else if (currentResizer === "display") {
        // Resize both editor container and display area
        const newDisplayWidth = Math.max(200, Math.min(600, startDisplayWidth - deltaX));
        dispArea.style.width = newDisplayWidth + "px";
    }
}

function stopResize() {
    if (isResizing) {
        isResizing = false;
        currentResizer = null;
        document.body.classList.remove("resizing");
        savePanelSizes();
    }
}

// ========================================
// Landing Page & Navigation
// ========================================
function handleLogoClick(e) {
    // Set flag to indicate intentional navigation to homepage
    sessionStorage.setItem("decklister_intentional_home", "true");
}

function setupLandingPage() {
    if (isLandingPage) {
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

        if (getStartedBtn) {
            getStartedBtn.onclick = () => {
                const newUserId = crypto.randomUUID();
                localStorage.setItem("decklister_user_id", newUserId);
                window.location.href = "/" + newUserId;
            };
        }

        return true;
    }

    return false;
}

// Setup logo click handlers
if (logoLink) {
    logoLink.onclick = handleLogoClick;
}
if (mobileLogoLink) {
    mobileLogoLink.onclick = handleLogoClick;
}

async function start(){
    // Handle landing page
    if (setupLandingPage()) {
        return;
    }

    // Set up share mode UI
    if (isShareMode) {
        document.body.classList.add("share-mode");
    }

    // Set up share modal event listeners
    if (closeShareModal) {
        closeShareModal.onclick = () => {
            shareModal.classList.remove("open");
        };
    }
    if (copyShareBtn) {
        copyShareBtn.onclick = copyShareUrl;
    }
    // Close modal when clicking outside
    if (shareModal) {
        shareModal.onclick = (e) => {
            if (e.target === shareModal) {
                shareModal.classList.remove("open");
            }
        };
    }

    // Initialize resizers
    initResizers();

    await load();

    // Set initial URL state for history
    if (!isShareMode && data.length > 0) {
        const deckId = getDeckId(selectedDeck);
        history.replaceState({ deckId }, '', deckId ? `/${currentUser}/${deckId}` : `/${currentUser}`);
    }

    switchDeck(selectedDeck)();
}

start();
