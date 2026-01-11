// js/question/question6.js
// Question Type 6: Kéo thả đuôi từ (Suffix Drag & Drop) - Vertical & Merged Style

const QuestionType6 = {
    autoReload: false,
    damageOnHint: 5, // Thêm dòng này (Trừ 5 máu mỗi lần hint)
    currentData: [],
    onCorrect: null,
    onWrong: null,
    
    _draggables: [],
    _dropZones: [],
    _items: [],
    _currentDrag: null,
    _destroyed: false,
  
    async load(enemyType = "normal") {
        console.log("QuestionType6.load called (Vertical Layout)");
        this._destroyed = false;
  
        let pool = this._vocabulary || [];
        if (!pool || pool.length === 0) pool = window.VOCAB_CACHE || [];
  
        if (pool.length === 0) {
            document.getElementById("questionarea").innerHTML = "<div class='text-white p-4'>Đang tải dữ liệu...</div>";
            setTimeout(() => this.load(enemyType), 500);
            return;
        }
  
        this._selectWords(pool, 5);
        this.render();
    },
  
    _selectWords(pool, count) {
        const validWords = pool.filter(w => (w.english_word || w.english || '').trim().length >= 4);
        const shuffled = validWords.sort(() => Math.random() - 0.5);
        const chosen = shuffled.slice(0, Math.min(count, validWords.length));
  
        this._items = chosen.map(w => {
            const full = (w.english_word || w.english || '').trim().toUpperCase();
            const vi = w.vietnamese_translation || w.vietnamese || '';
            const cutPart = full.slice(-2);
            const leftPart = full.slice(0, full.length - 2);
  
            return { full, leftPart, cutPart, vi, filled: false };
        });
        this.currentData = chosen;
    },
  
    render() {
        const container = document.getElementById("questionarea");
        if (!container) return;
        container.innerHTML = '';
  
        // Style nội bộ cho hiệu ứng
        const style = document.createElement('style');
        style.innerHTML = `
            .q6-drag-dragging { opacity: 0.5; transform: scale(0.95); }
            .q6-zone-over { background-color: #dcfce7 !important; border-color: #22c55e !important; transform: scale(1.1); }
            .shake { animation: shake 0.5s; }
            @keyframes shake { 0%{transform:translateX(0)} 25%{transform:translateX(5px)} 50%{transform:translateX(-5px)} 75%{transform:translateX(5px)} 100%{transform:translateX(0)} }
            
            /* Class khi hoàn thành: biến mất viền và background để hòa nhập với text */
            .q6-filled {
                background-color: transparent !important;
                border: none !important;
                padding: 0 !important;
                width: auto !important;
                color: inherit !important;
                text-align: left !important;
            }
        `;
        container.appendChild(style);
  
        const wrapper = document.createElement('div');
        wrapper.className = 'w-full h-full bg-slate-800 rounded-3xl p-6 flex flex-col relative overflow-hidden';
        
        wrapper.innerHTML = `
            <div class="absolute top-0 left-0 bg-yellow-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow z-10">
                Type 6: Suffix Match
            </div>
            <button id="q6-hint-btn" class="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-yellow-400 rounded-full flex items-center justify-center text-xl shadow hover:bg-yellow-50 active:scale-95 transition-transform z-20">
                💡
            </button>
            <div class="text-white/50 text-center text-sm font-bold uppercase tracking-widest mb-4">
                Kéo mảnh ghép bên phải để hoàn thành từ
            </div>
        `;
  
        // Layout chính: Grid chia làm 2 phần lớn
        // Phần Trái (Col 1 + Col 2 cũ): Hiển thị Nghĩa và Từ khuyết
        // Phần Phải (Col 3 cũ): Cột chứa mảnh ghép xếp dọc
        const mainLayout = document.createElement('div');
        mainLayout.className = 'flex w-full h-full gap-[2cm] justify-center items-stretch mt-4';
          
        // --- KHỐI TRÁI: DANH SÁCH TỪ ---
        const listContainer = document.createElement('div');
        listContainer.className = 'flex-initial flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar';

        this._dropZones = [];
        this._items.forEach((it, idx) => {
            const row = document.createElement('div');
            // Flex row chứa cả nghĩa tiếng Việt và phần tiếng Anh
            row.className = 'flex items-center justify-start p-3 bg-slate-700 rounded-xl border border-slate-600 w-[450px] mx-auto';            
            const viDiv = document.createElement('div');
            viDiv.className = 'flex-1 text-green-400 text-sm font-medium truncate pr-4';            viDiv.innerText = `${idx + 1}. ${this._escape(it.vi)}`;
  
            // Phần Tiếng Anh (Gốc + Ô trống sát nhau)
            const engDiv = document.createElement('div');
            engDiv.className = 'flex items-baseline justify-end gap-0.5 min-w-[150px]';

            // Gốc từ
            const rootSpan = document.createElement('span');
            rootSpan.className = 'text-2xl font-bold text-white tracking-widest';
            rootSpan.innerText = it.leftPart;
  
            // Ô thả (Drop Zone)
            const zone = document.createElement('div');
            // Ban đầu là ô vuông nét đứt
            zone.className = 'min-w-[50px] h-10 px-1 ml-0.5 flex items-center justify-center border-b-4 border-dashed border-slate-400 text-slate-400 text-xl font-bold transition-all';
            zone.setAttribute('data-index', idx);
            zone.setAttribute('data-expected', it.cutPart);
            zone.innerText = '__'; // Placeholder
  
            this._dropZones.push(zone);
            
            engDiv.appendChild(rootSpan);
            engDiv.appendChild(zone);
  
            row.appendChild(viDiv);
            row.appendChild(engDiv);
            listContainer.appendChild(row);
        });
  
        // --- KHỐI PHẢI: CÁC MẢNH GHÉP (XẾP DỌC) ---
        const piecesContainer = document.createElement('div');
        piecesContainer.className = 'w-24 self-stretch flex-none bg-slate-900/50 rounded-xl p-2 flex flex-col items-center gap-3 overflow-y-auto custom-scrollbar border border-slate-700 min-h-[300px]';        const cutParts = this._items.map((it, idx) => ({ cut: it.cutPart, originIdx: idx }));
        this._shuffle(cutParts);
  
        this._draggables = [];
        cutParts.forEach(cp => {
            const tile = document.createElement('div');
            // Style thẻ bài
            tile.className = 'w-full h-14 bg-blue-500 hover:bg-blue-400 text-white text-xl font-bold rounded-lg cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center transition-transform';
            tile.setAttribute('draggable', 'true');
            tile.setAttribute('data-cut', cp.cut);
            tile.setAttribute('data-origin', cp.originIdx);
            tile.innerText = cp.cut;
  
            this._draggables.push(tile);
            piecesContainer.appendChild(tile);
        });
  
        mainLayout.appendChild(listContainer);
        mainLayout.appendChild(piecesContainer);
        wrapper.appendChild(mainLayout);
        container.appendChild(wrapper);
        
        setTimeout(() => {
            const hintBtn = document.getElementById('q6-hint-btn');
            if (hintBtn) hintBtn.onclick = () => this.useHint();
        }, 0);

        this._attachEvents();
    },
  
    _attachEvents() {
        this._draggables.forEach(tile => {
            tile.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', tile.getAttribute('data-cut'));
                e.dataTransfer.setData('text/origin', tile.getAttribute('data-origin'));
                tile.classList.add('q6-drag-dragging');
                this._currentDrag = tile;
            });
            tile.addEventListener('dragend', () => {
                tile.classList.remove('q6-drag-dragging');
                this._currentDrag = null;
            });
        });
  
        this._dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!zone.classList.contains('q6-filled')) {
                    zone.classList.add('q6-zone-over');
                }
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('q6-zone-over');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('q6-zone-over');
                const cut = e.dataTransfer.getData('text/plain');
                const origin = e.dataTransfer.getData('text/origin');
                this._handleDrop(zone, cut, origin);
            });
            // Hỗ trợ click (cho mobile)
            zone.addEventListener('click', () => {
                if (this._currentDrag) {
                   const cut = this._currentDrag.getAttribute('data-cut');
                   const origin = this._currentDrag.getAttribute('data-origin');
                   this._handleDrop(zone, cut, origin);
                }
            });
        });
    },
  
    _handleDrop(zone, cut, origin) {
        if (this._destroyed) return;
        const index = parseInt(zone.getAttribute('data-index'));
        const item = this._items[index];
  
        if (item.filled) return;
  
        const tileEl = this._draggables.find(d => 
            d.getAttribute('data-cut') === cut && 
            d.getAttribute('data-origin') === origin &&
            !d.classList.contains('hidden')
        );
  
        if (cut === item.cutPart) {
            // === ĐÚNG ===
            item.filled = true;

            // 1. Biến ô trống thành chữ thường
            zone.innerText = item.cutPart;
            // 2. Add class q6-filled để xóa viền, xóa background
            zone.className = "text-2xl font-bold text-white tracking-widest q6-filled ml-0.5 animate-pulse";
            
            // Ẩn tile bên phải
            if (tileEl) tileEl.classList.add('invisible', 'pointer-events-none');
  
            if (window.GameEngine) window.GameEngine.processBattleRound(1, 0, false);
            this._checkAllCompleted();
            this._speak(item.full);
  
        } else {
            // === SAI ===
            if (tileEl) {
                tileEl.classList.add('bg-red-500', 'shake');
                setTimeout(() => tileEl.classList.remove('bg-red-500', 'shake'), 500);
            }
            if (window.GameEngine) window.GameEngine.processBattleRound(0, 1, false);
        }
    },
  
    _checkAllCompleted() {
        const allDone = this._items.every(i => i.filled);
        if (allDone) {
            setTimeout(() => {
                if (typeof this.onCorrect === 'function') this.onCorrect(); 
                else if (window.GameEngine) window.GameEngine.processBattleRound(1, 0, true);
            }, 1000);
        }
    },
  
    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },
  
    _escape(s) {
        return String(s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    },
  
    _speak(text) {
        if (!text || !window.speechSynthesis || this._destroyed) return;
        
        // Hủy các yêu cầu đọc trước đó để tránh bị chồng chéo âm thanh
        window.speechSynthesis.cancel();
        
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.9; // Tốc độ đọc vừa phải để người học dễ nghe
        
        // Chọn giọng đọc nếu có sẵn
        const voices = window.speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.includes('en'));
        if (targetVoice) u.voice = targetVoice;
        
        window.speechSynthesis.speak(u);
    },
  
    useHint() {
        if (this._destroyed) return;
        
        // 1. Tìm câu chưa làm xong đầu tiên
        const targetIndex = this._items.findIndex(item => !item.filled);
        if (targetIndex === -1) return; // Đã xong hết
        
        const targetItem = this._items[targetIndex];

        // --- LOGIC MỚI: TRỪ HP HERO (Giống Question 2) ---
        if (window.GameEngine && window.GameEngine.player) {
            // Trừ máu hiện tại
            window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - (this.damageOnHint || 5));
            
            // Cập nhật thanh máu trên UI
            window.GameEngine.updateAllUI();
            
            // Hiển thị số damage bay lên (nếu có hàm này)
            if (typeof window.GameEngine.showDamage === 'function') {
                window.GameEngine.showDamage(window.GameEngine.player, this.damageOnHint || 5);
            }
        }
        
        // 2. Tìm DOM của ô trống (Drop Zone)
        const zone = this._dropZones[targetIndex];
        
        // 3. Tìm DOM của mảnh ghép (Draggable Tile)
        // Phải khớp cả text (cut) và origin (đề phòng từ giống nhau)
        const tile = this._draggables.find(d => 
            d.getAttribute('data-cut') === targetItem.cutPart && 
            d.getAttribute('data-origin') == targetIndex && // Lưu ý: so sánh lỏng (==) vì attribute là string
            !d.classList.contains('hidden')
        );

        // 4. Hiệu ứng sáng lên (Highlight)
        if (zone) {
            zone.classList.add('bg-yellow-500/20', 'border-yellow-400', 'text-yellow-300', 'scale-110');
        }
        
        if (tile) {
            tile.classList.add('bg-yellow-500', 'ring-4', 'ring-yellow-300', 'scale-110', 'z-50');
        }

        // 5. Tắt hiệu ứng sau 1.5 giây
        setTimeout(() => {
            if (this._destroyed) return;
            if (zone) zone.classList.remove('bg-yellow-500/20', 'border-yellow-400', 'text-yellow-300', 'scale-110');
            if (tile) tile.classList.remove('bg-yellow-500', 'ring-4', 'ring-yellow-300', 'scale-110', 'z-50');
        }, 1500);
    },

    destroy() {
        this._destroyed = true;
        const container = document.getElementById("questionarea");
        if (container) container.innerHTML = "";
        this._draggables = [];
        this._dropZones = [];
    }
  };
  
  export default QuestionType6;
  window.QuestionType6 = QuestionType6;