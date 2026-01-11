/**
 * Messages - Types de messages P2P pour Flip7
 */

export const MessageType = {
    // Host -> Clients
    GAME_STATE: 'GAME_STATE',
    PLAYER_JOINED: 'PLAYER_JOINED',
    PLAYER_LEFT: 'PLAYER_LEFT',
    GAME_STARTING: 'GAME_STARTING',
    ROUND_START: 'ROUND_START',
    CARD_DEALT: 'CARD_DEALT',
    PLAYER_HIT: 'PLAYER_HIT',
    PLAYER_STAYED: 'PLAYER_STAYED',
    PLAYER_BUSTED: 'PLAYER_BUSTED',
    ACTION_PLAYED: 'ACTION_PLAYED',
    FLIP7_ACHIEVED: 'FLIP7_ACHIEVED',
    ROUND_END: 'ROUND_END',
    GAME_END: 'GAME_END',
    TURN_CHANGE: 'TURN_CHANGE',
    SETTINGS_UPDATED: 'SETTINGS_UPDATED',
    ERROR: 'ERROR',
    SECOND_CHANCE_PROMPT: 'SECOND_CHANCE_PROMPT',

    // Clients -> Host
    JOIN: 'JOIN',
    UPDATE_PROFILE: 'UPDATE_PROFILE',
    ACTION_HIT: 'ACTION_HIT',
    ACTION_STAY: 'ACTION_STAY',
    USE_SECOND_CHANCE: 'USE_SECOND_CHANCE',
    DECLINE_SECOND_CHANCE: 'DECLINE_SECOND_CHANCE',
    PLAY_ACTION_CARD: 'PLAY_ACTION_CARD',
    REQUEST_NEXT_ROUND: 'REQUEST_NEXT_ROUND'
};

/**
 * Crée un message formaté
 */
export function createMessage(type, data = {}) {
    return {
        type,
        timestamp: Date.now(),
        ...data
    };
}
