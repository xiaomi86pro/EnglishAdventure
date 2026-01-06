// js/question/question4.js
// QuestionType4 (Word Search) - cleaned: single-word onCorrect(1,false), final onCorrect(1,true), safe listeners

function generateGrid(words) {
    words.sort((a, b) => b.length - a.length);
    const maxLen = words[0].length;
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);
    const minSize = Math.max(maxLen, Math.ceil(Math.sqrt(totalChars * 1.5)));

    let rows = minSize;
    let cols = minSize;
    let grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placed = [];

    const firstWord = words[0];
    const startRow = Math.floor(rows / 2);
    const startCol = Math.floor((cols - firstWord.length) / 2);
    for (let i = 0; i < firstWord.length; i++) {
        grid[startRow][startCol + i] = firstWord[i];
    }
    placed.push({ word: firstWord, placed: true });

    for (let w = 1; w < words.length; w++) {
        const word = words[w];
        let wordPlaced = false;

        for (let attempt = 0; attempt < 300 && !wordPlaced; attempt++) {
            const horizontal = Math.random() > 0.5;

            if (horizontal) {
                const row = Math.floor(Math.random() * rows);
                const maxCol = cols - word.length;
                if (maxCol < 0) continue;
                const col = Math.floor(Math.random() * (maxCol + 1));

                let canPlace = true;
                let hasIntersection = false;

                for (let i = 0; i < word.length; i++) {
                    const cell = grid[row][col + i];
                    if (cell !== null && cell !== word[i]) {
                        canPlace = false;
                        break;
                    }
                    if (cell === word[i]) hasIntersection = true;
                }

                if (canPlace && (hasIntersection || attempt > 250)) {
                    for (let i = 0; i < word.length; i++) {
                        grid[row][col + i] = word[i];
                    }
                    wordPlaced = true;
                    placed.push({ word, placed: true });
                }
            } else {
                const maxRow = rows - word.length;
                if (maxRow < 0) continue;
                const row = Math.floor(Math.random() * (maxRow + 1));
                const col = Math.floor(Math.random() * cols);

                let canPlace = true;
                let hasIntersection = false;

                for (let i = 0; i < word.length; i++) {
                    const cell = grid[row + i][col];
                    if (cell !== null && cell !== word[i]) {
                        canPlace = false;
                        break;
                    }
                    if (cell === word[i]) hasIntersection = true;
                }

                if (canPlace && (hasIntersection || attempt > 250)) {
                    for (let i = 0; i < word.length; i++) {
                        grid[row + i][col] = word[i];
                    }
                    wordPlaced = true;
                    placed.push({ word, placed: true });
                }
            }
        }

        if (!wordPlaced) {
            console.warn(`Không thể đặt từ: ${word}`);
            placed.push({ word, placed: false });
        }
    }

    let top = rows, bottom = -1, left = cols, right = -1;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] !== null) {
                if (r < top) top = r;
                if (r > bottom) bottom = r;
                if (c < left) left = c;
                if (c > right) right = c;
            }
        }
    }

    if (bottom === -1) {
        grid = [[firstWord[0]]];
    } else {
        const newGrid = [];
        for (let r = top; r <= bottom; r++) {
            newGrid.push(grid[r].slice(left, right + 1));
        }
        grid = newGrid;
    }

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === null) {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }

    if (window.CONFIG?.debug) console.log("Grid placed status:", placed);
    return grid;
};

