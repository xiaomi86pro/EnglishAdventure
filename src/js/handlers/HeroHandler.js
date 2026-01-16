/**
 * HeroHandler.js
 * Xử lý logic liên quan đến hero: defeat, unlock, notifications
 */

import DOMUtil from '../utils/DOMUtil.js';

class HeroHandler {
    constructor(supabase, effectsUtil) {
        this.supabase = supabase;
        this.effects = effectsUtil;
    }

    /**
     * Xử lý khi hero bị hạ gục
     * @param {Function} onComplete - Callback sau khi xử lý xong
     */
    async handleDefeat(onComplete) {
        try {
            // Dừng nhạc trận đấu
            if (this.effects) {
                this.effects.stopBGM();
                this.effects.playDeathSound();
            }

            // Dừng speech nếu đang phát
            try {
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                }
            } catch (e) {
                console.warn('Cannot cancel speech:', e);
            }

            // Hiệu ứng chết cho hero
            this.effects?.heroDeathEffect('hero');

            // Hiển thị thông báo defeat đơn giản
            const modal = this._createDefeatModal();
            document.body.appendChild(modal);

            // Delay trước khi về menu (1s)
            await new Promise(res => setTimeout(res, 1000));

            // Xóa modal nếu vẫn còn
            if (document.body.contains(modal)) {
                modal.remove();
            }

            // Reset hero visual nếu cần
            DOMUtil.removeClass('hero', 'hero-dead');

            // Gọi callback (thường là showMainMenu)
            if (onComplete && typeof onComplete === 'function') {
                onComplete();
            }

        } catch (err) {
            console.error('[HeroHandler] handleDefeat error', err);
            // Fallback an toàn
            try {
                location.reload();
            } catch (e) {
                console.error('Cannot reload:', e);
            }
        }
    }

    /**
     * Tạo modal thông báo defeat
     * @returns {HTMLElement}
     * @private
     */
    _createDefeatModal() {
        const modal = DOMUtil.createElement('div', {
            className: 'fixed inset-0 z-60 flex items-center justify-center bg-black/60',
            innerHTML: `
                <div class="bg-white rounded-2xl p-8 text-center max-w-md w-full">
                    <h2 class="text-3xl font-bold text-red-600 mb-4">Bạn đã thua</h2>
                    <p class="mb-2">Hero đã bị hạ gục.</p>
                </div>
            `
        });
        return modal;
    }

    
/**
 * Kiểm tra và mở khóa hero nếu hoàn thành station điều kiện
 * @param {number} completedStationId 
 * @param {string} userId - ID của user hiện tại
 * @returns {Array} - Danh sách heroes đã unlock
 */
async checkAndUnlockHero(completedStationId, userId) {
    try {
        if (!userId) {
            console.warn('[HeroHandler] userId is required for unlock');
            return [];
        }

        // Tìm hero cần unlock bởi station này
        const { data: heroToUnlock, error } = await this.supabase
            .from('heroes')
            .select('id, name')
            .eq('unlock_station_id', completedStationId)
            .single();

        if (error || !heroToUnlock) {
            return []; // Không có hero nào cần unlock
        }

        // ✅ Kiểm tra user đã unlock hero này chưa
        const { data: existing } = await this.supabase
            .from('unlocked_heroes')
            .select('id')
            .eq('profile_id', userId)
            .eq('hero_id', heroToUnlock.id)
            .single();

        if (existing) {
            console.log('[HeroHandler] User already unlocked this hero');
            return []; // Đã unlock rồi
        }

        // ✅ INSERT vào unlocked_heroes cho user này
        const { error: insertError } = await this.supabase
            .from('unlocked_heroes')
            .insert({
                profile_id: userId,
                hero_id: heroToUnlock.id,
                unlocked_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('[HeroHandler] Error inserting unlocked hero:', insertError);
            return [];
        }

        // Hiển thị thông báo unlock
        this.showUnlockNotification(heroToUnlock.name);

        return [heroToUnlock];

    } catch (err) {
        console.error('[HeroHandler] checkAndUnlockHero error:', err);
        return [];
    }
}

    /**
     * Hiển thị thông báo mở khóa hero
     * @param {string} heroName 
     */
    showUnlockNotification(heroName) {
        const notification = DOMUtil.createElement('div', {
            className: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-8 rounded-3xl shadow-2xl border-4 border-white animate-bounce',
            innerHTML: `
                <div class="text-center">
                    <div class="text-6xl mb-4">🎉</div>
                    <h2 class="text-3xl font-black mb-2">HERO MỚI!</h2>
                    <p class="text-xl font-bold">${heroName} đã được mở khóa!</p>
                    <p class="text-sm mt-2 opacity-80">Bạn có thể chọn hero này ở lần chơi tiếp theo</p>
                </div>
            `
        });

        document.body.appendChild(notification);

        // Tự động ẩn sau 4 giây
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    }

    /**
     * Cập nhật HP của hero lên UI
     * @param {Object} player 
     */
    updateHP(player) {
        if (!player) return;

        const hpPercent = (player.hp_current / player.max_hp) * 100;

        // Cập nhật fill bar
        const fillEl = DOMUtil.getById('hero-hp-fill');
        if (fillEl) {
            DOMUtil.setStyle('hero-hp-fill', 'width', `${hpPercent}%`);
            
            // Hiệu ứng đổi màu khi máu thấp
            const color = hpPercent < 30 ? '#ef4444' : '#22c55e';
            DOMUtil.setStyle('hero-hp-fill', 'backgroundColor', color);
        }

        // Cập nhật text
        const textEl = DOMUtil.getById('hero-hp-text');
        if (textEl) {
            textEl.innerText = `${Math.ceil(player.hp_current)}/${player.max_hp}`;
        }
    }

    /**
     * Check xem hero đã chết chưa
     * @param {Object} player 
     * @returns {boolean}
     */
    isDead(player) {
        return player && player.hp_current <= 0;
    }

    /**
     * Hồi máu cho hero
     * @param {Object} player 
     * @param {number} amount 
     * @returns {number} - Số HP thực sự hồi được
     */
    heal(player, amount) {
        if (!player) return 0;

        const oldHp = player.hp_current;
        player.hp_current = Math.min(player.max_hp, player.hp_current + amount);
        const actualHeal = player.hp_current - oldHp;

        if (actualHeal > 0) {
            this.updateHP(player);
            
            if (this.effects) {
                this.effects.showHealEffect('battleview', 'hero', actualHeal);
            }
        }

        return actualHeal;
    }

    /**
     * Render sprite hero lên UI
     * @param {Object} player 
     */
    renderSprite(player) {
        if (!player || !player.sprite_url) return;

        const heroEl = DOMUtil.getById('hero');
        if (heroEl) {
            DOMUtil.setBackgroundImage('hero', player.sprite_url);
            // Đảm bảo xóa class animation cũ nếu có
            heroEl.className = 'sprite';
        }
    }

    /**
     * Lấy thông tin hero để hiển thị
     * @param {Object} player 
     * @returns {Object}
     */
    getDisplayInfo(player) {
        if (!player) return null;

        return {
            name: player.display_name,
            level: player.level || 1,
            hp: Math.ceil(player.hp_current),
            maxHp: player.max_hp,
            atk: player.atk,
            hpPercent: (player.hp_current / player.max_hp) * 100,
            avatar: player.avatar_key || '👤'
        };
    }
}

// Expose ra window
window.HeroHandler = HeroHandler;

// Export
export default HeroHandler;