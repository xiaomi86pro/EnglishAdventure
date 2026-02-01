/**
 * MonsterHandler.js
 * Xử lý logic liên quan đến monsters: spawn, defeat, configuration
 */

import GameConfig from '../core/GameConfig.js';
import DOMUtil from '../utils/DOMUtil.js';

class MonsterHandler {
    constructor(supabase, effectsUtil) {
        this.supabase = supabase;
        this.effects = effectsUtil;
    }

    /**
     * Spawn monster từ step configuration trong database
     * @param {number} stationId 
     * @param {number} stepNumber 
     * @returns {Object} monster object
     */
    async spawnFromStep(stationId, stepNumber) {
        try {
            // 1. Lấy step config từ DB
            const { data: stepConfig, error } = await this.supabase
                .from('steps')
                .select('*, monsters(*)')
                .eq('station_id', stationId)
                .eq('step_number', stepNumber)
                .single();

            if (error || !stepConfig) {
                console.error('⛔ Không tìm thấy config cho step này!');
                alert(`Lỗi: Chưa cấu hình Step ${stepNumber}. Vui lòng vào Admin để cấu hình!`);
                
                // Spawn monster mặc định để game không bị crash
                return this._createDefaultMonster();
            }

            // 2. Lấy monster từ config
            const monsterData = stepConfig.monsters;
            
            const monster = {
                ...monsterData,
                hp: monsterData.base_hp,
                max_hp: monsterData.base_hp,
                atk: monsterData.base_atk,
                def: monsterData.base_def,
                state: 'idle',
                isDead: false,
                hasDroppedReward: false,
                sprite_url: monsterData.image_url,
                questionType: stepConfig.question_type || GameConfig.getDefaultQuestionType(monsterData.type)
            };

            // 3. Render monster lên UI
            this._renderMonster(monster);

            // 4. Phát nhạc boss nếu cần
            if (this.effects) {
                this.effects.playMonsterBGM(monster.type);
            }

            console.log('Spawned monster:', monster.name);
            return monster;

        } catch (err) {
            console.error('Lỗi spawn monster:', err);
            return this._createDefaultMonster();
        }
    }

    /**
     * Tạo monster mặc định (fallback)
     * @returns {Object}
     */
    _createDefaultMonster() {
        const monster = { ...GameConfig.DEFAULT_MONSTER };
        this._renderMonster(monster);
        return monster;
    }

    /**
     * Render monster lên UI
     * @param {Object} monster 
     */
    _renderMonster(monster) {
        const monsterEl = DOMUtil.getById('monster');
        if (!monsterEl) return;

        // Set background image
        DOMUtil.setBackgroundImage('monster', monster.sprite_url);

        // Set size class theo loại monster
        const sizeClass = GameConfig.getMonsterSizeClass(monster.type);
        monsterEl.className = `sprite ${sizeClass}`;
    }

    /**
     * Xử lý khi monster bị tiêu diệt
     * @param {Object} monster 
     * @param {Object} player 
     * @returns {Object} - { hpRestored, actualRestore, coinDropped, expGained }
     */
    handleDefeat(monster, player) {
        const monsterType = monster?.type;
        
        // 1. Hồi HP (logic cũ)
        let hpRestore = GameConfig.getHPRestore(monsterType);
        let actualRestore = 0;
    
        if (hpRestore > 0 && player) {
            const oldHp = player.hp_current;
            player.hp_current = Math.min(player.max_hp, player.hp_current + hpRestore);
            actualRestore = player.hp_current - oldHp;
            
            if (actualRestore > 0 && this.effects) {
                this.effects.showHealEffect('battleview', 'hero', actualRestore);
                this.effects.showToast(
                    `💚 Hồi ${actualRestore} HP từ ${monsterType}!`, 
                    'success', 
                    2000
                );
            }
        }
    
        // ✅ 2. Lấy coin và exp từ monster
        const coinDropped = monster?.coin || 0;
        const expGained = monster?.exp_reward || 0;
    
        // ✅ 3. Hiển thị hiệu ứng coin drop
        if (coinDropped > 0 && this.effects &&!monster.hasDroppedReward) {
            monster.hasDroppedReward = true;
            this.effects.showCoinDrop('battleview', 'monster', coinDropped);
        }
    
        // ✅ 4. Hiển thị hiệu ứng exp gain
        if (expGained > 0 && this.effects) {
            // Delay một chút để coin drop xong trước
            setTimeout(() => {
                this.effects.showExpGain('battleview', 'monster', 'hero', expGained);
            }, 500);
        }
    
        // Dừng nhạc boss
        if (this.effects) {
            this.effects.stopBGM();
        }
    
        return {
            hpRestored: hpRestore,
            actualRestore: actualRestore,
            coinDropped: coinDropped,
            expGained: expGained
        };
    }

    /**
     * Spawn monster ngẫu nhiên (backup method - không dùng nữa)
     * @deprecated Dùng spawnFromStep() thay thế
     */
    async spawnRandom() {
        console.warn('spawnRandom() is deprecated. Use spawnFromStep() instead.');
        try {
            const { data: monsters, error } = await this.supabase
                .from('monsters')
                .select('*');

            if (error || !monsters || monsters.length === 0) {
                return this._createDefaultMonster();
            }

            const randomMonster = monsters[Math.floor(Math.random() * monsters.length)];
            
            const monster = {
                ...randomMonster,
                hp: randomMonster.base_hp,
                max_hp: randomMonster.base_hp,
                atk: randomMonster.base_atk,
                state: 'idle',
                isDead: false,
                hasDroppedReward: false,
                sprite_url: randomMonster.image_url,
                questionType: GameConfig.getDefaultQuestionType(randomMonster.type)
            };

            this._renderMonster(monster);
            
            if (this.effects) {
                this.effects.playMonsterBGM(monster.type);
            }

            return monster;

        } catch (err) {
            console.error('Lỗi spawn random monster:', err);
            return this._createDefaultMonster();
        }
    }

    /**
     * Cập nhật HP của monster lên UI
     * @param {Object} monster 
     */
    updateHP(monster) {
        if (!monster) return;

        const hpPercent = (monster.hp / monster.max_hp) * 100;
        
        // Cập nhật fill bar
        const fillEl = DOMUtil.getById('monster-hp-fill');
        if (fillEl) {
            DOMUtil.setStyle('monster-hp-fill', 'width', `${hpPercent}%`);
        }

        // Cập nhật text
        const textEl = DOMUtil.getById('monster-hp-text');
        if (textEl) {
            textEl.innerText = `${Math.ceil(monster.hp)}/${monster.max_hp}`;
        }
    }

    /**
     * Reset monster về trạng thái ban đầu (không dùng - chỉ để reference)
     * @param {Object} monster 
     */
    reset(monster) {
        if (!monster) return;
        
        monster.hp = monster.max_hp;
        monster.state = 'idle';
        monster.isDead = false;
        
        this.updateHP(monster);
    }

    /**
     * Check xem monster đã chết chưa
     * @param {Object} monster 
     * @returns {boolean}
     */
    isDead(monster) {
        return monster && monster.hp <= 0;
    }

    /**
     * Lấy thông tin monster để hiển thị
     * @param {Object} monster 
     * @returns {Object}
     */
    getDisplayInfo(monster) {
        if (!monster) return null;

        return {
            name: monster.name,
            type: monster.type,
            hp: Math.ceil(monster.hp),
            maxHp: monster.max_hp,
            atk: monster.atk,
            hpPercent: (monster.hp / monster.max_hp) * 100
        };
    }
}

// Expose ra window
window.MonsterHandler = MonsterHandler;

// Export
export default MonsterHandler;