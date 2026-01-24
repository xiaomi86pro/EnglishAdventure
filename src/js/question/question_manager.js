// question_manager.js
// Quản lý câu hỏi: Load dynamic grammar tables + vocabulary

window.DATA_CACHE = window.DATA_CACHE || {}; // { vocabulary: [], nouns: [], verbs: [], ... }
window.DATA_CACHE_STATUS = 'loading'; 

const CONFIG = {
  tables: ['vocabulary', 'nouns', 'verbs', 'articles', 'subjects', 'prepositions'], // ← DYNAMIC
  preload: { sampleSize: 500, batchSize: 500, batchDelay: 200 }, 
  retry: { maxAttempts: 8, delayMs: 120 }, 
  debug: false 
};
window.CONFIG = CONFIG; 

// ============================================
// GENERIC DATA CACHE LOADER
// ============================================

/**
 * Preload dữ liệu cho tất cả tables
 * Mỗi table preload `sampleSize` rows, rồi load background phần còn lại
 */
async function preloadAllData() {
  const { tables, preload: { sampleSize, batchSize, batchDelay } } = CONFIG; 
  
  try {
    if (window.DATA_CACHE_STATUS === 'ready') {
      return window.DATA_CACHE;
    }
    
    if (!window.supabase) {
      console.warn('[Preload] Supabase chưa sẵn sàng'); 
      return;
    }

    // 1. Preload initial sample cho từng table
    for (const table of tables) {
      try {
        const { data, error } = await window.supabase
          .from(table)
          .select('*')
          .limit(sampleSize);
        
        if (error) throw error;
        window.DATA_CACHE[table] = data || [];
        console.log(`[Preload] ✅ ${table}: ${data?.length || 0} rows`);
      } catch (e) {
        console.warn(`[Preload] Error loading ${table}:`, e.message);
        window.DATA_CACHE[table] = [];
      }
    }

    window.DATA_CACHE_STATUS = 'ready';
    console.log('[Preload] ✅ All tables ready');

    // 2. Background load thêm phần còn lại
    loadBackgroundBatches(tables, sampleSize, batchSize, batchDelay);

  } catch (e) {
    console.error('[Preload] Fatal error:', e);
    window.DATA_CACHE_STATUS = 'error';
  }
}

/**
 * Load background các batch còn lại của mỗi table
 */
async function loadBackgroundBatches(tables, initialSize, batchSize, delay) {
  if (!window.supabase) return;

  for (const table of tables) {
    try {
      const { count } = await window.supabase
        .from(table)
        .select('id', { head: true, count: 'exact' });
      
      const total = count || initialSize;
      
      for (let offset = initialSize; offset < total; offset += batchSize) {
        setTimeout(async () => {
          try {
            const { data: batch, error } = await window.supabase
              .from(table)
              .select('*')
              .range(offset, offset + batchSize - 1);
            
            if (!error && batch?.length) {
              window.DATA_CACHE[table] = window.DATA_CACHE[table].concat(batch);
              if (CONFIG.debug) console.log(`[BG] ${table} offset=${offset}: +${batch.length}`);
            }
          } catch (e) {
            console.warn(`[BG] Error loading ${table} batch:`, e.message);
          }
        }, delay * Math.floor((offset - initialSize) / batchSize));
      }
    } catch (e) {
      console.warn(`[BG] Count query failed for ${table}:`, e.message);
    }
  }
}

/**
 * Khởi tạo preload khi supabase sẵn sàng
 */
function initPreload(maxAttempts = 20, interval = 200) {
  let attempts = 0;
  const tryInit = () => {
    attempts++;
    if (window.supabase) {
      preloadAllData();
      return;
    }
    if (attempts < maxAttempts) setTimeout(tryInit, interval);
  };
  tryInit();
}
initPreload();

// ============================================
// QUESTION MANAGER
// ============================================

