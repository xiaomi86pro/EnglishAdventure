/**
 * QuestionManager - Quản lý việc tải và hiển thị các loại câu hỏi
 */
const QuestionManager = {
    currentData: null,
    enCompleted: "",
    viCompleted: "",
    
    /**
     * Hàm phát âm từ vựng sử dụng Web Speech API
     */
    speakWord(text, lang = 'en-US') {
        if (!window.speechSynthesis) return;
        
        // Hủy các yêu cầu phát âm đang chờ để tránh chồng chéo
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9; // Tốc độ hơi chậm một chút cho bé dễ nghe
        utterance.pitch = 1.1; // Giọng cao hơn một chút cho sinh động
        
        window.speechSynthesis.speak(utterance);
    },

    /**
     * Tải câu hỏi loại 1: Sắp xếp chữ cái Anh - Việt
     * @param {string} enemyType - Loại kẻ địch ('normal', 'elite', 'boss')
     */
    async loadType1(enemyType = 'normal') {
        try {
            if (!window.supabase) {
                console.warn("QuestionManager: Đang đợi Supabase...");
                setTimeout(() => this.loadType1(enemyType), 500);
                return;
            }

            const supabase = window.supabase;
            
            const { data, error } = await supabase
                .from('vocabulary')
                .select('english_word, vietnamese_translation');

            if (error) {
                console.error("Supabase Error:", error);
                throw new Error(`Lỗi truy vấn: ${error.message}`);
            }
            
            if (!data || data.length === 0) {
                throw new Error("Bảng vocabulary đang trống hoặc không có quyền truy cập");
            }
            
            // 1. Lọc các từ hợp lệ (không rỗng)
            let validData = data.filter(item => item && item.english_word && item.vietnamese_translation);
            
            // 2. Lọc theo độ khó dựa trên enemyType
            // Quái thường: <= 5 chữ cái. Elite/Boss: > 5 chữ cái.
            if (enemyType === 'normal') {
                validData = validData.filter(item => item.english_word.trim().length <= 5);
            } else {
                validData = validData.filter(item => item.english_word.trim().length > 5);
            }

            // Trường hợp dự phòng nếu bộ lọc quá gắt không còn từ nào
            if (validData.length === 0) {
                console.warn(`Không tìm thấy từ phù hợp cho loại ${enemyType}, lấy từ danh sách gốc.`);
                validData = data.filter(item => item && item.english_word);
            }

            const randomEntry = validData[Math.floor(Math.random() * validData.length)];
            this.currentData = randomEntry;
            this.enCompleted = "";
            this.viCompleted = "";

            // Phát âm từ tiếng Anh ngay khi vừa load được từ
            this.speakWord(randomEntry.english_word, 'en-US');

            // Tạm thời khóa phần hình ảnh
            const imageUrl = ""; 
            
            this.renderQuestionUI(imageUrl, randomEntry);

        } catch (err) {
            console.error("Lỗi QuestionManager:", err);
            const container = document.getElementById('questionarea');
            if (container) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-6 text-center">
                        <div class="text-red-500 font-bold mb-2">⚠️ ${err.message}</div>
                        <button onclick="window.QuestionManager.loadType1('${enemyType}')" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            Thử tải lại dữ liệu
                        </button>
                    </div>
                `;
            }
        }
    },

    /**
     * Vẽ giao diện câu hỏi vào vùng questionarea
     */
    renderQuestionUI(imgUrl, entry) {
        const container = document.getElementById('questionarea');
        if (!container) return;

        const wordEn = String(entry.english_word || "").trim();
        const wordVi = String(entry.vietnamese_translation || "").trim();

        // Thêm Style cho hiệu ứng rơi
        if (!document.getElementById('qm-styles')) {
            const style = document.createElement('style');
            style.id = 'qm-styles';
            style.innerHTML = `
                @keyframes fallIn {
                    0% { transform: translateY(-100px); opacity: 0; }
                    60% { transform: translateY(10px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .letter-fall { animation: fallIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                .preview-text { transition: opacity 0.5s ease-out; }
                .space-box { width: 24px; } /* Độ rộng cho khoảng trắng khi xếp lên */
            `;
            document.head.appendChild(style);
        }

        container.innerHTML = `
            <div class="flex w-full h-full p-4 relative overflow-hidden bg-white rounded-3xl">
                <!-- Bên phải: Vùng chữ cái (Chỉnh sửa để chiếm full chiều rộng khi không có ảnh) -->
                <div class="flex-1 flex flex-col justify-center gap-8 py-2 px-4 w-full">
                    
                    <!-- Hiển thị từ hoàn chỉnh ban đầu (Sẽ biến mất sau 1.5s) -->
                    <div id="preview-area" class="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center pointer-events-none preview-text">
                        <h2 class="text-5xl font-black text-blue-600 mb-2 uppercase tracking-widest">${wordEn}</h2>
                        <h3 class="text-3xl font-bold text-gray-400 italic">${wordVi}</h3>
                        <div class="mt-4 text-sm text-gray-400">🔊 Đang phát âm...</div>
                    </div>

                    <!-- Khu vực tương tác thực sự -->
                    <div class="flex flex-col items-center w-full">
                        <div id="en-slots" class="flex flex-wrap justify-center gap-2 mb-8 min-h-[50px] w-full border-b-2 border-dashed border-gray-200 pb-2"></div>
                        <div id="en-letters" class="flex flex-wrap justify-center gap-3 min-h-[50px] w-full"></div>
                    </div>

                    <div class="flex flex-col items-center w-full">
                        <div id="vi-slots" class="flex flex-wrap justify-center gap-2 mb-8 min-h-[50px] w-full border-b-2 border-dashed border-gray-200 pb-2"></div>
                        <div id="vi-letters" class="flex flex-wrap justify-center gap-3 min-h-[50px] w-full"></div>
                    </div>
                </div>
            </div>
        `;

        // Sau 1.5 giây, ẩn từ mẫu và bắt đầu rơi chữ cái
        setTimeout(() => {
            const preview = document.getElementById('preview-area');
            if (preview) preview.style.opacity = '0';
            
            setTimeout(() => {
                if (preview) preview.remove();
                this.animateLetters(wordEn, 'en');
                this.animateLetters(wordVi, 'vi');
            }, 500);
        }, 1500);
    },

    /**
     * Tạo hiệu ứng chữ cái rơi và xáo trộn
     */
    animateLetters(word, lang) {
        const lettersContainer = document.getElementById(`${lang}-letters`);
        const slotsContainer = document.getElementById(`${lang}-slots`);
        if (!lettersContainer || !slotsContainer) return;

        // Bỏ qua khoảng trắng khi tạo danh sách chữ cái để chơi bên dưới
        const cleanLetters = word.split('').filter(char => char !== ' ');
        
        const shuffled = cleanLetters.map((char, originalIdx) => ({ char, originalIdx }))
                           .sort(() => Math.random() - 0.5);
        
        shuffled.forEach((item, index) => {
            const btn = document.createElement('div');
            btn.className = `w-12 h-12 bg-white border-2 border-gray-400 rounded-xl shadow-[4px_4px_0px_#ccc] flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-yellow-50 transform transition-all opacity-0 letter-fall`;
            btn.style.animationDelay = `${index * 0.1}s`;
            btn.innerText = item.char.toUpperCase();
            
            btn.onclick = () => {
                const currentStr = lang === 'en' ? this.enCompleted : this.viCompleted;
                
                // Xác định index thực tế của ký tự tiếp theo trong từ gốc (bao gồm cả khoảng trắng)
                let actualIdx = 0;
                let cleanCount = 0;
                while (actualIdx < word.length) {
                    if (word[actualIdx] !== ' ') {
                        if (cleanCount === currentStr.length) break;
                        cleanCount++;
                    }
                    actualIdx++;
                }

                const targetChar = word[actualIdx];

                if (item.char.toLowerCase() === targetChar.toLowerCase()) {
                    // Cập nhật trạng thái hoàn thành
                    if (lang === 'en') this.enCompleted += item.char;
                    else this.viCompleted += item.char;

                    // Chèn chữ cái vào UI
                    const finalLetter = document.createElement('div');
                    finalLetter.className = `w-12 h-12 ${lang === 'en' ? 'bg-blue-500' : 'bg-green-500'} text-white rounded-xl border-2 border-white shadow-lg flex items-center justify-center text-2xl font-black animate-bounce`;
                    finalLetter.innerText = item.char.toUpperCase();
                    slotsContainer.appendChild(finalLetter);

                    // Kiểm tra xem ký tự TIẾP THEO trong từ gốc có phải là khoảng trắng không
                    let nextIdx = actualIdx + 1;
                    while (nextIdx < word.length && word[nextIdx] === ' ') {
                        const spaceBox = document.createElement('div');
                        spaceBox.className = "space-box h-12"; 
                        slotsContainer.appendChild(spaceBox);
                        nextIdx++;
                    }

                    btn.style.visibility = 'hidden';
                    this.checkProgress();
                } else {
                    btn.classList.add('bg-red-100', 'border-red-400');

                    if (window.GameEngine && !window.GameEngine.isBattling) {
                        window.GameEngine.startBattleTurn(window.GameEngine.monster, window.GameEngine.player);
                    }

                    setTimeout(() => btn.classList.remove('bg-red-100', 'border-red-400'), 500);

                }
            };

            lettersContainer.appendChild(btn);
        });
    },

    /**
     * Kiểm tra tiến trình hoàn thành
     */
    checkProgress() {
        if (!this.currentData) return;
        const wordEn = this.currentData.english_word;
        const wordVi = this.currentData.vietnamese_translation;

        const cleanEn = wordEn.replace(/\s+/g, '').toLowerCase();
        const cleanVi = wordVi.replace(/\s+/g, '').toLowerCase();

        if (this.enCompleted.toLowerCase() === cleanEn && 
            this.viCompleted.toLowerCase() === cleanVi) {
            
            // Phát âm lại từ tiếng Anh khi bé hoàn thành đúng toàn bộ
            this.speakWord(wordEn, 'en-US');

            if (window.GameEngine) {
                setTimeout(() => window.GameEngine.handleCorrect(wordEn), 600);
            }
        }
    }
};

window.QuestionManager = QuestionManager;