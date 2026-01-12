/**
 * Table UI - Interface de la table de jeu Flip7
 */

import { createCardElement, animateBust, animateFlip } from './cards-ui.js';
import { Card, ActionType } from '../game/card.js';
import { PlayerStatus } from '../game/player.js';

export class TableUI {
    constructor(options) {
        this.onHit = options.onHit;
        this.onStay = options.onStay;
        this.onUseSecondChance = options.onUseSecondChance;
        this.onDeclineSecondChance = options.onDeclineSecondChance;
        this.onPlayAction = options.onPlayAction;
        this.onNextRound = options.onNextRound;
        this.onLeave = options.onLeave;
        this.onBackHome = options.onBackHome;
        this.onKick = options.onKick;
        this.onResetGame = options.onResetGame;

        this.bindElements();
        this.bindEvents();
    }

    bindElements() {
        this.screenGame = document.getElementById('screen-game');
        this.roundNumberEl = document.getElementById('round-number');
        this.targetScoreEl = document.getElementById('target-score');
        this.deckCountEl = document.getElementById('deck-count');
        this.playersAround = document.getElementById('players-around');
        this.localAvatar = document.getElementById('local-avatar');
        this.localName = document.getElementById('local-name');
        this.localScore = document.getElementById('local-score');
        this.localCards = document.getElementById('local-cards');
        this.actionButtons = document.getElementById('action-buttons');
        this.btnHit = document.getElementById('btn-hit');
        this.btnStay = document.getElementById('btn-stay');
        this.gameMessage = document.getElementById('game-message');
        this.gameMessageText = document.getElementById('game-message-text');
        this.currentCardZone = document.getElementById('current-card-zone');

        // Modals
        this.modalRoundEnd = document.getElementById('modal-round-end');
        this.roundEndTitle = document.getElementById('round-end-title');
        this.roundScores = document.getElementById('round-scores');
        this.btnNextRound = document.getElementById('btn-next-round');
        this.waitingNextRound = document.getElementById('waiting-next-round');

        this.modalGameEnd = document.getElementById('modal-game-end');
        this.winnerDisplay = document.getElementById('winner-display');
        this.finalScores = document.getElementById('final-scores');
        this.btnBackHome = document.getElementById('btn-back-home');
        this.btnPlayAgain = document.getElementById('btn-play-again');

        this.modalTarget = document.getElementById('modal-target');
        this.targetPlayers = document.getElementById('target-players');
        this.btnCancelTarget = document.getElementById('btn-cancel-target');

        // Admin Elements
        this.btnAdmin = document.getElementById('btn-admin');
        this.modalAdmin = document.getElementById('modal-admin');
        this.btnResetGame = document.getElementById('btn-reset-game');
        this.adminPlayersList = document.getElementById('admin-players-list');
        this.btnCloseAdmin = document.getElementById('btn-close-admin');

        // Action Banner
        this.actionBanner = document.getElementById('action-banner');
        this.bannerIcon = this.actionBanner?.querySelector('.banner-icon');
        this.bannerText = this.actionBanner?.querySelector('.banner-text');
    }

    bindEvents() {
        this.btnHit?.addEventListener('click', () => this.onHit?.());
        this.btnStay?.addEventListener('click', () => this.onStay?.());
        this.btnNextRound?.addEventListener('click', () => this.onNextRound?.());
        this.btnBackHome?.addEventListener('click', () => this.onBackHome?.());
        this.btnCancelTarget?.addEventListener('click', () => this.hideTargetModal());

        // Admin Events
        this.btnAdmin?.addEventListener('click', () => this.showAdminModal());
        this.btnCloseAdmin?.addEventListener('click', () => this.hideAdminModal());
        this.btnResetGame?.addEventListener('click', () => {
            if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser la partie ? Tous les scores seront perdus.')) {
                this.onResetGame?.();
                this.hideAdminModal();
            }
        });

        this.btnPlayAgain?.addEventListener('click', () => {
            if (confirm('Rejouer une partie avec les mêmes joueurs ?')) {
                this.onResetGame?.();
                this.modalGameEnd?.classList.add('hidden');
            }
        });

