/**
 * StateManager.js
 * Quản lý việc lưu/tải/khôi phục trạng thái game vào localStorage
 */

class StateManager {
    constructor() {
        this.storageKeyPrefix = 'gameState-';
    }

    /**
     * Lưu trạng thái game vào localStorage
     * @param {Object} gameState - Bao gồm player, monster, location, station, step
     * @returns {boolean} - true nếu lưu thành công
     */
    save(gameState) {
        try {
            if (!gameState || !gameState.player || !gameState.player.id) {
                console.error('[StateManager] Invalid gameState, missing player.id');
                return false;
            }
    
            const stateToSave = {
                player: {
                    id: gameState.player.id,
                    display_name: gameState.player.display_name,
                    avatar_key: gameState.player.avatar_key,
                    level: gameState.player.level,
                    exp: gameState.player.exp,
                    coin: gameState.player.coin, // ✅ Thêm coin
                    max_hp: gameState.player.max_hp,
                    hp_current: gameState.player.hp_current,
                    atk: gameState.player.atk,
                    sprite_url: gameState.player.sprite_url,
                    selected_hero_id: gameState.player.selected_hero_id,
                    sprite: gameState.player.avatar_key,
                    role: gameState.player.role
                },
                currentLocationId: gameState.currentLocation?.id,
                currentStationId: gameState.currentStation?.id,
                currentStationName: gameState.currentStation?.name,
                currentStep: gameState.currentStep || 1,
                monster: gameState.monster ? {
                    name: gameState.monster.name,
                    hp: gameState.monster.hp,
                    max_hp: gameState.monster.max_hp,
                    atk: gameState.monster.atk,
                    type: gameState.monster.type,
                    sprite_url: gameState.monster.sprite_url,
                    questionType: gameState.monster.questionType,
                    coin: gameState.monster.coin, // ✅ Thêm coin
                    exp_reward: gameState.monster.exp_reward // ✅ Thêm exp_reward
                } : null,
                savedAt: new Date().toISOString()
            };
    
            const key = this._getStorageKey(gameState.player.id);
            localStorage.setItem(key, JSON.stringify(stateToSave));
            
            console.log('[StateManager] Game đã được lưu:', stateToSave);
            return true;
    
        } catch (err) {
            console.error('[StateManager] Lỗi save game:', err);
            return false;
        }
    }

    /**
     * Tải trạng thái game từ localStorage
     * @param {string} userId 
     * @returns {Object|null} - savedGame object hoặc null
     */
    load(userId) {
        try {
            if (!userId) {
                console.warn('[StateManager] userId is required to load game');
                return null;
            }

            const key = this._getStorageKey(userId);
            const saved = localStorage.getItem(key);

            if (!saved) {
                console.log('[StateManager] No saved game found for user:', userId);
                return null;
            }

            const gameState = JSON.parse(saved);
            console.log('[StateManager] Game đã tải:', gameState);
            
            return gameState;

        } catch (err) {
            console.error('[StateManager] Lỗi load game:', err);
            return null;
        }
    }

    /**
     * Xóa trạng thái game đã lưu
     * @param {string} userId 
     * @returns {boolean}
     */
    clear(userId) {
        try {
            if (!userId) {
                console.warn('[StateManager] userId is required to clear game');
                return false;
            }

            const key = this._getStorageKey(userId);
            localStorage.removeItem(key);
            
            console.log('[StateManager] Game đã xóa cho user:', userId);
            return true;

        } catch (err) {
            console.error('[StateManager] Lỗi clear game:', err);
            return false;
        }
    }

    /**
     * Kiểm tra xem có game đã lưu không
     * @param {string} userId 
     * @returns {boolean}
     */
    hasSavedGame(userId) {
        if (!userId) return false;
        
        const key = this._getStorageKey(userId);
        return localStorage.getItem(key) !== null;
    }

    /**
     * Lấy thông tin tóm tắt của saved game (không load toàn bộ)
     * @param {string} userId 
     * @returns {Object|null} - { playerName, location, station, step, savedAt }
     */
    getSummary(userId) {
        try {
            const savedGame = this.load(userId);
            if (!savedGame) return null;

            return {
                playerName: savedGame.player?.display_name,
                locationName: savedGame.currentStationName || 'Unknown',
                step: savedGame.currentStep || 1,
                savedAt: savedGame.savedAt || 'Unknown',
                hasMonster: !!savedGame.monster
            };

        } catch (err) {
            console.error('[StateManager] Lỗi get summary:', err);
            return null;
        }
    }

    /**
     * Export game state ra JSON string (để backup)
     * @param {string} userId 
     * @returns {string|null}
     */
    exportToJSON(userId) {
        try {
            const savedGame = this.load(userId);
            if (!savedGame) return null;

            return JSON.stringify(savedGame, null, 2);

        } catch (err) {
            console.error('[StateManager] Lỗi export JSON:', err);
            return null;
        }
    }

    /**
     * Import game state từ JSON string
     * @param {string} jsonString 
     * @param {string} userId 
     * @returns {boolean}
     */
    importFromJSON(jsonString, userId) {
        try {
            const gameState = JSON.parse(jsonString);
            
            // Validate cơ bản
            if (!gameState.player || !gameState.player.id) {
                throw new Error('Invalid game state JSON');
            }

            // Overwrite userId nếu cần
            if (userId) {
                gameState.player.id = userId;
            }

            const key = this._getStorageKey(gameState.player.id);
            localStorage.setItem(key, JSON.stringify(gameState));
            
            console.log('[StateManager] Game imported successfully');
            return true;

        } catch (err) {
            console.error('[StateManager] Lỗi import JSON:', err);
            return false;
        }
    }

    /**
     * Lấy danh sách tất cả saved games (hữu ích cho debug)
     * @returns {Array} - [{ userId, summary }]
     */
    getAllSavedGames() {
        const savedGames = [];
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                if (key && key.startsWith(this.storageKeyPrefix)) {
                    const userId = key.replace(this.storageKeyPrefix, '');
                    const summary = this.getSummary(userId);
                    
                    if (summary) {
                        savedGames.push({
                            userId,
                            summary
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[StateManager] Lỗi get all saved games:', err);
        }

        return savedGames;
    }

    /**
     * Xóa tất cả saved games (nguy hiểm - chỉ dùng cho debug)
     * @returns {number} - Số lượng games đã xóa
     */
    clearAll() {
        let count = 0;
        
        try {
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.storageKeyPrefix)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                count++;
            });

            console.log(`[StateManager] Đã xóa ${count} saved games`);

        } catch (err) {
            console.error('[StateManager] Lỗi clear all:', err);
        }

        return count;
    }

    /**
     * Helper: Tạo storage key cho user
     * @param {string} userId 
     * @returns {string}
     * @private
     */
    _getStorageKey(userId) {
        return `${this.storageKeyPrefix}${userId}`;
    }

    /**
     * Validate game state trước khi save
     * @param {Object} gameState 
     * @returns {boolean}
     */
    validate(gameState) {
        if (!gameState) return false;
        if (!gameState.player || !gameState.player.id) return false;
        if (typeof gameState.currentStep !== 'number') return false;
        
        return true;
    }
}

// Expose ra window
window.StateManager = StateManager;

// Export
export default StateManager;