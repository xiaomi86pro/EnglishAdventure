// js/question/question5.js

class Question5 {
    constructor({ vocabPool = [], containerId = 'questionarea', config = {} }) {
        this.vocabPool = vocabPool;
        this.containerId = containerId;
        this.config = {
            speakOnCorrect: config.speakOnCorrect ?? true,
            numWords: config.numWords ?? 5,
            countdownTime: config.countdownTime ?? 15,
            maxHints: config.maxHints ?? 3,
            ...config
        };
        // State
        this.words = [];
        this.selectedLetters = [];
        this.completedWords = [];
        this.hintCount = 0;
        this.monsterAttackTimer = null;
        this.monsterAttackCountdown = this.config.countdownTime;
        this._lastAnswered = null;
        // Callbacks
        this.onCorrect = null;
        this.onWrong = null;
    }

    /**
     * Khởi tạo câu hỏi
     */
    async init(enemyType = 'normal') {
        try {
            this.hintCount = 0;
            this.completedWords = [];
            this.selectedLetters = [];

            // Chọn 5 từ ngẫu nhiên từ vocabPool
            const shuffled = [...this.vocabPool].sort(() => Math.random() - 0.5);
            this.words = shuffled.slice(0, this.config.numWords).map(item => ({
                english: (item.english_word || item.english || '').trim().toUpperCase(),
                vietnamese: (item.vietnamese_translation || item.vietnamese || '').trim()
            }));
            this.render();
            this.startMonsterAttackTimer();
        } catch (err) {
            console.error('[Question5] init error:', err);
            throw err;
        }
    }

    /**
     * Render giao diện
     */
    render(keepTimer = false) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Tạo danh sách tất cả các chữ cái từ 5 từ tiếng Anh
        let allLetters = [];
        this.words.forEach(w => {
            const lettersNoSpace = w.english.replace(/\s+/g, '');
            allLetters.push(...lettersNoSpace.split(''));
        });
        
        // --- THAY ĐỔI Ở ĐÂY ---
        // Thay vì trộn ngẫu nhiên (Math.random), ta sắp xếp theo Alpha B (sort)
        allLetters = allLetters.sort(); 
        // ---------------------

        container.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl relative overflow-hidden">
        <div class="flex w-full h-full gap-6 p-4">
            <div class="absolute top-0 left-0 bg-yellow-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow z-10">
            Type 5: Combine Letters
            </div>
            <div class="absolute top-0 right-0 z-10">
            <button id="btn-hint" class="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-black rounded-bl-2xl">
                💡 Hint (<span id="hint-counter">${this.hintCount}</span>/<span id="hint-max">${this.config.maxHints}</span>)
            </button>
            </div>

            <div class="w-1/3 space-y-3 overflow-y-auto">
            <h3 class="text-xl font-black text-purple-600 mb-4">Ghép từ:</h3>
            ${this.words.map((w, idx) => `
                <div class="bg-white/80 rounded-xl p-3 border-2 border-purple-200">
                <p class="text-green-600 font-bold text-lg">${w.vietnamese}</p>
                <p id="answer-${idx}" class="text-blue-600 font-black text-xl mt-2 min-h-[28px]"></p>
                </div>
            `).join('')}
            </div>

            <div class="flex-1 flex flex-col gap-4">
            <div class="bg-red-100 rounded-xl p-3 border-2 border-red-300 flex items-center justify-between">
                <span class="font-bold text-red-600">⏰ Quái tấn công sau:</span>
                <span id="countdown-timer" class="text-3xl font-black text-red-600">${this.monsterAttackCountdown}s</span>
            </div>

            <div id="current-word" class="bg-blue-50 rounded-xl p-4 border-2 border-blue-300 min-h-[80px] flex items-center justify-center gap-2 flex-wrap">
                <span class="text-gray-400 italic">Chọn các chữ cái bên dưới...</span>
            </div>

