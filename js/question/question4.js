// js/question/question4.js

// Hàm tạo grid tối ưu
function generateGrid(words) {

    // 1. Sắp xếp từ theo độ dài giảm dần (từ dài đặt trước)
    words.sort((a, b) => b.length - a.length);
    
    // 2. Tính kích thước grid hợp lý
    const maxLen = words[0].length;
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);
    const minSize = Math.max(maxLen, Math.ceil(Math.sqrt(totalChars * 1.5)));
    
    let rows = minSize;
    let cols = minSize;
    let grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const placed = [];

    // 3. Đặt từ đầu tiên (dài nhất) vào giữa grid
    const firstWord = words[0];
    const startRow = Math.floor(rows / 2);
    const startCol = Math.floor((cols - firstWord.length) / 2);
    for (let i = 0; i < firstWord.length; i++) {
        grid[startRow][startCol + i] = firstWord[i];
    }
    placed.push({ word: firstWord, placed: true });

    // 4. Đặt các từ còn lại
    for (let w = 1; w < words.length; w++) {
        const word = words[w];
        let wordPlaced = false;

        // Thử đan xen với các từ đã đặt
        for (let attempt = 0; attempt < 300 && !wordPlaced; attempt++) {
            const horizontal = Math.random() > 0.5;
            
            if (horizontal) {
                // Đặt ngang
                const row = Math.floor(Math.random() * rows);
                const maxCol = cols - word.length;
                if (maxCol < 0) continue;
                const col = Math.floor(Math.random() * (maxCol + 1));
                
                // Kiểm tra có thể đặt không
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
                
                // Chỉ đặt nếu hợp lệ VÀ có giao với từ khác (hoặc là lần thử cuối)
                if (canPlace && (hasIntersection || attempt > 250)) {
                    for (let i = 0; i < word.length; i++) {
                        grid[row][col + i] = word[i];
                    }
                    wordPlaced = true;
                    placed.push({ word, placed: true });
                }
            } else {
                // Đặt dọc
                const maxRow = rows - word.length;
                if (maxRow < 0) continue;
                const row = Math.floor(Math.random() * (maxRow + 1));
                const col = Math.floor(Math.random() * cols);
                
                // Kiểm tra có thể đặt không
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
                
                // Chỉ đặt nếu hợp lệ VÀ có giao với từ khác (hoặc là lần thử cuối)
                if (canPlace && (hasIntersection || attempt > 250)) {
                    for (let i = 0; i < word.length; i++) {
                        grid[row + i][col] = word[i];
                    }
                    wordPlaced = true;
                    placed.push({ word, placed: true });
                }
            }
        }

        // Nếu vẫn không đặt được sau 300 lần thử, log lỗi
        if (!wordPlaced) {
            console.warn(`Không thể đặt từ: ${word}`);
            placed.push({ word, placed: false });
        }
    }

    // 5. Trim grid (cắt bỏ hàng/cột trống)
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

    // Đảm bảo có ít nhất 1 ô
    if (bottom === -1) {
        grid = [[firstWord[0]]];
    } else {
        const newGrid = [];
        for (let r = top; r <= bottom; r++) {
            newGrid.push(grid[r].slice(left, right + 1));
        }
        grid = newGrid;
    }

    // 6. Điền chữ ngẫu nhiên vào ô trống
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === null) {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }

    console.log("Grid placed status:", placed);
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
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
    },

    async load(enemyType = "boss") {
        this.hintCount = 0;

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
                window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - 5);
                window.GameEngine.updateAllUI();
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
                <!-- Cột từ tiếng Việt -->
                <div class="w-48 space-y-4">
                    ${selected.map((w,i) => `
                    <div class="p-2 border rounded bg-gray-50 h-16 flex flex-col justify-between">
                    <p class="text-green-600 font-bold">${w.vietnamese}</p>
                    <p id="found-${i}" class="text-blue-600 font-black min-h-[1.2rem]"></p>
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
                <div class="mt-4">
                <button id="hint-btn" class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                    💡 Hint (${this.maxHints - this.hintCount} ) 
                     
                </button>
                </div>
            </div>
        `;
        
        const hintBtn = document.getElementById("hint-btn");
        if (hintBtn) {
            hintBtn.addEventListener("click", () => {
                if (this.hintCount >= this.maxHints) return;

                // Tìm từ chưa được tìm, theo thứ tự từ trên xuống
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
                // Cập nhật nút
                const remaining = this.maxHints - this.hintCount;
                hintBtn.innerText = `Hint (${remaining})`;

                // Nếu hết lượt thì disable nút
                if (this.hintCount >= this.maxHints) {
                    hintBtn.disabled = true;
                    hintBtn.classList.add("opacity-50", "cursor-not-allowed");
                }
            });
        }

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
                    this.speak(word);
                    selectedCells.forEach(c => {
                        c.classList.remove("bg-green-300");
                        c.classList.add("bg-yellow-300"); // đúng thì vàng
                    });               

                    // ✅ Đếm số từ đã tìm được
                    const foundWords = selected.filter((w, idx) => {
                        const el = document.getElementById(`found-${idx}`);
                        return el && el.innerText !== '';
                    });
                    
                    console.log(`Đã tìm được ${foundWords.length}/${selected.length} từ`);
                    
                    if (this.onCorrect) this.onCorrect();

                    // ✅ Nếu tìm hết tất cả từ, delay rồi load câu hỏi mới
                    if (foundWords.length === selected.length) {
                        console.log('✅ Hoàn thành tất cả từ! Đang load câu hỏi mới...');
                        
                        setTimeout(() => {
                            // Kiểm tra monster còn sống không
                            if (window.GameEngine && window.GameEngine.monster && window.GameEngine.monster.hp > 0) {
                                console.log('Monster còn sống, load câu hỏi mới');
                                this.load('boss'); // Load lại câu hỏi mới
                            } else {
                                console.log('Monster đã chết, không cần load câu hỏi');
                            }
                        }, 1500); // Delay 1.5s để người chơi thấy hoàn thành
                    }
                } else {
                    selectedCells.forEach(c => c.classList.remove("bg-green-300"));
                    if (this.onWrong) this.onWrong();
                }
                selectedCells = [];
            }
        });
    },

    destroy() {
        this.hintCount = 0;

        if (this.attackInterval) clearInterval(this.attackInterval);
        const area = document.getElementById("questionarea");
        if (area) area.innerHTML = "";
        this.currentData = null;
    }
};

export default QuestionType4;
window.QuestionType4 = QuestionType4;