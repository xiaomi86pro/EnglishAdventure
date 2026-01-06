window.VOCAB_CACHE = window.VOCAB_CACHE || [];
window.VOCAB_CACHE_STATUS = 'loading'; // loading | ready | error

// Config
const CONFIG = {
    preload: {
        sampleSize: 500,
        batchSize: 500,
        batchDelay: 200
    },
    retry: {
        maxAttempts: 8,
        delayMs: 120
    },
    debug: false // Set true để bật logs
};
// expose for other modules
window.CONFIG = CONFIG;

/**
 * Preload vocabulary với progressive loading
 */
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

      // Load sample
      const { data: sample, error } = await window.supabase
          .from('vocabulary')
          .select('english_word, vietnamese_translation')
          .limit(sampleSize);

      if (error || !sample?.length) {
          throw error || new Error('Vocabulary trống');
      }

      window.VOCAB_CACHE = sample;
      window.VOCAB_CACHE_STATUS = 'ready'; // ✅ Đánh dấu sẵn sàng
      console.log('[Preload] ✅ Ready, size:', sample.length);

      // Background loading: fetch remaining in batches
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
      window.VOCAB_CACHE_STATUS = 'error'; // ❌ Đánh dấu lỗi
  }
}

// Khởi động preload khi supabase sẵn sàng
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


