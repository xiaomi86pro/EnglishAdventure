/**
 * GameEngine - Quản lý logic chính của trò chơi
 */
const GameEngine = {
    isBattling: false,
    heroSlashSound: new Audio('./sounds/Slicing_flesh.mp3'),
    monsterPunchSound: new Audio('./sounds/Punch.mp3'),
    player: null,
    monster: null,
    currentStep: 1, // Chặng đường từ 1-10
    totalSteps: 10,
    apiKey: "", // Key sẽ được môi trường cung cấp tự động

    /**
     * Khởi tạo game với dữ liệu User từ Auth
     */
    /**
     * Khởi tạo game với dữ liệu User từ Auth và thông tin Hero từ DB
     */
    async start(userData) {
        // 1. Lấy dữ liệu Hero
        const { data: heroData, error } = await window.supabase
            .from('heroes').select('*').eq('id', userData.selected_hero_id).single();
    
        if (error) return console.error("Lỗi:", error);
    
        this.player = {
            ...userData,
            max_hp: heroData.base_hp,
            hp_current: userData.hp_current || heroData.base_hp,
            atk: heroData.base_atk,
            sprite_url: heroData.image_url
        };
    
        // 2. Dựng UI trước
        this.initUI();
    
        // 3. Gán ảnh Hero (Ảnh tĩnh - ô đầu tiên)
        const heroEl = document.getElementById('hero');
        if (heroEl && this.player.sprite_url) {
            heroEl.style.backgroundImage = `url('${this.player.sprite_url}')`;
            // Đảm bảo xóa class animation cũ nếu có
            heroEl.className = 'sprite'; 
        }
    
        this.currentStep = 1;
        await this.spawnMonster();
        this.updateAllUI();
        this.nextQuestion();
    },

    /**
     * Gọi câu hỏi tiếp theo
     */
    nextQuestion() {
        const questionArea = document.getElementById('questionarea');
        
        if (window.QuestionManager) {
            window.QuestionManager.loadType1();
        } else {
            console.warn("GameEngine: Đang đợi QuestionManager tải...");
            
            // Hiển thị trạng thái đang tải câu hỏi nếu quá trình đợi hơi lâu
            if (questionArea && !questionArea.innerHTML.includes('Đang chuẩn bị')) {
                questionArea.innerHTML = `
                    <div class="flex flex-col items-center justify-center gap-4">
                        <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-blue-500 font-bold animate-pulse">Đang chuẩn bị thử thách...</p>
                    </div>
                `;
            }
            
            // Thử lại sau 500ms nếu chưa thấy QuestionManager
            setTimeout(() => this.nextQuestion(), 500);
        }
    },

    /**
     * Xử lý khi người chơi trả lời đúng hoàn toàn
     * @param {string} word - Từ tiếng Anh đã hoàn thành để tính damage
     */
    handleCorrect() {
        if (this.isBattling) return;
        this.startBattleTurn(this.player, this.monster);
        
        if (this.monster.hp < 0) this.monster.hp = 0;
    
        // Hiệu ứng tấn công
        const monsterEmoji = document.getElementById('monster-emoji');
        if (monsterEmoji) {
            monsterEmoji.classList.add('animate-ping', 'text-red-500');
        }
        
        setTimeout(() => {
            if (monsterEmoji) {
                monsterEmoji.classList.remove('animate-ping', 'text-red-500');
            }
            this.updateBattleStatus();
    
            if (this.monster.hp <= 0) {
                this.handleMonsterDefeat();
            } 
        }, 500);
    },

    showDamage(defender, damage) {
        const battle = document.getElementById('battleview');
        if (!battle) return;
    
        // Xác định element của defender
        const defenderEl = (defender === this.player) 
            ? document.getElementById('hero') 
            : document.getElementById('monster');
    
        if (!defenderEl) return;
    
        // Tính tọa độ trung tâm
        const rect = defenderEl.getBoundingClientRect();
        const bvRect = battle.getBoundingClientRect();
        const centerX = rect.left - bvRect.left + rect.width / 2;
        const centerY = rect.top - bvRect.top;
    
        // Tạo element damage
        const dmgEl = document.createElement('div');
        dmgEl.className = 'damage-popup';
        dmgEl.innerText = `-${damage}`;
        dmgEl.style.left = centerX + 'px';
        dmgEl.style.top = centerY + 'px';
    
        battle.appendChild(dmgEl);
    
        // Xóa sau khi animation xong
        setTimeout(() => dmgEl.remove(), 1500);
    },
    
   /**
     * Xử lý khi quái vật bị tiêu diệt
     */
   handleMonsterDefeat() {
    this.isBattling = true; // Khóa để tránh bấm nhầm khi đang chuyển màn
    
    setTimeout(async () => {
        this.currentStep++;
        if (this.currentStep <= this.totalSteps) {
            await this.spawnMonster(); 
            this.updateAllUI();
            this.isBattling = false; // Mở khóa sau khi đã chuẩn bị xong quái mới
            this.nextQuestion();
        } else {
            alert("Chúc mừng! Bạn đã hoàn thành bản đồ!");
        }
    }, 1500);
},

    /**
     * Cập nhật chỉ số máu trong trận đấu
     */
    updateBattleStatus() {
        // 1. Cập nhật máu Hero
        const heroHpPercent = (this.player.hp_current / this.player.max_hp) * 100;
        const heroHpFill = document.getElementById('hero-hp-fill');
        const heroHpText = document.getElementById('hero-hp-text');
        
        if (heroHpFill) {
            heroHpFill.style.width = `${heroHpPercent}%`;
            // Hiệu ứng đổi màu khi máu thấp
            heroHpFill.style.backgroundColor = heroHpPercent < 30 ? '#ef4444' : '#22c55e';
        }
        if (heroHpText) {
            heroHpText.innerText = `${Math.ceil(this.player.hp_current)}/${this.player.max_hp}`;
        }

        // 2. Cập nhật máu Monster
        const monsterHpPercent = (this.monster.hp / this.monster.max_hp) * 100;
        const monsterHpFill = document.getElementById('monster-hp-fill');
        const monsterHpText = document.getElementById('monster-hp-text');

        if (monsterHpFill) {
            monsterHpFill.style.width = `${monsterHpPercent}%`;
        }
        if (monsterHpText) {
            monsterHpText.innerText = `${Math.ceil(this.monster.hp)}/${this.monster.max_hp}`;
        }
    },

    /**
     * Khởi tạo các khung giao diện tĩnh
     */
    initUI() {
        const battleView = document.getElementById('battleview');
        if (!battleView) return;
    
        // Giữ lại nội dung cũ (div#hero và div#monster) và chỉ chèn thêm UI overlay
        // Chúng ta sử dụng insertAdjacentHTML để không đè mất các thẻ sprite có sẵn trong index.html
        const uiOverlay = `
            <div class="absolute top-4 left-1/2 -translate-x-1/2 w-2/3 h-6 bg-white/50 rounded-full border-2 border-white shadow-sm overflow-hidden z-20">
                <div id="progress-fill" class="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500" style="width: 10%"></div>
                <div class="absolute inset-0 flex justify-between px-4 items-center text-[10px] font-bold text-orange-800 uppercase">
                    <span>Khởi hành</span>
                    <span>Đích đến</span>
                </div>
            </div>
    
            <div class="absolute inset-0 flex justify-between items-end px-10 pb-4 pointer-events-none">
                <div class="flex flex-col items-center">
                    <div id="hero-hp-bar" class="w-24 h-6 bg-gray-200 rounded-lg border-2 border-white mb-32 overflow-hidden relative shadow-sm">
                        <div id="hero-hp-fill" class="h-full bg-green-500 transition-all duration-300" style="width: 100%"></div>
                        <div class="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-md">
                            <span id="hero-hp-text">100/100</span>
                        </div>
                    </div>
                    <span class="font-bold text-blue-700 bg-white/80 px-2 rounded-lg">${this.player.display_name}</span>
                </div>
    
                <div class="flex flex-col items-center">
                    <div id="monster-hp-bar" class="w-24 h-6 bg-gray-200 rounded-lg border-2 border-white mb-32 overflow-hidden relative shadow-sm">
                        <div id="monster-hp-fill" class="h-full bg-red-500 transition-all duration-300" style="width: 100%"></div>
                        <div class="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-md">
                            <span id="monster-hp-text">50/50</span>
                        </div>
                    </div>
                    <span id="monster-name" class="font-bold text-red-700 bg-white/80 px-2 rounded-lg">Quái vật</span>
                </div>
            </div>
        `;
        
        // Xóa các UI cũ nếu có nhưng giữ lại sprite
        const existingOverlays = battleView.querySelectorAll('.absolute');
        existingOverlays.forEach(el => { if(!el.classList.contains('sprite')) el.remove(); });
        
        battleView.insertAdjacentHTML('beforeend', uiOverlay);
    },
    
/**
 * Tạo quái vật dựa trên bước đi hiện tại từ Database
 */
async spawnMonster() {
    // 1. Xác định loại quái dựa trên bước đi (Step)
    let targetType = 'normal';
    if (this.currentStep === 5) {
        targetType = 'elite';
    } else if (this.currentStep === 10) {
        targetType = 'boss';
    }

    try {
        // 2. Truy vấn lấy danh sách quái vật theo Type từ bảng 'monsters'
        const { data: monsters, error } = await window.supabase
            .from('monsters')
            .select('*')
            .eq('type', targetType);

        if (error) throw error;

        if (monsters && monsters.length > 0) {
            // 3. Chọn ngẫu nhiên một con quái trong danh sách trả về
            const randomMonster = monsters[Math.floor(Math.random() * monsters.length)];

            this.monster = {
                ...randomMonster,
                hp: randomMonster.base_hp,
                max_hp: randomMonster.base_hp,
                atk: randomMonster.base_atk,
                state: 'idle',
                isDead: false,
                sprite_url: randomMonster.image_url
            };

            // 4. Cập nhật hình ảnh hiển thị lên thẻ #monster
            const monsterEl = document.getElementById('monster');
            if (monsterEl) {
                monsterEl.style.backgroundImage = `url('${this.monster.sprite_url}')`;
                monsterEl.className = 'sprite';
                console.log("Monster đã spawn:", this.monster.name);
            }
        } else {
            console.error("Không tìm thấy dữ liệu quái vật loại:", targetType);
        }

    } catch (err) {
        console.error("Lỗi khi spawn monster:", err);
        // Quái vật dự phòng nếu lỗi
        this.monster = { 
            name: "Quái Vật Bóng Tối", 
            hp: 50, max_hp: 50, atk: 5, 
            type: "Normal", 
            state: 'idle' 
        };
    }
},

    /**
     * Cập nhật toàn bộ các vùng Dashboard và UserUI
     */
    updateAllUI() {
        // 1. Cập nhật thanh tiến trình bản đồ
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        }
        
        // 2. Cập nhật thông tin Quái vật (Thêm dấu ?. để an toàn tuyệt đối)
        const mName = document.getElementById('monster-name');
        if (mName) {
            mName.innerText = this.monster?.name || "Đang tìm đối thủ...";
        }
        
        // 3. Cập nhật chỉ số máu (HP)
        this.updateBattleStatus();
    
        // 4. Cập nhật Dashboard (Thông tin đối thủ)
        const dashboard = document.getElementById('dashboard');
        // CHÈN THÊM: Kiểm tra this.monster trước khi render
        if (dashboard && this.monster) {
            dashboard.innerHTML = `
                <h3 class="text-xl font-black text-red-600 uppercase mb-2">Đối thủ</h3>
                <div class="bg-white/50 rounded-2xl p-3 border-2 border-red-200">
                    <p class="font-bold text-lg">${this.monster.name}</p>
                    <p class="text-sm text-red-500 font-bold uppercase">${this.monster.type}</p>
                    <div class="mt-4 text-xs font-bold text-gray-500 italic">
                        "Cố lên! Đánh bại nó để đi tiếp nào."
                    </div>
                </div>
                <div class="mt-auto border-t-2 border-white/50 pt-4">
                    <a href="admin.html" class="flex items-center gap-2 p-3 rounded-2xl bg-white/30 hover:bg-white/50 transition-all text-red-600 font-bold group">
                        <span class="text-2xl group-hover:rotate-90 transition-transform duration-500">⚙️</span>
                        <span class="text-sm uppercase tracking-wider">Quản trị</span>
                    </a>
                </div>
            `;
        }
    
        // 5. Cập nhật UserUI (Chỉ cập nhật nếu chưa có nội dung để tránh giật lag)
        const userUI = document.getElementById('userUI');
        // XOÁ: Xoá việc render lại hòm đồ liên tục nếu nó đã tồn tại
        if (userUI && userUI.children.length === 0) { 
            const inventoryGrid = Array(50).fill(0).map(() => 
                `<div class="w-full aspect-square bg-white/30 border border-blue-100 rounded-sm hover:bg-white/50 transition-colors"></div>`
            ).join('');
    
            userUI.innerHTML = `
                <div class="flex flex-col items-center w-full">
                    <div class="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-inner border-2 border-blue-200 mb-2 overflow-hidden">
                        <img src="./assets/hero_head.png" class="w-full h-full object-contain" 
                             onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${this.player?.display_name}'">
                    </div>
                    <p class="font-black text-blue-600 uppercase text-sm text-center leading-tight">${this.player?.display_name || 'Người chơi'}</p>
                    <p class="text-[10px] font-bold text-orange-500">Cấp độ ${this.player?.level || 1}</p>
                </div>
                `;
        }
    },

    startBattleTurn(attacker, defender) {
        this.isBattling = true;
    
        const attackerEl = (attacker === this.player) 
            ? document.getElementById('hero') 
            : document.getElementById('monster');
    
        if (!attackerEl) return;
    
        attackerEl.classList.add('run-forward');
    
        setTimeout(() => {
            // Phát âm thanh
            if (attacker === this.player) {
                this.heroSlashSound.currentTime = 0;
                this.heroSlashSound.play();
            } else {
                this.monsterPunchSound.currentTime = 0;
                this.monsterPunchSound.play();
            }
    
            // Gây damage
            this.applyDamage(attacker, defender);
    
            // Quay về
            attackerEl.classList.remove('run-forward');
            attackerEl.classList.add('run-back');
    
            setTimeout(() => {
                attackerEl.classList.remove('run-back');
                this.isBattling = false; // <-- reset lại ở đây 
            
                if (attacker === this.player && this.monster.hp > 0) {
                    this.nextQuestion();
                }
        
            }, 400);
    
        }, 400);
    },
    
    createStars(x, y) {
        const battle = document.getElementById('battleview');
        if (!battle) return;
    
        // Tạo 8 ngôi sao văng ra các hướng
        for (let i = 0; i < 8; i++) {
            const star = document.createElement('div');
            star.className = 'star-particle';
            star.innerText = '⭐';
            star.style.left = x + 'px';
            star.style.top = y + 'px';
    
            // Tính toán hướng văng ngẫu nhiên (360 độ)
            const angle = (Math.PI * 2 / 8) * i;
            const velocity = 100 + Math.random() * 100;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
    
            star.style.setProperty('--tx', `${tx}px`);
            star.style.setProperty('--ty', `${ty}px`);
    
            battle.appendChild(star);
    
            // Xóa ngôi sao khỏi màn hình sau khi bay xong
            setTimeout(() => star.remove(), 700);
        }
    },

    /**
     * Xử lý gây sát thương, hiệu ứng rung và văng sao
     */
    applyDamage(attacker, defender) {
        // 1. Kiểm tra an toàn: Nếu đối tượng không tồn tại hoặc đã hết máu thì thoát
        const currentHp = (defender === this.player) ? this.player.hp_current : defender.hp;
        if (currentHp <= 0) return;

        // 2. Tính toán sát thương (Mặc định là 5 nếu không có chỉ số atk)
        const damage = attacker.atk || 5;

        // 3. Trừ máu dựa trên loại đối tượng
        if (defender === this.player) {
            // Nếu defender là người chơi, dùng hp_current
            this.player.hp_current -= damage;
            if (this.player.hp_current < 0) this.player.hp_current = 0;
        } else {
            // Nếu defender là quái vật, dùng hp
            defender.hp -= damage;
            if (defender.hp < 0) defender.hp = 0;
        }

        // 4. Xử lý hiệu ứng hình ảnh (Rung và Sao)
        const defenderEl = (defender === this.player) ? document.getElementById('hero') : document.getElementById('monster');
        
        if (defenderEl) {
            // Hiệu ứng rung (Shake)
            defenderEl.classList.remove('shake');
            void defenderEl.offsetWidth; // Reset animation của trình duyệt
            defenderEl.classList.add('shake');
            
            // Hiệu ứng văng ngôi sao (Stars)
            const rect = defenderEl.getBoundingClientRect();
            const battleView = document.getElementById('battleview');
            const bvRect = battleView.getBoundingClientRect();

            // Tọa độ tâm của nhân vật
            const centerX = rect.left - bvRect.left + (rect.width / 2);
            const centerY = rect.top - bvRect.top + (rect.height / 2);

            this.createStars(centerX, centerY);

            // Dọn dẹp class shake sau khi diễn xong
            setTimeout(() => defenderEl.classList.remove('shake'), 400);
        }

        this.showDamage(defender, damage);

        // 5. Cập nhật thanh máu trên giao diện
        this.updateBattleStatus();

        // 6. Kiểm tra điều kiện kết thúc (Chết)
        if (defender === this.player && this.player.hp_current <= 0) {
            setTimeout(() => {
                alert("Bạn đã bị đánh bại! Hãy cố gắng ở lần sau.");
                location.reload();
            }, 500);
        } else if (defender === this.monster && this.monster.hp <= 0) {
            this.monster.isDead = true;
            this.handleMonsterDefeat();
        }
    },
};

window.GameEngine = GameEngine;