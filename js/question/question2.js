window.QuestionType2 = {
    currentData: null,
    onCorrect: null,
    onWrong: null,

    async load(enemyType = "elite") {
        try {
            // 1. Truy vấn Supabase lấy danh sách từ có độ dài >= 5
            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word")
                .neq("category", "ignore"); // nếu bạn muốn lọc thêm

            if (error) throw error;

            // 2. Lọc từ có độ dài >= 5
            const longWords = data
                .map(item => item.english_word)
                .filter(word => word.length >= 5);

            if (longWords.length === 0) {
                console.warn("Không có từ đủ dài trong bảng vocabulary");
                return;
            }

            // 3. Chọn từ ngẫu nhiên và ẩn 1 chữ cái
            const word = longWords[Math.floor(Math.random() * longWords.length)];
            const missingIndex = Math.floor(Math.random() * word.length);
            const displayWord = word
                .split("")
                .map((ch, i) => (i === missingIndex ? "_" : ch))
                .join("");

            this.currentData = { word, missingIndex, displayWord };
            this.renderQuestionUI();

        } catch (err) {
            console.error("Lỗi khi load từ Supabase:", err);
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        area.innerHTML = `
            <div class="flex flex-col gap-6 items-center">
                <h2 class="text-xl font-bold text-blue-600">Điền chữ cái còn thiếu</h2>
                <p class="text-2xl font-mono tracking-widest">${this.currentData.displayWord}</p>
                <input id="answer-input" 
                       class="border-2 border-blue-300 rounded-lg p-2 text-center w-16 text-xl" 
                       maxlength="1" />
                <button onclick="QuestionType2.checkAnswer()" 
                        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Trả lời
                </button>
            </div>
        `;
    },

    checkAnswer() {
        const input = document.getElementById("answer-input");
        if (!input || !this.currentData) return;

        const answer = input.value.toLowerCase();
        const correctChar = this.currentData.word[this.currentData.missingIndex].toLowerCase();

        if (answer === correctChar) {
            if (this.onCorrect) this.onCorrect();
        } else {
            if (this.onWrong) this.onWrong();
        }
    }
};