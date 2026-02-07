/**
 * UIManager.js
 * Quản lý tất cả các cập nhật UI trong game
 */

import GameConfig from '../core/GameConfig.js';
import DOMUtil from '../utils/DOMUtil.js';

class UIManager {
    constructor(effectsUtil) {
        this.effects = effectsUtil;
    }

    /**
     * Khởi tạo UI game ban đầu
     * @param {number} totalSteps 
     */
    initUI(totalSteps = 10) {
        // --- PHẦN 1: Xử lý Battle View ---
        const battleView = DOMUtil.getById('battleview');
        if (battleView) {

        // Tạo progress bar chia đoạn
        const segments = Array.from({ length: totalSteps }, (_, i) => {
            return `<div id="step-${i+1}" 
                        class="flex-1 h-6 mx-0.5 rounded-md border border-white 
                                bg-gray-300 transition-colors duration-300"></div>`;
        }).join('');

        // Giữ lại nội dung cũ (div#hero và div#monster) và chỉ chèn thêm UI overlay
        const uiOverlay = `
            <div id="progress-bar" class="absolute top-4 left-1/2 -translate-x-1/2 w-2/3 flex z-20">
                ${segments}
            </div>

            <div class="absolute inset-0 flex justify-between items-end px-10 pb-4 pointer-events-none">
                <!-- Hero HP Bar -->
                <div id="hero-hp-bar" class="w-32 h-8 bg-gray-200 rounded-lg border-2 border-white overflow-hidden relative shadow-lg">
                    <div id="hero-hp-fill" class="h-full bg-green-500 transition-all duration-300" style="width: 100%"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow-md">
                        <span id="hero-hp-text">100/100</span>
                    </div>
                </div>
            
                <!-- Monster HP Bar -->
                <div id="monster-hp-bar" class="w-32 h-8 bg-gray-200 rounded-lg border-2 border-white overflow-hidden relative shadow-lg">
                    <div id="monster-hp-fill" class="h-full bg-red-500 transition-all duration-300" style="width: 100%"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow-md">
                        <span id="monster-hp-text">50/50</span>
                    </div>
                </div>
            </div>
        `;

        // Xóa các UI cũ nếu có nhưng giữ lại sprite
        const existingOverlays = battleView.querySelectorAll('.absolute');
        existingOverlays.forEach(el => { 
            if(!el.classList.contains('sprite')) el.remove(); 
        });

        battleView.insertAdjacentHTML('beforeend', uiOverlay);
        }

        console.log('[UIManager] UI initialized');
    }

