// js/question/question5.js

const QuestionType5 = {
    currentData: null,
    onCorrect: null,
    onWrong: null,
    monsterAttackTimer: null,
    monsterAttackCountdown: 10,
    selectedLetters: [],
    completedWords: [],

    async load(enemyType = "elite") {
        if (!window.supabase) {
            setTimeout(() => this.load(enemyType), 300);
            return;
        }

        try {
            // Lấy 100 từ random
            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation")
                .limit(100);

            if (error) throw error;

            // Chọn 5 từ ngẫu nhiên
            const shuffled = data.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 5).map(item => ({
                english: item.english_word.trim().toUpperCase(),
                vietnamese: item.vietnamese_translation.trim()
            }));

            this.currentData = { words: selected };
            this.completedWords = [];
            this.selectedLetters = [];
            
            this.renderQuestionUI();
            this.startMonsterAttackTimer();

        } catch (err) {
            console.error("QuestionType5 load error:", err);
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const { words } = this.currentData;

        // Tạo danh sách tất cả các chữ cái từ 5 từ tiếng Anh
        let allLetters = [];
        words.forEach(w => {
            allLetters.push(...w.english.split(''));
        });
        
        // Trộn ngẫu nhiên
        allLetters = allLetters.sort(() => Math.random() - 0.5);

        area.innerHTML = `
            <div class="flex w-full h-full gap-6 p-4">
                <!-- Cột trái: Danh sách từ tiếng Việt -->
                <div class="w-1/3 space-y-3 overflow-y-auto">
                    <h3 class="text-xl font-black text-purple-600 mb-4">Ghép từ:</h3>
                    ${words.map((w, idx) => `
                        <div class="bg-white/80 rounded-xl p-3 border-2 border-purple-200">
                            <p class="text-green-600 font-bold text-lg">${w.vietnamese}</p>
                            <p id="answer-${idx}" class="text-blue-600 font-black text-xl mt-2 min-h-[28px]"></p>
                        </div>
                    `).join('')}
                </div>

                <!-- Cột phải: Vùng chơi -->
                <div class="flex-1 flex flex-col gap-4">
                    <!-- Thanh countdown -->
                    <div class="bg-red-100 rounded-xl p-3 border-2 border-red-300 flex items-center justify-between">
                        <span class="font-bold text-red-600">⏰ Quái tấn công sau:</span>
                        <span id="countdown-timer" class="text-3xl font-black text-red-600">10s</span>
                    </div>

                    <!-- Vùng hiển thị từ đang ghép -->
                    <div id="current-word" class="bg-blue-50 rounded-xl p-4 border-2 border-blue-300 min-h-[80px] flex items-center justify-center gap-2 flex-wrap">
                        <span class="text-gray-400 italic">Chọn các chữ cái bên dưới...</span>
                    </div>

                    <!-- Nút hành động -->
                    <div class="flex gap-3">
                        <button id="submit-btn" class="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl text-lg">
                            ✓ Xác nhận
                        </button>
                        <button id="clear-btn" class="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white font-black rounded-xl">
                            ✗ Xóa
                        </button>
                    </div>

                    <!-- Grid chữ cái (có thể click để chọn) -->
                    <div id="letters-container" class="relative flex-1 overflow-hidden rounded-xl bg-gradient-to-b from-purple-50 to-white p-4 border-2 border-purple-200">
                        ${allLetters.map((letter, idx) => `
                            <button data-idx="${idx}" data-letter="${letter}"
                                    class="letter-btn absolute w-12 h-12 bg-white border-2 border-purple-300 rounded-lg 
                                           font-bold text-xl hover:bg-yellow-100 transition-all shadow-md cursor-pointer
                                           hover:scale-110"
                                    style="transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);">
                                ${letter}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        this.positionLetters();
        this.attachEventHandlers();
    },

    positionLetters() {
        const container = document.getElementById('letters-container');
        if (!container) return;

        const letters = container.querySelectorAll('.letter-btn');
        const containerRect = container.getBoundingClientRect();
        const cols = 8;
        const gap = 8;
        const btnSize = 48;

        letters.forEach((btn, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            
            btn.style.left = `${col * (btnSize + gap) + gap}px`;
            btn.style.top = `${row * (btnSize + gap) + gap}px`;
            btn.dataset.originalX = btn.style.left;
            btn.dataset.originalY = btn.style.top;
        });

        this.attachEventHandlers();
    },

    attachEventHandlers() {
        const letterBtns = document.querySelectorAll('.letter-btn');
        const submitBtn = document.getElementById('submit-btn');
        const clearBtn = document.getElementById('clear-btn');

        // Click chọn chữ cái → Nhảy lên trên
        letterBtns.forEach(btn => {
            btn.onclick = () => {
                if (btn.classList.contains('selected')) return; // Đã chọn rồi

                const letter = btn.dataset.letter;
                const idx = btn.dataset.idx;

                this.selectedLetters.push({ letter, idx, btn });
                btn.classList.add('selected');
                
                // Nhảy lên vùng current-word
                this.moveLetterToTop(btn);
                this.updateCurrentWord();
            };
        });

        // Submit từ
        submitBtn.onclick = () => this.submitWord();

        // Xóa từ đang ghép → Nhảy xuống dưới
        clearBtn.onclick = () => this.clearWord();
    },

    moveLetterToTop(btn) {
        const currentWordArea = document.getElementById('current-word');
        if (!currentWordArea) return;

        const currentWordRect = currentWordArea.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const container = document.getElementById('letters-container');
        const containerRect = container.getBoundingClientRect();

        // Tính vị trí đích (giữa vùng current-word)
        const targetX = currentWordRect.left - containerRect.left + (currentWordRect.width / 2) - 24;
        const targetY = currentWordRect.top - containerRect.top + (currentWordRect.height / 2) - 24;

        btn.style.left = `${targetX}px`;
        btn.style.top = `${targetY}px`;
        btn.style.opacity = '0.3';
        btn.style.pointerEvents = 'none';
    },

    moveLetterToOriginal(btn) {
        const originalX = btn.dataset.originalX;
        const originalY = btn.dataset.originalY;

        btn.style.left = originalX;
        btn.style.top = originalY;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    },

    updateCurrentWord() {
        const currentWordArea = document.getElementById('current-word');
        if (!currentWordArea) return;

        if (this.selectedLetters.length === 0) {
            currentWordArea.innerHTML = '<span class="text-gray-400 italic">Chọn các chữ cái bên dưới...</span>';
        } else {
            currentWordArea.innerHTML = this.selectedLetters.map(item => 
                `<span class="text-3xl font-black text-blue-600">${item.letter}</span>`
            ).join('');
        }
    },

    clearWord() {
        // Cho chữ cái nhảy xuống vị trí cũ (KHÔNG XÓA)
        this.selectedLetters.forEach(item => {
            item.btn.classList.remove('selected');
            this.moveLetterToOriginal(item.btn);
        });
        
        this.selectedLetters = [];
        this.updateCurrentWord();
    },

    updateCurrentWord() {
        const currentWordArea = document.getElementById('current-word');
        if (!currentWordArea) return;

        if (this.selectedLetters.length === 0) {
            currentWordArea.innerHTML = '<span class="text-gray-400 italic">Chọn các chữ cái bên dưới...</span>';
        } else {
            currentWordArea.innerHTML = this.selectedLetters.map(item => 
                `<span class="text-3xl font-black text-blue-600">${item.letter}</span>`
            ).join('');
        }
    },

    submitWord() {
        if (this.selectedLetters.length === 0) return;

        const word = this.selectedLetters.map(item => item.letter).join('');
        const { words } = this.currentData;

        // Tìm từ khớp
        const foundIndex = words.findIndex((w, idx) => 
            w.english === word && !this.completedWords.includes(idx)
        );

        if (foundIndex >= 0) {
            // ✅ ĐÚNG - Xóa chữ khỏi grid vĩnh viễn
            const answerEl = document.getElementById(`answer-${foundIndex}`);
            if (answerEl) answerEl.innerText = word;

            this.completedWords.push(foundIndex);

            // Xóa các chữ cái đã dùng khỏi grid (với animation)
            this.selectedLetters.forEach(item => {
                item.btn.style.transform = 'scale(0) rotate(360deg)';
                item.btn.style.opacity = '0';
                setTimeout(() => item.btn.remove(), 400);
            });
            
            this.selectedLetters = [];
            this.updateCurrentWord();

            // Reset timer quái tấn công
            this.resetMonsterAttackTimer();

            // Gọi callback tấn công
            if (typeof this.onCorrect === 'function') {
                this.onCorrect();
            }

            // Kiểm tra hoàn thành
            if (this.completedWords.length === words.length) {
                this.stopMonsterAttackTimer();
                setTimeout(() => {
                    alert("Hoàn thành! Tất cả từ đã được ghép đúng!");
                }, 300);
            }
        } else {
            // ❌ SAI - Làm chữ rung rồi đẩy xuống vị trí cũ (KHÔNG XÓA)
            const currentWordArea = document.getElementById('current-word');
            if (currentWordArea) {
                currentWordArea.classList.add('animate-shake');
                setTimeout(() => currentWordArea.classList.remove('animate-shake'), 500);
            }

            // Đợi 300ms rồi cho chữ nhảy xuống (clearWord sẽ đẩy về vị trí cũ)
            setTimeout(() => {
                this.clearWord(); // clearWord đã có logic đẩy chữ về vị trí cũ
            }, 50);
        }
    },

    startMonsterAttackTimer() {
        this.monsterAttackCountdown = 10;
        this.updateCountdownDisplay();

        this.monsterAttackTimer = setInterval(() => {
            this.monsterAttackCountdown--;
            this.updateCountdownDisplay();

            if (this.monsterAttackCountdown <= 0) {
                this.monsterAttack();
                this.monsterAttackCountdown = 10; // Reset
            }
        }, 1500);
    },

    resetMonsterAttackTimer() {
        this.monsterAttackCountdown = 10;
        this.updateCountdownDisplay();
    },

    stopMonsterAttackTimer() {
        if (this.monsterAttackTimer) {
            clearInterval(this.monsterAttackTimer);
            this.monsterAttackTimer = null;
        }
    },

    updateCountdownDisplay() {
        const countdownEl = document.getElementById('countdown-timer');
        if (countdownEl) {
            countdownEl.innerText = `${this.monsterAttackCountdown}s`;
            
            // Đổi màu khi sắp hết giờ
            if (this.monsterAttackCountdown <= 3) {
                countdownEl.classList.add('animate-pulse');
            } else {
                countdownEl.classList.remove('animate-pulse');
            }
        }
    },

    monsterAttack() {
        // Quái tấn công Hero
        if (window.GameEngine && window.GameEngine.player) {
            const damage = 10;
            window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - damage);
            window.GameEngine.updateAllUI();

            if (typeof window.GameEngine.showDamage === 'function') {
                window.GameEngine.showDamage(window.GameEngine.player, damage);
            }

            // Hiệu ứng rung
            const heroEl = document.getElementById('hero');
            if (heroEl) {
                heroEl.classList.add('shake');
                setTimeout(() => heroEl.classList.remove('shake'), 400);
            }
        }
    },

    destroy() {
        this.stopMonsterAttackTimer();
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.selectedLetters = [];
        this.completedWords = [];
    }
};

export default QuestionType5;
window.QuestionType5 = QuestionType5;