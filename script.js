var data = [];
var link_cache = {}
var selectedDeck = 0;
var isMobile = window.innerWidth <= 768;
var isRenderMode = false;
var currentCardData = null;

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

async function load(){
    await fetch(`/api${window.location.pathname}`)
    .then(e => e.json()).then(js => {
        data = js;
    })
    link_cache = JSON.parse(localStorage.getItem("link_cache")) || {};
}

var saveTimer;
async function save(){
    if(saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            fetch(`/api${window.location.pathname}`, {
                method: "put",
                body: JSON.stringify(data)
            })
        }, 500);
    localStorage.setItem("link_cache", JSON.stringify(link_cache));
}

function setDeckList(){
    // Clear both deck lists
    decklist.innerHTML = "";
    mobileDecklist.innerHTML = "";

    // Create add deck button
    var addDeckButton = document.createElement("button")
    addDeckButton.innerHTML = "+ Add Deck"
    addDeckButton.classList.add("DeckButton");
    decklist.appendChild(addDeckButton);
    addDeckButton.onclick = () => {
        data = [""].concat(data);
        switchDeck(0)();
        closeMobileMenu();
    }

    // Clone for mobile
    var mobileAddButton = addDeckButton.cloneNode(true);
    mobileAddButton.onclick = () => {
        data = [""].concat(data);
        switchDeck(0)();
        closeMobileMenu();
    }
    mobileDecklist.appendChild(mobileAddButton);

    // Add each deckname as a button
    for(var i = 0; i < data.length; i++){
        var deckname = data[i]?.split("\n")[0] || "Untitled";

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

    // Add delete button
    var removeDeckButton = document.createElement("button")
    removeDeckButton.innerHTML = "Delete Current Deck"
    removeDeckButton.id = "deleteButton";
    decklist.appendChild(removeDeckButton);
    removeDeckButton.onclick = () => {
        if(confirm(`Are you sure you want to delete your deck "${data[selectedDeck]?.split("\n")[0]}"? This action cannot be undone`)){
            data.splice(selectedDeck, 1);
            switchDeck(0)();
        }
    };

    // Clone delete for mobile
    var mobileDeleteButton = removeDeckButton.cloneNode(true);
    mobileDeleteButton.id = "mobileDeleteButton";
    mobileDeleteButton.onclick = () => {
        if(confirm(`Are you sure you want to delete your deck "${data[selectedDeck]?.split("\n")[0]}"? This action cannot be undone`)){
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
    if(newData){
        data[selectedDeck] = newData;

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
    setDeckList(editor.value);
    save();
}

function switchDeck(index){
    return () => {
        selectedDeck = index;
        editor.value = data[selectedDeck] || "";
        setDeckList(editor.value);
        updateData(data[selectedDeck]);
        editor.style.height = "";
        editor.style.height = editor.scrollHeight + "px";
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
    await load();
    switchDeck(0)();
}

start();
