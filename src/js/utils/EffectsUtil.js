/**
 * EffectsUtil.js
 * Utility functions cho visual effects và audio effects
 */

import GameConfig from '../core/GameConfig.js';
import DOMUtil from './DOMUtil.js';

class EffectsUtil {
    constructor(audioManager) {
        this.audioManager = audioManager;
    }

    /**
     * Tạo hiệu ứng sao văng ra
     * @param {string} containerId - ID của container (thường là 'battleview')
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     * @param {number} count - Số lượng sao (default: 8)
     */
    createStars(containerId, x, y, count = 8) {
        const container = DOMUtil.getById(containerId);
        if (!container) return;

        for (let i = 0; i < count; i++) {
            const star = DOMUtil.createElement('div', {
                className: 'star-particle',
                innerText: '⭐',
                styles: {
                    left: `${x}px`,
                    top: `${y}px`
                }
            });

            // Tính toán hướng văng ngẫu nhiên (360 độ)
            const angle = (Math.PI * 2 / count) * i;
            const velocity = 100 + Math.random() * 100;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            star.style.setProperty('--tx', `${tx}px`);
            star.style.setProperty('--ty', `${ty}px`);

            container.appendChild(star);

            // Xóa ngôi sao khỏi màn hình sau khi bay xong
            setTimeout(() => star.remove(), GameConfig.TIMINGS.starEffect);
        }
    }

    /**
     * Hiển thị số damage bay lên
     * @param {string} containerId 
     * @param {number} centerX 
     * @param {number} centerY 
     * @param {number} damage 
     */
    showDamage(containerId, centerX, centerY, damage) {
        const container = DOMUtil.getById(containerId);
        if (!container) return;

        const dmgEl = DOMUtil.createElement('div', {
            className: 'damage-popup',
            innerText: `-${damage}`,
            styles: {
                left: `${centerX}px`,
                top: `${centerY}px`
            }
        });

        container.appendChild(dmgEl);

        // Xóa sau khi animation xong
        setTimeout(() => dmgEl.remove(), 1500);
    }

    /**
     * Hiển thị hiệu ứng hồi máu
     * @param {string} containerId - 'battleview'
     * @param {string} targetId - 'hero' hoặc 'monster'
     * @param {number} healAmount 
     */
    showHealEffect(containerId, targetId, healAmount) {
        const container = DOMUtil.getById(containerId);
        const target = DOMUtil.getById(targetId);
        if (!container || !target) return;

        // Tính tọa độ center của target
        const pos = DOMUtil.getRelativeCenter(targetId, containerId);
        if (!pos) return;

        // Tạo số +HP màu xanh
        const healEl = DOMUtil.createElement('div', {
            className: 'heal-popup',
            innerText: `+${healAmount} HP`,
            styles: {
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                position: 'absolute',
                transform: 'translate(-50%, 0)',
                fontSize: '32px',
                fontWeight: '900',
                color: '#22c55e',
                textShadow: '0 0 8px #fff, 0 0 12px #22c55e',
                animation: 'floatUpHeal 1.5s ease-out forwards',
                pointerEvents: 'none',
                zIndex: '50'
            }
        });

        container.appendChild(healEl);

        // Phát âm thanh heal
        if (this.audioManager) {
            this.audioManager.playSfx(GameConfig.SOUNDS.heal);
        }

        // Hiệu ứng ánh sáng xanh quanh hero
        DOMUtil.setStyle(targetId, 'boxShadow', '0 0 30px #22c55e, 0 0 50px #22c55e');
        setTimeout(() => {
            DOMUtil.setStyle(targetId, 'boxShadow', '');
        }, 1000);

        // Tạo các particle hồi máu xung quanh hero
        for (let i = 0; i < 8; i++) {
            const particle = DOMUtil.createElement('div', {
                innerText: '💚',
                styles: {
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    fontSize: '20px',
                    pointerEvents: 'none',
                    zIndex: '45'
                }
            });

            const angle = (Math.PI * 2 / 8) * i;
            const distance = 60;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            particle.style.animation = 'healParticle 1s ease-out forwards';
            particle.style.setProperty('--heal-tx', `${tx}px`);
            particle.style.setProperty('--heal-ty', `${ty}px`);

            container.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }

        // Xóa số +HP sau animation
        setTimeout(() => healEl.remove(), GameConfig.TIMINGS.healEffect);
    }

