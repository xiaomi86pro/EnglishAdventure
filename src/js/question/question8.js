export default class Question8 {
    constructor({ vocabPool = [], containerId = 'questionarea', config = {} }) {
      this.containerId = containerId;
      this.config = config;
      this._destroyed = false;
  
      this.templates = [];
      this.nouns = [];
      this.subjects = [];
  
      this.currentData = null;
      this.onCorrect = null;
      this.onWrong = null;
    }
  
    /* ========================
       INIT
    ========================= */
    async init() {
      this._destroyed = false;
  
      const cache = window.GRAMMAR_CACHE || {};
  
      this.templates = (cache.templates || []).filter(
        t => t.grammar_type === 'article' && t.is_active === true
      );
  
      this.nouns = cache.nouns || [];
      this.subjects = cache.subjects || [];
  
      if (!this.templates.length || !this.nouns.length) {
        this._fallback();
        return;
      }
  
      this.buildQuestion();
      this.render();
    }
  
    /* ========================
       QUESTION BUILD
    ========================= */
    buildQuestion() {
      const tpl = this._pick(this.templates);
      let nounPool = this.nouns.filter(n => n.difficulty === tpl.difficulty);
  
      // Nhạc cụ
      if (tpl.answer_type === 'article_def_instrument') {
        nounPool = nounPool.filter(n => n.noun_type === 'instrument');
      } else {
        nounPool = nounPool.filter(n => n.noun_type !== 'instrument');
      }
  
      const noun = this._pick(nounPool);
      const subject = this._pick(this.subjects);
  
      const correct = this.resolveCorrectAnswer(tpl, noun);
      const sentence = this.composeSentence(tpl.pattern, noun, subject, correct);
  
      this.currentData = {
        template: tpl,
        noun,
        subject,
        correct,
        sentence
      };
    }
  
    /* ========================
       ANSWER LOGIC
    ========================= */
    resolveCorrectAnswer(template, noun) {
      switch (template.answer_type) {
        case 'article_indef':
          return this.isVowelSound(noun.word) ? 'an' : 'a';
  
        case 'article_def_2nd':
        case 'article_def_instrument':
          return 'the';
  
        case 'article_zero':
          return 'zero';
  
        default:
          return 'a';
      }
    }
  
    isVowelSound(word) {
      return /^[aeiou]/i.test(word);
    }
  
    /* ========================
       SENTENCE BUILD
    ========================= */
    composeSentence(pattern, noun, subject, article) {
      let art = article === 'zero' ? '' : article;
      let sentence = pattern;
  
      sentence = sentence.replace('{subject}', subject.word);
      sentence = sentence.replace('{noun}', noun.word);
  
      sentence = sentence.replace('___', art);
  
      // cleanup double spaces
      return sentence.replace(/\s+/g, ' ').replace(' .', '.').trim();
    }
  
    /* ========================
       UI
    ========================= */
    render() {
      if (this._destroyed) return;
  
      const area = document.getElementById(this.containerId);
      if (!area) return;
  
      const options = ['a', 'an', 'the', 'zero'];
  
      area.innerHTML = `
        <div class="p-6 bg-slate-900 rounded-3xl text-white text-center">
          <div class="text-3xl mb-6">
            ${this.escapeHtml(this.currentData.sentence)}
          </div>
  
          <div class="flex gap-4 justify-center mb-4">
            ${options.map(o => `
              <button
                data-choice="${o}"
                class="article-btn px-6 py-3 bg-white text-slate-800 rounded-xl font-bold text-xl">
                ${o === 'zero' ? '(no article)' : o}
              </button>
            `).join('')}
          </div>
  
          <div id="article-note" class="text-sm text-slate-300 mt-4"></div>
        </div>
      `;
  
      area.querySelectorAll('.article-btn').forEach(btn => {
        btn.onclick = () => this.handleChoice(btn.dataset.choice, btn);
      });
    }
  
    handleChoice(choice, btn) {
      if (this._destroyed) return;
  
      const correct = this.currentData.correct;
      const noteEl = document.getElementById('article-note');
  
      if (choice === correct) {
        btn.classList.add('bg-green-500', 'text-white');
        this.showNote(true);
  
        if (this.config.speakOnCorrect) {
          this.speak(this.currentData.sentence);
        }
  
        this.onCorrect?.(1);
      } else {
        btn.classList.add('bg-red-500', 'text-white');
        this.showNote(false);
        this.onWrong?.();
      }
    }
  
    showNote(isCorrect) {
      const el = document.getElementById('article-note');
      if (!el) return;
  
      const tpl = this.currentData.template;
  
      if (isCorrect) {
        el.textContent = tpl.note || 'Correct.';
      } else {
        el.textContent = 'Incorrect. Think about article usage.';
      }
    }
  
    /* ========================
       SPEAK
    ========================= */
    speak(text) {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      speechSynthesis.speak(u);
    }
  
    /* ========================
       UTILS
    ========================= */
    _pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
  
    escapeHtml(str) {
      return str.replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
      );
    }
  
    _fallback() {
      this.currentData = {
        sentence: 'This is ___ apple.',
        correct: 'an',
        template: { note: 'Apple starts with a vowel sound → use an.' }
      };
      this.render();
    }
  
    destroy() {
      this._destroyed = true;
    }
  }
  