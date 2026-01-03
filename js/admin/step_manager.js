const StepManager = {
    locations: [],
    stations: [],
    monsters: [],
    currentStationId: null,
    
    async load() {
        // Load tất cả data cần thiết
        const [locsRes, stationsRes, monstersRes] = await Promise.all([
            window.supabase.from('locations').select('*').order('order_index'),
            window.supabase.from('stations').select('*').order('order_index'),
            window.supabase.from('monsters').select('*')
        ]);
        
        this.locations = locsRes.data || [];
        this.stations = stationsRes.data || [];
        this.monsters = monstersRes.data || [];
        
        this.populateFilters();
        this.render([]);
    },
    
    populateFilters() {
        const locSelect = document.getElementById('step-filter-location');
        const stSelect = document.getElementById('step-filter-station');
        
        if (locSelect) {
            locSelect.innerHTML = '<option value="">-- Tất cả vùng --</option>' +
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
        
        // Tạo 10 ô (step 1-10)
        const stepsMap = {};
        steps.forEach(s => stepsMap[s.step_number] = s);
        
        grid.innerHTML = Array.from({length: 10}, (_, i) => {
            const stepNum = i + 1;
            const step = stepsMap[stepNum];
            
            return `
                <div class="bg-white border-2 ${step ? 'border-green-500' : 'border-gray-300'} rounded-lg p-3 text-center">
                    <div class="font-bold text-lg mb-2">Step ${stepNum}</div>
                    ${step ? `
                        <div class="text-xs mb-2">
                            <img src="${step.monsters.image_url}" class="w-16 h-16 mx-auto mb-1 object-contain">
                            <p class="font-bold">${step.monsters.name}</p>
                            <p class="text-gray-500">Q.Type: ${step.question_type}</p>
                        </div>
                        <div class="flex gap-1">
                            <button onclick="StepManager.editStep(${stepNum})" 
                                    class="flex-1 px-2 py-1 bg-yellow-400 text-white rounded text-xs hover:bg-yellow-500">
                                ✏️
                            </button>
                            <button onclick="StepManager.deleteStep(${stepNum})" 
                                    class="flex-1 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                                🗑️
                            </button>
                        </div>
                    ` : `
                        <button onclick="StepManager.addStep(${stepNum})" 
                                class="w-full px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">
                            + Thêm
                        </button>
                    `}
                </div>
            `;
        }).join('');
    },
    
    async addStep(stepNumber) {
        const monsterId = prompt('Nhập ID Monster (hoặc để trống để chọn random):');
        const questionType = prompt('Question Type (1-5):', '1');
        
        if (!questionType) return;
        
        const payload = {
            station_id: this.currentStationId,
            step_number: stepNumber,
            monster_id: monsterId || null,
            question_type: parseInt(questionType)
        };
        
        const { error } = await window.supabase
            .from('steps')
            .insert([payload]);
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.loadSteps();
    },
    
    async editStep(stepNumber) {
        // Tương tự addStep, có thể làm modal đẹp hơn
        const monsterId = prompt('Nhập ID Monster mới:');
        const questionType = prompt('Question Type (1-5):', '1');
        
        if (!questionType) return;
        
        const { error } = await window.supabase
            .from('steps')
            .update({
                monster_id: monsterId || null,
                question_type: parseInt(questionType)
            })
            .eq('station_id', this.currentStationId)
            .eq('step_number', stepNumber);
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
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
    }
};

window.StepManager = StepManager;