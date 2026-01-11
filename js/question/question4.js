// js/question/question4.js

class Question4 {
    constructor(opts = {}) {
        this.vocabPool = opts.vocabPool || [];
        this.containerId = opts.containerId || 'questionarea';
        this.onCorrect = opts.onCorrect || null;
        this.onWrong = opts.onWrong || null;
        
        this.wordsToFind = [];
        this.foundWords = [];
        this.gridSize = 0;
        this.gridWidth = 0;  // Chiều rộng thực tế sau optimize
        this.gridHeight = 0; // Chiều cao thực tế sau optimize
        this.hintCount = 0;  // Số lần đã dùng hint
        this.maxHints = 5;   // Số lần hint tối đa
        this._destroyed = false;
        this._cellHandlers = [];
        this._mouseupHandler = null;
        this._lastAnswered = null;
    }

    init() {
        this._destroyed = false;
        this.foundWords = [];
        this.hintCount = 0;  // Reset hint count
        this._lastAnswered = null;

        this._selectWords();
        if (this.wordsToFind.length > 0) {
            this.renderQuestionUI();
        }
    }

    _selectWords() {
        if (!this.vocabPool || this.vocabPool.length === 0) return;
        
        // ✅ 1. CHUẨN HÓA VÀ LỌC DỮ LIỆU BAN ĐẦU
        let pool = this.vocabPool.map(w => ({
            en: (w.en || w.english || w.english_word || '').toUpperCase().trim(),
            vi: w.vi || w.vietnamese || w.vietnamese_translation || ''
        }))
        .filter(w => w.en.length > 0 && !w.en.includes(' ')); // Bỏ từ rỗng và từ ghép
    
        if (pool.length === 0) return;
    
        // ✅ 2. TÌM TỪ TRỤC (PIVOT) - Tối đa 8 chữ cái
        // Lọc những từ có độ dài từ 3 đến 8
        let pivotCandidates = pool.filter(w => w.en.length >= 4 && w.en.length <= 8);
        
        // Nếu không có từ nào <= 8, lấy đại từ ngắn nhất trong pool để làm trục
        if (pivotCandidates.length === 0) {
            pivotCandidates = [...pool].sort((a, b) => a.en.length - b.en.length);
        } else {
            // Trộn ngẫu nhiên danh sách ứng viên từ trục
            pivotCandidates.sort(() => Math.random() - 0.5);
        }
        
        const pivotWord = pivotCandidates[0];
    
        // ✅ 3. TÌM 4 TỪ CÒN LẠI - Tối đa 5 chữ cái
        // Lọc danh sách còn lại (loại bỏ từ đã chọn làm trục)
        let smallCandidates = pool.filter(w => 
            w.en !== pivotWord.en && 
            w.en.length <= 5 && 
            w.en.length >= 3
        );
    
        // Nếu không đủ 4 từ <= 5 chữ, lấy thêm từ pool chính (loại bỏ từ trục)
        if (smallCandidates.length < 4) {
            let fallbackPool = pool.filter(w => w.en !== pivotWord.en);
            fallbackPool.sort((a, b) => a.en.length - b.en.length); // Lấy các từ ngắn nhất có thể
            smallCandidates = fallbackPool.slice(0, 4);
        } else {
            // Trộn ngẫu nhiên để mỗi ván mỗi khác
            smallCandidates.sort(() => Math.random() - 0.5);
        }
    
        const selectedSmall = smallCandidates.slice(0, 4);
    
        // ✅ 4. GÁN DỮ LIỆU VÀO ĐỐI TƯỢNG
        this.wordsToFind = [pivotWord, ...selectedSmall].map(w => ({
            en: w.en,
            vi: w.vi,
            found: false,
            hinted: false
        }));
    }

