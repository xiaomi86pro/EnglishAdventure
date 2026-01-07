// js/question/question1.js
class Question1 {
    constructor(opts = {}) {
      this.vocabPool = opts.vocabPool || [];
      this.containerId = opts.containerId || 'questionarea';
      this.onCorrect = opts.onCorrect || null;
      this.onWrong = opts.onWrong || null;
      
      this.currentData = null;
      this.enCompleted = "";
      this.viCompleted = "";
      this._destroyed = false;
      this._lastAnswered = null;
    }
  
    init(enemyType = "normal") {
      this._destroyed = false;
      this._selectWord(enemyType);
      this.renderQuestionUI();
    }
    
    speak(text, lang = "en-US", rate = 1.0) {
        if (!window.speechSynthesis || this._destroyed) return;
        // Không dùng cancel() ở đây để tránh làm ngắt quãng âm thanh bấm nhanh
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.speak(u);
      }

    _selectWord(enemyType) {
      if (!this.vocabPool.length) return;
      let valid = this.vocabPool.filter(v => v?.english_word && v?.vietnamese_translation);
      
      // Lọc theo độ dài tùy quái
      if (enemyType === "normal") {
        valid = valid.filter(v => v.english_word.trim().length <= 5);
      } else {
        valid = valid.filter(v => v.english_word.trim().length > 5);
      }
  
      if (valid.length === 0) valid = this.vocabPool;
      this.currentData = valid[Math.floor(Math.random() * valid.length)];
      this.enCompleted = "";
      this.viCompleted = "";
    }
  
    renderQuestionUI() {
      const area = document.getElementById(this.containerId);
      if (!area || !this.currentData) return;
  
      const wordEn = String(this.currentData.english_word || "").trim();
      const wordVi = String(this.currentData.vietnamese_translation || "").trim();
  
      area.innerHTML = `
        <div class="flex w-full h-full p-4 relative bg-black rounded-3xl">
          <div class="absolute top-0 left-0 bg-purple-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow">Q1</div>
          <div class="flex-1 flex flex-col justify-start gap-8 py-2 px-4 w-full">
            <div id="preview-area" class="w-full flex flex-col items-center justify-center mb-4 h-20">
               <h2 class="text-4xl font-black text-blue-400 uppercase">${wordEn}</h2>
               <h3 class="text-2xl font-bold text-green-400 italic">${wordVi}</h3>
            </div>
            
            <div class="flex flex-col items-center w-full">
              <div id="en-slots" class="flex flex-wrap justify-center items-center gap-2 mb-4 h-14 w-full border-b-2 border-gray-700"></div>
              <div id="en-letters" class="flex flex-wrap justify-center gap-3 w-full"></div>   
            </div>
            
            <div class="flex flex-col items-center w-full">
              <div id="vi-slots" class="flex flex-wrap justify-center items-center gap-2 mb-4 h-14 w-full border-b-2 border-gray-700"></div>
              <div id="vi-letters" class="flex flex-wrap justify-center gap-3 w-full"></div>               
            </div>
          </div>
        </div>
      `;
  
      this.setupLetters(wordEn, "en");
      this.setupLetters(wordVi, "vi");
    }
  
    setupLetters(word, lang) {
        const lettersContainer = document.getElementById(`${lang}-letters`);
        const slotsContainer = document.getElementById(`${lang}-slots`);
        if (!lettersContainer || !slotsContainer) return;
    
        let cleanWordChars = word.replace(/\s+/g, '').toLowerCase().split('');
        let originalChars = word.split('').filter(c => c !== ' ');
    
        slotsContainer.innerHTML = "";
        originalChars.forEach(() => {
            const slot = document.createElement("div");
            slot.className = "w-10 h-10 border-2 border-gray-700 bg-gray-900 rounded-lg flex items-center justify-center text-xl font-bold text-white/20";
            slot.innerText = "?";
            slotsContainer.appendChild(slot);
        });
    
        const shuffled = originalChars.map((c, i) => ({ c, i })).sort(() => Math.random() - 0.5);
    
        shuffled.forEach((item) => {
          const btn = document.createElement("div");
          btn.className = `w-12 h-12 bg-white border-2 border-gray-400 rounded-xl flex items-center justify-center text-2xl font-bold cursor-pointer active:scale-90`;
          btn.innerText = item.c.toUpperCase();
    
          btn.onclick = () => {
            const currentStr = (lang === "en" ? this.enCompleted : this.viCompleted).toLowerCase();
            const fullCleanWord = word.replace(/\s+/g, '').toLowerCase();
            
            if (item.c.toLowerCase() === fullCleanWord[currentStr.length]) {
              // --- ĐÚNG ---
    
              // CHỈ PHÁT ÂM NẾU LÀ TIẾNG ANH (lang === "en")
              if (lang === "en") {
                this.speak(item.c, "en-US", 1.2); 
                this.enCompleted += item.c;
              } else {
                // Tiếng Việt chỉ cộng chuỗi, không gọi hàm speak ở đây
                this.viCompleted += item.c;
              }
          
              const slots = slotsContainer.querySelectorAll("div");
              const currentSlot = slots[currentStr.length];
              
              if (currentSlot) {
                currentSlot.innerText = item.c.toUpperCase();
                currentSlot.className = `w-10 h-10 text-white rounded-lg flex items-center justify-center text-xl font-black ${lang === "en" ? "bg-blue-600" : "bg-green-600"}`;
              }
    
              btn.style.visibility = "hidden";
              this.checkProgress();
            } else {
              // --- SAI ---
              btn.classList.add("shake", "bg-red-200");
              setTimeout(() => btn.classList.remove("shake", "bg-red-200"), 400);
              if (typeof this.onWrong === "function") this.onWrong();
            }
          };
          lettersContainer.appendChild(btn);
        });
      }

      checkProgress() {
        const wordEn = this.currentData.english_word.replace(/\s+/g, "").toLowerCase();
        const wordVi = this.currentData.vietnamese_translation.replace(/\s+/g, "").toLowerCase();
        
        if (this.enCompleted.toLowerCase() === wordEn && this.viCompleted.toLowerCase() === wordVi) {
          this._lastAnswered = { 
            en: this.currentData.english_word, 
            vi: this.currentData.vietnamese_translation 
          };
          
          // Đọc toàn bộ từ khi hoàn thành
          setTimeout(() => {
            if (this._destroyed) return;
            speechSynthesis.cancel(); 
            
            // Phát âm tiếng Anh trước, sau đó là tiếng Việt
            this.speak(this.currentData.english_word, "en-US", 0.9);
            
            // Delay nhẹ để đọc tiếng Việt sau tiếng Anh
            setTimeout(() => {
                if (!this._destroyed) this.speak(this.currentData.vietnamese_translation, "vi-VN", 0.9);
            }, 1200);
            
            if (typeof this.onCorrect === "function") this.onCorrect(1, true);
          }, 500);
        }
      }
  
    destroy() { 
      this._destroyed = true; 
      const area = document.getElementById(this.containerId);
      if (area) area.innerHTML = "";
    }
  }
  
  export default Question1;