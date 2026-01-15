// js/question/question3.js
// Question Type 3 – Listen and Spell (Dạng Class)

class Question3 {
    constructor(opts = {}) {
        this.vocabPool = opts.vocabPool || [];
        this.containerId = opts.containerId || 'questionarea';
        this.onCorrect = opts.onCorrect || null;
        this.onWrong = opts.onWrong || null;

        this.currentData = null;
        this.enCompleted = "";
        this._destroyed = false;
        this._lastAnswered = null;

        this._config = Object.assign({
            speakOnCorrect: true,
            spellingRate: 0.8 // Tăng nhẹ tốc độ đánh vần cho mượt
        }, opts.config || {});
    }

    
    /** Khởi tạo câu hỏi (Đã nâng cấp an toàn) **/
    init(enemyType = "normal") {
        this._destroyed = false;
        this.enCompleted = "";
        this._lastAnswered = null;

        // --- SỬA LỖI ---
        // 1. Luôn nạp mới Vocab Cache để đảm bảo không bị rỗng do khởi tạo quá sớm
        if (!this.vocabPool || this.vocabPool.length === 0) {
            this.vocabPool = window.VOCAB_CACHE || [];
        }

        // 2. Nếu Cache vẫn rỗng (mạng lag chưa tải xong), hiển thị thông báo đợi
        if (this.vocabPool.length === 0) {
            console.warn("Vocab pool empty, retrying...");
            const area = document.getElementById(this.containerId);
            if (area) area.innerHTML = '<div class="text-white animate-pulse">Đang tải dữ liệu...</div>';
            // Thử lại sau 500ms
            setTimeout(() => this.init(enemyType), 500);
            return;
        }

        // 3. Chọn từ
        this._selectWord(enemyType);

        // 4. Render
        if (this.currentData) {
            this.renderQuestionUI();
            this._startAudioSequence();
        } else {
            // Trường hợp cực hy hữu: Có vocab nhưng không lọc được từ nào
            console.error("Không tìm thấy từ phù hợp, force reset về normal");
            this.init('normal'); 
        }
    }

    _selectWord(enemyType) {
        // Lọc từ: Quái thường từ 3-5 ký tự, Elite/Boss từ 6 ký tự trở lên
        let valid = [];
        
        if (enemyType === 'boss' || enemyType === 'elite') {
            valid = this.vocabPool.filter(i => i.english_word && i.english_word.length >= 6);
            
            // --- FALLBACK (QUAN TRỌNG) ---
            // Nếu không tìm được từ khó (do kho từ ít), tự động lấy từ bất kỳ để game không bị lỗi
            if (valid.length === 0) {
                console.warn("Không tìm thấy từ Boss, chuyển sang từ thường");
                valid = this.vocabPool.filter(i => i.english_word && i.english_word.length >= 3);
            }
        } else {
            valid = this.vocabPool.filter(i => i.english_word && i.english_word.length >= 3 && i.english_word.length <= 6);
            // Fallback nếu không có từ ngắn
            if (valid.length === 0) {
                valid = this.vocabPool.filter(i => i.english_word);
            }
        }

        if (valid.length > 0) {
            const item = valid[Math.floor(Math.random() * valid.length)];
            this.currentData = { ...item };
        } else {
            this.currentData = null;
        }
    }

    async _startAudioSequence() {
        if (!this.currentData || this._destroyed) return;
        
        // 1. Phát âm cả từ trước
        this.speak(this.currentData.english_word);
        
        // 2. Nghỉ một chút rồi đánh vần từng chữ
        await new Promise(r => setTimeout(r, 1200));
        
        if (!this._destroyed) {
            await this.speakLetters(this.currentData.english_word);
        }
    }

