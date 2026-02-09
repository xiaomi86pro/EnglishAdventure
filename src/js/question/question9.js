// js/question/question9.js
// Question Type 9: Prepositions of Time (in/on/at) - Class Version

class Question9 {
    constructor(opts = {}) {
        // Dữ liệu được inject từ QuestionManager (fallback)
        this.dataPool = opts.dataPool || {};
        this.templates = this.dataPool.question_templates || [];

        this.containerId = opts.containerId || "questionarea";
        this.onCorrect = opts.onCorrect || null;
        this.onWrong = opts.onWrong || null;

        this.autoReload = true;
        this.currentData = null;
        this._destroyed = false;

        this.days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        this.choices = ["in", "on", "at"];
    }

    /**
     * Sinh năm ngẫu nhiên từ 1990 tới năm hiện tại.
     */
    randomYear() {
        const min = 1990;
        const max = new Date().getFullYear();
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sinh thời gian ngẫu nhiên dạng "7 a.m." / "8 p.m.".
     */
    randomClockTime() {
        const hour = Math.floor(Math.random() * 12) + 1; // 1 -> 12
        const meridiem = Math.random() < 0.5 ? "a.m." : "p.m.";
        return `${hour} ${meridiem}`;
    }

    /**
     * Ưu tiên template từ DB (grammar_type = prep_time),
     * nếu chưa có thì fallback về danh sách hard-coded theo yêu cầu.
     */
    getAvailableTemplates() {
        const fixedTemplates = [
            {
                pattern: "I was born ___ {year}.",
                correct: "in",
                viHint: "Tôi được sinh ra vào năm {year}."
            },
            {
                pattern: "We have English ___ {day}.",
                correct: "on",
                viHint: "Chúng tôi có môn tiếng Anh vào {day}."
            },
            {
                pattern: "The class starts ___ {time}.",
                correct: "at",
                viHint: "Lớp học bắt đầu lúc {time}."
            },
            {
                pattern: "I study ___ the morning.",
                correct: "in",
                viHint: "Tôi học vào buổi sáng."
            },
            {
                pattern: "We play football ___ the afternoon.",
                correct: "in",
                viHint: "Chúng tôi chơi bóng đá vào buổi chiều."
            },
            {
                pattern: "She checks her phone ___ the evening.",
                correct: "in",
                viHint: "Cô ấy kiểm tra điện thoại vào buổi tối."
            }
        ];

        // Yêu cầu: đọc template từ GRAMMAR_CACHE.templates và filter grammar_type = prep_time
        // Giữ fallback dataPool.question_templates để an toàn nếu global cache chưa có.
        const cacheTemplates = (window.GRAMMAR_CACHE && Array.isArray(window.GRAMMAR_CACHE.templates))
            ? window.GRAMMAR_CACHE.templates
            : [];

        const sourceTemplates = cacheTemplates.length > 0 ? cacheTemplates : (this.templates || []);

        const dbTemplates = sourceTemplates.filter(t =>
            t.grammar_type === "prep_time" && t.is_active === true
        );

        // Nếu có dữ liệu template hợp lệ trong DB, map về cùng format.
        if (dbTemplates.length > 0) {
            const matchedTemplates = dbTemplates
                .map(t => {
                    const normalizedPattern = String(t.pattern || "").trim();
                    const match = fixedTemplates.find(ft => ft.pattern === normalizedPattern);
                    if (!match) return null;
                    return {
                        pattern: match.pattern,
                        correct: match.correct,
                        viHint: match.viHint
                    };
                })
                .filter(Boolean);

            // Debug log: kiểm tra đang dùng template từ DB
            console.debug("[Question9] Using templates from DB (GRAMMAR_CACHE)", {
                grammarType: "prep_time",
                totalFiltered: dbTemplates.length,
                matchedFixedPatterns: matchedTemplates.length
            });

            if (matchedTemplates.length > 0) {
                return matchedTemplates;
            }
        }

        // Debug log: fallback về hard-coded templates
        console.debug("[Question9] Using hardcoded templates", {
            grammarType: "prep_time",
            reason: "No valid DB template matched fixed patterns"
        });
        return fixedTemplates;
    }

    async load(enemyType = "normal") {
        this._destroyed = false;

        try {
            const templates = this.getAvailableTemplates();
            if (!templates || templates.length === 0) {
                throw new Error("Không có template prep_time hợp lệ.");
            }

            // Chọn 1 template ngẫu nhiên.
            const template = templates[Math.floor(Math.random() * templates.length)];

            // Fill slot động theo pattern tương ứng.
            let sentence = template.pattern;
            let viHint = template.viHint;

            if (sentence.includes("{year}")) {
                const year = this.randomYear();
                sentence = sentence.replace("{year}", year);
                viHint = viHint.replace("{year}", year);
            }

            if (sentence.includes("{day}")) {
                const day = this.days[Math.floor(Math.random() * this.days.length)];
                sentence = sentence.replace("{day}", day);
                viHint = viHint.replace("{day}", day);
            }

            if (sentence.includes("{time}")) {
                const time = this.randomClockTime();
                sentence = sentence.replace("{time}", time);
                viHint = viHint.replace("{time}", time);
            }

            this.currentData = {
                sentence,
                correct: template.correct,
                viHint,
                choices: [...this.choices]
            };

            this.renderQuestionUI();
        } catch (error) {
            console.error("[Question9] Load error:", error);
            this.renderError(error.message);
        }
    }

    renderQuestionUI() {
        const area = document.getElementById(this.containerId);
        if (!area || !this.currentData) return;

        area.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl relative overflow-hidden animate-fadeIn">
            <div class="absolute top-0 left-0 bg-cyan-600 text-white px-4 py-1 rounded-br-2xl text-xs font-bold shadow z-10 uppercase tracking-tighter">
                Type 9: Prepositions of Time (in/on/at)
            </div>

            <div class="p-8 bg-slate-800 rounded-3xl text-center text-white shadow-2xl border border-slate-700 w-full max-w-2xl">
                <div class="text-yellow-300 text-5xl mb-4 font-medium">
                    ${this.escapeHtml(this.currentData.sentence)}
                </div>

                <div class="text-cyan-200 text-2xl mb-10 italic">
                    ${this.escapeHtml(this.currentData.viHint)}
                </div>

                <div id="prep-time-choices" class="flex gap-6 justify-center mb-4"></div>
            </div>
        </div>
        `;

        const container = document.getElementById("prep-time-choices");
        (this.currentData.choices || []).forEach(choice => {
            const btn = document.createElement("button");
            btn.className = "px-10 py-5 bg-white text-slate-800 rounded-2xl font-black text-3xl shadow-md hover:bg-yellow-400 hover:scale-110 transition-all duration-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1";
            btn.innerText = choice;
            btn.onclick = () => this.handleChoice(choice, btn);
            container.appendChild(btn);
        });
    }

    handleChoice(choice, btnEl) {
        if (this._destroyed || !this.currentData) return;

        const selected = String(choice).trim().toLowerCase();
        const correct = String(this.currentData.correct).trim().toLowerCase();

        if (selected === correct) {
            btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
            btnEl.classList.add("bg-green-500", "text-white", "border-green-700");

            if (typeof this.onCorrect === "function") {
                this.onCorrect(1);
            }

            this.speakSentence();
        } else {
            btnEl.classList.remove("bg-white", "text-slate-800", "hover:bg-yellow-400");
            btnEl.classList.add("bg-red-500", "text-white", "border-red-700", "animate-shake");

            if (typeof this.onWrong === "function") {
                this.onWrong();
            }
        }
    }

    /**
     * Đọc câu hoàn chỉnh bằng cách thay ___ bằng đáp án đúng.
     * Ưu tiên dùng helper speak() toàn cục nếu có.
     */
    speakSentence() {
        if (!this.currentData || this._destroyed) return;

        const fullSentence = String(this.currentData.sentence || "").replace("___", this.currentData.correct);

        if (typeof window.speak === "function") {
            window.speak(fullSentence);
            return;
        }

        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (e) { }
            const u = new SpeechSynthesisUtterance(fullSentence);
            u.lang = "en-US";
            u.rate = 0.95;
            window.speechSynthesis.speak(u);
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
            .replace(/\"/g, "&quot;")
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

window.Question9 = Question9;
export default Question9;