    /**
     * Cập nhật toàn bộ UI
     * @param {Object|any} stateOrPlayer - Có thể truyền object state hoặc legacy positional player
     * @param {Object} monster
     * @param {Object} location
     * @param {Object} station
     * @param {number} currentStep
     * @param {number} totalSteps 
     */
    updateAllUI(stateOrPlayer, monster, location, station, currentStep, totalSteps = 10) {
        const isStateObject = stateOrPlayer && typeof stateOrPlayer === 'object' && (
            Object.prototype.hasOwnProperty.call(stateOrPlayer, 'player') ||
            Object.prototype.hasOwnProperty.call(stateOrPlayer, 'monster') ||
            Object.prototype.hasOwnProperty.call(stateOrPlayer, 'location') ||
            Object.prototype.hasOwnProperty.call(stateOrPlayer, 'station')
        );

        if (!isStateObject && arguments.length > 1) {
            console.warn('[UIManager] updateAllUI positional args is deprecated. Use updateAllUI({ player, monster, location, station, currentStep, totalSteps }).');
        }

        const fallback = window.GameEngine ? {
            player: window.GameEngine.player,
            monster: window.GameEngine.monster,
            location: window.GameEngine.currentLocation,
            station: window.GameEngine.currentStation,
            currentStep: window.GameEngine.currentStep,
            totalSteps: GameConfig.TOTAL_STEPS_PER_STATION
        } : {};

        const uiState = isStateObject
            ? { ...fallback, ...stateOrPlayer }
            : {
                ...fallback,
                player: stateOrPlayer,
                monster,
                location,
                station,
                currentStep,
                totalSteps
            };

        const safeTotalSteps = Number.isFinite(Number(uiState.totalSteps)) && Number(uiState.totalSteps) > 0
            ? Number(uiState.totalSteps)
            : 10;

        // 1. Cập nhật player info card
        this.updatePlayerCard(uiState.player);

        this.toggleLeaderboardVisibility(true);

        // 2. Cập nhật monster info
        this.updateMonsterInfo(uiState.monster, uiState.location, uiState.station, uiState.currentStep, safeTotalSteps);

        // 3. Cập nhật progress bar
        this.updateProgressBar(uiState.currentStep, safeTotalSteps, uiState.monster?.type);

        // 4. Cập nhật HP bars
        this.updateBattleStatus(uiState.player, uiState.monster);

        if (window.GameEngine?.isEndlessMode) {
            console.log('[UIManager] Endless mode detected, hiding progress bar');

            // Ẩn progress bar
            const progressBar = document.getElementById('progress-bar');
            if (progressBar) progressBar.style.display = 'none';
            
            // Hiện text "Luyện Tập"
            const stationName = document.getElementById('station-name');
            if (stationName) stationName.textContent = '⚔️ LUYỆN TẬP';
        }

        // 5. Thêm nút Exit
        this.addExitButton();

        this.showhistory();

        // 6. Render admin buttons (nếu là admin)
        this.renderAdminButtons();

    }

