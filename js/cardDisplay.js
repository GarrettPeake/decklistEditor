// ========================================
// Card Display & Scryfall Integration
// ========================================

import * as state from './state.js';
import * as dom from './dom.js';
import { getCard } from './api.js';

let updateTimer;

// Display card image(s) in the preview area
export function displayCard(cardData) {
    return (e) => {
        state.setCurrentCardData(cardData);

        // Hide empty state and show card preview container
        if (dom.emptyState) dom.emptyState.style.display = "none";
        if (dom.cardPreviewContainer) {
            dom.cardPreviewContainer.classList.add("active");
        }

        // Clear previous card images
        if (dom.cardImagesContainer) {
            dom.cardImagesContainer.innerHTML = "";
        }

        const cardfront = document.createElement("img");
        cardfront.setAttribute("src", cardData.imgfront);
        cardfront.classList.add("card-image");

        // Add click handler for mobile - tap image to open Scryfall
        if (state.isMobile && cardData.link) {
            cardfront.classList.add("card-image-clickable");
            cardfront.onclick = () => {
                window.open(cardData.link, "_blank");
            };
        }

        if (cardData.imgback) {
            const cardback = document.createElement("img");
            cardback.setAttribute("src", cardData.imgback);
            cardfront.classList.add("twoCard");
            cardback.classList.add("twoCard", "card-image");

            if (state.isMobile && cardData.link) {
                cardback.classList.add("card-image-clickable");
                cardback.onclick = () => {
                    window.open(cardData.link, "_blank");
                };
            }

            dom.cardImagesContainer.appendChild(cardback);
        } else {
            cardfront.classList.add("oneCard");
        }
        dom.cardImagesContainer.appendChild(cardfront);
    };
}

// Show connection line from card to display
export function showConnectionLine(cardElement) {
    if (state.isMobile || !dom.connectionLine || !dom.dispArea) return;

    const cardRect = cardElement.getBoundingClientRect();
    const displayRect = dom.dispArea.getBoundingClientRect();

    const startX = cardRect.right;
    const startY = cardRect.top + (cardRect.height / 2);
    const endX = displayRect.left;

    dom.connectionLine.style.left = startX + 'px';
    dom.connectionLine.style.top = startY + 'px';
    dom.connectionLine.style.width = (endX - startX) + 'px';
    dom.connectionLine.classList.add('active');
}

// Hide connection line
export function hideConnectionLine() {
    if (dom.connectionLine) {
        dom.connectionLine.classList.remove('active');

        // Hide card preview and show empty state
        if (dom.cardPreviewContainer) {
            dom.cardPreviewContainer.classList.remove("active");
        }
        if (dom.emptyState) {
            dom.emptyState.style.display = "flex";
        }
    }
}

// Update card links display (debounced)
export function updateData(newData) {
    if (newData !== undefined && newData !== null) {
        // Update deck text
        if (state.isShareMode) {
            state.data[state.selectedDeck] = newData;
        } else {
            if (state.data[state.selectedDeck]) {
                state.data[state.selectedDeck].text = newData;
            }
        }

        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            const cards = newData.split("\n");
            dom.cardLinks.innerHTML = "";

            const title = document.createElement("p");
            title.textContent = cards[0];
            title.classList.add("deck-title");
            dom.cardLinks.appendChild(title);

            let currentStack = null;

            for (let i = 1; i < cards.length; i++) {
                const lineText = cards[i];
                if (lineText !== "") {
                    if (lineText[0] === "#") {
                        // Close previous stack
                        if (currentStack) {
                            dom.cardLinks.appendChild(currentStack);
                            currentStack = null;
                        }

                        const header = document.createElement("p");
                        header.classList.add("header");
                        header.textContent = lineText.substring(1).trim();
                        dom.cardLinks.appendChild(header);

                        // Start new stack for this section
                        currentStack = document.createElement("div");
                        currentStack.classList.add("card-stack");
                    } else {
                        // Parse card quantity and name
                        let cardQuantity = "";
                        let cardName;
                        const tokens = lineText.split(" ");

                        // Check if first token is a number or ends with 'x'
                        const firstToken = tokens[0];
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
                        getCard(cardName).then(cardData => {
                            if (cardData.link) {
                                // Desktop: hover to show, click to open
                                if (!state.isMobile) {
                                    cardItem.addEventListener("mouseenter", (e) => {
                                        displayCard(cardData)();
                                        showConnectionLine(cardItem);
                                    });
                                    cardItem.addEventListener("mouseleave", (e) => {
                                        hideConnectionLine();
                                    });
                                    cardItem.onclick = () => {
                                        window.open(cardData.link, "_blank");
                                    };
                                }
                                // Mobile: tap to show card art
                                else {
                                    cardItem.onclick = (e) => {
                                        e.preventDefault();
                                        displayCard(cardData)();
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
                        dom.cardLinks.appendChild(currentStack);
                        currentStack = null;
                    }
                }
            }

            // Append any remaining stack
            if (currentStack) {
                dom.cardLinks.appendChild(currentStack);
            }
        }, 500);
    }
}
