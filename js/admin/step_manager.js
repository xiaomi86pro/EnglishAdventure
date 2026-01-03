const StepManager = {
    locations: [],
    stations: [],
    monsters: [],
    questionTypes: [],
    currentStationId: null,
    
    async load() {
        // Load tất cả data
        const [locsRes, stationsRes, monstersRes, qTypesRes] = await Promise.all([
            window.supabase.from('locations').select('*').order('order_index'),
            window.supabase.from('stations').select('*').order('order_index'),
            window.supabase.from('monsters').select('*'),
            window.supabase.from('question_types').select('*').order('id')
        ]);
        
        this.locations = locsRes.data || [];
        this.stations = stationsRes.data || [];
        this.monsters = monstersRes.data || [];
        this.questionTypes = qTypesRes.data || [];
        
        this.populateFilters();
        this.render([]);
    },
    
    populateFilters() {
        const locSelect = document.getElementById('step-filter-location');
        const stSelect = document.getElementById('step-filter-station');
        
        if (locSelect) {
            locSelect.innerHTML = '<option value="">-- Chọn vùng --</option>' +
                this.locations.map(loc => 
                    `<option value="${loc.id}">${loc.name}</option>`
                ).join('');
        }
        
        if (stSelect) {
            stSelect.innerHTML = '<option value="">-- Chọn chặng --</option>';
        }
    },
    
    async filterByLocation() {
        const locId = document.getElementById('step-filter-location').value;
        const stSelect = document.getElementById('step-filter-station');
        
        if (!locId) {
            stSelect.innerHTML = '<option value="">-- Chọn chặng --</option>';
            this.render([]);
            return;
        }
        
        const filtered = this.stations.filter(st => st.location_id === locId);
        stSelect.innerHTML = '<option value="">-- Chọn chặng --</option>' +
            filtered.map(st => 
                `<option value="${st.id}">Chặng ${st.order_index}: ${st.name}</option>`
            ).join('');
        
        this.render([]);
    },
    
    async loadSteps() {
        const stationId = document.getElementById('step-filter-station').value;
        if (!stationId) {
            this.render([]);
            return;
        }
        
        this.currentStationId = stationId;
        
        const { data, error } = await window.supabase
            .from('steps')
            .select('*, monsters(*)')
            .eq('station_id', stationId)
            .order('step_number');
        
        if (error) {
            console.error('Lỗi load steps:', error);
            return;
        }
        
        this.render(data || []);
    },
    
    render(steps) {
        const grid = document.getElementById('steps-grid');
        if (!grid) return;
        
        if (!this.currentStationId) {
            grid.innerHTML = '<p class="col-span-5 text-gray-500 text-center py-8">Vui lòng chọn chặng để cấu hình</p>';
            return;
        }
        
        // Map steps
        const stepsMap = {};
        steps.forEach(s => stepsMap[s.step_number] = s);
        
        grid.innerHTML = Array.from({length: 10}, (_, i) => {
            const stepNum = i + 1;
            const step = stepsMap[stepNum];
            
            return `
                <div class="bg-white border-2 ${step ? 'border-green-500' : 'border-gray-300'} rounded-lg p-3">
                    <div class="font-bold text-lg mb-2 text-center">Step ${stepNum}</div>
                    ${step ? `
                        <div class="text-xs mb-2">
                            <img src="${step.monsters.image_url}" class="w-16 h-16 mx-auto mb-1 object-contain bg-gray-50 rounded">
                            <p class="font-bold truncate">${step.monsters.name}</p>
                            <p class="text-gray-500">${step.monsters.type}</p>
                            ${this.getQuestionTypeBadge(step.question_type)}
                        </div>
                        <button onclick="StepManager.editStep(${stepNum})" 
                                class="w-full px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 mb-1">
                            ✏️ Sửa
                        </button>
                        <button onclick="StepManager.deleteStep(${stepNum})" 
                                class="w-full px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                            🗑️ Xóa
                        </button>
                    ` : `
                        <div class="text-gray-400 text-xs mb-2 text-center h-20 flex items-center justify-center">
                            Chưa cấu hình
                        </div>
                        <button onclick="StepManager.editStep(${stepNum})" 
                                class="w-full px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">
                            + Thêm
                        </button>
                    `}
                </div>
            `;
        }).join('');
    },
    
    getQuestionTypeBadge(typeId) {
        const type = this.questionTypes.find(t => t.id === typeId);
        if (!type) return `<span class="text-xs bg-gray-200 px-2 py-1 rounded">Type ${typeId}</span>`;
        
        return `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">${type.icon} ${type.name}</span>`;
    },
    
    async editStep(stepNumber) {
        if (!this.currentStationId) return;
        
        // Tạo modal chọn monster
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">Cấu hình Step ${stepNumber}</h3>
                
                <div class="mb-4">
                    <label class="block font-bold mb-2">Chọn Quái vật:</label>
                    <div class="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto border rounded p-3">
                        ${this.monsters.map(m => `
                            <div onclick="StepManager.selectMonster('${m.id}')" 
                                 data-monster-id="${m.id}"
                                 class="monster-option cursor-pointer p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-all">
                                <img src="${m.image_url}" class="w-16 h-16 mx-auto object-contain mb-2">
                                <p class="text-xs font-bold text-center truncate">${m.name}</p>
                                <p class="text-xs text-gray-500 text-center">${m.type}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block font-bold mb-2">Loại câu hỏi:</label>
                    <select id="modal-question-type" class="w-full p-3 border rounded-lg">
                        ${this.questionTypes.map(qt => `
                            <option value="${qt.id}">${qt.icon} ${qt.name} - ${qt.description}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="flex gap-2">
                    <button onclick="StepManager.saveStepConfig(${stepNumber})" 
                            class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600">
                        💾 Lưu
                    </button>
                    <button onclick="StepManager.closeModal()" 
                            class="px-4 py-3 bg-gray-300 rounded-lg font-bold hover:bg-gray-400">
                        Hủy
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.currentModal = modal;
        this.selectedMonsterId = null;
        
        // Load config hiện tại nếu có
        const { data: existingStep } = await window.supabase
            .from('steps')
            .select('*')
            .eq('station_id', this.currentStationId)
            .eq('step_number', stepNumber)
            .single();
        
        if (existingStep) {
            this.selectedMonsterId = existingStep.monster_id;
            document.getElementById('modal-question-type').value = existingStep.question_type;
            
            // Highlight monster đã chọn
            const monsterEl = modal.querySelector(`[data-monster-id="${existingStep.monster_id}"]`);
            if (monsterEl) monsterEl.classList.add('border-blue-500', 'bg-blue-50');
        }
    },
    
    selectMonster(monsterId) {
        this.selectedMonsterId = monsterId;
        
        // Remove highlight cũ
        document.querySelectorAll('.monster-option').forEach(el => {
            el.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        // Highlight monster mới
        const selected = document.querySelector(`[data-monster-id="${monsterId}"]`);
        if (selected) selected.classList.add('border-blue-500', 'bg-blue-50');
    },
    
    async saveStepConfig(stepNumber) {
        if (!this.selectedMonsterId) {
            alert('Vui lòng chọn quái vật!');
            return;
        }
        
        const questionType = parseInt(document.getElementById('modal-question-type').value);
        
        const payload = {
            station_id: this.currentStationId,
            step_number: stepNumber,
            monster_id: this.selectedMonsterId,
            question_type: questionType
        };
        
        // Upsert (insert hoặc update)
        const { error } = await window.supabase
            .from('steps')
            .upsert(payload, { onConflict: 'station_id,step_number' });
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.closeModal();
        this.loadSteps();
    },
    
    async deleteStep(stepNumber) {
        if (!confirm(`Xóa cấu hình Step ${stepNumber}?`)) return;
        
        const { error } = await window.supabase
            .from('steps')
            .delete()
            .eq('station_id', this.currentStationId)
            .eq('step_number', stepNumber);
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.loadSteps();
    },
    
    closeModal() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
    }
};

window.StepManager = StepManager;