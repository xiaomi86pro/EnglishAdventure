// js/question/question8.js
// Question Type 8: Fill article (a / an)

class Question8 {
    constructor(opts = {}) {
      this.containerId = opts.containerId || "questionarea";
      this.onCorrect = opts.onCorrect || null;
      this.onWrong = opts.onWrong || null;
  
      this.autoReload = true;
      this.currentData = null;
      this._destroyed = false;
    }
  
    async load() {
      this._destroyed = false;
  
      const templates = window.GRAMMAR_CACHE?.templates || [];
      const nouns = window.GRAMMAR_CACHE?.nouns || [];
  
      if (!templates.length || !nouns.length) {
        // fallback data để test UI
        this.currentData = {
          sentence: "She has ____ apple.",
          correct: "an"
        };
        this.renderQuestionUI();
        return;
      }
  
      // 1. pick template (article)
      const tpl = templates[Math.floor(Math.random() * templates.length)];
  
      // 2. pick noun phù hợp
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
      // 3. replace noun vào câu
      const sentence = tpl.pattern.replace('{noun}', noun.word);
  
      this.currentData = {
        sentence,
        correct: noun.article_form.toLowerCase()
      };
  
      this.renderQuestionUI();
    }
  
    renderQuestionUI() {
      const area = document.getElementById(this.containerId);
      if (!area || !this.currentData) return;
  
      area.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl animate-fadeIn">
          <div class="absolute top-0 left-0 bg-indigo-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold shadow uppercase tracking-tight">
            Type 8: Articles (a / an)
          </div>
  
          <div class="p-8 bg-slate-800 rounded-3xl text-white shadow-xl border border-slate-700 w-full max-w-2xl text-center">
            <div class="text-3xl mb-8 font-medium">
              ${this.escapeHtml(this.currentData.sentence)}
            </div>
  
            <div class="flex gap-6 justify-center">
              ${["a", "an"].map(a => `
                <button data-ans="${a}"
                  class="article-btn px-8 py-4 bg-white text-slate-800 rounded-2xl font-black text-2xl shadow-md hover:bg-yellow-400 transition-all">
                  ${a}
                </button>
              `).join("")}
            </div>
          </div>
        </div>
      `;
  
      const buttons = area.querySelectorAll(".article-btn");
      buttons.forEach(btn => {
        btn.onclick = () => this.handleChoice(btn.dataset.ans, btn);
      });
    }
  
    handleChoice(choice, btnEl) {
      if (this._destroyed || !this.currentData) return;
  
      const correct = this.currentData.correct;
  
      if (choice === correct) {
        btnEl.classList.remove("bg-white", "text-slate-800");
        btnEl.classList.add("bg-green-500", "text-white");
  
        if (typeof this.onCorrect === "function") {
          this.onCorrect(1);
        }
      } else {
        btnEl.classList.remove("bg-white", "text-slate-800");
        btnEl.classList.add("bg-red-500", "text-white", "animate-shake");
  
        if (typeof this.onWrong === "function") {
          this.onWrong();
        }
      }
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
      const area = document.getElementById(this.containerId);
      if (area) area.innerHTML = "";
      this.currentData = null;
    }
  }
  
  window.Question8 = Question8;
  export default Question8;
  