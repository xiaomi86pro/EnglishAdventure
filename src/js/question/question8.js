// src/js/question/question8.js
// Question Type 8 - Articles (a/an/the/blank)
// Template-driven, tận dụng verbs, nouns, adjectives, templates, subjects

class Question8 {
  constructor(opts = {}) {
      this.containerId = opts.containerId || 'questionarea';
      this.onCorrect = opts.onCorrect || null;
      this.onWrong = opts.onWrong || null;
      this.supabase = window.supabase;

      this.currentData = null;
      this._answered = false;
      this._destroyed = false;
      this._lastAnswered = null;
  }

  async init(enemyType = "normal") {
      this._destroyed = false;
      this._answered = false;

      try {
          await this.generateQuestion(enemyType);

          if (this.currentData) {
              this.renderQuestionUI();
          } else {
              console.error('[Question8] Failed to generate question');
              setTimeout(() => {
                  if (typeof this.onWrong === 'function') this.onWrong();
              }, 500);
          }
      } catch (err) {
          console.error('[Question8] init error:', err);
      }
  }

  /* -------------------------
     Template + constraint helpers
     ------------------------- */
  async selectTemplate() {
      const { data: templates, error } = await this.supabase
          .from('templates')
          .select('*')
          .eq('grammar_focus', 'articles')
          .eq('difficulty', 'A1');

      if (error || !templates || templates.length === 0) return null;

      const totalWeight = templates.reduce((sum, t) => sum + (t.usage_weight || 1), 0);
      let random = Math.random() * totalWeight;
      for (const template of templates) {
          random -= (template.usage_weight || 1);
          if (random <= 0) return template;
      }
      return templates[0];
  }

  parseConstraints(template) {
      const constraints = template?.constraints || {};
      return {
          verb_transitivity: constraints.verb_transitivity || null, // 'transitive'|'intransitive'|null
          noun_countable: constraints.noun_countable !== false, // default true
          noun_type: constraints.noun_type || null, // e.g., 'proper'
          requires_adjective: !!template?.requires_adjective,
          requires_place: !!template?.requires_place,
          requires_color: !!template?.requires_color
      };
  }

  /* -------------------------
     Selection helpers
     ------------------------- */
  async selectVerb(constraints) {
      let query = this.supabase
          .from('verbs')
          .select('*')
          .not('compatible_objects', 'is', null)
          .eq('difficulty', 'A1');

      if (constraints.verb_transitivity) {
          query = query.eq('transitivity', constraints.verb_transitivity);
      }

      const { data: verbs, error } = await query;
      if (error || !verbs || verbs.length === 0) return null;

      // Try up to 6 candidates to find one with compatible nouns
      for (let i = 0; i < 6; i++) {
          const candidate = verbs[Math.floor(Math.random() * verbs.length)];
          try {
              const categories = JSON.parse(candidate.compatible_objects || '[]');
              if (!categories || categories.length === 0) continue;

              const { data: testNouns } = await this.supabase
                  .from('nouns')
                  .select('id')
                  .in('semantic_category', categories)
                  .eq('difficulty', 'A1')
                  .limit(1);

              if (testNouns && testNouns.length > 0) {
                  return candidate;
              }
          } catch (e) {
              // invalid JSON, skip
              continue;
          }
      }
      return null;
  }

  async selectNoun(verb, template, constraints) {
      if (!verb) return null;

      let categories = [];
      try {
          categories = JSON.parse(verb.compatible_objects || '[]');
      } catch (e) {
          categories = [];
      }
      if (!categories || categories.length === 0) return null;

      // Preference from template (to bias 'an' answers)
      const preference = template?.answer_preference || {};
      const boostVowel = (preference.an || 0) > 0.25;

      // Try vowel-first if boosted
      if (boostVowel && Math.random() < 0.6) {
          const { data: vowelNouns } = await this.supabase
              .from('nouns')
              .select('*')
              .in('semantic_category', categories)
              .eq('countable', constraints.noun_countable)
              .eq('starts_with_vowel', true)
              .eq('difficulty', 'A1');

          if (vowelNouns && vowelNouns.length > 0) {
              return vowelNouns[Math.floor(Math.random() * vowelNouns.length)];
          }
      }

      // Fallback: any compatible noun respecting countable/type/difficulty
      let query = this.supabase
          .from('nouns')
          .select('*')
          .in('semantic_category', categories)
          .eq('difficulty', 'A1');

      if (constraints.noun_countable !== undefined) {
          query = query.eq('countable', constraints.noun_countable);
      }
      if (constraints.noun_type) {
          query = query.eq('type', constraints.noun_type);
      }

      const { data: nouns } = await query;
      if (!nouns || nouns.length === 0) return null;

      return nouns[Math.floor(Math.random() * nouns.length)];
  }

