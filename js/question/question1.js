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
      <style>
        .letter-fall {
          animation: fallIn 0.5s ease-out forwards;
        }
        @keyframes fallIn {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .space-box {
          width: 16px;
        }
      </style>
      <div class="flex w-full h-full p-4 relative bg-black rounded-3xl">
        <div class="absolute top-0 left-0 bg-purple-600 text-white px-3 py-1 rounded-br-2xl text-xs font-bold shadow">Question Type 1 : Pick letters</div>
        <div class="flex-1 flex flex-col justify-start gap-8 py-2 px-4 w-full">
          <div id="preview-area" class="w-full flex flex-col items-center justify-center mb-4 h-20">
             <h2 class="text-4xl font-black text-blue-400 uppercase">${wordEn}</h2>
             <h3 class="text-2xl font-bold text-green-400 italic">${wordVi}</h3>
          </div>
          
          <div class="flex flex-col items-center w-full">
            <div id="en-slots" class="flex flex-wrap justify-center items-center gap-2 mb-4 min-h-14 w-full border-b-2 border-gray-700"></div>
            <div id="en-letters" class="flex flex-wrap justify-center gap-3 w-full"></div>   
          </div>
          
          <div class="flex flex-col items-center w-full">
            <div id="vi-slots" class="flex flex-wrap justify-center items-center gap-2 mb-4 min-h-14 w-full border-b-2 border-gray-700"></div>
            <div id="vi-letters" class="flex flex-wrap justify-center gap-3 w-full"></div>               
          </div>
        </div>
      </div>
    `;

    this.animateLetters(wordEn, "en");
    this.animateLetters(wordVi, "vi");
  }

  animateLetters(word, lang) {
      const lettersContainer = document.getElementById(`${lang}-letters`);
      const slotsContainer = document.getElementById(`${lang}-slots`);
      if (!lettersContainer || !slotsContainer) return;

      lettersContainer.innerHTML = "";
      slotsContainer.innerHTML = "";

      let cleanLetters = word.split("").filter(c => c !== " ");
      let lockedCharsCount = 0; // Đếm số ký tự đã khóa
      
      // ✅ Nếu là tiếng Việt, tách từ cuối để trộn
      if (lang === "vi") {
          const words = word.trim().split(/\s+/); // Tách thành mảng các từ
          
          if (words.length > 1) {
              // Có từ 2 từ trở lên → Khóa các từ phía trước, chỉ trộn từ cuối
              const lockedPart = words.slice(0, -1).join(" "); // Tất cả từ trừ từ cuối
              const shufflePart = words[words.length - 1];     // Từ cuối cùng
              
              // Tự động thêm phần khóa vào viCompleted
              lockedCharsCount = lockedPart.replace(/\s+/g, "").length;
              if (lang === "vi") {
                  this.viCompleted = lockedPart.replace(/\s+/g, "");
              }
              
              // Hiển thị phần khóa
              lockedPart.split("").forEach(char => {
                  if (char === " ") {
                      // Khoảng trắng
                      const spaceBox = document.createElement("div");
                      spaceBox.className = "space-box h-12";
                      slotsContainer.appendChild(spaceBox);
                  } else {
                      // Chữ cái khóa
                      const fixedLetter = document.createElement("div");
                      fixedLetter.className = `w-12 h-12 text-white rounded-xl border-2 border-white flex items-center justify-center text-2xl font-black bg-green-500`;
                      fixedLetter.innerText = char.toUpperCase();
                      slotsContainer.appendChild(fixedLetter);
                  }
              });
              
              // Thêm khoảng trắng giữa phần khóa và phần trộn
              const spaceBox = document.createElement("div");
              spaceBox.className = "space-box h-12";
              slotsContainer.appendChild(spaceBox);
              
              // Chỉ trộn từ cuối cùng
              cleanLetters = shufflePart.split("").filter(c => c !== " ");
          }
          // Nếu chỉ có 1 từ → Trộn toàn bộ (giữ nguyên logic cũ)
      }

      const shuffled = cleanLetters.map((c, i) => ({ c, i }))
          .sort(() => Math.random() - 0.5);

      shuffled.forEach((item, index) => {
          const btn = document.createElement("div");
          btn.className = `w-12 h-12 bg-white border-2 border-gray-400 rounded-xl shadow-[4px_4px_0px_#ccc] flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-yellow-50 transform transition-all opacity-0 letter-fall`;
          btn.style.animationDelay = `${index * 0.1}s`;
          btn.innerText = item.c.toUpperCase();

          btn.onclick = () => {
              const currentStr = lang === "en" ? this.enCompleted : this.viCompleted;

              // tìm vị trí ký tự tiếp theo trong từ gốc
              let actualIdx = 0, cleanCount = 0;
              while (actualIdx < word.length) {
                  if (word[actualIdx] !== " ") {
                      if (cleanCount === currentStr.length) break;
                      cleanCount++;
                  }
                  actualIdx++;
              }
              const targetChar = word[actualIdx];

              if (item.c.toLowerCase() === targetChar.toLowerCase()) {
                  // CHỈ PHÁT ÂM NẾU LÀ TIẾNG ANH (lang === "en")
                  if (lang === "en") {
                      this.speak(item.c, "en-US", 1.2);
                      this.enCompleted += item.c;
                  } else {
                      // Tiếng Việt chỉ cộng chuỗi, không gọi hàm speak ở đây
                      this.viCompleted += item.c;
                  }

                  const finalLetter = document.createElement("div");
                  finalLetter.className = `w-12 h-12 text-white rounded-xl border-2 border-white flex items-center justify-center text-2xl font-black ${lang === "en" ? "bg-blue-500" : "bg-green-500"}`;
                  finalLetter.innerText = item.c.toUpperCase();
                  slotsContainer.appendChild(finalLetter);

                  // thêm khoảng trắng nếu có
                  let nextIdx = actualIdx + 1;
                  while (nextIdx < word.length && word[nextIdx] === " ") {
                      const spaceBox = document.createElement("div");
                      spaceBox.className = "space-box h-12";
                      slotsContainer.appendChild(spaceBox);
                      nextIdx++;
                  }

                  btn.style.visibility = "hidden";
                  this.checkProgress();
              } else {
                  btn.classList.add("bg-red-100", "border-red-400");
                  setTimeout(() => btn.classList.remove("bg-red-100", "border-red-400"), 500);
                  if (typeof this.onWrong === "function") this.onWrong();
              }
          };

          lettersContainer.appendChild(btn);
      });
  }

  checkProgress() {
      if (!this.currentData) return;
      
      const wordEn = this.currentData.english_word;
      const wordVi = this.currentData.vietnamese_translation;
      const cleanEn = wordEn.replace(/\s+/g, "").toLowerCase();
      const cleanVi = wordVi.replace(/\s+/g, "").toLowerCase();
      
      // ✅ So sánh mảng ký tự đã sắp xếp thay vì chuỗi trực tiếp
      const sortedEnCompleted = this.enCompleted.toLowerCase().split('').sort().join('');
      const sortedViCompleted = this.viCompleted.toLowerCase().split('').sort().join('');
      const sortedCleanEn = cleanEn.split('').sort().join('');
      const sortedCleanVi = cleanVi.split('').sort().join('');
      
      if (sortedEnCompleted === sortedCleanEn && sortedViCompleted === sortedCleanVi) {
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