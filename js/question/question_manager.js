// js/question/question_manager.js

const QuestionManager = {
    currentQuestion: null,
    loadedTypes: {}, // Cache các QuestionType đã load
    
    /**
     * Load động một QuestionType từ file
     */
    async loadQuestionType(typeNumber) {
        try {
            if (this.loadedTypes[typeNumber]) {
                console.log("Cache hit for type", typeNumber, this.loadedTypes[typeNumber]);
                return this.loadedTypes[typeNumber];
            }

            const module = await import(`./question${typeNumber}.js`);
            console.log("Imported module for type", typeNumber, module);

            const qType = module.default;   // chỉ lấy default export
            this.loadedTypes[typeNumber] = qType;
            console.log("LoadedTypes set for type", typeNumber, qType);

            return qType;
        } catch (error) {
            console.error(`Lỗi load QuestionType${typeNumber}:`, error);
            return null;
        }
    },  
    /**
     * Hàm chung để load QuestionType theo số
     */
    async loadType(typeNumber, enemyType = 'normal') {
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

        // Gọi hàm load
        if (typeof this.currentQuestion.load === 'function') {
            this.currentQuestion.load(enemyType);
        } else {
            console.error(`QuestionType${typeNumber} không có hàm load`);
        }
    },

    /**
     * Hàm chung để start question theo enemy type
     */
    async startQuestion(enemyType = 'normal') {
        const area = document.getElementById("questionarea"); 
        if (area) area.innerHTML = "";
    
        if (enemyType === 'normal') {
            // Ví dụ: random giữa type1 và type3
            if (Math.random() > 0.5) {
                await this.loadType(1, enemyType);
            } else {
                await this.loadType(3, enemyType);
            }
        } else if (enemyType === 'elite') {
            await this.loadType(2, enemyType);
        } else if (enemyType === 'boss') {         
                await this.loadType(4, enemyType);       
        } else if (enemyType === 'final boss') {         
            await this.loadType(5, enemyType);       
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

// Export global
window.QuestionManager = QuestionManager;