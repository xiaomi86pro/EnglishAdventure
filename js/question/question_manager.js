// question_manager.js
// Cleaned QuestionManager: forward args, debounce onCorrect, handleQuestionCorrect supports advanceNext

window.VOCAB_CACHE = window.VOCAB_CACHE || [];
window.VOCAB_CACHE_STATUS = 'loading';

const CONFIG = {
  preload: { sampleSize: 500, batchSize: 500, batchDelay: 200 },
  retry: { maxAttempts: 8, delayMs: 120 },
  debug: false
};
window.CONFIG = CONFIG;

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

    try {
      const { error: headErr, count } = await window.supabase
        .from('vocabulary')
        .select('id', { head: true, count: 'exact' });
      const total = count || window.VOCAB_CACHE.length;
      for (let offset = window.VOCAB_CACHE.length; offset < total; offset += batchSize) {
        setTimeout(async () => {
          try {
            const { data: batch, error: batchErr } = await window.supabase
              .from('vocabulary')
              .select('english_word, vietnamese_translation')
              .range(offset, offset + batchSize - 1);
            if (!batchErr && batch && batch.length) {
              window.VOCAB_CACHE = window.VOCAB_CACHE.concat(batch);
              console.log('[Preload] appended batch, cache size=', window.VOCAB_CACHE.length);
            }
          } catch (e) { console.warn('[Preload] batch fetch exception', e); }
        }, batchDelay * Math.floor((offset - window.VOCAB_CACHE.length) / batchSize));
      }
    } catch (e) {
      console.warn('[Preload] background batch load skipped', e);
    }

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
    if (attempts >= maxAttempts) {
      console.warn('[Preload] supabase not available after attempts:', attempts);
      return;
    }
    setTimeout(tryInit, interval);
  };
  tryInit();
}
initPreload();

