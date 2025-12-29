/**
 * GameEngine - Quản lý logic chính của trò chơi
 */
const GameEngine = {
    isBattling: false,

    player: null,
    monster: null,
    currentStep: 1, // Chặng đường từ 1-10
    totalSteps: 10,
    apiKey: "", // Key sẽ được môi trường cung cấp tự động

    /**
     * Khởi tạo game với dữ liệu User từ Auth
     */
    async start(userData) {
        this.player = {
            ...userData,
            max_hp: 100,
            hp_current: userData.hp_current || 100,
            state: 'idle', // trạng thái hiện tại
            isDead: false,
        };
        
        this.currentStep = 1;
        
        this.initUI();
        this.spawnMonster();
        this.updateAllUI();

        // Bắt đầu tải câu hỏi đầu tiên
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
    handleCorrect(word) {
        if (this.isBattling) return;
        this.startBattleTurn(this.player, this.monster);
        

        const damage = word.length;
        //this.monster.hp -= damage;
        if (this.monster.hp < 0) this.monster.hp = 0;

        // Hiển thị hiệu ứng tấn công (giả lập)
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
            } else {
                this.nextQuestion();
            }
        }, 500);
    },

    /**
     * Xử lý khi quái vật bị tiêu diệt
     */
    handleMonsterDefeat() {
        setTimeout(() => {
        this.currentStep++;
        this.spawnMonster();
        this.isBattling = false;
        }, 1000); // đợi die animation
    
        if (this.currentStep > this.totalSteps) {
            alert("Chúc mừng! Bạn đã hoàn thành bản đồ!");
            return;
        }

        // Hiệu ứng chuyển cảnh nhẹ
        const questionArea = document.getElementById('questionarea');
        if (questionArea) {
            questionArea.innerHTML = `<h2 class="text-3xl font-bold text-green-500 animate-bounce">CHIẾN THẮNG!</h2>`;
        }
        
        setTimeout(() => {
            this.spawnMonster();
            this.updateAllUI();
            this.nextQuestion();
        }, 1500);
    },

    /**
     * Cập nhật chỉ số máu trong trận đấu
     */
    updateBattleStatus() {
        const mHpFill = document.getElementById('monster-hp-fill');
        const mHpText = document.getElementById('monster-hp-text');
        if (mHpFill && mHpText) {
            const mPercent = (this.monster.hp / this.monster.max_hp) * 100;
            mHpFill.style.width = `${mPercent}%`;
            mHpText.innerText = `${this.monster.hp}/${this.monster.max_hp}`;
        }
    },

    /**
     * Khởi tạo các khung giao diện tĩnh
     */
    initUI() {
        const battleView = document.getElementById('battleview');
        if (!battleView) return;

        battleView.innerHTML = `
            <!-- Progress Bar -->
            <div class="absolute top-4 left-1/2 -translate-x-1/2 w-2/3 h-6 bg-white/50 rounded-full border-2 border-white shadow-sm overflow-hidden">
                <div id="progress-fill" class="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500" style="width: 10%"></div>
                <div class="absolute inset-0 flex justify-between px-4 items-center text-[10px] font-bold text-orange-800 uppercase">
                    <span>Khởi hành</span>
                    <span>Đích đến</span>
                </div>
            </div>

            <div class="flex justify-between items-end h-full px-10 pb-4">
                <div id="player-sprite" class="flex flex-col items-center">
                    <div class="relative">
                        <div id="player-hp-bar" class="w-24 h-6 bg-gray-200 rounded-lg border-2 border-white mb-2 overflow-hidden relative shadow-sm">
                            <div id="player-hp-fill" class="h-full bg-green-500 transition-all duration-300" style="width: 100%"></div>
                            <div class="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-md">
                                <span id="player-hp-text">100/100</span>
                            </div>
                        </div>
                        <div class="text-6xl animate-bounce" style="animation-duration: 2s">${this.player.avatar_key || '🧑‍🚀'}</div>
                    </div>
                    <span class="font-bold text-blue-700 bg-white/80 px-2 rounded-lg mt-1">${this.player.display_name}</span>
                </div>

                <div id="monster-sprite" class="flex flex-col items-center">
                    <div class="relative">
                        <div id="monster-hp-bar" class="w-24 h-6 bg-gray-200 rounded-lg border-2 border-white mb-2 overflow-hidden relative shadow-sm">
                            <div id="monster-hp-fill" class="h-full bg-red-500 transition-all duration-300" style="width: 100%"></div>
                            <div class="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-md">
                                <span id="monster-hp-text">50/50</span>
                            </div>
                        </div>
                        <div id="monster-emoji" class="text-7xl transition-all duration-300">👾</div>
                    </div>
                    <span id="monster-name" class="font-bold text-red-700 bg-white/80 px-2 rounded-lg mt-1">Quái vật</span>
                </div>
            </div>
        `;
    },

    /**
     * Tạo quái vật dựa trên bước đi hiện tại
     */
    spawnMonster() {
        let type = 'Thường';
        let emoji = '👾';
        let hp = 50;
        let name = 'Quái nhỏ';

        if (this.currentStep === 5) {
            type = 'Elite';
            emoji = '👹';
            hp = 150;
            name = 'Đại quái';
        } else if (this.currentStep === 10) {
            type = 'Boss';
            emoji = '🐉';
            hp = 500;
            name = 'Rồng Chúa';
        } else {
            const minions = [
                {n: 'Nấm độc', e: '🍄'}, {n: 'Nhện con', e: '🕷️'}, 
                {n: 'Ma nhỏ', e: '👻'}, {n: 'Sói xám', e: '🐺'}
            ];
            const random = minions[Math.floor(Math.random() * minions.length)];
            name = random.n;
            emoji = random.e;
        }

        this.monster = {
            name: name,
            emoji: emoji,
            hp: hp,
            max_hp: hp,
            type: type,
            state: 'idle', // trạng thái hiện tại
            isDead: false,

        };
        
    },

    /**
     * Cập nhật toàn bộ các vùng Dashboard và UserUI
     */
    updateAllUI() {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) progressFill.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        
        const mEmoji = document.getElementById('monster-emoji');
        if (mEmoji) mEmoji.innerText = this.monster.emoji;
        
        const mName = document.getElementById('monster-name');
        if (mName) mName.innerText = this.monster.name;
        
        this.updateBattleStatus();

        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            dashboard.innerHTML = `
                <h3 class="text-xl font-black text-red-600 uppercase mb-2">Đối thủ</h3>
                <div class="bg-white/50 rounded-2xl p-3 border-2 border-red-200">
                    <p class="font-bold text-lg">${this.monster.name}</p>
                    <p class="text-sm text-red-500 font-bold uppercase">${this.monster.type}</p>
                    <div class="mt-4 text-xs font-bold text-gray-500 italic">
                        "Cố lên bé ơi! Đánh bại nó để đi tiếp nào."
                    </div>
                </div>
            `;
        }

        const userUI = document.getElementById('userUI');
        if (userUI) {
            const inventoryGrid = Array(50).fill(0).map(() => 
                `<div class="w-full aspect-square bg-white/30 border border-blue-100 rounded-sm hover:bg-white/50 transition-colors"></div>`
            ).join('');

            userUI.innerHTML = `
                <div class="flex flex-col items-center w-full">
                    <div class="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-inner border-2 border-blue-200 mb-2">
                        ${this.player.avatar_key}
                    </div>
                    <p class="font-black text-blue-600 uppercase text-sm text-center leading-tight">${this.player.display_name}</p>
                    <p class="text-[10px] font-bold text-orange-500">Cấp độ ${this.player.level || 1}</p>
                </div>

                <div class="w-full mt-2 space-y-1">
                    <p class="text-[9px] font-bold uppercase text-gray-500 text-center">Trang bị</p>
                    <div class="grid grid-cols-2 gap-2 px-2">
                        <div class="aspect-square bg-white/50 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center text-xl">⚔️</div>
                        <div class="aspect-square bg-white/50 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center text-xl">🛡️</div>
                    </div>
                </div>

                <div class="w-full mt-4 flex flex-col h-full overflow-hidden">
                    <p class="text-[9px] font-bold uppercase text-gray-500 mb-1 text-center">Hòm đồ (50)</p>
                    <div class="grid grid-cols-5 gap-0.5 p-1 bg-blue-50/50 rounded-lg border border-blue-100">
                        ${inventoryGrid}
                    </div>
                </div>
            `;
        }
    },

    setState(entity, newState) {
        entity.state = newState;
        this.updateBattleSprite();
    },

    updateBattleSprite() {
        const heroEl = document.getElementById('hero');
        const monsterEl = document.getElementById('monster');
    
        if (heroEl) {
            heroEl.dataset.state = this.player.state;
        }
    
        if (monsterEl) {
            monsterEl.dataset.state = this.monster.state;
        }
    }    

    startBattleTurn(attacker, defender) {
        // Khoá input trong lượt
        this.isBattling = true;
        this.setRunOffset(attacker);

        // 1. attacker chạy tới
        this.setState(attacker, 'running');
    
        setTimeout(() => {
            // 2. attacker tấn công
            this.setState(attacker, 'attack');
    
            setTimeout(() => {
                // 3. defender bị đánh
                this.applyDamage(attacker, defender);
                this.setState(defender, 'hit');
    
                setTimeout(() => {
                    // 4. attacker chạy về
                    this.setState(attacker, 'running');
                    this.setState(defender, 'idle');
    
                    setTimeout(() => {
                        // 5. kết thúc lượt
                        this.setState(attacker, 'idle');
                        this.resetRunOffset();
                        this.isBattling = false;
                    }, 400);
    
                }, 400);
    
            }, 400);
    
        }, 400);
    }
    
};

setRunOffset(entity) {
    const battle = document.getElementById('battleview');
    if (!battle) return;

    const width = battle.offsetWidth;
    const runDistance = Math.floor(width * 0.35);

    battle.style.setProperty(
        entity === this.player ? '--hero-run' : '--monster-run',
        `${runDistance}px`
    );
}

resetRunOffset() {
    const battle = document.getElementById('battleview');
    if (!battle) return;

    battle.style.setProperty('--hero-run', '0px');
    battle.style.setProperty('--monster-run', '0px');
}

applyDamage(attacker, defender) {
    if (!defender || defender.hp <= 0) return;

    const damage = attacker.atk || 1;
    defender.hp -= damage;

    if (defender.hp < 0) defender.hp = 0;

    this.updateBattleStatus();

    if (defender.hp <= 0) {
        defender.hp = 0;
        defender.isDead = true;
        this.setState(defender, 'die');

        if (defender === this.monster) {
            this.handleMonsterDefeat();
        } else if (defender === this.player) {
            setTimeout(() => {
                alert('Game Over!');
                location.reload();
            }, 1200);
        }
    }
}



window.GameEngine = GameEngine;