    speak(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis || this._destroyed) return;
        speechSynthesis.cancel(); // Dừng các âm thanh cũ
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    }

    async speakLetters(word) {
        // Làm sạch từ và tách thành mảng ký tự
        const letters = word.replace(/\s+/g, "").split("");

        // Dùng vòng lặp index để biết đang đọc chữ thứ mấy
        for (let i = 0; i < letters.length; i++) {
            if (this._destroyed) break;
            
            const char = letters[i];

            // --- BƯỚC 1: Bật sáng (Highlight) ---
            this._highlightChar(i, char);

            await new Promise(resolve => {
                const u = new SpeechSynthesisUtterance(char);
                u.lang = "en-US";
                u.rate = this._config.spellingRate;
                
                // Khi đọc xong chữ này
                u.onend = () => {
                    // --- BƯỚC 2: Tắt sáng ---
                    this._removeHighlight();
                    // Nghỉ cực ngắn giữa các chữ để hiệu ứng nháy rõ hơn
                    setTimeout(resolve, 100); 
                };
                
                u.onerror = () => {
                    this._removeHighlight();
                    resolve();
                };
                
                speechSynthesis.speak(u);
            });
        }
    }

    // Hàm xử lý việc làm sáng ô chữ hoặc nút bấm
    _highlightChar(index, char) {
        const slotsContainer = document.getElementById("en-slots");
        const lettersContainer = document.getElementById("en-letters");
        if (!slotsContainer || !lettersContainer) return;

        const slots = slotsContainer.querySelectorAll("div");
        
        // Kiểm tra xem vị trí index này trên slot đã được điền chưa
        // (Logic: slots[index] tương ứng với ký tự thứ i của từ gốc)
        if (slots[index] && slots[index].innerText.trim() !== "") {
            // CASE 1: Chữ đã được đưa lên Slot -> Sáng slot đó
            slots[index].classList.add("ring-4", "ring-yellow-400", "scale-110", "bg-yellow-900/50", "transition-all", "duration-200");
        } else {
            // CASE 2: Chữ chưa được đưa lên -> Tìm nút bấm (Button) tương ứng để sáng
            const buttons = lettersContainer.querySelectorAll("button");
            // Tìm tất cả các nút có chữ cái khớp và chưa bị ẩn
            for (let btn of buttons) {
                if (btn.innerText.toLowerCase() === char.toLowerCase() && btn.style.visibility !== "hidden") {
                    btn.classList.add("ring-4", "ring-yellow-400", "bg-yellow-100", "scale-110", "transition-all", "duration-200");
                    // Chỉ cần sáng các nút phù hợp (có thể sáng nhiều nút nếu có 2 chữ giống nhau chưa chọn)
                }
            }
        }
    }

    // Hàm tắt toàn bộ hiệu ứng sáng
    _removeHighlight() {
        const slotsContainer = document.getElementById("en-slots");
        const lettersContainer = document.getElementById("en-letters");
        if (!slotsContainer || !lettersContainer) return;

        // Xóa highlight ở Slot
        const slots = slotsContainer.querySelectorAll("div");
        slots.forEach(slot => {
            slot.classList.remove("ring-4", "ring-yellow-400", "scale-110", "bg-yellow-900/50");
        });

        // Xóa highlight ở Button
        const buttons = lettersContainer.querySelectorAll("button");
        buttons.forEach(btn => {
            btn.classList.remove("ring-4", "ring-yellow-400", "bg-yellow-100", "scale-110");
        });
    }

    renderQuestionUI() {
        const area = document.getElementById(this.containerId);
        if (!area || !this.currentData) return;

        area.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl relative overflow-hidden">
                <div class="absolute top-0 left-0 bg-blue-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold uppercase tracking-wider shadow-lg">
                    Question Type 3: Spelling
                </div>

                <button id="replay-btn" class="mb-8 w-20 h-20 bg-blue-500 hover:bg-blue-400 text-white rounded-full shadow-[0_6px_0_#1e40af] transition-all transform active:translate-y-1 active:shadow-none flex items-center justify-center text-4xl">
                    🔊
                </button>

                <div class="mb-10 text-center">
                    <p class="text-blue-300 text-sm font-bold uppercase tracking-widest opacity-50 mb-2">Vietnamese Meaning</p>
                    <h2 class="text-3xl font-black text-white drop-shadow-md">${this.currentData.vietnamese_translation}</h2>
                </div>

                <div id="en-slots" class="flex flex-wrap justify-center gap-3 mb-12 min-h-[64px] w-full"></div>

                <div id="en-letters" class="flex flex-wrap justify-center gap-4 w-full"></div>
            </div>
        `;
        const replayBtn = document.getElementById("replay-btn");
        if (replayBtn) replayBtn.onclick = () => this._startAudioSequence();

        this.animateLetters(this.currentData.english_word);
    }

    animateLetters(word) {
        const lettersContainer = document.getElementById("en-letters");
        const slotsContainer = document.getElementById("en-slots");
        if (!lettersContainer || !slotsContainer) return;

        const cleanWord = word.replace(/\s+/g, "");
        const chars = cleanWord.split("");
        
        // Tạo các ô trống tương ứng với số chữ cái
        chars.forEach(() => {
            const slot = document.createElement("div");
            // Thêm transition để hiệu ứng sáng mượt hơn
            slot.className = "w-14 h-14 border-2 border-dashed border-blue-400/50 bg-slate-800/50 rounded-xl flex items-center justify-center text-3xl font-black text-white transition-all duration-200";
            slotsContainer.appendChild(slot);
        });

        // Xáo trộn chữ cái
        const shuffled = chars.map((c, i) => ({ c, i })).sort(() => Math.random() - 0.5);
        shuffled.forEach((item, index) => {
            const btn = document.createElement("button");
            btn.className = "w-14 h-14 bg-white border-2 border-blue-200 rounded-2xl shadow-[4px_4px_0px_#3b82f6] text-2xl font-black text-blue-900 hover:bg-blue-50 transition-all transform active:scale-95";
            btn.innerText = item.c.toUpperCase();

            btn.onclick = () => {
                const targetChar = cleanWord[this.enCompleted.length].toLowerCase();
                
                if (item.c.toLowerCase() === targetChar) {
                    // Đúng chữ cái tiếp theo
                    this.enCompleted += item.c;
                    
                    // Điền vào slot tương ứng
                    const slots = slotsContainer.querySelectorAll("div");
                    const currentSlot = slots[this.enCompleted.length - 1];
                    if (currentSlot) {
                        currentSlot.innerText = item.c.toUpperCase();
                        currentSlot.classList.add("text-green-400");
                        currentSlot.style.borderBottomColor = "#4ade80";
                    }

                    btn.style.visibility = "hidden";
                    btn.style.pointerEvents = "none";

                    this.checkWin();
                } else {
                    // Sai chữ cái
                    btn.classList.add("bg-red-500", "text-white", "shake");
                    setTimeout(() => btn.classList.remove("bg-red-500", "text-white", "shake"), 500);
                    if (typeof this.onWrong === "function") this.onWrong();
                }
            };

            lettersContainer.appendChild(btn);
        });
    }

    checkWin() {
        const goal = this.currentData.english_word.replace(/\s+/g, "").toLowerCase();
        if (this.enCompleted.toLowerCase() === goal) {
            this._lastAnswered = {
                en: this.currentData.english_word,
                vi: this.currentData.vietnamese_translation
            };
            setTimeout(() => {
                if (this._destroyed) return;
                if (this._config.speakOnCorrect) this.speak(this.currentData.english_word);
                if (typeof this.onCorrect === "function") this.onCorrect(1, true);
            }, 600);
        }
    }

    destroy() {
        this._destroyed = true;
        if (window.speechSynthesis) speechSynthesis.cancel();
        const area = document.getElementById(this.containerId);
        if (area) area.innerHTML = "";
        
        this.currentData = null;
        this.enCompleted = "";
        this._lastAnswered = null;
    }
}

export default Question3;