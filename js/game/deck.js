/**
 * Deck - Gestion du paquet de cartes Flip7
 * 
 * Composition du deck (94 cartes):
 * - Cartes numériques: 0 (x1), 1 (x1), 2 (x2), 3 (x3)... 12 (x12) = 79 cartes
 * - Modificateurs: +5 (x3), +10 (x2), x2 (x2) = 7 cartes
 * - Actions: Freeze (x3), Flip Three (x3), Second Chance (x2) = 8 cartes
 */

import { Card, CardType, ActionType, ModifierType } from './card.js';

export class Deck {
    constructor() {
        this.cards = [];
        this.discardPile = [];
        this.init();
    }

    /**
     * Initialise le deck avec toutes les cartes
     */
    init() {
        this.cards = [];
        this.discardPile = [];

        // Cartes numériques: valeur N apparaît N fois (sauf 0 et 1 qui apparaissent 1 fois)
        for (let value = 0; value <= 12; value++) {
            const count = value === 0 ? 1 : value;
            for (let i = 0; i < count; i++) {
                this.cards.push(new Card(CardType.NUMBER, value));
            }
        }

        // Modificateurs
        for (let i = 0; i < 3; i++) {
            this.cards.push(new Card(CardType.MODIFIER, 5, ModifierType.PLUS_5));
        }
        for (let i = 0; i < 2; i++) {
            this.cards.push(new Card(CardType.MODIFIER, 10, ModifierType.PLUS_10));
        }
        for (let i = 0; i < 2; i++) {
            this.cards.push(new Card(CardType.MODIFIER, 0, ModifierType.TIMES_2));
        }

        // Actions
        for (let i = 0; i < 3; i++) {
            this.cards.push(new Card(CardType.ACTION, 0, ActionType.FREEZE));
        }
        for (let i = 0; i < 3; i++) {
            this.cards.push(new Card(CardType.ACTION, 0, ActionType.FLIP_THREE));
        }
        for (let i = 0; i < 2; i++) {
            this.cards.push(new Card(CardType.ACTION, 0, ActionType.SECOND_CHANCE));
        }
        for (let i = 0; i < 3; i++) {
            this.cards.push(new Card(CardType.ACTION, 0, ActionType.STOP));
        }

        this.shuffle();
    }

    /**
     * Mélange le deck (Fisher-Yates shuffle)
     */
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    /**
     * Pioche une carte du dessus du deck
     */
    draw() {
        if (this.cards.length === 0) {
            this.reshuffleDiscard();
        }
        if (this.cards.length === 0) {
            return null;
        }
        return this.cards.pop();
    }

    /**
     * Remet la défausse dans le deck et mélange
     */
    reshuffleDiscard() {
        if (this.discardPile.length === 0) return;
        this.cards = [...this.discardPile];
        this.discardPile = [];
        this.shuffle();
    }

    /**
     * Défausse des cartes
     */
    discard(cards) {
        this.discardPile.push(...cards);
    }

    /**
     * Nombre de cartes restantes
     */
    remaining() {
        return this.cards.length;
    }

    /**
     * Sérialise le deck pour le réseau
     */
    serialize() {
        return {
            cards: this.cards.map(c => c.serialize()),
            discardPile: this.discardPile.map(c => c.serialize())
        };
    }

    /**
     * Désérialise un deck
     */
    static deserialize(data) {
        const deck = new Deck();
        deck.cards = data.cards.map(c => Card.deserialize(c));
        deck.discardPile = data.discardPile.map(c => Card.deserialize(c));
        return deck;
    }
}
