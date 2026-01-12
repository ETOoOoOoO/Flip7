/**
 * Round - Gestion d'un round de Flip7
 */

import { Deck } from './deck.js';
import { Rules, FLIP7_BONUS } from './rules.js';
import { PlayerStatus } from './player.js';
import { CardType, ActionType } from './card.js';

export const RoundPhase = {
    WAITING: 'waiting',
    DEALING: 'dealing',
    PLAYING: 'playing',
    ENDED: 'ended'
};

export class Round {
    constructor(players, dealerIndex = 0) {
        this.deck = new Deck();
        this.players = players;
        this.dealerIndex = dealerIndex;
        this.currentPlayerIndex = (dealerIndex + 1) % players.length;
        this.phase = RoundPhase.WAITING;
        this.lastCardDealt = null;
        this.flip7Achieved = false;
        this.flip7Player = null;
    }

    /**
     * Démarre le round en distribuant une carte à chaque joueur
     */
    start() {
        this.phase = RoundPhase.DEALING;

        // Reset tous les joueurs pour ce round
        for (const player of this.players) {
            player.resetForRound();
        }

        // Distribution initiale (une carte chacun)
        const dealtCards = [];
        // ON COMMENCE A ZERO CARTES (modif user request)
        /*
        for (let i = 0; i < this.players.length; i++) {
            const playerIndex = (this.dealerIndex + 1 + i) % this.players.length;
            const player = this.players[playerIndex];
            const card = this.deck.draw();

            if (card) {
                player.addCard(card);
                dealtCards.push({
                    playerId: player.id,
                    card: card.serialize()
                });

                // Si c'est une carte action, on la résout immédiatement
                if (card.isAction()) {
                    // Les cartes action pendant la distribution sont gardées par le joueur
                    // Elles seront utilisables plus tard
                }
            }
        }
        */

        this.phase = RoundPhase.PLAYING;
        return dealtCards;
    }

    /**
     * Obtient le joueur actuel
     */
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    /**
     * Action: Piocher une carte (HIT)
     */
    hit(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.status !== PlayerStatus.ACTIVE) {
            return { success: false, error: 'Joueur non actif' };
        }

        if (this.players[this.currentPlayerIndex].id !== playerId) {
            return { success: false, error: 'Ce n\'est pas ton tour' };
        }

        const card = this.deck.draw();
        if (!card) {
            return { success: false, error: 'Plus de cartes' };
        }

        this.lastCardDealt = card;
        const result = {
            success: true,
            card: card.serialize(),
            playerId: playerId,
            bust: false,
            flip7: false,
            useSecondChance: false
        };

        // Vérifie le bust pour les cartes numériques
        if (card.isNumber()) {
            if (Rules.checkBust(player, card)) {
                if (player.hasSecondChance) {
                    // Le joueur peut utiliser Second Chance
                    result.canUseSecondChance = true;
                    // On garde la carte temporairement
                    player.addCard(card);
                } else {
                    // BUST!
                    player.status = PlayerStatus.BUSTED;
                    player.addCard(card);
                    result.bust = true;
                    this.advanceToNextPlayer();
                }
            } else {
                player.addCard(card);

                // Vérifie Flip 7
                if (Rules.checkFlip7(player)) {
                    this.flip7Achieved = true;
                    this.flip7Player = player;
                    result.flip7 = true;
                    result.roundEnded = true;
                    this.endRound();
                } else {
                    this.advanceToNextPlayer();
                }
            }
        } else if (card.isAction()) {
            player.addCard(card);
            result.actionCard = card.subType;
            // Les cartes action restent en main, le tour passe
            this.advanceToNextPlayer();
        } else if (card.isModifier()) {
            player.addCard(card);
            this.advanceToNextPlayer();
        }

        // Vérifie si le round est terminé
        if (Rules.isRoundOver(this.players)) {
            this.endRound();
            result.roundEnded = true;
        }