        // Cliquer sur le deck pour piocher
        const deck = document.getElementById('deck');
        deck?.addEventListener('click', () => {
            if (this.btnHit && !this.btnHit.disabled) {
                this.onHit?.();
            }
        });

        document.getElementById('btn-leave-game')?.addEventListener('click', () => {
            if (confirm('Quitter la partie ?')) {
                this.onLeave?.();
            }
        });
    }

    /**
     * Met à jour l'affichage complet de la table
     */
    update(state) {
        const { players, localPlayer, roundNumber, targetScore, currentPlayerId, deckCount, isHost } = state;

        // Store state for action card handlers
        this.currentPlayers = players;
        this.currentLocalPlayerId = localPlayer?.id;
        this.isHost = isHost; // Store host status

        // Show/Hide Admin Button
        if (this.btnAdmin) {
            if (isHost) {
                this.btnAdmin.classList.remove('hidden');
            } else {
                this.btnAdmin.classList.add('hidden');
            }
        }

        // Header info
        if (this.roundNumberEl) this.roundNumberEl.textContent = roundNumber || 1;
        if (this.targetScoreEl) this.targetScoreEl.textContent = targetScore || 200;
        if (this.deckCountEl) this.deckCountEl.textContent = deckCount || 0;

        // Deck glow when it's our turn
        const deck = document.getElementById('deck');
        const isMyTurn = localPlayer?.id === currentPlayerId &&
            (localPlayer?.status === 'active' || localPlayer?.status === 'ACTIVE');
        deck?.classList.toggle('active', isMyTurn && !state.pendingSecondChance);

        // Joueur local
        this.updateLocalPlayer(localPlayer);

        // Autres joueurs autour de la table
        this.updatePlayersAround(players, localPlayer?.id, currentPlayerId);

        // Boutons d'action
        this.updateActionButtons(localPlayer, currentPlayerId, state.pendingSecondChance);

        // Modals - cacher les modals quand on joue
        if (state.gamePhase === 'playing') {
            this.hideRoundEndModal();
            this.modalGameEnd?.classList.add('hidden');
        }

        if (state.gamePhase === 'round_end') {
            this.showRoundEndModal(players, isHost);
        }

        if (state.gamePhase === 'game_end') {
            this.showGameEndModal(players);
        }
    }

    /**
     * Met à jour le joueur local
     */
    updateLocalPlayer(player) {
        if (!player) return;

        if (this.localAvatar) this.localAvatar.textContent = player.avatar;
        if (this.localName) this.localName.textContent = player.name;
        if (this.localScore) this.localScore.textContent = player.score;

        // Cartes du joueur
        if (this.localCards) {
            this.localCards.innerHTML = '';
            for (const card of player.cards) {
                const cardData = card.serialize ? card : card;
                const cardObj = card.serialize ? card : Card.deserialize(cardData);
                const cardEl = createCardElement(cardObj, { large: true });

                // Cartes action ne sont plus cliquables (automatiques)
                if (cardObj.isAction() && cardObj.subType !== ActionType.SECOND_CHANCE) {
                    // Pas de listener, usage immédiat à la pioche
                }

                this.localCards.appendChild(cardEl);
            }
        }
    }

    /**
     * Met à jour les joueurs autour de la table
     */
    updatePlayersAround(players, localPlayerId, currentPlayerId) {
        if (!this.playersAround) return;

        const otherPlayers = players.filter(p => p.id !== localPlayerId);
        const positions = this.calculatePositions(otherPlayers.length);

        this.playersAround.innerHTML = otherPlayers.map((player, index) => {
            const pos = positions[index];
            const isCurrent = player.id === currentPlayerId;
            const classes = ['player-seat'];

            if (isCurrent) classes.push('is-current');
            if (player.status === PlayerStatus.STAYED || player.status === 'stayed') {
                classes.push('is-stayed');
            }
            if (player.status === PlayerStatus.BUSTED || player.status === 'busted') {
                classes.push('is-busted');
            }
            if (player.status === PlayerStatus.FROZEN || player.status === 'frozen') {
                classes.push('is-frozen');
            }

            const cards = player.cards || [];
            const cardsHtml = cards.map(card => {
                const cardData = card.serialize ? card.serialize() : card;
                return `
                    <div class="card small card-${cardData.type}" data-value="${cardData.value || ''}" data-type="${cardData.subType || ''}">
                        <div class="card-face card-front">
                            <span class="card-value">${this.getCardDisplay(cardData)}</span>
                        </div>
                        <div class="card-face card-back"></div>
                    </div>
                `;
            }).join('');

            return `
                <div class="${classes.join(' ')}" data-player-id="${player.id}" style="top: ${pos.top}%; left: ${pos.left}%; transform: translate(-50%, -50%);">
                    <div class="player-seat-info">
                        <span class="player-seat-avatar">${player.avatar}</span>
                        <span class="player-seat-name">${player.name}</span>
                        <span class="player-seat-score">${player.score} pts</span>
                    </div>
                    <div class="player-seat-cards">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Calcule les positions des joueurs autour de la table
     */
    calculatePositions(count) {
        const positions = [];
        const startAngle = -90; // Commence en haut
        const angleStep = 180 / (count + 1); // Répartit sur le demi-cercle supérieur

        for (let i = 0; i < count; i++) {
            const angle = startAngle + angleStep * (i + 1);
            const radians = angle * (Math.PI / 180);

            // Ellipse: plus large que haute
            const radiusX = 42;
            const radiusY = 35;

            positions.push({
                left: 50 + radiusX * Math.cos(radians),
                top: 45 + radiusY * Math.sin(radians)
            });
        }

        return positions;
    }

    /**
     * Obtient l'affichage d'une carte
     */
    getCardDisplay(cardData) {
        if (cardData.type === 'number') {
            return cardData.value;
        }
        if (cardData.type === 'modifier') {
            return cardData.subType;
        }
        if (cardData.type === 'action') {
            const icons = {
                'freeze': '❄️',
                'flip-three': '🔄',
                'second-chance': '🍀'
            };
            return icons[cardData.subType] || '?';
        }
        return '?';
    }

    /**
     * Met à jour les boutons d'action
     */
    updateActionButtons(localPlayer, currentPlayerId, pendingSecondChance) {
        if (!localPlayer || !this.actionButtons) return;

        const isMyTurn = localPlayer.id === currentPlayerId;
        // Handle both enum value and string value for status
        const status = localPlayer.status;
        const canPlay = status === 'active' || status === PlayerStatus.ACTIVE;
        const hasCards = localPlayer.cards && localPlayer.cards.length > 0;

        console.log('updateActionButtons', { isMyTurn, canPlay, status, hasCards, pendingSecondChance });

        if (pendingSecondChance) {
            // Affiche les boutons Second Chance
            this.actionButtons.innerHTML = `
                <button id="btn-use-sc" class="btn btn-action" style="background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);">
                    🍀 Utiliser Second Chance
                </button>
                <button id="btn-decline-sc" class="btn btn-action btn-stay">
                    ❌ Refuser (Bust)
                </button>
            `;
            document.getElementById('btn-use-sc')?.addEventListener('click', () => this.onUseSecondChance?.());
            document.getElementById('btn-decline-sc')?.addEventListener('click', () => this.onDeclineSecondChance?.());
            this.btnHit = null;
            this.btnStay = null;
        } else {
            // Toujours recréer les boutons pour éviter les références obsolètes
            const hitDisabled = !isMyTurn || !canPlay;
            const stayDisabled = !isMyTurn || !canPlay || !hasCards;

            this.actionButtons.innerHTML = `
                <button id="btn-hit" class="btn btn-action btn-hit" ${hitDisabled ? 'disabled' : ''}>
                    🎴 Piocher
                </button>
                <button id="btn-stay" class="btn btn-action btn-stay" ${stayDisabled ? 'disabled' : ''}>
                    ✋ Rester
                </button>
            `;
            this.btnHit = document.getElementById('btn-hit');
            this.btnStay = document.getElementById('btn-stay');

            this.btnHit?.addEventListener('click', () => this.onHit?.());
            this.btnStay?.addEventListener('click', () => this.onStay?.());


        }
    }

    /**
     * Affiche un message temporaire
     */
    showMessage(text, type = '', duration = 2000) {
        if (!this.gameMessage || !this.gameMessageText) return;

        // Clear previous timeout
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }

        this.gameMessageText.textContent = text;
        this.gameMessage.className = 'game-message'; // Reset classes
        if (type) {
            this.gameMessage.classList.add(`message-${type}`);
        }
        this.gameMessage.classList.remove('hidden');

        this.messageTimeout = setTimeout(() => {
            this.gameMessage.classList.add('hidden');
            this.messageTimeout = null;
        }, duration);
    }

    /**
     * Affiche le modal de sélection de cible
     */
    showTargetModal(actionCard, players, localPlayerId) {
        if (!this.modalTarget || !this.targetPlayers) return;

        this.pendingActionCard = actionCard;

        // Titre selon le type d'action
        const titleEl = document.getElementById('target-modal-title');
        if (titleEl) {
            if (actionCard.subType === 'freeze') {
                titleEl.textContent = '❄️ Geler un joueur';
            } else if (actionCard.subType === 'flip-three') {
                titleEl.textContent = '🔄 Forcer à piocher 3 cartes';
            } else if (actionCard.subType === 'stop') {
                titleEl.textContent = '🛑 Stop ! (Force à rester)';
            }
        }

        // Génère la liste des joueurs ciblables
        // Pour Flip Three: tous les joueurs actifs (y compris soi-même)
        // Pour Freeze: tous les joueurs actifs sauf soi-même
        const targetablePlayers = players.filter(p => {
            // Check status - peut être string ou enum
            const status = String(p.status).toLowerCase();
            const isActive = status === 'active';

            if (actionCard.subType === 'freeze') {
                return isActive && p.id !== localPlayerId;
            } else {
                // Flip Three peut cibler tout le monde y compris soi-même
                return isActive;
            }
        });

        console.log('Targetable players for', actionCard.subType, ':', targetablePlayers.map(p => p.name));

        this.targetPlayers.innerHTML = targetablePlayers.map(player => `
                <button class="target-player-btn" data-player-id="${player.id}">
                <span class="target-avatar">${player.avatar}</span>
                <span class="target-name">${player.name}${player.id === localPlayerId ? ' (Toi)' : ''}</span>
            </button>
                `).join('');

        // Ajoute les listeners
        this.targetPlayers.querySelectorAll('.target-player-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.playerId;
                this.onPlayAction?.(actionCard.subType, targetId);
                this.hideTargetModal();
            });
        });

        this.modalTarget.classList.remove('hidden');
    }

    /**
     * Cache le modal de sélection de cible
     */
    hideTargetModal() {
        this.modalTarget?.classList.add('hidden');
        this.pendingActionCard = null;
    }

    /**
     * Affiche le modal d'administration
     */
    showAdminModal() {
        this.updateAdminPlayersList();
        this.modalAdmin?.classList.remove('hidden');
    }

    /**
     * Cache le modal d'administration
     */
    hideAdminModal() {
        this.modalAdmin?.classList.add('hidden');
    }

    /**
     * Met à jour la liste des joueurs dans le panneau admin
     */
    updateAdminPlayersList() {
        if (!this.adminPlayersList || !this.currentPlayers) return;

        this.adminPlayersList.innerHTML = this.currentPlayers.map(player => `
                <li class="admin-player-item">
                    <div class="admin-player-info">
                        <span class="player-avatar">${player.avatar}</span>
                        <span class="player-name">${player.name} ${player.id === this.currentLocalPlayerId ? '(Toi)' : ''}</span>
                        <span class="player-score">${player.score} pts</span>
                    </div>
                ${player.id !== this.currentLocalPlayerId ?
                `<button class="btn btn-kick-admin" data-id="${player.id}">EXPULSER</button>` :
                '<span class="text-sm text-muted">Hôte</span>'
            }
            </li>
                `).join('');

        // Listeners for kick buttons
        this.adminPlayersList.querySelectorAll('.btn-kick-admin').forEach(btn => {
            btn.addEventListener('click', () => {
                const playerId = btn.dataset.id;
                const player = this.currentPlayers.find(p => p.id === playerId);
                if (confirm(`Voulez - vous vraiment exclure ${player?.name} ?`)) {
                    this.onKick?.(playerId);
                    // Pas besoin de refresh immédiat, l'update du state le fera
                }
            });
        });
    }

    /**
     * Affiche le modal de cible pour une action immédiate
     */
    showTargetModalForAction(card) {
        if (this.currentPlayers && this.currentLocalPlayerId) {
            this.showTargetModal(card, this.currentPlayers, this.currentLocalPlayerId);
        }
    }

    /**
     * Joue une animation visuelle
     */
    playAnimation(type, data) {
        console.log(`Playing animation: ${type} `, data);

        // Find target element (avatar)
        const getTargetElement = (playerId) => {
            if (playerId === this.currentLocalPlayerId) {
                return document.querySelector('.local-player-info .local-avatar');
            } else {
                // Find seat index
                // Note: players-around logic might rely on index or data attribute
                // Assuming we can find by some data attribute if added, or traversing
                // For now, let's try to find element with data-player-id if we added it, 
                // otherwise we rely on the order stored in this.seatMap (if existed) or re-query
                // otherwise we rely on the order stored in this.seatMap (if existed) or re-query
                const seat = document.querySelector(`.player-seat[data-player-id="${playerId}"]`);
                return seat?.querySelector('.player-seat-avatar');
            }
        };

        if (type === 'freeze') {
            const targetEl = getTargetElement(data.effects[0].targetId);
            if (targetEl) {
                const parent = targetEl.closest('.player-seat') || targetEl.closest('.local-player-info');
                parent?.classList.add('frozen');

                // Add temporary class for effect overlay
                const effectOverlay = document.createElement('div');
                effectOverlay.className = 'frozen-effect';
                targetEl.appendChild(effectOverlay);

                setTimeout(() => {
                    parent?.classList.remove('frozen');
                    effectOverlay.remove();
                }, 3000);
            }
        } else if (type === 'flip-three-card' || type === 'flip-three-bust') {
            // Effect on target
            const targetId = data.effects[0].targetId;
            const targetEl = getTargetElement(targetId);

            if (targetEl) {
                targetEl.classList.add('flip3-target');
                setTimeout(() => targetEl.classList.remove('flip3-target'), 1000);

                // Flying cards animation
                // Source is deck or hitting player? Usually deck for flip3
                const deck = document.getElementById('deck');
                const rectStart = deck.getBoundingClientRect();
                const rectEnd = targetEl.getBoundingClientRect();

                for (let i = 0; i < 3; i++) {
                    const card = document.createElement('div');
                    card.className = 'flying-card';
                    card.style.left = `${rectStart.left} px`;
                    card.style.top = `${rectStart.top} px`;
                    document.body.appendChild(card);

                    setTimeout(() => {
                        card.style.transform = `translate(${rectEnd.left - rectStart.left + (Math.random() * 20 - 10)}px, ${rectEnd.top - rectStart.top + (Math.random() * 20 - 10)}px) rotate(${Math.random() * 360}deg)`;
                        card.style.opacity = '0';
                    }, 50 + i * 150);

                    setTimeout(() => card.remove(), 1000);
                }
            }
        } else if (type === 'stop') {
            const targetEl = getTargetElement(data.effects[0].targetId);
            if (targetEl) {
                const stopSign = document.createElement('div');
                stopSign.textContent = '🛑';
                stopSign.style.position = 'absolute';
                stopSign.style.inset = '0';
                stopSign.style.display = 'flex';
                stopSign.style.alignItems = 'center';
                stopSign.style.justifyContent = 'center';
                stopSign.style.fontSize = '3rem';
                stopSign.style.zIndex = '20';
                stopSign.style.animation = 'pop-in-out 1.5s ease-in-out forwards';
                stopSign.style.pointerEvents = 'none';

                targetEl.appendChild(stopSign);
                setTimeout(() => stopSign.remove(), 1500);
            }
        }
    }

    /**
     * Affiche le modal de fin de round
     */
    showRoundEndModal(players, isHost) {
        if (!this.modalRoundEnd) return;

        const sortedPlayers = [...players].sort((a, b) => b.roundScore - a.roundScore);

        this.roundScores.innerHTML = sortedPlayers.map((player, index) => `
                <div class="round-score-item ${index === 0 && player.roundScore > 0 ? 'is-winner' : ''}">
                <span class="round-score-avatar">${player.avatar}</span>
                <span class="round-score-name">${player.name}</span>
                <span class="round-score-points">+<span>${player.roundScore}</span> pts</span>
                <span class="round-score-total">${player.score} pts</span>
            </div>
                `).join('');

        if (isHost) {
            this.btnNextRound?.classList.remove('hidden');
            this.waitingNextRound?.classList.add('hidden');
        } else {
            this.btnNextRound?.classList.add('hidden');
            this.waitingNextRound?.classList.remove('hidden');
        }

        this.modalRoundEnd.classList.remove('hidden');
    }

    /**
     * Cache le modal de fin de round
     */
    hideRoundEndModal() {
        this.modalRoundEnd?.classList.add('hidden');
    }

    /**
     * Affiche le modal de fin de partie
     */
    showGameEndModal(players) {
        if (!this.modalGameEnd) return;

        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        const winner = sortedPlayers[0];

        this.winnerDisplay.innerHTML = `
                <div class="winner-avatar winner-celebrate">${winner.avatar}</div>
            <div class="winner-name">${winner.name}</div>
            <div class="winner-score">${winner.score} points</div>
            `;

        this.finalScores.innerHTML = sortedPlayers.map((player, index) => `
                <div class="final-score-item">
                <span class="final-score-rank">#${index + 1}</span>
                <span>${player.avatar}</span>
                <span class="final-score-name">${player.name}</span>
                <span class="final-score-points">${player.score} pts</span>
            </div>
                `).join('');



        if (this.isHost) {
            this.btnPlayAgain?.classList.remove('hidden');
        } else {
            this.btnPlayAgain?.classList.add('hidden');
        }

        this.modalRoundEnd?.classList.add('hidden');
        this.modalGameEnd.classList.remove('hidden');
    }

    /**
     * Affiche un bandeau d'action animé
     * @param {string} icon - Emoji/icône à afficher
     * @param {string} text - Texte du message
     * @param {string} type - Type: 'stop', 'flip-three', 'bust', 'flip7'
     * @param {number} duration - Durée d'affichage en ms (défaut: 3000)
     */
    showActionBanner(icon, text, type = 'stop', duration = 3000) {
        if (!this.actionBanner) return;

        // Clear previous timeout
        if (this.bannerTimeout) {
            clearTimeout(this.bannerTimeout);
        }

        // Set content
        if (this.bannerIcon) this.bannerIcon.textContent = icon;
        if (this.bannerText) this.bannerText.textContent = text;

        // Reset classes
        this.actionBanner.className = 'action-banner';
        this.actionBanner.classList.add(type);

        // Force reflow to restart animation
        void this.actionBanner.offsetWidth;

        // Show
        this.actionBanner.classList.add('show');

        // Hide after duration
        this.bannerTimeout = setTimeout(() => {
            this.actionBanner.classList.remove('show');
            this.actionBanner.classList.add('hide');

            // Clean up after hide animation
            setTimeout(() => {
                this.actionBanner.classList.remove('hide');
            }, 500);
        }, duration);
    }

    /**
     * Affiche un message de jeu (wrapper pour compatibilité)
     */
    showMessage(text, type = 'info', duration = 2000) {
        // Map type to banner type
        const typeMap = {
            'bust': 'bust',
            'flip7': 'flip7',
            'action': 'stop',
            'info': 'stop'
        };

        // Get icon based on type
        const iconMap = {
            'bust': '💥',
            'flip7': '🎉',
            'action': '🎴',
            'info': 'ℹ️'
        };

        this.showActionBanner(iconMap[type] || '🎴', text, typeMap[type] || 'stop', duration);
    }

    /**
     * Joue une animation (placeholder pour compatibilité)
     */
    playAnimation(type, data) {
        console.log('Playing animation:', type, data);
        // Animation logic can be extended here
    }
}
