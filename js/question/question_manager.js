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
     * Load câu hỏi loại 1 (word sort)
     */
    async loadType1(enemyType = 'normal') {
        // Dọn câu hỏi cũ
        if (this.currentQuestion && typeof this.currentQuestion.destroy === 'function') {
            this.currentQuestion.destroy();
        }

        // Load QuestionType1
        const QuestionType1 = await this.loadQuestionType(1);
        
        if (!QuestionType1) {
            console.error('Không thể load QuestionType1');
            return;
        }

        this.currentQuestion = QuestionType1;

        // Gắn callback
        this.currentQuestion.onCorrect = () => {
            this.handleQuestionCorrect();
        };

        this.currentQuestion.onWrong = () => {
            this.handleQuestionWrong();
        };

        // Gọi hàm load
        if (typeof this.currentQuestion.load === 'function') {
            this.currentQuestion.load(enemyType);
        } else {
            console.error('QuestionType1 không có hàm load');
        }
    },

    /**
     * Load câu hỏi loại 2
     */
    async loadType2(enemyType = 'elite') {
        // Dọn câu hỏi cũ
        if (this.currentQuestion && typeof this.currentQuestion.destroy === 'function') {
            this.currentQuestion.destroy();
        }
    
        // Load QuestionType2
        const QuestionType2 = await this.loadQuestionType(2);
        
        if (!QuestionType2) {
            console.error('Không thể load QuestionType2');
            return;
        }

        this.currentQuestion = QuestionType2;
    
        // Gắn callback
        this.currentQuestion.onCorrect = () => {
            this.handleQuestionCorrect();
        };
        this.currentQuestion.onWrong = () => {
            this.handleQuestionWrong();
        };
    
        // Gọi hàm load
        if (typeof this.currentQuestion.load === 'function') {
            this.currentQuestion.load(enemyType);
        } else {
            console.error('QuestionType2 không có hàm load');
        }
    },
 
    /**
     * Load câu hỏi loại 3
     */
    async loadType3(enemyType = 'normal') {
        if (this.currentQuestion && typeof this.currentQuestion.destroy === 'function') {
            this.currentQuestion.destroy();
        }

        const QuestionType3 = await this.loadQuestionType(3);
        console.log("loadType3 got object:", QuestionType3);


        if (!QuestionType3) return;

        this.currentQuestion = QuestionType3;
        console.log("CurrentQuestion set to type3:", this.currentQuestion);

        this.currentQuestion.onCorrect = () => this.handleQuestionCorrect();
        this.currentQuestion.onWrong = () => this.handleQuestionWrong();

        if (typeof this.currentQuestion.load === 'function') {
            console.log("Calling QuestionType3.load with enemyType:", enemyType);
            this.currentQuestion.load(enemyType);
        }
    },

    /**
     * Hàm chung để start question theo enemy type
     */
    async startQuestion(enemyType = 'normal') {
        const area = document.getElementById("questionarea"); 
        if (area) area.innerHTML = "";

        if (enemyType === 'normal') {
            if (Math.random() > 0.5) {
                await this.loadType1(enemyType);
            } else {
                await this.loadType3(enemyType);
            }
        } else if (enemyType === 'elite') {
            await this.loadType2(enemyType);
        } else if (enemyType === 'boss') {
            await this.loadType3(enemyType); // Sau này thêm
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