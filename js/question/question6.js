// js/question/question6.js
const QuestionType6 = {
    autoReload: false,
    currentData: null,
    selectedCutId: null,
    selectedWordId: null,
    pairs: [], 
    onCorrect: null,
    onWrong: null,

    // ... (Giữ nguyên phần speak và load) ...
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
            const { data, error } = await window.supabase
                .from("vocabulary")
                .select("english_word, vietnamese_translation")
                .limit(100);
            if (error) throw error;

            const shuffled = data.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 5).map(item => ({
                english: item.english_word.trim().toUpperCase(),
                vietnamese: item.vietnamese_translation?.trim() || ""
            }));

            const items = selected.map((it, idx) => {
                const chars = it.english.split('');
                const nonSpaceIdx = chars.map((c, i) => c !== ' ' ? i : -1).filter(i => i >= 0);
                
                let pos1 = nonSpaceIdx[Math.floor(Math.random() * nonSpaceIdx.length)];
                let pos2 = pos1;
                if (nonSpaceIdx.length > 1) {
                    while (pos2 === pos1) {
                        pos2 = nonSpaceIdx[Math.floor(Math.random() * nonSpaceIdx.length)];
                    }
                }
                const removedPos = [pos1, pos2].sort((a,b) => a-b);
                const removed = removedPos
    .map(p => chars[p])
    .join('')
    .replace(/_/g, '')          // loại underscore nếu vô tình có
    .replace(/^["']+|["']+$/g, '') // loại quotes
    .replace(/\s+/g, '')       // loại khoảng trắng
    .trim()
    .toUpperCase();
                const displayChars = chars.slice();
                removedPos.forEach(p => displayChars[p] = '_');
                const display = displayChars.join('');

                return {
                    id: `w${idx}`,
                    english: it.english,
                    vietnamese: it.vietnamese,
                    display,
                    removed,
                    removedPos
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

    // --- CẬP NHẬT GIAO DIỆN TẠI ĐÂY ---
   // Thay thế toàn bộ renderQuestionUI() bằng đoạn này
    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const items = this.currentData.items || [];

        // Tạo 2 mảng đã shuffle (bạn đã có logic shuffle trước, giữ nguyên ý tưởng)
        const leftList = items.map(it => ({ id: it.id, text: it.display }));
        const rightList = items.map(it => ({ id: it.id, text: it.removed }));

        const shuffledLeft = leftList.sort(() => Math.random() - 0.5);
        const shuffledRight = rightList.sort(() => Math.random() - 0.5);

        area.innerHTML = `
    <div class="w-full h-full p-4">
        <div class="flex items-center justify-between mb-2">
            <h3 class="text-xl font-black text-purple-600">Ghép từ hoàn chỉnh</h3>
            <div class="flex gap-3">
                <button id="check-btn" class="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50 transition-all hover:bg-blue-600 shadow-md" disabled>Kiểm tra</button>
            </div>
        </div>

        <div id="match-area" class="relative mt-4">
            <div id="match-grid" class="grid gap-6 w-full max-w-4xl mx-auto" style="grid-template-columns: 1fr 1fr;">
                ${(() => {
                    const maxLen = Math.max(shuffledLeft.length, shuffledRight.length);
                    let rows = '';
                    for (let i = 0; i < maxLen; i++) {
                        const left = shuffledLeft[i];
                        const right = shuffledRight[i];

                        rows += `
                        <!-- Row ${i+1} -->
                        <div class="group-word relative">
                            <p class="text-green-600 font-bold text-sm mb-1 ml-1 uppercase tracking-wide">
                                ${left ? this.getVietnameseById(left.id) : ''}
                            </p>
                            <div id="word-${left ? left.id : 'empty-'+i}" data-id="${left ? left.id : ''}"
                                class="word-item h-[72px] flex items-center justify-center bg-white border-2 border-blue-200 rounded-xl cursor-pointer select-none transition-all hover:border-blue-400 shadow-sm ${left ? '' : 'opacity-40 pointer-events-none'}">
                                <p class="text-2xl font-mono font-black tracking-wider text-gray-700">${left ? this.escapeHtml(left.text) : ''}</p>
                            </div>
                        </div>

                        <div class="relative flex items-center justify-center">
                            <div id="cut-${right ? right.id : 'empty-'+i}" data-id="${right ? right.id : ''}"
                                class="cut-item h-[72px] flex items-center justify-center bg-purple-50 border-2 border-purple-200 rounded-xl cursor-pointer select-none transition-all hover:border-purple-400 shadow-sm ${right ? '' : 'opacity-40 pointer-events-none'}">
                                <span class="text-2xl font-mono font-black text-yeallow-700 tracking-wider">
                                    ${ right ? this.escapeHtml(this.getCutMaskedById(right.id) || right.text) : '' }
                                </span>
                            </div>
                        </div>
                        `;
                    }
                    return rows;
                })()}
            </div>

            <svg id="match-svg" class="absolute inset-0 pointer-events-none" style="width:100%;height:100%; z-index: 0;"></svg>
        </div>
    </div>
`;

        // Gắn sự kiện sau khi render
        this.attachEventHandlers();

        // Vẽ đường ngay sau khi DOM đã có
        // dùng setTimeout 0 để đảm bảo layout đã ổn
        setTimeout(() => {
            if (typeof this.drawAllLines === 'function') this.drawAllLines();
        }, 0);

        // Đăng ký resize để cập nhật đường khi thay đổi kích thước
        if (!this._q6_resize_bound) {
            this._q6_resize_bound = () => {
                if (typeof this.drawAllLines === 'function') this.drawAllLines();
            };
            window.addEventListener('resize', this._q6_resize_bound);
        }
    },

    getCutMaskedById(id) {
        const it = this.currentData?.items?.find(x => x.id === id);
        if (!it) return "";
        const chars = String(it.english || "").split('');
        const removedPos = Array.isArray(it.removedPos) ? it.removedPos : [];
    
        // Hiển thị ký tự ở removedPos, '_' ở các vị trí khác
        const masked = chars.map((ch, idx) => removedPos.includes(idx) ? ch : '_');
        return masked.join('');
    },
    
    

    getVietnameseById(id) {
        const it = this.currentData.items.find(x => x.id === id);
        return it ? it.vietnamese : "";
    },
    
    getEnglishById(id) {
        const it = this.currentData.items.find(x => x.id === id);
        return it ? it.english : "";
    },

    escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    attachEventHandlers() {
        const wordEls = document.querySelectorAll('.word-item');
        wordEls.forEach(el => {
            el.onclick = () => {
                if (el.classList.contains('merged')) return;
                this.onSelectWord(el.dataset.id, el);
            };
        });
        const cutEls = document.querySelectorAll('.cut-item');
        cutEls.forEach(el => {
            el.onclick = () => {
                this.onSelectCut(el.dataset.id, el);
            };
        });
        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) checkBtn.onclick = () => this.checkPairs();
        const reloadBtn = document.getElementById('reload-btn');
        if (reloadBtn) reloadBtn.onclick = () => this.load();
    },

    // --- LOGIC HỦY KẾT NỐI (UNPAIR) ---
    removePair(pairIndex) {
        const pair = this.pairs[pairIndex];
        // Xóa line SVG
        const lineEl = document.getElementById(pair.lineId);
        if (lineEl) lineEl.remove();
        
        // Xóa khỏi mảng pairs
        this.pairs.splice(pairIndex, 1);
        
        // Disable nút check vì đã mất 1 cặp
        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) checkBtn.disabled = true;
    },

    onSelectCut(id, el) {
        // 1. Kiểm tra xem ô này đã được nối chưa
        const existingPairIndex = this.pairs.findIndex(p => p.cutId === id);
        if (existingPairIndex !== -1) {
            // Nếu đã nối -> Hủy kết nối
            this.removePair(existingPairIndex);
            // Xóa style active nếu có
            el.classList.remove('bg-purple-600','text-white', '!border-purple-600');
            // Nếu ô này đang được chọn (highlight) thì bỏ chọn luôn
            if (this.selectedCutId === id) this.selectedCutId = null;
            return; 
        }

        // 2. Logic chọn như cũ
        if (this.selectedCutId && this.selectedCutId !== id) {
            const prevEl = document.getElementById(`cut-${this.selectedCutId}`);
            if (prevEl) prevEl.classList.remove('bg-purple-600','text-white', '!border-purple-600');
        }

        if (this.selectedCutId === id) {
            el.classList.remove('bg-purple-600','text-white', '!border-purple-600');
            this.selectedCutId = null;
            return;
        }

        el.classList.add('bg-purple-600','text-white', '!border-purple-600');
        this.selectedCutId = id;

        if (this.selectedWordId) {
            this.createPair(this.selectedCutId, this.selectedWordId);
            this.clearSelectionVisuals();
        }
    },

    onSelectWord(id, el) {
        // 1. Kiểm tra xem ô này đã được nối chưa
        const existingPairIndex = this.pairs.findIndex(p => p.wordId === id);
        if (existingPairIndex !== -1) {
            // Nếu đã nối -> Hủy kết nối
            this.removePair(existingPairIndex);
            el.classList.remove('bg-blue-600','text-white', '!border-blue-600');
             // Reset màu chữ bên trong (nếu cần thiết, dù render lại sẽ reset)
            const p = el.querySelector('p');
            if(p) { p.classList.remove('text-white'); p.classList.add('text-gray-700'); }
            
            if (this.selectedWordId === id) this.selectedWordId = null;
            return;
        }

        // 2. Logic chọn như cũ
        if (this.selectedWordId && this.selectedWordId !== id) {
            const prevEl = document.getElementById(`word-${this.selectedWordId}`);
            if (prevEl) {
                prevEl.classList.remove('bg-blue-600','text-white', '!border-blue-600');
                const p = prevEl.querySelector('p');
                if(p) { p.classList.remove('text-white'); p.classList.add('text-gray-700'); }
            }
        }

        if (this.selectedWordId === id) {
            el.classList.remove('bg-blue-600','text-white', '!border-blue-600');
            const p = el.querySelector('p');
            if(p) { p.classList.remove('text-white'); p.classList.add('text-gray-700'); }
            this.selectedWordId = null;
            return;
        }

        el.classList.add('bg-blue-600','text-white', '!border-blue-600');
        const p = el.querySelector('p');
        if(p) { p.classList.remove('text-gray-700'); p.classList.add('text-white'); }
        
        this.selectedWordId = id;

        if (this.selectedCutId) {
            this.createPair(this.selectedCutId, this.selectedWordId);
            this.clearSelectionVisuals();
        }
    },

    clearSelectionVisuals() {
        if (this.selectedWordId) {
            const wordEl = document.getElementById(`word-${this.selectedWordId}`);
            if(wordEl) {
                wordEl.classList.remove('bg-blue-600','text-white', '!border-blue-600');
                const p = wordEl.querySelector('p');
                if(p) { p.classList.remove('text-white'); p.classList.add('text-gray-700'); }
            }
        }
        if (this.selectedCutId) {
            const cutEl = document.getElementById(`cut-${this.selectedCutId}`);
            if (cutEl) cutEl.classList.remove('bg-purple-600','text-white', '!border-purple-600');
        }
        this.selectedCutId = null;
        this.selectedWordId = null;
    },

    createPair(cutId, wordId) {
        if (this.pairs.find(p => p.cutId === cutId || p.wordId === wordId)) return;

        const lineId = `line-${cutId}-${wordId}`;
        this.pairs.push({ cutId, wordId, lineId, correct: null });

        this.drawAllLines();

        if (this.pairs.length === this.currentData.items.length) {
            const checkBtn = document.getElementById('check-btn');
            if (checkBtn) checkBtn.disabled = false;
        }
    },

    drawAllLines() {
        const svg = document.getElementById('match-svg');
        const matchArea = document.getElementById('match-area');
        if (!svg || !matchArea) return;

        // Xóa hết các đường cũ
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // Helper: tính điểm trên mép rect theo hướng từ (cx,cy) đi về (tx,ty)
        function edgePointOfRect(cx, cy, rect, tx, ty, padding = 6) {
            // rect: { left, top, width, height }
            const rx = rect.width / 2;
            const ry = rect.height / 2;
            // tâm rect
            const rcx = rect.left + rx;
            const rcy = rect.top + ry;

            // vector từ tâm rect tới target (tx,ty)
            let dx = tx - rcx;
            let dy = ty - rcy;

            // nếu vector gần bằng 0 (cùng tâm) -> trả về tâm
            if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
                return { x: rcx, y: rcy };
            }

            // t là hệ số scale để tới biên hộp chữ (rx,ry)
            // t = min( rx/|dx|, ry/|dy| )
            const txAbs = Math.abs(dx);
            const tyAbs = Math.abs(dy);
            let t;
            if (txAbs === 0) t = ry / tyAbs;
            else if (tyAbs === 0) t = rx / txAbs;
            else t = Math.min(rx / txAbs, ry / tyAbs);

            // điểm trên mép (trước padding)
            let ex = rcx + dx * t;
            let ey = rcy + dy * t;

            // lùi vào padding px theo hướng ngược lại của vector (để đường không chạm sát viền)
            const len = Math.sqrt(dx*dx + dy*dy);
            const pad = Math.min(padding, Math.max(2, Math.floor(Math.min(rect.width, rect.height) * 0.05)));
            ex -= (dx / len) * pad;
            ey -= (dy / len) * pad;

            return { x: ex, y: ey };
        }

        // Lấy bounding của svg parent để chuyển tọa độ viewport -> relative svg
        const parentRect = svg.getBoundingClientRect();

        this.pairs.forEach(p => {
            const cutEl = document.getElementById(`cut-${p.cutId}`);
            const wordEl = document.getElementById(`word-${p.wordId}`);
            if (!cutEl || !wordEl) return;

            const cRect = cutEl.getBoundingClientRect();
            const wRect = wordEl.getBoundingClientRect();

            // chuẩn hoá rect object
            const rectCut = { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height };
            const rectWord = { left: wRect.left, top: wRect.top, width: wRect.width, height: wRect.height };

            // Tính điểm target là tâm của đối phương (dùng để xác định hướng)
            const wordCenterX = rectWord.left + rectWord.width / 2;
            const wordCenterY = rectWord.top + rectWord.height / 2;
            const cutCenterX = rectCut.left + rectCut.width / 2;
            const cutCenterY = rectCut.top + rectCut.height / 2;

            // Tính điểm trên mép (viewport coords)
            const startPt = edgePointOfRect(cutCenterX, cutCenterY, rectCut, wordCenterX, wordCenterY);
            const endPt = edgePointOfRect(wordCenterX, wordCenterY, rectWord, cutCenterX, cutCenterY);

            // Chuyển về toạ độ relative so với svg (parentRect)
            const x1 = startPt.x - parentRect.left;
            const y1 = startPt.y - parentRect.top;
            const x2 = endPt.x - parentRect.left;
            const y2 = endPt.y - parentRect.top;

            // Tạo đường thẳng
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("id", p.lineId);
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", "#cbd5e1"); // gray-300
            line.setAttribute("stroke-width", "6");
            line.setAttribute("stroke-linecap", "round");
            line.setAttribute("opacity", "0.95");
            line.style.pointerEvents = 'none';
            svg.appendChild(line);
        });
    },

    checkPairs() {
        if (!this.pairs || this.pairs.length === 0) return;
        const items = this.currentData.items;
        const matchArea = document.getElementById('match-area');
        if (!matchArea) return;
    
        const prevPos = window.getComputedStyle(matchArea).position;
        if (prevPos === 'static') matchArea.style.position = 'relative';
    
        // Tạo mảng snapshot để tránh removePair làm shift index trong loop
        const pairsSnapshot = this.pairs.slice();
        let correctCount = 0;
    
        // Xử lý từng cặp (vẫn cho animation riêng từng cặp)
        const processPromises = pairsSnapshot.map((p, index) => {
            return new Promise(resolve => {
                const cutEl = document.getElementById(`cut-${p.cutId}`);
                const wordEl = document.getElementById(`word-${p.wordId}`);
                const lineEl = document.getElementById(p.lineId);
    
                const isCorrect = (p.cutId === p.wordId);
                p.correct = isCorrect;
    
                if (isCorrect) {
                    correctCount++;
                    // animation hợp nhất giống cũ
                    if (lineEl) lineEl.remove();
    
                    const parentRect = matchArea.getBoundingClientRect();
                    const cRect = cutEl.getBoundingClientRect();
                    const wRect = wordEl.getBoundingClientRect();
    
                    const cloneCut = cutEl.cloneNode(true);
                    cloneCut.style.position = 'absolute';
                    cloneCut.style.left = (cRect.left - parentRect.left) + 'px';
                    cloneCut.style.top = (cRect.top - parentRect.top) + 'px';
                    cloneCut.style.width = cRect.width + 'px';
                    cloneCut.style.height = cRect.height + 'px';
                    cloneCut.style.margin = '0';
                    cloneCut.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
                    cloneCut.style.zIndex = '50';
                    cloneCut.style.backgroundColor = '#22c55e';
                    cloneCut.style.color = '#ffffff';
                    cloneCut.style.borderColor = '#22c55e';
    
                    matchArea.appendChild(cloneCut);
                    cutEl.style.visibility = 'hidden';
    
                    const destX = wRect.left - parentRect.left + (wRect.width - cRect.width)/2;
                    const destY = wRect.top - parentRect.top + (wRect.height - cRect.height)/2;
    
                    requestAnimationFrame(() => {
                        cloneCut.style.transform = `translate(${destX - (cRect.left - parentRect.left)}px, ${destY - (cRect.top - parentRect.top)}px) scale(0.5)`;
                        cloneCut.style.opacity = '0';
                    });
    
                    setTimeout(() => {
                        if (wordEl) {
                            wordEl.classList.remove('bg-white', 'border-blue-200');
                            wordEl.classList.add('bg-green-100', 'border-green-500', 'merged');
    
                            const engText = wordEl.querySelector('p:last-child');
                            if (engText) {
                                engText.innerText = this.getEnglishById(p.wordId);
                                engText.classList.add('text-green-700');
                                engText.classList.remove('text-gray-700');
                            }
                        }
                        cloneCut.remove();
                        resolve({ index, correct: true });
                    }, 600);
    
                } else {
                    // Sai: đổi màu, rung, đổi line
                    if (lineEl) {
                        lineEl.setAttribute('stroke', '#ef4444');
                        lineEl.setAttribute('stroke-dasharray', '8 4');
                        lineEl.setAttribute('stroke-width', '3');
                    }
    
                    if (cutEl) cutEl.classList.add('!border-red-500', 'bg-red-50');
                    if (wordEl) wordEl.classList.add('!border-red-500', 'bg-red-50');
    
                    if (typeof this.onWrong === 'function') this.onWrong();
    
                    setTimeout(() => {
                        if (lineEl) {
                            lineEl.style.transition = 'opacity 0.5s';
                            lineEl.style.opacity = '0';
                            setTimeout(() => lineEl.remove(), 500);
                        }
                        // Xóa cặp sai khỏi bộ nhớ để người dùng nối lại
                        // Lưu ý: removePair sẽ xóa line và splice mảng pairs
                        const realIndex = this.pairs.findIndex(pp => pp.lineId === p.lineId);
                        if (realIndex !== -1) this.removePair(realIndex);
    
                        if (cutEl) cutEl.classList.remove('!border-red-500', 'bg-red-50');
                        if (wordEl) wordEl.classList.remove('!border-red-500', 'bg-red-50');
    
                        resolve({ index, correct: false });
                    }, 1500);
                }
            });
        });
    
        // Sau khi tất cả cặp đã xử lý xong
        Promise.all(processPromises).then(results => {
            // disable nút check
            const checkBtn = document.getElementById('check-btn');
            if (checkBtn) checkBtn.disabled = true;
    
            // Gọi onCorrect một lần với tổng số đòn
            if (correctCount > 0 && typeof this.onCorrect === 'function') {
                // gọi onCorrect với số đòn hero tấn công
                this.onCorrect(correctCount);
            }
        });
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