const StationManager = {
    locations: [],
    
    async load() {
        // Load locations để hiện trong dropdown
        const { data: locs } = await window.supabase
            .from('locations')
            .select('*')
            .order('order_index');
        this.locations = locs || [];
        
        // Load stations
        const { data, error } = await window.supabase
            .from('stations')
            .select('*, locations(name)')
            .order('location_id, order_index');
        
        if (error) {
            console.error('Lỗi load stations:', error);
            return;
        }
        
        this.render(data || []);
        this.populateLocationDropdown();
    },
    
    populateLocationDropdown() {
        const select = document.getElementById('station-location');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Chọn vùng đất --</option>' +
            this.locations.map(loc => 
                `<option value="${loc.id}">${loc.name}</option>`
            ).join('');
    },
    
    render(stations) {
        const list = document.getElementById('stations-list');
        if (!list) return;
        
        if (stations.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-center py-8">Chưa có chặng nào</p>';
            return;
        }
        
        // Group theo location
        const grouped = {};
        stations.forEach(st => {
            const locName = st.locations?.name || 'Không rõ';
            if (!grouped[locName]) grouped[locName] = [];
            grouped[locName].push(st);
        });
        
        list.innerHTML = Object.entries(grouped).map(([locName, items]) => `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-bold text-lg mb-3 text-purple-600">📍 ${locName}</h3>
                <div class="grid grid-cols-3 gap-3">
                    ${items.map(st => `
                        <div class="bg-white p-3 rounded-lg shadow border-l-4 border-purple-500">
                            <div class="flex justify-between items-start mb-2">
                                <span class="bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold">
                                    Chặng ${st.order_index}
                                </span>
                                <div class="flex gap-1">
                                    <button onclick="StationManager.edit('${st.id}')" 
                                            class="px-2 py-1 bg-yellow-400 text-white rounded text-xs hover:bg-yellow-500">
                                        ✏️
                                    </button>
                                    <button onclick="StationManager.delete('${st.id}')" 
                                            class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <h4 class="font-bold">${st.name}</h4>
                            <p class="text-xs text-gray-600 mt-1">${st.description || ''}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },
    
    showAddForm() {
        document.getElementById('station-form').classList.remove('hidden');
        document.getElementById('station-id').value = '';
        document.getElementById('station-location').value = '';
        document.getElementById('station-order').value = '';
        document.getElementById('station-name').value = '';
        document.getElementById('station-desc').value = '';
    },
    
    cancelForm() {
        document.getElementById('station-form').classList.add('hidden');
    },
    
    async edit(id) {
        const { data, error } = await window.supabase
            .from('stations')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) return;
        
        document.getElementById('station-form').classList.remove('hidden');
        document.getElementById('station-id').value = data.id;
        document.getElementById('station-location').value = data.location_id;
        document.getElementById('station-order').value = data.order_index;
        document.getElementById('station-name').value = data.name;
        document.getElementById('station-desc').value = data.description || '';
    },
    
    async save() {
        const id = document.getElementById('station-id').value;
        const locationId = document.getElementById('station-location').value;
        const order = parseInt(document.getElementById('station-order').value);
        const name = document.getElementById('station-name').value.trim();
        const desc = document.getElementById('station-desc').value.trim();
        
        if (!locationId || !order || !name) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }
        
        const payload = {
            location_id: locationId,
            order_index: order,
            name,
            description: desc
        };
        
        let error, newStationId;
        
        if (id) {
            // Update
            ({ error } = await window.supabase
                .from('stations')
                .update(payload)
                .eq('id', id));
            newStationId = id;
        } else {
            // Insert
            const { data, error: insertError } = await window.supabase
                .from('stations')
                .insert([payload])
                .select()
                .single();
            
            error = insertError;
            newStationId = data?.id;
            
            // ✅ Tự động tạo 10 steps với monster random
            if (!error && newStationId) {
                await this.createDefaultSteps(newStationId);
            }
        }
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.cancelForm();
        this.load();
    },
    
    // ✅ Thêm hàm mới
    async createDefaultSteps(stationId) {
        try {
            // Lấy danh sách monsters
            const { data: monsters } = await window.supabase
                .from('monsters')
                .select('id, type');
            
            if (!monsters || monsters.length === 0) {
                console.warn('Không có monster nào để gán');
                return;
            }
            
            // Tạo 10 steps
            const steps = [];
            for (let i = 1; i <= 10; i++) {
                let questionType = 1; // Mặc định type 1
                let targetMonsters = monsters.filter(m => m.type === 'normal');
                
                // Step 5 → Elite, Question Type 2
                if (i === 5) {
                    targetMonsters = monsters.filter(m => m.type === 'elite');
                    questionType = 2;
                }
                // Step 10 → Boss, Question Type 4
                else if (i === 10) {
                    targetMonsters = monsters.filter(m => m.type === 'boss');
                    questionType = 4;
                }
                
                // Random 1 monster
                const randomMonster = targetMonsters.length > 0 
                    ? targetMonsters[Math.floor(Math.random() * targetMonsters.length)]
                    : monsters[Math.floor(Math.random() * monsters.length)];
                
                steps.push({
                    station_id: stationId,
                    step_number: i,
                    monster_id: randomMonster.id,
                    question_type: questionType
                });
            }
            
            // Insert tất cả steps
            const { error } = await window.supabase
            .from('steps')
            .insert(steps);
        
        if (error) {
            console.error('Lỗi tạo steps:', error);
        } else {
            console.log(`✅ Đã tạo 10 steps cho station ${stationId}`);
        }
    } catch (err) {
        console.error('Lỗi createDefaultSteps:', err);
    }
    },
    
    async delete(id) {
        if (!confirm('Xóa chặng này? Sẽ xóa toàn bộ steps cấu hình!')) return;
        
        const { error } = await window.supabase
            .from('stations')
            .delete()
            .eq('id', id);
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.load();
    }
};

window.StationManager = StationManager;