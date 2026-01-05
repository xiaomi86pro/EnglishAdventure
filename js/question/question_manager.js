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

        // Gọi hàm load của QuestionType
        if (typeof this.currentQuestion.load === 'function') {
            // Nếu load nhận tham số (length > 0) thì truyền et, ngược lại gọi không tham số
            try {
                if (this.currentQuestion.load.length > 0) {
                    this.currentQuestion.load(et);
                } else {
                    this.currentQuestion.load();
                }
            } catch (err) {
                // Fallback an toàn: gọi không tham số nếu có lỗi
                console.warn('[QuestionManager] load() threw, retrying without params', err);
                try { this.currentQuestion.load(); } catch(e){ console.error('QuestionType.load failed', e); }
            }
        } else {
            console.error(`QuestionType${typeNumber} không có hàm load`);
        }
    },
    
    handleQuestionCorrect() {
        try {
            console.log('[QuestionManager] handleQuestionCorrect called');
            // Nếu GameEngine có processBattleRound thì gọi 1 đòn hero
            if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
                console.log('[QuestionManager] calling GameEngine.processBattleRound(1,0)');
                window.GameEngine.processBattleRound(1, 0);
                return;
            }
            // Nếu không có processBattleRound, fallback về handleCorrect (cũ)
            if (window.GameEngine && typeof window.GameEngine.handleCorrect === 'function') {
                console.log('[QuestionManager] calling GameEngine.handleCorrect() fallback');
                window.GameEngine.handleCorrect();
                return;
            }
            console.warn('[QuestionManager] No GameEngine handler found for correct answer');
        } catch (err) {
            console.error('[QuestionManager] handleQuestionCorrect error', err);
        }
    },
    
    handleQuestionWrong() {
        try {
            console.log('[QuestionManager] handleQuestionWrong called');
            // Nếu GameEngine có processBattleRound thì gọi 1 đòn monster
            if (window.GameEngine && typeof window.GameEngine.processBattleRound === 'function') {
                console.log('[QuestionManager] calling GameEngine.processBattleRound(0,1)');
                window.GameEngine.processBattleRound(0, 1);
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