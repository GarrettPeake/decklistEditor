var data = [];
var link_cache = {}
var selectedDeck = 0;

const storage_endpoint = "https://deckliststorage.ifficient.workers.dev"

async function load(){
    await fetch(storage_endpoint, {headers: {
        authorization: "testAuth123"
    }}).then(e => JSON.parse(e)).then(js => {
        data = js;
    })
    link_cache = JSON.parse(localStorage.getItem("link_cache")) || {};
    // Sets the data property
}

async function save(){
    // Sends the data property back to worker
    await fetch(storage_endpoint, {
        headers: {
            authorization: "testAuth123"
        },
        method: "put",
        body: data
    }).then(e => JSON.parse(e)).then(js => {
        data = js;
    })
    localStorage.setItem("link_cache", JSON.stringify(link_cache));
}

function setDeckList(){
    // Wipe the decklist
    decklist.innerHTML = "";
    // Add a button to add a new deck
    var addDeckButton = document.createElement("button")
    addDeckButton.innerHTML = "+Add Deck"
    addDeckButton.classList.add("DeckButton");
    decklist.appendChild(addDeckButton);
    addDeckButton.onclick = () => {
        data = [""].concat(data);
        switchDeck(0)();
    }
    // Add each deckname as a button to the list 
    for(var i = 0; i < data.length; i++){
        deckname = data[i]?.split("\n")[0] || "Untitled";
        const button = document.createElement("button")
        button.classList.add("DeckButton");
        button.onclick = switchDeck(i);
        button.innerHTML = deckname;
        decklist.appendChild(button);
    }
    // Add a button to remove current deck
    var removeDeckButton = document.createElement("button")
    removeDeckButton.innerHTML = "Delete Current Deck"
    removeDeckButton.id = "deleteButton";
    decklist.appendChild(removeDeckButton);
    removeDeckButton.onclick =  () => {
        if(confirm(`Are you sure you want to delete your deck "${data[selectedDeck]?.split("\n")[0]}"? This action cannot be undone`)){
            data.splice(selectedDeck, 1);
            console.log("REMOVE", data);
            switchDeck(0)();
            console.log("REMOVE AFTER", data);
        }
    };
}

function display_card(data){
    return (e) => {
        dispArea.innerHTML = "";
        var cardfront = document.createElement("img")
        cardfront.setAttribute("src", data.imgfront);
        if(data.imgback){
            var cardback = document.createElement("img")
            cardback.setAttribute("src", data.imgback);
            cardfront.classList.add("twoCard");
            cardback.classList.add("twoCard");
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
        // Update local strings
        data[selectedDeck] = newData;
        // Only update if we haven't typed for 1 second
        if(updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            // Update the list of cards to the right
            var cards = newData.split("\n");
            cardLinks.innerHTML = "";
            const title = document.createElement("p")
            title.innerHTML = cards[0];
            cardLinks.appendChild(title);
            for(var i = 1; i < cards.length; i++){
                const lineText = cards[i];
                if(lineText != ""){
                    if(lineText[0] == "#"){ // This is a header
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
                        cardLink.setAttribute("target", "_blank");
                        get_card(cardID).then(data => { 
                            if(data.link){ // The card was found
                                cardLink.addEventListener("mouseover", display_card(data));
                                cardLink.setAttribute("href", data.link);
                                display_card(data)();
                            } else { // The card wasn't found
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
        }, 1000);
    }
}

// Returns {link, imgfront, imgback}
async function get_card(cardName){
    if(link_cache[cardName]){
        return link_cache[cardName]
    }
    var resp = await (await fetch("https://api.scryfall.com/cards/named?exact=" + cardName)).json();
    var data = {
        link: resp["scryfall_uri"],
        imgfront: resp["card_faces"]?.[0]?.["image_uris"]?.["border_crop"] || resp["image_uris"]?.["border_crop"],
        imgback: resp["card_faces"]?.[1]?.["image_uris"]?.["border_crop"]
    };
    link_cache[cardName] = data;
    return data;
}

var editor = document.getElementById("editor");
var decklist = document.getElementById("decks");
var cardLinks = document.getElementById("hovers");
var dispArea = document.getElementById("display");


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


async function start(){
    await load();
    switchDeck(0)();
}

start();