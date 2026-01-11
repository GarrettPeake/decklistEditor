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

// DOM Elements
var editor = document.getElementById("editor");
var decklist = document.getElementById("decks");
var mobileDecklist = document.getElementById("mobileDecks");
var cardLinks = document.getElementById("hovers");
var dispArea = document.getElementById("display");
var sidebar = document.getElementById("sidebar");
var sidebarToggle = document.getElementById("sidebarToggle");
var mobileMenuBtn = document.getElementById("mobileMenuBtn");
var mobileDropdown = document.getElementById("mobileDropdown");
var renderToggle = document.getElementById("renderToggle");
var shareModal = document.getElementById("shareModal");
var shareUrlInput = document.getElementById("shareUrl");
var copyShareBtn = document.getElementById("copyShareBtn");
var closeShareModal = document.getElementById("closeShareModal");

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
    } else {
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
    }
    link_cache = JSON.parse(localStorage.getItem("link_cache")) || {};
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
    addDeckButton.innerHTML = "+ Add Deck"
    addDeckButton.classList.add("DeckButton");
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

    // Add each deckname as a button
    for(var i = 0; i < data.length; i++){
        var deckname = getDeckText(i).split("\n")[0] || "Untitled";

        const button = document.createElement("button")
        button.classList.add("DeckButton");
        if (i === selectedDeck) {
            button.classList.add("active");
        }
        button.onclick = switchDeck(i);
        button.innerHTML = deckname;
        decklist.appendChild(button);

        // Clone for mobile
        var mobileButton = button.cloneNode(true);
        const idx = i;
        mobileButton.onclick = () => {
            switchDeck(idx)();
            closeMobileMenu();
        };
        mobileDecklist.appendChild(mobileButton);
    }

    // Add share button
    var shareDeckButton = document.createElement("button")
    shareDeckButton.innerHTML = "Share Deck"
    shareDeckButton.id = "shareButton";
    shareDeckButton.classList.add("DeckButton");
    decklist.appendChild(shareDeckButton);
    shareDeckButton.onclick = shareDeck;

    // Clone share for mobile
    var mobileShareButton = shareDeckButton.cloneNode(true);
    mobileShareButton.id = "mobileShareButton";
    mobileShareButton.onclick = () => {
        shareDeck();
        closeMobileMenu();
    };
    mobileDecklist.appendChild(mobileShareButton);

    // Add delete button
    var removeDeckButton = document.createElement("button")
    removeDeckButton.innerHTML = "Delete Current Deck"
    removeDeckButton.id = "deleteButton";
    decklist.appendChild(removeDeckButton);
    removeDeckButton.onclick = () => {
        const deckName = getDeckText(selectedDeck).split("\n")[0] || "Untitled";
        if(confirm(`Are you sure you want to delete your deck "${deckName}"? This action cannot be undone`)){
            data.splice(selectedDeck, 1);
            switchDeck(0)();
        }
    };

    // Clone delete for mobile
    var mobileDeleteButton = removeDeckButton.cloneNode(true);
    mobileDeleteButton.id = "mobileDeleteButton";
    mobileDeleteButton.onclick = () => {
        const deckName = getDeckText(selectedDeck).split("\n")[0] || "Untitled";
        if(confirm(`Are you sure you want to delete your deck "${deckName}"? This action cannot be undone`)){
            data.splice(selectedDeck, 1);
            switchDeck(0)();
            closeMobileMenu();
        }
    };
    mobileDecklist.appendChild(mobileDeleteButton);
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
    sidebar.classList.toggle("collapsed");
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

async function start(){
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

    await load();

    // Set initial URL state for history
    if (!isShareMode && data.length > 0) {
        const deckId = getDeckId(selectedDeck);
        history.replaceState({ deckId }, '', deckId ? `/${currentUser}/${deckId}` : `/${currentUser}`);
    }

    switchDeck(selectedDeck)();
}

start();
