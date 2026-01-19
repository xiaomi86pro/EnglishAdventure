/**
 * GameEngine.js (Refactored)
 * Orchestrator chính - điều phối các managers và handlers
 */

import "@/css/game.css";
import "@/css/effects.css";
import GameConfig from './GameConfig.js';
import DOMUtil from '../utils/DOMUtil.js';
import EffectsUtil from '../utils/EffectsUtil.js';
import MonsterHandler from '../handlers/MonsterHandler.js';
import HeroHandler from '../handlers/HeroHandler.js';
import StateManager from '../managers/StateManager.js';
import UIManager from '../managers/UIManager.js';
import BattleManager from '../managers/BattleManager.js';
import ProgressionManager from '../managers/ProgressionManager.js';
import SaveGameService from '../services/SaveGameService.js';

const GameEngine = {
    // Core state
    player: null,
    monster: null,
    currentLocation: null,
    currentStation: null,
    currentStep: 1,
    
    // Managers & Handlers (sẽ được init trong _initManagers)
    audioManager: null,
    effectsUtil: null,
    monsterHandler: null,
    heroHandler: null,
    stateManager: null,
    uiManager: null,
    battleManager: null,
    progressionManager: null,
    saveGameService: null,

    /**
     * Khởi tạo game với dữ liệu User từ Auth
     */
    async start(userData) {
        try {
            console.log('[GameEngine] Starting game with user:', userData);

            // 1. Initialize managers
            this._initManagers();

            // ✅ 2. Render leaderboard widget
            if (window.LeaderboardWidget) {
                await window.LeaderboardWidget.render();
            }

            // 2. Lấy dữ liệu Hero từ DB
            const { data: heroData, error } = await window.supabase
                .from('heroes')
                .select('*')
                .eq('id', userData.selected_hero_id)
                .single();

            if (error) {
                console.error("Lỗi load hero:", error);
                return;
            }

            
            // 3. Setup player với level bonus
            const playerLevel = userData.level || 1;

            // Tính bonus từ level
            const hpBonus = GameConfig.getLevelBonus(playerLevel, 'hp');
            const atkBonus = GameConfig.getLevelBonus(playerLevel, 'atk');
            const defBonus = GameConfig.getLevelBonus(playerLevel, 'def');

            this.player = {
                id: userData.id,
                display_name: userData.display_name,
                avatar_key: userData.avatar_key,
                level: playerLevel,
                exp: userData.exp || 0,
                coin: userData.coin || 0,
                role: userData.role,
                
                // HP: hero base + level bonus + equipment bonus
                base_hp: heroData.base_hp,
                max_hp: heroData.base_hp + hpBonus + (userData.hp_bonus || 0),
                hp_current: heroData.base_hp + hpBonus + (userData.hp_bonus || 0), // Sẽ override nếu có save game
                
                // ATK: hero base + level bonus + profile bonus
                base_atk: heroData.base_atk,
                atk: atkBonus + (userData.base_atk || 0),
                
                // DEF: hero base + level bonus + profile bonus  
                base_def: heroData.base_def || 0,
                def: defBonus + (userData.base_def || 0),
                
                sprite_url: heroData.image_url,
                selected_hero_id: userData.selected_hero_id,
                equipped_weapon: userData.equipped_weapon,
                equipped_armor: userData.equipped_armor,
                password: userData.password
            };

            // 4. Check có save game trên cloud không
            const savedGame = await this.saveGameService.load(userData.id);

            let startLocation, startStation, startStep;

            if (savedGame.success && savedGame.data) {
                console.log('[GameEngine] Found cloud save, restoring...');
                
                // Restore HP từ save
                this.player.hp_current = savedGame.data.current_hp;
                
                // Restore location/station/step
                const { data: location } = await window.supabase
                    .from('locations')
                    .select('*')
                    .eq('id', savedGame.data.current_location_id)
                    .single();
                
                const { data: station } = await window.supabase
                    .from('stations')
                    .select('*')
                    .eq('id', savedGame.data.current_station_id)
                    .single();
                
                startLocation = location;
                startStation = station;
                startStep = savedGame.data.current_step;
                
            } else {
                console.log('[GameEngine] No save found, starting fresh');
                
                // Load first location & station
                const { location, station } = await this.progressionManager.loadFirstLocation();
                startLocation = location;
                startStation = station;
                startStep = 1;
            }

            this.currentLocation = startLocation;
            this.currentStation = startStation;
            this.currentStep = startStep;

            // 4. Load first location & station
            const { location, station } = await this.progressionManager.loadFirstLocation();
            this.currentLocation = location;
            this.currentStation = station;
            this.currentStep = 1;

            // 5. Dựng UI
            this.uiManager.initUI(GameConfig.TOTAL_STEPS_PER_STATION);

            // 6. Render hero sprite
            this.uiManager.renderHeroSprite(this.player);

            // 7. Spawn monster
            this.monster = await this.monsterHandler.spawnFromStep(
                this.currentStation.id, 
                this.currentStep
            );

            // 8. Update all UI
            this.uiManager.updateAllUI(
                this.player,
                this.monster,
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 9. Load first question
            this.nextQuestion();

            console.log('[GameEngine] Game started successfully');

        } catch (err) {
            console.error('[GameEngine] Error starting game:', err);
            alert('Lỗi khởi động game: ' + err.message);
        }
    },

    /**
     * Khởi tạo tất cả managers và handlers
     * @private
     */
    _initManagers() {
        // Audio
        this.audioManager = new AudioManager({ 
            deathSrc: './sounds/Game_Over.mp3', 
            sfxPoolSize: 8 
        });

        // Utils
        this.effectsUtil = new EffectsUtil(this.audioManager);

        // Handlers
        this.monsterHandler = new MonsterHandler(window.supabase, this.effectsUtil);
        this.heroHandler = new HeroHandler(window.supabase, this.effectsUtil);

        // Managers
        this.stateManager = new StateManager();
        this.uiManager = new UIManager(this.effectsUtil);
        this.battleManager = new BattleManager(this.audioManager, this.effectsUtil, this.uiManager);
        this.progressionManager = new ProgressionManager(window.supabase, this.monsterHandler);
        this.saveGameService = new SaveGameService(window.supabase); 
        
        console.log('[GameEngine] All managers initialized');
    },

    /**
     * Gọi câu hỏi tiếp theo
     */
    async nextQuestion() {
        const questionType = this.monster?.questionType || 1;

        // Dọn question cũ
        if (window.QuestionManager?.currentQuestion) {
            if (typeof window.QuestionManager.currentQuestion.destroy === 'function') {
                window.QuestionManager.currentQuestion.destroy();
            }
        }

        // Hiển thị loading
        this.uiManager.showQuestionLoading();

        // Load question theo questionType
        if (window.QuestionManager) {
            try {
                console.log('[GameEngine] Loading question type:', questionType);
                await window.QuestionManager.loadType(questionType, this.monster?.type);
            } catch (error) {
                console.error("Lỗi load question:", error);
                setTimeout(() => this.nextQuestion(), 500);
            }
        }
    },

    /**
     * Xử lý khi người chơi trả lời đúng
     * @param {number} hits - số đòn hero sẽ tấn công
     * @param {boolean} advanceNext - có load câu hỏi tiếp không
     */
    async handleCorrect(hits = 1, advanceNext = true) {
        try {
            if (this.battleManager.isInBattle()) {
                console.log('[GameEngine] handleCorrect ignored, already battling');
                return;
            }

            const heroHits = Math.max(1, Number(hits) || 1);
            console.log('[GameEngine] handleCorrect', { heroHits, advanceNext });

            // Dừng speech nếu đang phát
            try { 
                if (window.speechSynthesis) window.speechSynthesis.cancel(); 
            } catch (e) {}

            // Process battle round
            await this.processBattleRound(heroHits, 0, advanceNext);

        } catch (err) {
            console.error('[GameEngine] handleCorrect error', err);
        }
    },

    /**
     * Xử lý khi người chơi trả lời sai
     */
    handleWrong() {
        if (this.battleManager.isInBattle()) return;
        // Monster sẽ tấn công trong processBattleRound
    },

    /**
     * Thực hiện 1 round battle
     * @param {number} correctCount - số đòn hero
     * @param {number} wrongCount - số đòn monster
     * @param {boolean} advanceNext - có load câu hỏi tiếp không
     */
    async processBattleRound(correctCount = 0, wrongCount = 0, advanceNext = true) {
        try {
            console.log('[GameEngine] processBattleRound start', { correctCount, wrongCount, advanceNext });

            if (!this.player || !this.monster) return;

            // Gọi BattleManager xử lý
            const result = await this.battleManager.processBattleRound(
                this.player,
                this.monster,
                correctCount,
                wrongCount
            );

            // Kiểm tra kết quả
            if (!result.monsterAlive) {
                console.log('[GameEngine] Monster defeated, handling...');
                await this._handleMonsterDefeat();
                return;
            }

            if (!result.playerAlive) {
                console.log('[GameEngine] Hero defeated, handling...');
                await this._handleHeroDefeat();
                return;
            }

            // Cả hai còn sống -> load câu hỏi tiếp nếu advanceNext = true
            if (advanceNext) {
                setTimeout(() => {
                    this.nextQuestion();
                }, GameConfig.TIMINGS.battleRoundDelay);
            }

        } catch (err) {
            console.error('[GameEngine] processBattleRound error', err);
            this.battleManager.reset();
        }
    },

    /**
     * Xử lý khi monster bị tiêu diệt
     * @private
     */
    async _handleMonsterDefeat() {
        try {
            // 1. Xử lý defeat (hồi máu, lấy coin/exp)
            const rewards = this.monsterHandler.handleDefeat(this.monster, this.player);
            
            console.log('[GameEngine] Monster defeated, rewards:', rewards);

            // ✅ 2. Cộng coin và exp cho player (trong memory)
            if (rewards.coinDropped > 0) {
                this.player.coin = (this.player.coin || 0) + rewards.coinDropped;
            }

            if (rewards.expGained > 0) {
                const oldExp = this.player.exp || 0;
                const oldLevel = this.player.level || 1;
                
                this.player.exp = oldExp + rewards.expGained;

                // ✅ 3. Check level up
                const levelCheck = window.LevelUtil.checkLevelUp(this.player.exp, oldLevel);

                if (levelCheck.leveledUp) {
                    console.log(`[GameEngine] Level up! ${oldLevel} -> ${levelCheck.newLevel}`);
                    
                    // ✅ Tính bonus stats từ level mới
                    const levelsGained = levelCheck.newLevel - oldLevel;
                    const hpGain = levelsGained * GameConfig.LEVEL_UP_BONUS.hp;
                    const atkGain = levelsGained * GameConfig.LEVEL_UP_BONUS.atk;
                    const defGain = levelsGained * GameConfig.LEVEL_UP_BONUS.def;
                    
                    // ✅ Cập nhật stats
                    this.player.level = levelCheck.newLevel;
                    this.player.exp = levelCheck.remainingExp;
                    this.player.max_hp += hpGain;
                    this.player.atk += atkGain;
                    this.player.def += defGain;
                    
                    // ✅ Hồi full HP khi level up
                    const oldHp = this.player.hp_current;
                    this.player.hp_current = this.player.max_hp;
                    const healedAmount = this.player.hp_current - oldHp;

                    // Delay để exp animation xong
                    setTimeout(() => {
                        // Hiệu ứng level up
                        if (this.effectsUtil) {
                            this.effectsUtil.showLevelUp('hero', levelCheck.newLevel);
                        }

                        // Hiệu ứng heal
                        if (healedAmount > 0 && this.effectsUtil) {
                            setTimeout(() => {
                                this.effectsUtil.showHealEffect('battleview', 'hero', healedAmount);
                            }, 500);
                        }

                        // Toast với stats gained
                        if (this.effectsUtil) {
                            this.effectsUtil.showToast(
                                `🎉 LEVEL UP! Level ${levelCheck.newLevel}! +${hpGain}HP +${atkGain}ATK +${defGain}DEF`,
                                'success',
                                3000
                            );
                        }
                    }, 1000);
                }
            }

            // ✅ 5. Lưu coin và exp vào database
            await this._savePlayerProgress();

            // 6. Update UI
            this.uiManager.updateBattleStatus(this.player, this.monster);

            // 7. Delay trước khi tiến hành
            await new Promise(r => setTimeout(r, GameConfig.TIMINGS.monsterDefeatDelay));

            // 8. Check unlock hero
            await this.heroHandler.checkAndUnlockHero(this.currentStation.id, this.player.id);

            // 9. Advance progression
            const progression = await this.progressionManager.advanceAfterMonsterDefeat(
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 10. Kiểm tra game complete
            if (progression.gameComplete) {
                alert('🎉 Chúc mừng! Bạn đã hoàn thành toàn bộ cuộc phiêu lưu!');
                this.showMainMenu();
                return;
            }

            // 11. Update state
            this.currentLocation = progression.location;
            this.currentStation = progression.station;
            this.currentStep = progression.step;

            // 12. Spawn monster mới
            if (progression.needsNewMonster) {
                this.monster = await this.monsterHandler.spawnFromStep(
                    this.currentStation.id,
                    this.currentStep
                );
            }

            // 13. Update UI
            this.uiManager.updateAllUI(
                this.player,
                this.monster,
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 14. Load question
            this.nextQuestion();

        } catch (err) {
            console.error('[GameEngine] _handleMonsterDefeat error', err);
        }
    },

    /**
     * Lưu coin, exp, level vào profiles + save game state lên cloud
     * @private
     */
    async _savePlayerProgress() {
        try {
            if (!this.player || !this.player.id) return;

            // 1. Lưu progression vào profiles (coin, exp, level - KHÔNG lưu HP)
            const { error: profileError } = await window.supabase
                .from('profiles')
                .update({
                    coin: this.player.coin || 0,
                    exp: this.player.exp || 0,
                    level: this.player.level || 1,
                    base_atk: this.player.atk - GameConfig.getLevelBonus(this.player.level, 'atk'), // Lưu bonus thuần (không tính level)
                    base_def: this.player.def - GameConfig.getLevelBonus(this.player.level, 'def')
                })
                .eq('id', this.player.id);

            if (profileError) {
                console.error('[GameEngine] Error saving profile:', profileError);
            } else {
                console.log('[GameEngine] Profile saved:', {
                    coin: this.player.coin,
                    exp: this.player.exp,
                    level: this.player.level
                });
            }

            // 2. Lưu game state lên cloud (HP, location, station, step)
            const saveResult = await this.saveGameService.save(this.player.id, {
                hp_current: this.player.hp_current,
                location_id: this.currentLocation?.id,
                station_id: this.currentStation?.id,
                step: this.currentStep,
                monster: this.monster
            });

            if (!saveResult.success) {
                console.error('[GameEngine] Error saving game state:', saveResult.error);
            }

        } catch (err) {
            console.error('[GameEngine] _savePlayerProgress error:', err);
        }
    },

    /**
     * Xử lý khi hero bị hạ gục
     * @private
     */
    async _handleHeroDefeat() {
        // 1. Xóa save game trên cloud
        if (this.player && this.player.id) {
            await this.saveGameService.delete(this.player.id);
            console.log('[GameEngine] Save game deleted (hero defeated)');
        }
        
        // 2. Xử lý defeat UI
        await this.heroHandler.handleDefeat(() => {
            this.showMainMenu(true); // skipSave = true vì đã xóa rồi
        });
    },

    /**
     * Lưu trạng thái game (gọi khi thoát game)
     */
    async saveGameState() {
        if (!this.player || !this.player.id) return;
        
        // Lưu lên cloud
        await this._savePlayerProgress();
        
        // Dừng sounds
        this.effectsUtil.stopAllSounds();
        
        console.log('[GameEngine] Game state saved to cloud');
    },

    /**
     * Khôi phục trạng thái game từ saved data
     */
    async restoreGameState(savedGame) {
        try {
            console.log('[GameEngine] Restoring game:', savedGame);

            // 1. Initialize managers
            this._initManagers();

            // 2. Render leaderboard widget
            if (window.LeaderboardWidget) {
                await window.LeaderboardWidget.render();
            }

            // 3. Khôi phục player
            this.player = savedGame.player;
            this.currentStep = savedGame.currentStep || 1;

            // 4. Khôi phục location & station
            if (savedGame.currentLocationId && savedGame.currentStationId) {
                const { data: location } = await window.supabase
                    .from('locations')
                    .select('*')
                    .eq('id', savedGame.currentLocationId)
                    .single();

                const { data: station } = await window.supabase
                    .from('stations')
                    .select('*')
                    .eq('id', savedGame.currentStationId)
                    .single();

                this.currentLocation = location;
                this.currentStation = station;
            } else {
                const { location, station } = await this.progressionManager.loadFirstLocation();
                this.currentLocation = location;
                this.currentStation = station;
            }

            // 5. Init UI
            this.uiManager.initUI(GameConfig.TOTAL_STEPS_PER_STATION);

            // 6. Render hero
            this.uiManager.renderHeroSprite(this.player);

            // 7. Khôi phục monster
            if (savedGame.monster && savedGame.monster.id) {
                // Load full monster data từ DB
                const { data: monsterData } = await window.supabase
                    .from('monsters')
                    .select('*')
                    .eq('id', savedGame.monster.id)
                    .single();
                
                if (monsterData) {
                    this.monster = {
                        ...monsterData,
                        hp: savedGame.monster.hp,
                        max_hp: monsterData.base_hp,
                        atk: monsterData.base_atk,
                        def: monsterData.base_def || 0,
                        state: 'idle',
                        isDead: false,
                        sprite_url: monsterData.image_url,
                        questionType: GameConfig.getDefaultQuestionType(monsterData.type)
                    };
                    
                    this.uiManager.renderMonsterSprite(this.monster);
                }
            } else {
                // Spawn monster mới từ step
                this.monster = await this.monsterHandler.spawnFromStep(
                    this.currentStation.id,
                    this.currentStep
                );
            }

            // 8. Update UI
            this.uiManager.updateAllUI(
                this.player,
                this.monster,
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            await new Promise(r => setTimeout(r, 100));
            this.uiManager.renderAdminButtons();

            // 9. Load question
            this.nextQuestion();

            console.log('[GameEngine] Game restored successfully');

        } catch (err) {
            console.error('[GameEngine] restoreGameState error', err);
            alert('Lỗi khôi phục game: ' + err.message);
        }
    },

    /**
     * Hiển thị lại menu chính
     */
    async showMainMenu(skipSave = false) {
        // Dừng game
        this.battleManager.reset();

        if (window.QuestionManager) {
            window.QuestionManager.destroy();
        }
        
        try { 
            if (window.speechSynthesis) window.speechSynthesis.cancel(); 
        } catch (e) {}
        
        this.effectsUtil.stopAllSounds();

        // Lưu game nếu cần
        if (!skipSave) {
            await this.saveGameState();  // ← Thêm await
        } else {
            await this.clearSaveState();  // ← Thêm await
        }

        // Clear UI
        this.uiManager.clearAllUI();

        // Reset state
        this.player = null;
        this.monster = null;
        this.currentStep = 1;

        // Quay về màn hình chọn profiles
        if (window.AuthComponent) {
            window.AuthComponent.displayLoginMenu();
        }
    },

    /**
     * Xóa save state
     */
    async clearSaveState() {
        if (this.player && this.player.id) {
            // Xóa trên cloud
            await this.saveGameService.delete(this.player.id);
            
            // Xóa localStorage (backup cũ)
            this.stateManager.clear(this.player.id);
            
            console.log('[GameEngine] Save state cleared');
        }
    },

    /**
     * Dừng game hoàn toàn
     */
    stopGame() {
        this.effectsUtil.stopAllSounds();

        // Dọn dẹp câu hỏi hiện tại
        if (window.QuestionManager) {
            window.QuestionManager.destroy();
        }

        // Xóa nội dung các vùng
        DOMUtil.clearChildren('questionarea');
        DOMUtil.clearChildren('battleview');
    }
};

// Expose ra window
window.GameEngine = GameEngine;

// Export
export default GameEngine;