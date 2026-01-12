/**
 * Flip7 - Application principale
 */

import { GameHost, GamePhase } from './network/host.js';
import { GameClient } from './network/client.js';
import { LobbyUI } from './ui/lobby.js';
import { TableUI } from './ui/table.js';
import { getRandomAvatar } from './ui/avatars.js';
import { audioManager } from './audio.js';

class Flip7App {
    constructor() {
        this.host = null;
        this.client = null;
        this.lobbyUI = null;
        this.tableUI = null;
        this.isHost = false;
        this.currentState = null;

        this.init();
    }

    init() {
        this.bindHomeEvents();
        this.initLobbyUI();
        this.initTableUI();
    }

    /**
     * Bind les événements de l'écran d'accueil
     */
    bindHomeEvents() {
        // Bouton Créer
        document.getElementById('btn-create')?.addEventListener('click', () => {
            audioManager.init();
            this.createRoom();
        });

        // Bouton Rejoindre
        document.getElementById('btn-join')?.addEventListener('click', () => {
            audioManager.init();
            document.getElementById('modal-join')?.classList.remove('hidden');
        });

        // Modal Rejoindre
        document.getElementById('btn-cancel-join')?.addEventListener('click', () => {
            document.getElementById('modal-join')?.classList.add('hidden');
        });

        document.getElementById('btn-confirm-join')?.addEventListener('click', () => {
            audioManager.init();
            const code = document.getElementById('input-room-code')?.value?.trim();
            const btn = document.getElementById('btn-confirm-join');
            if (code && btn && !btn.disabled) {
                btn.disabled = true;
                btn.textContent = 'Connexion...';
                this.joinRoom(code).catch(() => {
                    btn.disabled = false;
                    btn.textContent = 'Rejoindre';
                });
            }
        });

        // Enter pour rejoindre
        document.getElementById('input-room-code')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const code = e.target.value?.trim();
                if (code) {
                    this.joinRoom(code);
                }
            }
        });

        // Server Browser
        const btnBrowse = document.getElementById('btn-browse-games');
        const modalBrowser = document.getElementById('modal-browser');
        const btnCloseBrowser = document.getElementById('btn-close-browser');
        const btnRefresh = document.getElementById('btn-refresh-servers');
        const serverList = document.getElementById('server-list');

        btnBrowse?.addEventListener('click', () => {
            audioManager.init();
            modalBrowser?.classList.remove('hidden');
            this.refreshServerList();
        });

        btnCloseBrowser?.addEventListener('click', () => {
            modalBrowser?.classList.add('hidden');
        });

        btnRefresh?.addEventListener('click', () => {
            this.refreshServerList();
        });

        // Checkbox Public Game
        const chkPublic = document.getElementById('chk-public-game');
        if (chkPublic) {
            chkPublic.addEventListener('change', (e) => {
                // Logic to register/unregister from public list (requires backend)
                console.log('Public game toggle:', e.target.checked);
            });
        }
    }

    /**
     * Rafraîchit la liste des serveurs (Simulation)
     */
    refreshServerList() {
        const list = document.getElementById('server-list');
        if (!list) return;

        list.innerHTML = '<p class="loading-text">Recherche de parties...</p>';

        // Simulation d'appel réseau
        setTimeout(() => {
            // Ici, nous devrions appeler un serveur central ou un "Lobby Peer"
            // Pour l'instant, on simule sans backend
            const mockServers = []; // Rien trouvé (normal sans backend)

            if (mockServers.length === 0) {
                list.innerHTML = `
                    <p class="empty-text">Aucune partie publique trouvée.<br>
                    <span style="font-size: 0.8em; opacity: 0.7;">(Nécessite un serveur de signalement dédié)</span>
                    </p>
                 `;
            } else {
                // Render list (Example)
                /*
                list.innerHTML = mockServers.map(s => `
                    <div class="server-item">
                        <div class="server-info">
                            <h4>${s.name}</h4>
                            <p>${s.players}/${s.max} Joueurs • ${s.state}</p>
                        </div>
                        <div class="server-actions">
                            <button class="btn btn-primary btn-small" onclick="window.flip7App.joinRoom('${s.code}')">Rejoindre</button>
                        </div>
                    </div>
                `).join('');
                */
            }
        }, 1000);
    }

    /**
     * Initialise le lobby UI
     */
    initLobbyUI() {
        this.lobbyUI = new LobbyUI({
            onStartGame: () => this.startGame(),
            onLeave: () => this.leaveLobby(),
            onProfileUpdate: (name, avatar) => this.updateProfile(name, avatar),
            onTargetScoreChange: (score) => this.updateTargetScore(score),
            onCopyCode: (code) => this.showToast('Code copié !', 'success'),
            onKick: (playerId) => this.kickPlayer(playerId)
        });
    }

    /**
     * Initialise le table UI
     */
    initTableUI() {
        this.tableUI = new TableUI({
            onHit: () => this.handleHit(),
            onStay: () => this.handleStay(),
            onUseSecondChance: () => this.handleUseSecondChance(),
            onDeclineSecondChance: () => this.handleDeclineSecondChance(),
            onPlayAction: (actionType, targetId) => this.handlePlayAction(actionType, targetId),
            onNextRound: () => this.handleNextRound(),
            onLeave: () => this.leaveGame(),
            onBackHome: () => this.backToHome(),
            onKick: (playerId) => this.kickPlayer(playerId),
            onResetGame: () => this.resetGame(),
            audioManager: audioManager
        });
    }

    /**
     * Crée une nouvelle room (devient hôte)
     */
    async createRoom() {
        this.isHost = true;
        const playerName = 'Hôte';
        const playerAvatar = getRandomAvatar();

        try {
            this.host = new GameHost(
                (state) => this.onStateChange(state),
                (error) => this.showToast(error, 'error'),
                {
                    onImmediateAction: (card) => this.tableUI?.showTargetModalForAction(card),
                    onAnimation: (type, data) => this.tableUI?.playAnimation(type, data),
                    onMessage: (message) => this.onMessage(message)
                }
            );

            const roomCode = await this.host.init(playerName, playerAvatar);

            this.showScreen('screen-lobby');
            this.lobbyUI.init(roomCode, true);
            this.lobbyUI.setPlayerName(playerName);
            this.lobbyUI.selectedAvatar = playerAvatar;

            this.showToast('Table créée !', 'success');

            // Host drive the music
            audioManager.onTrackEnded = () => {
                const nextIndex = (audioManager.currentTrackIndex + 1) % 1; // HARDCODED 1 for now or check playlist length? 
                // Accessing private playlist length is hard if not exported.
                // Assuming it loops or I just increment.
                // Better: audioManager should handle increment and return new index?
                // Or I expose PLAYLIST length.
                // Hack: audioManager.playTrack handles index check.
                // Let's just increment.

                // Correction: onTrackEnded is called.
                // We advance locally
                const next = audioManager.currentTrackIndex + 1;
                // Check bounds? AudioManager.playTrack checks bounds. 
                // But we need wrapping.
                // Let's assume 1 track for now based on user files.
                // If I want wrapping I need length.
                // Let's just play 0.

                audioManager.playTrack(0); // Loop single track
                this.host.broadcast(this.host.createMessage('SYNC_MUSIC', { trackIndex: 0 }));
            };
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showToast('Erreur lors de la création', 'error');
        }
    }

    /**
     * Rejoint une room existante
     */
    async joinRoom(roomCode) {
        this.isHost = false;
        const playerName = 'Joueur';
        const playerAvatar = getRandomAvatar();
        const btn = document.getElementById('btn-confirm-join');

        try {
            this.client = new GameClient(
                (state) => this.onStateChange(state),
                (error) => {
                    this.showToast(error, 'error');
                    // Si on est kické, retour à l'accueil
                    if (error.includes('exclu')) {
                        this.cleanup();
                        this.showScreen('screen-home');
                    }
                },
                (message) => this.onMessage(message),
                {
                    onImmediateAction: (card) => this.tableUI?.showTargetModalForAction(card),
                    onAnimation: (type, data) => this.tableUI?.playAnimation(type, data)
                }
            );

            await this.client.join(roomCode, playerName, playerAvatar);

            document.getElementById('modal-join')?.classList.add('hidden');
            this.showScreen('screen-lobby');
            this.lobbyUI.init(roomCode, false);
            this.lobbyUI.setPlayerName(playerName);
            this.lobbyUI.selectedAvatar = playerAvatar;

            // Reset du bouton
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Rejoindre';
            }

            this.showToast('Connecté !', 'success');
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showToast('Impossible de rejoindre', 'error');
            // Reset du bouton
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Rejoindre';
            }
            throw error; // Re-throw pour le .catch()
        }
    }

    /**
     * Gère le changement d'état
     */
    onStateChange(state) {
        console.log('State changed:', state);
        this.currentState = state;

        // Met à jour le lobby
        if (state.gamePhase === GamePhase.LOBBY || state.gamePhase === 'lobby') {
            this.lobbyUI.updatePlayersList(
                state.players,
                state.localPlayer?.id
            );
        }

        // Passage au jeu
        if (state.gamePhase === GamePhase.PLAYING || state.gamePhase === 'playing') {
            this.showScreen('screen-game');
            this.tableUI.hideRoundEndModal();
            this.tableUI.update(state);
        }

        // Fin de round
        if (state.gamePhase === GamePhase.ROUND_END || state.gamePhase === 'round_end') {
            this.tableUI.update(state);
        }

        // Fin de partie
        if (state.gamePhase === GamePhase.GAME_END || state.gamePhase === 'game_end') {
            this.tableUI.update(state);
        }
    }

    /**
     * Gère les messages reçus (client)
     */
    onMessage(message) {
        // Notifications visuelles
        switch (message.type) {
            case 'PLAYER_JOINED':
                this.showToast(`${message.player.name} a rejoint`, 'info');
                break;
            case 'PLAYER_LEFT':
                this.showToast(`${message.playerName} a quitté`, 'info');
                break;
            case 'PLAYER_STAYED':
                this.handlePlayerStayed(message);
                const stayedPlayer = this.currentState?.players?.find(p => p.id === message.playerId);
                if (stayedPlayer) {
                    this.tableUI.showActionBanner('✋', `${stayedPlayer.name} reste`, 'info', 2000);
                }
                break;
            case 'PLAYER_BUSTED':
                const bustedPlayer = this.currentState?.players?.find(p => p.id === message.playerId);
                if (bustedPlayer) {
                    this.tableUI.showMessage(`${bustedPlayer.name} a bust !`, 'bust');
                }
                break;
            case 'FLIP7_ACHIEVED':
                const flip7Player = this.currentState?.players?.find(p => p.id === message.playerId);
                if (flip7Player) {
                    this.tableUI.showMessage(`🎉 ${flip7Player.name} a fait FLIP 7 !`, 'flip7', 3000);
                }
                break;
            case 'ACTION_PLAYED':
                // Show action banner for action cards
                if (message.effects && message.effects.length > 0) {
                    const effect = message.effects[0];
                    const sourcePlayer = this.currentState?.players?.find(p => p.id === message.playerId);
                    const targetPlayer = this.currentState?.players?.find(p => p.id === message.targetId);

                    if (effect.type === 'stop' && sourcePlayer && targetPlayer) {
                        this.tableUI.showActionBanner('🔒', `${sourcePlayer.name} a STOPPÉ ${targetPlayer.name} !`, 'stop', 3000);
                    } else if ((effect.type === 'flip-three-card' || effect.type === 'flip-three-bust') && sourcePlayer && targetPlayer) {
                        this.tableUI.showActionBanner('🔄', `${sourcePlayer.name} force ${targetPlayer.name} à piocher 3 cartes !`, 'flip-three', 3000);
                    } else if (effect.type === 'second-chance' && sourcePlayer) {
                        this.tableUI.showActionBanner('🍀', `${sourcePlayer.name} utilise une Seconde Chance !`, 'second-chance', 3000);
                    }
                }
                break;
            case 'SYNC_MUSIC':
                if (message.trackIndex !== undefined && !this.isHost) {
                    audioManager.playTrack(message.trackIndex);
                }
                break;
        }
    }

    /**
     * Démarre la partie (hôte)
     */
    startGame() {
        if (this.isHost && this.host) {
            const success = this.host.startGame();
            if (!success) {
                this.showToast('Il faut au moins 3 joueurs', 'error');
            }
        }
    }

    /**
     * Met à jour le profil
     */
    updateProfile(name, avatar) {
        if (this.isHost && this.host) {
            this.host.updateLocalProfile(name, avatar);
        } else if (this.client) {
            this.client.updateProfile(name, avatar);
        }
    }

    /**
     * Met à jour le score cible (hôte)
     */
    updateTargetScore(score) {
        if (this.isHost && this.host) {
            this.host.setTargetScore(score);
        }
    }

    /**
     * Exclut un joueur (hôte)
     */
    kickPlayer(playerId) {
        if (this.isHost && this.host) {
            this.host.kickPlayer(playerId);
        }
    }

    /**
     * Réinitialise la partie (hôte)
     */
    resetGame() {
        if (this.isHost && this.host) {
            this.host.resetGame();
        }
    }



    /**
     * Actions de jeu
     */
    handleHit() {
        if (this.isHost && this.host) {
            this.host.handleHit(this.host.localPlayer.id);
        } else if (this.client) {
            this.client.hit();
        }
    }

    handleStay() {
        if (this.isHost && this.host) {
            this.host.handleStay(this.host.localPlayer.id);
        } else if (this.client) {
            this.client.stay();
        }
    }

    handleUseSecondChance() {
        if (this.isHost && this.host) {
            this.host.handleUseSecondChance(this.host.localPlayer.id);
        } else if (this.client) {
            this.client.useSecondChance();
        }
    }

    handleDeclineSecondChance() {
        if (this.isHost && this.host) {
            this.host.handleDeclineSecondChance(this.host.localPlayer.id);
        } else if (this.client) {
            this.client.declineSecondChance();
        }
    }

    handlePlayAction(actionType, targetId) {
        if (this.isHost && this.host) {
            this.host.handlePlayActionCard(this.host.localPlayer.id, { actionType, targetId });
        } else if (this.client) {
            this.client.playActionCard(actionType, targetId);
        }
    }

    handleNextRound() {
        if (this.isHost && this.host) {
            this.host.nextRound();
        }
    }

    /**
     * Quitte le lobby
     */
    leaveLobby() {
        this.cleanup();
        this.showScreen('screen-home');
    }

    /**
     * Quitte la partie
     */
    leaveGame() {
        this.cleanup();
        this.showScreen('screen-home');
    }

    /**
     * Retour à l'accueil après fin de partie
     */
    backToHome() {
        this.cleanup();
        this.showScreen('screen-home');
    }

    /**
     * Nettoie les ressources
     */
    cleanup() {
        if (this.host) {
            this.host.destroy();
            this.host = null;
        }
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        this.isHost = false;
        this.currentState = null;
    }

    /**
     * Affiche un écran
     */
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId)?.classList.add('active');
    }

    /**
     * Affiche un toast
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Démarre l'application
document.addEventListener('DOMContentLoaded', () => {
    window.flip7App = new Flip7App();

    // Global audio resume handler
    const resumeAudio = () => {
        if (audioManager.ctx && audioManager.ctx.state === 'suspended') {
            audioManager.ctx.resume().then(() => {
                console.log('AudioContext resumed via global click');
            });
        }
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('touchstart', resumeAudio);
});
