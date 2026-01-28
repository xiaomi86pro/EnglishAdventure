import * as XLSX from 'xlsx';

export class QuizGrammarManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.initEventListeners();
    }

    initEventListeners() {
        // Nouns
        document.getElementById('nouns-upload-btn')?.addEventListener('click', () => this.uploadNouns());
        
        // Verbs
        document.getElementById('verbs-upload-btn')?.addEventListener('click', () => this.uploadVerbs());
        
        //Adjectives
        document.getElementById('adjectives-upload-btn')?.addEventListener('click', () => this.uploadAdjectives());

        //Prepositions
        document.getElementById('prepositions-upload-btn')?.addEventListener('click', () => this.uploadPrepositions());

        // Templates
        document.getElementById('add-template-btn')?.addEventListener('click', () => this.addTemplate());
        
        // Compatibility
        document.getElementById('compat-upload-btn')?.addEventListener('click', () => this.uploadCompatibility());
        document.getElementById('add-compat-btn')?.addEventListener('click', () => this.addCompatibilityQuick());
    }

    // ==================== NOUNS ====================
    async uploadNouns() {
        const fileInput = document.getElementById('nouns-excel-file');
        const file = fileInput.files[0];
        if (!file) {
            this.setStatus('nouns-status', '❌ Chưa chọn file!');
            return;
        }
    
        try {
            this.setStatus('nouns-status', '⏳ Đang xử lý...');
    
            const rows = await this.readExcel(file);
    
            // Chuyển đổi dữ liệu từ Excel
            const nouns = rows.map(row => ({
                word: row.word,
                type: row.type,
                countable: row.countable === true || row.countable === 'TRUE' || row.countable === 1,
                plural_form: row.plural_form || null,
                starts_with_vowel: row.starts_with_vowel === true || row.starts_with_vowel === 'TRUE' || row.starts_with_vowel === 1,
                difficulty: row.difficulty || 'A1',
                semantic_category: row.semantic_category || null
            }));
    
            // ✅ UPSERT theo word
            const { data, error } = await this.supabase
                .from('nouns')
                .upsert(nouns, { 
                    onConflict: 'word',       // kiểm tra trùng theo word
                    ignoreDuplicates: false   // update nếu trùng, insert nếu chưa
                })
                .select();
    
            if (error) throw error;
    
            this.setStatus('nouns-status', `✅ Đã upload/update ${nouns.length} nouns thành công!`);
            this.loadNouns(); // Refresh table
    
        } catch (err) {
            console.error(err);
            this.setStatus('nouns-status', '❌ Lỗi: ' + err.message);
        }
    }

    async loadNouns() {
        const { data, error } = await this.supabase
            .from('nouns')
            .select('*')
            .order('word');

        if (error) {
            console.error(error);
            return;
        }

        const tbody = document.getElementById('nouns-tbody');
        tbody.innerHTML = data.map(noun => `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-bold">${noun.word}</td>
                <td class="p-3">${noun.type}</td>
                <td class="p-3">${noun.countable ? '✅' : '❌'}</td>
                <td class="p-3">${noun.plural_form || '-'}</td>
                <td class="p-3">${noun.starts_with_vowel ? '✅' : '❌'}</td>
                <td class="p-3"><span class="px-2 py-1 bg-blue-100 rounded">${noun.difficulty}</span></td>
                <td class="p-3">
                    <button onclick="deleteNoun(${noun.id})" class="text-red-500 hover:text-red-700">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // ==================== VERBS ====================
    async uploadVerbs() {
        const fileInput = document.getElementById('verbs-excel-file');
        const file = fileInput.files[0];
        if (!file) {
            this.setStatus('verbs-status', '❌ Chưa chọn file!');
            return;
        }
    
        // ✅ DANH SÁCH VERB CATEGORIES HỢP LỆ
        const allowedVerbCategories = [
            'eating_action', 'learning_action', 'movement_action', 'daily_action',
            'communication_action', 'perception_action',
            'thinking_action', 'emotion_action',
            'creation_action', 'destruction_action', 'possession_action', 'placement_action',
            'change_action', 'helping_action', 'play_action'
        ];
    
        // ✅ DANH SÁCH NOUN CATEGORIES HỢP LỆ (cho compatible_objects)
        const allowedNounCategories = [
            'food', 'drink', 'fruit', 'vegetable', 'snack',
            'person', 'animal_pet', 'animal_wild', 'animal_farm', 'insect', 'bird',
            'place_education', 'place_public', 'place_home', 'place_outdoor', 'place_transport', 'place_work',
            'educational_item', 'furniture', 'clothing', 'vehicle', 'tool', 'toy', 'electronic', 'container', 'appliance',
            'nature_plant', 'nature_element', 'nature_landscape',
            'body_part', 'health_item',
            'time_unit', 'abstract_concept', 'emotion',
            'sport', 'music', 'entertainment', 'hobby',
            'color', 'shape', 'material', 'weather', 'number', 'language', 'country'
        ];
    
        try {
            this.setStatus('verbs-status', '⏳ Đang xử lý...');
            
            const rows = await this.readExcel(file);
            
            // ✅ VALIDATE verb_category
            const invalidVerbCats = rows.filter(row => 
                row.verb_category && !allowedVerbCategories.includes(row.verb_category)
            );
            
            if (invalidVerbCats.length > 0) {
                const cats = [...new Set(invalidVerbCats.map(r => r.verb_category))];
                this.setStatus('verbs-status', 
                    `❌ Có ${invalidVerbCats.length} verbs có verb_category không hợp lệ: ${cats.join(', ')}`
                );
                return;
            }
            
            // ✅ VALIDATE compatible_objects
            for (const row of rows) {
                if (row.compatible_objects) {
                    let objects;
                    
                    // Parse JSON (có thể là string hoặc array)
                    if (typeof row.compatible_objects === 'string') {
                        try {
                            objects = JSON.parse(row.compatible_objects);
                        } catch (e) {
                            this.setStatus('verbs-status', 
                                `❌ Verb "${row.base_form}" có compatible_objects không phải JSON hợp lệ`
                            );
                            return;
                        }
                    } else {
                        objects = row.compatible_objects;
                    }
                    
                    // Check từng category trong array
                    const invalidObjs = objects.filter(obj => !allowedNounCategories.includes(obj));
                    if (invalidObjs.length > 0) {
                        this.setStatus('verbs-status', 
                            `❌ Verb "${row.base_form}" có compatible_objects không hợp lệ: ${invalidObjs.join(', ')}`
                        );
                        return;
                    }
                }
            }
            
            // ✅ Convert Excel data
            const verbs = rows.map(row => {
                const verb = {
                    base_form: row.base_form,
                    third_person: row.third_person,
                    past_simple: row.past_simple,
                    past_participle: row.past_participle,
                    gerund: row.gerund,
                    is_regular: row.is_regular === true || row.is_regular === 'TRUE' || row.is_regular === 1,
                    is_stative: row.is_stative === true || row.is_stative === 'TRUE' || row.is_stative === 1,
                    transitivity: row.transitivity || 'transitive',
                    common_preposition: row.common_preposition || null,
                    difficulty: row.difficulty || 'A1',
                    verb_category: row.verb_category || null,
                    compatible_objects: null
                };
                
                // Parse compatible_objects
                if (row.compatible_objects) {
                    if (typeof row.compatible_objects === 'string') {
                        verb.compatible_objects = row.compatible_objects; // Đã là JSON string
                    } else if (Array.isArray(row.compatible_objects)) {
                        verb.compatible_objects = JSON.stringify(row.compatible_objects);
                    }
                }
                
                if (row.id) {
                    verb.id = parseInt(row.id);
                }
                
                return verb;
            });
    
            console.log('📊 Sample verb:', verbs[0]);
    
            // ✅ UPSERT
            const { data, error } = await this.supabase
            .from('verbs')
            .upsert(verbs, { 
                onConflict: 'base_form',   // kiểm tra trùng theo base_form
                ignoreDuplicates: false    // update nếu trùng, insert nếu chưa
            })
            .select();

            
            if (error) throw error;
            
            this.setStatus('verbs-status', `✅ Đã upload/update ${data?.length || verbs.length} verbs!`);
            this.loadVerbs();
            
        } catch (err) {
            console.error('❌ Error:', err);
            this.setStatus('verbs-status', '❌ Lỗi: ' + err.message);
        }
    }

    async loadVerbs() {
        const { data, error } = await this.supabase
            .from('verbs')
            .select('*')
            .order('base_form');

        if (error) return;

        const tbody = document.getElementById('verbs-tbody');
        tbody.innerHTML = data.map(v => `
            <tr class="border-b hover:bg-gray-50 text-xs">
                <td class="p-2 font-bold">${v.base_form}</td>
                <td class="p-2">${v.third_person}</td>
                <td class="p-2">${v.past_simple}</td>
                <td class="p-2">${v.past_participle}</td>
                <td class="p-2">${v.gerund}</td>
                <td class="p-2">${v.is_regular ? '✅' : '❌'}</td>
                <td class="p-2">${v.is_stative ? '⚠️' : '-'}</td>
                <td class="p-2"><span class="px-2 py-1 bg-green-100 rounded">${v.difficulty}</span></td>
                <td class="p-2">
                    <button onclick="deleteVerb(${v.id})" class="text-red-500">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // ==================== ADJECTIVES ====================
    async uploadAdjectives() {
        const fileInput = document.getElementById('adjectives-excel-file');
        const file = fileInput.files[0];
        if (!file) {
            this.setStatus('adjectives-status', '❌ Chưa chọn file!');
            return;
        }
    
        try {
            this.setStatus('adjectives-status', '⏳ Đang xử lý...');
    
            const rows = await this.readExcel(file);
    
            // Convert Excel data
            const adjectives = rows
                .filter(row => row.word) // bỏ dòng trống
                .map(row => ({
                    word: row.word,
                    type: row.type, // size, color, emotion, quality, age
                    difficulty: row.difficulty || 'A1'
                }));
    
            // ✅ UPSERT theo word
            const { data, error } = await this.supabase
                .from('adjectives')
                .upsert(adjectives, { 
                    onConflict: 'word',       // kiểm tra trùng theo word
                    ignoreDuplicates: false   // update nếu trùng, insert nếu chưa
                })
                .select();
    
            if (error) throw error;
    
            this.setStatus('adjectives-status', `✅ Đã upload/update ${data.length} adjectives thành công!`);
            this.loadAdjectives(); // Refresh table
    
        } catch (err) {
            console.error(err);
            this.setStatus('adjectives-status', '❌ Lỗi: ' + err.message);
        }
    }

    async loadAdjectives() {
        const { data, error } = await this.supabase
            .from('adjectives')
            .select('*')
            .order('word');

        if (error) {
            console.error(error);
            return;
        }

        const tbody = document.getElementById('adjectives-tbody');
        tbody.innerHTML = data.map(adj => `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-bold">${adj.word}</td>
                <td class="p-3">
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${this.getTypeColor(adj.type)}">
                        ${adj.type}
                    </span>
                </td>
                <td class="p-3">
                    <span class="px-2 py-1 bg-pink-100 rounded">${adj.difficulty}</span>
                </td>
                <td class="p-3">
                    <button onclick="deleteAdjective(${adj.id})" class="text-red-500 hover:text-red-700">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // Helper function cho màu type
    getTypeColor(type) {
        const colors = {
            'size': 'bg-blue-100 text-blue-700',
            'color': 'bg-red-100 text-red-700',
            'emotion': 'bg-yellow-100 text-yellow-700',
            'quality': 'bg-green-100 text-green-700',
            'age': 'bg-purple-100 text-purple-700',
            'shape': 'bg-orange-100 text-orange-700',
            'condition': 'bg-gray-100 text-gray-700'
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    }

    // ==================== PREPOSITIONS ====================
    async uploadPrepositions() {
        const fileInput = document.getElementById('prepositions-excel-file');
        const file = fileInput.files[0];
        if (!file) {
            this.setStatus('prepositions-status', '❌ Chưa chọn file!');
            return;
        }

        try {
            const rows = await this.readExcel(file);
            
            // Convert Excel data
            const prepositions = rows.map(row => ({
                word: row.word,
                usage_type: row.usage_type, // time, place, both
                difficulty: row.difficulty || 'A1'
            }));

            const { error } = await this.supabase.from('prepositions').insert(prepositions);
            
            if (error) throw error;
            
            this.setStatus('prepositions-status', `✅ Đã upload ${prepositions.length} prepositions!`);
            this.loadPrepositions(); // Refresh table
            
        } catch (err) {
            console.error(err);
            this.setStatus('prepositions-status', '❌ Lỗi: ' + err.message);
        }
    }

    async loadPrepositions() {
        const filterType = document.getElementById('filter-prep-type')?.value;
        
        let query = this.supabase
            .from('prepositions')
            .select('*');
        
        if (filterType) {
            query = query.eq('usage_type', filterType);
        }
        
        const { data, error } = await query.order('word');

        if (error) {
            console.error(error);
            return;
        }

        const tbody = document.getElementById('prepositions-tbody');
        tbody.innerHTML = data.map(prep => `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-bold text-lg">${prep.word}</td>
                <td class="p-3">
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${this.getUsageTypeColor(prep.usage_type)}">
                        ${prep.usage_type}
                    </span>
                </td>
                <td class="p-3">
                    <span class="px-2 py-1 bg-orange-100 rounded">${prep.difficulty}</span>
                </td>
                <td class="p-3">
                    <button onclick="deletePreposition(${prep.id})" class="text-red-500 hover:text-red-700">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // Helper function cho màu usage_type
    getUsageTypeColor(type) {
        const colors = {
            'time': 'bg-blue-100 text-blue-700',
            'place': 'bg-green-100 text-green-700',
            'both': 'bg-purple-100 text-purple-700'
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    }

    // ==================== TEMPLATES ====================
    async addTemplate() {
        const pattern = document.getElementById('template-pattern').value;
        const blank = document.getElementById('template-blank').value;
        const focus = document.getElementById('template-focus').value;
        const example = document.getElementById('template-example').value;

        if (!pattern || !blank || !focus) {
            this.setStatus('template-status', '❌ Vui lòng điền đầy đủ!');
            return;
        }

        const { error } = await this.supabase.from('templates').insert({
            pattern,
            blank_position: blank,
            grammar_focus: focus,
            example,
            difficulty: 'A1'
        });

        if (error) {
            this.setStatus('template-status', '❌ Lỗi: ' + error.message);
        } else {
            this.setStatus('template-status', '✅ Đã thêm template!');
            this.loadTemplates();
            // Clear form
            document.getElementById('template-pattern').value = '';
            document.getElementById('template-example').value = '';
        }
    }

    async loadTemplates() {
        const { data } = await this.supabase.from('templates').select('*').order('id');
        const list = document.getElementById('templates-list');
        
        list.innerHTML = data.map(t => `
            <div class="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100">
                <div class="font-mono text-sm text-blue-600">${t.pattern}</div>
                <div class="text-xs text-gray-500 mt-1">
                    Blank: <b>${t.blank_position}</b> | Focus: <b>${t.grammar_focus}</b>
                </div>
                <div class="text-xs mt-2 italic">Example: ${t.example || '-'}</div>
            </div>
        `).join('');
    }

    
    // ==================== COMPATIBILITY ====================
    async loadCompatibility() {
        const { data, error } = await this.supabase
            .from('compatibility')
            .select('*')
            .order('id', { ascending: false })
            .limit(100); // Limit để tránh load quá nhiều

        if (error) {
            console.error(error);
            this.setStatus('compat-status', '❌ Lỗi load data');
            return;
        }

        // Render table
        const container = document.getElementById('compatibility-list');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-gray-400 italic text-center py-8">Chưa có compatibility rules nào</p>';
            return;
        }

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-2 text-left">Type</th>
                            <th class="p-2 text-left">Word 1</th>
                            <th class="p-2 text-left">Table 1</th>
                            <th class="p-2 text-left">Word 2</th>
                            <th class="p-2 text-left">Table 2</th>
                            <th class="p-2 text-left">Score</th>
                            <th class="p-2 text-left">Note</th>
                            <th class="p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(c => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-2">
                                    <span class="px-2 py-1 rounded text-xs font-bold ${this.getCompatTypeColor(c.compatibility_type)}">
                                        ${c.compatibility_type}
                                    </span>
                                </td>
                                <td class="p-2 font-bold">${c.word1_id}</td>
                                <td class="p-2 text-xs text-gray-500">${c.word1_table}</td>
                                <td class="p-2 font-bold">${c.word2_id}</td>
                                <td class="p-2 text-xs text-gray-500">${c.word2_table}</td>
                                <td class="p-2">
                                    <span class="px-2 py-1 rounded ${this.getScoreColor(c.score)}">
                                        ${c.score}
                                    </span>
                                </td>
                                <td class="p-2 text-xs italic">${c.note || '-'}</td>
                                <td class="p-2">
                                    <button onclick="deleteCompatibility(${c.id})" 
                                            class="text-red-500 hover:text-red-700">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Helper functions cho màu sắc
    getCompatTypeColor(type) {
        const colors = {
            'verb_object': 'bg-green-100 text-green-700',
            'subject_verb': 'bg-blue-100 text-blue-700',
            'prep_noun': 'bg-purple-100 text-purple-700',
            'adj_noun': 'bg-pink-100 text-pink-700'
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    }

    getScoreColor(score) {
        if (score >= 0.8) return 'bg-green-100 text-green-700 font-bold';
        if (score >= 0.5) return 'bg-yellow-100 text-yellow-700';
        return 'bg-red-100 text-red-700';
    }

    async uploadCompatibility() {
        const fileInput = document.getElementById('compat-excel-file');
        const file = fileInput.files[0];
        if (!file) {
            this.setStatus('compat-status', '❌ Chưa chọn file!');
            return;
        }

        try {
            const rows = await this.readExcel(file);
            
            const { error } = await this.supabase.from('compatibility').insert(rows);
            
            if (error) throw error;
            
            this.setStatus('compat-status', `✅ Đã upload ${rows.length} rules!`);
            
        } catch (err) {
            this.setStatus('compat-status', '❌ Lỗi: ' + err.message);
        }
    }

    async addCompatibilityQuick() {
    const type = document.getElementById('compat-type').value;
    const word1Id = parseInt(document.getElementById('compat-word1-id').value);
    const word1Table = document.getElementById('compat-word1-table').value;
    const word2Id = parseInt(document.getElementById('compat-word2-id').value);
    const word2Table = document.getElementById('compat-word2-table').value;
    const score = parseFloat(document.getElementById('compat-score').value);
    const note = document.getElementById('compat-note').value;

    if (!word1Id || !word1Table || !word2Id || !word2Table) {
        this.setStatus('compat-add-status', '❌ Vui lòng điền đầy đủ!');
        return;
    }

    const { error } = await this.supabase.from('compatibility').insert({
        compatibility_type: type,
        word1_id: word1Id,
        word1_table: word1Table,
        word2_id: word2Id,
        word2_table: word2Table,
        score: score,
        note: note || null
    });

    if (error) {
        this.setStatus('compat-add-status', '❌ Lỗi: ' + error.message);
    } else {
        this.setStatus('compat-add-status', '✅ Đã thêm rule!');
        this.loadCompatibility();
        
        // Clear form
        document.getElementById('compat-word1-id').value = '';
        document.getElementById('compat-word1-table').value = '';
        document.getElementById('compat-word2-id').value = '';
        document.getElementById('compat-word2-table').value = '';
        document.getElementById('compat-note').value = '';
    }
}

    // ==================== HELPERS ====================
    async readExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);
                resolve(rows);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    setStatus(elId, msg) {
        const el = document.getElementById(elId);
        if (el) el.textContent = msg;
    }
}