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
        this._destroyed = false;
        this._cellHandlers = [];
        this._mouseupHandler = null;
        this._lastAnswered = null;
    }

    init() {
        this._destroyed = false;
        this.foundWords = [];
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
        // Kích thước lưới vừa đủ để đan xen (thường lớn hơn từ dài nhất 1-2 đơn vị)
        this.gridSize = Math.max(maxLen, 8); 
    }

    _generateGrid(words) {
        const size = this.gridSize;
        let grid = Array.from({ length: size }, () => Array(size).fill(null));

        // Sắp xếp từ dài nhất để đặt trước
        const sortedWords = [...words].sort((a, b) => b.en.length - a.en.length);

        sortedWords.forEach(wordObj => {
            const word = wordObj.en;
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 200) {
                const isHorizontal = Math.random() > 0.5;
                const row = Math.floor(Math.random() * (isHorizontal ? size : size - word.length + 1));
                const col = Math.floor(Math.random() * (isHorizontal ? size - word.length + 1 : size));

                if (this._canPlace(grid, word, row, col, isHorizontal)) {
                    for (let i = 0; i < word.length; i++) {
                        const r = isHorizontal ? row : row + i;
                        const c = isHorizontal ? col + i : col;
                        grid[r][c] = word[i];
                    }
                    placed = true;
                }
                attempts++;
            }
        });

        // Lấp đầy ô trống
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (!grid[r][c]) {
                    grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                }
            }
        }
        return grid;
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
            <div class="w-full h-full flex flex-col items-center p-6 bg-slate-900 rounded-3xl overflow-hidden">
                <div class="flex flex-col lg:flex-row gap-10 items-start justify-center w-full">
                    
                    <div id="word-grid" class="grid gap-1.5 bg-slate-800 p-3 rounded-2xl shadow-2xl select-none" 
                         style="grid-template-columns: repeat(${this.gridSize}, minmax(0, 1fr)); width: fit-content;">
                        ${grid.map((row, r) => row.map((char, c) => `
                            <div class="word-cell w-12 h-12 flex items-center justify-center bg-white text-slate-900 font-black text-2xl rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors shadow-inner"
                                 data-row="${r}" data-col="${c}">${char}</div>
                        `).join('')).join('')}
                    </div>

                    <div class="flex flex-col gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700" style="width: fit-content; min-width: 180px;">
                        <h3 class="text-blue-400 font-black text-sm tracking-widest uppercase">Targets (5)</h3>
                        <div id="word-list" class="flex flex-col gap-2">
                            ${this.wordsToFind.map(w => `
                                <div id="word-${w.en}" class="px-4 py-2 bg-slate-800 text-white rounded-xl border-l-4 border-slate-600 whitespace-nowrap">
                                    <span class="text-lg font-bold">${w.vi}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                </div>
            </div>
        `;

        this._attachEventListeners();
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

            // Tìm đến hàm _attachEventListeners và thay thế đoạn xử lý trúng từ (wordObj)
            if (wordObj) {
                wordObj.found = true;
                this.foundWords.push(wordObj);
                
                selectedCells.forEach(c => {
                    // Xóa màu vàng khi đang chọn
                    c.classList.remove("!bg-yellow-400");
                    // Thêm màu xanh để đánh dấu đã tìm thấy
                    // KHÔNG dùng pointerEvents = "none" để từ khác vẫn có thể dùng chung ô này
                    c.classList.add("!bg-green-500", "!text-white");
                });

                const label = document.getElementById(`word-${wordObj.en}`);
                if (label) {
                    label.classList.replace("bg-slate-800", "bg-green-600");
                    label.classList.replace("border-slate-600", "border-green-400");
                    // Thêm icon tích cho trực quan
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