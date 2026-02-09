// question_manager.js
// Quản lý câu hỏi đa dạng: Hỗ trợ nhiều loại tables và caching thông minh

// ============================================================================
// CONFIG & GLOBAL STATE
// ============================================================================

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
  debug: false
};

window.CONFIG = CONFIG;

// Global cache object cho tất cả các tables
window.DATA_CACHE = window.DATA_CACHE || {
  vocabulary: { data: [], status: 'loading' },
  nouns: { data: [], status: 'idle' },
  adjectives: { data: [], status: 'idle' },
  question_templates: { data: [], status: 'idle' },
  places: { data: [], status: 'idle' },
  pronouns: { data: [], status: 'idle' },
  verbs: { data: [], status: 'idle' },
  wh_words: { data: [], status: 'idle' },
  auxiliary_patterns: { data: [], status: 'idle' }
};

// ============================================================================
// DATA CACHE MANAGER - Quản lý cache cho tất cả tables
// ============================================================================

const DataCacheManager = {
  /**
   * Mapping question type → required tables
   */
  questionTableMap: {
    1: ['vocabulary'],
    2: ['vocabulary'],
    3: ['vocabulary'],
    4: ['vocabulary'],
    5: ['vocabulary'],
    6: ['vocabulary'],
    7: ['vocabulary'],
    8: ['question_templates','subjects','nouns','adjectives',],
    9: ['question_templates'],
    10: ['question_templates', 'pronouns'],
    11: ['question_templates', 'verbs'],
    12: ['question_templates', 'nouns'],
    13: ['question_templates', 'wh_words'],
    14: ['question_templates', 'adjectives', 'nouns'],
    15: ['question_templates', 'verbs', 'auxiliary_patterns']
  },

  /**
   * Lấy danh sách tables cần thiết cho question type
   */
  getRequiredTables(questionType) {
    return this.questionTableMap[questionType] || [];
  },

  /**
   * Kiểm tra trạng thái cache của một table
   */
  getCacheStatus(tableName) {
    return window.DATA_CACHE[tableName]?.status || 'idle';
  },

  /**
   * Lấy data từ cache
   */
  getCacheData(tableName) {
    return window.DATA_CACHE[tableName]?.data || [];
  },

  /**
   * Load một table vào cache
   */
  async loadTable(tableName, options = {}) {
    const { limit = 1000, forceReload = false } = options;

    // Nếu đã có data và không force reload
    if (!forceReload && this.getCacheStatus(tableName) === 'ready' && this.getCacheData(tableName).length > 0) {
      return this.getCacheData(tableName);
    }

    // Nếu đang loading, đợi
    if (this.getCacheStatus(tableName) === 'loading') {
      return this.waitForTable(tableName, 5000);
    }

    // Bắt đầu load
    window.DATA_CACHE[tableName].status = 'loading';

    try {
      if (!window.supabase) {
        throw new Error('Supabase chưa sẵn sàng');
      }

      const { data, error } = await window.supabase
        .from(tableName)
        .select('*')
        .limit(limit);

      if (error || !data) {
        throw error || new Error(`Không thể load ${tableName}`);
      }

      window.DATA_CACHE[tableName].data = data;
      window.DATA_CACHE[tableName].status = 'ready';

      if (CONFIG.debug) {
        console.log(`[DataCache] ✅ ${tableName} loaded:`, data.length, 'records');
      }

      return data;

    } catch (error) {
      console.error(`[DataCache] ❌ Error loading ${tableName}:`, error);
      window.DATA_CACHE[tableName].status = 'error';
      throw error;
    }
  },

  /**
   * Load nhiều tables cùng lúc
   */
  async loadTables(tableNames) {
    const results = {};
    const promises = tableNames.map(async (tableName) => {
      try {
        results[tableName] = await this.loadTable(tableName);
      } catch (error) {
        results[tableName] = null;
      }
    });

    await Promise.all(promises);
    return results;
  },

  /**
   * Đợi một table load xong
   */
  async waitForTable(tableName, timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        const status = this.getCacheStatus(tableName);
        
        if (status === 'ready') {
          resolve(this.getCacheData(tableName));
        } else if (Date.now() - startTime >= timeout) {
          console.warn(`[DataCache] Timeout waiting for ${tableName}`);
          resolve(null);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  /**
   * Preload vocabulary (giữ nguyên logic cũ cho backward compatibility)
   */
  async preloadVocabulary() {
    const { sampleSize, batchSize, batchDelay } = CONFIG.preload;
    
    try {
      // Nếu đã có data
      if (this.getCacheData('vocabulary').length > 0) {
        window.DATA_CACHE.vocabulary.status = 'ready';
        return;
      }

      if (!window.supabase) {
        console.warn('[Preload] Supabase chưa sẵn sàng');
        return;
      }

      // Load batch đầu tiên
      const { data: sample, error } = await window.supabase
        .from('vocabulary')
        .select('english_word, vietnamese_translation')
        .limit(sampleSize);

      if (error || !sample?.length) {
        throw error || new Error('Vocabulary trống');
      }

      window.DATA_CACHE.vocabulary.data = sample;
      window.DATA_CACHE.vocabulary.status = 'ready';
      console.log('[Preload] ✅ Vocabulary ready:', sample.length);

      // Load background các batch còn lại
      try {
        const { count } = await window.supabase
          .from('vocabulary')
          .select('id', { head: true, count: 'exact' });
        
        const total = count || sample.length;
        
        for (let offset = sample.length; offset < total; offset += batchSize) {
          setTimeout(async () => {
            try {
              const { data: batch } = await window.supabase
                .from('vocabulary')
                .select('english_word, vietnamese_translation')
                .range(offset, offset + batchSize - 1);
              
              if (batch?.length) {
                window.DATA_CACHE.vocabulary.data = window.DATA_CACHE.vocabulary.data.concat(batch);
              }
            } catch (e) {
              console.warn('[Preload] batch fetch exception', e);
            }
          }, batchDelay * Math.floor((offset - sample.length) / batchSize));
        }
      } catch (e) {
        console.warn('[Preload] background batch load skipped', e);
      }

    } catch (e) {
      console.error('[Preload] Error:', e);
      window.DATA_CACHE.vocabulary.status = 'error';
    }
  }
};

// ============================================================================
// INIT PRELOAD
// ============================================================================

function initPreload(maxAttempts = 20, interval = 200) {
  let attempts = 0;
  const tryInit = () => {
    attempts++;
    if (window.supabase) {
      DataCacheManager.preloadVocabulary();
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(tryInit, interval);
    }
  };
  tryInit();
}

initPreload();

// ============================================================================
// QUESTION MANAGER - Main logic
// ============================================================================

const QuestionManager = {
  currentQuestion: null,
  loadedTypes: {},
  _lastOnCorrectTs: 0,

  /**
   * Ensure data cho question type cụ thể
   */
  async ensureDataForQuestion(questionType) {
    const requiredTables = DataCacheManager.getRequiredTables(questionType);
    
    if (!requiredTables || requiredTables.length === 0) {
      throw new Error(`Question type ${questionType} không có table mapping`);
    }

    const results = await DataCacheManager.loadTables(requiredTables);

    // Kiểm tra xem có table nào load fail không
    const failedTables = Object.keys(results).filter(t => !results[t] || results[t].length === 0);
    
    if (failedTables.length > 0) {
      console.warn(`[QM] Một số tables load thất bại:`, failedTables);
    }

    return results;
  },

  /**
   * Backward compatibility: ensureVocabulary
   */
  async ensureVocabulary(limit = 100) {
    try {
      const vocabData = DataCacheManager.getCacheData('vocabulary');
      
      if (vocabData.length > 0) {
        return vocabData;
      }

      if (DataCacheManager.getCacheStatus('vocabulary') === 'loading') {
        const cached = await DataCacheManager.waitForTable('vocabulary', 2000);
        if (cached?.length > 0) return cached;
      }

      return await DataCacheManager.loadTable('vocabulary', { limit });

    } catch (err) {
      const vocabData = DataCacheManager.getCacheData('vocabulary');
      if (vocabData.length > 0) return vocabData;
      throw err;
    }
  },

  /**
   * Load question type module
   */
  async loadQuestionType(typeNumber) {
    if (this.loadedTypes[typeNumber]) {
      return this.loadedTypes[typeNumber];
    }

    try {
      const module = await import(`./question${typeNumber}.js`);
      this.loadedTypes[typeNumber] = module.default || module;
      return this.loadedTypes[typeNumber];
    } catch (error) {
      console.error(`Lỗi load QuestionType${typeNumber}:`, error);
      return null;
    }
  },

  /**
   * Load và khởi tạo question
   */
  async loadType(typeNumber, enemyType = 'normal') {
    try {
      // Đảm bảo data cho question type này
      const questionData = await this.ensureDataForQuestion(typeNumber);

      // Destroy question cũ
      this.currentQuestion?.destroy?.();

      // Load question module
      const QuestionType = await this.loadQuestionType(typeNumber);
      if (!QuestionType) {
        throw new Error(`Không thể load QuestionType${typeNumber}`);
      }

      // --- Khởi tạo Instance (Hỗ trợ Class & Object) ---
      if (typeof QuestionType === 'function') {
        // Class-based (Question6, 7, 8, ...)
        
        // Backward compatibility: Question 1-7 dùng vocabPool, Question 8+ dùng dataPool
        const constructorOpts = {
          dataPool: questionData, // Cho Question 8+
          vocabPool: questionData.vocabulary || [], // Cho Question 1-7 (backward compatibility)
          containerId: 'questionarea',
          config: { speakOnCorrect: true }
        };
        
        this.currentQuestion = new QuestionType(constructorOpts);
      } else {
        // Object-based (legacy)
        this.currentQuestion = QuestionType;
        
        // Backward compatibility: truyền vocabulary nếu cần
        if (questionData.vocabulary) {
          this.currentQuestion._vocabulary = questionData.vocabulary;
          this.currentQuestion._vocabPick = questionData.vocabulary.length
            ? questionData.vocabulary[Math.floor(Math.random() * questionData.vocabulary.length)]
            : null;
        }
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

  /**
   * Handle correct answer
   */
  handleQuestionCorrect(hits = 1, advanceNext = true) {
    try {
      const q = this.currentQuestion;
      const historyEl = document.getElementById('answers-history');
      let entry = null;

      // Lấy dữ liệu từ question
      if (q?._lastAnswered) {
        entry = { en: q._lastAnswered.en, vi: q._lastAnswered.vi };
      } else {
        const data = q?.currentData || q?._vocabPick;
        if (data) {
          entry = {
            en: data.english_word || data.english || data.word || '',
            vi: data.vietnamese_translation || data.vietnamese || ''
          };
        }
      }

      // Cập nhật giao diện lịch sử
      if (entry && historyEl && entry.en && entry.vi) {
        const textKey = `${entry.en} — ${entry.vi}`;
        if (!historyEl.querySelector(`[data-key="${encodeURIComponent(textKey)}"]`)) {
          const node = document.createElement('div');
          node.className = 'answer-history-item p-2 rounded bg-white/80 border mb-2';
          node.setAttribute('data-key', encodeURIComponent(textKey));
          node.innerHTML = `
            <div class="font-bold text-sm text-blue-600">${this.escapeHtml(entry.en)}</div>
            <div class="text-xs text-gray-600">${this.escapeHtml(entry.vi)}</div>
          `;
          historyEl.appendChild(node);
        }
      }

      this._triggerBattleRound(hits, 0, advanceNext);
    } catch (e) {
      console.error('[QM] handleQuestionCorrect error', e);
    }
  },

  /**
   * Handle wrong answer
   */
  handleQuestionWrong() {
    this._triggerBattleRound(0, 1, false);
  },

  /**
   * Trigger battle round in GameEngine
   */
  _triggerBattleRound(hits, misses, advance) {
    if (window.GameEngine?.processBattleRound) {
      window.GameEngine.processBattleRound(Number(hits), Number(misses), !!advance);
    }
  },

  /**
   * Render error message
   */
  _renderError(err) {
    const area = document.getElementById('questionarea');
    if (area) {
      area.innerHTML = `
        <div class="p-8 text-center">
          <p class="text-red-600 font-bold">${this.escapeHtml(err.message)}</p>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Tải lại
          </button>
        </div>
      `;
    }
  },

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Destroy current question
   */
  destroy() {
    this.currentQuestion?.destroy?.();
    this.currentQuestion = null;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

window.QuestionManager = QuestionManager;
window.DataCacheManager = DataCacheManager;

// Backward compatibility
window.VOCAB_CACHE = window.DATA_CACHE.vocabulary.data;
Object.defineProperty(window, 'VOCAB_CACHE_STATUS', {
  get: () => window.DATA_CACHE.vocabulary.status,
  set: (val) => { window.DATA_CACHE.vocabulary.status = val; }
});