// src/js/question/question8.js
// Question Type 8 - Articles (a/an/the/blank)
// Generate câu từ database: nouns + verbs + semantic categories

class Question8 {
    constructor(opts = {}) {
        this.containerId = opts.containerId || 'questionarea';
        this.onCorrect = opts.onCorrect || null;
        this.onWrong = opts.onWrong || null;
        this.supabase = window.supabase;
        
        this.currentData = null;
        this._answered = false;
        this._destroyed = false;
        this._lastAnswered = null;
    }

    /**
     * Khởi tạo câu hỏi
     */
    async init(enemyType = "normal") {
        this._destroyed = false;
        this._answered = false;
        
        try {
            // Generate câu hỏi từ database
            await this.generateQuestion(enemyType);
            
            if (this.currentData) {
                this.renderQuestionUI();
            } else {
                console.error('[Question8] Failed to generate question');
                setTimeout(() => {
                    if (typeof this.onWrong === 'function') this.onWrong();
                }, 500);
            }
        } catch (err) {
            console.error('[Question8] init error:', err);
        }
    }

    /**
     * Generate câu hỏi từ database
     */
    async generateQuestion(enemyType) {
        try {
            // 1. Chọn verb ngẫu nhiên có compatible_objects
            const { data: verbs, error: verbError } = await this.supabase
                .from('verbs')
                .select('*')
                .not('compatible_objects', 'is', null)
                .eq('difficulty', 'A1');

            if (verbError || !verbs || verbs.length === 0) {
                console.error('[Question8] No verbs found:', verbError);
                return;
            }

            // ✅ TRY UP TO 5 VERBS để tìm verb có compatible nouns
            let verb = null;
            let compatibleCategories = [];
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts && !verb) {
                attempts++;
                const candidateVerb = verbs[Math.floor(Math.random() * verbs.length)];
                
                // Parse compatible_objects
                try {
                    const categories = JSON.parse(candidateVerb.compatible_objects);
                    
                    if (categories && categories.length > 0) {
                        // Check if có nouns phù hợp
                        const { data: testNouns } = await this.supabase
                            .from('nouns')
                            .select('id')
                            .in('semantic_category', categories)
                            .eq('countable', true)
                            .eq('difficulty', 'A1')
                            .limit(1);
                        
                        if (testNouns && testNouns.length > 0) {
                            verb = candidateVerb;
                            compatibleCategories = categories;
                            break;
                        } else {
                            console.warn(`[Question8] Verb "${candidateVerb.base_form}" has no compatible nouns, trying another...`);
                        }
                    }
                } catch (e) {
                    console.warn(`[Question8] Invalid JSON for verb "${candidateVerb.base_form}"`);
                }
            }

            if (!verb || compatibleCategories.length === 0) {
                console.error('[Question8] Could not find suitable verb after', maxAttempts, 'attempts');
                return;
            }

            // 2. Chọn noun phù hợp
            const { data: nouns, error: nounError } = await this.supabase
                .from('nouns')
                .select('*')
                .in('semantic_category', compatibleCategories)
                .eq('countable', true) // Chỉ chọn danh từ đếm được cho a/an/the
                .eq('difficulty', 'A1');

            if (nounError || !nouns || nouns.length === 0) {
                console.error('[Question8] No compatible nouns found');
                return;
            }

            const noun = nouns[Math.floor(Math.random() * nouns.length)];

            // 3. Chọn subject ngẫu nhiên
            const { data: subjects, error: subjectError } = await this.supabase
                .from('subjects')
                .select('*')
                .eq('difficulty', 'A1');

            if (subjectError || !subjects || subjects.length === 0) {
                console.error('[Question8] No subjects found');
                return;
            }

            const subject = subjects[Math.floor(Math.random() * subjects.length)];

            // 4. Chia động từ đúng form
            const conjugatedVerb = subject.requires_verb_s ? verb.third_person : verb.base_form;

            // 5. Xác định đáp án đúng (a/an/the/blank)
            let correctAnswer = '';
            let explanation = '';

            // ✅ BALANCE: Ưu tiên "an" và "the" để giảm tỷ lệ "a"
            const rand = Math.random();
            
            if (rand < 0.3 && noun.starts_with_vowel) {
                // 30% chance: Dùng "an" nếu có thể
                correctAnswer = 'an';
                explanation = `Use "an" before words starting with vowel sounds (${noun.word} starts with "${noun.word[0]}").`;
                
            } else if (rand < 0.5) {
                // 20% chance: Dùng "the" (specific/known object)
                correctAnswer = 'the';
                explanation = `Use "the" when referring to a specific ${noun.word}.`;
                
                // Thay đổi verb context để hợp lý với "the"
                // VD: "I like the book" (quyển sách cụ thể đó)
                
            } else {
                // 50% chance: Dùng "a" hoặc "an" tùy noun
                if (noun.starts_with_vowel) {
                    correctAnswer = 'an';
                    explanation = `Use "an" before words starting with vowel sounds (${noun.word} starts with "${noun.word[0]}").`;
                } else {
                    correctAnswer = 'a';
                    explanation = `Use "a" before words starting with consonant sounds (${noun.word} starts with "${noun.word[0]}").`;
                }
            }

            // 6. Tạo câu hoàn chỉnh
            const sentence = `${subject.word} ${conjugatedVerb} _____ ${noun.word}.`;

            // 7. Lưu data
            this.currentData = {
                sentence,
                correctAnswer,
                explanation,
                subject: subject.word,
                verb: verb.base_form,
                noun: noun.word,
                fullSentence: `${subject.word} ${conjugatedVerb} ${correctAnswer} ${noun.word}.`
            };

            console.log('[Question8] Generated:', this.currentData);

        } catch (err) {
            console.error('[Question8] generateQuestion error:', err);
        }
    }

    /**
     * Render UI
     */
    renderQuestionUI() {
        const area = document.getElementById(this.containerId);
        if (!area || !this.currentData) return;

        // Tách câu thành parts để highlight blank
        const parts = this.currentData.sentence.split('_____');

        area.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-between relative animate-fade-in p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl">
                
                <!-- Header -->
                <div class="absolute top-0 left-0 bg-purple-600 text-white px-4 py-2 rounded-br-2xl text-sm font-bold shadow-lg">
                    Question Type 8: Articles (a/an/the)
                </div>

                <!-- Instruction -->
                <div class="text-center mt-12 mb-6">
                    <p class="text-gray-600 text-lg font-semibold mb-2">Choose the correct article:</p>
                </div>

                <!-- Sentence with blank -->
                <div class="flex-1 flex items-center justify-center w-full max-w-3xl">
                    <div class="text-center bg-white/90 p-8 rounded-3xl border-4 border-blue-200 shadow-xl w-full">
                        <p class="text-4xl md:text-5xl font-bold text-gray-800 leading-relaxed">
                            ${parts[0]}
                            <span class="inline-block min-w-[120px] h-16 border-b-4 border-dashed border-red-500 animate-pulse mx-2"></span>
                            ${parts[1] || ''}
                        </p>
                    </div>
                </div>

                <!-- Answer Options -->
                <div class="w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <button data-answer="a" class="answer-btn px-8 py-6 bg-gradient-to-br from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl shadow-[0_6px_0_#1e40af] transition-all transform hover:translate-y-1 hover:shadow-[0_3px_0_#1e40af] active:translate-y-1 active:shadow-none font-black text-3xl">
                        a
                    </button>
                    
                    <button data-answer="an" class="answer-btn px-8 py-6 bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white rounded-2xl shadow-[0_6px_0_#15803d] transition-all transform hover:translate-y-1 hover:shadow-[0_3px_0_#15803d] active:translate-y-1 active:shadow-none font-black text-3xl">
                        an
                    </button>
                    
                    <button data-answer="the" class="answer-btn px-8 py-6 bg-gradient-to-br from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white rounded-2xl shadow-[0_6px_0_#7e22ce] transition-all transform hover:translate-y-1 hover:shadow-[0_3px_0_#7e22ce] active:translate-y-1 active:shadow-none font-black text-3xl">
                        the
                    </button>
                    
                    <button data-answer="blank" class="answer-btn px-8 py-6 bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-2xl shadow-[0_6px_0_#c2410c] transition-all transform hover:translate-y-1 hover:shadow-[0_3px_0_#c2410c] active:translate-y-1 active:shadow-none font-black text-2xl">
                        (no article)
                    </button>
                </div>

                <!-- Explanation area (hidden initially) -->
                <div id="explanation-box" class="hidden w-full max-w-2xl bg-blue-50 border-2 border-blue-300 rounded-2xl p-6 mb-4">
                    <p class="text-blue-800 text-lg font-semibold text-center"></p>
                </div>
            </div>
        `;

        // Gắn sự kiện cho buttons
        const buttons = area.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
            btn.onclick = () => this.checkAnswer(btn.dataset.answer);
        });
    }

    /**
     * Kiểm tra đáp án
     */
    checkAnswer(userAnswer) {
        if (this._answered || !this.currentData) return;

        // Disable tất cả buttons
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach(btn => btn.disabled = true);

        const isCorrect = userAnswer === this.currentData.correctAnswer;

        if (isCorrect) {
            this._answered = true;

            // Highlight button đúng
            const correctBtn = document.querySelector(`[data-answer="${userAnswer}"]`);
            if (correctBtn) {
                correctBtn.classList.remove('from-blue-400', 'to-blue-500', 'from-green-400', 'to-green-500', 'from-purple-400', 'to-purple-500', 'from-orange-400', 'to-orange-500');
                correctBtn.classList.add('from-green-500', 'to-green-600', 'scale-110', 'ring-4', 'ring-green-300');
            }

            // Hiển thị giải thích
            const explanationBox = document.getElementById('explanation-box');
            if (explanationBox) {
                explanationBox.classList.remove('hidden');
                explanationBox.querySelector('p').innerHTML = `
                    ✅ <strong>Correct!</strong><br>
                    ${this.currentData.explanation}<br>
                    <em class="text-green-700 font-bold mt-2 block">"${this.currentData.fullSentence}"</em>
                `;
            }

            // Đọc câu đúng
            this.speak(this.currentData.fullSentence);

            // Lưu lịch sử
            this._lastAnswered = {
                en: this.currentData.fullSentence,
                vi: `Dùng "${this.currentData.correctAnswer}" trước "${this.currentData.noun}"`
            };

            // Gọi callback sau delay
            setTimeout(() => {
                if (!this._destroyed && typeof this.onCorrect === 'function') {
                    this.onCorrect(1, true);
                }
            }, 2500);

        } else {
            // Sai: Highlight button sai
            const wrongBtn = document.querySelector(`[data-answer="${userAnswer}"]`);
            if (wrongBtn) {
                wrongBtn.classList.add('bg-red-500', 'animate-shake');
                setTimeout(() => {
                    wrongBtn.classList.remove('bg-red-500', 'animate-shake');
                    // Re-enable buttons để thử lại
                    buttons.forEach(btn => btn.disabled = false);
                }, 500);
            }

            // Gọi callback sai
            if (typeof this.onWrong === 'function') {
                this.onWrong();
            }
        }
    }

    /**
     * Text-to-speech
     */
    speak(text, lang = "en-US") {
        if (!text || !window.speechSynthesis || this._destroyed) return;
        
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.85;
        
        const voices = speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.includes(lang.split('-')[0]));
        if (targetVoice) utterance.voice = targetVoice;
        
        speechSynthesis.speak(utterance);
    }

    /**
     * Cleanup
     */
    destroy() {
        this._destroyed = true;
        if (window.speechSynthesis) speechSynthesis.cancel();
        
        const area = document.getElementById(this.containerId);
        if (area) area.innerHTML = "";
        
        this.currentData = null;
        this._lastAnswered = null;
    }
}

export default Question8;