    /**
     * Hiệu ứng rung (shake) cho element
     * @param {string} elementId 
     */
    shakeElement(elementId) {
        const el = DOMUtil.getById(elementId);
        if (!el) return;

        DOMUtil.restartAnimation(elementId, 'shake');

        // Dọn dẹp class shake sau khi diễn xong
        setTimeout(() => {
            DOMUtil.removeClass(elementId, 'shake');
        }, GameConfig.TIMINGS.shakeEffect);
    }

    /**
     * Hiệu ứng hit flash (chớp đỏ khi bị đánh)
     * @param {string} elementId 
     */
    hitFlash(elementId) {
        DOMUtil.restartAnimation(elementId, 'hit-flash');
        
        setTimeout(() => {
            DOMUtil.removeClass(elementId, 'hit-flash');
        }, 300);
    }

    /**
     * Hiệu ứng lao tới tấn công
     * @param {string} elementId 
     * @param {Function} onComplete - Callback sau khi animation xong
     */
    attackLunge(elementId, onComplete) {
        DOMUtil.restartAnimation(elementId, 'attack-lunge');

        setTimeout(() => {
            DOMUtil.removeClass(elementId, 'attack-lunge');
            if (onComplete) onComplete();
        }, GameConfig.TIMINGS.attackAnimation);
    }

    /**
     * Hiệu ứng chạy tới
     * @param {string} elementId 
     * @param {Function} onComplete 
     */
    runForward(elementId, onComplete) {
        DOMUtil.addClass(elementId, 'run-forward');

        setTimeout(() => {
            DOMUtil.removeClass(elementId, 'run-forward');
            if (onComplete) onComplete();
        }, GameConfig.TIMINGS.attackAnimation);
    }

    /**
     * Hiệu ứng chạy về
     * @param {string} elementId 
     * @param {Function} onComplete 
     */
    runBack(elementId, onComplete) {
        DOMUtil.addClass(elementId, 'run-back');

        setTimeout(() => {
            DOMUtil.removeClass(elementId, 'run-back');
            if (onComplete) onComplete();
        }, GameConfig.TIMINGS.attackAnimation);
    }

    /**
     * Hiệu ứng hero chết
     * @param {string} heroId 
     */
    heroDeathEffect(heroId) {
        DOMUtil.addClass(heroId, 'hero-dead');
    }

    /**
     * Phát âm thanh tấn công
     * @param {string} attackerType - 'hero' hoặc 'monster'
     */
    playAttackSound(attackerType) {
        if (!this.audioManager) return;

        const sound = attackerType === 'hero' 
            ? GameConfig.SOUNDS.attack 
            : GameConfig.SOUNDS.hit;

        this.audioManager.playSfx(sound);
    }

    /**
     * Phát nhạc boss
     * @param {string} monsterType 
     */
    playMonsterBGM(monsterType) {
        if (!this.audioManager) return;

        const bgmPath = GameConfig.getMonsterBGM(monsterType);
        if (bgmPath) {
            this.audioManager.playBgm(bgmPath, { loop: true, fadeInMs: 300 });
        } else {
            this.audioManager.stopBgm({ fadeOutMs: 300 });
        }
    }

    /**
     * Dừng nhạc boss
     */
    stopBGM() {
        if (this.audioManager) {
            this.audioManager.stopBgm({ fadeOutMs: 300 });
        }
    }

    /**
     * Phát âm thanh death
     */
    playDeathSound() {
        if (this.audioManager) {
            this.audioManager.playDeath();
        }
    }

    /**
     * Dừng tất cả âm thanh
     */
    stopAllSounds() {
        if (this.audioManager) {
            this.audioManager.stopAll();
        }
    }

    /**
     * Hiển thị toast notification
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'info'
     * @param {number} duration - ms
     */
    showToast(message, type = 'success', duration = 2000) {
        const bgColors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };

        const toast = DOMUtil.createElement('div', {
            className: `fixed top-20 left-1/2 transform -translate-x-1/2 ${bgColors[type]} text-white px-6 py-3 rounded-full font-bold shadow-lg z-50 animate-bounce`,
            innerText: message
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }
}

// Expose ra window
window.EffectsUtil = EffectsUtil;

// Export
export default EffectsUtil;