class Question8 {
    constructor(opts = {}) {
      this.containerId = opts.containerId || "questionarea";
      this.nouns = opts.nouns || [];
      this.verbs = opts.verbs || [];
      this.onCorrect = opts.onCorrect || null;
      this.onWrong = opts.onWrong || null;
  
      this.currentData = null;
      this._destroyed = false;
    }
  
    async load(enemyType = "normal") {
      this._destroyed = false;
  
      // Chọn ngẫu nhiên subject, verb, noun
      const subjects = ["He", "She", "They", "We", "I"];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
  
      const verb = this.verbs[Math.floor(Math.random() * this.verbs.length)];
      const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
  
      // Xác định article đúng
      const correctArticle = this.chooseArticle(noun);
  
      // Sinh câu
      const sentence = `${subject} ${verb.base_form || verb.word} ___ ${noun.word}.`;
  
      this.currentData = {
        sentence,
        correctAnswer: correctArticle,
        options: ["a", "an", "the"]
      };
  
      this.renderQuestionUI();
    }
  
    chooseArticle(noun) {
      if (!noun || !noun.word) return "";
      const word = noun.word.toLowerCase();
  
      if (noun.is_countable) {
        const firstChar = word[0];
        if (["a","e","i","o","u"].includes(firstChar)) {
          return "an";
        } else {
          return "a";
        }
      }
      return "the";
    }
  
    renderQuestionUI() {
      const area = document.getElementById(this.containerId);
      if (!area || !this.currentData) return;
  
      const { sentence, options } = this.currentData;
  
      area.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-indigo-900 rounded-3xl animate-fadeIn">
          <div class="absolute top-0 left-0 bg-indigo-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold shadow uppercase tracking-tighter">
            Type 8: Grammar – Articles
          </div>
  
          <div class="p-8 bg-indigo-800 rounded-3xl text-center text-white shadow-2xl border border-indigo-700 w-full max-w-2xl">
            <div class="text-yellow-300 italic text-3xl mb-8 font-medium">
              ${this.escapeHtml(sentence)}
            </div>
          
            <div id="article-choices" class="grid grid-cols-3 gap-4"></div>
          </div>
        </div>
      `;
  
      const container = document.getElementById("article-choices");
      options.forEach(ch => {
        const btn = document.createElement("button");
        btn.className = "p-6 bg-white text-slate-800 rounded-2xl font-black text-xl shadow-md hover:bg-yellow-400 hover:scale-105 transition-all duration-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1";
        btn.innerText = ch;
        btn.onclick = () => this.handleChoice(ch, btn);
        container.appendChild(btn);
      });
    }
  
    handleChoice(choice, btnEl) {
      if (this._destroyed || !this.currentData) return;
      const correct = this.currentData.correctAnswer;
  
      if (choice === correct) {
        btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
        btnEl.classList.add("bg-green-500", "text-white", "border-green-700");
        if (typeof this.onCorrect === "function") this.onCorrect(1);
      } else {
        btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
        btnEl.classList.add("bg-red-500", "text-white", "border-red-700", "animate-shake");
        if (typeof this.onWrong === "function") this.onWrong();
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