const QuestionManager = {
  currentQuestion: null,
  loadedTypes: {},
  _lastOnCorrectTs: 0,

  /**
   * Generic: Lấy dữ liệu từ bất kỳ table nào
   */
  async ensureData(tableName, limit = 100) {
    try {
      // 1. Check cache trước
      if (window.DATA_CACHE[tableName]?.length > 0) {
        return window.DATA_CACHE[tableName];
      }

      // 2. Chờ cache ready
      if (window.DATA_CACHE_STATUS === 'loading') {
        const cached = await this.waitForCache(2000);
        if (cached?.[tableName]?.length > 0) return cached[tableName];
      }

      // 3. Fallback: Query trực tiếp
      if (!window.supabase) throw new Error('Supabase chưa sẵn sàng');
      const { data, error } = await window.supabase
        .from(tableName)
        .select('*')
        .limit(limit);

      if (error || !data?.length) throw new Error(`Không thể load ${tableName}`);
      window.DATA_CACHE[tableName] = data;
      return data;

    } catch (err) {
      if (window.DATA_CACHE[tableName]?.length > 0) {
        return window.DATA_CACHE[tableName];
      }
      throw err;
    }
  },

  /**
   * Chờ cache ready với timeout
   */
  async waitForCache(timeout = 2000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        if (window.DATA_CACHE_STATUS === 'ready') {
          resolve(window.DATA_CACHE);
        } else if (Date.now() - startTime >= timeout) {
          resolve(null);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  /**
   * Load question type module
   */
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

  /**
   * Map Question Type -> Required Tables
   */
  getRequiredTables(typeNumber) {
    const tableMap = {
    1: ['vocabulary'],
    2: ['vocabulary'],
    3: ['vocabulary'],
    4: ['vocabulary'],
    5: ['vocabulary'],
    6: ['vocabulary'],
    7: ['vocabulary'],
    8: ['nouns', 'verbs', 'subjects'],          // ← Grammar: Articles
    9: ['verbs', 'subjects'],          // ← Grammar: Subject-Verb
    10: ['prepositions', 'nouns'],     // ← Grammar: Prepositions
    // Thêm câu khác...
    };
    return tableMap[typeNumber] || ['vocabulary'];
  },

  /**
   * Load question type và khởi tạo
   */
  async loadType(typeNumber, enemyType = 'normal') {
    try {
      // 1. Xác định bảng cần load
      const requiredTables = this.getRequiredTables(typeNumber);
      const dataPackage = {};
      
      for (const table of requiredTables) {
        dataPackage[table] = await this.ensureData(table, 200);
      }

      this.currentQuestion?.destroy?.();

      // 2. Load question module
      const QuestionType = await this.loadQuestionType(typeNumber);
      if (!QuestionType) throw new Error(`Không thể load QuestionType${typeNumber}`);

      // 3. Khởi tạo instance
      if (typeof QuestionType === 'function') {
        // Class-based question
        this.currentQuestion = new QuestionType({
          ...dataPackage, // Pass tất cả required data (nouns, verbs, etc.)
          containerId: 'questionarea',
          config: { speakOnCorrect: true }
        });
      } else {
        // Object-based question
        this.currentQuestion = QuestionType;
        this.currentQuestion._dataPackage = dataPackage;
        this.currentQuestion._currentData = this._pickRandomFromTables(dataPackage);
      }

      // 4. Thiết lập callbacks
      this.currentQuestion.onCorrect = (hits = 1, advanceNext = true) => {
        const now = Date.now();
        if (now - this._lastOnCorrectTs < 600) return;
        this._lastOnCorrectTs = now;
        this.handleQuestionCorrect(hits, advanceNext);
      };

      this.currentQuestion.onWrong = () => this.handleQuestionWrong();

      // 5. Kích hoạt câu hỏi
      if (typeof this.currentQuestion.init === 'function') {
        await Promise.resolve(this.currentQuestion.init(enemyType));
      } else if (typeof this.currentQuestion.load === 'function') {
        await Promise.resolve(this.currentQuestion.load(enemyType));
      } else {
        throw new Error(`Cấu trúc câu hỏi ${typeNumber} không hợp lệ`);
      }

      if (CONFIG.debug) console.log(`[QM] Type ${typeNumber} loaded:`, dataPackage);

    } catch (err) {
      this._renderError(err);
    }
  },

  /**
   * Helper: Pick random item từ data package
   */
  _pickRandomFromTables(dataPackage) {
    const tables = Object.values(dataPackage).filter(arr => arr?.length > 0);
    if (tables.length === 0) return null;
    const randomTable = tables[Math.floor(Math.random() * tables.length)];
    return randomTable[Math.floor(Math.random() * randomTable.length)];
  },

  handleQuestionCorrect(hits = 1, advanceNext = true) {
    try {
      const q = this.currentQuestion;
      const historyEl = document.getElementById('answers-history');
      let entry = null;

      // Lấy từ _lastAnswered (Class) hoặc _currentData (Object)
      if (q?._lastAnswered) {
        entry = { en: q._lastAnswered.en, vi: q._lastAnswered.vi };
      } else {
        const data = q?.currentData || q?._currentData;
        if (data) {
          entry = {
            en: data.english_word || data.english || data.word || data.base_form || '',
            vi: data.vietnamese_translation || data.vietnamese || ''
          };
        }
      }

      // Cập nhật giao diện lịch sử
      if (entry && historyEl) {
        const textKey = `${entry.en} – ${entry.vi}`;
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
    } catch (e) {
      console.error('[QM] handleQuestionCorrect error', e);
    }
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