    _generateGrid() {
        if (!this.wordsToFind || this.wordsToFind.length === 0) return [[]];
        
        const words = this.wordsToFind;
        const placedPositions = []; // Mảng chứa các object {char, r, c}
    
        // 1. Đặt từ dài nhất nằm ngang ở dòng 0, bắt đầu từ cột 0
        const pivot = words[0].en;
        this._recordPlacement(words[0], 0, 0, true, placedPositions);
    
        // 2. Xếp các từ còn lại
        for (let i = 1; i < words.length; i++) {
            const word = words[i].en;
            let placed = false;
    
            // Thử đan xen DỌC vào các vị trí đã có trên Grid
            for (let charIdx = 0; charIdx < word.length; charIdx++) {
                const char = word[charIdx];
                const matches = placedPositions.filter(p => p.char === char);
                
                for (let m of matches) {
                    const startR = m.r - charIdx;
                    const startC = m.c;
                    
                    if (this._canPlaceGreedy(word, startR, startC, false, placedPositions)) {
                        this._recordPlacement(words[i], startR, startC, false, placedPositions);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
    
            // 3. Nếu không đan xen được, xếp thành 1 cột dọc riêng (Cách từ cuối cùng 2 cột)
            if (!placed) {
                const currentCols = placedPositions.map(p => p.c);
                const maxC = Math.max(...currentCols, 0);
                this._recordPlacement(words[i], 0, maxC + 2, false, placedPositions);
            }
        }
    
        return this._finalizeGrid(placedPositions);
    }
    
    // Hàm kiểm tra vị trí trống
    _canPlaceGreedy(word, r, c, isHorizontal, placed) {
        for (let i = 0; i < word.length; i++) {
            const curR = isHorizontal ? r : r + i;
            const curC = isHorizontal ? c + i : c;
            const existing = placed.find(p => p.r === curR && p.c === curC);
            if (existing && existing.char !== word[i]) return false;
        }
        return true;
    }
    
    // Hàm ghi lại vị trí
    _recordPlacement(wordObj, r, c, isHorizontal, placed) {
        wordObj.firstCharPos = { row: r, col: c };
        wordObj.isHorizontal = isHorizontal;
        const word = wordObj.en;
        
        for (let i = 0; i < word.length; i++) {
            const curR = isHorizontal ? r : r + i;
            const curC = isHorizontal ? c + i : c;
            // Chỉ thêm nếu ô đó chưa có chữ (tránh trùng lặp trong mảng đặt)
            if (!placed.find(p => p.r === curR && p.c === curC)) {
                placed.push({ char: word[i], r: curR, c: curC });
            }
        }
    }

    _findBestGreedySpot(word, placedPositions) {
        let bestSpot = null;
        let maxOverlap = -1;
    
        // Thử mọi vị trí có thể đan xen với các chữ cái đã đặt
        placedPositions.forEach(pos => {
            const charIndexInNewWord = word.indexOf(pos.char);
            if (charIndexInNewWord !== -1) {
                // Thử cả 2 hướng: Ngang và Dọc
                [true, false].forEach(isHorizontal => {
                    const startR = isHorizontal ? pos.r : pos.r - charIndexInNewWord;
                    const startC = isHorizontal ? pos.c - charIndexInNewWord : pos.c;
    
                    const overlapScore = this._calculateScore(word, startR, startC, isHorizontal, placedPositions);
                    if (overlapScore > maxOverlap) {
                        maxOverlap = overlapScore;
                        bestSpot = { r: startR, c: startC, isHorizontal };
                    }
                });
            }
        });
    
        // Nếu không tìm được chỗ đan xen, đặt đại vào cạnh một từ nào đó (Score = 0)
        if (!bestSpot) {
            const lastPos = placedPositions[placedPositions.length - 1];
            bestSpot = { r: lastPos.r + 2, c: lastPos.c, isHorizontal: true };
        }
    
        return bestSpot;
    }
    
    _calculateScore(word, r, c, isHorizontal, placedPositions) {
        let score = 0;
        for (let i = 0; i < word.length; i++) {
            const curR = isHorizontal ? r : r + i;
            const curC = isHorizontal ? c + i : c;
    
            const existing = placedPositions.find(p => p.r === curR && p.c === curC);
            if (existing) {
                if (existing.char === word[i]) {
                    score++; // Cộng điểm nếu trùng chữ cái (đan xen tốt)
                } else {
                    return -1; // Không thể đặt vì bị xung đột chữ cái
                }
            }
        }
        return score;
    }

    _finalizeGrid(placedPositions) {
        const rows = placedPositions.map(p => p.r);
        const cols = placedPositions.map(p => p.c);
        const minR = Math.min(...rows), maxR = Math.max(...rows);
        const minC = Math.min(...cols), maxC = Math.max(...cols);
    
        const height = maxR - minR + 1;
        const width = maxC - minC + 1;
        this.gridWidth = width;
        this.gridHeight = height;
    
        const grid = Array.from({ length: height }, () => Array(width).fill(''));
    
        placedPositions.forEach(p => {
            grid[p.r - minR][p.c - minC] = p.char;
        });
    
        // Cập nhật tọa độ Hint
        this.wordsToFind.forEach(w => {
            if (w.firstCharPos) {
                w.firstCharPos.row -= minR;
                w.firstCharPos.col -= minC;
            }
        });
    
        // Điền chữ ngẫu nhiên vào ô trống
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (grid[r][c] === '') {
                    grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                }
            }
        }
        return grid;
    }
    /**
     * ✅ HÀM MỚI: Thu gọn grid bằng cách loại bỏ dòng/cột trống
     */
    _trimGrid(grid, placedPositions) {
        if (!placedPositions.length) return grid;

        // Tìm bounding box của các từ đã đặt
        let minRow = Infinity, maxRow = -Infinity;
        let minCol = Infinity, maxCol = -Infinity;

        placedPositions.forEach(({ row, col }) => {
            minRow = Math.min(minRow, row);
            maxRow = Math.max(maxRow, row);
            minCol = Math.min(minCol, col);
            maxCol = Math.max(maxCol, col);
        });

        // Thêm padding 1 ô xung quanh (tùy chọn)
        const padding = 0;
        minRow = Math.max(0, minRow - padding);
        maxRow = Math.min(grid.length - 1, maxRow + padding);
        minCol = Math.max(0, minCol - padding);
        maxCol = Math.min(grid[0].length - 1, maxCol + padding);

        // Cắt grid theo bounding box
        const trimmedGrid = [];
        for (let r = minRow; r <= maxRow; r++) {
            const row = [];
            for (let c = minCol; c <= maxCol; c++) {
                row.push(grid[r][c]);
            }
            trimmedGrid.push(row);
        }

        // Cập nhật kích thước thực tế
        this.gridHeight = trimmedGrid.length;
        this.gridWidth = trimmedGrid[0]?.length || 0;
        this.wordsToFind.forEach(w => {
            if (w.firstCharPos) {
                w.firstCharPos.row -= minRow;
                w.firstCharPos.col -= minCol;
            }
        });
        return trimmedGrid;
    }

    _canPlace(grid, word, row, col, isHorizontal) {
        for (let i = 0; i < word.length; i++) {
            const r = isHorizontal ? row : row + i;
            const c = isHorizontal ? col + i : col;
            // Cho phép đan xen nếu ký tự tại đó trùng nhau, ngược lại ô phải trống
            if (grid[r][c] !== null && grid[r][c] !== word[i]) return false;
        }
        return true;
    }

    renderQuestionUI() {
        const area = document.getElementById(this.containerId);
        if (!area || this._destroyed) return;
    
        // 1. Tạo Grid dữ liệu
        const grid = this._generateGrid();
        area.innerHTML = "";
    
        // 2. Tạo Wrapper chính (Flexbox để chứa Grid bên trái và Danh sách bên phải)
        const wrapper = document.createElement('div');
        wrapper.className = "relative flex flex-row items-start justify-center gap-[2cm] p-6 w-full h-full bg-slate-900/80 rounded-3xl border-4 border-slate-700 shadow-2xl overflow-hidden animate-fadeIn";
    
        // Gắn nhãn loại câu hỏi và nút Hint (như đã thống nhất ở các bước trước)
        wrapper.innerHTML = `
            <div class="absolute top-0 left-0 bg-blue-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold uppercase tracking-tighter z-10">
                Type 4: Word Search
            </div>
            <button id="hint-btn" class="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-yellow-400 rounded-full flex items-center justify-center text-xl shadow hover:scale-110 active:scale-95 transition-transform z-20">
                💡
            </button>
        `;
    
        // --- KHỐI TRÁI: GRID CHỮ CÁI ---
        const gridContainer = document.createElement('div');
        gridContainer.className = "grid gap-1 p-2 bg-slate-800 rounded-xl border border-slate-700 shadow-inner";
        gridContainer.style.gridTemplateColumns = `repeat(${this.gridWidth}, minmax(35px, 1fr))`;
    
        grid.forEach((row, r) => {
            row.forEach((char, c) => {
                const cell = document.createElement('div');
                cell.className = "word-cell w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-slate-700 text-white font-black rounded-xl cursor-pointer select-none hover:bg-slate-600 transition-all text-2xl shadow-md border border-slate-600/50";                cell.innerText = char;
                cell.dataset.row = r;
                cell.dataset.col = c;
                gridContainer.appendChild(cell);
            });
        });
    
        // --- KHỐI PHẢI: DANH SÁCH TỪ VỰNG (HIỆN LUÔN HINT ??) ---
        const wordList = document.createElement('div');
        // self-stretch để cao bằng khối grid, không tự co lại
        wordList.className = "flex-none w-64 self-stretch flex flex-col gap-2 p-4 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-y-auto custom-scrollbar";
        
        this.wordsToFind.forEach(wordObj => {
            const item = document.createElement('div');
            item.id = `word-item-${wordObj.en}`;
            item.className = "flex flex-col p-3 bg-slate-700/80 rounded-xl border border-slate-600 transition-all shadow-sm";
            
            // Logic ẩn 1 hoặc 2 ký tự cuối
            const word = wordObj.en;
            const charsToHide = word.length > 4 ? 2 : 1;
            const visiblePart = word.substring(0, word.length - charsToHide);
            const hiddenText = visiblePart + "?".repeat(charsToHide);
    
            item.innerHTML = `
                <div class="text-[10px] text-blue-300 uppercase font-black tracking-widest mb-1 opacity-70">
                    ${wordObj.vi}
                </div>
                <div id="hint-${wordObj.en}" class="text-base text-yellow-400 font-mono font-bold tracking-[0.2em]">
                    ${hiddenText}
                </div>
            `;
            wordList.appendChild(item);
        });
    
        // Gom tất cả vào giao diện chính
        wrapper.appendChild(gridContainer);
        wrapper.appendChild(wordList);
        area.appendChild(wrapper);
    
        // 3. Khởi tạo các sự kiện tương tác
        this._attachEventListeners();
        this._attachHintHandler();
    }s

    _attachEventListeners() {
        let isSelecting = false;
        let selectedCells = [];
        this._cellHandlers = [];

        const cells = document.querySelectorAll('.word-cell');
        cells.forEach(cell => {
            const mousedown = (e) => {
                isSelecting = true;
                selectedCells = [cell];
                cell.classList.add("!bg-yellow-400");
            };
            const mouseover = () => {
                if (isSelecting && !selectedCells.includes(cell)) {
                    selectedCells.push(cell);
                    cell.classList.add("!bg-yellow-400");
                }
            };

            cell.addEventListener('mousedown', mousedown);
            cell.addEventListener('mouseover', mouseover);
            this._cellHandlers.push({ el: cell, mousedown, mouseover });
        });

        this._mouseupHandler = () => {
            if (!isSelecting) return;
            isSelecting = false;

            const selectedText = selectedCells.map(c => c.innerText).join('');
            const wordObj = this.wordsToFind.find(w => w.en === selectedText && !w.found);

            if (wordObj) {
                wordObj.found = true;
                this.foundWords.push(wordObj);
                this.speakWord(wordObj.en);
                const hintEl = document.getElementById(`hint-${wordObj.en}`);
                if (hintEl) {
                    hintEl.textContent = wordObj.en;
                    hintEl.classList.remove('text-yellow-500');
                    hintEl.classList.add('text-green-400', 'font-bold');
                }
                selectedCells.forEach(c => {
                    c.classList.remove("!bg-yellow-400");
                    c.classList.add("!bg-green-500", "!text-white");
                });

                const label = document.getElementById(`word-${wordObj.en}`);
                if (label) {
                    label.classList.replace("bg-slate-800", "bg-green-600");
                    label.classList.replace("border-slate-600", "border-green-400");
                    if (!label.innerHTML.includes('✔')) label.innerHTML += ' ✔';
                }

                this._lastAnswered = { en: wordObj.en, vi: wordObj.vi };
                
                const isFinal = this.foundWords.length === this.wordsToFind.length;
                if (typeof this.onCorrect === 'function') this.onCorrect(1, isFinal);
            } else {
                selectedCells.forEach(c => c.classList.remove("!bg-yellow-400"));
                if (typeof this.onWrong === 'function') this.onWrong();
            }
            selectedCells = [];
        };

        document.addEventListener('mouseup', this._mouseupHandler);
    }

    /**
     * Xử lý nút Hint
     */
    _attachHintHandler() {
        const hintBtn = document.getElementById('hint-btn');
        if (!hintBtn) return;

        hintBtn.onclick = () => {
            // 1. Trừ HP Hero
            if (window.GameEngine?.player) {
                const damage = 5;
                window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - damage);
                window.GameEngine.updateAllUI();
                if (typeof window.GameEngine.showDamage === 'function') {
                    window.GameEngine.showDamage(window.GameEngine.player, damage);
                }
            }

            // 2. Tìm từ chưa giải xong đầu tiên
            const unsolvedWord = this.wordsToFind.find(w => !w.found);
            if (!unsolvedWord) return;

            // 3. CHỈ LÀM SÁNG CHỮ CÁI ĐẦU TRÊN GRID
            if (unsolvedWord.firstCharPos) {
                const { row, col } = unsolvedWord.firstCharPos;
                const cell = document.querySelector(`.word-cell[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add("!bg-yellow-400", "animate-bounce", "ring-4", "ring-yellow-300", "z-20");
                    
                    setTimeout(() => {
                        cell.classList.remove("animate-bounce", "ring-4", "ring-yellow-300", "z-20");
                        if (!unsolvedWord.found) {
                            cell.classList.remove("!bg-yellow-400");
                        }
                    }, 2000);
                }
            }
        };
    }

    speakWord(text) {
        if (!text || !window.speechSynthesis || this._destroyed) return;
        
        // Hủy các yêu cầu đọc cũ để tránh chồng chéo
        window.speechSynthesis.cancel();
        
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.9;
        
        // Tìm giọng đọc tiếng Anh
        const voices = window.speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.includes('en'));
        if (targetVoice) u.voice = targetVoice;
        
        window.speechSynthesis.speak(u);
    }

    destroy() {
        this._destroyed = true;
        if (this._cellHandlers) {
            this._cellHandlers.forEach(h => {
                h.el.removeEventListener('mousedown', h.mousedown);
                h.el.removeEventListener('mouseover', h.mouseover);
            });
        }
        if (this._mouseupHandler) document.removeEventListener('mouseup', this._mouseupHandler);
        const area = document.getElementById(this.containerId);
        if (area) area.innerHTML = "";
    }
}

export default Question4;