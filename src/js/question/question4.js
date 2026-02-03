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
        
        let pool = this.vocabPool.map(w => ({
            en: (w.en || w.english || w.english_word || '').toUpperCase().trim(),
            vi: w.vi || w.vietnamese || w.vietnamese_translation || ''
        }))
        .filter(w => w.en.length > 0 && !w.en.includes(' ') && w.en.length >= 3);
    
        if (pool.length < 5) {
            console.warn('Không đủ từ vựng để chơi (cần ít nhất 5 từ)');
            return;
        }
    
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const selectedWords = shuffled.slice(0, 5);
    
        selectedWords.sort((a, b) => b.en.length - a.en.length);
    
        this.wordsToFind = selectedWords.map(w => ({
            en: w.en,
            vi: w.vi,
            found: false,
            hinted: false
        }));
    
        // ✅ DEBUG
        console.log('=== DEBUG _selectWords ===');
        console.log('Số từ chọn được:', this.wordsToFind.length);
        this.wordsToFind.forEach((w, i) => {
            console.log(`Từ ${i}:`, w.en, `(${w.en ? w.en.length : 'undefined'} chữ)`, w);
        });
        console.log('========================');
    }

    _generateGrid() {
        // ✅ KIỂM TRA DỮ LIỆU ĐẦU VÀO
        if (!this.wordsToFind || this.wordsToFind.length === 0) {
            console.error('Không có từ nào để tạo grid');
            return [[]];
        }
        
        const words = this.wordsToFind;
        
        // Kiểm tra từ đầu tiên
        if (!words[0] || !words[0].en || words[0].en.length === 0) {
            console.error('Từ đầu tiên không hợp lệ:', words[0]);
            return [[]];
        }
        
        // ✅ TỪ DÀI NHẤT LUÔN NẰM NGANG
        const longestWord = words[0].en;
        
        console.log('Từ dài nhất:', longestWord, 'Độ dài:', longestWord.length);
        
        // ✅ PHÂN LOẠI TỪ
        const horizontalWords = []; // Từ nằm ngang
        const verticalWords = [];   // Từ nằm dọc
        
        words.forEach((wordObj, index) => {
            // Kiểm tra wordObj hợp lệ
            if (!wordObj || !wordObj.en) {
                console.warn('Từ không hợp lệ tại index', index, wordObj);
                return;
            }
            
            if (index === 0) {
                // Từ đầu tiên (dài nhất) luôn nằm ngang
                horizontalWords.push({ ...wordObj, originalIndex: index });
            } else if (wordObj.en.length >= 8) {
                // Các từ khác >= 8 chữ cũng nằm ngang
                horizontalWords.push({ ...wordObj, originalIndex: index });
            } else {
                // Từ < 8 chữ nằm dọc
                verticalWords.push({ ...wordObj, originalIndex: index });
            }
        });
        
        // ✅ KÍCH THƯỚC GRID CỐ ĐỊNH
        const gridWidth = Math.max(longestWord.length + 1, 5); // Tối thiểu 5 cột
        const gridHeight = 8; // CỐ ĐỊNH 8 HÀNG
        
        console.log(`Khởi tạo Grid: ${gridWidth}x${gridHeight}`);
        
        // ✅ TẠO GRID RỖNG - KIỂM TRA KỸ
        const grid = [];
        for (let r = 0; r < gridHeight; r++) {
            const row = [];
            for (let c = 0; c < gridWidth; c++) {
                row.push('');
            }
            grid.push(row);
        }
        
        // Kiểm tra grid đã tạo đúng chưa
        if (!grid || grid.length === 0 || !grid[0] || grid[0].length === 0) {
            console.error('Grid không được tạo đúng!', grid);
            return [[]];
        }
        
        console.log(`Grid đã tạo: ${grid[0].length}x${grid.length}`, 
                    `Ngang: ${horizontalWords.length}, Dọc: ${verticalWords.length}`);
        
        // ✅ 1. ĐẶT CÁC TỪ NGANG
        let currentRow = 0;
        horizontalWords.forEach(wordObj => {
            const word = wordObj.en;
            
            // Đặt từ ngang tại hàng currentRow
            if (currentRow < gridHeight) {
                for (let i = 0; i < word.length && i < gridWidth; i++) {
                    grid[currentRow][i] = word[i];
                }
                
                words[wordObj.originalIndex].firstCharPos = { row: currentRow, col: 0 };
                words[wordObj.originalIndex].isHorizontal = true;
                
                currentRow += 2; // Cách 1 hàng
            }
        });
        
        // ✅ 2. ĐẶT CÁC TỪ DỌC - Cố gắng đan vào từ ngang
        verticalWords.forEach(wordObj => {
            const word = wordObj.en;
            let placed = false;
            
            // Thử đan vào các chữ cái đã có trên grid
            for (let charIdx = 0; charIdx < word.length && !placed; charIdx++) {
                const char = word[charIdx];
                
                // Tìm tất cả vị trí có ký tự này trên grid
                for (let r = 0; r < gridHeight && !placed; r++) {
                    for (let c = 0; c < gridWidth && !placed; c++) {
                        if (grid[r][c] === char) {
                            // Thử đặt từ dọc sao cho ký tự thứ charIdx trùng với vị trí (r,c)
                            const startRow = r - charIdx;
                            const startCol = c;
                            
                            // Kiểm tra có thể đặt không
                            if (this._canPlaceInGrid(word, startRow, startCol, false, grid)) {
                                this._placeWordInGrid(words[wordObj.originalIndex], word, startRow, startCol, false, grid);
                                placed = true;
                            }
                        }
                    }
                }
            }
            
            // Nếu không đan được, đặt ở cột trống
            if (!placed) {
                // Tìm cột có ít chữ nhất
                let bestCol = 0;
                let minChars = gridHeight;
                
                for (let c = 0; c < gridWidth; c++) {
                    let charCount = 0;
                    for (let r = 0; r < gridHeight; r++) {
                        if (grid[r][c] !== '') charCount++;
                    }
                    if (charCount < minChars) {
                        minChars = charCount;
                        bestCol = c;
                    }
                }
                
                // Đặt từ dọc ở cột này
                const startRow = 0;
                for (let i = 0; i < word.length && startRow + i < gridHeight; i++) {
                    if (grid[startRow + i][bestCol] === '') {
                        grid[startRow + i][bestCol] = word[i];
                    }
                }
                
                words[wordObj.originalIndex].firstCharPos = { row: startRow, col: bestCol };
                words[wordObj.originalIndex].isHorizontal = false;
            }
        });
        
        // ✅ 3. ĐIỀN CHỮ NGẪU NHIÊN
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < gridHeight; r++) {
            for (let c = 0; c < gridWidth; c++) {
                if (grid[r][c] === '') {
                    grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
                }
            }
        }
        
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        
        console.log('Grid hoàn thành:', gridWidth, 'x', gridHeight);
        
        return grid;
    }
    
    // Kiểm tra có thể đặt từ trong grid không (không vượt quá biên)
    _canPlaceInGrid(word, r, c, isHorizontal, grid) {
        // ✅ KIỂM TRA GRID HỢP LỆ
        if (!grid || grid.length === 0 || !grid[0]) {
            console.error('Grid không hợp lệ trong _canPlaceInGrid');
            return false;
        }
        
        const gridHeight = grid.length;
        const gridWidth = grid[0].length;
        
        for (let i = 0; i < word.length; i++) {
            const curR = isHorizontal ? r : r + i;
            const curC = isHorizontal ? c + i : c;
            
            // Vượt biên
            if (curR < 0 || curR >= gridHeight || curC < 0 || curC >= gridWidth) {
                return false;
            }
            
            // Ô đã có chữ khác
            const existing = grid[curR][curC];
            if (existing !== '' && existing !== word[i]) {
                return false;
            }
        }
        return true;
    }

    // Đặt từ vào grid
    _placeWordInGrid(wordObj, word, r, c, isHorizontal, grid) {
        wordObj.firstCharPos = { row: r, col: c };
        wordObj.isHorizontal = isHorizontal;
        
        for (let i = 0; i < word.length; i++) {
            const curR = isHorizontal ? r : r + i;
            const curC = isHorizontal ? c + i : c;
            grid[curR][curC] = word[i];
        }
    }

    renderQuestionUI() {
        const area = document.getElementById(this.containerId);
        if (!area) return;
        area.innerHTML = "";

        // 1. Tạo grid
        const grid = this._generateGrid();

        // 2. Xây dựng giao diện
        const wrapper = document.createElement('div');
        wrapper.className =
            'w-full max-w-7xl mx-auto bg-slate-800 rounded-3xl p-6 ' +
            'flex flex-col relative overflow-hidden';

        wrapper.innerHTML = `
            <!-- Badge loại câu hỏi -->
            <div class="absolute top-0 left-0 bg-blue-600 text-white px-3 py-1 
                        rounded-br-2xl text-xs font-bold shadow z-10">
                Type 4: Word Search
            </div>

            <!-- Hint button -->
            <button id="hint-btn"
                class="absolute top-4 right-4 w-10 h-10 bg-white 
                    border-2 border-yellow-400 rounded-full 
                    flex items-center justify-center text-xl 
                    shadow hover:bg-yellow-50 active:scale-95 
                    transition-transform z-20">
                💡
            </button>

            <!-- Mô tả -->
            <div class="text-white/60 text-center text-sm font-bold 
                        uppercase tracking-widest mb-4">
                Tìm các từ trong bảng chữ cái
            </div>
        `;
        
        // --- KHỐI TRÁI: GRID CHỮ CÁI ---
        const gridContainer = document.createElement('div');
        gridContainer.className = "grid gap-1 p-2 bg-slate-800 rounded-xl border border-slate-700 shadow-inner";
        gridContainer.style.gridTemplateColumns = `repeat(${this.gridWidth}, minmax(35px, 1fr))`;
    
        grid.forEach((row, r) => {
            row.forEach((char, c) => {
                const cell = document.createElement('div');
                cell.className = "word-cell w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-slate-700 text-white font-black rounded-xl cursor-pointer select-none hover:bg-slate-600 transition-all text-2xl shadow-md border border-slate-600/50";                
                cell.innerText = char;
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
        
        const contentRow = document.createElement('div');
        contentRow.className =
        'flex flex-col lg:flex-row gap-6 items-start justify-center w-full mt-6';

        // Gom tất cả vào giao diện chính
        contentRow.appendChild(gridContainer);
        contentRow.appendChild(wordList);

        wrapper.appendChild(contentRow);
        area.appendChild(wrapper);
    
        // 3. Khởi tạo các sự kiện tương tác
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