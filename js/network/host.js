/**
 * Host - Logique de l'hôte du jeu Flip7
 */

import { Player, PlayerStatus } from '../game/player.js';
import { Round, RoundPhase } from '../game/round.js';
import { Rules, DEFAULT_TARGET_SCORE } from '../game/rules.js';
import { MessageType, createMessage } from './messages.js';
import { Card } from '../game/card.js';

export const GamePhase = {
    LOBBY: 'lobby',
    PLAYING: 'playing',
    ROUND_END: 'round_end',
    GAME_END: 'game_end'
};

export class GameHost {
    constructor(onStateChange, onError, options = {}) {
        this.peer = null;
        this.roomCode = null;
        this.connections = new Map(); // peerId -> connection
        this.players = [];
        this.localPlayer = null;
        this.gamePhase = GamePhase.LOBBY;
        this.round = null;
        this.roundNumber = 0;
        this.dealerIndex = 0;
        this.targetScore = DEFAULT_TARGET_SCORE;
        this.onStateChange = onStateChange;
        this.onError = onError;
        this.onImmediateAction = options.onImmediateAction;
        this.onAnimation = options.onAnimation;
        this.onMessage = options.onMessage;
    }

    /**
     * Génère un code de room lisible
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `FLIP-${code}`;
    }

    /**
     * Initialise l'hôte
     */
    async init(playerName, playerAvatar) {
        return new Promise((resolve, reject) => {
            this.roomCode = this.generateRoomCode();

            this.peer = new Peer(this.roomCode, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('Host connected with ID:', id);

                // Crée le joueur local (hôte)
                this.localPlayer = new Player(id, playerName, playerAvatar, true);
                this.players.push(this.localPlayer);

                this.notifyStateChange();
                resolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    // Code déjà utilisé, on en génère un nouveau
                    this.peer.destroy();
                    this.roomCode = this.generateRoomCode();
                    this.init(playerName, playerAvatar).then(resolve).catch(reject);
                } else {
                    this.onError?.(err.message);
                    reject(err);
                }
            });
        });
    }

    /**
     * Gère une nouvelle connexion
     */
    handleNewConnection(conn) {
        console.log('New connection from:', conn.peer);

        conn.on('open', () => {
            console.log('Connection opened:', conn.peer);
        });

        conn.on('data', (data) => {
            this.handleMessage(conn, data);
        });

        conn.on('close', () => {
            this.handleDisconnection(conn.peer);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    /**
     * Gère la déconnexion d'un joueur
     */
    handleDisconnection(peerId) {
        console.log('Player disconnected:', peerId);

        const playerIndex = this.players.findIndex(p => p.id === peerId);
        if (playerIndex !== -1) {
            const player = this.players[playerIndex];
            this.players.splice(playerIndex, 1);
            this.connections.delete(peerId);

            // Notifie les autres joueurs
            this.broadcast(createMessage(MessageType.PLAYER_LEFT, {
                playerId: peerId,
                playerName: player.name
            }));

            this.notifyStateChange();
        }
    }

    /**
     * Kick un joueur (hôte seulement)
     */
    kickPlayer(playerId) {
        if (this.gamePhase !== GamePhase.LOBBY) return false;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return false;

        const player = this.players[playerIndex];
        if (player.isHost) return false; // Can't kick host

        // Ferme la connexion
        const conn = this.connections.get(playerId);
        if (conn) {
            conn.send(createMessage(MessageType.KICKED, { reason: 'Tu as été exclu par l\'hôte' }));
            conn.close();
        }

        // Supprime le joueur
        this.players.splice(playerIndex, 1);
        this.connections.delete(playerId);

        // Notifie les autres
        this.broadcast(createMessage(MessageType.PLAYER_LEFT, {
            playerId: playerId,
            playerName: player.name
        }));

        this.notifyStateChange();
        return true;
    }

    /**
     * Gère un message reçu
     */
    handleMessage(conn, message) {
        console.log('Received message:', message.type, message);

        switch (message.type) {
            case MessageType.JOIN:
                this.handleJoin(conn, message);
                break;
            case MessageType.UPDATE_PROFILE:
                this.handleUpdateProfile(conn.peer, message);
                break;
            case MessageType.ACTION_HIT:
                this.handleHit(conn.peer);
                break;
            case MessageType.ACTION_STAY:
                this.handleStay(conn.peer);
                break;
            case MessageType.USE_SECOND_CHANCE:
                this.handleUseSecondChance(conn.peer);
                break;
            case MessageType.DECLINE_SECOND_CHANCE:
                this.handleDeclineSecondChance(conn.peer);
                break;
            case MessageType.PLAY_ACTION_CARD:
                this.handlePlayActionCard(conn.peer, message);
                break;
        }
    }

    /**
     * Gère la demande de rejoindre
     */
    handleJoin(conn, message) {
        // Interdit de rejoindre si la partie est terminée
        if (this.gamePhase === GamePhase.GAME_END) {
            conn.send(createMessage(MessageType.ERROR, {
                error: 'La partie est terminée'
            }));
            return;
        }

        if (this.players.length >= 10) {
            conn.send(createMessage(MessageType.ERROR, {
                error: 'La table est pleine (10 joueurs max)'
            }));
            return;
        }

        // Crée le nouveau joueur
        const player = new Player(conn.peer, message.name, message.avatar, false);

        // Si la partie est en cours, le joueur commence avec 0 et attend le prochain round
        if (this.gamePhase === GamePhase.PLAYING || this.gamePhase === GamePhase.ROUND_END) {
            player.score = 0;
            player.status = 'waiting'; // Attend le prochain round
        }

        this.players.push(player);
        this.connections.set(conn.peer, conn);

        // Envoie l'état actuel au nouveau joueur
        conn.send(createMessage(MessageType.GAME_STATE, {
            players: this.players.map(p => p.serialize()),
            gamePhase: this.gamePhase,
            targetScore: this.targetScore,
            roomCode: this.roomCode,
            roundNumber: this.roundNumber,
            currentPlayerId: this.round?.getCurrentPlayer()?.id,
            deckCount: this.round?.deck?.remaining() || 94,
            lateJoin: this.gamePhase !== GamePhase.LOBBY
        }));

        // Notifie tous les autres joueurs
        this.broadcast(createMessage(MessageType.PLAYER_JOINED, {
            player: player.serialize(),
            lateJoin: this.gamePhase !== GamePhase.LOBBY
        }), conn.peer);

        this.notifyStateChange();
    }

    /**
     * Gère la mise à jour du profil
     */
    handleUpdateProfile(peerId, message) {
        const player = this.players.find(p => p.id === peerId);
        if (player) {
            if (message.name) player.name = message.name;
            if (message.avatar) player.avatar = message.avatar;

            this.broadcastGameState();
            this.notifyStateChange();
        }
    }

    /**
     * Démarre la partie
     */
    startGame() {
        if (this.players.length < 3) {
            this.onError?.('Il faut au moins 3 joueurs pour commencer');
            return false;
        }

        // Reset tous les scores des joueurs pour la nouvelle partie
        for (const player of this.players) {
            player.score = 0;
            player.roundScore = 0;
        }

        this.gamePhase = GamePhase.PLAYING;
        this.roundNumber = 0;
        this.dealerIndex = 0;

        this.broadcast(createMessage(MessageType.GAME_STARTING, {
            targetScore: this.targetScore
        }));

        this.startNewRound();
        return true;
    }

    /**
     * Démarre un nouveau round
     */
    startNewRound() {
        this.roundNumber++;
        this.round = new Round(this.players, this.dealerIndex);

        const dealtCards = this.round.start();

        this.broadcast(createMessage(MessageType.ROUND_START, {
            roundNumber: this.roundNumber,
            dealerIndex: this.dealerIndex,
            dealtCards: dealtCards,
            currentPlayerId: this.round.getCurrentPlayer().id
        }));

        this.notifyStateChange();
    }

    /**
     * Gère l'action HIT
     */
    handleHit(peerId) {
        if (!this.round || this.round.phase !== RoundPhase.PLAYING) return;

        const result = this.round.hit(peerId);

        if (!result.success) {
            const conn = this.connections.get(peerId);
            conn?.send(createMessage(MessageType.ERROR, { error: result.error }));
            return;
        }

        // Broadcast le résultat
        this.broadcast(createMessage(MessageType.PLAYER_HIT, {
            playerId: peerId,
            card: result.card,
            bust: result.bust,
            flip7: result.flip7,
            canUseSecondChance: result.canUseSecondChance
        }));

        if (result.bust) {
            const bustMsg = { type: 'PLAYER_BUSTED', playerId: peerId };
            this.broadcast(createMessage(MessageType.PLAYER_BUSTED, {
                playerId: peerId
            }));
            // Also notify the host locally
            this.onMessage?.(bustMsg);
        }

        if (result.flip7) {
            this.broadcast(createMessage(MessageType.FLIP7_ACHIEVED, {
                playerId: peerId
            }));
        }

        if (result.canUseSecondChance) {
            const conn = this.connections.get(peerId);
            conn?.send(createMessage(MessageType.SECOND_CHANCE_PROMPT, {}));
            // Track pending for host
            if (peerId === this.localPlayer.id) {
                this.pendingSecondChance = true;
            }
        }

        // If local player drew an immediate action card, trigger the modal
        if (result.actionCard && peerId === this.localPlayer.id) {
            const card = this.round.lastCardDealt;
            if (card && (card.subType === 'stop' || card.subType === 'flip-three')) {
                this.onImmediateAction?.(card);
            }
        }

        if (result.waitAction) {
            // Action card drawn, start timer
            const ACTION_TIMEOUT = 5000;
            this.broadcast(createMessage(MessageType.ACTION_TIMER, {
                duration: ACTION_TIMEOUT,
                playerId: peerId
            }));

            // Clear any existing timeout
            if (this.actionTimeout) {
                clearTimeout(this.actionTimeout);
                this.actionTimeout = null;
            }

            // Start new timeout
            this.actionTimeout = setTimeout(() => {
                console.log('Action timer expired, advancing turn');
                if (this.round && this.round.getCurrentPlayer()?.id === peerId) {
                    this.round.advanceToNextPlayer();
                    if (Rules.isRoundOver(this.players)) {
                        this.endRound();
                    } else {
                        this.broadcastTurnChange();
                    }
                    this.notifyStateChange();
                }
                this.actionTimeout = null;
            }, ACTION_TIMEOUT);

            // Should we notify state change here? Yes, but maybe not vital if client handles timer animation separately.
            // But we should sync pending state if we had one.
            // For now, no special state flag needed on host besides simple timeout?
        } else if (result.roundEnded) {
            this.endRound();
        } else if (!result.canUseSecondChance) {
            this.broadcastTurnChange();
        }

        this.notifyStateChange();
    }

    /**
     * Gère l'utilisation de Second Chance
     */
    handleUseSecondChance(peerId) {
        if (!this.round) return;

        // Reset pending flag
        if (peerId === this.localPlayer.id) {
            this.pendingSecondChance = false;
        }

        const result = this.round.useSecondChance(peerId);

        if (result.success) {
            // Broadcast l'action pour l'animation
            this.broadcast(createMessage(MessageType.ACTION_PLAYED, {
                playerId: peerId,
                actionType: 'second-chance',
                effects: [{ type: 'second-chance', targetId: peerId }]
            }));

            this.broadcastGameState();
            this.broadcastTurnChange();
        }

        this.notifyStateChange();
    }

    /**
     * Gère le refus de Second Chance
     */
    handleDeclineSecondChance(peerId) {
        if (!this.round) return;

        // Reset pending flag
        if (peerId === this.localPlayer.id) {
            this.pendingSecondChance = false;
        }

        const player = this.players.find(p => p.id === peerId);
        if (player) {
            player.status = PlayerStatus.BUSTED;
            player.hasSecondChance = false;

            this.broadcast(createMessage(MessageType.PLAYER_BUSTED, {
                playerId: peerId
            }));

            this.round.advanceToNextPlayer();

            if (Rules.isRoundOver(this.players)) {
                this.endRound();
            } else {
                this.broadcastTurnChange();
            }

            this.notifyStateChange();
        }
    }

    /**
     * Gère l'action STAY
     */
    handleStay(peerId) {
        if (!this.round || this.round.phase !== RoundPhase.PLAYING) return;

        const result = this.round.stay(peerId);

        if (!result.success) {
            const conn = this.connections.get(peerId);
            conn?.send(createMessage(MessageType.ERROR, { error: result.error }));
            return;
        }

        this.broadcast(createMessage(MessageType.PLAYER_STAYED, {
            playerId: peerId
        }));

        if (result.roundEnded) {
            this.endRound();
        } else {
            this.broadcastTurnChange();
        }

        this.notifyStateChange();
    }
    /**
     * Gère l'utilisation d'une carte action
     */
    handlePlayActionCard(peerId, message) {
        if (!this.round || this.round.phase !== RoundPhase.PLAYING) return;

        const result = this.round.playAction(peerId, message.actionType, message.targetId);

        if (!result.success) {
            const conn = this.connections.get(peerId);
            conn?.send(createMessage(MessageType.ERROR, { error: result.error }));
            return;
        }

        this.broadcast(createMessage(MessageType.ACTION_PLAYED, result));

        // Notify host locally so it sees the same messages as clients
        const actionMsg = { type: 'ACTION_PLAYED', ...result };
        this.onMessage?.(actionMsg);

        // Cancel pending action timer if any
        if (this.actionTimeout) {
            clearTimeout(this.actionTimeout);
            this.actionTimeout = null;
        }

        // Trigger animation for the host (local player)
        if (result.effects && result.effects.length > 0) {
            const effectType = result.effects[0].type;
            this.onAnimation?.(effectType, result);
        }

        // Handle Second Chance for Flip3 bust
        if (result.canUseSecondChance && result.secondChancePlayerId) {
            const targetConn = this.connections.get(result.secondChancePlayerId);
            targetConn?.send(createMessage(MessageType.SECOND_CHANCE_PROMPT, {}));

            // Track pending for host if affected
            if (result.secondChancePlayerId === this.localPlayer.id) {
                this.pendingSecondChance = true;
            }

            // Don't advance turn - wait for Second Chance response
            this.notifyStateChange();
            return;
        }

        // Après avoir joué une action, le joueur qui a joué a terminé son tour
        // On avance toujours au joueur suivant
        this.round.advanceToNextPlayer();

        if (result.roundEnded) {
            this.endRound();
        } else if (Rules.isRoundOver(this.players)) {
            this.endRound();
        } else {
            this.broadcastTurnChange();
        }

        this.notifyStateChange();
    }

    /**
     * Termine le round
     */
    endRound() {
        this.gamePhase = GamePhase.ROUND_END;
        const roundResult = this.round.endRound();

        this.broadcast(createMessage(MessageType.ROUND_END, {
            scores: roundResult.scores,
            flip7: roundResult.flip7,
            flip7Player: roundResult.flip7Player,
            players: this.players.map(p => p.serialize())
        }));

        // Vérifie si la partie est terminée
        if (Rules.checkGameEnd(this.players, this.targetScore)) {
            this.endGame();
        }

        this.notifyStateChange();
    }

    /**
     * Passe au round suivant (appelé par l'hôte)
     */
    nextRound() {
        if (this.gamePhase !== GamePhase.ROUND_END) return;

        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        this.gamePhase = GamePhase.PLAYING;
        this.startNewRound();
    }

    /**
     * Termine la partie
     */
    endGame() {
        this.gamePhase = GamePhase.GAME_END;
        const winner = Rules.getWinner(this.players);

        this.broadcast(createMessage(MessageType.GAME_END, {
            winner: winner.serialize(),
            players: this.players.map(p => p.serialize())
        }));

        this.notifyStateChange();
    }

    /**
     * Met à jour le score cible
     */
    setTargetScore(score) {
        this.targetScore = score;
        this.broadcast(createMessage(MessageType.SETTINGS_UPDATED, {
            targetScore: score
        }));
        this.notifyStateChange();
    }

    /**
     * Met à jour le profil du joueur local (hôte)
     */
    updateLocalProfile(name, avatar) {
        if (this.localPlayer) {
            if (name) this.localPlayer.name = name;
            if (avatar) this.localPlayer.avatar = avatar;
            this.broadcastGameState();
            this.notifyStateChange();
        }
    }

    /**
     * Broadcast l'état complet du jeu
     */
    broadcastGameState() {
        this.broadcast(createMessage(MessageType.GAME_STATE, {
            players: this.players.map(p => p.serialize()),
            gamePhase: this.gamePhase,
            targetScore: this.targetScore,
            roomCode: this.roomCode,
            roundNumber: this.roundNumber,
            currentPlayerId: this.round?.getCurrentPlayer()?.id,
            deckCount: this.round?.deck?.remaining() || 0
        }));
    }

    /**
     * Broadcast le changement de tour
     */
    broadcastTurnChange() {
        if (!this.round) return;

        this.broadcast(createMessage(MessageType.TURN_CHANGE, {
            currentPlayerId: this.round.getCurrentPlayer().id,
            deckCount: this.round.deck.remaining()
        }));
    }

    /**
     * Envoie un message à tous les clients
     */
    broadcast(message, excludePeerId = null) {
        for (const [peerId, conn] of this.connections) {
            if (peerId !== excludePeerId) {
                conn.send(message);
            }
        }
    }

    /**
     * Notifie le changement d'état local
     */
    notifyStateChange() {
        this.onStateChange?.({
            players: this.players,
            localPlayer: this.localPlayer,
            gamePhase: this.gamePhase,
            round: this.round,
            roundNumber: this.roundNumber,
            targetScore: this.targetScore,
            roomCode: this.roomCode,
            isHost: true,
            currentPlayerId: this.round?.getCurrentPlayer()?.id || null,
            deckCount: this.round?.deck?.remaining() || 94,
            pendingSecondChance: this.pendingSecondChance || false
        });
    }

    /**
     * Exclut un joueur de la partie
     */
    kickPlayer(playerId) {
        // Ne peut pas se kick soi-même
        if (playerId === this.localPlayer?.id) return;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;

        const player = this.players[playerIndex];
        const conn = this.connections.get(playerId);

        console.log(`Kicking player ${player.name} (${playerId})`);

        // Envoie message KICKED
        if (conn) {
            try {
                conn.send(createMessage(MessageType.KICKED, { reason: 'Exclu par l\'hôte' }));

                // Ferme la connexion après un court délai pour laisser le temps au message de partir
                setTimeout(() => {
                    try {
                        conn.close();
                    } catch (e) {
                        console.error('Error closing connection:', e);
                    }
                }, 100);
            } catch (e) {
                console.error('Error sending kick message:', e);
            }
            this.connections.delete(playerId);
        }

        // Retire le joueur de la liste
        this.players.splice(playerIndex, 1);

        // Si c'était le tour du joueur kické, passe au suivant
        if (this.round && this.round.getCurrentPlayer()?.id === playerId) {
            this.round.advanceToNextPlayer();
        }

        // Broadcast player left
        this.broadcast(createMessage(MessageType.PLAYER_LEFT, { playerId }));

        // Recalcule target score si nécessaire (basé sur nb joueurs)
        // ... (optionnel)

        this.notifyStateChange();
    }

    /**
     * Réinitialise complètement la partie
     */
    resetGame() {
        console.log('Resetting game...');

        // Reset scores
        for (const player of this.players) {
            player.score = 0;
            player.roundScore = 0;
            player.cards = [];
            player.status = 'active'; // Reset status
            player.hasSecondChance = true; // Reset second chance
        }

        this.roundNumber = 0;
        this.dealerIndex = 0;
        this.gamePhase = GamePhase.PLAYING;

        // Broadcast reset (via GAME_STATE ou message spécifique si besoin)
        // On va juste startNewRound qui va envoyer GAME_STARTING/ROUND_START

        this.startNewRound();

        this.broadcast(createMessage(MessageType.GAME_STATE, {
            players: this.players.map(p => p.serialize()),
            gamePhase: this.gamePhase,
            targetScore: this.targetScore,
            roomCode: this.roomCode,
            roundNumber: this.roundNumber,
            currentPlayerId: this.round?.getCurrentPlayer()?.id,
            deckCount: this.round?.deck?.remaining(),
            reset: true
        }));

        this.showToast('Partie réinitialisée', 'info');
        this.notifyStateChange();
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (this.peer) {
            this.peer.destroy();
        }
        this.connections.clear();
        this.players = [];
    }
}
