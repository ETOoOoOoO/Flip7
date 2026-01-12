/**
 * Rules - Logique des règles du jeu Flip7
 */

import { CardType, ActionType, ModifierType } from './card.js';
import { PlayerStatus } from './player.js';

export const FLIP7_BONUS = 15;
export const DEFAULT_TARGET_SCORE = 200;

export class Rules {
    /**
     * Vérifie si une carte cause un bust (doublon numérique)
     */
    static checkBust(player, newCard) {
        if (!newCard.isNumber()) {
            return false;
        }
        return player.hasNumberValue(newCard.value);
    }

    /**
     * Vérifie si le joueur a atteint Flip 7 (7 cartes numériques uniques)
     */
    static checkFlip7(player) {
        return player.countUniqueNumbers() >= 7;
    }

    /**
     * Calcule le score d'un joueur pour le round
     */
    static calculateRoundScore(player) {
        const cards = player.cards;
        let numberSum = 0;
        let bonusPoints = 0;
        let multiplier = 1;

        for (const card of cards) {
            if (card.isNumber()) {
                numberSum += card.value;
            } else if (card.isModifier()) {
                switch (card.subType) {
                    case ModifierType.PLUS_5:
                        bonusPoints += 5;
                        break;
                    case ModifierType.PLUS_10:
                        bonusPoints += 10;
                        break;
                    case ModifierType.TIMES_2:
                        multiplier *= 2;
                        break;
                }
            }
        }

        // Score = (somme des nombres * multiplicateur) + bonus
        let score = (numberSum * multiplier) + bonusPoints;

        // Bonus Flip 7
        if (Rules.checkFlip7(player)) {
            score += FLIP7_BONUS;
        }

        return score;
    }

    /**
     * Calcule les scores de tous les joueurs pour le round
     */
    static calculateAllRoundScores(players) {
        const scores = {};

        for (const player of players) {
            if (player.status === PlayerStatus.BUSTED) {
                scores[player.id] = 0;
            } else {
                scores[player.id] = Rules.calculateRoundScore(player);
            }
        }

        return scores;
    }

    /**
     * Vérifie si quelqu'un a atteint le score cible
     */
    static checkGameEnd(players, targetScore) {
        return players.some(p => p.score >= targetScore);
    }

    /**
     * Détermine le gagnant (score le plus élevé)
     */
    static getWinner(players) {
        return players.reduce((winner, player) => {
            if (!winner || player.score > winner.score) {
                return player;
            }
            return winner;
        }, null);
    }

    /**
     * Vérifie si le round est terminé
     */
    static isRoundOver(players) {
        // Round terminé si tous les joueurs ont stay ou bust
        const activePlayers = players.filter(p => p.status === PlayerStatus.ACTIVE);
        return activePlayers.length === 0;
    }

    /**
     * Obtient le prochain joueur actif
     */
    static getNextActivePlayer(players, currentIndex) {
        const count = players.length;
        for (let i = 1; i <= count; i++) {
            const nextIndex = (currentIndex + i) % count;
            if (players[nextIndex].status === PlayerStatus.ACTIVE) {
                return nextIndex;
            }
        }
        return -1; // Aucun joueur actif
    }

    /**
     * Valide si un joueur peut utiliser une carte action sur une cible
     */
    static canUseActionOn(sourcePlayer, targetPlayer, actionType) {
        // Ne peut pas cibler un joueur inactif (sauf soi-même pour certaines actions)
        if (targetPlayer.status !== PlayerStatus.ACTIVE) {
            return false;
        }

        // Règles spécifiques par action
        switch (actionType) {
            case ActionType.FREEZE:
                // Peut freeze n'importe quel joueur actif (y compris soi-même si seul)
                return true;
            case ActionType.FLIP_THREE:
                // Peut forcer n'importe quel joueur actif à piocher 3
                return true;
            case ActionType.STOP:
                // Peut stopper n'importe quel joueur actif
                return true;
            default:
                return false;
        }
    }
}
