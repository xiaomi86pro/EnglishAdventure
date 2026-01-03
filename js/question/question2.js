// js/question/question2.js
// Question Type 2 – Fill in the missing letter
window.QuestionType2 = {
    autoReload: true,
    currentData: null,
    onCorrect: null,
    onWrong: null,
    hintUsed: false,

    // Hàm đọc từ (Sử dụng logic ưu tiên Internet/Offline đã thống nhất)
    speakWord(text, lang = "en-US") {
        if (!text) return;
        const cleanText = text.split('(')[0].trim();
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang.split('-')[0]}&client=tw-ob`;
        const audio = new Audio(googleUrl);
        audio.play().catch(() => {
            if (window.speechSynthesis) {
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(cleanText);
                u.lang = lang;
                speechSynthesis.speak(u);
            }
        });
    },

    async load(enemyType = "elite") {
        try {
            this.hintUsed = false;
            if (!window.supabase) return;

            // 1. Truy vấn lấy cả tiếng Anh và tiếng Việt
            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation");

            if (error) throw error;

            // 2. Lọc từ có độ dài >= 5 (cho Elite) hoặc ngẫu nhiên
            const validWords = data.filter(item => item.english_word && item.english_word.length >= 5);

            if (validWords.length === 0) return;

            // 3. Chọn từ ngẫu nhiên
            const selected = validWords[Math.floor(Math.random() * validWords.length)];
            const word = selected.english_word;
            const vietnamese = selected.vietnamese_translation;
            
            // Chọn vị trí ẩn ngẫu nhiên (tránh ẩn dấu cách)
            let missingIndex;
            do {
                missingIndex = Math.floor(Math.random() * word.length);
            } while (word[missingIndex] === " ");

            const displayWord = word.split("").map((ch, i) => (i === missingIndex ? "_" : ch)).join("");

            this.currentData = { word, missingIndex, displayWord, vietnamese };
            this.renderQuestionUI();

        } catch (err) {
            console.error("Lỗi khi load QuestionType2:", err);
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        area.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-between relative animate-fade-in">
                
                <!-- Hiển thị loại câu hỏi -->
                <div class="absolute top-0 left-0 bg-purple-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow">
                    Question Type 2
                </div>

                <button id="hint-btn" class="absolute top-0 right-0 w-12 h-12 flex items-center justify-center bg-white border-2 border-yellow-400 text-2xl rounded-2xl shadow-sm hover:bg-yellow-50 transition-all transform active:scale-90">
                    💡
                </button>

                <div id="preview-area" class="opacity-0 h-24 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none">
                    <h2 class="text-4xl font-black text-blue-400 uppercase tracking-widest">${this.currentData.word}</h2>
                    <h3 class="text-2xl font-bold text-green-400 italic">${this.currentData.vietnamese}</h3>
                </div>


                <div class="text-center bg-white/50 p-4 rounded-2xl border-2 border-dashed border-blue-200 w-full max-w-md">
                    <p class="text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Nghĩa tiếng Việt</p>
                    <h2 class="text-3xl font-black text-green-600 uppercase">${this.currentData.vietnamese}</h2>
                </div>

                <div id="hint-word" 
                class="h-20 flex items-center justify-center text-5xl font-extrabold text-blue-600 opacity-0 transition-opacity duration-500">
                </div>
           
                <div class="flex flex-col items-center gap-6 mb-8">
                    <p class="text-6xl font-mono tracking-[0.3em] text-blue-900 font-black uppercase">
                        ${this.currentData.displayWord.split('').map(ch => 
                            ch === "_" ? `<span class="text-red-500 border-b-4 border-red-500 animate-pulse">_</span>` : ch
                        ).join('')}
                    </p>
                    
                    <input id="answer-input" type="text" maxlength="1" 
                        class="w-24 h-24 text-5xl font-black text-center uppercase border-4 border-blue-400 rounded-3xl shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all"
                        placeholder="?" autofocus />
                </div>

                <button onclick="QuestionType2.checkAnswer()" 
                    class="px-16 py-4 bg-green-500 hover:bg-green-600 text-white rounded-3xl shadow-[0_8px_0_#166534] transition-all transform active:translate-y-1 active:shadow-none font-black text-2xl flex items-center gap-3">
                    CHECK ✅
                </button>
            </div>
        `;

        // Gắn sự kiện Hint
        const hintBtn = document.getElementById("hint-btn");
        if (hintBtn) hintBtn.onclick = () => this.useHint(hintBtn);

        // Enter để trả lời
        const input = document.getElementById("answer-input");
        if (input) {
            input.addEventListener("keypress", (e) => { if (e.key === "Enter") this.checkAnswer(); });
        }
    },

    useHint(btn) {
        if (this.hintUsed || !this.currentData) return;
        this.hintUsed = true;
    
        // Trừ máu Hero
        if (window.GameEngine && window.GameEngine.player) {
            window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - 5);
            window.GameEngine.updateAllUI();
            if (typeof window.GameEngine.showDamage === 'function') {
                window.GameEngine.showDamage(window.GameEngine.player, 5);
            }
        }
    
        // Hiển thị từ tiếng Anh trong vùng hint
        const hintDiv = document.getElementById("hint-word");
        if (hintDiv) {
            hintDiv.innerText = this.currentData.word;
            hintDiv.classList.remove("opacity-0");
            hintDiv.classList.add("opacity-100");
    
            // Sau 1.5s thì mờ đi
            setTimeout(() => {
                hintDiv.classList.remove("opacity-100");
                hintDiv.classList.add("opacity-0");
            }, 1500);
        }
    
        // Disable nút hint
        btn.classList.add("opacity-50", "cursor-not-allowed");
        btn.disabled = true;
    },

    checkAnswer() {
        const input = document.getElementById("answer-input");
        if (!input || !this.currentData) return;

        const answer = input.value.toLowerCase().trim();
        const correctChar = this.currentData.word[this.currentData.missingIndex].toLowerCase();

        if (answer === correctChar) {
            // Hiệu ứng đúng
            input.classList.remove("border-blue-400");
            input.classList.add("border-green-500", "bg-green-50");
            
            this.speakWord(this.currentData.word, "en-US");
            this.speakWord(this.currentData.vietnamese, "vi-VN");

            if (this.onCorrect) setTimeout(() => this.onCorrect(), 800);
        } else {
            // Hiệu ứng sai
            input.classList.add("animate-shake", "border-red-500", "text-red-500");
            setTimeout(() => {
                input.classList.remove("animate-shake", "border-red-500", "text-red-500");
                input.value = "";
            }, 500);
            
            if (this.onWrong) this.onWrong();
        }
    }
};

window.QuestionType2 = QuestionType2;
export default QuestionType2;