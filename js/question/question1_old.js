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
            // Reset trạng thái trước khi load câu mới
            this._submitted = false;
            this.enCompleted = "";
            this.viCompleted = "";
            this._enExpected = undefined;
            this._viExpected = undefined;
            this.hintUsed = false;
    
            // 1) Chọn dữ liệu theo thứ tự ưu tiên:
            // _vocabPick (QuestionManager) -> _vocabulary (array) -> _preloadedData -> VOCAB_CACHE -> fallback fetch
            let selected = null;
    
            if (this._vocabPick) {
                selected = this._vocabPick;
                this._vocabPick = null;
                if (window.CONFIG?.debug) console.log('[QuestionType1] using _vocabPick', selected);
            }
    
            if (!selected && Array.isArray(this._vocabulary) && this._vocabulary.length) {
                selected = this._vocabulary[Math.floor(Math.random() * this._vocabulary.length)];
                if (window.CONFIG?.debug) console.log('[QuestionType1] using _vocabulary pick', selected);
            }
    
            if (!selected && this._preloadedData) {
                selected = this._preloadedData;
                this._preloadedData = null;
                if (window.CONFIG?.debug) console.log('[QuestionType1] using _preloadedData', selected);
            }
    
            if (!selected && window.VOCAB_CACHE && window.VOCAB_CACHE.length) {
                selected = window.VOCAB_CACHE[Math.floor(Math.random() * window.VOCAB_CACHE.length)];
                if (window.CONFIG?.debug) console.log('[QuestionType1] using VOCAB_CACHE pick', selected);
            }
    
            if (!selected && window.supabase) {
                try {
                    const { data, error } = await window.supabase
                        .from("vocabulary")
                        .select("english_word, vietnamese_translation")
                        .limit(1);
                    if (!error && data && data.length) {
                        selected = data[0];
                        window.VOCAB_CACHE = (window.VOCAB_CACHE || []).concat(data);
                        if (window.CONFIG?.debug) console.log('[QuestionType1] fetched fallback item', selected);
                    }
                } catch (e) {
                    console.warn('[QuestionType1] fallback fetch failed', e);
                }
            }
    
            // Nếu không có dữ liệu hợp lệ -> hiển thị thông báo và trigger prefetch
            if (!selected || !selected.english_word || !selected.vietnamese_translation) {
                console.error('[QuestionType1] No vocabulary selected for load', selected);
                const area = document.getElementById("questionarea");
                if (area) {
                    area.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
                            <div class="text-4xl">⚠️</div>
                            <p class="text-lg font-bold">Không có dữ liệu từ vựng</p>
                            <p class="text-sm text-gray-500">Đang thử tải lại, vui lòng chờ...</p>
                        </div>
                    `;
                }
                if (window.QuestionManager?.prefetchNext) window.QuestionManager.prefetchNext();
                return;
            }
    
            // 2) Gán dữ liệu và kỳ vọng
            this.currentData = selected;
            const en = String(selected.english_word || "").trim();
            const vi = String(selected.vietnamese_translation || "").trim();
    
            // Gán expected (animateLetters cũng sẽ set phần vi nếu có khóa)
            this._enExpected = en.replace(/\s+/g, '').toLowerCase();
            this._viExpected = vi.replace(/\s+/g, '').toLowerCase();
    
            // 3) Render UI và phát âm (không block)
            this.renderQuestionUI();
    
            // Phát âm sau khi UI render để ưu tiên hiển thị
            setTimeout(() => {
                try { this.speakWord(this.currentData.english_word, "en-US"); } catch(e){ console.warn(e); }
            }, 150);
    
        } catch (err) {
            console.error("QuestionType1.load error:", err);
            const area = document.getElementById("questionarea");
            if (area) {
                area.innerHTML = `<div class="text-red-500 font-bold">Lỗi khi tải câu hỏi. Vui lòng thử lại.</div>`;
            }
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
    
        if (lang === "vi") {
            const words = word.trim().split(/\s+/);
            if (words.length > 1) {
                const lockedPart = words.slice(0, -1).join(" ");
                const shufflePart = words[words.length - 1];
        
                // Hiển thị phần khóa như trước
                lockedPart.split("").forEach(char => {
                    if (char === " ") {
                        const spaceBox = document.createElement("div");
                        spaceBox.className = "space-box h-12";
                        slotsContainer.appendChild(spaceBox);
                    } else {
                        const fixedLetter = document.createElement("div");
                        fixedLetter.className = `w-12 h-12 text-white rounded-xl border-2 border-white flex items-center justify-center text-2xl font-black bg-green-500`;
                        fixedLetter.innerText = char.toUpperCase();
                        slotsContainer.appendChild(fixedLetter);
                    }
                });
        
                const spaceBox = document.createElement("div");
                spaceBox.className = "space-box h-12";
                slotsContainer.appendChild(spaceBox);
        
                // Chỉ trộn phần cuối
                cleanLetters = shufflePart.split("").filter(c => c !== " ");
        
                // Gán kỳ vọng cho phần VI (chỉ phần trộn)
                this._viExpected = shufflePart.replace(/\s+/g, '').toLowerCase();
            } else {
                // Nếu chỉ 1 từ → kỳ vọng là toàn bộ từ
                this._viExpected = word.replace(/\s+/g, '').toLowerCase();
            }
        } else {
            // Nếu là EN, kỳ vọng là toàn bộ từ (không space)
            this._enExpected = word.replace(/\s+/g, '').toLowerCase();
        }
    
        const shuffled = cleanLetters.map((c, i) => ({ c, i }))
            .sort(() => Math.random() - 0.5);
    
        shuffled.forEach((item, index) => {
            const btn = document.createElement("div");
            btn.className = `w-12 h-12 bg-white border-2 border-gray-400 rounded-xl shadow-[4px_4px_0px_#ccc] flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-yellow-50 transform transition-all opacity-0 letter-fall`;
            btn.style.animationDelay = `${index * 0.1}s`;
            btn.innerText = item.c.toUpperCase();
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
            btn.style.visibility = 'visible';

            btn.onclick = () => {
                // Nếu đã hoàn tất hoặc đã disable, ignore
                if (this._submitted || btn.disabled) {
                    console.log('[QuestionType1] click ignored, submitted or disabled');
                    return;
                }
            
                const currentStr = lang === "en" ? this.enCompleted : this.viCompleted;
            
                // Kỳ vọng tương ứng (nếu đã set trong animateLetters)
                const expectedEn = this._enExpected || (this.currentData?.english_word || "").replace(/\s+/g, '').toLowerCase();
                const expectedVi = this._viExpected || (this.currentData?.vietnamese_translation || "").replace(/\s+/g, '').toLowerCase();
            
                const expected = (lang === "en") ? expectedEn : expectedVi;
            
                // Ký tự tiếp theo cần điền (theo thứ tự trong phần kỳ vọng)
                const nextIndex = currentStr.length;
                const expectedChar = (nextIndex < (expected || '').length) ? expected[nextIndex] : null;
                if (!expectedChar) {
                    console.warn('[QuestionType1] expectedChar missing', { expected, nextIndex });
                    // xử lý an toàn: treat as wrong
                    if (typeof this.onWrong === "function") this.onWrong();
                    return;
                }

            
                // So sánh ký tự bấm với ký tự cần điền (theo thứ tự)
                if (item.c.toLowerCase() === expectedChar) {
                    if (lang === "en") this.enCompleted += item.c;
                    else this.viCompleted += item.c;
            
                    const finalLetter = document.createElement("div");
                    finalLetter.className = `w-12 h-12 text-white rounded-xl border-2 border-white flex items-center justify-center text-2xl font-black ${lang === "en" ? "bg-blue-500" : "bg-green-500"}`;
                    finalLetter.innerText = item.c.toUpperCase();
                    slotsContainer.appendChild(finalLetter);
            
                    btn.style.visibility = "hidden";
                    btn.disabled = true;
                    this.checkProgress();
                } else {
                    // Sai thứ tự -> gọi onWrong và hiệu ứng
                    btn.classList.add("bg-red-100", "border-red-400");
                    setTimeout(() => btn.classList.remove("bg-red-100", "border-red-400"), 500);
                    console.log('[QuestionType1] wrong letter clicked', { clicked: item.c, expected: expectedChar, lang });
                    if (typeof this.onWrong === "function") this.onWrong();
                }
            };
    
            lettersContainer.appendChild(btn);
        });
    },

    checkProgress() {
        if (!this.currentData) return;
        const wordEn = this.currentData.english_word || "";
        const wordVi = this.currentData.vietnamese_translation || "";
    
        // Kỳ vọng đã được set trong animateLetters
        const expectedEn = this._enExpected || wordEn.replace(/\s+/g, '').toLowerCase();
        const expectedVi = this._viExpected || wordVi.replace(/\s+/g, '').toLowerCase();
    
        const enDone = (this.enCompleted || "").toLowerCase();
        const viDone = (this.viCompleted || "").toLowerCase();
    
        if (enDone === expectedEn && viDone === expectedVi) {
            console.log('[QuestionType1] completed both EN and VI', { en: enDone, vi: viDone });
    
            // Disable tất cả nút chữ để tránh spam
            const allBtns = document.querySelectorAll('#en-letters .w-12, #vi-letters .w-12');
            allBtns.forEach(b => { try { b.disabled = true; b.style.pointerEvents = 'none'; } catch(e){} });
    
            this._submitted = true;
    
            this.speakWord(wordEn, "en-US");
            this.speakWord(wordVi, "vi-VN");
            if (typeof this.onCorrect === "function") {
                console.log('[QuestionType1] calling onCorrect');
                this.onCorrect();
            } else {
                console.warn('[QuestionType1] onCorrect not defined');
            }
        }
    },

    destroy() {
        try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.enCompleted = "";
        this.viCompleted = "";
        this._submitted = false;
        this._enExpected = undefined;
        this._viExpected = undefined;
    
        // Bật lại mọi nút (nếu có)
        document.querySelectorAll('#en-letters .w-12, #vi-letters .w-12').forEach(b => {
            try { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.visibility = 'visible'; } catch(e){}
        });
    },
};

window.QuestionType1 = QuestionType1;
export default QuestionType1;
