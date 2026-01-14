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
     * Hiển thị menu Login chính (2 khung)
     */
    displayLoginMenu(localUsers) {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-6 w-full max-w-2xl">
                
                <!-- KHUNG TRÊN: Local Users -->
                <div class="w-full bg-white/90 backdrop-blur-sm p-6 rounded-3xl border-4 border-white shadow-2xl">
                    <h3 class="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <span>👤</span> Người chơi trên máy này
                    </h3>
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        ${localUsers.length > 0 ? localUsers.map(user => `
                            <div id="local-user-${user.id}" 
                                 onclick="AuthComponent.selectLocalUser('${user.id}', '${user.display_name}')"
                                 class="local-user-card bg-gradient-to-br from-blue-50 to-purple-50 p-3 rounded-2xl border-2 border-blue-200 cursor-pointer transition-all hover:scale-105 hover:border-blue-400 flex flex-col items-center gap-2 relative group">
                                <div class="text-3xl">${user.avatar_key || '👤'}</div>
                                <span class="font-bold text-gray-700 text-sm text-center">${user.display_name}</span>
                                
                                <!-- Nút xóa -->
                                <button onclick="event.stopPropagation(); AuthComponent.removeLocalUser('${user.id}')"
                                        class="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                    ×
                                </button>
                            </div>
                        `).join('') : `
                            <div class="col-span-full text-center text-gray-400 italic py-4">
                                Chưa có ai chơi trên máy này
                            </div>
                        `}
                        
                        <!-- Nút Người mới -->
                        <div onclick="AuthComponent.displayRegisterForm()" 
                             class="bg-white/50 p-3 rounded-2xl border-2 border-dashed border-blue-300 cursor-pointer transition-all hover:scale-105 hover:bg-blue-50 hover:border-blue-400 flex flex-col items-center justify-center gap-2 group">
                            <div class="text-3xl group-hover:rotate-90 transition-transform">➕</div>
                            <span class="font-bold text-blue-600 text-sm">Người mới</span>
                        </div>
                    </div>
                </div>

                <!-- KHUNG DƯỚI: Form Đăng nhập -->
                <div class="w-full bg-white/90 backdrop-blur-sm p-6 rounded-3xl border-4 border-white shadow-2xl">
                    <h3 class="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <span>🔐</span> Đăng nhập
                    </h3>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-2">Tên người chơi</label>
                            <input type="text" id="login-username" placeholder="Nhập tên..." 
                                   class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none text-lg font-bold text-gray-700">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-2">Mật khẩu</label>
                            <input type="password" id="login-password" placeholder="Nhập mật khẩu..." 
                                   class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none text-lg font-bold text-gray-700">
                        </div>
                        
                        <button onclick="AuthComponent.handleLogin()" 
                                class="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-black rounded-xl shadow-[0_8px_0_rgb(59,130,246)] hover:shadow-[0_8px_0_rgb(37,99,235)] active:mt-2 active:shadow-none transition-all uppercase">
                            🚀 Đăng nhập
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Hiển thị form đăng ký (có thêm password)
     */
    displayRegisterForm(availableAvatars) {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full max-w-md animate-fade-in">
                <h2 class="text-3xl font-bold text-black mb-6 uppercase drop-shadow-lg">Tạo nhân vật mới</h2>
                
                <div class="bg-white/95 backdrop-blur-sm p-8 rounded-3xl border-4 border-white shadow-2xl w-full">
                    <div class="space-y-4">
                        <!-- Tên -->
                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-2">Tên người chơi</label>
                            <input type="text" id="register-username" placeholder="Tên của bé..." 
                                   class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none text-lg font-bold text-blue-700">
                        </div>
                        
                        <!-- Mật khẩu -->
                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-2">Mật khẩu</label>
                            <input type="password" id="register-password" placeholder="Tạo mật khẩu..." 
                                   class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none text-lg font-bold text-blue-700">
                        </div>
                        
                        <!-- Chọn Avatar -->
                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-3">Chọn hình đại diện</label>
                            <div class="grid grid-cols-4 gap-3">
                                ${availableAvatars.map((emoji, index) => `
                                    <div onclick="document.querySelectorAll('.avatar-opt').forEach(el=>el.classList.remove('border-blue-500','bg-blue-50','scale-110')); this.classList.add('border-blue-500','bg-blue-50','scale-110'); AuthComponent.selectAvatar('${emoji}')" 
                                         class="avatar-opt cursor-pointer p-3 border-2 border-gray-200 rounded-xl text-4xl flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-all ${index === 0 ? 'border-blue-500 bg-blue-50 scale-110' : ''}">
                                        ${emoji}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3 mt-6">
                        <button onclick="AuthComponent.displayLoginMenu()" 
                                class="flex-1 py-3 bg-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-400 transition-all uppercase">
                            Hủy
                        </button>
                        <button id="btn-confirm-register" onclick="AuthComponent.handleRegister()" 
                                class="flex-1 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-xl shadow-[0_5px_0_rgb(34,197,94)] hover:shadow-[0_5px_0_rgb(22,163,74)] active:mt-1 active:shadow-none transition-all uppercase text-lg">
                            Tạo tài khoản
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Hiển thị menu Continue hoặc New Game
     */
    displayContinueOrNewMenu(savedGame) {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-6 w-full max-w-md">
                <h2 class="text-3xl font-black text-white uppercase tracking-wide drop-shadow-lg">Game đã lưu!</h2>
                
                <div class="bg-white/95 backdrop-blur-sm p-6 rounded-3xl border-4 border-white shadow-2xl w-full">
                    <div class="text-center mb-4">
                        <div class="text-5xl mb-2">${savedGame.player.sprite || '🧑‍🚀'}</div>
                        <p class="font-bold text-xl text-gray-700">${savedGame.player.display_name}</p>
                        <p class="text-sm text-gray-500">Level ${savedGame.player.level} - Stage ${savedGame.currentStationName}</p>
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
     * Hiển thị form chọn hero
     */
    displayHeroSelection() {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-6 w-full max-w-2xl">
                <h2 class="text-3xl font-black text-black uppercase tracking-wide drop-shadow-lg">Chọn hiệp sĩ</h2>
                
                <div class="w-full bg-white/95 backdrop-blur-sm p-6 rounded-3xl border-4 border-white shadow-2xl">
                    <div id="hero-list" class="flex flex-wrap justify-center gap-4 mb-6">
                        <p class="text-gray-400 italic">Đang tải hiệp sĩ...</p>
                    </div>
                    
                    <button id="btn-start" disabled
                            onclick="AuthComponent.startGame()"
                            class="w-full px-12 py-4 bg-gray-300 text-white text-2xl font-black rounded-full shadow-[0_10px_0_rgb(156,163,175)] cursor-not-allowed transition-all uppercase">
                        Vào Trận!
                    </button>
                </div>

                <button onclick="AuthComponent.displayLoginMenu()" 
                        class="px-6 py-2 bg-gray-400 text-white text-lg font-bold rounded-full shadow hover:bg-gray-500 transition-all">
                    ⬅️ Quay lại
                </button>
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
                     class="hero-pick-card relative p-3 bg-white rounded-xl border-3 border-gray-200 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-400 hover:shadow-lg'} transition-all flex flex-col items-center w-24">
                    
                    ${isLocked ? `
                        <div class="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                            <span class="text-3xl">🔒</span>
                        </div>
                        <div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-20">
                            Khóa
                        </div>
                    ` : ''}
                    
                    <img src="${hero.image_url}" class="w-16 h-16 object-contain ${isLocked ? 'grayscale' : ''}">
                    <span class="text-xs font-bold text-gray-600 mt-2 text-center">${hero.name}</span>
                    
                    ${isLocked ? `
                        <span class="text-[8px] text-red-500 mt-1 text-center leading-tight">${unlockInfo}</span>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Highlight local user đã chọn
     */
    highlightSelectedLocalUser(userId) {
        document.querySelectorAll('.local-user-card').forEach(card => {
            card.classList.remove('ring-4', 'ring-blue-500', 'scale-110');
        });
        
        const selectedCard = document.getElementById(`local-user-${userId}`);
        if (selectedCard) {
            selectedCard.classList.add('ring-4', 'ring-blue-500', 'scale-110');
        }
    }

    /**
     * Fill username vào ô đăng nhập
     */
    fillLoginUsername(username) {
        const input = document.getElementById('login-username');
        if (input) {
            input.value = username;
            // Focus vào ô password
            const passwordInput = document.getElementById('login-password');
            if (passwordInput) {
                passwordInput.focus();
            }
        }
    }

    /**
     * Highlight hero card đã chọn
     */
    highlightSelectedHero(heroId) {
        document.querySelectorAll('.hero-pick-card').forEach(c => {
            c.classList.remove('border-purple-500', 'bg-purple-50', 'ring-4', 'ring-purple-300');
        });
        
        const heroCard = document.getElementById(`hero-card-${heroId}`);
        if (heroCard) {
            heroCard.classList.add('border-purple-500', 'bg-purple-50', 'ring-4', 'ring-purple-300');
        }
    }

    /**
     * Kích hoạt nút Start Game
     */
    enableStartButton() {
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            btnStart.classList.remove('bg-gray-300', 'cursor-not-allowed', 'shadow-[0_10px_0_rgb(156,163,175)]');
            btnStart.classList.add('bg-yellow-400', 'shadow-[0_10px_0_rgb(202,138,4)]', 'hover:bg-yellow-500');
            btnStart.disabled = false;
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