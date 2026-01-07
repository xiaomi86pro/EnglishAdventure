// question6.js
// Single-file Question6 implementation
// Usage: const q6 = new Question6({ vocabPool, containerId: 'questionarea' });
// Then register q6 with your QuestionManager or set q6.onCorrect/onWrong from outside.

class Question6 {
    constructor(opts = {}) {
      this.vocabPool = opts.vocabPool || []; // array of { english, vietnamese }
      this.containerId = opts.containerId || 'questionarea';
      this.wordCount = opts.wordCount || 5;
      this.minLength = opts.minLength || 4;
      this.onCorrect = opts.onCorrect || null; // optional callback set by QuestionManager
      this.onWrong = opts.onWrong || null;
      this._items = []; // internal items: { full, leftPart, cutPart, vi, filled }
      this._draggables = [];
      this._dropZones = [];
      this._el = null;
      this._destroyed = false;
      this._config = Object.assign({
        removeOnWrong: true, // hide cut tile on wrong
        speakOnCorrect: false // optional: speak word when correct
      }, opts.config || {});
    }
  
    // Public: load data and render
    init() {
      this._destroyed = false;
      this._selectWords();
      this._render();
      this._attachDragDrop();
    }
  
    // Choose words from pool
    _selectWords() {
      const pool = (this.vocabPool || []).filter(w => (w.english || '').length >= this.minLength);
      if (pool.length < this.wordCount) {
        console.warn('[Question6] not enough words in pool, using available', pool.length);
      }
      const shuffled = this._shuffle(pool.slice());
      const chosen = shuffled.slice(0, Math.min(this.wordCount, shuffled.length));
      this._items = chosen.map(w => {
        const full = (w.english || '').toUpperCase();
        const vi = w.vietnamese || '';
        const cutPart = full.slice(-2);
        const leftPart = full.slice(0, full.length - 2);
        return { full, leftPart, cutPart, vi, filled: false };
      });
    }
  
    // Render HTML
    _render() {
      const container = document.getElementById(this.containerId);
      if (!container) {
        throw new Error(`[Question6] container #${this.containerId} not found`);
      }
      container.innerHTML = ''; // clear
  
      const wrapper = document.createElement('div');
      wrapper.className = 'q6-wrapper grid grid-cols-3 gap-4 p-4';
  
      // Column 1: Vietnamese meanings
      const col1 = document.createElement('div');
      col1.className = 'q6-col col-vi space-y-3';
      this._items.forEach((it, idx) => {
        const row = document.createElement('div');
        row.className = 'q6-row flex items-center p-2 bg-white/80 rounded border';
        row.innerHTML = `<div class="q6-index w-6 text-sm text-gray-600 mr-2">${idx+1}.</div>
                         <div class="q6-vi text-sm text-green-700">${this._escape(it.vi)}</div>`;
        col1.appendChild(row);
      });
  
      // Column 2: leftPart with drop zones
      const col2 = document.createElement('div');
      col2.className = 'q6-col col-left space-y-3';
      this._items.forEach((it, idx) => {
        const row = document.createElement('div');
        row.className = 'q6-row p-2 bg-white/80 rounded border flex items-center justify-between';
        const left = document.createElement('div');
        left.className = 'left-part text-lg font-mono';
        left.textContent = it.leftPart;
        const drop = document.createElement('div');
        drop.className = 'drop-zone ml-3 px-3 py-1 border-2 border-dashed rounded bg-gray-50';
        drop.setAttribute('data-index', idx);
        drop.setAttribute('data-expected', it.cutPart);
        drop.textContent = '__';
        row.appendChild(left);
        row.appendChild(drop);
        col2.appendChild(row);
        this._dropZones.push(drop);
      });
  
      // Column 3: shuffled cut parts (draggables)
      const col3 = document.createElement('div');
      col3.className = 'q6-col col-cut space-y-3';
      const cutParts = this._items.map(it => ({ cut: it.cutPart, idx: this._items.indexOf(it) }));
      this._shuffle(cutParts);
      cutParts.forEach(cp => {
        const tile = document.createElement('div');
        tile.className = 'cut-tile inline-block px-3 py-2 bg-blue-100 border rounded cursor-move text-lg font-bold select-none';
        tile.setAttribute('draggable', 'true');
        tile.setAttribute('data-cut', cp.cut);
        tile.setAttribute('data-origin', cp.idx);
        tile.textContent = cp.cut;
        col3.appendChild(tile);
        this._draggables.push(tile);
      });
  
      // Append columns
      wrapper.appendChild(col1);
      wrapper.appendChild(col2);
      wrapper.appendChild(col3);
  
      // Optional small CSS to ensure basic layout if not using tailwind
      const style = document.createElement('style');
      style.textContent = `
        .q6-wrapper { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .drop-zone { min-width: 56px; text-align: center; }
        .cut-tile.dragging { opacity: 0.4; transform: scale(0.98); }
        .drop-zone.over { background: #e6fffa; border-color: #34d399; }
        .cut-tile.hidden { visibility: hidden; }
      `;
      container.appendChild(style);
      container.appendChild(wrapper);
      this._el = wrapper;
    }
  