  async selectAdjective(template, noun) {
      if (!template?.requires_adjective && !template?.requires_color) return null;

      let query = this.supabase
          .from('adjectives')
          .select('*')
          .eq('difficulty', 'A1');

      if (template.requires_color) query = query.eq('type', 'color');

      const { data: adjectives } = await query;
      if (!adjectives || adjectives.length === 0) return null;

      // If template prefers 'an', try to pick adjective starting with vowel
      const preference = template?.answer_preference || {};
      if ((preference.an || 0) > 0.3 && Math.random() < 0.6) {
          const vowelAdjs = adjectives.filter(a => a.starts_with_vowel);
          if (vowelAdjs.length > 0) return vowelAdjs[Math.floor(Math.random() * vowelAdjs.length)];
      }

      return adjectives[Math.floor(Math.random() * adjectives.length)];
  }

  async selectPlace(template) {
      if (!template?.requires_place) return null;
      const { data: places } = await this.supabase
          .from('places')
          .select('*')
          .eq('difficulty', 'A1');

      if (!places || places.length === 0) return null;
      // place should provide phrase and correct_preposition fields
      return places[Math.floor(Math.random() * places.length)];
  }

  async selectSubject() {
      const { data: subjects } = await this.supabase
          .from('subjects')
          .select('*')
          .eq('difficulty', 'A1');

      if (!subjects || subjects.length === 0) return null;
      return subjects[Math.floor(Math.random() * subjects.length)];
  }

  /* -------------------------
     Article calculation & sentence build
     ------------------------- */
  calculateCorrectAnswer(template, noun, adjective) {
      // Determiner decision uses adjective if present, else noun
      const determiner = adjective || noun;
      if (!determiner) return 'blank';

      // If noun is proper -> blank
      if (noun?.type === 'proper') return 'blank';

      // If noun is uncountable -> prefer 'the' (specific) or 'blank' depending on template preference
      if (noun && !noun.countable) {
          // If template explicitly prefers 'blank' for uncountable, handle here (default: 'the')
          return template?.uncountable_prefer_blank ? 'blank' : 'the';
      }

      // If noun is countable singular -> must be a/an/the (not blank)
      // Use template preference weights if provided
      const pref = template?.answer_preference || { a: 0.4, an: 0.3, the: 0.3 };
      const total = (pref.a || 0) + (pref.an || 0) + (pref.the || 0);
      const normalized = {
          a: (pref.a || 0) / (total || 1),
          an: (pref.an || 0) / (total || 1),
          the: (pref.the || 0) / (total || 1)
      };

      const r = Math.random();
      if (r < normalized.an) return determiner.starts_with_vowel ? 'an' : 'a';
      if (r < normalized.an + normalized.the) return 'the';
      return determiner.starts_with_vowel ? 'an' : 'a';
  }

  buildSentence(template, data) {
      // template.pattern example: "{subject} {verb} {article} {adjective} {noun}."
      let sentence = template.pattern || '{subject} {verb} {article} {adjective} {noun}.';

      sentence = sentence.replace('{subject}', data.subject.word);
      sentence = sentence.replace('{verb}', data.conjugatedVerb);
      sentence = sentence.replace('{article}', '_____');

      if (data.adjective) {
          sentence = sentence.replace('{adjective}', data.adjective.word);
          sentence = sentence.replace('{color}', data.adjective.word);
      } else {
          sentence = sentence.replace('{adjective}', '');
          sentence = sentence.replace('{color}', '');
      }

      sentence = sentence.replace('{noun}', data.noun.word);

      if (data.place) {
          sentence = sentence.replace('{place}', data.place.phrase || '');
          sentence = sentence.replace('{preposition}', data.place.correct_preposition || '');
      }

      if (data.possessor) {
          sentence = sentence.replace('{possessor}', data.possessor);
      }

      // Clean multiple spaces
      sentence = sentence.replace(/\s+/g, ' ').trim();
      return sentence;
  }

