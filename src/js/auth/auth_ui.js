// src/js/auth/auth_ui.js
/**
 * Quản lý giao diện của Auth Component
 */
export class AuthUI {
    constructor(containerId) {
        this.containerId = containerId;
    }

    /**
     * Lấy container element
     */
    getContainer() {
        return document.getElementById(this.containerId);
    }

    /**
     * Hiển thị menu Continue hoặc New Game
     */
    displayContinueOrNewMenu(savedGame) {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-6 w-full max-w-md">
                <h2 class="text-3xl font-black text-blue-600 uppercase tracking-wide">Game đã lưu!</h2>
                
                <div class="bg-white p-6 rounded-3xl border-4 border-blue-200 w-full">
                    <div class="text-center mb-4">
                        <div class="text-5xl mb-2">${savedGame.player.sprite || '🧑‍🚀'}</div>
                        <p class="font-bold text-xl text-gray-700">${savedGame.player.display_name}</p>
                        <p class="text-sm text-gray-500">Level ${savedGame.player.level} - Stage ${savedGame.currentStage}</p>
                    </div>
                </div>

                <div class="flex flex-col gap-4 w-full">
                    <button onclick="AuthComponent.continueGame()" 
                            class="w-full px-8 py-4 bg-green-500 text-white text-2xl font-black rounded-full shadow-[0_10px_0_rgb(22,163,74)] hover:bg-green-600 transition-all active:mt-2 active:shadow-none uppercase">
                        ▶️ Chơi tiếp
                    </button>
                    
                    <button onclick="AuthComponent.startNewGame()" 
                            class="w-full px-8 py-4 bg-blue-500 text-white text-2xl font-black rounded-full shadow-[0_10px_0_rgb(37,99,235)] hover:bg-blue-600 transition-all active:mt-2 active:shadow-none uppercase">
                        🆕 Chơi lại từ đầu
                    </button>

                    <div class="w-full flex justify-start mt-4">
                        <button onclick="AuthComponent.displayLoginMenu()" 
                                class="px-6 py-2 bg-gray-400 text-white text-lg font-bold rounded-full shadow hover:bg-gray-500 transition-all">
                            ⬅️ Quay lại
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Hiển thị menu Login chính
     */
    displayLoginMenu(users) {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-6 w-full max-w-2xl">
                <h2 class="text-3xl font-black text-blue-600 uppercase tracking-wide">Ai đang chơi đấy?</h2>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    ${users.map(user => `
                        <div id="user-card-${user.id}" 
                            onclick="AuthComponent.selectUser('${user.id}')"
                            class="user-card bg-white p-4 rounded-3xl border-4 border-white shadow-lg cursor-pointer transition-all hover:scale-105 flex flex-col items-center gap-2">
                            <div class="text-4xl">${user.avatar_key || '👤'}</div>
                            <span class="font-bold text-gray-700">${user.display_name}</span>
                        </div>
                    `).join('')}
                    
                    <div onclick="AuthComponent.displayCreateUserForm()" 
                        class="bg-white/50 p-4 rounded-3xl border-4 border-dashed border-white shadow-sm cursor-pointer transition-all hover:scale-105 flex flex-col items-center justify-center gap-2 group">
                        <div class="text-4xl group-hover:rotate-90 transition-transform">➕</div>
                        <span class="font-bold text-gray-500">Người mới</span>
                    </div>
                </div>
                
                <div id="hero-selection-area" class="hidden w-full flex flex-col items-center gap-4 mt-4 p-4 rounded-3xl bg-white/50 border-4 border-dashed border-white">
                    <h3 class="font-black text-purple-600 uppercase">Chọn hiệp sĩ của bạn</h3>
                    <div id="hero-list" class="flex flex-wrap justify-center gap-3">
                    </div>
                </div>

                <button id="btn-start" disabled
                        onclick="AuthComponent.startGame()"
                        class="px-12 py-4 bg-gray-300 text-white text-2xl font-black rounded-full shadow-[0_10px_0_rgb(156,163,175)] cursor-not-allowed transition-all active:mt-2 active:shadow-none uppercase">
                    Vào Trận!
                </button>
            </div>
        `;
    }

    /**
     * Hiển thị form tạo user mới
     */
    displayCreateUserForm(availableAvatars) {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div id="create-user-form" class="flex flex-col items-center justify-center w-full h-full animate-fade-in p-4">
                <h2 class="text-3xl font-bold text-blue-600 mb-6 uppercase">Tạo nhân vật mới</h2>
                <div class="bg-blue-50 p-8 rounded-3xl border-4 border-blue-200 w-full max-w-md shadow-inner">
                    <input type="text" id="input-username" placeholder="Tên của bé..." 
                           class="w-full px-6 py-4 rounded-2xl border-2 border-blue-200 focus:border-blue-500 outline-none text-xl font-bold text-blue-700 mb-6 shadow-sm">
                    
                    <div class="grid grid-cols-4 gap-3 mb-8">
                        ${availableAvatars.map((emoji, index) => `
                            <div onclick="document.querySelectorAll('.avatar-opt').forEach(el=>el.classList.remove('border-blue-500','bg-white')); this.classList.add('border-blue-500','bg-white'); AuthComponent.selectAvatar('${emoji}')" 
                                 class="avatar-opt cursor-pointer p-2 border-2 border-transparent rounded-xl text-4xl flex items-center justify-center hover:bg-white transition-all ${index === 0 ? 'border-blue-500 bg-white' : ''}">
                                ${emoji}
                            </div>
                        `).join('')}
                    </div>

                    <div class="flex gap-4">
                        <button onclick="AuthComponent.displayLoginMenu()" 
                                class="flex-1 py-3 bg-gray-200 text-gray-600 font-bold rounded-2xl uppercase">
                            Hủy
                        </button>
                        <button id="btn-confirm-save" onclick="AuthComponent.handleSaveUser()" 
                                class="flex-1 py-3 bg-blue-500 text-white font-bold rounded-2xl shadow-[0_5px_0_rgb(37,99,235)] uppercase text-lg">
                            Xác nhận
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Hiển thị danh sách heroes
     */
    displayHeroList(heroes) {
        const heroListContainer = document.getElementById('hero-list');
        if (!heroListContainer) return;

        if (!heroes || heroes.length === 0) {
            heroListContainer.innerHTML = "<p class='text-sm text-gray-400'>Không có hiệp sĩ nào</p>";
            return;
        }

        heroListContainer.innerHTML = heroes.map(hero => {
            const isLocked = hero.is_locked;
            const unlockInfo = hero.stations 
                ? `Cần: ${hero.stations.locations?.name} - ${hero.stations.name}`
                : 'Chưa thiết lập';
            
            return `
                <div onclick="${isLocked ? '' : `AuthComponent.pickHero('${hero.id}')`}" 
                     id="hero-card-${hero.id}"
                     class="hero-pick-card relative p-2 bg-white rounded-xl border-2 border-transparent ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-400'} transition-all flex flex-col items-center w-20">
                    
                    ${isLocked ? `
                        <div class="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                            <span class="text-3xl">🔒</span>
                        </div>
                        <div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-20">
                            Khóa
                        </div>
                    ` : ''}
                    
                    <img src="${hero.image_url}" class="w-12 h-12 object-contain ${isLocked ? 'grayscale' : ''}">
                    <span class="text-[10px] font-bold text-gray-600 mt-1 text-center">${hero.name}</span>
                    
                    ${isLocked ? `
                        <span class="text-[8px] text-red-500 mt-1 text-center leading-tight">${unlockInfo}</span>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Highlight user card đã chọn
     */
    highlightSelectedUser(userId) {
        document.querySelectorAll('.user-card').forEach(card => {
            card.classList.remove('user-selected', 'border-blue-400');
        });
        
        const selectedCard = document.getElementById(`user-card-${userId}`);
        if (selectedCard) {
            selectedCard.classList.add('user-selected', 'border-blue-400');
        }
    }

    /**
     * Highlight hero card đã chọn
     */
    highlightSelectedHero(heroId) {
        document.querySelectorAll('.hero-pick-card').forEach(c => {
            c.classList.remove('border-purple-500', 'bg-purple-50');
        });
        
        const heroCard = document.getElementById(`hero-card-${heroId}`);
        if (heroCard) {
            heroCard.classList.add('border-purple-500', 'bg-purple-50');
        }
    }

    /**
     * Hiện vùng chọn hero
     */
    showHeroSelectionArea() {
        const heroArea = document.getElementById('hero-selection-area');
        if (heroArea) {
            heroArea.classList.remove('hidden');
        }
    }

    /**
     * Ẩn vùng chọn hero
     */
    hideHeroSelectionArea() {
        const heroArea = document.getElementById('hero-selection-area');
        if (heroArea) {
            heroArea.classList.add('hidden');
        }
    }

    /**
     * Kích hoạt nút Start Game
     */
    enableStartButton() {
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            btnStart.classList.replace('bg-gray-300', 'bg-yellow-400');
            btnStart.classList.remove('cursor-not-allowed');
            btnStart.classList.add('shadow-[0_10px_0_rgb(202,138,4)]');
            btnStart.disabled = false;
        }
    }

    /**
     * Vô hiệu hóa nút Start Game
     */
    disableStartButton() {
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            btnStart.classList.replace('bg-yellow-400', 'bg-gray-300');
            btnStart.classList.add('cursor-not-allowed');
            btnStart.classList.remove('shadow-[0_10px_0_rgb(202,138,4)]');
            btnStart.classList.add('shadow-[0_10px_0_rgb(156,163,175)]');
            btnStart.disabled = true;
        }
    }

    /**
     * Cập nhật text và state của nút
     */
    updateButtonState(buttonId, text, disabled = false) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.innerText = text;
            button.disabled = disabled;
        }
    }

    /**
     * Hiển thị loading trong hero list
     */
    showHeroListLoading() {
        const heroListContainer = document.getElementById('hero-list');
        if (heroListContainer) {
            heroListContainer.innerHTML = "<p class='text-sm text-gray-400'>Đang tìm hiệp sĩ...</p>";
        }
    }
}