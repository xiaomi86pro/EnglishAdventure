// js/question/question8.js
// Question Type 8: Articles (a/an/the) - Class Version
const ARTICLE_EXPLANATION_VI = {
    correct: {
      article_indef:
        'Đúng vì dùng "<strong>A/AN</strong>" khi nhắc đến một sự vật lần đầu và chưa xác định.',
  
      article_def_2nd:
        'Đúng vì dùng "<strong>the</strong>" khi "<strong>${noun}</strong>" đã được nhắc đến trước đó và đã xác định.',
  
      article_instr:
        'Đúng vì dùng "<strong>the</strong>" trước tên nhạc cụ khi nói về việc chơi hoặc học nhạc cụ.',
  
      article_zero:
        'Đúng vì để trống với "<strong>${noun}</strong>" khi danh từ ở số nhiều, mang nghĩa chung hoặc là danh từ không đếm được.'
    },
  
    wrong: {
      article_indef:
        'Không dùng "<strong>the</strong>" khi đây là lần đầu nhắc đến và chưa xác định.',
  
      article_def_2nd:
        'Phải dùng "<strong>the</strong>" do "<strong>${noun}</strong>" đã được nhắc đến trước đó.',
  
      article_instr:
        'Sai vì trước tên nhạc cụ (khi nói chơi/học nhạc cụ) cần dùng "<strong>the</strong>".',
  
      article_zero:
        'Sai vì trường hợp này cần để trống (zero article) với "<strong>${noun}</strong>".'
    }
  };

class Question8 {
  constructor(opts = {}) {
      // Nhận data từ QuestionManager thay vì query DB
      this.dataPool = opts.dataPool || {};
      this.templates = this.dataPool.question_templates || [];
      this.nouns = this.dataPool.nouns || [];
      this.adjectives = this.dataPool.adjectives || [];
      this.subjects = this.dataPool.subjects || [];
      
      this.containerId = opts.containerId || "questionarea";
      this.onCorrect = opts.onCorrect || null;
      this.onWrong = opts.onWrong || null;

      this.autoReload = true;
      this.currentData = null;
      this._destroyed = false;

      this.instrumentVerbs = ["play", "learn", "practice", "study"];
  }

  pickRandom(list = []) {
      if (!Array.isArray(list) || list.length === 0) return null;
      return list[Math.floor(Math.random() * list.length)];
  }

