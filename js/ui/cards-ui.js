/**
 * Cards UI - Rendu des cartes pour Flip7
 */

import { CardType, ActionType, ModifierType } from '../game/card.js';

/**
 * Crée l'élément HTML d'une carte
 */
export function createCardElement(card, options = {}) {
    const { flipped = false, small = false, large = false, animated = false } = options;

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;

    if (card.isNumber()) {
        cardEl.classList.add('card-number');
        cardEl.dataset.value = card.value;
    } else if (card.isModifier()) {
        cardEl.classList.add('card-modifier');
        cardEl.dataset.type = card.subType;
    } else if (card.isAction()) {
        cardEl.classList.add('card-action');
        cardEl.dataset.type = card.subType;
    }

    if (flipped) cardEl.classList.add('flipped');
    if (small) cardEl.classList.add('small');
    if (large) cardEl.classList.add('large');
    if (animated) cardEl.classList.add('deal-in');

    // Face avant
    const frontEl = document.createElement('div');
    frontEl.className = 'card-face card-front';

    if (card.isNumber()) {
        frontEl.innerHTML = `
            <span class="card-value-corner top-left">${card.value}</span>
            <span class="card-value">${card.value}</span>
            <span class="card-value-corner bottom-right">${card.value}</span>
        `;
    } else if (card.isModifier()) {
        frontEl.innerHTML = `
            <span class="card-value">${card.subType}</span>
        `;
    } else if (card.isAction()) {
        const icons = {
            [ActionType.FREEZE]: '❄️',
            [ActionType.FLIP_THREE]: '🔄',
            [ActionType.SECOND_CHANCE]: '🍀'
        };
        const labels = {
            [ActionType.FREEZE]: 'Freeze',
            [ActionType.FLIP_THREE]: 'Flip 3',
            [ActionType.SECOND_CHANCE]: '2nd Chance'
        };
        frontEl.innerHTML = `
            <span class="card-icon">${icons[card.subType] || '?'}</span>
            <span class="card-label">${labels[card.subType] || 'Action'}</span>
        `;
    }

    // Face arrière
    const backEl = document.createElement('div');
    backEl.className = 'card-face card-back';

    cardEl.appendChild(frontEl);
    cardEl.appendChild(backEl);

    return cardEl;
}

/**
 * Crée l'élément deck
 */
export function createDeckElement(count) {
    return `
        <div class="deck-cards"></div>
        <span class="deck-count">${count}</span>
    `;
}

/**
 * Anime un bust sur une carte
 */
export function animateBust(cardEl) {
    cardEl.classList.add('bust');
    setTimeout(() => cardEl.classList.remove('bust'), 500);
}

/**
 * Anime un flip de carte
 */
export function animateFlip(cardEl) {
    cardEl.classList.add('flip-in');
    setTimeout(() => cardEl.classList.remove('flip-in'), 500);
}
