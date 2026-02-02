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
        .filter(w => w.en.length > 0 && !w.en.includes(' ') && w.en.length >= 3); // Bỏ từ rỗng, từ ghép và từ quá ngắn
    
        if (pool.length < 5) {
            console.warn('Không đủ từ vựng để chơi (cần ít nhất 5 từ)');
            return;
        }
    
        // ✅ 2. CHỌN NGẪU NHIÊN 5 TỪ
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const selectedWords = shuffled.slice(0, 5);
    
        // ✅ 3. SẮP XẾP THEO ĐỘ DÀI GIẢM DẦN
        selectedWords.sort((a, b) => b.en.length - a.en.length);
    
        // ✅ 4. LẤY 2 TỪ DÀI NHẤT LÀM TRỤC NGANG VÀ DỌC
        const horizontalWord = selectedWords[0]; // Từ dài nhất - nằm ngang
        const verticalWord = selectedWords[1];   // Từ dài thứ 2 - nằm dọc
        const otherWords = selectedWords.slice(2, 5); // 3 từ còn lại
    
        // ✅ 5. GÁN DỮ LIỆU VÀO ĐỐI TƯỢNG
        // Thứ tự: [ngang, dọc, ...các từ khác]
        this.wordsToFind = [horizontalWord, verticalWord, ...otherWords].map(w => ({
            en: w.en,
            vi: w.vi,
            found: false,
            hinted: false
        }));

        console.log('Từ được chọn:', this.wordsToFind.map(w => `${w.en} (${w.en.length})`));
    }

    _generateGrid() {
        if (!this.wordsToFind || this.wordsToFind.length < 2) return [[]];
        
        const words = this.wordsToFind;
        
        // ✅ RANDOM VAI TRÒ: 50% hoán đổi từ ngang/dọc
        let word1, word2, index1, index2, is1Horizontal;
        if (Math.random() > 0.5) {
            word1 = words[0].en;
            word2 = words[1].en;
            index1 = 0;
            index2 = 1;
            is1Horizontal = true;  // Từ 1 nằm ngang
        } else {
            word1 = words[1].en;
            word2 = words[0].en;
            index1 = 1;
            index2 = 0;
            is1Horizontal = true;  // Từ 1 nằm ngang
        }
        
        // Từ 2 sẽ nằm dọc (vuông góc với từ 1)
        
        // ✅ XÁC ĐỊNH KÍCH THƯỚC GRID
        const gridWidth = word1.length + 1;
        const gridHeight = word2.length + 1;
        
        // Tạo grid rỗng
        const grid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(''));
        
        // ✅ 1. ĐẶT TỪ 1 (NGANG) - Vị trí hàng random
        const word1Row = Math.floor(Math.random() * gridHeight);
        const word1Col = 0;
        
        for (let i = 0; i < word1.length && word1Col + i < gridWidth; i++) {
            grid[word1Row][word1Col + i] = word1[i];
        }
        words[index1].firstCharPos = { row: word1Row, col: word1Col };
        words[index1].isHorizontal = is1Horizontal;
        
        // ✅ 2. ĐẶT TỪ 2 (DỌC) - Tìm vị trí cắt hợp lệ
        let word2Placed = false;
        
        // Thử tìm ký tự chung để cắt nhau
        for (let i = 0; i < word2.length && !word2Placed; i++) {
            const char = word2[i];
            // Tìm vị trí của char này trong word1
            for (let j = 0; j < word1.length && !word2Placed; j++) {
                if (word1[j] === char) {
                    // Thử đặt word2 dọc sao cho ký tự thứ i của nó trùng với word1[j]
                    const word2Row = word1Row - i;
                    const word2Col = word1Col + j;
                    
                    // Kiểm tra xem có thể đặt không
                    let canPlace = true;
                    for (let k = 0; k < word2.length; k++) {
                        const r = word2Row + k;
                        const c = word2Col;
                        
                        // Vượt biên
                        if (r < 0 || r >= gridHeight || c < 0 || c >= gridWidth) {
                            canPlace = false;
                            break;
                        }
                        
                        // Ô này đã có chữ khác
                        const existing = grid[r][c];
                        if (existing !== '' && existing !== word2[k]) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    if (canPlace) {
                        // Đặt word2
                        for (let k = 0; k < word2.length; k++) {
                            const r = word2Row + k;
                            const c = word2Col;
                            grid[r][c] = word2[k];
                        }
                        words[index2].firstCharPos = { row: word2Row, col: word2Col };
                        words[index2].isHorizontal = false;
                        word2Placed = true;
                    }
                }
            }
        }
        
        // Nếu không tìm được vị trí cắt, đặt word2 ở cột random (không cắt)
        if (!word2Placed) {
            const word2Col = Math.floor(Math.random() * gridWidth);
            const word2Row = 0;
            
            for (let k = 0; k < word2.length && word2Row + k < gridHeight; k++) {
                const r = word2Row + k;
                const c = word2Col;
                if (grid[r][c] === '') {
                    grid[r][c] = word2[k];
                }
            }
            words[index2].firstCharPos = { row: word2Row, col: word2Col };
            words[index2].isHorizontal = false;
        }
        
        // ✅ 3. ĐẶT 3 TỪ CÒN LẠI
        for (let i = 2; i < words.length; i++) {
            const word = words[i].en;
            let placed = false;
            
            // Thử đan xen với các chữ đã có
            for (let r = 0; r < gridHeight && !placed; r++) {
                for (let c = 0; c < gridWidth && !placed; c++) {
                    // Thử ngang
                    if (c + word.length <= gridWidth) {
                        if (this._canPlaceInGrid(word, r, c, true, grid)) {
                            this._placeWordInGrid(words[i], word, r, c, true, grid);
                            placed = true;
                        }
                    }
                    // Thử dọc
                    if (!placed && r + word.length <= gridHeight) {
                        if (this._canPlaceInGrid(word, r, c, false, grid)) {
                            this._placeWordInGrid(words[i], word, r, c, false, grid);
                            placed = true;
                        }
                    }
                }
            }
            
            // Nếu không đặt được, tìm chỗ trống đầu tiên
            if (!placed) {
                for (let r = 0; r < gridHeight && !placed; r++) {
                    for (let c = 0; c <= gridWidth - word.length && !placed; c++) {
                        let canPlace = true;
                        for (let k = 0; k < word.length; k++) {
                            if (grid[r][c + k] !== '') {
                                canPlace = false;
                                break;
                            }
                        }
                        if (canPlace) {
                            this._placeWordInGrid(words[i], word, r, c, true, grid);
                            placed = true;
                        }
                    }
                }
            }
        }
        
        // ✅ 4. ĐIỀN CHỮ NGẪU NHIÊN VÀO Ô TRỐNG
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
        
        return grid;
    }
    
    // Kiểm tra có thể đặt từ trong grid không (không vượt quá biên)
    _canPlaceInGrid(word, r, c, isHorizontal, grid) {
        for (let i = 0; i < word.length; i++) {
            const curR = isHorizontal ? r : r + i;
            const curC = isHorizontal ? c + i : c;
            
            // Kiểm tra ô này: hoặc rỗng, hoặc trùng chữ
            const cellChar = grid[curR][curC];
            if (cellChar !== '' && cellChar !== word[i]) {
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
        wrapper.className = "flex flex-col lg:flex-row gap-6 items-start justify-center w-full max-w-7xl mx-auto p-4";

        // Nút Hint ở trên cùng (mobile) hoặc góc trái (desktop)
        wrapper.innerHTML = `
            <button id="hint-btn" 
                class="lg:absolute lg:top-4 lg:left-4 mb-4 lg:mb-0 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center gap-2 self-center lg:self-start">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                </svg>
                HINT (-5 HP)
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