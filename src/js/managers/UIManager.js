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
        const battleView = DOMUtil.getById('battleview');
        if (!battleView) return;

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

        console.log('[UIManager] UI initialized');
    }

    /**
     * Cập nhật toàn bộ UI
     * @param {Object} player 
     * @param {Object} monster 
     * @param {Object} location 
     * @param {Object} station 
     * @param {number} currentStep 
     * @param {number} totalSteps 
     */
    updateAllUI(player, monster, location, station, currentStep, totalSteps = 10) {
        // 1. Cập nhật player info card
        this.updatePlayerCard(player);

        // 2. Cập nhật monster info
        this.updateMonsterInfo(monster, location, station, currentStep, totalSteps);

        // 3. Cập nhật progress bar
        this.updateProgressBar(currentStep, totalSteps, monster?.type);

        // 4. Cập nhật HP bars
        this.updateBattleStatus(player, monster);

        // 5. Thêm nút Exit
        this.addExitButton();
        //this.addKillButton();

        this.renderAdminButtons();

    }

    /**
     * Cập nhật player info card
     * @param {Object} player 
     */
    updatePlayerCard(player) {
        const userUI = DOMUtil.getById('userUI');
        if (!userUI || !player) return;

        // Xóa card cũ nếu có
        const oldCard = DOMUtil.getById('player-info-card');
        if (oldCard) oldCard.remove();

        // Tạo card mới
        const playerCard = DOMUtil.createElement('div', {
            id: 'player-info-card',
            className: 'bg-white/70 rounded-2xl p-4 border-4 border-blue-200 shadow-lg mb-4',
            innerHTML: `
                <div class="flex flex-col items-center gap-3">
                    <div class="text-5xl">${player.avatar_key || '👤'}</div>
                    <div class="text-center">
                        <p class="font-black text-xl text-blue-700">${player.display_name}</p>
                        <p class="text-sm font-bold text-gray-500">Level ${player.level || 1}</p>
                    </div>
                </div>
            `
        });

        // Chèn vào đầu userUI
        userUI.insertBefore(playerCard, userUI.firstChild);
    }

    /**
     * Cập nhật monster info
     * @param {Object} monster 
     * @param {Object} location 
     * @param {Object} station 
     * @param {number} currentStep 
     * @param {number} totalSteps 
     */
    updateMonsterInfo(monster, location, station, currentStep, totalSteps) {
        const mInfo = DOMUtil.getById('monster-info');
        if (!mInfo) return;

        const html = `
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

        DOMUtil.setHTML('monster-info', html);
    }

    /**
     * Cập nhật progress bar
     * @param {number} currentStep 
     * @param {number} totalSteps 
     * @param {string} monsterType 
     */
    updateProgressBar(currentStep, totalSteps, monsterType = 'normal') {
        for (let i = 1; i <= totalSteps; i++) {
            const seg = DOMUtil.getById(`step-${i}`);
            if (!seg) continue;

            if (i < currentStep) {
                // Đã hoàn thành
                seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-green-500";
            } else if (i === currentStep) {
                // Đang chơi
                if (monsterType === "normal") {
                    seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-blue-400";
                } else if (monsterType === "elite") {
                    seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-yellow-400";
                } else if (monsterType === "boss" || monsterType === "final boss") {
                    seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-red-500";
                }
            } else {
                // Chưa đến
                seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-gray-300";
            }
        }
    }

    /**
     * Cập nhật chỉ số máu trong trận đấu
     * @param {Object} player 
     * @param {Object} monster 
     */
    updateBattleStatus(player, monster) {
        // 1. Cập nhật máu Hero
        if (player) {
            const heroHpPercent = (player.hp_current / player.max_hp) * 100;
            
            DOMUtil.setStyle('hero-hp-fill', 'width', `${heroHpPercent}%`);
            
            // Hiệu ứng đổi màu khi máu thấp
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
     * Thêm nút Exit vào UserUI
     */
    addExitButton() {
        const userUI = DOMUtil.getById('userUI');
        if (!userUI) return;
        
        // Xóa nút cũ nếu có
        const oldExitBtn = DOMUtil.getById('exit-menu-btn');
        if (oldExitBtn) oldExitBtn.remove();

        // Tạo nút mới
        const exitBtn = DOMUtil.createElement('button', {
            id: 'exit-menu-btn',
            className: 'w-full mt-auto p-3 rounded-2xl bg-red-400 hover:bg-red-500 text-white font-bold transition-all shadow-md',
            innerHTML: '🚪 Thoát ra Menu'
        });

        exitBtn.onclick = () => {
            const confirm = window.confirm('Bạn có muốn lưu game và thoát ra menu?');
            if (confirm && window.GameEngine) {
                window.GameEngine.saveGameState();
                window.GameEngine.showMainMenu();
            }
        };

        userUI.appendChild(exitBtn);
    }

    renderAdminButtons() {
        const dashboardUI = DOMUtil.getById('dashboard');
        if (!dashboardUI) return;

        const oldKillBtn = DOMUtil.getById('kill-btn');
        if (oldKillBtn) oldKillBtn.remove();
        const oldAdminBtn = DOMUtil.getById('admin-link-btn');
        if (oldAdminBtn) oldAdminBtn.remove();
       
        // Lấy role từ GameEngine
        const GE = window.GameEngine;
        const role = GE?.player?.role;
        console.log("UIManager: player role 1  =", role);

        // Nếu là admin thì ẩn/không tạo nút
        if (role !== 'admin') {
            // Xóa nếu có sẵn
            const oldKillBtn = DOMUtil.getById('kill-btn');
            if (oldKillBtn) oldKillBtn.remove();
            const oldAdminBtn = DOMUtil.getById('admin-link-btn');
            if (oldAdminBtn) oldAdminBtn.remove();
            return;
        }
         
        // Tạo nút Kill
        const KillBtn = DOMUtil.createElement('button', {
            id: 'kill-btn',
            className: 'w-full mb-2 p-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold transition-all shadow-md',
            innerHTML: '💀 Kill Monster (Test)'
        });

        KillBtn.onclick = () => {
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
                    console.error('Kill button: error invoking defeat handler', e);
                }
            } catch (err) {
                console.error('Kill button unexpected error', err);
            }
        };

        // Tạo nút Admin
        const adminBtn = DOMUtil.createElement('a', {
            id: 'admin-link-btn',
            className: 'w-full mb-2 p-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold transition-all shadow-md',
            innerHTML: `
                <span class="text-2xl mr-2">⚙️</span>
                <span class="text-sm uppercase tracking-wider">Quản trị</span>
            `
        });
        adminBtn.setAttribute('href', './admin.html');

        dashboardUI.appendChild(KillBtn);
        dashboardUI.appendChild(adminBtn);
    }

    /**
     * Hiển thị loading trong question area
     * @param {string} message 
     */
    showQuestionLoading(message = 'Đang chuẩn bị thử thách...') {
        DOMUtil.showLoading('questionarea', message);
    }

    /**
     * Clear tất cả UI khi về menu
     */
    clearAllUI() {
        DOMUtil.clearChildren('questionarea');
        DOMUtil.clearChildren('userUI');
        DOMUtil.clearChildren('dashboard');
        
        // Reset battleView về trạng thái ban đầu
        const battleView = DOMUtil.getById('battleview');
        if (battleView) {
            battleView.innerHTML = `
                <div class="flex justify-between items-center h-full">
                    <div id="hero" class="sprite"></div>
                    <div id="monster" class="sprite"></div>
                </div>
            `;
        }

        // Xóa monster-info và answers-history trong dashboard
        DOMUtil.clearChildren('monster-info');
        DOMUtil.clearChildren('answers-history');

        console.log('[UIManager] All UI cleared');
    }

    /**
     * Render hero sprite
     * @param {Object} player 
     */
    renderHeroSprite(player) {
        if (!player || !player.sprite_url) return;

        const heroEl = DOMUtil.getById('hero');
        if (heroEl) {
            DOMUtil.setBackgroundImage('hero', player.sprite_url);
            heroEl.className = 'sprite';
        }
    }

    /**
     * Render monster sprite
     * @param {Object} monster 
     */
    renderMonsterSprite(monster) {
        if (!monster || !monster.sprite_url) return;

        const monsterEl = DOMUtil.getById('monster');
        if (monsterEl) {
            DOMUtil.setBackgroundImage('monster', monster.sprite_url);
            
            const sizeClass = GameConfig.getMonsterSizeClass(monster.type);
            monsterEl.className = `sprite ${sizeClass}`;
        }
    }
}

// Expose ra window
window.UIManager = UIManager;

// Export
export default UIManager;