const QuestionType4 = {
    autoReload: false,
    currentData: null,
    onCorrect: null,
    onWrong: null,
    attackInterval: null,
    hintCount: 0,
    maxHints: 5,

    speak(text, lang = "en-US", rate = 0.9) {
        if (!window.speechSynthesis) return;
        try { speechSynthesis.cancel(); } catch(e){}
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    },

    async load(enemyType = "boss") {
        this.hintCount = 0;

        if (!window.supabase) return;

        const { data, error } = await window.supabase
            .from("vocabulary")
            .select("english_word, vietnamese_translation")
            .limit(100);
        if (error) throw error;

        const seen = new Set();
        const selected = [];
        while (selected.length < 5 && data.length > 0) {
            const item = data[Math.floor(Math.random() * data.length)];
            const word = item.english_word?.replace(/\s+/g, "").trim().toUpperCase();
            if (word && !seen.has(word)) {
                seen.add(word);
                selected.push({ english: word, vietnamese: item.vietnamese_translation });
            }
        }

        const words = selected.map(w => w.english);
        const grid = generateGrid(words);

        this.currentData = { selected, grid };
        this.renderQuestionUI();

        // Monster auto-attack every 10s (optional). Keep but ensure cleanup in destroy()
        if (this.attackInterval) clearInterval(this.attackInterval);
        this.attackInterval = setInterval(() => {
            if (window.GameEngine && window.GameEngine.player) {
                window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - 5);
                try { window.GameEngine.updateAllUI(); } catch(e){}
                if (typeof window.GameEngine.showDamage === 'function') {
                    window.GameEngine.showDamage(window.GameEngine.player, 5);
                }
            }
        }, 10000);
    },

    renderQuestionUI() {
        const area = document.getElementById("questionarea");
        if (!area || !this.currentData) return;

        const { selected, grid } = this.currentData;

        area.innerHTML = `
            <div class="flex gap-6">
                <div class="w-48 space-y-4">
                    ${selected.map((w,i) => `
                    <div class="p-2 border rounded bg-gray-50 h-16 flex flex-col justify-between">
                      <p class="text-green-600 font-bold">${w.vietnamese}</p>
                      <p id="found-${i}" class="text-blue-600 font-black min-h-[1.2rem]"></p>
                    </div>
                    `).join("")}
                </div>

                <div id="word-grid" class="grid select-none"
                     style="grid-template-columns: repeat(${grid[0].length}, 40px); gap: 4px;">
                    ${grid.map((row,r) => row.map((ch,c) => `
                        <div data-r="${r}" data-c="${c}"
                             class="cell w-10 h-10 flex items-center justify-center border rounded bg-white font-bold text-lg cursor-pointer">
                            ${ch}
                        </div>`).join("")).join("")}
                </div>

                <div class="mt-4">
                  <button id="hint-btn" class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                    💡 Hint (${this.maxHints - this.hintCount})
                  </button>
                </div>
            </div>
        `;

        const hintBtn = document.getElementById("hint-btn");
        if (hintBtn) {
            hintBtn.onclick = () => {
                if (this.hintCount >= this.maxHints) return;
                for (let i = 0; i < selected.length; i++) {
                    const foundEl = document.getElementById(`found-${i}`);
                    if (foundEl && !foundEl.innerText) {
                        const word = selected[i].english;
                        const hintWord = word.slice(0,2) + "***";
                        foundEl.innerText = hintWord;
                        this.hintCount++;
                        break;
                    }
                }
                const remaining = this.maxHints - this.hintCount;
                hintBtn.innerText = `Hint (${remaining})`;
                if (this.hintCount >= this.maxHints) {
                    hintBtn.disabled = true;
                    hintBtn.classList.add("opacity-50", "cursor-not-allowed");
                }
            };
        }

        // Remove previous cell handlers if any
        if (this._cellHandlers) {
            this._cellHandlers.forEach(h => {
                h.el.removeEventListener('mousedown', h.mousedown);
                h.el.removeEventListener('mouseover', h.mouseover);
            });
        }
        this._cellHandlers = [];

        const cells = area.querySelectorAll(".cell");
        let selecting = false;
        let selectedCells = [];

        cells.forEach(cell => {
            const mousedown = (e) => {
                selecting = true;
                selectedCells = [cell];
                cell.classList.add("bg-green-300");
            };
            const mouseover = (e) => {
                if (selecting && !selectedCells.includes(cell)) {
                    selectedCells.push(cell);
                    cell.classList.add("bg-green-300");
                }
            };
            cell.addEventListener('mousedown', mousedown);
            cell.addEventListener('mouseover', mouseover);
            this._cellHandlers.push({ el: cell, mousedown, mouseover });
        });

        // Remove previous mouseup handler if exists
        if (this._mouseupHandler) {
            document.removeEventListener('mouseup', this._mouseupHandler);
            this._mouseupHandler = null;
        }

        // mouseup handler saved to this._mouseupHandler so we can remove it in destroy()
        this._mouseupHandler = (e) => {
            if (!selecting) return;
            selecting = false;
            const word = selectedCells.map(c => c.innerText).join("");
            const reversed = selectedCells.map(c => c.innerText).reverse().join("");
            const foundIndex = selected.findIndex(w => w.english === word || w.english === reversed);

            if (foundIndex >= 0) {
                const foundEl = document.getElementById(`found-${foundIndex}`);
                if (foundEl && !foundEl.innerText) {
                    foundEl.innerText = selected[foundIndex].english;
                }

                this.speak(word);
                selectedCells.forEach(c => {
                    c.classList.remove("bg-green-300");
                    c.classList.add("bg-yellow-300");
                });

                const foundWords = selected.filter((w, idx) => {
                    const el = document.getElementById(`found-${idx}`);
                    return el && el.innerText !== '';
                });

                // Call onCorrect for this single found word: 1 hit, do NOT advance question
                if (typeof this.onCorrect === 'function') {
                    try {
                        if (window.CONFIG?.debug) console.log('[Q4] calling onCorrect single', { foundIndex });
                        this.onCorrect(1, false);
                    } catch (e) {
                        console.warn('[Q4] onCorrect call failed', e);
                    }
                }

                if (foundWords.length === selected.length) {
                    // All words found: call final onCorrect to allow advanceNext = true
                    if (typeof this.onCorrect === 'function') {
                        try {
                            if (window.CONFIG?.debug) console.log('[Q4] all words found, calling final onCorrect');
                            this.onCorrect(1, true);
                        } catch (e) {
                            console.warn('[Q4] final onCorrect failed', e);
                        }
                    }
                }
            } else {
                // wrong selection
                selectedCells.forEach(c => c.classList.remove("bg-green-300"));
                if (typeof this.onWrong === 'function') {
                    try { this.onWrong(); } catch(e){ console.warn('[Q4] onWrong failed', e); }
                }
            }

            selectedCells = [];
        };

        document.addEventListener('mouseup', this._mouseupHandler);
    },

    destroy() {
        this.hintCount = 0;

        if (this.attackInterval) {
            clearInterval(this.attackInterval);
            this.attackInterval = null;
        }

        if (this._cellHandlers) {
            this._cellHandlers.forEach(h => {
                h.el.removeEventListener('mousedown', h.mousedown);
                h.el.removeEventListener('mouseover', h.mouseover);
            });
            this._cellHandlers = null;
        }

        if (this._mouseupHandler) {
            document.removeEventListener('mouseup', this._mouseupHandler);
            this._mouseupHandler = null;
        }

        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
    }
};

export default QuestionType4;
window.QuestionType4 = QuestionType4;