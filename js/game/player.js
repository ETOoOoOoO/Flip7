/**
 * Player - Représente un joueur dans le jeu Flip7
 */

import { Card, CardType, ActionType } from './card.js';

export const PlayerStatus = {
    WAITING: 'waiting',
    ACTIVE: 'active',
    STAYED: 'stayed',
    BUSTED: 'busted',
    FROZEN: 'frozen'
};

export class Player {
    constructor(id, name, avatar, isHost = false) {
        this.id = id;
        this.name = name;
        this.avatar = avatar;
        this.isHost = isHost;
        this.cards = [];
        this.score = 0;
        this.roundScore = 0;
        this.status = PlayerStatus.WAITING;
        this.hasSecondChance = false;
    }

    /**
     * Ajoute une carte à la main du joueur
     */
    addCard(card) {
        this.cards.push(card);

        // Vérifie si c'est une carte Second Chance
        if (card.isAction() && card.subType === ActionType.SECOND_CHANCE) {
            this.hasSecondChance = true;
        }
    }

    /**
     * Retire une carte de la main du joueur
     */
    removeCard(cardId) {
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index !== -1) {
            const card = this.cards.splice(index, 1)[0];
            if (card.isAction() && card.subType === ActionType.SECOND_CHANCE) {
                this.hasSecondChance = false;
            }
            return card;
        }
        return null;
    }

    /**
     * Récupère toutes les cartes numériques du joueur
     */
    getNumberCards() {
        return this.cards.filter(c => c.isNumber());
    }

    /**
     * Récupère les valeurs numériques uniques
     */
    getUniqueNumberValues() {
        const numbers = this.getNumberCards();
        return [...new Set(numbers.map(c => c.value))];
    }

    /**
     * Vérifie si le joueur a déjà une carte avec cette valeur
     */
    hasNumberValue(value) {
        return this.cards.some(c => c.isNumber() && c.value === value);
    }

    /**
     * Vérifie si le joueur peut encore jouer
     */
    canPlay() {
        return this.status === PlayerStatus.ACTIVE;
    }

    /**
     * Réinitialise le joueur pour un nouveau round
     */
    resetForRound() {
        this.cards = [];
        this.roundScore = 0;
        this.status = PlayerStatus.ACTIVE;
        this.hasSecondChance = false;
    }

    /**
     * Compte le nombre de cartes numériques uniques
     */
    countUniqueNumbers() {
        return this.getUniqueNumberValues().length;
    }

    /**
     * Sérialise le joueur pour le réseau
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            avatar: this.avatar,
            isHost: this.isHost,
            cards: this.cards.map(c => c.serialize()),
            score: this.score,
            roundScore: this.roundScore,
            status: this.status,
            hasSecondChance: this.hasSecondChance
        };
    }

    /**
     * Désérialise un joueur
     */
    static deserialize(data) {
        const player = new Player(data.id, data.name, data.avatar, data.isHost);
        player.cards = data.cards.map(c => Card.deserialize(c));
        player.score = data.score;
        player.roundScore = data.roundScore;
        player.status = data.status;
        player.hasSecondChance = data.hasSecondChance;
        return player;
    }
}