  formatArticleExplanation(section, key, values = {}) {
    const template = ARTICLE_EXPLANATION_VI[section]?.[key] || '';
    return template.replace(/\$\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

  conjugateVerbBySubject(verb, subject) {
    const person = Number(subject?.person);
    const numberType = String(subject?.number_type || "").trim().toLowerCase();
  
    if (person === 3 && numberType === "singular") {
      // study → studies (phụ âm + y)
      if (/[bcdfghjklmnpqrstvwxyz]y$/i.test(verb)) {
        return verb.slice(0, -1) + 'ies';
      }
  
      // play → plays (nguyên âm + y)
      if (/[aeiou]y$/i.test(verb)) {
        return verb + 's';
      }
  
      // watch → watches, fix → fixes
      if (/(s|x|z|ch|sh)$/i.test(verb)) {
        return verb + 'es';
      }
  
      // mặc định
      return verb + 's';
    }
  
    return verb;
  }

  speak(text, lang = "en-US", rate = 0.95) {
      if (!window.speechSynthesis || this._destroyed) return;
      try { window.speechSynthesis.cancel(); } catch (e) { }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      window.speechSynthesis.speak(u);
  }

  isVowelSound(word) {
      const vowels = ['a', 'e', 'i', 'o', 'u'];
      return vowels.includes(word.charAt(0).toLowerCase());
  }

  normalizeNounType(nounType) {
        return String(nounType || '').trim().toLowerCase();
    }

    isCountableNoun(noun) {
        if (typeof noun?.countable === 'boolean') return noun.countable;
        return String(noun?.countable || '').trim().toLowerCase() === 'true';
    }

    getZeroArticleNounForm(noun) {
        const nounType = this.normalizeNounType(noun?.noun_type);
        const word = String(noun?.word || '').trim();
        const pluralForm = String(noun?.plural_form || '').trim();

        // Zero article: countable noun => plural form, uncountable noun => base word.
        // Với proper noun thì giữ nguyên từ gốc dù có cờ countable.
        if (nounType !== 'proper' && this.isCountableNoun(noun)) {
            return pluralForm || word;
        }

        return word;
    }

  async load(enemyType = "normal") {
      this._destroyed = false;
      
      try {
          // Kiểm tra data đã được load chưa
          if (!this.templates || this.templates.length === 0) {
              throw new Error("Không có dữ liệu question_templates");
          }
          if (!this.nouns || this.nouns.length === 0) {
              throw new Error("Không có dữ liệu nouns");
          }

          // Lọc templates cho grammar_type = 'article' và is_active = true
          const articleTemplates = this.templates.filter(t => 
              t.grammar_type === 'article' && t.is_active === true
          );

          if (articleTemplates.length === 0) {
              throw new Error("Không có template article active");
          }

          // Chọn ngẫu nhiên 1 template
          const template = this.pickRandom(articleTemplates);
          const answerType = String(template.answer_type || '').trim().toLowerCase();

          // Kiểm tra template có sử dụng {adj} không
          const hasAdjective = template.pattern.includes('{adj}');

          const activeNouns = this.nouns.filter(n => n?.is_active !== false);
          const activeSubjects = this.subjects.filter(s => s?.is_active !== false);

          const preferInstrument = answerType === 'article_instr';
          let nounCandidates = activeNouns;

          if (preferInstrument) {
              nounCandidates = activeNouns.filter(n => String(n.noun_type || '').trim().toLowerCase() === 'instrument');
          } else if (answerType === 'article_zero') {
                nounCandidates = activeNouns.filter(n => this.normalizeNounType(n?.noun_type) !== 'instrument');
          } else {
              nounCandidates = activeNouns.filter(n => String(n.noun_type || '').trim().toLowerCase() !== 'instrument');
          }

          if (nounCandidates.length === 0) {
              throw new Error("Không có noun phù hợp với answer_type hiện tại");
          }

          // Chọn ngẫu nhiên 1 noun
          const noun = this.pickRandom(nounCandidates);

          // Chọn ngẫu nhiên 1 adjective nếu template cần
          let adjective = null;
          if (hasAdjective) {
              if (!this.adjectives || this.adjectives.length === 0) {
                  throw new Error("Template cần adjective nhưng không có dữ liệu adjectives");
              }
              // Lọc adjectives is_active = true
              const activeAdjectives = this.adjectives.filter(adj => adj.is_active === true);
              if (activeAdjectives.length === 0) {
                  throw new Error("Không có adjective active");
              }
              adjective = this.pickRandom(activeAdjectives);
          }

          const subject = this.pickRandom(activeSubjects);

          // Tạo câu hỏi dựa trên answer_type
          let question = template.pattern;
          let correctAnswer = '';
          let articleSource = ''; // Để tracking: 'noun' hoặc 'adjective'

          if (answerType === 'article_indef') {
              // Câu hỏi dạng a/an (lần đầu nhắc đến)
              
              // LOGIC: Nếu có {adj} → dùng adjective.article_form, ngược lại → noun.article_form
              if (hasAdjective && adjective) {
                  correctAnswer = adjective.article_form;
                  articleSource = 'adjective';
                  // Replace {adj} và {noun}
                  question = question.replace('{adj}', adjective.base).replace('{noun}', noun.word);
              } else {
                  correctAnswer = noun.article_form;
                  articleSource = 'noun';
                  // Replace {noun}
                  question = question.replace('{noun}', noun.word);
              }

            } else if (answerType === 'article_def_2nd') {
              // Câu hỏi dạng the (lần thứ 2 nhắc đến)
              articleSource = 'second_mention';
              
              if (hasAdjective && adjective) {
                  // Pattern có 2 lần xuất hiện: lần 1 dùng a/an, lần 2 dùng the
                  const parts = question.split('{noun}');
                  if (parts.length >= 3) {
                      const firstArticle = adjective.article_form;
                      const firstPart = parts[0] + firstArticle + ' ' + adjective.base + ' ' + noun.word;
                      const secondPart = parts[1] + adjective.base + ' ' + noun.word;
                      question = firstPart + secondPart + parts[2];
                  }
              } else {
                  // Không có adjective
                  const parts = question.split('{noun}');
                  if (parts.length >= 3) {
                      const firstArticle = noun.article_form;
                      question = parts[0] + firstArticle + ' ' + noun.word + parts[1] + noun.word + parts[2];
                  }
              }
              
              correctAnswer = 'the';
            } else if (answerType === 'article_zero') {
              correctAnswer = '';
              const zeroArticleNoun = this.getZeroArticleNounForm(noun);
              question = question.replace('{noun}', zeroArticleNoun);
              if (hasAdjective && adjective) {
                  question = question.replace('{adj}', adjective.base);
              }
          } else if (answerType === 'article_instr') {
              if (!subject) {
                  throw new Error("Không có dữ liệu subjects cho template article_instr");
              }

              const subjectWord = String(subject.word || '').trim();
              const baseVerb = this.pickRandom(this.instrumentVerbs) || 'play';
              const verb = this.conjugateVerbBySubject(baseVerb, subject);

              question = question
                  .replace('{subject}', subjectWord)
                  .replace('{verb}', verb)
                  .replace('{noun}', noun.word);

              if (hasAdjective && adjective) {
                  question = question.replace('{adj}', adjective.base);
              }

              correctAnswer = 'the';
          } else {
              throw new Error(`answer_type không hỗ trợ: ${answerType}`);
          }

          // Tạo các lựa chọn (thêm blank cho article_zero)
          const choices = ['a', 'an', 'the', ''];

          const spokenSentence = question.replace(/___/g, correctAnswer ? `${correctAnswer} ` : '').replace(/\s+/g, ' ').trim();

          this.currentData = {
              question: question,
              correctAnswer: correctAnswer,
              choices: choices,
              noun: noun.word,
              adjective: adjective ? adjective.base : null,
              template: template.pattern,
              answerType: template.answer_type,
              articleForm: correctAnswer,
              articleSource: articleSource, // 'noun', 'adjective', hoặc 'second_mention'
              hasAdjective: hasAdjective,
              subject: subject ? subject.word : null,
              fullSentence: spokenSentence
          };

          this.renderQuestionUI();
      } catch (error) {
          console.error('[Question8] Load error:', error);
          this.renderError(error.message);
      }
  }

  renderQuestionUI() {
      const area = document.getElementById(this.containerId);
      if (!area || !this.currentData) return;

      const question = this.currentData.question;
      const choices = this.currentData.choices;

      area.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl relative overflow-hidden animate-fadeIn">
          <div class="absolute top-0 left-0 bg-purple-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold shadow z-10 uppercase tracking-tighter">
              Type 8: Articles (a/an/the)
          </div>

          <div class="p-8 bg-slate-800 rounded-3xl text-center text-white shadow-2xl border border-slate-700 w-full max-w-2xl">
              <div class="text-yellow-300 text-5xl mb-12 font-medium">
                  ${this.escapeHtml(question)}
              </div>
          
              <div id="article-choices" class="flex gap-6 justify-center mb-6"></div>
              
              <div id="feedback-area" class="mt-8 min-h-[100px]"></div>
          </div>
      </div>
      `;

      const container = document.getElementById("article-choices");
      choices.forEach(ch => {
          const btn = document.createElement("button");
          btn.className = "px-12 py-6 bg-white text-slate-800 rounded-2xl font-black text-3xl shadow-md hover:bg-yellow-400 hover:scale-110 transition-all duration-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1";
          btn.innerText = ch === '' ? 'Để trống' : ch;
          btn.onclick = () => this.handleChoice(ch, btn);
          container.appendChild(btn);
      });
  }

    buildArticleFeedback({ isCorrect, answerType, noun, adjective, correct, choice }) {
        const section = isCorrect ? 'correct' : 'wrong';
  
        // Chuẩn hóa answerType
        const normalizedType =
            answerType === 'article_def_instrument'
                ? 'article_instr'
                : answerType;
  
        // Trường hợp a/an cần xử lý vowel riêng
        if (normalizedType === 'article_indef') {
            const word = adjective || noun;
            const isVowel = this.isVowelSound(word);
  
            if (isCorrect) {
                return `
                <div class="flex items-start gap-2">
                    <span class="text-green-400 text-xl">✅</span>
                    <span class="text-white text-lg">
                        "<strong>${correct}</strong>" là đúng vì "<strong>${word}</strong>"
                        ${isVowel ? 'bắt đầu bằng nguyên âm.' : 'bắt đầu bằng phụ âm.'}
                    </span>
                </div>
                `;
            }
            return `
            <div class="flex items-start gap-2">
                <span class="text-red-400 text-xl">❌</span>
                <span class="text-white text-lg">
                    "<strong>${choice}</strong>" sai. Phải dùng "<strong>${correct}</strong>"
                    vì "<strong>${word}</strong>"
                    ${isVowel ? 'bắt đầu bằng nguyên âm.' : 'bắt đầu bằng phụ âm.'}
                </span>
            </div>
            `;
        }
        // Các loại còn lại dùng object chuẩn
      return `
      <div class="flex items-start gap-2">
          <span class="${isCorrect ? 'text-green-400' : 'text-red-400'} text-xl">
              ${isCorrect ? '✅' : '❌'}
          </span>
          <span class="text-white text-lg">
              ${this.formatArticleExplanation(section, normalizedType, { noun })}
          </span>
      </div>
      `;
    }

  handleChoice(choice, btnEl) {
      if (this._destroyed || !this.currentData) return;
      const correct = this.currentData.correctAnswer;
      const answerType = this.currentData.answerType;
      const noun = this.currentData.noun;
      const adjective = this.currentData.adjective;
      const feedbackArea = document.getElementById("feedback-area");
      const isCorrect =
        String(choice).trim().toLowerCase() ===
        String(correct).trim().toLowerCase();

        if (isCorrect) {
    
        btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
          btnEl.classList.add("bg-green-500", "text-white", "border-green-700");
          
          if (feedbackArea) {
            feedbackArea.innerHTML = this.buildArticleFeedback({
                isCorrect,
                answerType,
                noun,
                adjective,
                correct,
                choice
            });            
            this.speak(this.currentData.fullSentence);
          }   
          if (typeof this.onCorrect === "function") {
              this.onCorrect(1);
          }
      } else {
          btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
          btnEl.classList.add("bg-red-500", "text-white", "border-red-700", "animate-shake");
          
          if (feedbackArea) {
            feedbackArea.innerHTML = this.buildArticleFeedback({
                isCorrect,
                answerType,
                noun,
                adjective,
                correct,
                choice
            });
            }
          if (typeof this.onWrong === "function") {
              this.onWrong();
          }
      }
  }

  renderError(message) {
      const area = document.getElementById(this.containerId);
      if (!area) return;
      
      area.innerHTML = `
      <div class="w-full h-full flex items-center justify-center p-6">
          <div class="p-8 bg-red-100 border-2 border-red-500 rounded-2xl text-center">
              <p class="text-red-600 font-bold text-xl mb-4">${this.escapeHtml(message)}</p>
              <button onclick="location.reload()" class="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600">
                  Tải lại
              </button>
          </div>
      </div>
      `;
  }

  escapeHtml(str) {
      if (!str) return "";
      return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  destroy() {
      this._destroyed = true;
      try { window.speechSynthesis.cancel(); } catch (e) { }
      const area = document.getElementById(this.containerId);
      if (area) area.innerHTML = "";
      this.currentData = null;
  }
}

window.Question8 = Question8;
export default Question8;