    // Attach drag & drop handlers
    _attachDragDrop() {
      // dragstart / dragend for tiles
      this._draggables.forEach(tile => {
        tile.addEventListener('dragstart', (ev) => {
          ev.dataTransfer.setData('text/plain', tile.getAttribute('data-cut'));
          ev.dataTransfer.setData('text/origin', tile.getAttribute('data-origin'));
          tile.classList.add('dragging');
          // store reference for fallback
          this._currentDrag = tile;
        });
        tile.addEventListener('dragend', () => {
          tile.classList.remove('dragging');
          this._currentDrag = null;
        });
      });
  
      // drop zones
      this._dropZones.forEach(zone => {
        zone.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          zone.classList.add('over');
        });
        zone.addEventListener('dragleave', () => {
          zone.classList.remove('over');
        });
        zone.addEventListener('drop', (ev) => {
          ev.preventDefault();
          zone.classList.remove('over');
          const cut = ev.dataTransfer.getData('text/plain');
          const origin = ev.dataTransfer.getData('text/origin');
          this._handleDrop(zone, cut, origin);
        });
  
        // also support click-to-place for touch fallback
        zone.addEventListener('click', () => {
          if (this._currentDrag) {
            const cut = this._currentDrag.getAttribute('data-cut');
            const origin = this._currentDrag.getAttribute('data-origin');
            this._handleDrop(zone, cut, origin);
          }
        });
      });
    }
  
    // Drop handling logic
    _handleDrop(zone, cut, origin) {
      if (this._destroyed) return;
      const expected = zone.getAttribute('data-expected');
      const idx = Number(zone.getAttribute('data-index'));
      // If already filled, ignore
      if (this._items[idx].filled) return;
  
      const tileEl = this._findDraggableByCutAndOrigin(cut, origin);
  
      if (cut === expected) {
        // correct
        this._items[idx].filled = true;
        // show full word in left area
        zone.textContent = this._items[idx].full;
        zone.classList.add('filled', 'text-blue-700', 'font-bold');
        if (tileEl) tileEl.classList.add('hidden');
  
        // set lastAnswered for history
        this._lastAnswered = { en: this._items[idx].full, vi: this._items[idx].vi };
  
        // optional speak
        if (this._config.speakOnCorrect && window.speechSynthesis) {
          try { speechSynthesis.cancel(); } catch(e){}
          try {
            const u = new SpeechSynthesisUtterance(this._items[idx].full);
            u.lang = 'en-US';
            speechSynthesis.speak(u);
          } catch(e){}
        }
  
        // call onCorrect if provided, else fallback to GameEngine
        try {
          if (typeof this.onCorrect === 'function') {
            this.onCorrect(1, false);
          } else if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
            // call GameEngine directly as fallback
            window.GameEngine.processBattleRound(1, 0, false);
          }
        } catch (e) {
          console.warn('[Question6] onCorrect call failed', e);
        }
      } else {
        // wrong
        if (tileEl) {
          if (this._config.removeOnWrong) {
            tileEl.classList.add('hidden');
          } else {
            // visual feedback
            tileEl.classList.add('shake');
            setTimeout(()=> tileEl.classList.remove('shake'), 300);
          }
        }
  
        // call onWrong if provided
        try {
          if (typeof this.onWrong === 'function') {
            this.onWrong();
          } else if (window.GameEngine && typeof window.GameEngine.handleWrong === 'function') {
            window.GameEngine.handleWrong();
          } else if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
            // fallback: treat wrong as enemy hit (call with 0 hits and advanceNext false)
            window.GameEngine.processBattleRound(0, 1, false);
          }
        } catch (e) {
          console.warn('[Question6] onWrong call failed', e);
        }
      }
  
      // After each drop, check if all filled -> final advance
      const allFilled = this._items.every(it => it.filled);
      if (allFilled) {
        // set lastAnswered to last filled (already set on correct)
        try {
          if (typeof this.onCorrect === 'function') {
            this.onCorrect(1, true);
          } else if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
            window.GameEngine.processBattleRound(1, 0, true);
          }
        } catch (e) {
          console.warn('[Question6] final onCorrect failed', e);
        }
      }
    }
  
    // Helper to find draggable element
    _findDraggableByCutAndOrigin(cut, origin) {
      return this._draggables.find(d => d.getAttribute('data-cut') === cut && d.getAttribute('data-origin') === origin);
    }
  
    // Utility shuffle
    _shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  
    // Escape text for HTML
    _escape(s) {
      if (!s) return '';
      return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
  
    // Public destroy to cleanup listeners and stop speech
    destroy() {
      this._destroyed = true;
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      // remove event listeners from draggables and dropzones
      this._draggables.forEach(d => {
        d.removeAttribute('draggable');
        d.replaceWith(d.cloneNode(true)); // quick detach listeners
      });
      this._dropZones.forEach(z => {
        z.replaceWith(z.cloneNode(true));
      });
      // clear DOM
      if (this._el && this._el.parentNode) {
        this._el.parentNode.removeChild(this._el);
      }
      this._draggables = [];
      this._dropZones = [];
      this._items = [];
      this._el = null;
    }
  }
  
  // Export for module systems or attach to window
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Question6;
  } else {
    window.Question6 = Question6;
  }