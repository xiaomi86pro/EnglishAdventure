// js/question/question3.js
// Question Type 3 – Nghe và sắp xếp chữ cái (Spelling)

const QuestionType3 = {
    currentData: null,
    enCompleted: "",
    onCorrect: null,
    onWrong: null,

    // Hàm phát âm chung
    speak(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    },

    // Phát âm từng chữ cái một cách tuần tự (để gợi ý đầu trận)
    async speakLetters(word) {
        const letters = word.split("").filter(c => c !== " ");
        for (let char of letters) {
            await new Promise(resolve => {
                const u = new SpeechSynthesisUtterance(char);
                u.lang = "en-US";
                u.rate = 0.7;
                u.onend = resolve;
                speechSynthesis.speak(u);
            });
        }
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

            let valid = data.filter(v => v?.english_word);

            // Phân loại độ khó theo loại quái
            if (enemyType === "normal") {
                valid = valid.filter(v => v.english_word.trim().length <= 5);
            } else {
                // Elite hoặc Boss lấy từ dài hơn 5 ký tự
                valid = valid.filter(v => v.english_word.trim().length > 5);
            }

            if (valid.length === 0) valid = data;

            this.currentData = valid[Math.floor(Math.random() * valid.length)];
            this.enCompleted = "";

            this.renderQuestionUI();
            
            // Bắt đầu logic âm thanh: Đọc cả từ -> Chờ 1.2s -> Đọc từng chữ cái
            this.speak(this.currentData.english_word);
            setTimeout(() => {
                this.speakLetters(this.currentData.english_word);
            }, 1200);

        } catch (err) {
            console.error("QuestionType3 Error:", err);
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const wordEn = String(this.currentData.english_word || "").trim();

        area.innerHTML = `
            <div class="flex flex-col w-full h-full p-6 bg-slate-800 rounded-3xl items-center justify-center gap-6 relative overflow-hidden">
                <button id="replay-btn" class="absolute top-4 right-4 p-3 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg text-2xl transition-all active:scale-90">🔊</button>
                
                <div class="text-white/50 text-sm uppercase tracking-widest mb-2 font-bold">Listen and Type</div>

                <div id="en-slots" class="flex flex-wrap justify-center items-center gap-3 min-h-[70px] w-full border-b-4 border-dashed border-slate-600 pb-4"></div>
                
                <div id="en-letters" class="flex flex-wrap justify-center gap-3 w-full mt-6"></div>
            </div>
        `;

        document.getElementById("replay-btn").onclick = () => this.speak(wordEn);

        this.setupGame(wordEn);
    },

    setupGame(word) {
        const lettersContainer = document.getElementById("en-letters");
        const slotsContainer = document.getElementById("en-slots");
        
        // Loại bỏ khoảng trắng để xử lý logic xếp chữ
        const cleanWord = word.replace(/\s+/g, "");
        const cleanLetters = cleanWord.split("");
        
        const shuffled = cleanLetters.map((c, i) => ({ c, i }))
            .sort(() => Math.random() - 0.5);

        shuffled.forEach((item) => {
            const btn = document.createElement("div");
            btn.className = `w-14 h-14 bg-white border-b-4 border-gray-300 rounded-2xl flex items-center justify-center text-2xl font-black cursor-pointer hover:bg-yellow-100 transition-all text-slate-800 shadow-md`;
            btn.innerText = item.c.toUpperCase();

            btn.onclick = () => {
                // Phát âm chữ cái khi người dùng bấm
                this.speak(item.c, "en-US", 1.2);

                const targetChar = cleanWord[this.enCompleted.length];

                if (item.c.toLowerCase() === targetChar.toLowerCase()) {
                    this.enCompleted += item.c;
                    
                    // Tạo hiệu ứng chữ bay lên ô kết quả
                    const slot = document.createElement("div");
                    slot.className = "w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center text-2xl font-black border-b-4 border-green-700 animate-bounce";
                    slot.innerText = item.c.toUpperCase();
                    slotsContainer.appendChild(slot);

                    btn.style.visibility = "hidden";
                    btn.style.pointerEvents = "none";
                    
                    this.checkWin();
                } else {
                    // Hiệu ứng khi bấm sai
                    btn.classList.add("bg-red-500", "text-white", "border-red-700", "shake");
                    setTimeout(() => {
                        btn.classList.remove("bg-red-500", "text-white", "border-red-700", "shake");
                    }, 500);
                    if (typeof this.onWrong === "function") this.onWrong();
                }
            };
            lettersContainer.appendChild(btn);
        });
    },

    checkWin() {
        const goal = this.currentData.english_word.replace(/\s+/g, "").toLowerCase();
        if (this.enCompleted.toLowerCase() === goal) {
            setTimeout(() => {
                this.speak(this.currentData.english_word);
                if (typeof this.onCorrect === "function") this.onCorrect();
            }, 600);
        }
    },

    destroy() {
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.enCompleted = "";
    }
};

window.QuestionType3 = QuestionType3;
export default QuestionType3;