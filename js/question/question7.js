// js/question/question7.js
// Question Type 7: Listen and pick (Multiple Choice) - Class Version

class QuestionTypeSimpleMC {
  constructor(opts = {}) {
      this._vocabulary = opts.vocabPool || [];
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

  async load(enemyType = "normal") {
      this._destroyed = false;
      // Sử dụng từ vựng được truyền vào hoặc từ cache toàn cục
      const vocab = this._vocabulary || (window.QuestionManager && window.QuestionManager.vocabulary) || [];
      
      if (!vocab || vocab.length === 0) {
          // Dữ liệu mẫu nếu không có vocab
          this.currentData = { 
              english_word: "apple", 
              vietnamese_translation: "Quả Táo", 
              choices: ["apple", "banana", "grape", "orange"] 
          };
          this.renderQuestionUI();
          return;
      }

      // Chọn một từ ngẫu nhiên và tạo danh sách lựa chọn
      const pick = vocab[Math.floor(Math.random() * vocab.length)];
      const correct = String(pick.english_word || pick.english || "").trim();
      const choices = [correct];

      // Lấy thêm 3 lựa chọn sai
      while (choices.length < 4) {
          const c = vocab[Math.floor(Math.random() * vocab.length)];
          const txt = String(c.english_word || c.english || "").trim();
          if (txt && !choices.includes(txt)) choices.push(txt);
      }

      // Trộn ngẫu nhiên các lựa chọn
      choices.sort(() => Math.random() - 0.5);

      this.currentData = {
          english_word: correct,
          vietnamese_translation: String(pick.vietnamese_translation || pick.vietnamese || ""),
          choices
      };

      this.renderQuestionUI();
      this.speak(this.currentData.english_word);
  }

  renderQuestionUI() {
      const area = document.getElementById(this.containerId);
      if (!area || !this.currentData) return;

      const en = this.currentData.english_word;
      const vi = this.currentData.vietnamese_translation;
      const choices = this.currentData.choices || [];

      area.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl relative overflow-hidden animate-fadeIn">
          <div class="absolute top-0 left-0 bg-yellow-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold shadow z-10 uppercase tracking-tighter">
              Type 7: Listen and pick
          </div>

          <div class="p-8 bg-slate-800 rounded-3xl text-center text-white shadow-2xl border border-slate-700 w-full max-w-2xl">
              <div class="text-yellow-300 italic text-2xl mb-8 font-medium">
                  "${this.escapeHtml(vi)}"
              </div>
          
              <div id="mc-choices" class="grid grid-cols-2 gap-4"></div>

              <div class="mt-8 flex justify-center">
                  <button id="replay-sound" class="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-bold text-xl transition-all shadow-lg active:scale-95">
                      <span class="text-2xl">🔊</span> Replay Sound
                  </button>
              </div>
          </div>
      </div>
      `;

      const container = document.getElementById("mc-choices");
      choices.forEach(ch => {
          const btn = document.createElement("button");
          // Tăng padding, bo góc và cỡ chữ (text-2xl)
          btn.className = "p-6 bg-white text-slate-800 rounded-2xl font-black text-2xl shadow-md hover:bg-yellow-400 hover:scale-105 transition-all duration-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1";
          btn.innerText = ch;
          btn.onclick = () => this.handleChoice(ch, btn);
          container.appendChild(btn);
      });

      const replay = document.getElementById("replay-sound");
      if (replay) replay.onclick = () => this.speak(en);
  }

  handleChoice(choice, btnEl) {
      if (this._destroyed || !this.currentData) return;
      const correct = this.currentData.english_word;

      if (String(choice).trim().toLowerCase() === String(correct).trim().toLowerCase()) {
          btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
          btnEl.classList.add("bg-green-500", "text-white", "border-green-700");
          
          if (typeof this.onCorrect === "function") {
              this.onCorrect(1); // 1 hit
          }
      } else {
          btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
          btnEl.classList.add("bg-red-500", "text-white", "border-red-700", "animate-shake");
          
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
      try { window.speechSynthesis.cancel(); } catch (e) { }
      const area = document.getElementById(this.containerId);
      if (area) area.innerHTML = "";
      this.currentData = null;
  }
}

window.QuestionTypeSimpleMC = QuestionTypeSimpleMC;
export default QuestionTypeSimpleMC;