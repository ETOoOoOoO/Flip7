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
    constructor(onStateChange, onError) {
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
        if (this.gamePhase !== GamePhase.LOBBY) {
            conn.send(createMessage(MessageType.ERROR, {
                error: 'La partie a déjà commencé'
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
        this.players.push(player);
        this.connections.set(conn.peer, conn);

        // Envoie l'état actuel au nouveau joueur
        conn.send(createMessage(MessageType.GAME_STATE, {
            players: this.players.map(p => p.serialize()),
            gamePhase: this.gamePhase,
            targetScore: this.targetScore,
            roomCode: this.roomCode
        }));

        // Notifie tous les autres joueurs
        this.broadcast(createMessage(MessageType.PLAYER_JOINED, {
            player: player.serialize()
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
            this.broadcast(createMessage(MessageType.PLAYER_BUSTED, {
                playerId: peerId
            }));
        }

        if (result.flip7) {
            this.broadcast(createMessage(MessageType.FLIP7_ACHIEVED, {
                playerId: peerId
            }));
        }

        if (result.canUseSecondChance) {
            const conn = this.connections.get(peerId);
            conn?.send(createMessage(MessageType.SECOND_CHANCE_PROMPT, {}));
        }

        if (result.roundEnded) {
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

        const result = this.round.useSecondChance(peerId);

        if (result.success) {
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

        if (result.roundEnded) {
            this.endRound();
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
            deckCount: this.round?.deck?.remaining() || 94
        });
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
