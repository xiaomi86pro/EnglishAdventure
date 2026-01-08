// js/question/question6.js
// Question Type 6: Kéo thả đuôi từ (Suffix Drag & Drop) - Vertical & Merged Style

const QuestionType6 = {
    autoReload: false,
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
            <div class="text-white/50 text-center text-sm font-bold uppercase tracking-widest mb-4">
                Kéo mảnh ghép bên phải để hoàn thành từ
            </div>
        `;
  
        // Layout chính: Grid chia làm 2 phần lớn
        // Phần Trái (Col 1 + Col 2 cũ): Hiển thị Nghĩa và Từ khuyết
        // Phần Phải (Col 3 cũ): Cột chứa mảnh ghép xếp dọc
        const mainLayout = document.createElement('div');
        mainLayout.className = 'flex w-full h-full gap-6';
  
        // --- KHỐI TRÁI: DANH SÁCH TỪ ---
        const listContainer = document.createElement('div');
        listContainer.className = 'flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar';
        
        this._dropZones = [];
        this._items.forEach((it, idx) => {
            const row = document.createElement('div');
            // Flex row chứa cả nghĩa tiếng Việt và phần tiếng Anh
            row.className = 'flex items-center justify-between p-3 bg-slate-700 rounded-xl border border-slate-600';
  
            // Nghĩa tiếng Việt
            const viDiv = document.createElement('div');
            viDiv.className = 'text-green-400 text-sm font-medium w-1/3 truncate mr-2';
            viDiv.innerText = `${idx + 1}. ${this._escape(it.vi)}`;
  
            // Phần Tiếng Anh (Gốc + Ô trống sát nhau)
            const engDiv = document.createElement('div');
            engDiv.className = 'flex items-baseline justify-end flex-1 gap-0.5'; // gap-0.5 để sát nhau
  
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
        piecesContainer.className = 'w-24 bg-slate-900/50 rounded-xl p-2 flex flex-col items-center gap-3 overflow-y-auto custom-scrollbar border border-slate-700';
        
        const cutParts = this._items.map((it, idx) => ({ cut: it.cutPart, originIdx: idx }));
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
            if (tileEl) tileEl.classList.add('hidden');
  
            this._speak(item.full);
  
            if (window.GameEngine) window.GameEngine.processBattleRound(1, 0, false);
            this._checkAllCompleted();
  
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
        if (window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            speechSynthesis.speak(u);
        }
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