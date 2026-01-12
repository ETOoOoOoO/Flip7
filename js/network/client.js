/**
 * Client - Logique du client Flip7
 */

import { Player } from '../game/player.js';
import { Card } from '../game/card.js';
import { MessageType, createMessage } from './messages.js';
import { GamePhase } from './host.js';

export class GameClient {
    constructor(onStateChange, onError, onMessage, options = {}) {
        this.peer = null;
        this.connection = null;
        this.players = [];
        this.localPlayer = null;
        this.gamePhase = GamePhase.LOBBY;
        this.roundNumber = 0;
        this.currentPlayerId = null;
        this.targetScore = 200;
        this.roomCode = null;
        this.deckCount = 94;
        this.onStateChange = onStateChange;
        this.onError = onError;
        this.onMessage = onMessage;
        this.onImmediateAction = options.onImmediateAction;
        this.onAnimation = options.onAnimation;
        this.pendingSecondChance = false;
    }

    /**
     * Rejoint une partie
     */
    async join(roomCode, playerName, playerAvatar) {
        return new Promise((resolve, reject) => {
            this.roomCode = roomCode.toUpperCase();
            let hasResolved = false;

            this.peer = new Peer({
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('Client peer opened:', id);

                // Se connecte à l'hôte
                this.connection = this.peer.connect(this.roomCode);

                this.connection.on('open', () => {
                    console.log('Connected to host');

                    // Envoie la demande de rejoindre
                    this.connection.send(createMessage(MessageType.JOIN, {
                        name: playerName,
                        avatar: playerAvatar
                    }));
                });

                this.connection.on('data', (data) => {
                    this.handleMessage(data);

                    // Résout la promesse après avoir reçu le premier état avec notre joueur
                    if (data.type === MessageType.GAME_STATE && !hasResolved) {
                        // Attendre que handleGameState ait mis à jour localPlayer
                        if (this.localPlayer) {
                            hasResolved = true;
                            console.log('Join successful, local player:', this.localPlayer);
                            resolve(true);
                        }
                    }
                });

                this.connection.on('close', () => {
                    console.log('Disconnected from host');
                    if (!hasResolved) {
                        reject(new Error('Déconnecté du serveur'));
                    }
                    this.onError?.('Déconnecté du serveur');
                });

                this.connection.on('error', (err) => {
                    console.error('Connection error:', err);
                    if (!hasResolved) {
                        reject(err);
                    }
                    this.onError?.(err.message);
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'peer-unavailable') {
                    this.onError?.('Table introuvable. Vérifie le code.');
                    reject(new Error('Table introuvable'));
                } else {
                    this.onError?.(err.message);
                    reject(err);
                }
            });

            // Timeout
            setTimeout(() => {
                if (!hasResolved) {
                    reject(new Error('Timeout: impossible de se connecter'));
                }
            }, 10000);
        });
    }

    /**
     * Gère un message reçu de l'hôte
     */
    handleMessage(message) {
        console.log('Received from host:', message.type, message);

        switch (message.type) {
            case MessageType.GAME_STATE:
                this.handleGameState(message);
                break;
            case MessageType.PLAYER_JOINED:
                this.handlePlayerJoined(message);
                break;
            case MessageType.PLAYER_LEFT:
                this.handlePlayerLeft(message);
                break;
            case MessageType.GAME_STARTING:
                this.handleGameStarting(message);
                break;
            case MessageType.ROUND_START:
                this.handleRoundStart(message);
                break;
            case MessageType.PLAYER_HIT:
                this.handlePlayerHit(message);
                break;
            case MessageType.PLAYER_STAYED:
                this.handlePlayerStayed(message);
                break;
            case MessageType.PLAYER_BUSTED:
                this.handlePlayerBusted(message);
                break;
            case MessageType.ACTION_PLAYED:
                this.handleActionPlayed(message);
                break;
            case MessageType.FLIP7_ACHIEVED:
                this.handleFlip7(message);
                break;
            case MessageType.ROUND_END:
                this.handleRoundEnd(message);
                break;
            case MessageType.GAME_END:
                this.handleGameEnd(message);
                break;
            case MessageType.TURN_CHANGE:
                this.handleTurnChange(message);
                break;
            case MessageType.SETTINGS_UPDATED:
                this.handleSettingsUpdated(message);
                break;
            case MessageType.ERROR:
                this.onError?.(message.error);
                break;
            case MessageType.KICKED:
                this.onError?.(message.reason || 'Tu as été exclu');
                this.destroy();
                break;
            case MessageType.SECOND_CHANCE_PROMPT:
                this.pendingSecondChance = true;
                this.notifyStateChange();
                break;
        }

        this.onMessage?.(message);
    }

    handleGameState(message) {
        this.players = message.players.map(p => Player.deserialize(p));
        this.gamePhase = message.gamePhase;
        this.targetScore = message.targetScore;
        this.roomCode = message.roomCode;
        this.roundNumber = message.roundNumber || 0;
        this.currentPlayerId = message.currentPlayerId;
        this.deckCount = message.deckCount || 94;

        if (this.peer) {
            this.localPlayer = this.players.find(p => p.id === this.peer.id);
        }

        this.notifyStateChange();
    }

    handlePlayerJoined(message) {
        const player = Player.deserialize(message.player);
        this.players.push(player);
        this.notifyStateChange();
    }

    handlePlayerLeft(message) {
        this.players = this.players.filter(p => p.id !== message.playerId);
        this.notifyStateChange();
    }

    handleGameStarting(message) {
        this.gamePhase = GamePhase.PLAYING;
        this.targetScore = message.targetScore;

        // Reset tous les scores des joueurs pour la nouvelle partie
        for (const player of this.players) {
            player.score = 0;
            player.roundScore = 0;
        }

        this.notifyStateChange();
    }

    handleRoundStart(message) {
        this.roundNumber = message.roundNumber;
        this.currentPlayerId = message.currentPlayerId;
        this.gamePhase = GamePhase.PLAYING;

        // Reset les joueurs pour le nouveau round
        for (const player of this.players) {
            player.resetForRound();
        }

        // Distribue les cartes
        for (const dealt of message.dealtCards) {
            const player = this.players.find(p => p.id === dealt.playerId);
            if (player) {
                player.addCard(Card.deserialize(dealt.card));
            }
        }

        this.notifyStateChange();
    }

    handlePlayerHit(message) {
        const card = Card.deserialize(message.card);
        const player = this.players.find(p => p.id === message.playerId);

        if (player) {
            player.addCard(card);
        }

        // Action immédiate pour le joueur local
        if (message.playerId === this.localPlayer?.id && card.type === 'action') {
            console.log('Action card drawn:', card);
            if (card.subType === 'freeze' || card.subType === 'flip-three' || card.subType === 'stop') {
                console.log('Triggering immediate action:', card.subType);
                this.onImmediateAction?.(card);
            }
        }

        this.notifyStateChange();
    }

    handlePlayerStayed(message) {
        const player = this.players.find(p => p.id === message.playerId);
        if (player) {
            player.status = 'stayed';
        }
        this.notifyStateChange();
    }

    handlePlayerBusted(message) {
        const player = this.players.find(p => p.id === message.playerId);
        if (player) {
            player.status = 'busted';
        }
        this.pendingSecondChance = false;
        this.notifyStateChange();
    }

    handleActionPlayed(message) {
        // Animation
        this.onAnimation?.(message.actionType, message);

        // Met à jour les joueurs selon les effets
        for (const effect of message.effects || []) {
            const target = this.players.find(p => p.id === effect.targetId);
            if (target) {
                if (effect.type === 'freeze') {
                    target.status = 'frozen';
                } else if (effect.type === 'stop') {
                    target.status = 'stayed';
                } else if (effect.type === 'flip-three-card' && effect.card) {
                    target.addCard(Card.deserialize(effect.card));
                } else if (effect.type === 'flip-three-bust') {
                    target.addCard(Card.deserialize(effect.card));
                    target.status = 'busted';
                } else if (effect.type === 'flip-three-action' && effect.card) {
                    target.addCard(Card.deserialize(effect.card));
                }
            }
        }
        this.notifyStateChange();
    }

    handleFlip7(message) {
        // Animation / notification
        this.notifyStateChange();
    }

    handleRoundEnd(message) {
        this.gamePhase = GamePhase.ROUND_END;
        this.players = message.players.map(p => Player.deserialize(p));

        if (this.peer) {
            this.localPlayer = this.players.find(p => p.id === this.peer.id);
        }

        this.notifyStateChange();
    }

    handleGameEnd(message) {
        this.gamePhase = GamePhase.GAME_END;
        this.players = message.players.map(p => Player.deserialize(p));
        this.notifyStateChange();
    }

    handleTurnChange(message) {
        this.currentPlayerId = message.currentPlayerId;
        this.deckCount = message.deckCount;
        this.notifyStateChange();
    }

    handleSettingsUpdated(message) {
        this.targetScore = message.targetScore;
        this.notifyStateChange();
    }

    /**
     * Actions du joueur
     */
    hit() {
        this.connection?.send(createMessage(MessageType.ACTION_HIT));
    }

    stay() {
        this.connection?.send(createMessage(MessageType.ACTION_STAY));
    }

    useSecondChance() {
        this.pendingSecondChance = false;
        this.connection?.send(createMessage(MessageType.USE_SECOND_CHANCE));
    }

    declineSecondChance() {
        this.pendingSecondChance = false;
        this.connection?.send(createMessage(MessageType.DECLINE_SECOND_CHANCE));
    }

    playActionCard(actionType, targetId) {
        this.connection?.send(createMessage(MessageType.PLAY_ACTION_CARD, {
            actionType,
            targetId
        }));
    }

    updateProfile(name, avatar) {
        this.connection?.send(createMessage(MessageType.UPDATE_PROFILE, {
            name,
            avatar
        }));
    }

    /**
     * Vérifie si c'est le tour du joueur local
     */
    isMyTurn() {
        return this.localPlayer && this.currentPlayerId === this.localPlayer.id;
    }

    /**
     * Notifie le changement d'état
     */
    notifyStateChange() {
        this.onStateChange?.({
            players: this.players,
            localPlayer: this.localPlayer,
            gamePhase: this.gamePhase,
            roundNumber: this.roundNumber,
            currentPlayerId: this.currentPlayerId,
            targetScore: this.targetScore,
            roomCode: this.roomCode,
            deckCount: this.deckCount,
            isHost: false,
            pendingSecondChance: this.pendingSecondChance
        });
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
    }
}
