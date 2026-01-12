// question_manager.js
// Quản lý câu hỏi: Hỗ trợ cả câu hỏi dạng Object và Class (Question6)

window.VOCAB_CACHE = window.VOCAB_CACHE || []; 
window.VOCAB_CACHE_STATUS = 'loading'; 

const CONFIG = {
  preload: { sampleSize: 500, batchSize: 500, batchDelay: 200 }, 
  retry: { maxAttempts: 8, delayMs: 120 }, 
  debug: false 
};
window.CONFIG = CONFIG; 

// --- Logic Preload Vocabulary ---
async function preloadVocabulary() {
  const { sampleSize, batchSize, batchDelay } = CONFIG.preload; 
  try {
    if (window.VOCAB_CACHE.length) {
      window.VOCAB_CACHE_STATUS = 'ready'; 
      return;
    }
    if (!window.supabase) {
      console.warn('[Preload] Supabase chưa sẵn sàng'); 
      return;
    }
    const { data: sample, error } = await window.supabase
      .from('vocabulary')
      .select('english_word, vietnamese_translation')
      .limit(sampleSize); 

    if (error || !sample?.length) throw error || new Error('Vocabulary trống'); 
    window.VOCAB_CACHE = sample;
    window.VOCAB_CACHE_STATUS = 'ready'; 
    console.log('[Preload] ✅ Ready, size:', sample.length); 

    // Load background các batch còn lại
    try {
      const { count } = await window.supabase
        .from('vocabulary')
        .select('id', { head: true, count: 'exact' }); 
      const total = count || window.VOCAB_CACHE.length; 
      for (let offset = window.VOCAB_CACHE.length; offset < total; offset += batchSize) {
        setTimeout(async () => {
          try {
            const { data: batch } = await window.supabase
              .from('vocabulary')
              .select('english_word, vietnamese_translation')
              .range(offset, offset + batchSize - 1); 
            if (batch?.length) {
              window.VOCAB_CACHE = window.VOCAB_CACHE.concat(batch); 
            }
          } catch (e) { console.warn('[Preload] batch fetch exception', e); }
        }, batchDelay * Math.floor((offset - window.VOCAB_CACHE.length) / batchSize)); 
      }
    } catch (e) { console.warn('[Preload] background batch load skipped', e); } 
  } catch (e) {
    console.error('[Preload] Error', e); 
    window.VOCAB_CACHE_STATUS = 'error';
  }
}

function initPreload(maxAttempts = 20, interval = 200) {
  let attempts = 0; 
  const tryInit = () => {
    attempts++;
    if (window.supabase) {
      preloadVocabulary(); 
      return;
    }
    if (attempts < maxAttempts) setTimeout(tryInit, interval); 
  };
  tryInit();
}
initPreload(); 

