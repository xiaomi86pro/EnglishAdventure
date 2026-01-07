// js/question/question5.js

const QuestionType5 = {
    autoReload: false,
    currentData: null,
    onCorrect: null,
    onWrong: null,
    monsterAttackTimer: null,
    monsterAttackCountdown: 10,
    selectedLetters: [],
    completedWords: [],
    hintCount: 0,
    maxHints: 3,


    speak(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    },

    async load(enemyType = "elite") {
    
        if (!window.supabase) {
            setTimeout(() => this.load(enemyType), 300);
            return;
        }

        try {
            this.hintCount = 0;
            this.maxHints = 3;

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

    renderQuestionUI(keepTimer = false) {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;
        
        const { words } = this.currentData;
        // Tạo danh sách tất cả các chữ cái từ 5 từ tiếng Anh
        let allLetters = [];
        words.forEach(w => {
            const lettersNoSpace = w.english.replace(/\s+/g, ''); // bỏ tất cả space
            allLetters.push(...lettersNoSpace.split(''));
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
                        <button id="btn-hint" class="px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-black rounded-xl">
                            💡 Hint (<span id="hint-counter">${this.hintCount}</span>/<span id="hint-max">${this.maxHints}</span>)
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
        const btnHint = document.getElementById('btn-hint');
        if (btnHint) {
            btnHint.onclick = () => this.useHint();
        }
        if (!keepTimer) {
            this.startMonsterAttackTimer();
        }
    },

    useHint() {
        // Kiểm tra dữ liệu
        if (!this.currentData || !Array.isArray(this.currentData.words)) {
            console.warn("No words available for hint.");
            return;
        }
    
        // Kiểm tra số lần dùng
        if (this.hintCount >= this.maxHints) {
            if (typeof showToast === 'function') {
                showToast("⚠️ Bạn đã dùng hết Hint!");
            } else {
                alert("Bạn đã dùng hết Hint!");
            }
            return;
        }
    
        const words = this.currentData.words;
    
        // Tìm index của một từ chưa giải (ô answer-{idx} trống và chưa nằm trong completedWords)
        let unsolvedIndex = -1;
        for (let i = 0; i < words.length; i++) {
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
            } else {
                alert("Bạn đã giải hết rồi!");
            }
            return;
        }
    
        const wordObj = words[unsolvedIndex];
        if (!wordObj || !wordObj.english) return;
    
        const english = wordObj.english; // ví dụ "ICE CREAM"
        // Tạo hint: bỏ 2 ký tự cuối tính theo ký tự không phải space,
        // nhưng giữ nguyên vị trí space trong hiển thị và thêm ?? đỏ
        const chars = english.split(''); // giữ spaces
        // Tìm các vị trí của ký tự không phải space
        const nonSpaceIndices = [];
        chars.forEach((ch, idx) => { if (ch !== ' ') nonSpaceIndices.push(idx); });
    
        let hintHtml = '';
        if (nonSpaceIndices.length <= 2) {
            // Nếu <=2 ký tự thực tế thì hiển thị toàn bộ (không thêm ??)
            hintHtml = english;
        } else {
            // Số ký tự thực tế cần giữ = totalNonSpace - 2
            const keepCount = nonSpaceIndices.length - 2;
            // Xây dựng hiển thị: duyệt chars, đếm non-space đã hiển thị
            let shownNonSpace = 0;
            for (let i = 0; i < chars.length; i++) {
                const ch = chars[i];
                if (ch === ' ') {
                    hintHtml += ' ';
                } else {
                    if (shownNonSpace < keepCount) {
                        hintHtml += ch;
                        shownNonSpace++;
                    } else {
                        // bỏ phần còn lại (2 ký tự cuối) — không thêm ký tự ở đây
                        // (chúng ta sẽ thêm '??' đỏ một lần ở cuối)
                    }
                }
            }
            // Thêm 2 dấu hỏi đỏ
            hintHtml += `<span class="hint-missing">??</span>`;
        }
    
        // Đưa hint lên ô đáp án tương ứng
        const answerEl = document.getElementById(`answer-${unsolvedIndex}`);
        if (answerEl) {
            answerEl.innerHTML = hintHtml;
        }
    
        // Tăng bộ đếm hint và cập nhật UI nút
        this.hintCount++;
        const hintCounterEl = document.getElementById('hint-counter');
        if (hintCounterEl) hintCounterEl.innerText = this.hintCount;
    
        // Thông báo ngắn
        if (typeof showToast === 'function') {
            showToast(`💡 Hint đã dùng (${this.hintCount}/${this.maxHints})`);
        } else {
            console.log(`Hint used ${this.hintCount}/${this.maxHints}`);
        }
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

    /**
     * Load 5 từ mới (giữ nguyên timer)
     */
    async loadNewRound() {
        if (!window.supabase) return;

        try {
            // Lấy 100 từ random
            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation")
                .limit(100);

            if (error) throw error;

            // Chọn 5 từ ngẫu nhiên (khác với round trước)
            const shuffled = data.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 5).map(item => ({
                english: item.english_word.trim().toUpperCase(),
                vietnamese: item.vietnamese_translation.trim()
            }));

            this.currentData = { words: selected };
            this.completedWords = [];
            this.selectedLetters = [];
            
            // ✅ KHÔNG reset timer, giữ nguyên countdown đang chạy
            this.renderQuestionUI(true); // true = giữ timer

        } catch (err) {
            console.error("QuestionType5 loadNewRound error:", err);
        }
    },

    submitWord() {
        if (this.selectedLetters.length === 0) return;
    
        // Chuỗi người chơi ghép (không có space)
        const word = this.selectedLetters.map(item => item.letter).join('');
        const { words } = this.currentData;
    
        // So sánh bằng phiên bản không có space của từ mục tiêu
        const foundIndex = words.findIndex((w, idx) => {
            const targetNormalized = w.english.replace(/\s+/g, ''); // bỏ space
            return targetNormalized === word && !this.completedWords.includes(idx);
        });
    
        if (foundIndex >= 0) {
            const w = words[foundIndex]; // Lấy object từ đúng index
    
            // ✅ Hiển thị đáp án với space (theo yêu cầu)
            const answerEl = document.getElementById(`answer-${foundIndex}`);
            if (answerEl) answerEl.innerText = w.english; // dùng w.english để hiển thị có space
    
            // Đánh dấu đã hoàn thành
            this.completedWords.push(foundIndex);
    
            // Phát âm
            this.speak(w.english);
    
            // Xóa các chữ cái đã dùng khỏi grid (với animation)
            this.selectedLetters.forEach(item => {
                // sửa lỗi gõ sai transform
                item.btn.style.transform = 'scale(0) rotate(360deg)';
                item.btn.style.opacity = '0';
                setTimeout(() => item.btn.remove(), 400);
            });
    
            // Reset selection và UI
            this.selectedLetters = [];
            this.updateCurrentWord();
    
            // Reset timer quái tấn công
            this.resetMonsterAttackTimer();
    
            // Gọi callback tấn công nếu có
            if (typeof this.onCorrect === 'function') {
                const advance = this.completedWords.length === words.length;
                this.onCorrect(1, advance);
            }
            
    
            // Kiểm tra hoàn thành 5 từ
            if (this.completedWords.length === words.length) {
                if (window.GameEngine && window.GameEngine.monster && window.GameEngine.monster.hp > 0) {
                    // Boss còn sống → Load 5 từ mới
                    setTimeout(() => {
                        this.loadNewRound();
                    }, 500);
                } else {
                    // Boss chết rồi → Dừng
                    this.stopMonsterAttackTimer();
                    setTimeout(() => {
                        alert("🎉 Hoàn thành! Boss đã bị đánh bại!");
                    }, 300);
                }
            }
        } else {
            // ❌ SAI - Hiệu ứng rung rồi đẩy chữ về vị trí cũ
            const currentWordArea = document.getElementById('current-word');
            if (currentWordArea) {
                currentWordArea.classList.add('animate-shake');
                setTimeout(() => currentWordArea.classList.remove('animate-shake'), 500);
            }
    
            // Đợi 50ms rồi cho chữ nhảy xuống (clearWord sẽ đẩy về vị trí cũ)
            setTimeout(() => {
                this.clearWord();
            }, 50);
        }
    },

    startMonsterAttackTimer() {
        if (this.monsterAttackTimer) {
            clearInterval(this.monsterAttackTimer);
            this.monsterAttackTimer = null;
        }
        this.monsterAttackCountdown = 10;
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
        try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}

        if (this.monsterAttackTimer) {
            clearInterval(this.monsterAttackTimer);
            this.monsterAttackTimer = null;
        }
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.selectedLetters = [];
        this.completedWords = [];
        this.monsterAttackCountdown = 10; // ✅ Reset countdown
    }
};

export default QuestionType5;
window.QuestionType5 = QuestionType5;