    /**
     * Cập nhật player info card
     */
    updatePlayerCard(player) {
        const slot = DOMUtil.getById('user-info-slot');
        if (!slot || !player) return;

        // Show slot
        slot.classList.remove('hidden');

        // ✅ Tính % exp progress
        const expProgress = window.LevelUtil 
            ? window.LevelUtil.getLevelProgress(player.exp || 0, player.level || 1)
            : 0;

        const expNeeded = window.LevelUtil 
            ? window.LevelUtil.getExpForNextLevel(player.level || 1)
            : 100;

        // Update nội dung
        slot.innerHTML = `
            <div class="flex flex-col items-center gap-3 w-full">
                <div class="text-5xl">${player.avatar_key || '👤'}</div>
                <div class="text-center w-full">
                    <p class="font-black text-xl text-blue-700">${player.display_name}</p>
                    <p class="text-sm font-bold text-gray-500">Level ${player.level || 1}</p>
                    
                    <!-- EXP Progress Bar -->
                    <div class="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden border border-gray-300">
                        <div class="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500" 
                            style="width: ${expProgress}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${player.exp || 0} / ${expNeeded} EXP</p>
                    
                    <!-- Coin Display -->
                    <div class="mt-3 bg-yellow-100 rounded-full px-3 py-1 inline-flex items-center gap-1">
                        <span class="text-xl">💰</span>
                        <span class="font-black text-yellow-700">${player.coin || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Cập nhật monster info
     */
    updateMonsterInfo(monster, location, station, currentStep, totalSteps) {
        const container = DOMUtil.getById('monster-info-slot');
        if (!container) return;

        container.classList.remove('hidden');

        // ✅ Chỉ update nội dung, không tạo wrapper mới
        container.innerHTML = `
            <h3 class="text-xl font-black text-red-600 uppercase mb-2">Tiến trình</h3>
            <div class="bg-white/50 rounded-2xl p-3 border-2 border-purple-200 mb-3">
                <p class="text-xs text-purple-600 font-bold">📍 ${location?.name || '...'}</p>
                <p class="text-xs text-blue-600">🚉 ${station?.name || '...'} (${currentStep}/${totalSteps})</p>
            </div>
            
            <h3 class="text-xl font-black text-red-600 uppercase mb-2">Đối thủ</h3>
            <div class="bg-white/50 rounded-2xl p-3 border-2 border-red-200">
                <p class="font-bold text-lg">${monster?.name || '...'}</p>
                <p class="text-sm text-red-500 font-bold uppercase">${monster?.type || 'normal'}</p>
                <div class="mt-4 text-xs font-bold text-gray-500 italic">
                    "Cố lên! Đánh bại nó để đi tiếp nào."
                </div>
            </div>
        `;
    }

    showhistory() {
       const historyslot = DOMUtil.getById('answers-history-slot');
        if (!historyslot) return;

        historyslot.classList.remove('hidden');
    }

    /**
     * Bật/tắt hiển thị leaderboard
     * @param {boolean} hidden
     */
    toggleLeaderboardVisibility(hidden = false) {
        const leaderboardSlot = DOMUtil.getById('leaderboard-slot');
        if (!leaderboardSlot) return;

        leaderboardSlot.classList.toggle('hidden', hidden);
    }

    /**
     * Cập nhật progress bar
     */
    updateProgressBar(currentStep, totalSteps, monsterType = 'normal') {
        for (let i = 1; i <= totalSteps; i++) {
            const seg = DOMUtil.getById(`step-${i}`);
            if (!seg) continue;

            if (i < currentStep) {
                seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-green-500";
            } else if (i === currentStep) {
                if (monsterType === "normal") {
                    seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-blue-400";
                } else if (monsterType === "elite") {
                    seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-yellow-400";
                } else if (monsterType === "boss" || monsterType === "final boss") {
                    seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-red-500";
                }
            } else {
                seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-gray-300";
            }
        }
    }

    /**
     * Cập nhật chỉ số máu trong trận đấu
     */
    updateBattleStatus(player, monster) {
        // 1. Cập nhật máu Hero
        if (player) {
            const heroHpPercent = (player.hp_current / player.max_hp) * 100;
            
            DOMUtil.setStyle('hero-hp-fill', 'width', `${heroHpPercent}%`);
            
            const color = heroHpPercent < 30 ? GameConfig.COLORS.hpLow : GameConfig.COLORS.hpNormal;
            DOMUtil.setStyle('hero-hp-fill', 'backgroundColor', color);

            const heroHpText = DOMUtil.getById('hero-hp-text');
            if (heroHpText) {
                heroHpText.innerText = `${Math.ceil(player.hp_current)}/${player.max_hp}`;
            }
        }

        // 2. Cập nhật máu Monster
        if (monster) {
            const monsterHpPercent = (monster.hp / monster.max_hp) * 100;
            
            DOMUtil.setStyle('monster-hp-fill', 'width', `${monsterHpPercent}%`);

            const monsterHpText = DOMUtil.getById('monster-hp-text');
            if (monsterHpText) {
                monsterHpText.innerText = `${Math.ceil(monster.hp)}/${monster.max_hp}`;
            }
        }
    }

    /**
     * Thêm nút Exit vào action-buttons-slot
     */
    addExitButton() {
        const slot = DOMUtil.getById('action-buttons-slot');
        if (!slot) return;
    
        // Xóa nút cũ nếu có
        const oldExitBtn = DOMUtil.getById('exit-menu-btn');
        if (oldExitBtn) oldExitBtn.remove();
    
        // Tạo nút mới
        const exitBtn = DOMUtil.createElement('button', {
            id: 'exit-menu-btn',
            className: 'w-full p-3 rounded-2xl bg-red-400 hover:bg-red-500 text-white font-bold transition-all shadow-md',
            innerHTML: '🚪 Thoát ra Menu'
        });
    
        exitBtn.onclick = async () => {
            // ✅ Check nếu monster đã chết → Không cho thoát
            if (window.GameEngine?.monster?.hp <= 0) {
                this.effects.showToast('⚠️ Đang xử lý chiến thắng, vui lòng chờ!','error',1000);
                return;
            }
    
            // ✅ Hiện confirm
            const userConfirmed = window.confirm('Bạn có muốn lưu game và thoát ra menu?');
            
            if (userConfirmed && window.GameEngine) {
                await window.GameEngine.showMainMenu(false);
            }
            // User click Cancel → Không làm gì, tiếp tục chơi
        };
    
        slot.appendChild(exitBtn);
    }

    /**
     * Render admin buttons (Kill Monster + Admin Link) vào DASHBOARD
     * Chỉ hiển thị khi role = 'admin'
     */
    renderAdminButtons() {
        // Lấy dashboard container
        const dashboard = DOMUtil.getById('dashboard');
        if (!dashboard) return;

        // Xóa nút cũ nếu có
        //const oldNextQuestionBtn = DOMUtil.getById('next-question-btn');
        //const oldKillBtn = DOMUtil.getById('kill-btn');
        //const oldAdminBtn = DOMUtil.getById('admin-link-btn');
        //if (oldNextQuestionBtn) oldNextQuestionBtn.remove();
        //if (oldKillBtn) oldKillBtn.remove();
        //if (oldAdminBtn) oldAdminBtn.remove();

        [
            'kill-btn',
            'admin-link-btn',
            'test-question-btn',
            'test-question-input'
          ].forEach(id => {
              const el = DOMUtil.getById(id);
              if (el) el.remove();
          });

        // Lấy role từ GameEngine
        const GE = window.GameEngine;
        const role = GE?.player?.role;

        // Nếu KHÔNG phải admin thì return (không hiển thị)
        if (role !== 'admin') {
            console.log('[UIManager] User is not admin, admin buttons hidden');
            return;
        }

        // ✅ Input nhập question type
        const testInput = DOMUtil.createElement('input', {
            id: 'test-question-input',
            className: 'w-full mb-2 p-3 rounded-2xl border-2 border-purple-400 text-center font-bold text-lg',
        });
        testInput.type = 'number';
        testInput.min = '1';
        testInput.placeholder = 'Question Type (vd: 4)';

        // ✅ Nút Test Question
        const testBtn = DOMUtil.createElement('button', {
            id: 'test-question-btn',
            className: 'w-full mb-2 p-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-md',
            innerHTML: '🧪 Test Question'
        });

        testBtn.onclick = () => {
            const value = testInput.value;
            if (!value) {
                alert('Nhập question type trước');
                return;
            }

            if (window.GameEngine?.testQuestion) {
                window.GameEngine.testQuestion(value);
            } else {
                console.error('[Admin] GameEngine.testQuestion not found');
            }
        };
         

        // ✅ Tạo nút Kill Monster (Test)
        const killBtn = DOMUtil.createElement('button', {
            id: 'kill-btn',
            className: 'w-full mb-2 p-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold transition-all shadow-md',
            innerHTML: '💀 Kill Monster'
        });

        killBtn.onclick = () => {
            try {
                if (!GE || !GE.monster) return;
                if (GE.battleManager?.isInBattle && GE.battleManager.isInBattle()) return;

                GE.monster.hp = 0;
                GE.monster.isDead = true;

                requestAnimationFrame(() => {
                    window.UIManager?.updateBattleStatus?.(GE.player, GE.monster);
                    window.UIManager?.renderMonsterSprite?.(GE.monster);
                });

                try {
                    if (typeof GE._handleMonsterDefeat === 'function') {
                        GE._handleMonsterDefeat();
                    } else if (typeof GE.handleMonsterDefeat === 'function') {
                        GE.handleMonsterDefeat();
                    } else if (typeof GE.processBattleRound === 'function') {
                        GE.processBattleRound(0, 0, true);
                    }
                } catch (e) {
                    console.error('[UIManager] Kill button: error invoking defeat handler', e);
                }
            } catch (err) {
                console.error('[UIManager] Kill button unexpected error', err);
            }
        };

        // ✅ Tạo nút Admin Link
        const adminBtn = DOMUtil.createElement('a', {
            id: 'admin-link-btn',
            className: 'flex items-center justify-center gap-2 w-full mb-2 p-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold transition-all shadow-md',
            innerHTML: `
                <span class="text-2xl">⚙️</span>
                <span class="text-sm uppercase tracking-wider">Quản trị</span>
            `
        });
        adminBtn.setAttribute('href', './admin.html');

        // ✅ Append vào cuối dashboard (trước nút Admin cố định trong HTML nếu có)
        dashboard.appendChild(testInput);
        //dashboard.appendChild(nextQuestionBtn);
        dashboard.appendChild(testBtn);
        dashboard.appendChild(killBtn);
        dashboard.appendChild(adminBtn);

        console.log('[UIManager] Admin buttons rendered');
    }

    /**
     * Hiển thị loading trong question area
     */
    showQuestionLoading(message = 'Đang chuẩn bị thử thách...') {
        DOMUtil.showLoading('questionarea', message);
    }

    /**
     * Clear tất cả UI khi về menu
     */
    clearAllUI() {

        // ✅ Hide user-info-slot
        const userSlot = DOMUtil.getById('user-info-slot');
        if (userSlot) {
            userSlot.classList.add('hidden');
            userSlot.innerHTML = '';
        }

        this.toggleLeaderboardVisibility(false);

        const monsterSlot = DOMUtil.getById('monster-info-slot');
        if (monsterSlot) {
            monsterSlot.classList.add('hidden');
            monsterSlot.innerHTML = '';
        }

        const historyslot = DOMUtil.getById('answers-history-slot');
        if (historyslot) {
            historyslot.classList.add('hidden');
            historyslot.innerHTML = '';
        }


        // ✅ Clear action buttons
        const actionSlot = DOMUtil.getById('action-buttons-slot');
        if (actionSlot) {
            actionSlot.innerHTML = '';
        }

        
        // ✅ Xóa admin buttons (nếu có)
        const killBtn = DOMUtil.getById('kill-btn');
        const adminBtn = DOMUtil.getById('admin-link-btn');
        const testBtn = DOMUtil.getById('test-question-btn');
        const testInput = DOMUtil.getById('test-question-input');
        if (killBtn) killBtn.remove();
        if (adminBtn) adminBtn.remove();
        if (testBtn) testBtn.remove();
        if (testInput) testInput.remove();

        // ✅ Clear questionarea
        DOMUtil.clearChildren('questionarea');

        // ✅ Reset battleView
        const battleView = DOMUtil.getById('battleview');
        if (battleView) {
            battleView.innerHTML = `
                <div class="flex justify-between items-center h-full">
                    <div id="hero" class="sprite"></div>
                    <div id="monster" class="sprite"></div>
                </div>
            `;
        }

        console.log('[UIManager] All UI cleared');
    }

    /**
     * Render hero sprite
     */
    renderHeroSprite(player) {
        if (!player || !player.sprite_url) return;
    
        const heroEl = DOMUtil.getById('hero');
        if (!heroEl) return;
    
        // Clear background-image cũ (rất quan trọng)
        heroEl.style.backgroundImage = 'none';
    
        // Clear content cũ (tránh duplicate img)
        heroEl.innerHTML = '';
    
        // Đảm bảo class sprite
        heroEl.className = 'sprite';
    
        // Tạo img hero
        const img = document.createElement('img');
        img.src = player.sprite_url;
        img.alt = player.name || 'hero';
        img.className = 'hero-img';
    
        heroEl.appendChild(img);
    }
    

    /**
     * Render monster sprite
     */
    renderMonsterSprite(monster) {
        if (!monster || !monster.sprite_url) return;
    
        const monsterEl = DOMUtil.getById('monster');
        if (!monsterEl) return;
    
        monsterEl.style.backgroundImage = 'none';
        monsterEl.innerHTML = '';
        const sizeClass = GameConfig.getMonsterSizeClass(monster.type);
        const tierClass = monster.locationTier
        ? `tier-${monster.locationTier}`
        : '';
        monsterEl.className = `sprite ${sizeClass} ${tierClass}`;
    
        const img = document.createElement('img');
        img.src = monster.sprite_url;
        img.alt = monster.name || 'monster';
        img.className = 'monster-img';
    
        monsterEl.appendChild(img);
    }
}

// Expose ra window
window.UIManager = UIManager;

// Export
export default UIManager;