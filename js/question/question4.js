// js/question/question4.js

// Hàm tạo grid tối ưu
function generateGrid(words) {
    const maxLen = Math.max(...words.map(w => w.length));
    let rows = maxLen, cols = maxLen;
    let grid = Array.from({ length: rows }, () => Array(cols).fill(null));

    function placeWordSmart(word) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                for (let i = 0; i < word.length; i++) {
                    const ch = word[i];
                    if (grid[r][c] === ch) {
                        // Thử đặt ngang
                        const startCol = c - i;
                        if (startCol >= 0 && startCol + word.length <= cols) {
                            let ok = true;
                            for (let j = 0; j < word.length; j++) {
                                const cell = grid[r][startCol + j];
                                if (cell && cell !== word[j]) { ok = false; break; }
                            }
                            if (ok) {
                                for (let j = 0; j < word.length; j++) grid[r][startCol + j] = word[j];
                                return true;
                            }
                        }
    
                        // Thử đặt dọc
                        const startRow = r - i;
                        if (startRow >= 0 && startRow + word.length <= rows) {
                            let ok = true;
                            for (let j = 0; j < word.length; j++) {
                                const cell = grid[startRow + j][c];
                                if (cell && cell !== word[j]) { ok = false; break; }
                            }
                            if (ok) {
                                for (let j = 0; j < word.length; j++) grid[startRow + j][c] = word[j];
                                return true;
                            }
                        }
                    }
                }
            }
        }
    
        // Nếu không đan xen được → đặt ngẫu nhiên như cũ
        for (let attempt = 0; attempt < 200; attempt++) {
            const horizontal = Math.random() > 0.5;
            if (horizontal) {
                const row = Math.floor(Math.random() * rows);
                const col = Math.floor(Math.random() * (cols - word.length + 1));
                let ok = true;
                for (let i = 0; i < word.length; i++) {
                    const cell = grid[row][col + i];
                    if (cell && cell !== word[i]) { ok = false; break; }
                }
                if (ok) {
                    for (let i = 0; i < word.length; i++) grid[row][col + i] = word[i];
                    return true;
                }
            } else {
                const row = Math.floor(Math.random() * (rows - word.length + 1));
                const col = Math.floor(Math.random() * cols);
                let ok = true;
                for (let i = 0; i < word.length; i++) {
                    const cell = grid[row + i][col];
                    if (cell && cell !== word[i]) { ok = false; break; }
                }
                if (ok) {
                    for (let i = 0; i < word.length; i++) grid[row + i][col] = word[i];
                    return true;
                }
            }
        }
        return false;
    }

    words.forEach(w => placeWordSmart(w));

    // Trim grid
    function trimGrid(grid) {
        let top = grid.length, bottom = 0, left = grid[0].length, right = 0;
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (grid[r][c]) {
                    if (r < top) top = r;
                    if (r > bottom) bottom = r;
                    if (c < left) left = c;
                    if (c > right) right = c;
                }
            }
        }
        const newGrid = [];
        for (let r = top; r <= bottom; r++) {
            newGrid.push(grid[r].slice(left, right + 1));
        }
        return newGrid;
    }

    grid = trimGrid(grid);

    // Điền chữ ngẫu nhiên
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (!grid[r][c]) {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }

    return grid;
}

const QuestionType4 = {
    currentData: null,
    onCorrect: null,
    onWrong: null,
    attackInterval: null,

    async load(enemyType = "boss") {
        if (!window.supabase) return;

        // Lấy dữ liệu từ Supabase
        const { data, error } = await window.supabase
            .from("vocabulary")
            .select("english_word, vietnamese_translation")
            .limit(100);
        if (error) throw error;

        // Lọc 5 từ duy nhất
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

        // Monster attack mỗi 10s
        if (this.attackInterval) clearInterval(this.attackInterval);
        this.attackInterval = setInterval(() => {
            if (window.GameEngine && window.GameEngine.player) {
                window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - 10);
                window.GameEngine.updateAllUI();
                if (typeof window.GameEngine.showDamage === 'function') {
                    window.GameEngine.showDamage(window.GameEngine.player, 10);
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
                <!-- Cột từ tiếng Việt -->
                <div class="w-48 space-y-4">
                    ${selected.map((w,i) => `
                        <div class="p-2 border rounded bg-gray-50">
                            <p class="text-green-600 font-bold">${w.vietnamese}</p>
                            <p id="found-${i}" class="text-blue-600 font-black"></p>
                        </div>
                    `).join("")}
                </div>

                <!-- Grid word search -->
                <div id="word-grid" class="grid select-none"
                     style="grid-template-columns: repeat(${grid[0].length}, 40px); gap: 4px;">
                    ${grid.map((row,r) => row.map((ch,c) => `
                        <div data-r="${r}" data-c="${c}"
                             class="cell w-10 h-10 flex items-center justify-center border rounded bg-white font-bold text-lg cursor-pointer">
                            ${ch}
                        </div>`).join("")).join("")}
                </div>
            </div>
        `;

        // Logic chọn bằng chuột
        const cells = area.querySelectorAll(".cell");
        let selecting = false, selectedCells = [];

        cells.forEach(cell => {
            cell.addEventListener("mousedown", e => {
                selecting = true;
                selectedCells = [cell];
                cell.classList.add("bg-green-300"); // khi bắt đầu kéo
            });
            cell.addEventListener("mouseover", e => {
                if (selecting && !selectedCells.includes(cell)) {
                    selectedCells.push(cell);
                    cell.classList.add("bg-green-300"); // khi kéo qua ô
                }
            });
        });

        document.addEventListener("mouseup", () => {
            if (selecting) {
                selecting = false;
                const word = selectedCells.map(c => c.innerText).join("");
                const reversed = selectedCells.map(c => c.innerText).reverse().join("");
                const foundIndex = selected.findIndex(w => w.english === word || w.english === reversed);

                if (foundIndex >= 0) {
                    document.getElementById(`found-${foundIndex}`).innerText = selected[foundIndex].english;
                    selectedCells.forEach(c => {
                        c.classList.remove("bg-green-300");
                        c.classList.add("bg-yellow-300"); // đúng thì vàng
                    });
                    if (this.onCorrect) this.onCorrect();
                } else {
                    selectedCells.forEach(c => c.classList.remove("bg-green-300"));
                    if (this.onWrong) this.onWrong();
                }
                selectedCells = [];
            }
        });
    },

    destroy() {
        if (this.attackInterval) clearInterval(this.attackInterval);
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
    }
};

export default QuestionType4;
window.QuestionType4 = QuestionType4;