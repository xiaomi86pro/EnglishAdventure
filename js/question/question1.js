// js/question/question1.js
// Question Type 1 – Word Order (English + Vietnamese)
if (window.speechSynthesis) {
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
}

const QuestionType1 = {
    autoReload: true,
    currentData: null,
    enCompleted: "",
    viCompleted: "",
    onCorrect: null,
    onWrong: null,

    

    speakWord(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis || !text) return;
    
        // Dừng các âm thanh đang phát để không bị chồng chéo
        speechSynthesis.cancel(); 
    
        const cleanText = text.split('(')[0].trim();
        const u = new SpeechSynthesisUtterance(cleanText);
        
        u.lang = lang;
        u.rate = rate;
        u.pitch = 1.0;
    
        // Ưu tiên chọn giọng đọc tiếng Anh chất lượng có sẵn trong hệ thống
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes(lang.split('-')[0]) && v.localService);
        if (preferredVoice) u.voice = preferredVoice;
    
        speechSynthesis.speak(u); 
    },

    async load(enemyType = "normal") {
        try {
            if (!window.supabase) {
                setTimeout(() => this.load(enemyType), 300);
                return;
            }

            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation");

            if (error) throw error;
            if (!data || data.length === 0) throw new Error("Vocabulary trống");

            let valid = data.filter(v => v?.english_word && v?.vietnamese_translation);

            if (enemyType === "normal") {
                valid = valid.filter(v => v.english_word.trim().length <= 5);
            } else {
                valid = valid.filter(v => v.english_word.trim().length > 5);
            }

            if (valid.length === 0) valid = data;

            this.currentData = valid[Math.floor(Math.random() * valid.length)];
            this.enCompleted = "";
            this.viCompleted = "";
            this.hintUsed = false;

            this.renderQuestionUI();
            this.speakWord(this.currentData.english_word);

        } catch (err) {
            console.error("QuestionType1:", err);
        }
    },

    useHint(btn) {
        if (this.hintUsed || !this.currentData) return;
        this.hintUsed = true;
    
        // 1. Hiện lại từ vựng
        const preview = document.getElementById("preview-area");
        if (preview) {
            preview.innerHTML = `
                <h2 class="text-4xl font-black text-blue-400 uppercase tracking-widest">${this.currentData.english_word}</h2>
                <h3 class="text-2xl font-bold text-green-400 italic">${this.currentData.vietnamese_translation}</h3>
            `;
            preview.style.opacity = "1";
            preview.style.height = "auto";
        }
    
        // 2. Trừ 5 HP Hero (dùng hp_current) & Cập nhật UI
        if (window.GameEngine && window.GameEngine.player) {
            window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - 5);
            window.GameEngine.updateAllUI();
    
            // Hiệu ứng damage lên Hero (nếu cần)
            if (typeof window.GameEngine.showDamage === 'function') {
                window.GameEngine.showDamage(window.GameEngine.player, 5);
            }
        }
    
        // 3. Làm mờ nút Hint
        if (btn) {
            btn.classList.add("opacity-50", "cursor-not-allowed");
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const wordEn = String(this.currentData.english_word || "").trim();
        const wordVi = String(this.currentData.vietnamese_translation || "").trim();

        // Thêm style động nếu chưa có
        if (!document.getElementById("qt1-styles")) {
            const style = document.createElement("style");
            style.id = "qt1-styles";
            style.innerHTML = `
                @keyframes fallIn {
                    0% { transform: translateY(-100px); opacity: 0; }
                    60% { transform: translateY(10px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .letter-fall { animation: fallIn 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
                .space-box { width: 24px; }
            `;
            document.head.appendChild(style);
        }

        area.innerHTML = `
            <div class="flex w-full h-full p-4 relative overflow-hidden bg-black rounded-3xl">
            <!-- Hiển thị loại câu hỏi -->
            <div class="absolute top-0 left-0 bg-purple-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow">
                Question Type 1
            </div>

            <button id="hint-btn" class="absolute top-3 right-3 p-2 rounded-full bg-yellow-300 hover:bg-yellow-400 shadow text-xl">💡</button>
                <div class="flex-1 flex flex-col justify-start gap-8 py-2 px-4 w-full">
                    <!-- Preview -->
                    <div id="preview-area" class="w-full flex flex-col items-center justify-center mb-6">
                    </div>

                    <!-- English -->
                    <div class="flex flex-col items-center w-full">
                    <div id="en-slots" 
                    class="flex flex-wrap justify-center items-center gap-2 mb-8 
                           h-16 w-full border-b-2 border-dashed border-gray-200 pb-2"></div>
                    <div id="en-letters" 
                    class="flex flex-wrap justify-center gap-3 min-h-[50px] w-full"></div>   
                    </div>

                    <!-- Vietnamese -->
                    <div class="flex flex-col items-center w-full">
                    <div id="vi-slots" class="flex flex-wrap justify-center items-center gap-2 mb-8 h-16 w-full border-b-2 border-dashed border-gray-200 pb-2"></div>
                    <div id="vi-letters" class="flex flex-wrap justify-center gap-3 min-h-[50px] w-full"></div>               
                    </div>
                </div>
            </div>
        `;

        // Sau khi render, đặt hẹn giờ 2 giây để ẩn preview
        // Gắn sự kiện cho nút Hint ngay sau khi tạo HTML
        const hintBtn = document.getElementById("hint-btn");
        if (hintBtn) {
            hintBtn.onclick = () => {
                this.useHint(hintBtn);
            };
        }

        const preview = document.getElementById("preview-area");

        if (preview) {
            preview.innerHTML = ` 
            <h2 class="text-4xl font-black text-blue-400 uppercase tracking-widest">${wordEn}</h2> 
            <h3 class="text-2xl font-bold text-green-400 italic">${wordVi}</h3> `;
            // Gắn dữ liệu gốc để manager đọc lại khi dùng Hint 
            preview.setAttribute("data-en", wordEn); 
            preview.setAttribute("data-vi", wordVi);    

            setTimeout(() => {
                preview.style.opacity = "0";              // mờ dần
                preview.style.transition = "opacity 0.5s ease-out";
                // giữ nguyên chiều cao bằng cách ẩn chữ nhưng không remove
                setTimeout(() => {
                    preview.innerHTML = "";               // xoá nội dung bên trong
                    preview.style.height = "60px";        // hoặc đặt chiều cao cố định
                }, 500);
            }, 2000);
        }

        this.animateLetters(wordEn, "en");
        this.animateLetters(wordVi, "vi");
    },

    animateLetters(word, lang) {
    const lettersContainer = document.getElementById(`${lang}-letters`);
    const slotsContainer = document.getElementById(`${lang}-slots`);
    if (!lettersContainer || !slotsContainer) return;

    lettersContainer.innerHTML = "";
    slotsContainer.innerHTML = "";

    let cleanLetters = word.split("").filter(c => c !== " ");
    
    // ✅ Nếu là tiếng Việt, tách từ cuối để trộn
    if (lang === "vi") {
        const words = word.trim().split(/\s+/); // Tách thành mảng các từ
        
        if (words.length > 1) {
            // Có từ 2 từ trở lên → Khóa các từ phía trước, chỉ trộn từ cuối
            const lockedPart = words.slice(0, -1).join(" "); // Tất cả từ trừ từ cuối
            const shufflePart = words[words.length - 1];     // Từ cuối cùng
            
            // Hiển thị phần khóa
            lockedPart.split("").forEach(char => {
                if (char === " ") {
                    // Khoảng trắng
                    const spaceBox = document.createElement("div");
                    spaceBox.className = "space-box h-12";
                    slotsContainer.appendChild(spaceBox);
                } else {
                    // Chữ cái khóa
                    const fixedLetter = document.createElement("div");
                    fixedLetter.className = `w-12 h-12 text-white rounded-xl border-2 border-white flex items-center justify-center text-2xl font-black bg-green-500`;
                    fixedLetter.innerText = char.toUpperCase();
                    slotsContainer.appendChild(fixedLetter);
                }
            });
            
            // Thêm khoảng trắng giữa phần khóa và phần trộn
            const spaceBox = document.createElement("div");
            spaceBox.className = "space-box h-12";
            slotsContainer.appendChild(spaceBox);
            
            // Chỉ trộn từ cuối cùng
            cleanLetters = shufflePart.split("").filter(c => c !== " ");
        }
        // Nếu chỉ có 1 từ → Trộn toàn bộ (giữ nguyên logic cũ)
    }

    const shuffled = cleanLetters.map((c, i) => ({ c, i }))
        .sort(() => Math.random() - 0.5);

    shuffled.forEach((item, index) => {
        const btn = document.createElement("div");
        btn.className = `w-12 h-12 bg-white border-2 border-gray-400 rounded-xl shadow-[4px_4px_0px_#ccc] flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-yellow-50 transform transition-all opacity-0 letter-fall`;
        btn.style.animationDelay = `${index * 0.1}s`;
        btn.innerText = item.c.toUpperCase();

        btn.onclick = () => {
            const currentStr = lang === "en" ? this.enCompleted : this.viCompleted;
        
            // ✅ Không cần kiểm tra thứ tự, chỉ cần ký tự có trong từ gốc
            const remainingChars = word.replace(/\s+/g, '').toLowerCase().split('');
            const usedChars = currentStr.toLowerCase().split('');
            
            // Đếm số lần ký tự này xuất hiện trong từ gốc
            const charCount = remainingChars.filter(c => c === item.c.toLowerCase()).length;
            // Đếm số lần đã dùng
            const usedCount = usedChars.filter(c => c === item.c.toLowerCase()).length;
            
            // Nếu còn có thể dùng ký tự này
            if (usedCount < charCount) {
                if (lang === "en") this.enCompleted += item.c;
                else this.viCompleted += item.c;
        
                const finalLetter = document.createElement("div");
                finalLetter.className = `w-12 h-12 text-white rounded-xl border-2 border-white flex items-center justify-center text-2xl font-black ${lang === "en" ? "bg-blue-500" : "bg-green-500"}`;
                finalLetter.innerText = item.c.toUpperCase();
                slotsContainer.appendChild(finalLetter);
        
                btn.style.visibility = "hidden";
                this.checkProgress();
            } else {
                // Ký tự này đã dùng hết hoặc không có trong từ
                btn.classList.add("bg-red-100", "border-red-400");
                setTimeout(() => btn.classList.remove("bg-red-100", "border-red-400"), 500);
                if (typeof this.onWrong === "function") this.onWrong();
            }
        };

        lettersContainer.appendChild(btn);
    });
},

    checkProgress() {
        if (!this.currentData) return;
        const wordEn = this.currentData.english_word;
        const wordVi = this.currentData.vietnamese_translation;

        const cleanEn = wordEn.replace(/\s+/g, "").toLowerCase();
        const cleanVi = wordVi.replace(/\s+/g, "").toLowerCase();

        if (this.enCompleted.toLowerCase() === cleanEn &&
            this.viCompleted.toLowerCase() === cleanVi) {
            this.speakWord(wordEn, "en-US");
            this.speakWord(wordVi, "vi-VN");
            if (typeof this.onCorrect === "function") this.onCorrect();
        }
    },

    destroy() {
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.enCompleted = "";
        this.viCompleted = "";
    },
};

window.QuestionType1 = QuestionType1;
export default QuestionType1;
