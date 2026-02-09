// js/question/question9.js
// Question Type 9: Prepositions of Time (in/on/at) - Class Version

class Question9 {
    constructor(opts = {}) {
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
        const meridiem = Math.random() < 0.5 ? "a.m" : "p.m";
        return `${hour} ${meridiem}`;
    }

    pickRandom(list = []) {
        if (!Array.isArray(list) || list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    getWord(item) {
        if (!item) return "";
        return String(item.word || item.base || item.name || "").trim();
    }

    resolveCorrectAnswer(template) {
        const explicit = String(template.correct_answer || template.correct || "").trim().toLowerCase();
        if (["in", "on", "at"].includes(explicit)) return explicit;

        const answerType = String(template.answer_type || "").trim().toLowerCase();
        if (!answerType) return "";
        if (answerType.includes("prep_time_in") || answerType.includes("prep_in") || answerType.endsWith("_in") || answerType === "in") return "in";
        if (answerType.includes("prep_time_on") || answerType.includes("prep_on") || answerType.endsWith("_on") || answerType === "on") return "on";
        if (answerType.includes("prep_time_at") || answerType.includes("prep_at") || answerType.endsWith("_at") || answerType === "at") return "at";

        return "";
    }

    buildBindings(template) {
        const activeNouns = this.nouns.filter(n => n?.is_active !== false);
        const activeAdjectives = this.adjectives.filter(a => a?.is_active !== false);

        const nounFromTemplate = this.getWord(template.noun || template.noun_word || template.noun_value);
        const adjFromTemplate = this.getWord(template.adj || template.adjective || template.adjective_word || template.adj_value);

        return {
            year: this.randomYear(),
            day: this.pickRandom(this.days) || "Monday",
            time: this.randomClockTime(),
            noun: nounFromTemplate || this.getWord(this.pickRandom(activeNouns)) || "book",
            adj: adjFromTemplate || this.getWord(this.pickRandom(activeAdjectives)) || "nice"
        };
    }

    fillDynamicSlots(text, bindings) {
        return String(text || "").replace(/\{(\w+)\}/g, (_, key) => {
            if (bindings[key] === undefined || bindings[key] === null || bindings[key] === "") {
                return `{${key}}`;
            }
            return String(bindings[key]);
        });
    }

    /**
      * Luồng chính: template từ dataPool (DB thật).
     * Fallback legacy: GRAMMAR_CACHE nếu cần giữ tương thích cũ.
     */
    getAvailableTemplates() {
        
        const fromDataPool = (this.templates || []).filter(t =>
            t.grammar_type === "prep_time" && t.is_active === true
        );

        if (fromDataPool.length > 0) {
            console.debug("[Question9] Using templates from dataPool", {
                grammarType: "prep_time",
                count: fromDataPool.length
            });
            return fromDataPool;
        }

        const cacheTemplates = (window.GRAMMAR_CACHE && Array.isArray(window.GRAMMAR_CACHE.templates))
            ? window.GRAMMAR_CACHE.templates
            : [];

        const legacyTemplates = cacheTemplates.filter(t =>
            t.grammar_type === "prep_time" && t.is_active === true
        );

        if (legacyTemplates.length > 0) {
            console.debug("[Question9] Using templates from legacy GRAMMAR_CACHE", {
                grammarType: "prep_time",
                count: legacyTemplates.length
            });

            return legacyTemplates;
            
        }

        console.debug("[Question9] No prep_time template found", {
            grammarType: "prep_time",
            reason: "dataPool and GRAMMAR_CACHE are empty"
        });
        return [];
    }

    async load(enemyType = "normal") {
        this._destroyed = false;

        try {
            const templates = this.getAvailableTemplates();
            if (!templates || templates.length === 0) {
                throw new Error("Không có template prep_time hợp lệ.");
            }

            /// Chọn 1 template ngẫu nhiên từ DB.
            const template = this.pickRandom(templates);

            const correct = this.resolveCorrectAnswer(template);
            if (!correct) {
                throw new Error("Template prep_time thiếu answer_type/correct_answer hợp lệ (in/on/at).");
            }

            // Pattern tự do từ DB: hỗ trợ slot động như {year}, {day}, {time}, {noun}, {adj}, ...
            const bindings = this.buildBindings(template);

            let sentence = this.fillDynamicSlots(template.pattern || "", bindings);
            let viHint = this.fillDynamicSlots(template.vi_hint || template.viHint || "", bindings);

            if (!sentence || sentence.trim() === "") {
                throw new Error("Template prep_time thiếu pattern.");
            }

            if (!viHint || viHint.trim() === "") {
                viHint = "Chọn giới từ thời gian phù hợp.";
            }

            this.currentData = {
                sentence,
                correct,
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
