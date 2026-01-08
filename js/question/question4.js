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
        if (!this.vocabPool.length) return;
        let pool = [...this.vocabPool];
        const selected = [];
        const targetCount = 5;

        for (let i = 0; i < targetCount && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            selected.push(pool.splice(idx, 1)[0]);
        }

        this.wordsToFind = selected.map(item => ({
            en: item.english_word.toUpperCase().replace(/\s+/g, ''),
            vi: item.vietnamese_translation,
            found: false
        }));

        const maxLen = Math.max(...this.wordsToFind.map(w => w.en.length));
        // Tạo grid lớn hơn một chút để dễ đặt từ
        this.gridSize = Math.max(maxLen + 1, 8); 
    }

    _generateGrid(words) {
        const size = this.gridSize;
        let grid = Array.from({ length: size }, () => Array(size).fill(null));
        const placedPositions = []; // Lưu vị trí các từ đã đặt

        // Sắp xếp từ dài nhất để đặt trước
        const sortedWords = [...words].sort((a, b) => b.en.length - a.en.length);

        sortedWords.forEach(wordObj => {
            const word = wordObj.en;
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 300) {
                const isHorizontal = Math.random() > 0.5;
                const row = Math.floor(Math.random() * (isHorizontal ? size : size - word.length + 1));
                const col = Math.floor(Math.random() * (isHorizontal ? size - word.length + 1 : size));

                if (this._canPlace(grid, word, row, col, isHorizontal)) {
                    // Đặt từ và lưu vị trí
                    for (let i = 0; i < word.length; i++) {
                        const r = isHorizontal ? row : row + i;
                        const c = isHorizontal ? col + i : col;
                        grid[r][c] = word[i];
                        placedPositions.push({ row: r, col: c });
                    }
                    placed = true;
                }
                attempts++;
            }
        });

        // ✅ TỐI ƯU: Thu gọn grid về kích thước nhỏ nhất
        const optimizedGrid = this._trimGrid(grid, placedPositions);
        
        // Lấp đầy ô trống với chữ random
        for (let r = 0; r < optimizedGrid.length; r++) {
            for (let c = 0; c < optimizedGrid[r].length; c++) {
                if (!optimizedGrid[r][c]) {
                    optimizedGrid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                }
            }
        }
        
        return optimizedGrid;
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
        if (!area) return;

        const grid = this._generateGrid(this.wordsToFind);

        area.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl relative overflow-hidden">
        <div class="absolute top-0 left-0 bg-purple-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow">
                    Question Type 4 : Find words
                </div>
                <div class="flex flex-col lg:flex-row gap-10 items-start justify-center w-full">
                    
                    <div id="word-grid" class="grid gap-1.5 bg-slate-800 p-3 rounded-2xl shadow-2xl select-none" 
                         style="grid-template-columns: repeat(${this.gridWidth}, minmax(0, 1fr)); width: fit-content;">
                        ${grid.map((row, r) => row.map((char, c) => `
                            <div class="word-cell w-12 h-12 flex items-center justify-center bg-white text-slate-900 font-black text-2xl rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors shadow-inner"
                                 data-row="${r}" data-col="${c}">${char}</div>
                        `).join('')).join('')}
                    </div>

                    <div class="flex flex-col gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700 relative" style="width: fit-content; min-width: 180px;">
                        <!-- Nút Hint ở góc trên phải -->
                        <button id="hint-btn" class="absolute top-2 right-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-lg text-sm transition-all shadow-lg flex items-center gap-1">
                            💡 Hint (<span id="hint-counter">${this.hintCount}</span>/${this.maxHints})
                        </button>
                        
                        <h3 class="text-blue-400 font-black text-sm tracking-widest uppercase mt-8">Targets (${this.wordsToFind.length})</h3>
                        <div id="word-list" class="flex flex-col gap-2">
                            ${this.wordsToFind.map(w => `
                                <div id="word-${w.en}" class="px-4 py-2 bg-slate-800 text-white rounded-xl border-l-4 border-slate-600 whitespace-nowrap">
                                    <span class="text-lg font-bold">${w.vi}</span>
                                    <span id="hint-${w.en}" class="ml-2 text-yellow-300 font-mono text-sm"></span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                </div>
                
                <div class="mt-4 text-slate-400 text-sm">
                    Grid size: ${this.gridWidth}×${this.gridHeight} (optimized from ${this.gridSize}×${this.gridSize})
                </div>
            </div>
        `;

        this._attachEventListeners();
        this._attachHintHandler();
    }

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
            // Kiểm tra đã hết lượt hint chưa
            if (this.hintCount >= this.maxHints) {
                if (typeof showToast === 'function') {
                    showToast("⚠️ Bạn đã dùng hết Hint!");
                } else {
                    alert("Bạn đã dùng hết Hint!");
                }
                return;
            }

            // Tìm từ chưa được tìm thấy và chưa có hint
            const unsolvedWord = this.wordsToFind.find(w => !w.found && !w.hinted);
            
            if (!unsolvedWord) {
                if (typeof showToast === 'function') {
                    showToast("✅ Không còn từ nào cần hint!");
                } else {
                    alert("Không còn từ nào cần hint!");
                }
                return;
            }

            // Tạo hint: giữ lại tất cả trừ 2 chữ cuối
            const word = unsolvedWord.en;
            let hintText = '';
            
            if (word.length <= 2) {
                // Nếu từ quá ngắn (<=2 chữ), hiển thị 1 chữ đầu + ?
                hintText = word[0] + '?';
            } else {
                // Từ dài hơn: giữ (n-2) chữ đầu + ??
                hintText = word.slice(0, -2) + '??';
            }

            // Hiển thị hint
            const hintEl = document.getElementById(`hint-${word}`);
            if (hintEl) {
                hintEl.textContent = `(${hintText})`;
            }

            // Đánh dấu từ đã được hint
            unsolvedWord.hinted = true;

            // Tăng bộ đếm
            this.hintCount++;
            const counterEl = document.getElementById('hint-counter');
            if (counterEl) counterEl.textContent = this.hintCount;

            // Thông báo
            if (typeof showToast === 'function') {
                showToast(`💡 Hint: ${unsolvedWord.vi} = ${hintText}`);
            }

            // Disable nút nếu hết lượt
            if (this.hintCount >= this.maxHints) {
                hintBtn.disabled = true;
                hintBtn.classList.add('opacity-50', 'cursor-not-allowed');
                hintBtn.classList.remove('hover:bg-yellow-500');
            }
        };
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