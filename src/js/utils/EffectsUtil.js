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
    showDamage(containerId, targetId, damage) {
        const container = DOMUtil.getById(containerId);
        if (!container) return;

        let pos = DOMUtil.getRelativeCenter(targetId, containerId);
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
            const rect = DOMUtil.getRect(containerId);
            if (!rect) return;
            pos = {
                x: rect.width / 2,
                y: rect.height / 2
            };
        }

        const dmgEl = DOMUtil.createElement('div', {
            className: 'damage-popup',
            innerText: `-${damage}`,
            styles: {
                left: `${pos.x}px`,
                top: `${pos.y}px`
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
    
        const pos = DOMUtil.getRelativeCenter(targetId, containerId);
        if (!pos) return;
    
        /* =======================
           +HP POPUP
        ======================= */
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
    
        /* =======================
           HEAL SOUND
        ======================= */
        if (this.audioManager) {
            this.audioManager.playSfx(GameConfig.SOUNDS.heal);
        }
    
        /* =======================
           HERO GREEN GLOW (FIX)
        ======================= */
        const heroImg = target.querySelector('img');
        if (heroImg) {
            heroImg.classList.add('heal-glow');
            setTimeout(() => {
                heroImg.classList.remove('heal-glow');
            }, 800);
        }
    
        /* =======================
           HEAL PARTICLES
        ======================= */
        for (let i = 0; i < 8; i++) {
            const particle = DOMUtil.createElement('div', {
                className: 'heal-particle',
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
    
            particle.style.setProperty('--heal-tx', `${tx}px`);
            particle.style.setProperty('--heal-ty', `${ty}px`);
            particle.style.animation = 'healParticle 1s ease-out forwards';
    
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    
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
            className: `fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${bgColors[type]} text-white px-6 py-3 rounded-full font-bold shadow-lg z-50`,
            innerText: message
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }

    /**
 * Hiệu ứng coin rơi
 * @param {string} containerId - 'battleview'
 * @param {string} fromId - 'monster'
 * @param {number} coinAmount 
 */
    showCoinDrop(containerId, fromId, coinAmount) {
        const container = DOMUtil.getById(containerId);
        const fromEl = DOMUtil.getById(fromId);
        if (!container || !fromEl || coinAmount <= 0) return;
    
        // Vị trí xuất phát (giữa monster)
        const pos = DOMUtil.getRelativeCenter(fromId, containerId);
        if (!pos) return;
    
        const monsterRect = fromEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
    
        // ==== CONFIG ====
        const COIN_SIZE = 40;
        const flyDuration = 800;     // bay cong
        const groundDelay = 2000;    // nằm đất
        const fadeDuration = 300;    // mờ đi
        const FOOT_OFFSET = 10;      // nâng mặt đất lên chút
    
        // Mặt đất logic = đáy monster
        const groundY =
            monsterRect.bottom
            - containerRect.top
            - COIN_SIZE
            - FOOT_OFFSET;
    
        // Số coin rơi (1 coin = 1 particle)
        const coinCount = coinAmount;
    
        for (let i = 0; i < coinCount; i++) {
    
            /* =====================
               1️⃣ WRAPPER (bay X)
            ====================== */
            const wrapper = DOMUtil.createElement('div', {
                className: 'coin-wrapper',
                styles: {
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    pointerEvents: 'none',
                    zIndex: '100',
                    willChange: 'transform'
                }
            });
    
            /* =====================
               2️⃣ COIN (bay Y)
            ====================== */
            const coin = DOMUtil.createElement('img', {
                className: 'coin',
                attributes: {
                    src: './public/icon/Coin.png',
                    alt: 'coin'
                },
                styles: {
                    width: `${COIN_SIZE}px`,
                    height: `${COIN_SIZE}px`,
                    willChange: 'transform, opacity'
                }
            });
    
            wrapper.appendChild(coin);
            container.appendChild(wrapper);
    
            /* =====================
               3️⃣ TÍNH QUỸ ĐẠO
            ====================== */
            const offsetX = (Math.random() - 0.5) * 140;
            const fallDistance = Math.max(20, groundY - pos.y);
    
            wrapper.style.setProperty('--tx', `${offsetX}px`);
            coin.style.setProperty('--ty', `${fallDistance}px`);
    
            /* =====================
               4️⃣ START ANIMATION
            ====================== */
            requestAnimationFrame(() => {
                wrapper.classList.add('coin-fly');
                coin.classList.add('coin-drop');
            });
            
            /* =====================
               5️⃣ FADE + REMOVE
            ====================== */
            setTimeout(() => {
                coin.style.animation = `coinFadeOut ${fadeDuration}ms ease-out forwards`;
                setTimeout(() => wrapper.remove(), fadeDuration);
            }, flyDuration + groundDelay);
        }
        
        window.audioControl.playSfx('./public/sounds/Coin_Drop2.wav');
    }
    

/**
 * Hiệu ứng exp bay vào hero
 * @param {string} containerId - 'battleview'
 * @param {string} fromId - 'monster'
 * @param {string} toId - 'hero'
 * @param {number} expAmount 
 */
showExpGain(containerId, fromId, toId, expAmount) {
    const container = DOMUtil.getById(containerId);
    if (!container) return;

    const fromPos = DOMUtil.getRelativeCenter(fromId, containerId);
    const toPos = DOMUtil.getRelativeCenter(toId, containerId);
    if (!fromPos || !toPos) return;

    // Tạo exp orbs bay về hero
    const orbCount = Math.min(8, Math.ceil(expAmount / 10));

    for (let i = 0; i < orbCount; i++) {
        setTimeout(() => {
            const orb = DOMUtil.createElement('div', {
                className: 'exp-orb',
                innerText: '✨',
                styles: {
                    position: 'absolute',
                    left: `${fromPos.x}px`,
                    top: `${fromPos.y}px`,
                    fontSize: '20px',
                    pointerEvents: 'none',
                    zIndex: '100'
                }
            });

            const deltaX = toPos.x - fromPos.x;
            const deltaY = toPos.y - fromPos.y;

            orb.style.setProperty('--exp-tx', `${deltaX}px`);
            orb.style.setProperty('--exp-ty', `${deltaY}px`);
            orb.style.animation = 'expFlyToHero 0.8s ease-in-out forwards';

            container.appendChild(orb);

            setTimeout(() => orb.remove(), 800);
        }, i * 100); // Delay giữa các orbs
    }

    // Hiển thị số exp
    const expText = DOMUtil.createElement('div', {
        innerText: `+${expAmount} EXP`,
        styles: {
            position: 'absolute',
            left: `${fromPos.x}px`,
            top: `${fromPos.y - 30}px`,
            transform: 'translate(-50%, 0)',
            fontSize: '24px',
            fontWeight: '900',
            color: '#a78bfa',
            textShadow: '0 0 10px #000, 0 0 20px #a78bfa',
            animation: 'floatUpFade 2s ease-out forwards',
            pointerEvents: 'none',
            zIndex: '101'
        }
    });

    container.appendChild(expText);
    setTimeout(() => expText.remove(), 2000);
}

/**
 * Hiệu ứng level up
 * @param {string} heroId - 'hero'
 * @param {number} newLevel 
 */
showLevelUp(heroId, newLevel) {
    const heroEl = DOMUtil.getById(heroId);
    if (!heroEl) return;

    // Phát âm thanh level up (nếu có)
    if (this.audioManager) {
        // Tạm thời dùng heal sound, sau có thể thêm level up sound riêng
        this.audioManager.playSfx('./sounds/Heal.mp3');
    }

    // Tạo cột sáng từ hero
    const rect = heroEl.getBoundingClientRect();
    const battleView = DOMUtil.getById('battleview');
    const bvRect = battleView.getBoundingClientRect();

    const centerX = rect.left - bvRect.left + rect.width / 2;
    const centerY = rect.top - bvRect.top + rect.height / 2;

    // Cột sáng chính
    const lightBeam = DOMUtil.createElement('div', {
        styles: {
            position: 'absolute',
            left: `${centerX}px`,
            top: '0',
            bottom: '0',
            width: '100px',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(to top, rgba(250,204,21,0) 0%, rgba(250,204,21,0.8) 50%, rgba(250,204,21,0) 100%)',
            animation: 'levelUpBeam 2s ease-out forwards',
            pointerEvents: 'none',
            zIndex: '90'
        }
    });

    battleView.appendChild(lightBeam);
    setTimeout(() => lightBeam.remove(), 2000);

    // Hero glow effect
    heroEl.style.filter = 'brightness(2) drop-shadow(0 0 30px #fbbf24)';
    heroEl.style.transform = 'scale(1.2)';
    
    setTimeout(() => {
        heroEl.style.filter = '';
        heroEl.style.transform = '';
    }, 2000);

    // Text "LEVEL UP!"
    const levelUpText = DOMUtil.createElement('div', {
        innerHTML: `
            <div style="font-size: 48px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 20px #000, 0 0 40px #fbbf24;">
                LEVEL UP!
            </div>
            <div style="font-size: 32px; font-weight: 900; color: #fff; text-shadow: 0 0 10px #000; margin-top: 10px;">
                Level ${newLevel}
            </div>
        `,
        styles: {
            position: 'absolute',
            left: `${centerX}px`,
            top: `${centerY - 100}px`,
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            animation: 'levelUpText 2s ease-out forwards',
            pointerEvents: 'none',
            zIndex: '100'
        }
    });

    battleView.appendChild(levelUpText);
    setTimeout(() => levelUpText.remove(), 2000);

    // Particles xung quanh hero
    for (let i = 0; i < 20; i++) {
        const particle = DOMUtil.createElement('div', {
            innerText: '⭐',
            styles: {
                position: 'absolute',
                left: `${centerX}px`,
                top: `${centerY}px`,
                fontSize: '20px',
                pointerEvents: 'none',
                zIndex: '95'
            }
        });

        const angle = (Math.PI * 2 / 20) * i;
        const distance = 150;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        particle.style.setProperty('--particle-tx', `${tx}px`);
        particle.style.setProperty('--particle-ty', `${ty}px`);
        particle.style.animation = 'levelUpParticle 1.5s ease-out forwards';

        battleView.appendChild(particle);
        setTimeout(() => particle.remove(), 1500);
    }
}
}

// Expose ra window
window.EffectsUtil = EffectsUtil;

// Export
export default EffectsUtil;