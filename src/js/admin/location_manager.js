const LocationManager = {
    async load() {
        const { data, error } = await window.supabase
            .from('locations')
            .select('*')
            .order('order_index');
        
        if (error) {
            console.error('Lỗi load locations:', error);
            return;
        }
        
        this.render(data || []);
    },
    
    render(locations) {
        const list = document.getElementById('locations-list');
        if (!list) return;
        
        if (locations.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-center py-8">Chưa có vùng đất nào</p>';
            return;
        }
        
        list.innerHTML = locations.map(loc => `
            <div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-blue-500 text-white px-2 py-1 rounded text-sm font-bold">
                                #${loc.order_index}
                            </span>
                            <h3 class="text-xl font-bold">${loc.name}</h3>
                        </div>
                        <p class="text-gray-600 text-sm mb-2">${loc.description || ''}</p>
                        ${loc.image_url ? `<img src="${loc.image_url}" class="w-32 h-20 object-cover rounded mt-2">` : ''}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="LocationManager.edit('${loc.id}')" 
                                class="px-3 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500">
                            ✏️
                        </button>
                        <button onclick="LocationManager.delete('${loc.id}')" 
                                class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    showAddForm() {
        document.getElementById('location-form').classList.remove('hidden');
        document.getElementById('location-id').value = '';
        document.getElementById('location-name').value = '';
        document.getElementById('location-order').value = '';
        document.getElementById('location-desc').value = '';
        document.getElementById('location-image').value = '';
    },
    
    cancelForm() {
        document.getElementById('location-form').classList.add('hidden');
    },
    
    async edit(id) {
        const { data, error } = await window.supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) return;
        
        document.getElementById('location-form').classList.remove('hidden');
        document.getElementById('location-id').value = data.id;
        document.getElementById('location-name').value = data.name;
        document.getElementById('location-order').value = data.order_index;
        document.getElementById('location-desc').value = data.description || '';
        document.getElementById('location-image').value = data.image_url || '';
    },
    
    async save() {
        const id = document.getElementById('location-id').value;
        const name = document.getElementById('location-name').value.trim();
        const order = parseInt(document.getElementById('location-order').value);
        const desc = document.getElementById('location-desc').value.trim();
        const image = document.getElementById('location-image').value.trim();
        
        if (!name || !order) {
            alert('Vui lòng điền tên và thứ tự!');
            return;
        }
        
        const payload = {
            name,
            order_index: order,
            description: desc,
            image_url: image
        };
        
        let error;
        if (id) {
            // Update
            ({ error } = await window.supabase
                .from('locations')
                .update(payload)
                .eq('id', id));
        } else {
            // Insert
            ({ error } = await window.supabase
                .from('locations')
                .insert([payload]));
        }
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.cancelForm();
        this.load();
    },
    
    async delete(id) {
        if (!confirm('Xóa vùng đất này? Sẽ xóa toàn bộ chặng và steps bên trong!')) return;
        
        const { error } = await window.supabase
            .from('locations')
            .delete()
            .eq('id', id);
        
        if (error) {
            alert('Lỗi: ' + error.message);
            return;
        }
        
        this.load();
    }
};

window.LocationManager = LocationManager;