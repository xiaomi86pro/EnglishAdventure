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
            spellingRate: 0.7
        }, opts.config || {});
    }

    /**
     * Khởi tạo câu hỏi
     */
    init(enemyType = "normal") {
        this._destroyed = false;
        this.enCompleted = "";
        this._lastAnswered = null;

        this._selectWord(enemyType);

        if (this.currentData) {
            this.renderQuestionUI();
            // Bắt đầu phát âm từ và đánh vần
            this._startAudioSequence();
        }
    }

    _selectWord(enemyType) {
        if (!this.vocabPool.length) return;

        // Lọc từ: Quái thường từ 3-5 ký tự, Elite/Boss từ 6 ký tự trở lên
        let valid = this.vocabPool.filter(v => v.english_word && v.vietnamese_translation);
        
        if (enemyType === "normal") {
            valid = valid.filter(v => v.english_word.trim().length <= 5);
        } else {
            valid = valid.filter(v => v.english_word.trim().length > 5);
        }

        if (valid.length === 0) valid = this.vocabPool;
        this.currentData = valid[Math.floor(Math.random() * valid.length)];
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
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    }

    async speakLetters(word) {
        const letters = word.replace(/\s+/g, "").split("");
        for (let char of letters) {
            if (this._destroyed) break;
            await new Promise(resolve => {
                const u = new SpeechSynthesisUtterance(char);
                u.lang = "en-US";
                u.rate = this._config.spellingRate;
                u.onend = resolve;
                u.onerror = resolve; // Đảm bảo không bị kẹt nếu lỗi
                speechSynthesis.speak(u);
            });
        }
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
            slot.className = "w-14 h-14 border-2 border-dashed border-blue-400/50 bg-slate-800/50 rounded-xl flex items-center justify-center text-3xl font-black text-white";
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
            // Cập nhật dữ liệu cho Manager
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