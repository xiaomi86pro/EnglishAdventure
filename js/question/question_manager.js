window.VOCAB_CACHE = window.VOCAB_CACHE || [];

/**
 * Preload: sampleSize (500) nhanh, then background fetch in batches.
 */
async function preloadVocabulary(sampleSize = 200, batchSize = 200) {
  try {
    if (window.VOCAB_CACHE && window.VOCAB_CACHE.length) {
      console.log('[Preload] VOCAB_CACHE already loaded, size=', window.VOCAB_CACHE.length);
      return;
    }
    if (!window.supabase) {
      console.warn('[Preload] supabase not available yet');
      return;
    }

    // 1) Lấy sample nhanh (limit sampleSize)
    const { data: sample, error: sampleErr } = await window.supabase
      .from('vocabulary')
      .select('english_word, vietnamese_translation')
      .limit(sampleSize);
    if (!sampleErr && sample && sample.length) {
      window.VOCAB_CACHE = sample.slice();
      console.log('[Preload] VOCAB_CACHE sample size =', window.VOCAB_CACHE.length);
    } else {
      console.warn('[Preload] sample fetch returned empty or error', sampleErr);
    }

    // 2) Background: fetch toàn bộ theo lô (non-blocking)
    // Lấy tổng số bản ghi (nếu supabase hỗ trợ count)
    window.supabase
      .from('vocabulary')
      .select('id', { count: 'exact', head: true })
      .then(async ({ error, count }) => {
        if (error) {
          console.warn('[Preload] count fetch error', error);
          // fallback: try to fetch more pages until no more results
        } else {
          const total = count || 0;
          console.log('[Preload] total vocabulary count =', total);
          // Nếu total <= sampleSize thì đã xong
          if (total <= sampleSize) return;

          // Fetch remaining in batches
          for (let offset = sampleSize; offset < total; offset += batchSize) {
            // Non-blocking: schedule each batch with small delay to avoid spiking
            ((off) => {
              setTimeout(async () => {
                try {
                  const { data, error: batchErr } = await window.supabase
                    .from('vocabulary')
                    .select('english_word, vietnamese_translation')
                    .range(off, off + batchSize - 1);
                  if (!batchErr && data && data.length) {
                    // append unique items (simple concat; dedupe optional)
                    window.VOCAB_CACHE = window.VOCAB_CACHE.concat(data);
                    console.log('[Preload] appended batch, cache size=', window.VOCAB_CACHE.length);
                  } else {
                    console.warn('[Preload] batch fetch error or empty', batchErr);
                  }
                } catch (e) {
                  console.warn('[Preload] batch fetch exception', e);
                }
              }, 200 * Math.floor(off / batchSize)); // stagger requests
            })(offset);
          }
        }
      }).catch(e => console.warn('[Preload] count request failed', e));

  } catch (e) {
    console.error('[Preload] error', e);
  }
};

// Kick off preload
preloadVocabulary(500, 500);


