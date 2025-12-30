// js/question/question1.js
// Question Type 1 – Word Order
// KHỚP 100% layout #questionarea hiện tại

const QuestionType1 = {
    currentData: null,
    enCompleted: "",
    onCorrect: null,
    onWrong: null,

    speakWord(text, lang = "en-US") {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        speechSynthesis.speak(u);
    },

    async loadType1(enemyType = "normal") {
        try {
            if (!window.supabase) {
                setTimeout(() => this.loadType1(enemyType), 300);
                return;
            }

            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation");

            if (error) throw error;
            if (!data || data.length === 0) throw new Error("Vocabulary trống");

            let valid = data.filter(v => v?.english_word && v?.vietnamese_translation);

            if (enemyType === "normal") {
                valid = valid.filter(v => v.english_word.length <= 5);
            } else {
                valid = valid.filter(v => v.english_word.length > 5);
            }

            if (valid.length === 0) valid = data;

            this.currentData = valid[Math.floor(Math.random() * valid.length)];
            this.enCompleted = "";

            this.renderQuestionUI();
            this.speakWord(this.currentData.english_word);

        } catch (err) {
            console.error("QuestionType1:", err);
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const word = this.currentData.english_word.toUpperCase();
        const meaning = this.currentData.vietnamese_translation;

        // 🔴 QUAN TRỌNG: 1 ROOT WRAPPER DUY NHẤT
        area.innerHTML = `
            <div class="w-full h-full flex flex-col justify-between">

                <!-- Nghĩa -->
                <div class="text-center text-xl font-semibold text-gray-200">
                    ${meaning}
                </div>

                <!-- Answer -->
                <div id="answer"
                     class="text-center text-3xl font-bold tracking-widest min-h-[3rem]">
                </div>

                <!-- Letters -->
                <div id="letters"
                     class="flex flex-wrap justify-center gap-3">
                </div>

            </div>
        `;

        const lettersBox = area.querySelector("#letters");
        const shuffled = word.split("").sort(() => Math.random() - 0.5);

        shuffled.forEach(char => {
            const btn = document.createElement("button");
            btn.textContent = char;

            // ⚠️ KHÔNG STYLE – CHỈ DÙNG CLASS CŨ
            btn.className =
                "px-4 py-2 rounded-xl font-bold text-xl game-btn";

            btn.onclick = () => this.handleLetterClick(btn);
            lettersBox.appendChild(btn);
        });
    },

    handleLetterClick(btn) {
        if (btn.disabled) return;

        btn.disabled = true;
        btn.classList.add("opacity-40");

        this.enCompleted += btn.textContent;

        const answer = document.getElementById("answer");
        if (answer) answer.textContent = this.enCompleted;

        this.checkProgress();
    },

    checkProgress() {
        if (!this.currentData) return;

        const target = this.currentData.english_word.toUpperCase();

        if (this.enCompleted.length < target.length) return;

        if (this.enCompleted === target) {
            if (typeof this.onCorrect === "function") {
                this.onCorrect();
            }
        } else {
            if (typeof this.onWrong === "function") {
                this.onWrong();
            }
        }
    },

    destroy() {
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.enCompleted = "";
    }
};

window.QuestionType1 = QuestionType1;
