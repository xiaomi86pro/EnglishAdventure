// js/question/question6.js
const QuestionType6 = {
    autoReload: false,
    currentData: null, // { items: [{ english, vietnamese, display, removed, removedPos }] }
    selectedCutId: null, // id của đoạn chữ bị chọn (cut)
    selectedWordId: null, // id của từ bị chọn (word)
    pairs: [], // [{ cutId, wordId, lineId, correct }]
    onCorrect: null,
    onWrong: null,

    speak(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    },

    async load() {
        if (!window.supabase) {
            setTimeout(() => this.load(), 300);
            return;
        }

        try {
            // Lấy 100 từ random (giống pattern trước)
            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation")
                .limit(100);

            if (error) throw error;

            // Chọn 5 từ ngẫu nhiên
            const shuffled = data.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 5).map(item => ({
                english: item.english_word.trim().toUpperCase(),
                vietnamese: item.vietnamese_translation?.trim() || ""
            }));

            // Tạo items với phần bị cắt
            const items = selected.map((it, idx) => {
                const chars = it.english.split('');
                // Tìm các index không phải space
                const nonSpaceIdx = chars.map((c, i) => c !== ' ' ? i : -1).filter(i => i >= 0);
                // Chọn 2 vị trí ngẫu nhiên trong nonSpaceIdx (không trùng)
                let pos1 = nonSpaceIdx[Math.floor(Math.random() * nonSpaceIdx.length)];
                let pos2 = pos1;
                if (nonSpaceIdx.length > 1) {
                    while (pos2 === pos1) {
                        pos2 = nonSpaceIdx[Math.floor(Math.random() * nonSpaceIdx.length)];
                    }
                }
                // Sắp xếp vị trí tăng dần để dễ chèn lại
                const removedPos = [pos1, pos2].sort((a,b) => a-b);
                // Lấy removed string (theo thứ tự xuất hiện)
                const removed = removedPos.map(p => chars[p]).join('');
                // Tạo display (giữ space, thay ký tự bị cắt bằng '_')
                const displayChars = chars.slice();
                removedPos.forEach(p => displayChars[p] = '_');
                const display = displayChars.join('');

                return {
                    id: `w${idx}`,
                    english: it.english,
                    vietnamese: it.vietnamese,
                    display,       // ví dụ "ICE _REAM" (underscore giữ vị trí)
                    removed,       // ví dụ "CR"
                    removedPos     // [i,j]
                };
            });

            this.currentData = { items };
            this.pairs = [];
            this.selectedCutId = null;
            this.selectedWordId = null;

            this.renderQuestionUI();
        } catch (err) {
            console.error("QuestionType6 load error:", err);
        }
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const items = this.currentData.items;

        // Cột từ khuyết (left) và cột đoạn bị cắt (right) - trộn lẫn
        const leftList = items.map(it => ({ id: it.id, text: it.display, type: 'word' }));
        const rightList = items.map(it => ({ id: it.id, text: it.removed, type: 'cut' }));

        // Trộn order hiển thị (riêng từng cột)
        const shuffledLeft = leftList.sort(() => Math.random() - 0.5);
        const shuffledRight = rightList.sort(() => Math.random() - 0.5);

        // Tạo HTML
        area.innerHTML = `
            <div class="w-full h-full p-4">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-black text-purple-600">Question Type 6 - Ghép đoạn</h3>
                    <div class="flex gap-3">
                        <button id="check-btn" class="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50" disabled>Kiểm tra</button>
                        <button id="reload-btn" class="px-4 py-2 bg-gray-200 text-black rounded-lg">Làm lại</button>
                    </div>
                </div>

                <div id="match-area" class="relative flex gap-6">
                    <!-- Left column: words (missing) -->
                    <div id="col-words" class="w-1/2 space-y-3">
                        ${shuffledLeft.map((w, idx) => `
                            <div id="word-${w.id}" data-id="${w.id}" class="word-item p-3 rounded-lg bg-white border-2 border-gray-200 text-left cursor-pointer select-none">
                                <div class="text-sm text-gray-400">${this.getVietnameseById(w.id)}</div>
                                <div class="text-2xl font-black text-blue-700 mt-1">${this.escapeHtml(w.text)}</div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Right column: cuts -->
                    <div id="col-cuts" class="w-1/2 space-y-3">
                        ${shuffledRight.map((c, idx) => `
                            <div id="cut-${c.id}" data-id="${c.id}" class="cut-item p-3 rounded-lg bg-white border-2 border-gray-200 text-center cursor-pointer select-none">
                                <div class="text-2xl font-black text-purple-700">${this.escapeHtml(c.text)}</div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- SVG overlay để vẽ đường nối -->
                    <svg id="match-svg" class="absolute inset-0 pointer-events-none" style="width:100%;height:100%;"></svg>
                </div>
            </div>
        `;

        // Gắn sự kiện
        this.attachEventHandlers();
    },

    // helper: lấy vietnamese theo id
    getVietnameseById(id) {
        const it = this.currentData.items.find(x => x.id === id);
        return it ? it.vietnamese : "";
    },

    // escape HTML để tránh innerHTML injection
    escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    attachEventHandlers() {
        // Word items
        const wordEls = document.querySelectorAll('.word-item');
        wordEls.forEach(el => {
            el.onclick = (e) => {
                const id = el.dataset.id;
                this.onSelectWord(id, el);
            };
        });

        // Cut items
        const cutEls = document.querySelectorAll('.cut-item');
        cutEls.forEach(el => {
            el.onclick = (e) => {
                const id = el.dataset.id;
                this.onSelectCut(id, el);
            };
        });

        // Buttons
        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) checkBtn.onclick = () => this.checkPairs();

        const reloadBtn = document.getElementById('reload-btn');
        if (reloadBtn) reloadBtn.onclick = () => this.load();
    },

    onSelectCut(id, el) {
        // Nếu cut đã được ghép rồi thì ignore
        if (this.pairs.find(p => p.cutId === id)) return;

        // Toggle selection
        // Bỏ chọn cut trước đó (nếu có)
        if (this.selectedCutId && this.selectedCutId !== id) {
            const prevEl = document.getElementById(`cut-${this.selectedCutId}`);
            if (prevEl) prevEl.classList.remove('bg-black','text-white');
        }

        // Nếu đang chọn same cut -> unselect
        if (this.selectedCutId === id) {
            el.classList.remove('bg-black','text-white');
            this.selectedCutId = null;
            return;
        }

        // Chọn cut mới
        el.classList.add('bg-black','text-white');
        this.selectedCutId = id;

        // Nếu đã chọn word trước đó thì tạo pair
        if (this.selectedWordId) {
            this.createPair(this.selectedCutId, this.selectedWordId);
            // reset selections visuals
            const wordEl = document.getElementById(`word-${this.selectedWordId}`);
            if (wordEl) wordEl.classList.remove('bg-black','text-white');
            const cutEl = document.getElementById(`cut-${this.selectedCutId}`);
            if (cutEl) cutEl.classList.remove('bg-black','text-white');

            this.selectedCutId = null;
            this.selectedWordId = null;
        }
    },

    onSelectWord(id, el) {
        // Nếu word đã được ghép rồi thì ignore
        if (this.pairs.find(p => p.wordId === id)) return;

        // Toggle selection
        if (this.selectedWordId && this.selectedWordId !== id) {
            const prevEl = document.getElementById(`word-${this.selectedWordId}`);
            if (prevEl) prevEl.classList.remove('bg-black','text-white');
        }

        if (this.selectedWordId === id) {
            el.classList.remove('bg-black','text-white');
            this.selectedWordId = null;
            return;
        }

        el.classList.add('bg-black','text-white');
        this.selectedWordId = id;

        // Nếu đã chọn cut trước đó thì tạo pair
        if (this.selectedCutId) {
            this.createPair(this.selectedCutId, this.selectedWordId);
            // reset visuals
            const wordEl = document.getElementById(`word-${this.selectedWordId}`);
            if (wordEl) wordEl.classList.remove('bg-black','text-white');
            const cutEl = document.getElementById(`cut-${this.selectedCutId}`);
            if (cutEl) cutEl.classList.remove('bg-black','text-white');

            this.selectedCutId = null;
            this.selectedWordId = null;
        }
    },

    createPair(cutId, wordId) {
        // Nếu đã có pair với cut hoặc word thì ignore
        if (this.pairs.find(p => p.cutId === cutId || p.wordId === wordId)) return;

        // Tạo line id
        const lineId = `line-${cutId}-${wordId}`;
        this.pairs.push({ cutId, wordId, lineId, correct: null });

        // Vẽ đường nối ngay lập tức
        this.drawAllLines();

        // Nếu đã nối đủ 5 cặp thì bật nút check
        if (this.pairs.length === this.currentData.items.length) {
            const checkBtn = document.getElementById('check-btn');
            if (checkBtn) checkBtn.disabled = false;
        }
    },

    // Vẽ tất cả đường nối hiện tại (solid line màu xám)
    drawAllLines() {
        const svg = document.getElementById('match-svg');
        if (!svg) return;
        // Xóa hết trước
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        this.pairs.forEach(p => {
            const cutEl = document.getElementById(`cut-${p.cutId}`);
            const wordEl = document.getElementById(`word-${p.wordId}`);
            if (!cutEl || !wordEl) return;

            const cRect = cutEl.getBoundingClientRect();
            const wRect = wordEl.getBoundingClientRect();
            const parentRect = svg.getBoundingClientRect();

            // Tính điểm giữa của mỗi ô (relative to svg)
            const x1 = cRect.left + cRect.width / 2 - parentRect.left;
            const y1 = cRect.top + cRect.height / 2 - parentRect.top;
            const x2 = wRect.left + wRect.width / 2 - parentRect.left;
            const y2 = wRect.top + wRect.height / 2 - parentRect.top;

            // Tạo đường (solid gray)
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("id", p.lineId);
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", "#9CA3AF"); // gray-400
            line.setAttribute("stroke-width", "4");
            line.setAttribute("stroke-linecap", "round");
            svg.appendChild(line);
        });
    },

    // Kiểm tra các cặp đã nối
    checkPairs() {
        if (!this.pairs || this.pairs.length === 0) return;

        const items = this.currentData.items;
        let correctCount = 0;
        let wrongCount = 0;

        // Kiểm tra từng pair
        this.pairs.forEach(p => {
            const item = items.find(it => it.id === p.wordId);
            if (!item) {
                p.correct = false;
                wrongCount++;
                return;
            }
            // So sánh removed string
            if (p.cutId === p.wordId) {
                // Nếu cutId === wordId (chúng ta dùng id giống nhau khi tạo), thì đúng
                p.correct = true;
                correctCount++;
            } else {
                // Trong cấu trúc mình dùng id giống nhau cho cut và word (cut-{id}, word-{id})
                // Nếu người chơi ghép cutId với wordId khác => sai
                p.correct = false;
                wrongCount++;
            }
        });

        // Cập nhật UI: nếu đúng -> chạy vào giữa, xanh; sai -> đỏ và đường đứt
        const svg = document.getElementById('match-svg');
        this.pairs.forEach(p => {
            const cutEl = document.getElementById(`cut-${p.cutId}`);
            const wordEl = document.getElementById(`word-${p.wordId}`);
            const lineEl = document.getElementById(p.lineId);

            if (p.correct) {
                // animation: chuyển 2 ô vào giữa (center) và đổi màu xanh
                if (cutEl) {
                    cutEl.classList.add('bg-green-500','text-white');
                    cutEl.style.transition = 'transform 0.5s ease, opacity 0.5s';
                }
                if (wordEl) {
                    wordEl.classList.add('bg-green-500','text-white');
                    wordEl.style.transition = 'transform 0.5s ease, opacity 0.5s';
                }
                if (lineEl) {
                    lineEl.setAttribute('stroke', '#16A34A'); // green-600
                }
                // Gọi onCorrect 1 lần cho mỗi từ đúng
                if (typeof this.onCorrect === 'function') this.onCorrect();
            } else {
                // sai: đỏ và đường đứt đoạn
                if (cutEl) cutEl.classList.add('bg-red-500','text-white');
                if (wordEl) wordEl.classList.add('bg-red-500','text-white');
                if (lineEl) {
                    lineEl.setAttribute('stroke', '#DC2626'); // red-600
                    lineEl.setAttribute('stroke-dasharray', '6 6');
                }
                if (typeof this.onWrong === 'function') this.onWrong();
            }
        });

        // Disable nút check sau khi kiểm tra
        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) checkBtn.disabled = true;
    },

    destroy() {
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
        this.pairs = [];
        this.selectedCutId = null;
        this.selectedWordId = null;
    }
};

export default QuestionType6;
window.QuestionType6 = QuestionType6;