const QuestionManager = {
  currentQuestion: null,
  loadedTypes: {},

  async ensureVocabulary(limit = 100) {
    try {
      if (window.VOCAB_CACHE && window.VOCAB_CACHE.length > 0) {
        if (CONFIG.debug) console.log('[QuestionManager] Using cache, size:', window.VOCAB_CACHE.length);
        return window.VOCAB_CACHE;
      }
      if (window.VOCAB_CACHE_STATUS === 'loading') {
        if (CONFIG.debug) console.log('[QuestionManager] Cache loading, waiting...');
        const cached = await this.waitForCache(2000);
        if (cached && cached.length > 0) return cached;
      }
      if (!window.supabase) throw new Error('Supabase chưa sẵn sàng');
      console.warn('[QuestionManager] Cache not available, fetching from DB');
      const { data, error } = await window.supabase
        .from('vocabulary')
        .select('english_word, vietnamese_translation')
        .limit(limit);
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Vocabulary trống');
      window.VOCAB_CACHE = data;
      window.VOCAB_CACHE_STATUS = 'ready';
      console.log('[QuestionManager] ✅ Fetched and cached', data.length);
      return data;
    } catch (err) {
      console.error('[QuestionManager] ensureVocabulary error:', err);
      if (window.VOCAB_CACHE && window.VOCAB_CACHE.length > 0) {
        console.warn('[QuestionManager] Using old cache');
        return window.VOCAB_CACHE;
      }
      throw new Error('Không thể load vocabulary: ' + (err.message || err));
    }
  },

  async waitForCache(timeout = 2000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkCache = () => {
        if (window.VOCAB_CACHE_STATUS === 'ready' && window.VOCAB_CACHE?.length > 0) {
          if (CONFIG.debug) console.log('[QuestionManager] Cache ready');
          resolve(window.VOCAB_CACHE);
          return;
        }
        if (Date.now() - startTime >= timeout) {
          if (CONFIG.debug) console.warn('[QuestionManager] Cache wait timeout');
          resolve(null);
          return;
        }
        setTimeout(checkCache, 100);
      };
      checkCache();
    });
  },

  async loadQuestionType(typeNumber) {
    if (this.loadedTypes[typeNumber]) return this.loadedTypes[typeNumber];
    try {
      const module = await import(`./question${typeNumber}.js`);
      this.loadedTypes[typeNumber] = module.default;
      return module.default;
    } catch (error) {
      console.error(`Lỗi load QuestionType${typeNumber}:`, error);
      return null;
    }
  },

  async loadType(typeNumber, enemyType = 'normal') {
    console.log('[QuestionManager] loadType', { typeNumber, enemyType });

    try {
      const vocabulary = await this.ensureVocabulary(200);

      // destroy old question
      this.currentQuestion?.destroy?.();

      const QuestionType = await this.loadQuestionType(typeNumber);
      if (!QuestionType) throw new Error(`Không thể load QuestionType${typeNumber}`);

      this.currentQuestion = QuestionType;

      // attach vocabulary and pick
      this.currentQuestion._vocabulary = vocabulary || [];
      this.currentQuestion._vocabPick = null;
      if (Array.isArray(vocabulary) && vocabulary.length) {
        this.currentQuestion._vocabPick = vocabulary[Math.floor(Math.random() * vocabulary.length)];
        if (CONFIG.debug) console.log('[QuestionManager] _vocabPick assigned', this.currentQuestion._vocabPick);
      }

      // Debounced forwarding: prevent duplicate rapid calls
      this._lastOnCorrectTs = this._lastOnCorrectTs || 0;
      this.currentQuestion.onCorrect = (...args) => {
        const now = Date.now();
        if (now - (this._lastOnCorrectTs || 0) < 600) {
          if (CONFIG.debug) console.log('[QM] onCorrect debounced, skipping duplicate', args);
          return;
        }
        this._lastOnCorrectTs = now;
        if (CONFIG.debug) console.log('[QM] onCorrect forwarded args =', args);
        try {
          this.handleQuestionCorrect(...args);
        } catch (e) {
          console.error('[QM] onCorrect forward error', e);
          this.handleQuestionCorrect(1, false);
        }
      };

      this.currentQuestion.onWrong = (...args) => {
        if (CONFIG.debug) console.log('[QM] onWrong forwarded args =', args);
        try {
          this.handleQuestionWrong(...args);
        } catch (e) {
          console.error('[QM] onWrong forward error', e);
          this.handleQuestionWrong();
        }
      };

      if (typeof this.currentQuestion.load === 'function') {
        await Promise.resolve(this.currentQuestion.load(enemyType));
      } else {
        throw new Error(`QuestionType${typeNumber} không có hàm load`);
      }

    } catch (err) {
      console.error('[QuestionManager] Lỗi loadType:', err);
      const questionArea = document.getElementById('questionarea');
      if (questionArea) {
        questionArea.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div class="text-6xl">❌</div>
            <p class="text-xl font-bold text-red-600">Lỗi tải câu hỏi</p>
            <p class="text-gray-600">${err.message}</p>
            <button onclick="location.reload()" class="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600">
              🔄 Tải lại trang
            </button>
          </div>
        `;
      }
    }
  },

  handleQuestionCorrect(hits = 1, advanceNext = true) {
    try {
      if (window.CONFIG?.debug) console.log('[QuestionManager] handleQuestionCorrect', { hits, advanceNext });
  
      // --- Append single entry to answers-history if available ---
      try {
        const q = this.currentQuestion;
        const historyEl = document.getElementById('answers-history');
  
        // Prefer explicit lastAnswered set by QuestionType (single word that was just solved)
        let entry = null;
        if (q && q._lastAnswered && q._lastAnswered.en) {
          entry = { en: q._lastAnswered.en, vi: q._lastAnswered.vi || '' };
          // clear after consuming to avoid duplicate logs
          try { delete q._lastAnswered; } catch(e){ q._lastAnswered = null; }
        } else {
          // Fallback: try to infer from currentData for single-question types
          const data = q?.currentData || q?._vocabPick || null;
          if (data) {
            if (data.english_word || data.vietnamese_translation) {
              entry = { en: data.english_word || data.english || '', vi: data.vietnamese_translation || data.vietnamese || '' };
            } else if (Array.isArray(data.selected) && data.selected.length === 1) {
              const w = data.selected[0];
              entry = { en: w.english || '', vi: w.vietnamese || '' };
            }
          }
        }
  
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
      } catch (e) {
        console.warn('[QuestionManager] answers-history log failed', e);
      }
  
      // --- Call GameEngine.processBattleRound with retry guard ---
      const callProcess = (h, adv) => {
        if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
          window.GameEngine.processBattleRound(Number(h) || 1, 0, !!adv);
        } else if (window.GameEngine && typeof window.GameEngine.handleCorrect === 'function') {
          window.GameEngine.handleCorrect(Number(h) || 1, !!adv);
        } else {
          console.warn('[QuestionManager] No GameEngine battle entry found');
        }
      };
  
      const retryCfg = (window.CONFIG && window.CONFIG.retry) || { maxAttempts: 8, delayMs: 120 };
      let attempt = 0;
  
      const tryCall = () => {
        attempt++;
        if (window.GameEngine && window.GameEngine.isBattling) {
          if (attempt >= retryCfg.maxAttempts) {
            console.warn('[QuestionManager] Max retries reached, forcing call');
            try { if (window.GameEngine) window.GameEngine.isBattling = false; } catch(e){}
            callProcess(hits, advanceNext);
            return;
          }
          if (window.CONFIG?.debug) console.log('[QuestionManager] Retry handleQuestionCorrect attempt', attempt);
          setTimeout(tryCall, retryCfg.delayMs);
          return;
        }
        callProcess(hits, advanceNext);
      };
  
      tryCall();
    } catch (err) {
      console.error('[QuestionManager] handleQuestionCorrect top-level error', err);
      // best-effort fallback
      try {
        if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
          window.GameEngine.processBattleRound(Number(hits) || 1, 0, !!advanceNext);
        }
      } catch (e) { console.error('[QuestionManager] fallback processBattleRound failed', e); }
    }
  },

  handleQuestionWrong() {
    if (CONFIG.debug) console.log('[QuestionManager] Wrong answer');
    if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
      window.GameEngine.processBattleRound(0, 1, false);
    } else if (window.GameEngine && typeof window.GameEngine.handleWrong === 'function') {
      window.GameEngine.handleWrong();
    } else {
      console.warn('[QuestionManager] No GameEngine to handle wrong answer');
    }
  },

  destroy() {
    this.currentQuestion?.destroy?.();
    this.currentQuestion = null;
  }
};

window.QuestionManager = QuestionManager;