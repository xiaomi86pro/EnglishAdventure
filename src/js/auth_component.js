/**
 * Component xử lý giao diện chọn User đầu game
 * Kết nối trực tiếp với Supabase qua biến toàn cục window.supabase
 */
const AuthComponent = {
    selectedUserId: null, 
    containerId: 'questionarea',
    
    // Danh sách Avatar có sẵn
    availableAvatars: ["🧑‍🚀", "👸", "🤖", "🧸", "🐱", "🐶", "🦊", "🦁"],
    users: [], 

    /**
     * Hàm khởi tạo component
     */
    init: function() {
        this.fetchUsers();
    },

    /**
     * Kiểm tra xem có game đã lưu không
     */
    checkSavedGame: function(userId) {
        const saved = localStorage.getItem(`gameState-${userId}`);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Lỗi load game:', e);
            return null;
        }
    },
    
    continueGame: function() {
        const savedGame = this.checkSavedGame(this.selectedUserId);
        if (!savedGame) {
            alert('Không tìm thấy game đã lưu!');
            this.displayLoginMenu();
            return;
        }
        if (window.GameEngine) {
            window.GameEngine.restoreGameState(savedGame);
        }
    },
    
    startNewGame: function() {
        localStorage.removeItem(`gameState-${this.selectedUserId}`);
        this.displayLoginMenu();
    },
    

    /**
     * Kiểm tra và hiển thị menu phù hợp
     */
    checkAndShowMenu: function() {
        const savedGame = this.checkSavedGame();
        
        if (savedGame) {
            this.displayContinueOrNewMenu(savedGame);
        } else {
            this.displayLoginMenu();
        }
    },

    /**
     * Hiển thị menu Chơi tiếp hoặc Chơi lại
     */
    displayContinueOrNewMenu: function(savedGame) {
        const container = document.getElementById(this.containerId);
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

                    <!-- Nút quay lại -->
                    <div class="w-full flex justify-start mt-4">
                        <button onclick="AuthComponent.displayLoginMenu()" 
                                class="px-6 py-2 bg-gray-400 text-white text-lg font-bold rounded-full shadow hover:bg-gray-500 transition-all">
                            ⬅️ Quay lại
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Hàm lấy danh sách User từ Supabase
     */
    fetchUsers: async function() {
        try {
            const supabase = window.supabase;
            if (!supabase) {
                console.warn("AuthComponent: Đang chờ Supabase client...");
                // Thử lại sau 500ms nếu chưa thấy supabase
                setTimeout(() => this.fetchUsers(), 500);
                return;
            }

            // Đã loại bỏ .order('created_at') vì bảng của bạn không có cột này
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .limit(4);

            if (error) throw error;
            
            this.users = data || [];
            console.log("Danh sách User đã tải:", this.users);
            this.displayLoginMenu();
        } catch (err) {
            console.error("Lỗi fetchUsers:", err.message);
        }
    },

    /**
     * Hàm hiển thị giao diện Login/Menu chính
     */
    // Tìm trong file authjs.txt và cập nhật đoạn innerHTML của displayLoginMenu:
    displayLoginMenu: function() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-6 w-full max-w-2xl">
                <h2 class="text-3xl font-black text-blue-600 uppercase tracking-wide">Ai đang chơi đấy?</h2>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    ${this.users.map(user => `
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

                <button id="btn-start"  disabled
                        onclick="AuthComponent.startGame()"
                        class="px-12 py-4 bg-gray-300 text-white text-2xl font-black rounded-full shadow-[0_10px_0_rgb(156,163,175)] cursor-not-allowed transition-all active:mt-2 active:shadow-none uppercase">
                    Vào Trận!
                </button>
            </div>
        `;
    },

    /**
     * Hiển thị Form tạo User mới
     */
    displayCreateUserForm: function() {
        const container = document.getElementById(this.containerId);
        this.tempAvatar = this.availableAvatars[0];

        let htmlContent = `
            <div id="create-user-form" class="flex flex-col items-center justify-center w-full h-full animate-fade-in p-4">
                <h2 class="text-3xl font-bold text-blue-600 mb-6 uppercase">Tạo nhân vật mới</h2>
                <div class="bg-blue-50 p-8 rounded-3xl border-4 border-blue-200 w-full max-w-md shadow-inner">
                    <input type="text" id="input-username" placeholder="Tên của bé..." 
                           class="w-full px-6 py-4 rounded-2xl border-2 border-blue-200 focus:border-blue-500 outline-none text-xl font-bold text-blue-700 mb-6 shadow-sm">
                    
                    <div class="grid grid-cols-4 gap-3 mb-8">
                        ${this.availableAvatars.map((emoji, index) => `
                            <div onclick="document.querySelectorAll('.avatar-opt').forEach(el=>el.classList.remove('border-blue-500','bg-white')); this.classList.add('border-blue-500','bg-white'); AuthComponent.tempAvatar='${emoji}'" 
                                 class="avatar-opt cursor-pointer p-2 border-2 border-transparent rounded-xl text-4xl flex items-center justify-center hover:bg-white transition-all ${index === 0 ? 'border-blue-500 bg-white' : ''}">
                                ${emoji}
                            </div>
                        `).join('')}
                    </div>

                    <div class="flex gap-4">
                        <button onclick="AuthComponent.displayLoginMenu()" class="flex-1 py-3 bg-gray-200 text-gray-600 font-bold rounded-2xl uppercase">Hủy</button>
                        <button id="btn-confirm-save" onclick="AuthComponent.handleSaveUser()" class="flex-1 py-3 bg-blue-500 text-white font-bold rounded-2xl shadow-[0_5px_0_rgb(37,99,235)] uppercase text-lg">Xác nhận</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = htmlContent;
    },

    /**
     * Xử lý lưu User vào Supabase
     */
    handleSaveUser: async function() {
        const nameInput = document.getElementById('input-username');
        if (!nameInput) return;
        
        const name = nameInput.value.trim();
        const btnConfirm = document.getElementById('btn-confirm-save');

        if (!name) return;

        try {
            btnConfirm.disabled = true;
            btnConfirm.innerText = "Đang lưu...";

            const { data, error } = await window.supabase
                .from('profiles')
                .insert([{ 
                    display_name: name, 
                    avatar_key: this.tempAvatar,
                    level: 1,
                    exp: 0,
                    hp_current: 0
                }])
                .select();

            if (error) throw error;
            
            console.log("Lưu thành công, đang tải lại danh sách...");
            // Đợi một chút để DB ổn định rồi load lại
            setTimeout(() => this.fetchUsers(), 300);
            
        } catch (err) {
            console.error("Lỗi Supabase:", err);
            alert(`Lỗi: ${err.message}`);
            if (btnConfirm) {
                btnConfirm.disabled = false;
                btnConfirm.innerText = "Xác nhận";
            }
        }
    },

    // Thay thế hàm selectUser cũ và thêm hàm mới vào AuthComponent
    selectUser: function(userId) {
        document.querySelectorAll('.user-card').forEach(card => card.classList.remove('user-selected', 'border-blue-400'));
        const selectedCard = document.getElementById(`user-card-${userId}`);
        if (selectedCard) {
            selectedCard.classList.add('user-selected', 'border-blue-400');
            this.selectedUserId = userId;
            
            // Kiểm tra xem profile này có game đã lưu không
            const savedGame = this.checkSavedGame(userId);
            if (savedGame) {
                // Profile này có game đã lưu → Hiện menu Continue/New
                this.displayContinueOrNewMenu(savedGame);
            } else {
                // Profile này chưa có game hoặc game đã lưu là của user khác
                // → Hiện vùng chọn Hero
                const heroArea = document.getElementById('hero-selection-area');
                if (heroArea) {
                    heroArea.classList.remove('hidden');
                    this.loadHeroList(); 
                }
            }
        }
    },

// Hàm lấy danh sách Hero từ bảng 'heroes'
loadHeroList: async function() {
    const heroListContainer = document.getElementById('hero-list');
    const supabase = window.supabase;

    if (!supabase) {
        heroListContainer.innerHTML = "<p class='text-sm text-gray-400'>Đang kết nối...</p>";
        setTimeout(() => this.loadHeroList(), 500);
        return;
    }
    
    heroListContainer.innerHTML = "<p class='text-sm text-gray-400'>Đang tìm hiệp sĩ...</p>";

    // ✅ Join với stations để lấy tên chặng unlock
    const { data: heroes, error } = await supabase
        .from('heroes')
        .select('*, stations(name, order_index, locations(name))');

    if (error || !heroes) {
        heroListContainer.innerHTML = "<p class='text-red-500 text-xs'>Lỗi tải Hero</p>";
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
},

// Hàm khi người dùng nhấn chọn 1 Hero cụ thể
selectedHeroId: null,
pickHero: async function(heroId) {
    const { data: hero } = await window.supabase
        .from('heroes')
        .select('is_locked')
        .eq('id', heroId)
        .single();
    
    if (hero?.is_locked) {
        alert('Hero này đang bị khóa! Hãy hoàn thành nhiệm vụ để mở khóa.');
        return;
    }

    document.querySelectorAll('.hero-pick-card').forEach(c => c.classList.remove('border-purple-500', 'bg-purple-50'));
    const heroCard = document.getElementById(`hero-card-${heroId}`);
    if (heroCard) {
        heroCard.classList.add('border-purple-500', 'bg-purple-50');
        this.selectedHeroId = heroId;

        // Kích hoạt nút Bắt đầu
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            btnStart.classList.replace('bg-gray-300', 'bg-yellow-400');
            btnStart.classList.remove('cursor-not-allowed');
            btnStart.classList.add('shadow-[0_10px_0_rgb(202,138,4)]');
            btnStart.disabled = false;
        }
    }
},

startGame: async function() {
    // Kiểm tra xem đã chọn đầy đủ chưa
    if (!this.selectedUserId || !this.selectedHeroId) {
        alert("Vui lòng chọn cả nhân vật và hiệp sĩ!");
        return;
    }

    const introSound = new Audio('https://xiaomi86pro.github.io/EnglishAdventure/sounds/StartGame.mp3'); 
    introSound.currentTime = 0; introSound.play();

    const supabase = window.supabase;
    const btnStart = document.getElementById('btn-start');
    btnStart.innerText = "Đang chuẩn bị...";
    btnStart.disabled = true;

    try {
        // 1. Lưu selected_hero_id vào bảng profiles của người dùng
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ selected_hero_id: this.selectedHeroId })
            .eq('id', this.selectedUserId);

        if (updateError) throw updateError;

        // 2. Lấy thông tin đầy đủ kèm theo dữ liệu Hero (Join bảng)
        const { data: userData, error: fetchError } = await supabase
            .from('profiles')
            .select('*, heroes(*)') 
            .eq('id', this.selectedUserId)
            .single();

        if (fetchError) throw fetchError;

        userData.selected_hero_id = this.selectedHeroId;


        // 3. Khởi động GameEngine
        if (window.GameEngine) {
            window.GameEngine.start(userData);
        }

    } catch (err) {
        console.error("Lỗi:", err);
        alert(`Lỗi: ${err.message}`);
        btnStart.innerText = "Vào Trận!";
        btnStart.disabled = false;
    }
},
};

// Đăng ký component vào window
window.AuthComponent = AuthComponent;