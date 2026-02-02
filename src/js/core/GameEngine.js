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
    isEndlessMode: false,

    /**
     * Khởi tạo game với dữ liệu User từ Auth
     */
    async start(userData) {
        try {
            console.log('[GameEngine] Starting game with user:', userData);
            this.isEndlessMode = false; 

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
                .maybeSingle();

            if (error) {
                console.error("Lỗi load hero:", error);
                return;
            }

            
            // 3. Setup player với level bonus
            const playerLevel = userData.level || 1;

            // ✅ Bonus từ profiles (đã lưu từ level up trước)
            const hpBonus = userData.hp_bonus || 0;
            const atkBonus = userData.base_atk || 0;  // base_atk trong profiles là bonus
            const defBonus = userData.base_def || 0;  // base_def trong profiles là bonus

            this.player = {
                id: userData.id,
                display_name: userData.display_name,
                avatar_key: userData.avatar_key,
                level: playerLevel,
                exp: userData.exp || 0,
                coin: userData.coin || 0,
                role: userData.role,
                
                // HP: hero base + bonus từ profiles
                base_hp: heroData.base_hp,
                hp_bonus: hpBonus,
                max_hp: heroData.base_hp + hpBonus,
                hp_current: heroData.base_hp + hpBonus, // Sẽ override nếu có save game
                
                // ATK: hero base (dùng trong tính damage) + bonus từ profiles
                base_atk: atkBonus,  // Lưu bonus từ profiles (dùng để save lại)
                atk: atkBonus,       // ATK hiện tại (dùng trong battle)
                hero_base_atk: heroData.base_atk,  // Lưu base của hero để tính damage
                
                // DEF: hero base + bonus từ profiles  
                base_def: defBonus,  // Lưu bonus từ profiles
                def: defBonus,       // DEF hiện tại (dùng trong battle)
                hero_base_def: heroData.base_def || 0,  // Lưu base của hero để tính damage
                
                sprite_url: heroData.image_url,
                selected_hero_id: userData.selected_hero_id,
                equipped_weapon: userData.equipped_weapon,
                equipped_armor: userData.equipped_armor,
                password: userData.password
            };

            // 4. Check có save game trên cloud không
            const savedGame = await this.saveGameService.load(userData.id);

            let startLocation, startStation, startStep;

            if (savedGame.success && savedGame.data && savedGame.data.current_location_id) {
                console.log('[GameEngine] Found cloud save, restoring...');
                
                // Restore HP từ save
                this.player.hp_current = savedGame.data.current_hp;
                
                // Restore location/station/step
                const { data: location } = await window.supabase
                    .from('locations')
                    .select('*')
                    .eq('id', savedGame.data.current_location_id)
                    .maybeSingle();
                
                const { data: station } = await window.supabase
                    .from('stations')
                    .select('*')
                    .eq('id', savedGame.data.current_station_id)
                    .maybeSingle();
                
                startLocation = location;
                startStation = station;
                startStep = savedGame.data.current_step;
                
            } else {
                console.log('[GameEngine] No save found, starting fresh');  
                const { location, station } = await this.progressionManager.loadFirstLocation();
                startLocation = location;
                startStation = station;
                startStep = 1;      
            }

            this.currentLocation = startLocation;
            this.currentStation = startStation;
            this.currentStep = startStep;

            // 5. Dựng UI
            this.uiManager.initUI(GameConfig.TOTAL_STEPS_PER_STATION);

            // 6. Render hero sprite
            this.uiManager.renderHeroSprite(this.player);

            // 7. Spawn monster
            this.monster = await this.monsterHandler.spawnFromStep(
                this.currentStation.id, 
                this.currentStep,
                this.currentLocation
            );
            console.log(
                '[DEBUG monster tier]',
                this.monster.name,
                this.monster.locationTier
              );
            
            this.uiManager.renderMonsterSprite(this.monster);

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
                    
                    // ✅ Tính số stats bonus cần THÊM vào profiles
                    const levelsGained = levelCheck.newLevel - oldLevel;
                    const hpGainPerLevel = GameConfig.LEVEL_UP_BONUS.hp;
                    const atkGainPerLevel = GameConfig.LEVEL_UP_BONUS.atk;
                    const defGainPerLevel = GameConfig.LEVEL_UP_BONUS.def;
                    
                    const hpGain = levelsGained * hpGainPerLevel;
                    const atkGain = levelsGained * atkGainPerLevel;
                    const defGain = levelsGained * defGainPerLevel;
                    
                    // ✅ Cập nhật stats trong memory
                    this.player.level = levelCheck.newLevel;
                    this.player.exp = levelCheck.remainingExp;
                    
                    // ✅ Cộng bonus vào profiles (sẽ lưu vào DB)
                    this.player.hp_bonus = (this.player.hp_bonus || 0) + hpGain;
                    this.player.base_atk = (this.player.base_atk || 0) + atkGain;  // base_atk trong profiles là bonus
                    this.player.base_def = (this.player.base_def || 0) + defGain;  // base_def trong profiles là bonus
                    
                    // ✅ Tính lại max_hp và stats hiện tại
                    this.player.max_hp += hpGain;  // Tăng max HP
                    this.player.atk += atkGain;    // Tăng ATK hiện tại (dùng trong battle)
                    this.player.def += defGain;    // Tăng DEF hiện tại (dùng trong battle)
                    
                    // ✅ Hồi full HP khi level up
                    const oldHp = this.player.hp_current;
                    this.player.hp_current = this.player.max_hp;
                    const healedAmount = this.player.hp_current - oldHp;

                    // ✅ LƯU NGAY VÀO DATABASE (bao gồm cả bonus stats)
                    await this._savePlayerProgress();

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

            // ✅ 7.1. Nếu đang ở Endless Mode → Spawn boss mới
            if (this.isEndlessMode) {
                await this._startEndlessMode(); // Spawn boss mới
                return;
            }

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
                await this._startEndlessMode();
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
                    this.currentStep,
                    this.currentLocation
                );
                console.log(
                    '[DEBUG monster tier]',
                    this.monster.name,
                    this.monster.locationTier
                  );
                this.uiManager.renderMonsterSprite(this.monster);         
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
     * Lưu coin, exp, level, bonus stats vào profiles + save game state lên cloud
     * @private
     */
    async _savePlayerProgress() {
        try {
            if (!this.player || !this.player.id) return;

            console.log('=== SAVING TO DATABASE ===');
            console.log('Will save hp_bonus:', this.player.hp_bonus);
            console.log('Will save base_atk:', this.player.base_atk);
            console.log('Will save base_def:', this.player.base_def);

            // ✅ 1. Lưu progression + BONUS STATS vào profiles
            const { error: profileError } = await window.supabase
                .from('profiles')
                .update({
                    coin: this.player.coin || 0,
                    exp: this.player.exp || 0,
                    level: this.player.level || 1,
                    hp_bonus: this.player.hp_bonus || 0,      // ✅ Lưu HP bonus
                    base_atk: this.player.base_atk || 0,      // ✅ Lưu ATK bonus
                    base_def: this.player.base_def || 0       // ✅ Lưu DEF bonus
                })
                .eq('id', this.player.id);

            if (profileError) {
                console.error('[GameEngine] Error saving profile:', profileError);
            } else {
                console.log('[GameEngine] Profile saved:', {
                    coin: this.player.coin,
                    exp: this.player.exp,
                    level: this.player.level,
                    hp_bonus: this.player.hp_bonus,
                    base_atk: this.player.base_atk,
                    base_def: this.player.base_def
                });
            }

            // 2. Lưu game state lên cloud (HP, location, station, step)
            const saveResult = await this.saveGameService.save(this.player.id, {
                hp_current: this.player.hp_current,
                location_id: this.currentLocation?.id,
                station_id: this.currentStation?.id,
                currentStep: this.currentStep,
                isEndlessMode: this.isEndlessMode,
                monster: this.monster && this.monster.hp > 0 ? this.monster : null
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
            this.isEndlessMode = savedGame.isEndlessMode || false; 

            // 5. Init UI
            this.uiManager.initUI(GameConfig.TOTAL_STEPS_PER_STATION);

            // 6. Render hero
            this.uiManager.renderHeroSprite(this.player);

            // 6.5 Restore location & station (NON-ENDLESS only)
            if (!this.isEndlessMode) {
                // Guard dữ liệu
                if (!savedGame.currentLocationId || !savedGame.currentStationId) {
                    throw new Error('Invalid save data: missing location or station');
                }

                // Load location
                const { data: location, error: locErr } = await window.supabase
                    .from('locations')
                    .select('*')
                    .eq('id', savedGame.currentLocationId)
                    .maybeSingle();

                if (locErr) throw locErr;
                this.currentLocation = location;

                // Load station
                const { data: station, error: stErr } = await window.supabase
                    .from('stations')
                    .select('*')
                    .eq('id', savedGame.currentStationId)
                    .maybeSingle();

                if (stErr) throw stErr;
                this.currentStation = station;

            } else {
                // Endless mode: KHÔNG có map cố định
                this.currentLocation = null;
                this.currentStation = null;
            }


            // 7. Khôi phục monster
            if (savedGame.monster && savedGame.monster.id) {
                // Load full monster data từ DB
                const { data: monsterData } = await window.supabase
                    .from('monsters')
                    .select('*')
                    .eq('id', savedGame.monster.id)
                    .maybeSingle();
                
                if (monsterData) {
                    this.monster = {
                        ...monsterData,
                        hp: savedGame.monster.hp,
                        max_hp: monsterData.base_hp,
                        atk: monsterData.base_atk,
                        def: monsterData.base_def || 0,
                        state: 'idle',
                        isDead: false,
                        hasDroppedReward: false,
                        sprite_url: monsterData.image_url,
                        questionType: GameConfig.getDefaultQuestionType(monsterData.type)
                    };
                    
                    // ⭐ FIX: gán lại locationTier khi restore
                    if (this.currentLocation?.order_index) {
                        this.monster.locationTier = GameConfig.getLocationTier(
                        this.currentLocation.order_index
                        );
                    } else {
                        this.monster.locationTier = 'early'; // fallback an toàn
                    }
  
                    this.uiManager.renderMonsterSprite(this.monster);
                    console.log(
                        '[DEBUG monster tier]',
                        this.monster.name,
                        this.monster.locationTier
                      );
                }
            } else {
                // Spawn monster mới từ step
                this.monster = await this.monsterHandler.spawnFromStep(
                    this.currentStation.id,
                    this.currentStep,
                    this.currentLocation
                );
                console.log(
                    '[DEBUG monster tier]',
                    this.monster.name,
                    this.monster.locationTier
                  );
                this.uiManager.renderMonsterSprite(this.monster);              
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
        this.isEndlessMode = false; 

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
    },

    /**
     * Bắt đầu chế độ luyện tập (Endless Mode)
     * Spawn random boss/final boss sau khi hoàn thành map
     * @private
     */
    async _startEndlessMode() {
        try {
            // 1. Thông báo
            if (!this.isEndlessMode && this.effectsUtil) {
                this.effectsUtil.showToast(
                    '🎉 Chúc mừng! Bạn đã hoàn thành! Giờ là chế độ LUYỆN TẬP!',
                    'success',
                    4000
                );
            }

            // Delay để toast hiện
            await new Promise(r => setTimeout(r, 2000));

            // 2. Set endless mode flag
            this.isEndlessMode = true;
            this.currentLocation = { name: 'Endless Mode' };
            this.currentStation = { name: 'Luyện Tập' };
            this.currentStep = 0; // Không có step

            // 3. Random spawn boss hoặc final boss
            const bossTypes = ['boss', 'final boss'];
            const randomType = bossTypes[Math.floor(Math.random() * bossTypes.length)];

            // Lấy random monster theo type
            const { data: monsters, error } = await window.supabase
                .from('monsters')
                .select('*')
                .eq('type', randomType);

            if (error || !monsters || monsters.length === 0) {
                console.error('[GameEngine] No boss found for endless mode');
                ('Lỗi: Không tìm thấy boss!');
                this.showMainMenu();
                return;
            }

            const randomMonster = monsters[Math.floor(Math.random() * monsters.length)];

            this.monster = {
                ...randomMonster,
                hp: randomMonster.base_hp,
                max_hp: randomMonster.base_hp,
                atk: randomMonster.base_atk,
                def: randomMonster.base_def || 0,
                state: 'idle',
                isDead: false,
                sprite_url: randomMonster.image_url,
                questionType: GameConfig.getDefaultQuestionType(randomMonster.type)
            };

            // 4. Render monster
            this.uiManager.renderMonsterSprite(this.monster);

            // 5. Phát BGM boss
            if (this.effectsUtil) {
                this.effectsUtil.playMonsterBGM(this.monster.type);
            }

            // 6. Update UI
            this.uiManager.updateAllUI(
                this.player,
                this.monster,
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 7. Load question
            this.nextQuestion();

            console.log('[GameEngine] Endless mode started, spawned:', this.monster.name);

        } catch (err) {
            console.error('[GameEngine] _startEndlessMode error:', err);
            alert('Lỗi khi bắt đầu chế độ luyện tập!');
            this.showMainMenu();
        }
    }
};

// Expose ra window
window.GameEngine = GameEngine;

// Export
export default GameEngine;