// --- Main QuestionManager Object ---
const QuestionManager = {
  currentQuestion: null, 
  loadedTypes: {}, 
  _lastOnCorrectTs: 0, 

  async ensureVocabulary(limit = 100) {
    try {
      if (window.VOCAB_CACHE?.length > 0) return window.VOCAB_CACHE; 
      if (window.VOCAB_CACHE_STATUS === 'loading') {
        const cached = await this.waitForCache(2000); 
        if (cached?.length > 0) return cached;
      }
      if (!window.supabase) throw new Error('Supabase chưa sẵn sàng'); 
      const { data, error } = await window.supabase
        .from('vocabulary')
        .select('english_word, vietnamese_translation')
        .limit(limit); 
      if (error || !data?.length) throw new Error('Không thể load vocabulary'); 
      window.VOCAB_CACHE = data;
      window.VOCAB_CACHE_STATUS = 'ready'; 
      return data;
    } catch (err) {
      if (window.VOCAB_CACHE?.length > 0) return window.VOCAB_CACHE; 
      throw err;
    }
  },

  async waitForCache(timeout = 2000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        if (window.VOCAB_CACHE_STATUS === 'ready' && window.VOCAB_CACHE?.length > 0) {
          resolve(window.VOCAB_CACHE); 
        } else if (Date.now() - startTime >= timeout) {
          resolve(null); 
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  async loadQuestionType(typeNumber) {
    if (this.loadedTypes[typeNumber]) return this.loadedTypes[typeNumber]; 
    try {
      const module = await import(`./question${typeNumber}.js`); 
      this.loadedTypes[typeNumber] = module.default || module;
      return this.loadedTypes[typeNumber];
    } catch (error) {
      console.error(`Lỗi load QuestionType${typeNumber}:`, error); 
      return null;
    }
  },

  async loadType(typeNumber, enemyType = 'normal') {
    try {
      const vocabulary = await this.ensureVocabulary(200); 
      this.currentQuestion?.destroy?.(); 

      const QuestionType = await this.loadQuestionType(typeNumber); 
      if (!QuestionType) throw new Error(`Không thể load QuestionType${typeNumber}`); 

      // --- Khởi tạo Instance (Hỗ trợ Class & Object) ---
      if (typeof QuestionType === 'function') {
        // Nếu là Class (như Question6)
        this.currentQuestion = new QuestionType({
          vocabPool: vocabulary,
          containerId: 'questionarea',
          config: { speakOnCorrect: true }
        }); 
      } else {
        // Nếu là Object cũ
        this.currentQuestion = QuestionType;
        this.currentQuestion._vocabulary = vocabulary || []; 
        this.currentQuestion._vocabPick = (vocabulary?.length) 
          ? vocabulary[Math.floor(Math.random() * vocabulary.length)] 
          : null; 
      }

      // --- Thiết lập Callbacks ---
      this.currentQuestion.onCorrect = (hits = 1, advanceNext = true) => {
        const now = Date.now();
        if (now - this._lastOnCorrectTs < 600) return; 
        this._lastOnCorrectTs = now;
        this.handleQuestionCorrect(hits, advanceNext); 
      };

      this.currentQuestion.onWrong = () => this.handleQuestionWrong(); 

      // --- Kích hoạt câu hỏi ---
      if (typeof this.currentQuestion.init === 'function') {
        await Promise.resolve(this.currentQuestion.init(enemyType)); 
      } else if (typeof this.currentQuestion.load === 'function') {
        await Promise.resolve(this.currentQuestion.load(enemyType)); 
      } else {
        throw new Error(`Cấu trúc câu hỏi ${typeNumber} không hợp lệ`); 
      }

    } catch (err) {
      this._renderError(err); 
    }
  },

  handleQuestionCorrect(hits = 1, advanceNext = true) {
    try {
      const q = this.currentQuestion;
      const historyEl = document.getElementById('answers-history');
      let entry = null;

      // Lấy dữ liệu từ Question6 class (_lastAnswered)  hoặc Object cũ (_vocabPick) [cite: 56]
      if (q?._lastAnswered) {
        entry = { en: q._lastAnswered.en, vi: q._lastAnswered.vi }; 
      } else {
        const data = q?.currentData || q?._vocabPick;
        if (data) {
          entry = { 
            en: data.english_word || data.english || '', 
            vi: data.vietnamese_translation || data.vietnamese || '' 
          }; 
        }
      }

      // Cập nhật giao diện lịch sử
      if (entry && historyEl) {
        const textKey = `${entry.en} — ${entry.vi}`; 
        if (!historyEl.querySelector(`[data-key="${encodeURIComponent(textKey)}"]`)) {
          const node = document.createElement('div');
          node.className = 'answer-history-item p-2 rounded bg-white/80 border mb-2';
          node.setAttribute('data-key', encodeURIComponent(textKey));
          node.innerHTML = `<div class="font-bold text-sm text-blue-600">${entry.en}</div>
                            <div class="text-xs text-gray-600">${entry.vi}</div>`; 
          historyEl.appendChild(node);
        }
      }

      this._triggerBattleRound(hits, 0, advanceNext); 
    } catch (e) { console.error('[QM] handleQuestionCorrect error', e); }
  },

  handleQuestionWrong() {
    this._triggerBattleRound(0, 1, false); 
  },

  _triggerBattleRound(hits, misses, advance) {
    if (window.GameEngine?.processBattleRound) {
      window.GameEngine.processBattleRound(Number(hits), Number(misses), !!advance); 
    }
  },

  _renderError(err) {
    const area = document.getElementById('questionarea');
    if (area) {
      area.innerHTML = `<div class="p-8 text-center"><p class="text-red-600 font-bold">${err.message}</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Tải lại</button></div>`; 
    }
  },

  destroy() {
    this.currentQuestion?.destroy?.(); 
    this.currentQuestion = null;
  }
};

window.QuestionManager = QuestionManager; 