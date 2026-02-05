// js/question/question6.js
// Question Type 6: Kéo thả đuôi từ (Suffix Drag & Drop) - Vertical & Merged Style - Class Version

class Question6 {
    constructor(opts = {}) {
        this._vocabulary = opts.vocabPool || [];
        this.containerId = opts.containerId || "questionarea";
        this.onCorrect = opts.onCorrect || null;
        this.onWrong = opts.onWrong || null;
  
        this.autoReload = false;
        this.damageOnHint = 5;
        this.currentData = [];
  
        this._draggables = [];
        this._dropZones = [];
        this._items = [];
        this._currentDrag = null;
        this._destroyed = false;
    }
  
    async load(enemyType = "normal") {
        console.log("QuestionType6.load called (Vertical Layout)");
        this._destroyed = false;
  
        let pool = this._vocabulary || [];
        if (!pool || pool.length === 0) pool = window.VOCAB_CACHE || [];
        if (pool.length === 0) {
            const area = document.getElementById(this.containerId);
            if (area) area.innerHTML = "<div class='text-white p-4'>Đang tải dữ liệu...</div>";
            setTimeout(() => this.load(enemyType), 500);
            return;
        }
  
        this._selectWords(pool, 5);
        this.render();
    }
  
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
    }
  
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = '';
  
        // Style nội bộ cho hiệu ứng
        const style = document.createElement('style');
        style.innerHTML = `
            .q6-drag-dragging { opacity: 0.5; transform: scale(0.95); }
            .q6-zone-over { background-color: #dcfce7 !important; border-color: #22c55e !important; transform: scale(1.1); }
            .shake { animation: shake 0.5s; }
            @keyframes shake { 0%{transform:translateX(0)} 25%{transform:translateX(5px)} 50%{transform:translateX(-5px)} 75%{transform:translateX(5px)} 100%{transform:translateX(0)} }
            
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
  
        const mainLayout = document.createElement('div');
        mainLayout.className = 'flex w-full h-full gap-[2cm] justify-center items-stretch mt-4';
          
        const listContainer = document.createElement('div');
        listContainer.className = 'flex-initial flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar';
  
        this._dropZones = [];
        this._items.forEach((it, idx) => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-5 bg-slate-700/30 p-2 rounded-xl h-14 w-full';
  
            const viDiv = document.createElement('div');
            viDiv.className = 'text-green-400 font-medium text-lg ml-2 leading-none flex-none w-[180px] truncate';
            viDiv.innerText = `${idx + 1}. ${this._escape(it.vi)}`;
  
            const engDiv = document.createElement('div');
            engDiv.className = 'flex items-center justify-end gap-1 min-w-[150px] h-12';
  
            const rootSpan = document.createElement('span');
            rootSpan.className = 'text-2xl font-bold text-white tracking-widest leading-none';          rootSpan.innerText = it.leftPart;
  
            const zone = document.createElement('div');
            zone.className = 'min-w-[60px] h-10 px-2 ml-1 flex items-center justify-center border-b-4 border-dashed border-slate-400 text-slate-400 text-xl font-bold transition-all leading-none';
            
            zone.setAttribute('data-index', idx);
            zone.setAttribute('data-expected', it.cutPart);
            zone.innerText = '__'; 
  
            this._dropZones.push(zone);
            engDiv.appendChild(rootSpan);
            engDiv.appendChild(zone);
  
            row.appendChild(viDiv);
            row.appendChild(engDiv);
            listContainer.appendChild(row);
        });
  
        const piecesContainer = document.createElement('div');
        piecesContainer.className = 'w-24 self-start flex-none bg-slate-900/50 rounded-xl p-2 flex flex-col items-center gap-3 overflow-y-auto custom-scrollbar border border-slate-700 min-h-[300px]';
        
        const cutParts = this._items.map((it, idx) => ({ cut: it.cutPart, originIdx: idx }));
        this._shuffle(cutParts);
  
        this._draggables = [];
        cutParts.forEach(cp => {
            const tile = document.createElement('div');
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
    }
  
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
            zone.addEventListener('click', () => {
                if (this._currentDrag) {
                   const cut = this._currentDrag.getAttribute('data-cut');
                   const origin = this._currentDrag.getAttribute('data-origin');
                   this._handleDrop(zone, cut, origin);
                }
            });
        });
    }
  
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
          item.filled = true;
      
          // Tìm container chứa từ
          const engDiv = zone.parentElement;
      
          // Xoá root + zone
          engDiv.innerHTML = '';
      
          // Tạo span mới cho từ hoàn chỉnh
          const fullWord = document.createElement('span');
          fullWord.innerText = item.full;
          fullWord.className =
              'text-2xl font-bold tracking-widest';
          fullWord.style.color = '#22c55e'; // xanh chắc chắn
      
          engDiv.appendChild(fullWord);
      
          // Ẩn mảnh kéo
          if (tileEl) tileEl.classList.add('invisible', 'pointer-events-none');
      
          if (window.GameEngine)
              window.GameEngine.processBattleRound(1, 0, false);
      
          this._checkAllCompleted();
          this._speak(item.full);
      }
      
      
       else {
            if (tileEl) {
                tileEl.classList.add('bg-red-500', 'shake');
                setTimeout(() => tileEl.classList.remove('bg-red-500', 'shake'), 500);
            }
            if (window.GameEngine) window.GameEngine.processBattleRound(0, 1, false);
        }
    }
  
    _checkAllCompleted() {
        const allDone = this._items.every(i => i.filled);
        if (allDone) {
            setTimeout(() => {
                if (typeof this.onCorrect === 'function') this.onCorrect(); 
                else if (window.GameEngine) window.GameEngine.processBattleRound(1, 0, true);
            }, 1000);
        }
    }
  
    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
  
    _escape(s) {
        return String(s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
  
    _speak(text) {
        if (!text || !window.speechSynthesis || this._destroyed) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.9;
        const voices = window.speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.includes('en'));
        if (targetVoice) u.voice = targetVoice;
        window.speechSynthesis.speak(u);
    }
  
    useHint() {
        if (this._destroyed) return;
        const targetIndex = this._items.findIndex(item => !item.filled);
        if (targetIndex === -1) return; 
        
        const targetItem = this._items[targetIndex];
        if (window.GameEngine && window.GameEngine.player) {
            window.GameEngine.player.hp_current = Math.max(0, window.GameEngine.player.hp_current - (this.damageOnHint || 5));
            window.GameEngine.updateAllUI();
            if (window.GameEngine?.effectsUtil) {
                window.GameEngine.effectsUtil.showDamage('battleview', 'hero', this.damageOnHint || 5);
            }
        }
        
        const zone = this._dropZones[targetIndex];
        const tile = this._draggables.find(d => 
            d.getAttribute('data-cut') === targetItem.cutPart && 
            d.getAttribute('data-origin') == targetIndex && 
            !d.classList.contains('hidden')
        );
  
        if (zone) zone.classList.add('bg-yellow-500/20', 'border-yellow-400', 'text-yellow-300', 'scale-110');
        if (tile) tile.classList.add('bg-yellow-500', 'ring-4', 'ring-yellow-300', 'scale-110', 'z-50');
  
        setTimeout(() => {
            if (this._destroyed) return;
            if (zone) zone.classList.remove('bg-yellow-500/20', 'border-yellow-400', 'text-yellow-300', 'scale-110');
            if (tile) tile.classList.remove('bg-yellow-500', 'ring-4', 'ring-yellow-300', 'scale-110', 'z-50');
        }, 1500);
    }
  
    destroy() {
        this._destroyed = true;
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = "";
        this._draggables = [];
        this._dropZones = [];
    }
  }
  
  export default Question6;
  window.Question6 = Question6;