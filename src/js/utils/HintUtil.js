import GameConfig from '../core/GameConfig.js';

const HintUtil = {
    getButtonHTML(extraClass = '') {
        const id = GameConfig.HINT.buttonId;
        const classNames = [
            'absolute top-4 right-4 w-10 h-10 bg-white border-2 border-yellow-400 rounded-full',
            'flex items-center justify-center text-xl shadow hover:bg-yellow-50 active:scale-95',
            'transition-transform z-20',
            extraClass
        ].filter(Boolean).join(' ');

        return `<button id="${id}" class="${classNames}" type="button">💡</button>`;
    },

    bindHintButton(handler) {
        const btn = document.getElementById(GameConfig.HINT.buttonId);
        if (!btn || typeof handler !== 'function') return null;
        btn.onclick = handler;
        return btn;
    },

    useHint({ damage, onShowHint } = {}) {
        const hintDamage = Number.isFinite(Number(damage))
            ? Number(damage)
            : GameConfig.HINT.defaultDamage;

        if (window.GameEngine?.useHint) {
            window.GameEngine.useHint(hintDamage, {
                targetId: GameConfig.HINT.defaultTargetId
            });
        }

        if (typeof onShowHint === 'function') {
            onShowHint();
        }
    }
};

export default HintUtil;
