import GameConfig from '../core/GameConfig.js';
import HintUtil from '../utils/HintUtil.js';
// js/question/question2.js
// Question Type 2 – Fill in the missing letter (Dạng Class)

class Question2 {
    constructor(opts = {}) {
        this.vocabPool = opts.vocabPool || [];
        this.containerId = opts.containerId || 'questionarea';
        this.onCorrect = opts.onCorrect || null;
        this.onWrong = opts.onWrong || null;
        this._answered = false;
        this.currentData = null;
        this.hintUsed = false;
        this._destroyed = false;
        this._lastAnswered = null; // Dùng cho history của Manager
        
        this._config = Object.assign({
            speakOnCorrect: true,
            damageOnHint: 5
        }, opts.config || {});
    }

    /**
     * Khởi tạo câu hỏi (Thay thế hàm load cũ)
     */
    init(enemyType = "normal") {
        this._destroyed = false;
        this.hintUsed = false;
        this._lastAnswered = null;

        this._selectWord(enemyType);
        
        if (this.currentData) {
            this.renderQuestionUI();
            // Đọc từ vựng sau khi UI sẵn sàng
            setTimeout(() => {
                if (!this._destroyed) this.speakWord(this.currentData.word, "en-US");
            }, 400);
        }
    }

    /**
     * Lọc và chọn từ từ Pool
     */
    _selectWord(enemyType) {
        if (!this.vocabPool.length) return;

        // Lọc từ có độ dài phù hợp (Elite/Boss ưu tiên từ dài)
        let valid = this.vocabPool.filter(v => v.english_word && v.english_word.trim().length >= 4);
        
        if (enemyType !== "normal") {
            valid = valid.filter(v => v.english_word.trim().length >= 6);
        }

        if (valid.length === 0) valid = this.vocabPool;
        
        const selected = valid[Math.floor(Math.random() * valid.length)];
        const word = selected.english_word.trim();
        const vietnamese = selected.vietnamese_translation;

        // Chọn vị trí ẩn ngẫu nhiên (không ẩn khoảng trắng)
        let missingIndex;
        do {
            missingIndex = Math.floor(Math.random() * word.length);
        } while (word[missingIndex] === " ");

        const displayWord = word.split("").map((ch, i) => (i === missingIndex ? "_" : ch)).join("");
        
        this.currentData = { word, missingIndex, displayWord, vietnamese };
    }

    speakWord(text, lang = "en-US") {
        if (!text || !window.speechSynthesis || this._destroyed) return;
        speechSynthesis.cancel();
        
        const u = new SpeechSynthesisUtterance(text.split('(')[0].trim());
        u.lang = lang;
        u.rate = 0.9;
        
        const voices = speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.includes(lang.split('-')[0]));
        if (targetVoice) u.voice = targetVoice;
        