  generateExplanation(correctAnswer, noun, adjective) {
      const word = adjective ? adjective.word : noun.word;
      const startsWithVowel = (adjective ? adjective.starts_with_vowel : noun.starts_with_vowel) || false;

      if (correctAnswer === 'an') {
          return `Use "an" before words starting with vowel sounds. "${word}" starts with "${word[0]}".`;
      } else if (correctAnswer === 'a') {
          return `Use "a" before words starting with consonant sounds. "${word}" starts with "${word[0]}".`;
      } else if (correctAnswer === 'the') {
          return `Use "the" when referring to a specific or known ${noun.word}.`;
      } else {
          return `No article is needed in this context.`;
      }
  }

  /* -------------------------
     Main generator
     ------------------------- */
  async generateQuestion(enemyType = "normal") {
      try {
          const template = await this.selectTemplate();
          if (!template) {
              console.error('[Question8] No template');
              return;
          }

          const constraints = this.parseConstraints(template);
          const verb = await this.selectVerb(constraints);
          if (!verb) {
              console.error('[Question8] No verb');
              return;
          }

          const noun = await this.selectNoun(verb, template, constraints);
          if (!noun && verb.transitivity === 'transitive') {
              console.error('[Question8] No noun for transitive verb');
              return;
          }

          const adjective = await this.selectAdjective(template, noun);
          const place = await this.selectPlace(template);
          const subject = await this.selectSubject();
          if (!subject) {
              console.error('[Question8] No subject');
              return;
          }

          // Conjugate verb
          const conjugatedVerb = subject.requires_verb_s ? (verb.third_person || verb.base_form) : verb.base_form;

          // Calculate correct answer (ensures countable singular never blank)
          const correctAnswer = this.calculateCorrectAnswer(template, noun, adjective);

          // Build article word for full sentence (for explanation)
          let articleWord = '';
          if (correctAnswer === 'a' || correctAnswer === 'an') {
              articleWord = (correctAnswer === 'an' ? 'an ' : 'a ') + (adjective ? `${adjective.word} ${noun.word}` : noun.word);
          } else if (correctAnswer === 'the') {
              articleWord = 'the ' + (adjective ? `${adjective.word} ${noun.word}` : noun.word);
          } else {
              // blank
              articleWord = (adjective ? `${adjective.word} ${noun.word}` : noun.word);
          }

          const sentence = this.buildSentence(template, { subject, conjugatedVerb, noun, adjective, place });
          const fullSentence = `${subject.word} ${conjugatedVerb} ${articleWord}.`.replace(/\s+/g, ' ').trim();

          const explanation = this.generateExplanation(correctAnswer, noun, adjective);

          this.currentData = {
              sentence,
              correctAnswer,
              explanation,
              subject: subject.word,
              verb: verb.base_form,
              noun: noun ? noun.word : null,
              adjective: adjective ? adjective.word : null,
              place: place ? place.phrase : null,
              fullSentence
          };

          console.log('[Question8] Generated:', this.currentData);
      } catch (err) {
          console.error('[Question8] generateQuestion error:', err);
      }
  }

