/**
 * GameEngine.js (Refactored)
 * Orchestrator chính - điều phối các managers và handlers
 */

import "@/css/game.css";
import GameConfig from './GameConfig.js';
import DOMUtil from '../utils/DOMUtil.js';
import EffectsUtil from '../utils/EffectsUtil.js';
import MonsterHandler from '../handlers/MonsterHandler.js';
import HeroHandler from '../handlers/HeroHandler.js';
import StateManager from '../managers/StateManager.js';
import UIManager from '../managers/UIManager.js';
import BattleManager from '../managers/BattleManager.js';
import ProgressionManager from '../managers/ProgressionManager.js';

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

    /**
     * Khởi tạo game với dữ liệu User từ Auth
     */
    async start(userData) {
        try {
            console.log('[GameEngine] Starting game with user:', userData);

            // 1. Initialize managers
            this._initManagers();

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

            // 3. Setup player
            this.player = {
                ...userData,
                base_hp: heroData.base_hp,
                hp_bonus: userData.hp_current || 0,
                max_hp: heroData.base_hp + (userData.hp_current || 0),
                hp_current: heroData.base_hp + (userData.hp_current || 0),
                atk: heroData.base_atk,
                sprite_url: heroData.image_url
            };

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
            // 1. Xử lý defeat (hồi máu nếu cần)
            this.monsterHandler.handleDefeat(this.monster, this.player);

            // 2. Update UI
            this.uiManager.updateBattleStatus(this.player, this.monster);

            // 3. Delay trước khi tiến hành
            await new Promise(r => setTimeout(r, GameConfig.TIMINGS.monsterDefeatDelay));

            // 4. Check unlock hero
            await this.heroHandler.checkAndUnlockHero(this.currentStation.id);

            // 5. Advance progression
            const progression = await this.progressionManager.advanceAfterMonsterDefeat(
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 6. Kiểm tra game complete
            if (progression.gameComplete) {
                alert('🎉 Chúc mừng! Bạn đã hoàn thành toàn bộ cuộc phiêu lưu!');
                this.showMainMenu();
                return;
            }

            // 7. Update state
            this.currentLocation = progression.location;
            this.currentStation = progression.station;
            this.currentStep = progression.step;

            // 8. Spawn monster mới
            if (progression.needsNewMonster) {
                this.monster = await this.monsterHandler.spawnFromStep(
                    this.currentStation.id,
                    this.currentStep
                );
            }

            // 9. Update UI
            this.uiManager.updateAllUI(
                this.player,
                this.monster,
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 10. Load question
            this.nextQuestion();

        } catch (err) {
            console.error('[GameEngine] _handleMonsterDefeat error', err);
        }
    },

    /**
     * Xử lý khi hero bị hạ gục
     * @private
     */
    async _handleHeroDefeat() {
        await this.heroHandler.handleDefeat(() => {
            this.showMainMenu(true);
        });
    },

    /**
     * Lưu trạng thái game
     */
    saveGameState() {
        const success = this.stateManager.save({
            player: this.player,
            monster: this.monster,
            currentLocation: this.currentLocation,
            currentStation: this.currentStation,
            currentStep: this.currentStep
        });

        if (success) {
            this.effectsUtil.stopAllSounds();
        }
    },

    /**
     * Khôi phục trạng thái game từ localStorage
     */
    async restoreGameState(savedGame) {
        try {
            console.log('[GameEngine] Restoring game:', savedGame);

            // 1. Initialize managers
            this._initManagers();

            // 2. Khôi phục player
            this.player = savedGame.player;
            this.currentStep = savedGame.currentStep || 1;

            // 3. Khôi phục location & station
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

            // 4. Init UI
            this.uiManager.initUI(GameConfig.TOTAL_STEPS_PER_STATION);

            // 5. Render hero
            this.uiManager.renderHeroSprite(this.player);

            // 6. Khôi phục monster
            if (savedGame.monster) {
                this.monster = savedGame.monster;

                if (this.monster.type === 'boss' || this.monster.type === 'final boss') {
                    this.effectsUtil.playMonsterBGM(this.monster.type);
                }

                if (!this.monster.questionType) {
                    this.monster.questionType = GameConfig.getDefaultQuestionType(this.monster.type);
                }

                this.uiManager.renderMonsterSprite(this.monster);
            } else {
                this.monster = await this.monsterHandler.spawnFromStep(
                    this.currentStation.id,
                    this.currentStep
                );
            }

            // 7. Update UI
            this.uiManager.updateAllUI(
                this.player,
                this.monster,
                this.currentLocation,
                this.currentStation,
                this.currentStep,
                GameConfig.TOTAL_STEPS_PER_STATION
            );

            // 8. Load question
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
    showMainMenu(skipSave = false) {
        // Dừng game
        this.battleManager.reset();
        
        try { 
            if (window.speechSynthesis) window.speechSynthesis.cancel(); 
        } catch (e) {}
        
        this.effectsUtil.stopAllSounds();

        // Lưu game nếu cần
        if (!skipSave) {
            this.saveGameState();
        } else {
            this.clearSaveState();
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
    clearSaveState() {
        if (this.player && this.player.id) {
            this.stateManager.clear(this.player.id);
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