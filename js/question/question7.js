// js/question/question7.js
const QuestionTypeSimpleMC = {
    autoReload: true,
    currentData: null,
    onCorrect: null,
    onWrong: null,
  
    speak(text, lang = "en-US", rate = 0.95) {
      if (!window.speechSynthesis) return;
      try { speechSynthesis.cancel(); } catch(e){}
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      speechSynthesis.speak(u);
    },
  
    async load(enemyType = "normal") {
      // minimal: use preloaded vocabulary if available
      const vocab = this._vocabulary || (window.QuestionManager && window.QuestionManager.vocabulary) || [];
      if (!vocab || vocab.length === 0) {
        // fallback small static list
        this.currentData = { english_word: "apple", vietnamese_translation: "Táo", choices: ["apple","banana","grape","orange"] };
        this.renderQuestionUI();
        return;
      }
  
      // pick a random item and build choices
      const pick = vocab[Math.floor(Math.random() * vocab.length)];
      const correct = String(pick.english_word || pick.english || "").trim();
      const choices = [correct];
      // fill up to 4 choices
      while (choices.length < 4) {
        const c = vocab[Math.floor(Math.random() * vocab.length)];
        const txt = String(c.english_word || c.english || "").trim();
        if (txt && !choices.includes(txt)) choices.push(txt);
      }
      // shuffle
      choices.sort(() => Math.random() - 0.5);
  
      this.currentData = {
        english_word: correct,
        vietnamese_translation: String(pick.vietnamese_translation || pick.vietnamese || ""),
        choices
      };
  
      this.renderQuestionUI();
      // optional: speak the word
      this.speak(this.currentData.english_word);
    },
  
    renderQuestionUI() {
      const area = document.getElementById("questionarea");
      if (!area || !this.currentData) return;
      const en = this.currentData.english_word;
      const vi = this.currentData.vietnamese_translation;
      const choices = this.currentData.choices || [];
  
      area.innerHTML = `
        <div class="p-6 bg-slate-800 rounded-2xl text-center text-white">
          <div class="text-yellow-300 italic text-lg mb-3">${this.escapeHtml(vi)}</div>
          <div id="mc-choices" class="grid grid-cols-2 gap-3"></div>
          <div class="mt-4">
            <button id="replay-sound" class="px-4 py-2 bg-blue-500 rounded text-white">🔊 Replay</button>
          </div>
        </div>
      `;
  
      const container = document.getElementById("mc-choices");
      choices.forEach(ch => {
        const btn = document.createElement("button");
        btn.className = "p-3 bg-white text-slate-800 rounded-lg font-bold hover:bg-yellow-100";
        btn.innerText = ch;
        btn.onclick = () => this.handleChoice(ch, btn);
        container.appendChild(btn);
      });
  
      const replay = document.getElementById("replay-sound");
      if (replay) replay.onclick = () => this.speak(en);
    },
  
    handleChoice(choice, btnEl) {
      const correct = this.currentData.english_word;
      if (String(choice).trim().toLowerCase() === String(correct).trim().toLowerCase()) {
        btnEl.classList.add("bg-green-500","text-white");
        // call onCorrect with 1 hit
        if (typeof this.onCorrect === "function") this.onCorrect(1);
      } else {
        btnEl.classList.add("bg-red-500","text-white");
        if (typeof this.onWrong === "function") this.onWrong();
      }
    },
  
    escapeHtml(str) {
      if (!str) return "";
      return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    },
  
    destroy() {
      const area = document.getElementById("questionarea");
      if (area) area.innerHTML = "";
      this.currentData = null;
    }
  };
  
  window.QuestionTypeSimpleMC = QuestionTypeSimpleMC;
  export default QuestionTypeSimpleMC;