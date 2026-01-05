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
    async loadType(typeNumber) {
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

        // Gọi hàm load (truyền enemyType nếu cần)
        if (typeof this.currentQuestion.load === 'function') {
            // enemyType chỉ để filter từ vựng phù hợp, không quyết định question type
            const enemyType = window.GameEngine?.monster?.type || 'normal';
            this.currentQuestion.load(enemyType);
        } else {
            console.error(`QuestionType${typeNumber} không có hàm load`);
        }
    },
    
    /**
     * Khi câu hỏi trả lời ĐÚNG
     */
    handleQuestionCorrect() {
        if (window.GameEngine && typeof window.GameEngine.handleCorrect === 'function') {
            window.GameEngine.handleCorrect();
        }
    },

    /**
     * Khi câu hỏi trả lời SAI
     */
    handleQuestionWrong() {
        if (window.GameEngine && typeof window.GameEngine.handleWrong === 'function') {
            window.GameEngine.handleWrong();
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