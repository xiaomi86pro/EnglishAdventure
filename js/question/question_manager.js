// js/question/question_manager.js

const QuestionManager = {
    currentQuestion: null,

    /**
     * Load câu hỏi loại 1 (word sort)
     * Hàm này TỒN TẠI chỉ để GameEngine gọi
     * Logic thật sự nằm trong question1.js
     */
    loadType1(enemyType = 'normal') {
        // Nếu đã có câu hỏi cũ → dọn
        if (this.currentQuestion && typeof this.currentQuestion.destroy === 'function') {
            this.currentQuestion.destroy();
        }

        // QuestionType1 hiện tại chính là QuestionManager trong question1.js
        // (bạn chưa tách class QuestionType riêng)
        this.currentQuestion = window.QuestionManagerType1 || window.QuestionType1 || window.Question1 || window.QuestionManager;

        // Gắn callback chuẩn
        this.currentQuestion.onCorrect = () => {
            this.handleQuestionCorrect();
        };

        this.currentQuestion.onWrong = () => {
            this.handleQuestionWrong();
        };

        // Gọi init thực tế của question
        if (typeof this.currentQuestion.loadType1 === 'function') {
            this.currentQuestion.loadType1(enemyType);
        } else {
            console.error('QuestionType1 không có hàm loadType1');
        }
    },

    startQuestion(enemyType = 'normal') {
        // Hiện tại chỉ có 1 loại câu hỏi
        this.loadType1(enemyType);
    },
    
    /**
     * Khi câu hỏi trả lời ĐÚNG
     * CHỈ Ở ĐÂY mới gọi GameEngine
     */
    handleQuestionCorrect() {
        if (window.GameEngine && typeof window.GameEngine.handleCorrect === 'function') {
            window.GameEngine.handleCorrect();
        }
    },

    /**
     * Khi câu hỏi trả lời SAI
     * Hiện chưa dùng, để sẵn cho mở rộng
     */
    handleQuestionWrong() {
        if (window.GameEngine && typeof window.GameEngine.handleWrong === 'function') {
            window.GameEngine.handleWrong();
        }
    },

    /**
     * Dọn toàn bộ question (khi reset game, đổi mode, v.v.)
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