// ============================================
// QuestionManager
// ============================================
const QuestionManager = {
    currentQuestion: null,
    loadedTypes: {},

    /**
     * Đảm bảo có vocabulary, fallback sang fetch DB nếu cache rỗng
     */
    async ensureVocabulary(limit = 100) {
      try {
          // 1. Kiểm tra cache
          if (window.VOCAB_CACHE && window.VOCAB_CACHE.length > 0) {
              console.log('[QuestionManager] Dùng cache, size:', window.VOCAB_CACHE.length);
              return window.VOCAB_CACHE;
          }

          // 2. Đợi cache nếu đang loading (tối đa 2 giây)
          if (window.VOCAB_CACHE_STATUS === 'loading') {
              console.log('[QuestionManager] Cache đang loading, đợi...');
              const cached = await this.waitForCache(2000);
              if (cached && cached.length > 0) {
                  return cached;
              }
          }

          // 3. Fallback: Fetch trực tiếp từ DB
          console.warn('[QuestionManager] Cache không khả dụng, fetch từ DB');
          
          if (!window.supabase) {
              throw new Error('Supabase chưa sẵn sàng');
          }

          const { data, error } = await window.supabase
              .from('vocabulary')
              .select('english_word, vietnamese_translation')
              .limit(limit);

          if (error) throw error;

          if (!data || data.length === 0) {
              throw new Error('Vocabulary trống');
          }

          // Lưu vào cache cho lần sau
          window.VOCAB_CACHE = data;
          window.VOCAB_CACHE_STATUS = 'ready';
          
          console.log('[QuestionManager] ✅ Fetched và cached', data.length, 'từ');
          return data;

      } catch (err) {
          console.error('[QuestionManager] Lỗi ensureVocabulary:', err);
          
          // Last resort: Trả về cache cũ nếu có
          if (window.VOCAB_CACHE && window.VOCAB_CACHE.length > 0) {
              console.warn('[QuestionManager] Dùng cache cũ');
              return window.VOCAB_CACHE;
          }
          
          throw new Error('Không thể load vocabulary: ' + err.message);
      }
  },

  /**
   * Đợi cache sẵn sàng với timeout
   */
  async waitForCache(timeout = 2000) {
      return new Promise((resolve) => {
          const startTime = Date.now();
          
          const checkCache = () => {
              // Cache đã sẵn sàng
              if (window.VOCAB_CACHE_STATUS === 'ready' && window.VOCAB_CACHE?.length > 0) {
                  console.log('[QuestionManager] Cache đã sẵn sàng');
                  resolve(window.VOCAB_CACHE);
                  return;
              }

              // Timeout
              if (Date.now() - startTime >= timeout) {
                  console.warn('[QuestionManager] Timeout chờ cache');
                  resolve(null);
                  return;
              }

              // Tiếp tục đợi
              setTimeout(checkCache, 100);
          };

          checkCache();
      });
  },

  /**
   * Load động một QuestionType từ file
   */
  async loadQuestionType(typeNumber) {
      if (this.loadedTypes[typeNumber]) {
          return this.loadedTypes[typeNumber];
      }

      try {
          const module = await import(`./question${typeNumber}.js`);
          this.loadedTypes[typeNumber] = module.default;
          return module.default;
      } catch (error) {
          console.error(`Lỗi load QuestionType${typeNumber}:`, error);
          return null;
      }
  },

  /**
   * Load câu hỏi theo số (1, 2, 3, 4, 5...)
   */
  async loadType(typeNumber, enemyType = 'normal') {
      console.log('[QuestionManager] loadType', { typeNumber, enemyType });

      try {
          // 1. Đảm bảo có vocabulary trước
          const vocabulary = await this.ensureVocabulary(200);
          
          // 2. Destroy câu hỏi cũ
          this.currentQuestion?.destroy?.();

          // 3. Load QuestionType
          const QuestionType = await this.loadQuestionType(typeNumber);
          if (!QuestionType) {
              throw new Error(`Không thể load QuestionType${typeNumber}`);
          }

          this.currentQuestion = QuestionType;
          // Chuẩn hóa: gán toàn bộ vocabulary và 1 item đã chọn sẵn cho QuestionType
          this.currentQuestion._vocabulary = vocabulary || [];
          this.currentQuestion._vocabPick = null;
          if (Array.isArray(vocabulary) && vocabulary.length) {
            // chọn ngẫu nhiên 1 item để QuestionType dùng ngay
            this.currentQuestion._vocabPick = vocabulary[Math.floor(Math.random() * vocabulary.length)];
            if (CONFIG.debug) console.log('[QuestionManager] _vocabPick assigned', this.currentQuestion._vocabPick);
          }  

          // 4. Gắn vocabulary vào currentQuestion để QuestionType dùng
          this.currentQuestion._vocabulary = vocabulary;

          // 5. Gắn callbacks
          this.currentQuestion.onCorrect = () => this.handleQuestionCorrect();
          this.currentQuestion.onWrong = () => this.handleQuestionWrong();

          // 6. Load câu hỏi (await nếu load là async)
          if (typeof this.currentQuestion.load === 'function') {
            await Promise.resolve(this.currentQuestion.load(enemyType));
          } else {
            throw new Error(`QuestionType${typeNumber} không có hàm load`);
          }

      } catch (err) {
          console.error('[QuestionManager] Lỗi loadType:', err);
          
          // Hiển thị lỗi cho user
          const questionArea = document.getElementById('questionarea');
          if (questionArea) {
              questionArea.innerHTML = `
                  <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
                      <div class="text-6xl">❌</div>
                      <p class="text-xl font-bold text-red-600">Lỗi tải câu hỏi</p>
                      <p class="text-gray-600">${err.message}</p>
                      <button onclick="location.reload()" 
                              class="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600">
                          🔄 Tải lại trang
                      </button>
                  </div>
              `;
          }
      }
  },

    handleQuestionCorrect() {
        if (CONFIG.debug) console.log('[QuestionManager] Correct answer');

        if (!window.GameEngine?.processBattleRound) {
            console.warn('[QuestionManager] GameEngine.processBattleRound không có, fallback');
            window.GameEngine?.handleCorrect?.();
            return;
        }

        // Retry logic
        const { maxAttempts, delayMs } = CONFIG.retry;
        let attempt = 0;

        const tryCall = () => {
            attempt++;

            if (!window.GameEngine.isBattling) {
                window.GameEngine.processBattleRound(1, 0);
                return;
            }

            if (attempt >= maxAttempts) {
                console.warn('[QuestionManager] Max retries reached, forcing call');
                window.GameEngine.isBattling = false;
                window.GameEngine.processBattleRound(1, 0);
                return;
            }

            if (CONFIG.debug) console.log('[QuestionManager] Retry', attempt);
            setTimeout(tryCall, delayMs);
        };

        tryCall();
    },

    handleQuestionWrong() {
        if (CONFIG.debug) console.log('[QuestionManager] Wrong answer');

        if (window.GameEngine?.processBattleRound) {
            window.GameEngine.processBattleRound(0, 1, false);
        } else {
            window.GameEngine?.handleWrong?.();
        }
    },

    destroy() {
        this.currentQuestion?.destroy?.();
        this.currentQuestion = null;
    }
};

window.QuestionManager = QuestionManager;