            <div class="flex gap-3">
                <button id="submit-btn" class="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl text-lg">
                ✓ Xác nhận
                </button>
                <button id="clear-btn" class="flex-1 py-3 bg-gray-400 hover:bg-gray-500 text-white font-black rounded-xl text-lg">
                ✗ Xóa
                </button>
            </div>

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
        </div>
        `;
        this.positionLetters();
        this.attachEventHandlers();

        if (!keepTimer) {
            this.startMonsterAttackTimer();
        }
    }

    /**
     * Đặt vị trí các chữ cái
     */
    positionLetters() {
        const container = document.getElementById('letters-container');
        if (!container) return;

        const letters = container.querySelectorAll('.letter-btn');
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
    }

    /**
     * Gắn sự kiện
     */
    attachEventHandlers() {
        const letterBtns = document.querySelectorAll('.letter-btn');
        const submitBtn = document.getElementById('submit-btn');
        const clearBtn = document.getElementById('clear-btn');
        const hintBtn = document.getElementById('btn-hint');
        // Click chọn chữ cái
        letterBtns.forEach(btn => {
            btn.onclick = () => {
                if (btn.classList.contains('selected')) return;

                const letter = btn.dataset.letter;
                const idx = btn.dataset.idx;

                this.selectedLetters.push({ letter, idx, btn });
                btn.classList.add('selected');
                
                this.moveLetterToTop(btn);
                this.updateCurrentWord();
            };
        });
        if (submitBtn) submitBtn.onclick = () => this.submitWord();
        if (clearBtn) clearBtn.onclick = () => this.clearWord();
        if (hintBtn) hintBtn.onclick = () => this.useHint();
    }

    /**
     * Di chuyển chữ lên trên
     */
    moveLetterToTop(btn) {
        const currentWordArea = document.getElementById('current-word');
        if (!currentWordArea) return;

        const currentWordRect = currentWordArea.getBoundingClientRect();
        const container = document.getElementById('letters-container');
        const containerRect = container.getBoundingClientRect();
        const targetX = currentWordRect.left - containerRect.left + (currentWordRect.width / 2) - 24;
        const targetY = currentWordRect.top - containerRect.top + (currentWordRect.height / 2) - 24;

        btn.style.left = `${targetX}px`;
        btn.style.top = `${targetY}px`;
        btn.style.opacity = '0.3';
        btn.style.pointerEvents = 'none';
    }

    /**
     * Di chuyển chữ về vị trí cũ
     */
    moveLetterToOriginal(btn) {
        const originalX = btn.dataset.originalX;
        const originalY = btn.dataset.originalY;

        btn.style.left = originalX;
        btn.style.top = originalY;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }

    /**
     * Cập nhật hiển thị từ đang ghép
     */
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
    }

    /**
     * Xóa từ đang ghép
     */
    clearWord() {
        this.selectedLetters.forEach(item => {
            item.btn.classList.remove('selected');
            this.moveLetterToOriginal(item.btn);
        });
        this.selectedLetters = [];
        this.updateCurrentWord();
    }

    /**
     * Sử dụng hint
     */
    useHint() {
        if (this.hintCount >= this.config.maxHints) {
            if (typeof showToast === 'function') {
                showToast("⚠️ Bạn đã dùng hết Hint!");
            }
            return;
        }

        // Tìm từ chưa giải
        let unsolvedIndex = -1;
        for (let i = 0; i < this.words.length; i++) {
            if (this.completedWords.includes(i)) continue;
            const ansEl = document.getElementById(`answer-${i}`);
            const ansText = ansEl ? ansEl.innerText.trim() : "";
            if (!ansText) {
                unsolvedIndex = i;
                break;
            }
        }

        if (unsolvedIndex === -1) {
            if (typeof showToast === 'function') {
                showToast("✅ Bạn đã giải hết rồi!");
            }
            return;
        }

        const wordObj = this.words[unsolvedIndex];
        const english = wordObj.english;
        const chars = english.split('');
        // Tìm các vị trí không phải space
        const nonSpaceIndices = [];
        chars.forEach((ch, idx) => { 
            if (ch !== ' ') nonSpaceIndices.push(idx); 
        });
        let hintHtml = '';
        if (nonSpaceIndices.length <= 2) {
            hintHtml = english;
        } else {
            const keepCount = nonSpaceIndices.length - 2;
            let shownNonSpace = 0;
            for (let i = 0; i < chars.length; i++) {
                const ch = chars[i];
                if (ch === ' ') {
                    hintHtml += ' ';
                } else {
                    if (shownNonSpace < keepCount) {
                        hintHtml += ch;
                        shownNonSpace++;
                    }
                }
            }
            hintHtml += `<span class="hint-missing">??</span>`;
        }

        const answerEl = document.getElementById(`answer-${unsolvedIndex}`);
        if (answerEl) answerEl.innerHTML = hintHtml;

        this.hintCount++;
        const hintCounterEl = document.getElementById('hint-counter');
        if (hintCounterEl) hintCounterEl.innerText = this.hintCount;

        if (typeof showToast === 'function') {
            showToast(`💡 Hint đã dùng (${this.hintCount}/${this.config.maxHints})`);
        }
    }

    /**
     * Submit từ đã ghép
     */
    submitWord() {
        if (this.selectedLetters.length === 0) return;
        const word = this.selectedLetters.map(item => item.letter).join('');
        
        const foundIndex = this.words.findIndex((w, idx) => {
            const targetNormalized = w.english.replace(/\s+/g, '');
            return targetNormalized === word && !this.completedWords.includes(idx);
        });
        if (foundIndex >= 0) {
            const w = this.words[foundIndex];
            // Lưu để QuestionManager ghi vào history
            this._lastAnswered = { en: w.english, vi: w.vietnamese };
            // Hiển thị đáp án
            const answerEl = document.getElementById(`answer-${foundIndex}`);
            if (answerEl) answerEl.innerText = w.english;

            // Đánh dấu hoàn thành
            this.completedWords.push(foundIndex);
            // Phát âm
            if (this.config.speakOnCorrect) {
                this.speak(w.english);
            }

            // Xóa các chữ cái đã dùng
            this.selectedLetters.forEach(item => {
                item.btn.style.transform = 'scale(0) rotate(360deg)';
                item.btn.style.opacity = '0';
                setTimeout(() => item.btn.remove(), 400);
            
            });

            this.selectedLetters = [];
            this.updateCurrentWord();

            // Reset timer
            this.resetMonsterAttackTimer();
            // Callback
            if (typeof this.onCorrect === 'function') {
                const advance = this.completedWords.length === this.words.length;
                this.onCorrect(1, advance);
            }

            // Kiểm tra hoàn thành
            if (this.completedWords.length === this.words.length) {
                if (window.GameEngine?.monster?.hp > 0) {
                    setTimeout(() => this.loadNewRound(), 500);
                } else {
                    this.stopMonsterAttackTimer();
                }
            }
        } else {
            // Sai - hiệu ứng rung
            const currentWordArea = document.getElementById('current-word');
            if (currentWordArea) {
                currentWordArea.classList.add('animate-shake');
                setTimeout(() => currentWordArea.classList.remove('animate-shake'), 500);
            }

            setTimeout(() => this.clearWord(), 50);
            if (typeof this.onWrong === 'function') {
                this.onWrong();
            }
        }
    }

    /**
     * Load 5 từ mới
     */
    async loadNewRound() {
        try {
            const shuffled = [...this.vocabPool].sort(() => Math.random() - 0.5);
            this.words = shuffled.slice(0, this.config.numWords).map(item => ({
                english: (item.english_word || item.english || '').trim().toUpperCase(),
                vietnamese: (item.vietnamese_translation || item.vietnamese || '').trim()
            }));
            this.completedWords = [];
            this.selectedLetters = [];
            
            this.render(true); // Giữ timer
        } catch (err) {
            console.error('[Question5] loadNewRound error:', err);
        }
    }

    /**
     * Bắt đầu đếm ngược tấn công
     */
    startMonsterAttackTimer() {
        if (this.monsterAttackTimer) {
            clearInterval(this.monsterAttackTimer);
        }
        
        this.monsterAttackCountdown = this.config.countdownTime;
        this.updateCountdownDisplay();
        this.monsterAttackTimer = setInterval(() => {
            if (window.GameEngine?.monster?.hp <= 0) {
                this.stopMonsterAttackTimer();
                return;
            }
            
            this.monsterAttackCountdown--;
            
            this.updateCountdownDisplay();

            if (this.monsterAttackCountdown <= 0) {
                this.monsterAttack();
                this.monsterAttackCountdown = this.config.countdownTime;
            }
        }, 1000);
    }

    /**
     * Reset countdown
     */
    resetMonsterAttackTimer() {
        this.monsterAttackCountdown = this.config.countdownTime;
        this.updateCountdownDisplay();
    }

    /**
     * Dừng timer
     */
    stopMonsterAttackTimer() {
        if (this.monsterAttackTimer) {
            clearInterval(this.monsterAttackTimer);
            this.monsterAttackTimer = null;
        }
    }

    /**
     * Cập nhật hiển thị countdown
     */
    updateCountdownDisplay() {
        const countdownEl = document.getElementById('countdown-timer');
        if (countdownEl) {
            countdownEl.innerText = `${this.monsterAttackCountdown}s`;
            if (this.monsterAttackCountdown <= 3) {
                countdownEl.classList.add('animate-pulse');
            } else {
                countdownEl.classList.remove('animate-pulse');
            }
        }
    }

    /**
     * Quái tấn công
     */
    monsterAttack() {
        if (window.GameEngine?.player) {
            const damage = 10;
            window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - damage);
            //window.GameEngine.updateAllUI();

            if (typeof window.GameEngine.showDamage === 'function') {
                window.GameEngine.showDamage(window.GameEngine.player, damage);
            }

            const heroEl = document.getElementById('hero');
            if (heroEl) {
                heroEl.classList.add('shake');
                setTimeout(() => heroEl.classList.remove('shake'), 400);
            
                if (window.GameEngine.player.hp_current <= 0) {
                    if (typeof window.GameEngine.handleHeroDefeat === 'function') {
                        window.GameEngine.handleHeroDefeat();
                    }
                    this.stopMonsterAttackTimer();
                    // dừng countdown
                }
            }
        }
    }

    /**
     * Phát âm
     */
    speak(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    }

    /**
     * Hủy câu hỏi
     */
    destroy() {
        try { 
            if (window.speechSynthesis) speechSynthesis.cancel();
        } catch (e) {}

        this.stopMonsterAttackTimer();

        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = "";

        this.words = [];
        this.selectedLetters = [];
        this.completedWords = [];
        this.monsterAttackCountdown = this.config.countdownTime;
        this._lastAnswered = null;
    }
}

export default Question5;
window.Question5 = Question5;