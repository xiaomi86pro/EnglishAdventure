// js/question/question8.js
// Question Type 8: Articles (a/an/the) - Class Version

class Question8 {
  constructor(opts = {}) {
      // Nhận data từ QuestionManager thay vì query DB
      this.dataPool = opts.dataPool || {};
      this.templates = this.dataPool.question_templates || [];
      this.nouns = this.dataPool.nouns || [];
      this.adjectives = this.dataPool.adjectives || [];
      
      this.containerId = opts.containerId || "questionarea";
      this.onCorrect = opts.onCorrect || null;
      this.onWrong = opts.onWrong || null;

      this.autoReload = true;
      this.currentData = null;
      this._destroyed = false;
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
          const template = articleTemplates[Math.floor(Math.random() * articleTemplates.length)];

          // Chọn ngẫu nhiên 1 noun
          const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];

          // Tạo câu hỏi dựa trên answer_type
          let question = template.pattern;
          let correctAnswer = '';

          if (template.answer_type === 'article_indef') {
              // Câu hỏi dạng a/an (lần đầu nhắc đến)
              question = question.replace('{noun}', noun.word);
              correctAnswer = noun.article_form; // a hoặc an
          } else if (template.answer_type === 'article_def_2nd') {
              // Câu hỏi dạng the (lần thứ 2 nhắc đến)
              // Pattern có 2 {noun}, cái đầu tiên dùng a/an, cái thứ 2 dùng the
              const parts = question.split('{noun}');
              if (parts.length >= 3) {
                  question = parts[0] + noun.article_form + ' ' + noun.word + parts[1] + noun.word + parts[2];
              }
              correctAnswer = 'the';
          }

          // Tạo các lựa chọn (luôn có đủ 3 options: a, an, the)
          const choices = ['a', 'an', 'the'];

          this.currentData = {
              question: question,
              correctAnswer: correctAnswer,
              choices: choices,
              noun: noun.word,
              template: template.pattern,
              answerType: template.answer_type,
              articleForm: noun.article_form
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
          btn.innerText = ch;
          btn.onclick = () => this.handleChoice(ch, btn);
          container.appendChild(btn);
      });
  }

  handleChoice(choice, btnEl) {
      if (this._destroyed || !this.currentData) return;
      const correct = this.currentData.correctAnswer;
      const answerType = this.currentData.answerType;
      const noun = this.currentData.noun;
      const articleForm = this.currentData.articleForm;
      const feedbackArea = document.getElementById("feedback-area");

      if (String(choice).trim().toLowerCase() === String(correct).trim().toLowerCase()) {
          // ĐÁP ÁN ĐÚNG
          btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
          btnEl.classList.add("bg-green-500", "text-white", "border-green-700");
          
          // Hiển thị feedback khi đúng
          if (feedbackArea) {
              let feedback = '';
              
              if (answerType === 'article_indef') {
                  // Đúng a/an
                  const isVowel = this.isVowelSound(noun);
                  const wrongArticle = articleForm === 'a' ? 'an' : 'a';
                  
                  feedback = `
                  <div class="text-left space-y-2">
                      <div class="flex items-start gap-2">
                          <span class="text-green-400 text-xl">✅</span>
                          <span class="text-white text-lg">"<strong>${articleForm}</strong>" is correct because "<strong>${noun}</strong>" ${isVowel ? 'starts with a vowel sound' : 'starts with a consonant sound'}.</span>
                      </div>
                      <div class="flex items-start gap-2">
                          <span class="text-red-400 text-xl">❌</span>
                          <span class="text-gray-300 text-lg">"The" is not used because this is the first mention.</span>
                      </div>
                  </div>
                  `;
              } else if (answerType === 'article_def_2nd') {
                  // Đúng the
                  feedback = `
                  <div class="text-left space-y-2">
                      <div class="flex items-start gap-2">
                          <span class="text-green-400 text-xl">✅</span>
                          <span class="text-white text-lg">"<strong>The</strong>" is correct because this is the second mention of the noun.</span>
                      </div>
                      <div class="flex items-start gap-2">
                          <span class="text-red-400 text-xl">❌</span>
                          <span class="text-gray-300 text-lg">"A/An" is only used for the first mention.</span>
                      </div>
                  </div>
                  `;
              }
              
              feedbackArea.innerHTML = feedback;
          }
          
          if (typeof this.onCorrect === "function") {
              this.onCorrect(1);
          }
      } else {
          // ĐÁP ÁN SAI
          btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
          btnEl.classList.add("bg-red-500", "text-white", "border-red-700", "animate-shake");
          
          // Hiển thị feedback khi sai
          if (feedbackArea) {
              let feedback = '';
              
              if (answerType === 'article_indef') {
                  // Sai khi chọn the thay vì a/an
                  if (choice === 'the') {
                      feedback = `
                      <div class="text-left">
                          <div class="flex items-start gap-2">
                              <span class="text-red-400 text-xl">❌</span>
                              <span class="text-white text-lg">We don't use "<strong>the</strong>" here because this is the first time the noun is mentioned and it is not specific.</span>
                          </div>
                      </div>
                      `;
                  } else {
                      // Sai khi chọn a/an nhưng không đúng loại
                      const isVowel = this.isVowelSound(noun);
                      feedback = `
                      <div class="text-left">
                          <div class="flex items-start gap-2">
                              <span class="text-red-400 text-xl">❌</span>
                              <span class="text-white text-lg">"<strong>${choice}</strong>" is wrong. Use "<strong>${articleForm}</strong>" because "<strong>${noun}</strong>" ${isVowel ? 'starts with a vowel sound' : 'starts with a consonant sound'}.</span>
                          </div>
                      </div>
                      `;
                  }
              } else if (answerType === 'article_def_2nd') {
                  // Sai khi chọn a/an thay vì the
                  if (choice === 'a' || choice === 'an') {
                      feedback = `
                      <div class="text-left">
                          <div class="flex items-start gap-2">
                              <span class="text-red-400 text-xl">❌</span>
                              <span class="text-white text-lg">We must use "<strong>the</strong>" here because this is the second mention of the noun. The noun is now specific.</span>
                          </div>
                      </div>
                      `;
                  }
              }
              
              feedbackArea.innerHTML = feedback;
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