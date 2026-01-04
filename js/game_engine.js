/**
 * GameEngine - Quản lý logic chính của trò chơi
 */
const GameEngine = {
    isBattling: false,
    heroSlashSound: new Audio('../sounds/Slicing_flesh.mp3'),
    monsterPunchSound: new Audio('../sounds/Punch.mp3'),
    healSound: new Audio('../sounds/Heal.mp3'),
    bossBgm: new Audio('../sounds/Boss_Battle.mp3'),
    player: null,
    monster: null,
    // ✅ Thêm phần mới
    currentLocation: null,
    currentStation: null,
    currentStep: 1,
    totalStepsPerStation: 10,
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
            base_hp: heroData.base_hp,
            hp_bonus: userData.hp_current || 0, // phần cộng thêm khi lên level
            max_hp: heroData.base_hp + (userData.hp_current || 0),
            hp_current: heroData.base_hp + (userData.hp_current || 0), // bắt đầu đầy máu
            atk: heroData.base_atk,
            sprite_url: heroData.image_url
        };
        
        await this.loadFirstLocation();

        // 2. Dựng UI trước
        this.initUI();
    
        // 3. Gán ảnh Hero (Ảnh tĩnh - ô đầu tiên)
        const heroEl = document.getElementById('hero');
        if (heroEl && this.player.sprite_url) {
            heroEl.style.backgroundImage = `url('${this.player.sprite_url}')`;
            // Đảm bảo xóa class animation cũ nếu có
            heroEl.className = 'sprite'; 
        }
    
        await this.spawnMonsterFromStep();
        this.updateAllUI();
        this.nextQuestion();
    },

    /**
     * Load location đầu tiên và station đầu tiên
     */
    async loadFirstLocation() {
        try {
            // 1. Lấy location đầu tiên (order_index = 1)
            const { data: location, error: locError } = await window.supabase
                .from('locations')
                .select('*')
                .order('order_index', { ascending: true })
                .limit(1)
                .single();

            if (locError) throw locError;
            this.currentLocation = location;

            // 2. Lấy station đầu tiên của location này
            const { data: station, error: stError } = await window.supabase
                .from('stations')
                .select('*')
                .eq('location_id', location.id)
                .order('order_index', { ascending: true })
                .limit(1)
                .single();

            if (stError) throw stError;
            this.currentStation = station;
            this.currentStep = 1;

            console.log('Loaded:', location.name, '>', station.name);
        } catch (err) {
            console.error('Lỗi load location/station:', err);
        }
    },

    /**
     * Spawn monster theo cấu hình trong bảng steps
     */
    async spawnMonsterFromStep() {
        try {
            // 1. Lấy step config từ DB
            const { data: stepConfig, error } = await window.supabase
                .from('steps')
                .select('*, monsters(*)')
                .eq('station_id', this.currentStation.id)
                .eq('step_number', this.currentStep)
                .single();

                if (error || !stepConfig) {
                    console.error('❌ Không tìm thấy config cho step này! Vui lòng cấu hình trong Admin.');
                    alert(`Lỗi: Chưa cấu hình Step ${this.currentStep} của chặng "${this.currentStation.name}". Vui lòng vào Admin để cấu hình!`);
                    
                    // Spawn monster mặc định để game không bị crash
                    this.monster = {
                        name: "??? (Chưa config)",
                        hp: 50,
                        max_hp: 50,
                        atk: 5,
                        type: "normal",
                        state: 'idle',
                        isDead: false,
                        sprite_url: "https://via.placeholder.com/64",
                        questionType: 1
                    };
                    
                    const monsterEl = document.getElementById('monster');
                    if (monsterEl) {
                        monsterEl.style.backgroundImage = `url('${this.monster.sprite_url}')`;
                        monsterEl.className = 'sprite size-normal';
                    }
                    return;
                }

            // 2. Lấy monster từ config
            const monsterData = stepConfig.monsters;
            
            this.monster = {
                ...monsterData,
                hp: monsterData.base_hp,
                max_hp: monsterData.base_hp,
                atk: monsterData.base_atk,
                state: 'idle',
                isDead: false,
                sprite_url: monsterData.image_url,
                questionType: stepConfig.question_type || this.getDefaultQuestionType(monsterData.type)
            };

            // 3. Cập nhật hình ảnh monster
            const monsterEl = document.getElementById('monster');
            if (monsterEl) {
                monsterEl.style.backgroundImage = `url('${this.monster.sprite_url}')`;
                
                let sizeClass = 'size-normal';
                if (this.monster.type === 'elite') sizeClass = 'size-elite';
                else if (this.monster.type === 'boss') sizeClass = 'size-boss';
                
                monsterEl.className = `sprite ${sizeClass}`;
            }

            if (this.monster.type === 'boss') {
                this.playBossMusic();
            } else {
                this.stopBossMusic(); // Đảm bảo tắt nhạc boss nếu gặp quái thường
            }

            console.log('Spawned monster:', this.monster.name);
        } catch (err) {
            console.error('Lỗi spawn monster:', err);
            await this.spawnMonsterRandom();
        }
    },

    /**
     * Lấy question type mặc định theo loại monster
     */
    getDefaultQuestionType(monsterType) {
        if (monsterType === 'normal') return 1;
        if (monsterType === 'elite') return 2;
        if (monsterType === 'boss') return 4;
        return 1;
    },

    /**
     * Lưu trạng thái game vào localStorage
     */
    saveGameState() {
        const gameState = {
            player: {
                id: this.player.id,
                display_name: this.player.display_name,
                avatar_key: this.player.avatar_key,
                level: this.player.level,
                exp: this.player.exp,
                max_hp: this.player.max_hp,
                hp_current: this.player.hp_current,
                atk: this.player.atk,
                sprite_url: this.player.sprite_url,
                selected_hero_id: this.player.selected_hero_id,
                sprite: this.player.avatar_key
            },
            currentLocationId: this.currentLocation?.id,  // ← Thêm
            currentStationId: this.currentStation?.id,    // ← Thêm
            currentStep: this.currentStep,
            monster: this.monster ? {
                name: this.monster.name,
                hp: this.monster.hp,
                max_hp: this.monster.max_hp,
                atk: this.monster.atk,
                type: this.monster.type,
                sprite_url: this.monster.sprite_url,
                questionType: this.monster.questionType
            } : null
        };
        localStorage.setItem(`gameState-${this.player.id}`, JSON.stringify(gameState));
        console.log('Game đã được lưu:', gameState);
        this.stopBossMusic();
    },

    /**
     * Khôi phục trạng thái game từ localStorage
     */
    async restoreGameState(savedGame) {
        console.log('Đang khôi phục game:', savedGame);
        
        // Khôi phục thông tin player
        this.player = savedGame.player;
        this.currentStep = savedGame.currentStep || 1;
        
        // ✅ Khôi phục location và station
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
            // Nếu không có, load location/station đầu tiên
            await this.loadFirstLocation();
        }
        
        // Khởi tạo UI
        this.initUI();
        
        // Cập nhật sprite hero
        const heroEl = document.getElementById('hero');
        if (heroEl && this.player.sprite_url) {
            heroEl.style.backgroundImage = `url('${this.player.sprite_url}')`;
            heroEl.className = 'sprite';
        }
        
        // Khôi phục monster
        if (savedGame.monster) {
            this.monster = savedGame.monster;

            if (this.monster.type === 'boss') {
                this.playBossMusic();
            }
            
            if (!this.monster.questionType) {
                this.monster.questionType = this.getDefaultQuestionType(this.monster.type);
            }
            const monsterEl = document.getElementById('monster');
            if (monsterEl && this.monster.sprite_url) {
                monsterEl.style.backgroundImage = `url('${this.monster.sprite_url}')`;
                
                let sizeClass = 'size-normal';
                if (this.monster.type === 'elite') sizeClass = 'size-elite';
                else if (this.monster.type === 'boss') sizeClass = 'size-boss';
                
                monsterEl.className = `sprite ${sizeClass}`;
            }
        } else {
            await this.spawnMonsterFromStep();
        }
        
        this.updateAllUI();
        this.nextQuestion();
    },

    /**
     * Gọi câu hỏi tiếp theo
     */
    async nextQuestion() {
        const questionArea = document.getElementById('questionarea');
        const questionType = this.monster?.questionType || 1;
        
        if (window.QuestionManager?.currentQuestion) {
            if (typeof window.QuestionManager.currentQuestion.destroy === 'function') {
                window.QuestionManager.currentQuestion.destroy();
            }
        }

        // Hiện loading
        if (questionArea && !questionArea.innerHTML.includes('Đang chuẩn bị')) {
            questionArea.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-4">
                    <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-blue-500 font-bold animate-pulse">Đang chuẩn bị thử thách...</p>
                </div>
            `;
        }
    
        // Load question theo questionType
        if (window.QuestionManager) {
            try {
                await window.QuestionManager.loadType(questionType, this.monster.type);
            } catch (error) {
                console.error("Lỗi load question:", error);
                setTimeout(() => this.nextQuestion(), 500);
            }
        }
    },
    
    
    /**
     * Xử lý khi người chơi trả lời đúng hoàn toàn
     * @param {string} word - Từ tiếng Anh đã hoàn thành để tính damage
     */
    handleCorrect() {
        if (this.isBattling) return;
        this.startBattleTurn(this.player, this.monster);
        
         // 👉 Thêm câu trả lời ngay khi đúng
        const history = document.getElementById("answers-history");
        if (history && window.QuestionType1?.currentData) {
            const en = window.QuestionType1.currentData.english_word;
            const vi = window.QuestionType1.currentData.vietnamese_translation;
            history.insertAdjacentHTML("beforeend", `
                <div class="bg-white/70 rounded-xl p-3 border-2 border-blue-200">
                    <p class="text-blue-600 font-bold">${en}</p>
                    <p class="text-green-600 italic">${vi}</p>
                </div>
            `);
        }

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
        }, 500);
    },

    handleWrong() {
        if (this.isBattling) return;
        // Monster tấn công người chơi khi trả lời sai
        this.startBattleTurn(this.monster, this.player);
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
     * Hiển thị hiệu ứng hồi máu
     */
    showHealEffect(healAmount) {
        const battle = document.getElementById('battleview');
        const heroEl = document.getElementById('hero');
        if (!battle || !heroEl) return;

        // Tính tọa độ hero
        const rect = heroEl.getBoundingClientRect();
        const bvRect = battle.getBoundingClientRect();
        const centerX = rect.left - bvRect.left + rect.width / 2;
        const centerY = rect.top - bvRect.top + rect.height / 2;

        // Tạo số +HP màu xanh
        const healEl = document.createElement('div');
        healEl.className = 'heal-popup';
        healEl.innerText = `+${healAmount} HP`;
        healEl.style.left = centerX + 'px';
        healEl.style.top = centerY + 'px';
        healEl.style.position = 'absolute';
        healEl.style.transform = 'translate(-50%, 0)';
        healEl.style.fontSize = '32px';
        healEl.style.fontWeight = '900';
        healEl.style.color = '#22c55e';
        healEl.style.textShadow = '0 0 8px #fff, 0 0 12px #22c55e';
        healEl.style.animation = 'floatUpHeal 1.5s ease-out forwards';
        healEl.style.pointerEvents = 'none';
        healEl.style.zIndex = '50';

        battle.appendChild(healEl);

        // Hiệu ứng ánh sáng xanh quanh hero
        heroEl.style.boxShadow = '0 0 30px #22c55e, 0 0 50px #22c55e';
        setTimeout(() => {
            heroEl.style.boxShadow = '';
        }, 1000);

        if (this.healSound) {
            this.healSound.currentTime = 0;
            this.healSound.play().catch(e => console.log('Audio blocked:', e));
        }

        // Tạo các particle hồi máu xung quanh hero
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.innerText = '💚';
            particle.style.position = 'absolute';
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            particle.style.fontSize = '20px';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '45';
            
            const angle = (Math.PI * 2 / 8) * i;
            const distance = 60;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            
            particle.style.animation = 'healParticle 1s ease-out forwards';
            particle.style.setProperty('--heal-tx', `${tx}px`);
            particle.style.setProperty('--heal-ty', `${ty}px`);
            
            battle.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }

        // Xóa số +HP sau animation
        setTimeout(() => healEl.remove(), 1500);
    },

   /**
     * Xử lý khi quái vật bị tiêu diệt
     */
   handleMonsterDefeat() {
    this.isBattling = true;
    const monsterType = this.monster?.type;
    let hpRestore = 0;
    this.stopBossMusic();

    if (window.QuestionManager?.currentQuestion) {
        const currentQ = window.QuestionManager.currentQuestion;
        if (currentQ.monsterAttackTimer) {
            clearInterval(currentQ.monsterAttackTimer);
            currentQ.monsterAttackTimer = null;
        }
    }

    if (monsterType === 'elite') {
        hpRestore = 20;
    } else if (monsterType === 'boss' || monsterType === 'final boss') {
        hpRestore = 50;
    }
    
    if (hpRestore > 0) {
        const oldHp = this.player.hp_current;
        this.player.hp_current = Math.min(this.player.max_hp, this.player.hp_current + hpRestore);
        const actualRestore = this.player.hp_current - oldHp;
        
        // Hiển thị thông báo hồi HP
        if (actualRestore > 0) {
            this.showHealEffect(actualRestore);
            const toast = document.createElement('div');
            toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50 animate-bounce';
            toast.innerText = `💚 Hồi ${actualRestore} HP từ ${monsterType}!`;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.5s ease-out';
                setTimeout(() => toast.remove(), 500);
            }, 2000);
        }
        
        this.updateAllUI();
    }

    setTimeout(async () => {
        this.currentStep++;
        
        // Kiểm tra đã hết station chưa
        if (this.currentStep > this.totalStepsPerStation) {
            await this.loadNextStation();
        } else {
            await this.spawnMonsterFromStep();
        }
        
        this.updateAllUI();
        this.isBattling = false;
        this.nextQuestion();
    }, 1500);
    },

    /**
 * Kiểm tra và mở khóa hero nếu hoàn thành station điều kiện
 */
async checkAndUnlockHero(completedStationId) {
    try {
        // Tìm hero bị khóa bởi station này
        const { data: lockedHeroes } = await window.supabase
            .from('heroes')
            .select('id, name, is_locked, unlock_station_id')
            .eq('unlock_station_id', completedStationId)
            .eq('is_locked', true);
        
        if (!lockedHeroes || lockedHeroes.length === 0) {
            return; // Không có hero nào cần unlock
        }
        
        // Unlock tất cả heroes
        for (const hero of lockedHeroes) {
            const { error } = await window.supabase
                .from('heroes')
                .update({ is_locked: false })
                .eq('id', hero.id);
            
            if (!error) {
                // Hiển thị thông báo unlock
                this.showUnlockNotification(hero.name);
            }
        }
    } catch (err) {
        console.error('Lỗi check unlock hero:', err);
    }
},

    /**
     * Hiển thị thông báo mở khóa hero
     */
    showUnlockNotification(heroName) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-8 rounded-3xl shadow-2xl border-4 border-white animate-bounce';
        notification.innerHTML = `
            <div class="text-center">
                <div class="text-6xl mb-4">🎉</div>
                <h2 class="text-3xl font-black mb-2">HERO MỚI!</h2>
                <p class="text-xl font-bold">${heroName} đã được mở khóa!</p>
                <p class="text-sm mt-2 opacity-80">Bạn có thể chọn hero này ở lần chơi tiếp theo</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Tự động ẩn sau 4 giây
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    },
    /**
     * Load station tiếp theo
     */
    async loadNextStation() {
        try {
            await this.checkAndUnlockHero(this.currentStation.id);

            // Lấy station tiếp theo
            const { data: nextStation, error } = await window.supabase
                .from('stations')
                .select('*')
                .eq('location_id', this.currentLocation.id)
                .gt('order_index', this.currentStation.order_index)
                .order('order_index', { ascending: true })
                .limit(1)
                .single();

            if (error || !nextStation) {
                // Hết station trong location này → Load location mới
                await this.loadNextLocation();
            } else {
                this.currentStation = nextStation;
                this.currentStep = 1;
                await this.spawnMonsterFromStep();
            }
        } catch (err) {
            console.error('Lỗi load next station:', err);
        }
    },

    /**
     * Load location tiếp theo
     */
    async loadNextLocation() {
        try {
            const { data: nextLocation, error } = await window.supabase
                .from('locations')
                .select('*')
                .gt('order_index', this.currentLocation.order_index)
                .order('order_index', { ascending: true })
                .limit(1)
                .single();

            if (error || !nextLocation) {
                // Hết game
                alert('🎉 Chúc mừng! Bạn đã hoàn thành toàn bộ cuộc phiêu lưu!');
                this.showMainMenu();
                return;
            }

            this.currentLocation = nextLocation;
            
            // Load station đầu tiên của location mới
            const { data: firstStation } = await window.supabase
                .from('stations')
                .select('*')
                .eq('location_id', nextLocation.id)
                .order('order_index', { ascending: true })
                .limit(1)
                .single();

            this.currentStation = firstStation;
            this.currentStep = 1;
            await this.spawnMonsterFromStep();
        } catch (err) {
            console.error('Lỗi load next location:', err);
        }
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
     * Bật nhạc Boss
     */
    playBossMusic() {
        if (this.bossBgm) {
            this.bossBgm.loop = true; // Cho nhạc lặp lại
            this.bossBgm.volume = 0.5; // Chỉnh âm lượng (0.0 đến 1.0)
            this.bossBgm.currentTime = 0; // Phát từ đầu
            this.bossBgm.play().catch(e => console.log("Chưa thể phát nhạc do trình duyệt chặn:", e));
        }
    },

    /**
     * Tắt nhạc Boss
     */
    stopBossMusic() {
        if (this.bossBgm) {
            this.bossBgm.pause();
            this.bossBgm.currentTime = 0;
        }
    },

    /**
     * Khởi tạo các khung giao diện tĩnh
     */
    initUI() {
        const battleView = document.getElementById('battleview');
        if (!battleView) return;
    
        // Tạo progress bar chia đoạn
        const segments = Array.from({ length: this.totalStepsPerStation }, (_, i) => {
            return `<div id="step-${i+1}" 
                        class="flex-1 h-6 mx-0.5 rounded-md border border-white 
                                bg-gray-300 transition-colors duration-300"></div>`;
        }).join('');


        // Giữ lại nội dung cũ (div#hero và div#monster) và chỉ chèn thêm UI overlay
        // Chúng ta sử dụng insertAdjacentHTML để không đè mất các thẻ sprite có sẵn trong index.html
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
        existingOverlays.forEach(el => { if(!el.classList.contains('sprite')) el.remove(); });
        
        battleView.insertAdjacentHTML('beforeend', uiOverlay);
    },
    
    /**
     * Cập nhật toàn bộ các vùng Dashboard và UserUI
     */
    updateAllUI() {

        // 1. Cập nhật thông tin người chơi ở UserUI
        const userUI = document.getElementById('userUI');
        if (userUI && this.player) {
            // Xóa nội dung cũ nếu có
            const oldPlayerInfo = document.getElementById('player-info-card');
            if (oldPlayerInfo) oldPlayerInfo.remove();
            
            // Tạo card thông tin người chơi
            const playerCard = document.createElement('div');
            playerCard.id = 'player-info-card';
            playerCard.className = 'bg-white/70 rounded-2xl p-4 border-4 border-blue-200 shadow-lg mb-4';
            playerCard.innerHTML = `
                <div class="flex flex-col items-center gap-3">
                    <div class="text-5xl">${this.player.avatar_key || '👤'}</div>
                    <div class="text-center">
                        <p class="font-black text-xl text-blue-700">${this.player.display_name}</p>
                        <p class="text-sm font-bold text-gray-500">Level ${this.player.level || 1}</p>
                    </div>
                </div>
            `;
            
            // Chèn vào đầu userUI
            userUI.insertBefore(playerCard, userUI.firstChild);
        }
        
        // 2. Cập nhật thông tin Quái vật
        const mInfo = document.getElementById('monster-info');
        if (mInfo && this.monster) {
            mInfo.innerHTML = `
                <h3 class="text-xl font-black text-red-600 uppercase mb-2">Tiến trình</h3>
                <div class="bg-white/50 rounded-2xl p-3 border-2 border-purple-200 mb-3">
                    <p class="text-xs text-purple-600 font-bold">📍 ${this.currentLocation?.name || '...'}</p>
                    <p class="text-xs text-blue-600">🚉 ${this.currentStation?.name || '...'} (${this.currentStep}/10)</p>
                </div>
                
                <h3 class="text-xl font-black text-red-600 uppercase mb-2">Đối thủ</h3>
                <div class="bg-white/50 rounded-2xl p-3 border-2 border-red-200">
                    <p class="font-bold text-lg">${this.monster.name}</p>
                    <p class="text-sm text-red-500 font-bold uppercase">${this.monster.type}</p>
                    <div class="mt-4 text-xs font-bold text-gray-500 italic">
                        "Cố lên! Đánh bại nó để đi tiếp nào."
                    </div>
                </div>
            `;
        }
    
        // 3. Tô màu cho các step đã hoàn thành
        for (let i = 1; i <= this.totalStepsPerStation; i++) {
            const seg = document.getElementById(`step-${i}`);
            if (!seg) continue;
    
            if (i < this.currentStep) {
                seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-green-500";
            } else if (i === this.currentStep) {
                if (this.monster?.type === "normal") seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-blue-400";
                else if (this.monster?.type === "elite") seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-yellow-400";
                else if (this.monster?.type === "boss") seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-red-500";
            } else {
                seg.className = "flex-1 h-6 mx-0.5 rounded-md border border-white bg-gray-300";
            }
        }
    
        // 4. Cập nhật chỉ số máu
        this.updateBattleStatus();

        // 5. Thêm nút Thoát ra Menu vào UserUI
        //const userUI = document.getElementById('userUI');
        if (userUI) {
            // Xóa nút cũ nếu có
            const oldExitBtn = document.getElementById('exit-menu-btn');
            const oldKillBtn = document.getElementById('kill-monster-btn');

            if (oldExitBtn) oldExitBtn.remove();
            if (oldKillBtn) oldKillBtn.remove();

            const killBtn = document.createElement('button');
            killBtn.id = 'kill-monster-btn';
            killBtn.className = 'w-full mb-2 p-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold transition-all shadow-md';
            killBtn.innerHTML = '💀 Kill Monster (Test)';
            killBtn.onclick = () => {
                if (this.monster && this.monster.hp > 0) {
                    this.monster.hp = 0;
                    this.updateBattleStatus();
                    this.handleMonsterDefeat();
                }
            };
            userUI.appendChild(killBtn);
            
            // Tạo nút mới
            const exitBtn = document.createElement('button');
            exitBtn.id = 'exit-menu-btn';
            exitBtn.className = 'w-full mt-auto p-3 rounded-2xl bg-red-400 hover:bg-red-500 text-white font-bold transition-all shadow-md';
            exitBtn.innerHTML = '🚪 Thoát ra Menu';
            exitBtn.onclick = () => {
                const confirm = window.confirm('Bạn có muốn lưu game và thoát ra menu?');
                if (confirm) {
                    this.saveGameState();
                    this.showMainMenu();
                }
            };
            userUI.appendChild(exitBtn);
        }
    },

    startBattleTurn(attacker, defender) {
        this.isBattling = true;
    
        const attackerEl = (attacker === this.player) 
            ? document.getElementById('hero') 
            : document.getElementById('monster');
    
            if (!attackerEl) {
                this.isBattling = false;
                return;
              }
    
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
            
                // Chỉ load câu hỏi mới nếu Hero tấn công và monster còn sống
                if (attacker === this.player && this.monster.hp > 0) {
                    // Kiểm tra xem QuestionType hiện tại có cần auto-reload không
                    const currentQ = window.QuestionManager?.currentQuestion;
                    
                    // Nếu không có thuộc tính autoReload HOẶC autoReload = true
                    if (!currentQ || currentQ.autoReload !== false) {
                        this.nextQuestion();
                    }
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
        const isPlayer = (defender === this.player) || (defender.id === this.player.id);

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
        if (isPlayer && this.player.hp_current <= 0) {
            this.stopBossMusic();
            setTimeout(() => {
                alert("Bạn đã bị đánh bại! Hãy cố gắng ở lần sau.");
                location.reload();
            }, 500);
        } else if (!isPlayer && this.monster.hp <= 0) { // !isPlayer nghĩa là Monster
            this.monster.isDead = true;
            this.handleMonsterDefeat();
        }
    },

        // Load trạng thái game từ localStorage
        loadGameState() {
            const saved = localStorage.getItem('gameState');
            if (!saved) return null;
            
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Lỗi load game:', e);
                return null;
            }
        },

        // Xóa game đã lưu (khi chơi lại từ đầu)
        clearGameState() {
            localStorage.removeItem('gameState');
    },

    /**
     * Hiển thị lại menu chính (quay về màn hình chọn user)
     */
    showMainMenu() {
        // Dừng game
        this.isBattling = false;

        if (window.QuestionManager?.currentQuestion) {
            const currentQ = window.QuestionManager.currentQuestion;
            if (currentQ.monsterAttackTimer) {
                clearInterval(currentQ.monsterAttackTimer);
                currentQ.monsterAttackTimer = null;
            }
            if (typeof currentQ.destroy === 'function') {
                currentQ.destroy();
            }
        }
        
        // Xóa hoàn toàn nội dung các vùng
        const questionArea = document.getElementById('questionarea');
        const battleView = document.getElementById('battleview');
        const userUI = document.getElementById('userUI');
        const dashboard = document.getElementById('dashboard');
        
        if (questionArea) questionArea.innerHTML = '';
        if (userUI) userUI.innerHTML = '';
        
        // Reset battleView về trạng thái ban đầu
        if (battleView) {
            battleView.innerHTML = `
                <div class="flex justify-between items-center h-full">
                    <div id="hero" class="sprite"></div>
                    <div id="monster" class="sprite"></div>
                </div>
            `;
        }
        
        // Xóa monster-info và answers-history trong dashboard
        if (dashboard) {
            const monsterInfo = document.getElementById('monster-info');
            const answersHistory = document.getElementById('answers-history');
            if (monsterInfo) monsterInfo.innerHTML = '';
            if (answersHistory) answersHistory.innerHTML = '';
        }
        
        // Dọn dẹp câu hỏi hiện tại
        if (window.QuestionManager && typeof window.QuestionManager.destroy === 'function') {
            window.QuestionManager.destroy();
        }
        if (window.QuestionType1 && typeof window.QuestionType1.destroy === 'function') {
            window.QuestionType1.destroy();
        }
        if (window.QuestionType2 && typeof window.QuestionType2.destroy === 'function') {
            window.QuestionType2.destroy();
        }
        
        // Reset player và monster
        this.player = null;
        this.monster = null;
        this.currentStep = 1;
        
        // Quay về màn hình chọn profiles
        if (window.AuthComponent) {
            window.AuthComponent.displayLoginMenu();
        }
    },
    
    stopGame() {
        // Dọn dẹp câu hỏi hiện tại
        if (window.QuestionManager) {
            window.QuestionManager.destroy();
        }
        
        // Xóa nội dung các vùng
        const questionArea = document.getElementById('questionarea');
        const battleView = document.getElementById('battleview');
        if (questionArea) questionArea.innerHTML = '';
        if (battleView) battleView.innerHTML = '';
    },
};

window.GameEngine = GameEngine;