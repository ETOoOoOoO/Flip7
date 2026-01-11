/**
 * Lobby UI - Interface du lobby Flip7
 */

import { renderAvatarSelector, getRandomAvatar } from './avatars.js';

export class LobbyUI {
    constructor(options) {
        this.onStartGame = options.onStartGame;
        this.onLeave = options.onLeave;
        this.onProfileUpdate = options.onProfileUpdate;
        this.onTargetScoreChange = options.onTargetScoreChange;
        this.onCopyCode = options.onCopyCode;

        this.selectedAvatar = getRandomAvatar();
        this.playerName = '';
        this.isHost = false;

        this.bindElements();
        this.bindEvents();
    }

    bindElements() {
        this.screenLobby = document.getElementById('screen-lobby');
        this.roomCodeEl = document.getElementById('room-code');
        this.playerNameInput = document.getElementById('input-player-name');
        this.avatarsGrid = document.getElementById('avatars-grid');
        this.playersList = document.getElementById('players-list');
        this.playerCountEl = document.getElementById('player-count');
        this.hostSettings = document.getElementById('host-settings');
        this.targetScoreInput = document.getElementById('input-target-score');
        this.btnStartGame = document.getElementById('btn-start-game');
        this.btnLeaveLobby = document.getElementById('btn-leave-lobby');
        this.btnCopyCode = document.getElementById('btn-copy-code');
        this.waitingMessage = document.getElementById('waiting-message');
    }

    bindEvents() {
        this.btnLeaveLobby?.addEventListener('click', () => this.onLeave?.());

        this.btnStartGame?.addEventListener('click', () => this.onStartGame?.());

        this.btnCopyCode?.addEventListener('click', () => {
            const code = this.roomCodeEl?.textContent;
            if (code) {
                navigator.clipboard.writeText(code);
                this.onCopyCode?.(code);
            }
        });

        this.playerNameInput?.addEventListener('input', (e) => {
            this.playerName = e.target.value;
            this.onProfileUpdate?.(this.playerName, this.selectedAvatar);
        });

        this.targetScoreInput?.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 200;
            this.onTargetScoreChange?.(value);
        });
    }

    /**
     * Initialise le lobby
     */
    init(roomCode, isHost) {
        this.isHost = isHost;
        this.roomCodeEl.textContent = roomCode;

        // Configure le sélecteur d'avatar
        renderAvatarSelector('avatars-grid', this.selectedAvatar, (avatar) => {
            this.selectedAvatar = avatar;
            this.onProfileUpdate?.(this.playerName, this.selectedAvatar);
        });

        // Affiche/masque les contrôles hôte
        if (isHost) {
            this.hostSettings?.classList.remove('hidden');
            this.btnStartGame?.classList.remove('hidden');
            this.waitingMessage?.classList.add('hidden');
        } else {
            this.hostSettings?.classList.add('hidden');
            this.btnStartGame?.classList.add('hidden');
            this.waitingMessage?.classList.remove('hidden');
        }
    }

    /**
     * Met à jour la liste des joueurs
     */
    updatePlayersList(players, localPlayerId) {
        if (!this.playersList) return;

        this.playersList.innerHTML = players.map(player => {
            const isYou = player.id === localPlayerId;
            const classes = ['player-item'];
            if (player.isHost) classes.push('is-host');
            if (isYou) classes.push('is-you');

            return `
                <li class="${classes.join(' ')}">
                    <span class="player-avatar">${player.avatar}</span>
                    <span class="player-name">${player.name || 'Joueur'}</span>
                    ${player.isHost ? '<span class="player-badge badge-host">Hôte</span>' : ''}
                    ${isYou ? '<span class="player-badge badge-you">Toi</span>' : ''}
                </li>
            `;
        }).join('');

        this.playerCountEl.textContent = `(${players.length}/10)`;

        // Active/désactive le bouton de démarrage
        if (this.isHost && this.btnStartGame) {
            const canStart = players.length >= 3;
            this.btnStartGame.disabled = !canStart;
            if (!canStart) {
                this.btnStartGame.title = 'Il faut au moins 3 joueurs';
            } else {
                this.btnStartGame.title = '';
            }
        }
    }

    /**
     * Obtient l'avatar sélectionné
     */
    getSelectedAvatar() {
        return this.selectedAvatar;
    }

    /**
     * Obtient le nom du joueur
     */
    getPlayerName() {
        return this.playerName || this.playerNameInput?.value || 'Joueur';
    }

    /**
     * Définit le nom du joueur
     */
    setPlayerName(name) {
        this.playerName = name;
        if (this.playerNameInput) {
            this.playerNameInput.value = name;
        }
    }
}
