var data = []; // Array of {id, text} objects
var link_cache = {}
var selectedDeck = 0;
var isMobile = window.innerWidth <= 768;
var isRenderMode = false;
var currentCardData = null;

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
            editor.style.height = "";
            editor.style.height = editor.scrollHeight + "px";
            setDeckList();
            updateData(getDeckText(selectedDeck));
        }
    } else if (data.length > 0) {
        selectedDeck = 0;
        editor.value = getDeckText(0);
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
        dispArea.innerHTML = "";

        var cardfront = document.createElement("img")
        cardfront.setAttribute("src", cardData.imgfront);

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
            cardback.classList.add("twoCard");

            if (isMobile && cardData.link) {
                cardback.classList.add("card-image-clickable");
                cardback.onclick = () => {
                    window.open(cardData.link, "_blank");
                };
            }

            dispArea.appendChild(cardback);
        } else {
            cardfront.classList.add("oneCard");
        }
        dispArea.appendChild(cardfront);
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

            for(var i = 1; i < cards.length; i++){
                const lineText = cards[i];
                if(lineText != ""){
                    if(lineText[0] == "#"){
                        const header = document.createElement("p")
                        header.classList.add("header");
                        header.innerHTML = lineText;
                        cardLinks.appendChild(header);
                    } else {
                        const cardText = document.createElement("p")
                        const quantity = document.createElement("p")
                        const cardLink = document.createElement("a")
                        cardText.appendChild(quantity);
                        cardText.appendChild(cardLink);
                        var cardName;
                        var tokens = lineText.split(" ");
                        if(!isNaN(tokens[0])){
                            quantity.innerHTML = tokens[0] + " ";
                            tokens.splice(0, 1);
                            cardName = tokens.join(" ")
                        } else {
                            cardName = lineText;
                        }
                        const cardID = cardName;
                        cardLink.classList.add("CardLink");
                        cardLink.innerHTML = cardID;

                        // Desktop: open in new tab on click
                        if (!isMobile) {
                            cardLink.setAttribute("target", "_blank");
                        }

                        get_card(cardID).then(cardData => {
                            if(cardData.link){
                                // Desktop: hover to show, click to open
                                if (!isMobile) {
                                    cardLink.addEventListener("mouseover", display_card(cardData));
                                    cardLink.setAttribute("href", cardData.link);
                                }
                                // Mobile: tap to show card art (tap image to open Scryfall)
                                else {
                                    cardLink.onclick = (e) => {
                                        e.preventDefault();
                                        // Remove selected class from all card links
                                        document.querySelectorAll(".CardLink.selected").forEach(el => {
                                            el.classList.remove("selected");
                                        });
                                        cardLink.classList.add("selected");
                                        display_card(cardData)();
                                    };
                                }
                                display_card(cardData)();
                            } else {
                                cardLink.classList.add("unfoundCard");
                            }
                        })
                        cardLinks.appendChild(cardText);
                    }
                } else {
                    const spacer = document.createElement("a")
                    spacer.innerHTML = "</br>";
                    cardLinks.appendChild(spacer);
                }
            }
        }, 500);
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

editor.oninput = () => {
    editor.style.height = "";
    editor.style.height = editor.scrollHeight + "px";
    updateData(editor.value);
    setDeckList();
    save();
}

function switchDeck(index){
    return () => {
        selectedDeck = index;
        const deckText = getDeckText(selectedDeck);
        const deckId = getDeckId(selectedDeck);

        if (!isShareMode) {
            editor.value = deckText;
            editor.style.height = "";
            editor.style.height = editor.scrollHeight + "px";
            updateUrl(deckId);
        }
        setDeckList();
        updateData(deckText);
        save();
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
var startHeight = 0;

function loadPanelSizes() {
    const savedSizes = JSON.parse(localStorage.getItem("decklister_panel_sizes") || "{}");

    if (savedSizes.sidebarWidth && sidebar) {
        sidebar.style.width = savedSizes.sidebarWidth + "px";
        sidebar.style.minWidth = savedSizes.sidebarWidth + "px";
    }
    if (savedSizes.editorWidth && editor) {
        editor.style.minWidth = savedSizes.editorWidth + "%";
        editor.style.flex = "0 0 " + savedSizes.editorWidth + "%";
    }
    if (savedSizes.displayWidth && dispArea) {
        dispArea.style.width = savedSizes.displayWidth + "%";
    }
}

function savePanelSizes() {
    const sizes = {};
    if (sidebar) {
        sizes.sidebarWidth = parseInt(sidebar.style.width) || 220;
    }
    if (editor) {
        const editorWidth = parseFloat(editor.style.minWidth) || 45;
        sizes.editorWidth = editorWidth;
    }
    if (dispArea) {
        const displayWidth = parseFloat(dispArea.style.width) || 50;
        sizes.displayWidth = displayWidth;
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
            document.body.classList.add("resizing");
            e.preventDefault();
        });
    }

    // Touch support for resizers
    [sidebarResizer, editorResizer, displayResizer].forEach(resizer => {
        if (!resizer) return;
        resizer.addEventListener("touchstart", (e) => {
            const resizerType = resizer.id.replace("Resizer", "");
            if (resizerType === "sidebar" && isMobile) return;
            if (resizerType === "display" && isMobile) return;

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
        sidebar.style.minWidth = newWidth + "px";
    } else if (currentResizer === "editor") {
        const containerWidth = editorContainer.offsetWidth;
        const newEditorWidth = startWidth + deltaX;
        const percentage = Math.max(20, Math.min(80, (newEditorWidth / containerWidth) * 100));
        editor.style.minWidth = percentage + "%";
        editor.style.flex = "0 0 " + percentage + "%";
    } else if (currentResizer === "display") {
        const totalWidth = mainContent.offsetWidth;
        const newContainerWidth = startWidth + deltaX;
        const percentage = Math.max(30, Math.min(70, (newContainerWidth / totalWidth) * 100));
        editorContainer.style.maxWidth = percentage + "%";
        dispArea.style.width = (100 - percentage) + "%";
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
