// profile_manager.js
export class ProfileManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async load() {
        const sortBy = document.getElementById('sort-profiles')?.value || 'level';
        
        let query = this.supabase.from('profiles').select('*');
    
        // Sort theo lựa chọn
        switch(sortBy) {
            case 'level':
                query = query.order('level', { ascending: false });
                break;
            case 'coin':
                query = query.order('coin', { ascending: false });
                break;
            case 'base_atk':
                query = query.order('base_atk', { ascending: false });
                break;
            case 'name':
                query = query.order('display_name', { ascending: true });
                break;
        }
    
        const { data: profiles, error } = await query;
    
        if (error) {
            console.error('Load profiles error:', error);
            return;
        }
    
        this.render(profiles);
    }

    render(profiles) {
        const container = document.getElementById('profiles-list');
        if (!container) return;

        container.innerHTML = profiles.map(p => `
            <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all">
                <div class="text-4xl">${p.avatar_key || '👤'}</div>
                <div class="flex-1">
                    <p class="font-bold text-lg">${p.display_name}</p>
                    <div class="flex gap-4 text-sm text-gray-600">
                        <span>Lv.${p.level || 1}</span>
                        <span>Atk.${p.base_atk || 1}</span>
                        <span>Def.${p.base_def || 1}</span>
                        <span>EXP: ${p.exp || 0}</span>
                        <span>💰 ${p.coin || 0}</span>
                        <span>❤️ ${p.hp_bonus || 0}</span>
                    </div>
                </div>
                <button onclick="ProfileManager.edit('${p.id}')" 
                        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold">
                    ✏️ Sửa
                </button>
            </div>
        `).join('');
    }

    /**
     * Hiển thị form edit profile
     */
    async showEditForm(userId) {
        const { data: profile, error } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            alert('Lỗi load profile: ' + error.message);
            return;
        }

        // Tạo modal edit
        const modal = document.createElement('div');
        modal.id = 'edit-profile-modal';
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-2xl font-bold mb-6 text-blue-600">✏️ Chỉnh sửa Profile</h3>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-bold mb-2">Tên hiển thị</label>
                        <input type="text" id="edit-display-name" value="${profile.display_name}" 
                            class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-bold mb-2">Avatar</label>
                        <input type="text" id="edit-avatar" value="${profile.avatar_key || ''}" 
                            class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                    </div>

                    <div>
                        <label class="block text-sm font-bold mb-2">Level</label>
                        <input type="number" id="edit-level" value="${profile.level || 1}" 
                            class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                    </div>

                    <div>
                        <label class="block text-sm font-bold mb-2">EXP</label>
                        <input type="number" id="edit-exp" value="${profile.exp || 0}" 
                            class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                    </div>

                    <div>
                        <label class="block text-sm font-bold mb-2">💰 Coin</label>
                        <input type="number" id="edit-coin" value="${profile.coin || 0}" 
                            class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                    </div>

                    <div>
                        <label class="block text-sm font-bold mb-2">❤️ HP </label>
                        <input type="number" id="edit-hp" value="${profile.hp_bonus || 0}" 
                            class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                    </div>

                    <div>
                        <label class="text-xs text-gray-500 font-bold">⚔️ ATK Bonus</label>
                        <input type="number" id="edit-atk" value="${profile.base_atk || 0}" 
                            class="w-full p-2 border rounded-lg text-center font-bold text-orange-600">
                    </div>

                    <div>
                        <label class="text-xs text-gray-500 font-bold">🛡️ DEF Bonus</label>
                        <input type="number" id="edit-def" value="${profile.base_def || 0}" 
                            class="w-full p-2 border rounded-lg text-center font-bold text-blue-600">
                    </div>

                    <div>
                        <label class="block text-sm font-bold mb-2">Role</label>
                        <select id="edit-role" class="w-full p-3 border-2 rounded-xl focus:border-blue-400 outline-none">
                            <option value="player" ${profile.role === 'player' ? 'selected' : ''}>Player</option>
                            <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                </div>

                <div class="bg-yellow-50 p-3 rounded-lg">
                    <label class="text-xs text-gray-500 font-bold">🔑 Đổi mật khẩu</label>
                    <input type="password" id="edit-pws" 
                        placeholder="Để trống nếu không đổi..." 
                        class="w-full p-2 border rounded-lg text-sm">
                    <p class="text-xs text-gray-400 mt-1">Chỉ nhập nếu muốn thay đổi</p>
                </div>

                <div class="flex gap-3">
                    <button onclick="ProfileManager.saveEdit('${userId}')" 
                            class="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600">
                        💾 Lưu
                    </button>
                    <button onclick="ProfileManager.closeEditForm()" 
                            class="flex-1 py-3 bg-gray-300 rounded-xl font-bold hover:bg-gray-400">
                        ❌ Hủy
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) this.closeEditForm();
        };
    }

    /**
     * Lưu chỉnh sửa
     */
    async saveEdit(userId) {
        const data = {
            display_name: document.getElementById('edit-display-name').value,
            avatar_key: document.getElementById('edit-avatar').value,
            level: parseInt(document.getElementById('edit-level').value) || 1,
            exp: parseInt(document.getElementById('edit-exp').value) || 0,
            coin: parseInt(document.getElementById('edit-coin').value) || 0,
            hp_bonus: parseInt(document.getElementById('edit-hp').value) || 0,
            base_atk: parseInt(document.getElementById('edit-atk').value) || 0,
            base_def: parseInt(document.getElementById('edit-def').value) || 0,
            role: document.getElementById('edit-role').value,
        };

        const newPassword = document.getElementById(`edit-pws`)?.value.trim();
        if (newPassword && newPassword.length >= 4) {
            data.password = newPassword;
        }

        const { error } = await this.supabase
            .from('profiles')
            .update(data)
            .eq('id', userId);

        if (error) {
            alert('Lỗi lưu: ' + error.message);
            return;
        }

        alert('✅ Đã lưu thành công!');
        this.closeEditForm();
        this.load(); // Reload danh sách
    }

    /**
     * Đóng form edit
     */
    closeEditForm() {
        const modal = document.getElementById('edit-profile-modal');
        if (modal) modal.remove();
    }

    // Sửa method edit() cũ thành:
    edit(userId) {
        this.showEditForm(userId);
    }

    /**
     * Tìm kiếm profiles
     */
    search() {
        const searchInput = document.getElementById('search-profile');
        if (!searchInput) return;

        const keyword = searchInput.value.toLowerCase().trim();

        // Nếu rỗng → load tất cả
        if (!keyword) {
            this.load();
            return;
        }

        // Filter profiles đã load
        const allCards = document.querySelectorAll('#profiles-list > div');
        
        allCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(keyword)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    /**
     * Init - gắn sự kiện tìm kiếm
     */
    init() {
        const searchInput = document.getElementById('search-profile');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.search());
        }
    }
}

window.ProfileManager = new ProfileManager(window.supabase);