const QuestionManager = {
    
    currentQuestion: null,
    loadedTypes: {},
    
    /**
     * Load động một QuestionType từ file
     */
    async loadQuestionType(typeNumber) {
        try {
            if (this.loadedTypes[typeNumber]) {
                return this.loadedTypes[typeNumber];
            }

            const module = await import(`./question${typeNumber}.js`);
            const qType = module.default;
            this.loadedTypes[typeNumber] = qType;
            
            return qType;
        } catch (error) {
            console.error(`Lỗi load QuestionType${typeNumber}:`, error);
            return null;
        }
    },
    
    /**
     * Load câu hỏi theo số (1, 2, 3, 4, 5...)
     * KHÔNG dựa vào enemyType nữa
     */
    async loadType(typeNumber, enemyType) {
        // Debug log để kiểm tra tham số
        console.log('[DEBUG] QuestionManager.loadType called with', { typeNumber, enemyType });

        // Nếu enemyType không được truyền, lấy fallback từ GameEngine nếu có
        const et = (typeof enemyType !== 'undefined') ? enemyType : (window.GameEngine?.monster?.type || 'normal');

        // Dọn câu hỏi cũ
        if (this.currentQuestion && typeof this.currentQuestion.destroy === 'function') {
            this.currentQuestion.destroy();
        }

        // Import module tương ứng
        const QuestionType = await this.loadQuestionType(typeNumber);
        if (!QuestionType) {
            console.error(`Không thể load QuestionType${typeNumber}`);
            return;
        }

        this.currentQuestion = QuestionType;

        // Gắn callback
        this.currentQuestion.onCorrect = () => this.handleQuestionCorrect();
        this.currentQuestion.onWrong = () => this.handleQuestionWrong();

        // Prepare a selected item from cache if available
let preselected = null;
if (window.VOCAB_CACHE && window.VOCAB_CACHE.length) {
  preselected = window.VOCAB_CACHE[Math.floor(Math.random() * window.VOCAB_CACHE.length)];
}

// Gọi hàm load của QuestionType
if (typeof this.currentQuestion.load === 'function') {
  try {
    // Nếu load nhận tham số (length > 0) thì truyền et và data nếu hỗ trợ
    if (this.currentQuestion.load.length > 0) {
      // Nếu QuestionType.load expects (enemyType) keep compatibility:
      // pass enemyType first; if it can accept an object, it can read from window._preloadedData
      // We'll set a temporary pointer so QuestionType can read it if implemented
      if (preselected) {
        this.currentQuestion._preloadedData = preselected;
      }
      this.currentQuestion.load(et);
    } else {
      // load() không nhận tham số: set preloaded data on the object and call load()
      if (preselected) {
        this.currentQuestion._preloadedData = preselected;
      }
      this.currentQuestion.load();
    }
  } catch (err) {
    console.warn('[QuestionManager] load() threw, retrying without params', err);
    try {
      if (preselected) this.currentQuestion._preloadedData = preselected;
      this.currentQuestion.load();
    } catch(e){ console.error('QuestionType.load failed', e); }
  }
} else {
  console.error(`QuestionType${typeNumber} không có hàm load`);
}
    },
    
    // Thêm vào QuestionManager
    prefetchNext() {
        try {
            if (window.VOCAB_CACHE && window.VOCAB_CACHE.length) {
                this.nextPreloadedData = window.VOCAB_CACHE[Math.floor(Math.random() * window.VOCAB_CACHE.length)];
                console.log('[QuestionManager] prefetchNext selected from VOCAB_CACHE');
                return;
            }
            // fallback: non-blocking fetch a small batch
            if (window.supabase) {
                window.supabase
                    .from('vocabulary')
                    .select('english_word, vietnamese_translation')
                    .limit(10)
                    .then(({ data, error }) => {
                        if (!error && data && data.length) {
                            window.VOCAB_CACHE = (window.VOCAB_CACHE || []).concat(data);
                            this.nextPreloadedData = data[Math.floor(Math.random() * data.length)];
                            console.log('[QuestionManager] prefetchNext fetched and cached small batch');
                        }
                    }).catch(e => console.warn('[QuestionManager] prefetchNext error', e));
            }
        } catch (e) {
            console.warn('[QuestionManager] prefetchNext exception', e);
        }
    },
    
    handleQuestionCorrect() {
        try {
            console.log('[QuestionManager] handleQuestionCorrect called');
    
            // Nếu không có GameEngine hoặc processBattleRound thì fallback
            if (!window.GameEngine || typeof window.GameEngine.processBattleRound !== 'function') {
                console.warn('[QuestionManager] GameEngine.processBattleRound not available, trying fallback handleCorrect');
                if (window.GameEngine && typeof window.GameEngine.handleCorrect === 'function') {
                    window.GameEngine.handleCorrect();
                }
                return;
            }
    
            // Nếu đang trong trạng thái battling, thử đợi và retry vài lần
            const maxRetries = 8;
            const retryDelay = 120; // ms
            let attempt = 0;
    
            const tryCall = () => {
                attempt++;
                // Nếu isBattling false thì gọi ngay
                if (!window.GameEngine.isBattling) {
                    console.log('[QuestionManager] calling GameEngine.processBattleRound(1,0) (attempt)', attempt);
                    window.GameEngine.processBattleRound(1, 0);
                    return;
                }
    
                // Nếu vượt quá số lần retry thì buộc reset isBattling và gọi (last resort)
                if (attempt >= maxRetries) {
                    console.warn('[QuestionManager] isBattling still true after retries — forcing call (last resort)');
                    try { window.GameEngine.isBattling = false; } catch(e){ console.error(e); }
                    window.GameEngine.processBattleRound(1, 0);
                    return;
                }
    
                // Chưa sẵn sàng, đợi rồi thử lại
                console.log('[QuestionManager] GameEngine.isBattling=true, retrying in', retryDelay, 'ms (attempt)', attempt);
                setTimeout(tryCall, retryDelay);
            };
    
            tryCall();
    
        } catch (err) {
            console.error('[QuestionManager] handleQuestionCorrect error', err);
        }
    },
    
    handleQuestionWrong() {
        try {
            console.log('[QuestionManager] handleQuestionWrong called');
            // Nếu GameEngine có processBattleRound thì gọi 1 đòn monster
            if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
                console.log('[QuestionManager] calling GameEngine.processBattleRound(0,1, false)');
                window.GameEngine.processBattleRound(0, 1, false);
                return;
            }            
            // Nếu không có processBattleRound, fallback về handleWrong (cũ)
            if (window.GameEngine && typeof window.GameEngine.handleWrong === 'function') {
                console.log('[QuestionManager] calling GameEngine.handleWrong() fallback');
                window.GameEngine.handleWrong();
                return;
            }
            console.warn('[QuestionManager] No GameEngine handler found for wrong answer');
        } catch (err) {
            console.error('[QuestionManager] handleQuestionWrong error', err);
        }
    },

    /**
     * Dọn toàn bộ question
     */
    destroy() {
        if (this.currentQuestion && typeof this.currentQuestion.destroy === 'function') {
            this.currentQuestion.destroy();
        }
        this.currentQuestion = null;
    }
};

window.QuestionManager = QuestionManager;