  /* -------------------------
     UI + interaction (kept similar to original)
     ------------------------- */
  renderQuestionUI() {
      const area = document.getElementById(this.containerId);
      if (!area || !this.currentData) return;

      const parts = this.currentData.sentence.split('_____');

      area.innerHTML = `
          <div class="w-full h-full flex flex-col items-center justify-between relative animate-fade-in p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl">
              <div class="absolute top-0 left-0 bg-purple-600 text-white px-4 py-2 rounded-br-2xl text-sm font-bold shadow-lg">
                  Question Type 8: Articles (a/an/the)
              </div>

              <div class="text-center mt-12 mb-6">
                  <p class="text-gray-600 text-lg font-semibold mb-2">Choose the correct article:</p>
              </div>

              <div class="flex-1 flex items-center justify-center w-full max-w-3xl">
                  <div class="text-center bg-white/90 p-8 rounded-3xl border-4 border-blue-200 shadow-xl w-full">
                      <p class="text-4xl md:text-5xl font-bold text-gray-800 leading-relaxed">
                          ${parts[0] || ''}
                          <span class="inline-block min-w-[120px] h-16 border-b-4 border-dashed border-red-500 animate-pulse mx-2"></span>
                          ${parts[1] || ''}
                      </p>
                  </div>
              </div>

              <div class="w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <button data-answer="a" class="answer-btn px-8 py-6 bg-gradient-to-br from-blue-400 to-blue-500 text-white rounded-2xl font-black text-3xl">a</button>
                  <button data-answer="an" class="answer-btn px-8 py-6 bg-gradient-to-br from-green-400 to-green-500 text-white rounded-2xl font-black text-3xl">an</button>
                  <button data-answer="the" class="answer-btn px-8 py-6 bg-gradient-to-br from-purple-400 to-purple-500 text-white rounded-2xl font-black text-3xl">the</button>
                  <button data-answer="blank" class="answer-btn px-8 py-6 bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-2xl font-black text-2xl">(no article)</button>
              </div>

              <div id="explanation-box" class="hidden w-full max-w-2xl bg-blue-50 border-2 border-blue-300 rounded-2xl p-6 mb-4">
                  <p class="text-blue-800 text-lg font-semibold text-center"></p>
              </div>
          </div>
      `;

      const buttons = area.querySelectorAll('.answer-btn');
      buttons.forEach(btn => btn.onclick = () => this.checkAnswer(btn.dataset.answer));
  }

  checkAnswer(userAnswer) {
      if (this._answered || !this.currentData) return;

      const buttons = document.querySelectorAll('.answer-btn');
      buttons.forEach(btn => btn.disabled = true);

      const isCorrect = userAnswer === this.currentData.correctAnswer;

      if (isCorrect) {
          this._answered = true;
          const correctBtn = document.querySelector(`[data-answer="${userAnswer}"]`);
          if (correctBtn) {
              correctBtn.classList.add('from-green-500', 'to-green-600', 'scale-110', 'ring-4', 'ring-green-300');
          }

          const explanationBox = document.getElementById('explanation-box');
          if (explanationBox) {
              explanationBox.classList.remove('hidden');
              explanationBox.querySelector('p').innerHTML = `
                  ✅ <strong>Correct!</strong><br>
                  ${this.currentData.explanation}<br>
                  <em class="text-green-700 font-bold mt-2 block">"${this.currentData.fullSentence}"</em>
              `;
          }

          this.speak(this.currentData.fullSentence);

          this._lastAnswered = {
              en: this.currentData.fullSentence,
              vi: `Dùng "${this.currentData.correctAnswer}" trước "${this.currentData.noun}"`
          };

          setTimeout(() => {
              if (!this._destroyed && typeof this.onCorrect === 'function') {
                  this.onCorrect(1, true);
              }
          }, 2000);
      } else {
          const wrongBtn = document.querySelector(`[data-answer="${userAnswer}"]`);
          if (wrongBtn) {
              wrongBtn.classList.add('bg-red-500', 'animate-shake');
              setTimeout(() => {
                  wrongBtn.classList.remove('bg-red-500', 'animate-shake');
                  buttons.forEach(btn => btn.disabled = false);
              }, 600);
          }
          if (typeof this.onWrong === 'function') this.onWrong();
      }
  }

  speak(text, lang = "en-US") {
      if (!text || !window.speechSynthesis || this._destroyed) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.85;
      const voices = speechSynthesis.getVoices();
      const targetVoice = voices.find(v => v.lang.includes(lang.split('-')[0]));
      if (targetVoice) utterance.voice = targetVoice;
      speechSynthesis.speak(utterance);
  }

  destroy() {
      this._destroyed = true;
      if (window.speechSynthesis) speechSynthesis.cancel();
      const area = document.getElementById(this.containerId);
      if (area) area.innerHTML = "";
      this.currentData = null;
      this._lastAnswered = null;
  }
}

export default Question8;