/**
 * BattleManager.js
 * Quản lý logic chiến đấu: tấn công, nhận sát thương, animation
 */

import GameConfig from '../core/GameConfig.js';
import DOMUtil from '../utils/DOMUtil.js';

class BattleManager {
    constructor(audioManager, effectsUtil, uiManager) {
        this.audioManager = audioManager;
        this.effects = effectsUtil;
        this.uiManager = uiManager;
        this.isBattling = false;
    }

    /**
     * Xử lý một round chiến đấu
     * @param {Object} player 
     * @param {Object} monster 
     * @param {number} correctCount - Số đòn hero tấn công
     * @param {number} wrongCount - Số đòn monster tấn công
     * @returns {Object} - { playerAlive, monsterAlive }
     */
    async processBattleRound(player, monster, correctCount = 0, wrongCount = 0) {
        try {
            console.log('[BattleManager] processBattleRound start', { correctCount, wrongCount });
            
            if (!player || !monster) {
                console.warn('[BattleManager] Missing player or monster');
                return { playerAlive: false, monsterAlive: false };
            }

            if (this.isBattling) {
                console.log('[BattleManager] Already battling, skip');
                return { playerAlive: true, monsterAlive: true };
            }

            this.isBattling = true;

            // Hero attacks
            for (let i = 0; i < correctCount; i++) {
                if (monster.hp <= 0) break;
                
                await this._executeAttack(player, monster, 'hero');
                await this._delay(GameConfig.TIMINGS.damageDelay);
            }

            // Kiểm tra monster chết
            if (monster.hp <= 0) {
                console.log('[BattleManager] Monster defeated');
                this.isBattling = false;
                return { playerAlive: true, monsterAlive: false };
            }

            // Monster attacks
            for (let j = 0; j < wrongCount; j++) {
                if (player.hp_current <= 0) break;
                
                await this._executeAttack(monster, player, 'monster');
                await this._delay(GameConfig.TIMINGS.damageDelay);
            }

            // Kiểm tra hero chết
            if (player.hp_current <= 0) {
                console.log('[BattleManager] Hero defeated');
                this.isBattling = false;
                return { playerAlive: false, monsterAlive: true };
            }

            // Cập nhật UI
            if (this.uiManager) {
                this.uiManager.updateBattleStatus(player, monster);
            }

            this.isBattling = false;

            return {
                playerAlive: player.hp_current > 0,
                monsterAlive: monster.hp > 0
            };

        } catch (err) {
            console.error('[BattleManager] processBattleRound error', err);
            this.isBattling = false;
            return { playerAlive: true, monsterAlive: true };
        }
    }

    /**
     * Thực hiện một đòn tấn công
     * @param {Object} attacker 
     * @param {Object} defender 
     * @param {number} actualDamage 
     * @param {string} attackerType - 'hero' hoặc 'monster'
     * @private
     */
    async _executeAttack(attacker, defender, attackerType) {
        try {
            
            let actualDamage;
        
            if (attackerType === 'hero') {
                // Hero damage = hero_base_atk + atk_bonus - def_monster
                const heroBaseAtk = Number(attacker.hero_base_atk || 0);  // ✅ Từ heroes table
                const heroAtkBonus = Number(attacker.atk || 0);          // ✅ Từ profiles bonus
                const monsterDef = Number(defender.def || 0);
                
                actualDamage = Math.max(
                    GameConfig.MIN_DAMAGE, 
                    heroBaseAtk + heroAtkBonus - monsterDef
                );
            } else {
                // Monster damage = atk_monster - (hero_base_def + def_bonus)
                const monsterAtk = Number(attacker.atk || 0);
                const heroBaseDef = Number(defender.hero_base_def || 0);  // ✅ Từ heroes table
                const heroDefBonus = Number(defender.def || 0);          // ✅ Từ profiles bonus
                
                actualDamage = Math.max(
                    GameConfig.MIN_DAMAGE,
                    monsterAtk - (heroBaseDef + heroDefBonus)
                );
            }

        console.log('[BattleManager] Final damage:', actualDamage);

            // Phát âm thanh
            if (this.effects) {
                this.effects.playAttackSound(attackerType);
            }

            // Visual: lunge attacker forward
            const attackerElId = attackerType === 'hero' ? 'hero' : 'monster';
            const defenderElId = attackerType === 'hero' ? 'monster' : 'hero';

            if (this.effects) {
                this.effects.attackLunge(attackerElId);
            }

            // Flash defender
            if (this.effects) {
                this.effects.hitFlash(defenderElId);
                this.effects.shakeElement(defenderElId);
            }

            // Apply damage
            if (defender.hp_current !== undefined) {
                // Defender là player
                const cur = Number.isFinite(defender.hp_current) ? defender.hp_current : Number(defender.max_hp || 0);
                defender.hp_current = Math.max(0, cur - actualDamage);
            } else {
                // Defender là monster
                const cur = Number.isFinite(defender.hp) ? defender.hp : Number(defender.max_hp || 0);
                defender.hp = Math.max(0, cur - actualDamage);
            }

            // Hiển thị damage number
            this._showDamageNumber(defenderElId, actualDamage);

            // Cập nhật UI
            if (this.uiManager) {
                this.uiManager.updateBattleStatus(
                    attackerType === 'hero' ? attacker : defender,
                    attackerType === 'hero' ? defender : attacker
                );
            }

            console.log('[BattleManager] Attack applied', { attacker: attackerType, actualDamage });

        } catch (e) {
            console.warn('[BattleManager] _executeAttack error', e);
        }
    }

    /**
     * Hiển thị số damage bay lên
     * @param {string} targetElId 
     * @param {number} actualDamage 
     * @private
     */
    _showDamageNumber(targetElId, actualDamage) {
        //const pos = DOMUtil.getRelativeCenter(targetElId, 'battleview');
        //if (!pos || !this.effects) return;

        this.effects.showDamage('battleview', targetElId , actualDamage);

        // Tạo hiệu ứng sao
        this.effects.createStars('battleview', pos.x, pos.y, 8);
    }

    /**
     * Delay helper
     * @param {number} ms 
     * @returns {Promise}
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset trạng thái battle
     */
    reset() {
        this.isBattling = false;
    }

    /**
     * Check xem đang trong battle không
     * @returns {boolean}
     */
    isInBattle() {
        return this.isBattling;
    }
}

// Expose ra window
window.BattleManager = BattleManager;

// Export
export default BattleManager;