        speechSynthesis.speak(u);
    }

    renderQuestionUI() {
        const area = document.getElementById(this.containerId);
        if (!area || !this.currentData) return;

        area.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-between relative animate-fade-in p-4 bg-white/10 rounded-3xl">
                <div class="absolute top-0 left-0 bg-purple-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow">
                    Question Type 2 : Fill the blank
                </div>

                ${HintUtil.getButtonHTML("w-12 h-12 text-2xl rounded-2xl shadow-sm transition-all transform active:scale-90")}

                <div class="text-center bg-white/90 p-5 rounded-2xl border-2 border-dashed border-blue-200 w-full max-w-md mt-8">
                    <p class="text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Nghĩa tiếng Việt</p>
                    <h2 class="text-3xl font-black text-green-600 uppercase">${this.currentData.vietnamese}</h2>
                </div>
                <div id="hint-word-display" class="h-20 flex items-center justify-center text-6xl font-extrabold text-blue-500 opacity-100 transition-opacity duration-[2000ms]">
                    ${this.currentData.word}
                </div>
           
                <div class="flex flex-col items-center gap-6 mb-8 w-full">
                    <p class="text-5xl md:text-6xl font-mono tracking-[0.2em] text-blue-900 font-black uppercase">
                        ${this.currentData.displayWord.split('').map(ch => 
                            ch === "_" ? `<span class="text-red-500 border-b-4 border-red-500 animate-pulse">_</span>` : ch
                        ).join('')}
                    </p>
                    
                    <input id="answer-input" type="text" maxlength="1" 
                        class="w-24 h-24 text-5xl font-black text-center uppercase border-4 border-blue-400 rounded-3xl shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all bg-white"
                        placeholder="?" autofocus />
                </div>

                <button id="check-btn" class="px-16 py-4 bg-green-500 hover:bg-green-600 text-white rounded-3xl shadow-[0_8px_0_#166534] transition-all transform active:translate-y-1 active:shadow-none font-black text-2xl flex items-center gap-3 mb-4">
                    CHECK ✅
                </button>
            </div>
        `;
        
        this._answered = false;
        this.hintUsed = false;

        // Gắn sự kiện
        const input = document.getElementById("answer-input");
        const checkBtn = document.getElementById("check-btn");
        const hintBtn = document.getElementById(GameConfig.HINT.buttonId);

        if (input) {
            input.disabled = false;
            input.value = "";
            input.classList.remove("bg-green-100", "border-green-500", "text-green-600", "animate-shake", "border-red-500", "text-red-500");
            input.focus();
          }
          if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.classList.remove("btn-disabled");
          }
          if (hintBtn) {
            hintBtn.disabled = false;
            hintBtn.classList.remove("btn-disabled");
          }
                                         
          if (input) {
            input.disabled = false;
            input.value = "";
            input.focus();
        
            // Dùng keydown thay vì onkeypress; chặn repeat để tránh spam
            input.addEventListener('keydown', (e) => {
                // chỉ xử lý Enter, bỏ qua auto-repeat
                if ((e.key === 'Enter' || e.code === 'Enter') && !e.repeat) {
                    e.preventDefault(); // ngăn form submit mặc định nếu có
                    this.checkAnswer();
                }
            });
        }
        
        if (checkBtn) checkBtn.onclick = () => this.checkAnswer();
        HintUtil.bindHintButton(() => this.useHint(hintBtn));        setTimeout(() => {
            const hintDiv = document.getElementById("hint-word-display");
            if (hintDiv && !this._destroyed) {
                hintDiv.classList.replace("opacity-100", "opacity-0");
            }
        }, 500);
    }

    useHint(btn) {
        if (this.hintUsed || !this.currentData) return;
        this.hintUsed = true;

        // Hiển thị từ tiếng Anh
        const hintDiv = document.getElementById("hint-word-display");
        if (hintDiv) {
            hintDiv.classList.remove("opacity-0");
            hintDiv.classList.add("opacity-100");
            setTimeout(() => {
                if (!this._destroyed && hintDiv) {
                    hintDiv.classList.replace("opacity-100", "opacity-0");
                }
            }, 2000);
        }

        
        HintUtil.useHint({
            damage: this._config.damageOnHint,
            onShowHint: null
        });        
        
        if (btn) btn.classList.add("opacity-50", "cursor-not-allowed");
    }

    checkAnswer() {
        if (this._answered) return;

        const input = document.getElementById("answer-input");
        const checkBtn = document.getElementById("check-btn");
        if (!input || !this.currentData) return;

        const userChar = input.value.trim().toLowerCase();
        const correctChar = this.currentData.word[this.currentData.missingIndex].toLowerCase();

        if (userChar === correctChar) {
            // Mark answered to prevent duplicates
            this._answered = true;

            // Disable input and button permanently for this question
            input.disabled = true;
            if (checkBtn) {
                checkBtn.disabled = true;
                checkBtn.classList.add("btn-disabled");
            }

            // Đúng: Hiệu ứng xanh và nộp bài
            input.classList.add("bg-green-100", "border-green-500", "text-green-600");
            
            this._lastAnswered = { 
                en: this.currentData.word, 
                vi: this.currentData.vietnamese 
            };

            setTimeout(() => {
                if (this._destroyed) return;
                if (this._config.speakOnCorrect) this.speakWord(this.currentData.word);
                if (typeof this.onCorrect === "function") this.onCorrect(1, true);
            }, 600);
        } else {
            // Wrong answer: short lock to prevent spam, then re-enable for retry
            input.classList.add("animate-shake", "border-red-500", "text-red-500");

            // Temporarily disable to avoid immediate re-submit
            input.disabled = true;
            if (checkBtn) checkBtn.disabled = true;

            // Sai: Hiệu ứng rung và xóa input
            setTimeout(() => {
                if (!this._destroyed && input) {
                    input.classList.remove("animate-shake", "border-red-500", "text-red-500");
                    input.value = "";
                    input.disabled = false;
                    if (checkBtn) checkBtn.disabled = false;
                    input.focus();
                }
            }, 300);

            if (typeof this.onWrong === "function") this.onWrong();
        }
    }

    destroy() {
        this._destroyed = true;
        if (window.speechSynthesis) speechSynthesis.cancel();
        const area = document.getElementById(this.containerId);
        if (area) area.innerHTML = "";
        
        this.currentData = null;
        this._lastAnswered = null;
    }
}

export default Question2;