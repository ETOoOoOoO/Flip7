/**
 * Avatars - Gestion des avatars pour Flip7
 */

export const AVATARS = [
    '🐱', '🐶', '🦊', '🐻', '🐼', '🐨',
    '🦁', '🐯', '🐮', '🐷', '🐸', '🐵',
    '🦄', '🐲', '🦋', '🐙', '🦀', '🐬'
];

/**
 * Obtient un avatar aléatoire
 */
export function getRandomAvatar() {
    return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

/**
 * Génère le HTML pour le sélecteur d'avatars
 */
export function renderAvatarSelector(containerId, selectedAvatar, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = AVATARS.map(avatar => `
        <button 
            class="avatar-option ${avatar === selectedAvatar ? 'selected' : ''}" 
            data-avatar="${avatar}"
            type="button"
        >
            ${avatar}
        </button>
    `).join('');

    container.querySelectorAll('.avatar-option').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            onSelect?.(btn.dataset.avatar);
        });
    });
}
