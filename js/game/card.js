/**
 * Card class - Représente une carte du jeu Flip7
 */

export const CardType = {
    NUMBER: 'number',
    MODIFIER: 'modifier',
    ACTION: 'action'
};

export const ActionType = {
    FREEZE: 'freeze',
    FLIP_THREE: 'flip-three',
    SECOND_CHANCE: 'second-chance',
    STOP: 'stop'
};

export const ModifierType = {
    PLUS_5: '+5',
    PLUS_10: '+10',
    TIMES_2: 'x2'
};

export class Card {
    constructor(type, value, subType = null) {
        this.id = crypto.randomUUID();
        this.type = type;
        this.value = value;
        this.subType = subType;
    }

    /**
     * Vérifie si c'est une carte numérique
     */
    isNumber() {
        return this.type === CardType.NUMBER;
    }

    /**
     * Vérifie si c'est un modificateur
     */
    isModifier() {
        return this.type === CardType.MODIFIER;
    }

    /**
     * Vérifie si c'est une carte action
     */
    isAction() {
        return this.type === CardType.ACTION;
    }

    /**
     * Obtient le label d'affichage de la carte
     */
    getDisplayValue() {
        if (this.isNumber()) {
            return this.value.toString();
        }
        if (this.isModifier()) {
            return this.subType;
        }
        if (this.isAction()) {
            switch (this.subType) {
                case ActionType.FREEZE: return '❄️';
                case ActionType.FLIP_THREE: return '🔄';
                case ActionType.SECOND_CHANCE: return '🍀';
                case ActionType.STOP: return '🛑';
                default: return '?';
            }
        }
        return '?';
    }

    /**
     * Obtient le nom de la carte
     */
    getName() {
        if (this.isNumber()) {
            return `Carte ${this.value}`;
        }
        if (this.isModifier()) {
            return this.subType;
        }
        if (this.isAction()) {
            switch (this.subType) {
                case ActionType.FREEZE: return 'Freeze';
                case ActionType.FLIP_THREE: return 'Flip Three';
                case ActionType.SECOND_CHANCE: return 'Second Chance';
                case ActionType.STOP: return 'Stop';
                default: return 'Action';
            }
        }
        return 'Carte';
    }

    /**
     * Sérialise la carte pour le réseau
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            value: this.value,
            subType: this.subType
        };
    }

    /**
     * Désérialise une carte depuis les données réseau
     */
    static deserialize(data) {
        const card = new Card(data.type, data.value, data.subType);
        card.id = data.id;
        return card;
    }
}