        return result;
    }

    /**
     * Utilise Second Chance pour éviter un bust
     */
    useSecondChance(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.hasSecondChance) {
            return { success: false, error: 'Pas de Second Chance disponible' };
        }

        // Trouve et retire la carte Second Chance
        const scCard = player.cards.find(c =>
            c.isAction() && c.subType === ActionType.SECOND_CHANCE
        );
        if (scCard) {
            player.removeCard(scCard.id);
            this.deck.discard([scCard]);
        }

        // Retire la dernière carte piochée (celle qui causait le bust)
        if (this.lastCardDealt) {
            player.removeCard(this.lastCardDealt.id);
            this.deck.discard([this.lastCardDealt]);
        }

        player.hasSecondChance = false;
        this.advanceToNextPlayer();

        return { success: true };
    }

    /**
     * Action: Rester (STAY)
     */
    stay(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.status !== PlayerStatus.ACTIVE) {
            return { success: false, error: 'Joueur non actif' };
        }

        if (player.cards.length === 0) {
            return { success: false, error: 'Tu dois avoir au moins une carte pour rester' };
        }

        player.status = PlayerStatus.STAYED;
        this.advanceToNextPlayer();

        const result = { success: true, playerId: playerId };

        // Vérifie si le round est terminé
        if (Rules.isRoundOver(this.players)) {
            this.endRound();
            result.roundEnded = true;
        }

        return result;
    }

    /**
     * Joue une carte action sur une cible
     */
    playAction(playerId, actionType, targetId) {
        const player = this.players.find(p => p.id === playerId);
        const target = this.players.find(p => p.id === targetId);

        if (!player || !target) {
            return { success: false, error: 'Joueur invalide' };
        }

        // Vérifie que le joueur a la carte
        const actionCard = player.cards.find(c =>
            c.isAction() && c.subType === actionType
        );
        if (!actionCard) {
            return { success: false, error: 'Tu n\'as pas cette carte' };
        }

        // Vérifie les règles
        if (!Rules.canUseActionOn(player, target, actionType)) {
            return { success: false, error: 'Action invalide sur cette cible' };
        }

        // Retire et défausse la carte
        player.removeCard(actionCard.id);
        this.deck.discard([actionCard]);

        const result = {
            success: true,
            playerId,
            targetId,
            actionType,
            effects: []
        };

        // Applique l'effet
        switch (actionType) {
            case ActionType.FREEZE:
                target.status = PlayerStatus.FROZEN;
                result.effects.push({ type: 'freeze', targetId });
                break;

            case ActionType.FLIP_THREE:
                // Force la cible à piocher 3 cartes
                for (let i = 0; i < 3; i++) {
                    const card = this.deck.draw();
                    if (card) {
                        if (card.isNumber() && Rules.checkBust(target, card)) {
                            target.addCard(card);
                            target.status = PlayerStatus.BUSTED;
                            result.effects.push({
                                type: 'flip-three-bust',
                                targetId,
                                card: card.serialize()
                            });
                            break;
                        } else {
                            target.addCard(card);
                            result.effects.push({
                                type: 'flip-three-card',
                                targetId,
                                card: card.serialize()
                            });

                            // Vérifie Flip 7
                            if (Rules.checkFlip7(target)) {
                                this.flip7Achieved = true;
                                this.flip7Player = target;
                                result.effects.push({ type: 'flip7', playerId: targetId });
                                this.endRound();
                                result.roundEnded = true;
                                break;
                            }
                        }
                    }
                }
                break;

            case ActionType.STOP:
                target.status = PlayerStatus.STAYED;
                result.effects.push({ type: 'stop', targetId });
                break;
        }

        return result;
    }

    /**
     * Passe au joueur suivant
     */
    advanceToNextPlayer() {
        let attempts = 0;
        let found = false;
        let index = this.currentPlayerIndex;

        // Cherche le prochain joueur actif
        do {
            index = (index + 1) % this.players.length;
            const player = this.players[index];

            if (player.status === PlayerStatus.FROZEN) {
                // Le joueur saute ce tour mais redevient actif pour le suivant
                player.status = PlayerStatus.ACTIVE;
                // On continue la boucle pour trouver le suivant
            } else if (player.status === PlayerStatus.ACTIVE || player.status === 'active') {
                this.currentPlayerIndex = index;
                found = true;
            }

            attempts++;
        } while (!found && attempts <= this.players.length);

        // Si on n'a pas trouvé de joueur actif (tout le monde stay/bust), round fini
        // Rules.isRoundOver gère ça
    }

    /**
     * Termine le round
     */
    endRound() {
        if (this.phase === RoundPhase.ENDED) {
            return {
                scores: Rules.calculateAllRoundScores(this.players),
                flip7: this.flip7Achieved,
                flip7Player: this.flip7Player?.id
            };
        }

        this.phase = RoundPhase.ENDED;

        // Calcule les scores
        const scores = Rules.calculateAllRoundScores(this.players);

        // Applique les scores
        for (const player of this.players) {
            player.roundScore = scores[player.id];
            player.score += player.roundScore;
        }

        // Défausse toutes les cartes
        for (const player of this.players) {
            this.deck.discard([...player.cards]);
        }

        return {
            scores,
            flip7: this.flip7Achieved,
            flip7Player: this.flip7Player?.id
        };
    }

    /**
     * Sérialise le round
     */
    serialize() {
        return {
            deck: this.deck.serialize(),
            dealerIndex: this.dealerIndex,
            currentPlayerIndex: this.currentPlayerIndex,
            phase: this.phase,
            lastCardDealt: this.lastCardDealt?.serialize() || null,
            flip7Achieved: this.flip7Achieved,
            flip7Player: this.flip7Player?.id || null
        };
    }
}
