// asset_manager.js
export class AssetManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    // Khởi tạo
    init() {
        this.setupHeroForm();
        this.setupMonsterForm();
        this.setupGearForm();
        this.setupTabSwitching();
        this.setupAssetFormButtons();
        
        // Load dữ liệu ban đầu
        this.loadStationsForUnlock();
        this.loadLocationsForMonster();
    }

    // ===== UPLOAD ASSET =====
    async uploadAsset(file, subFolder) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${subFolder}_${Date.now()}.${fileExt}`;
        const filePath = `${subFolder}/${fileName}`;

        const { data, error } = await this.supabase.storage
            .from('Assets')
            .upload(filePath, file);

        if (error) throw error;

        const { data: urlData } = this.supabase.storage
            .from('Assets')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    }

    // ===== ASSET FORM TOGGLING =====
    setupAssetFormButtons() {
        const buttons = document.querySelectorAll('#asset-form-buttons [data-form]');
        if (!buttons.length) return;

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.form;
                this.showAssetForm(type);
            });
        });
    }

    showAssetForm(type) {
        const forms = ['hero', 'monster', 'gear'];

        forms.forEach(f => {
            const el = document.getElementById(`form-${f}`);
            if (!el) return;

            el.classList.toggle('hidden', f !== type);
        });
    }




    // ===== HERO MANAGEMENT =====
    setupHeroForm() {
        const saveBtn = document.getElementById('save-hero-btn');
        if (!saveBtn) return;

        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('hero-name').value;
            const hp = parseInt(document.getElementById('hero-hp').value) || 100;
            const atk = parseInt(document.getElementById('hero-atk').value) || 10;
            const def = parseInt(document.getElementById('hero-def').value) || 5;
            const heroFile = document.getElementById('hero-file').files[0];
            const heroUrlInput = document.getElementById('hero-url').value;
            const isLocked = document.getElementById('hero-locked').checked;
            const unlockStationId = document.getElementById('hero-unlock-station')?.value || null;

            if (!name) return this.showToast("Vui lòng nhập tên Hero!");

            try {
                saveBtn.innerText = "Đang xử lý...";
                saveBtn.disabled = true;

                let finalUrl = heroUrlInput;
                if (heroFile) {
                    finalUrl = await this.uploadAsset(heroFile, 'heroes');
                }

                const { error } = await this.supabase
                    .from('heroes')
                    .insert([{
                        name: name,
                        image_url: finalUrl,
                        base_hp: hp,
                        base_atk: atk,
                        base_def: def,
                        is_locked: isLocked,
                        unlock_station_id: unlockStationId
                    }]);

                if (error) throw error;
                
                this.showToast("✅ Lưu Hero thành công!");
                
                // Reset form
                document.getElementById('hero-name').value = '';
                document.getElementById('hero-url').value = '';
                document.getElementById('hero-file').value = '';
                document.getElementById('hero-locked').checked = false;
                
                this.loadHeroes();

            } catch (err) {
                this.showToast("Lỗi: " + err.message);
            } finally {
                saveBtn.innerText = "Lưu Hero";
                saveBtn.disabled = false;
            }
        });
    }

    async loadHeroes() {
        const container = document.getElementById('asset-grid-container');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500">Đang tải Heroes...</p>';

        const { data: heroes, error } = await this.supabase
            .from('heroes')
            .select(`
                *,
                stations:unlock_station_id (
                    id,
                    name,
                    order_index,
                    locations (name)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-500">Lỗi: ${error.message}</p>`;
            return;
        }

        const { data: allStations } = await this.supabase
            .from('stations')
            .select('id, name, order_index, locations(name)')
            .order('order_index');

        container.innerHTML = '';

        heroes.forEach(hero => {
            const card = this.createHeroCard(hero, allStations);
            container.appendChild(card);
        });
    }

    createHeroCard(hero, allStations) {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-blue-200 shadow-sm space-y-3";
        
        const unlockInfo = hero.stations 
            ? `${hero.stations.locations?.name || '?'} - ${hero.stations.name}`
            : 'Không khóa';
        
        card.innerHTML = `
            <div class="flex items-center gap-4 pb-3 border-b border-gray-100">
                <div class="relative">
                    <img src="${hero.image_url}" 
                         class="w-20 h-20 object-contain bg-gray-50 rounded-lg ${hero.is_locked ? 'grayscale' : ''}" 
                         alt="${hero.name}">
                    ${hero.is_locked ? '<div class="absolute top-0 right-0 text-2xl">🔒</div>' : ''}
                </div>
                <div class="flex-1">
                    <input type="text" 
                           id="hero-name-${hero.id}" 
                           value="${hero.name}" 
                           class="font-bold text-xl text-gray-700 w-full border-b border-transparent focus:border-blue-400 outline-none mb-1">
                    <p class="text-xs text-gray-400">ID: ${hero.id.substring(0,8)}...</p>
                    ${hero.is_locked 
                        ? `<p class="text-xs text-red-500 font-bold mt-1">🔒 Unlock: ${unlockInfo}</p>`
                        : `<p class="text-xs text-green-500 font-bold mt-1">✅ Hero mặc định</p>`
                    }
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="text-xs text-gray-500 font-bold">❤️ HP</label>
                    <input type="number" id="hero-hp-${hero.id}" value="${hero.base_hp || 100}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-red-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">⚔️ ATK</label>
                    <input type="number" id="hero-atk-${hero.id}" value="${hero.base_atk || 10}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-orange-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">🛡️ DEF</label>
                    <input type="number" id="hero-def-${hero.id}" value="${hero.base_def || 5}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-blue-600">
                </div>
            </div>

            <div class="bg-blue-50 p-3 rounded-lg space-y-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="hero-locked-${hero.id}" ${hero.is_locked ? 'checked' : ''} class="w-4 h-4">
                    <label for="hero-locked-${hero.id}" class="text-sm font-bold">🔒 Khóa hero này</label>
                </div>
                
                <select id="hero-unlock-${hero.id}" class="w-full p-2 border rounded-lg text-sm bg-white" ${!hero.is_locked ? 'disabled' : ''}>
                    <option value="">-- Chọn chặng để unlock --</option>
                    ${allStations?.map(st => `
                        <option value="${st.id}" ${hero.unlock_station_id === st.id ? 'selected' : ''}>
                            ${st.locations?.name || '?'} - Chặng ${st.order_index}: ${st.name}
                        </option>
                    `).join('') || ''}
                </select>
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="window.assetManager.updateHero('${hero.id}')" 
                        class="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors">
                    💾 Lưu
                </button>
                <button onclick="window.assetManager.deleteHero('${hero.id}')" 
                        class="py-2 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors">
                    🗑️
                </button>
            </div>
        `;
        
        const checkbox = card.querySelector(`#hero-locked-${hero.id}`);
        const dropdown = card.querySelector(`#hero-unlock-${hero.id}`);
        checkbox.addEventListener('change', () => {
            dropdown.disabled = !checkbox.checked;
            if (!checkbox.checked) dropdown.value = '';
        });
        
        return card;
    }

    async updateHero(id) {
        const name = document.getElementById(`hero-name-${id}`).value;
        const hp = parseInt(document.getElementById(`hero-hp-${id}`).value);
        const atk = parseInt(document.getElementById(`hero-atk-${id}`).value);
        const def = parseInt(document.getElementById(`hero-def-${id}`).value);
        const isLocked = document.getElementById(`hero-locked-${id}`).checked;
        const unlockStationId = document.getElementById(`hero-unlock-${id}`).value || null;

        const { error } = await this.supabase
            .from('heroes')
            .update({
                name,
                base_hp: hp,
                base_atk: atk,
                base_def: def,
                is_locked: isLocked,
                unlock_station_id: unlockStationId
            })
            .eq('id', id);

        if (error) {
            this.showToast("Lỗi cập nhật: " + error.message);
        } else {
            this.showToast("✅ Đã cập nhật Hero thành công!");
            this.loadHeroes();
        }
    }

    async deleteHero(id) {
        if (!confirm("Bạn có chắc muốn xóa Hero này?")) return;
        
        const { error } = await this.supabase.from('heroes').delete().eq('id', id);
        
        if (error) {
            this.showToast("Lỗi xóa: " + error.message);
        } else {
            this.showToast("✅ Đã xóa Hero!");
            this.loadHeroes();
        }
    }

    // ===== MONSTER MANAGEMENT =====
    setupMonsterForm() {
        const saveBtn = document.getElementById('save-monster-btn');
        if (!saveBtn) return;

        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('monster-name').value;
            const hp = parseInt(document.getElementById('monster-hp').value) || 50;
            const atk = parseInt(document.getElementById('monster-atk').value) || 5;
            const def = parseInt(document.getElementById('monster-def').value) || 0;
            const exp = parseInt(document.getElementById('monster-exp').value) || 10;
            const coin = parseInt(document.getElementById('monster-coin').value) || 1;
            const type = document.getElementById('monster-type').value;
            const locationId = document.getElementById('monster-location').value || null;
            const monsterFile = document.getElementById('monster-file').files[0];
            const monsterUrlInput = document.getElementById('monster-url').value;

            if (!name) return this.showToast("Vui lòng nhập tên Quái vật!");

            try {
                saveBtn.innerText = "Đang lưu...";
                saveBtn.disabled = true;

                let finalUrl = monsterUrlInput;
                if (monsterFile) {
                    finalUrl = await this.uploadAsset(monsterFile, 'monsters');
                }

                const { error } = await this.supabase
                    .from('monsters')
                    .insert([{
                        name: name,
                        type: type,
                        image_url: finalUrl,
                        base_hp: hp,
                        base_atk: atk,
                        base_def: def,
                        exp_reward: exp,
                        coin: coin,
                        location_id: locationId
                    }]);

                if (error) throw error;
                
                this.showToast("✅ Lưu Quái vật thành công!");
                
                // Reset form
                document.getElementById('monster-name').value = '';
                document.getElementById('monster-url').value = '';
                document.getElementById('monster-file').value = '';
                
                this.loadMonsters();

            } catch (err) {
                this.showToast("Lỗi: " + err.message);
            } finally {
                saveBtn.innerText = "Lưu Quái vật";
                saveBtn.disabled = false;
            }
        });
    }

    async loadMonsters() {
        const container = document.getElementById('asset-grid-container');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500">Đang tải Monsters...</p>';

        const { data: monsters, error } = await this.supabase
            .from('monsters')
            .select(`
                *,
                locations:location_id (name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-500">Lỗi: ${error.message}</p>`;
            return;
        }

        const { data: allLocations } = await this.supabase
            .from('locations')
            .select('id, name, order_index')
            .order('order_index');

        container.innerHTML = '';

        monsters.forEach(monster => {
            const card = this.createMonsterCard(monster, allLocations);
            container.appendChild(card);
        });
    }

    createMonsterCard(monster, allLocations) {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-red-200 shadow-sm space-y-3 w-full min-w-[250px] flex-shrink-0";

        const typeColors = {
            'normal': 'bg-gray-100 text-gray-700',
            'elite': 'bg-yellow-100 text-yellow-700',
            'boss': 'bg-red-100 text-red-700',
            'final boss': 'bg-purple-100 text-purple-700'
        };
        
        card.innerHTML = `
            <div class="flex items-center gap-4 pb-3 border-b border-gray-100">
                <img src="${monster.image_url}" class="w-20 h-20 object-contain bg-gray-50 rounded-lg" alt="${monster.name}">
                <div class="flex-1">
                    <input type="text" id="monster-name-${monster.id}" value="${monster.name}" 
                           class="font-bold text-xl text-gray-700 w-full border-b border-transparent focus:border-red-400 outline-none mb-1">
                    <p class="text-xs text-gray-400">ID: ${monster.id.substring(0,8)}...</p>
                    <span class="inline-block mt-1 px-2 py-1 rounded text-xs font-bold ${typeColors[monster.type] || typeColors['normal']}">
                        ${monster.type?.toUpperCase() || 'NORMAL'}
                    </span>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="text-xs text-gray-500 font-bold">❤️ HP</label>
                    <input type="number" id="monster-hp-${monster.id}" value="${monster.base_hp || 50}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-red-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">⚔️ ATK</label>
                    <input type="number" id="monster-atk-${monster.id}" value="${monster.base_atk || 5}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-orange-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">🛡️ DEF</label>
                    <input type="number" id="monster-def-${monster.id}" value="${monster.base_def || 0}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-blue-600">
                </div>
            </div>
            <div class="grid grid-cols-3 gap-3">    
                <div>
                    <label class="text-xs text-gray-500 font-bold">✨ EXP</label>
                    <input type="number" id="monster-exp-${monster.id}" value="${monster.exp_reward || 10}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-purple-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">🪙 Coin</label>
                    <input type="number" id="monster-coin-${monster.id}" value="${monster.coin || 5}" 
                        class="w-full p-2 border rounded-lg text-center font-bold text-yellow-600">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs text-gray-500 font-bold">Loại</label>
                    <select id="monster-type-${monster.id}" class="w-full p-2 border rounded-lg text-sm bg-white">
                        <option value="normal" ${monster.type === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="elite" ${monster.type === 'elite' ? 'selected' : ''}>Elite</option>
                        <option value="boss" ${monster.type === 'boss' ? 'selected' : ''}>Boss</option>
                        <option value="final boss" ${monster.type === 'final boss' ? 'selected' : ''}>Final Boss</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">Vùng đất</label>
                    <select id="monster-location-${monster.id}" class="w-full p-2 border rounded-lg text-sm bg-white">
                        <option value="">-- Tất cả vùng --</option>
                        ${allLocations?.map(loc => `
                            <option value="${loc.id}" ${monster.location_id === loc.id ? 'selected' : ''}>
                                ${loc.name}
                            </option>
                        `).join('') || ''}
                    </select>
                </div>
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="window.assetManager.updateMonster('${monster.id}')" 
                        class="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors">
                    💾 Lưu
                </button>
                <button onclick="window.assetManager.deleteMonster('${monster.id}')" 
                        class="py-2 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors">
                    🗑️
                </button>
            </div>
        `;
        
        return card;
    }

    async updateMonster(id) {
        const name = document.getElementById(`monster-name-${id}`).value;
        const hp = parseInt(document.getElementById(`monster-hp-${id}`).value);
        const atk = parseInt(document.getElementById(`monster-atk-${id}`).value);
        const def = parseInt(document.getElementById(`monster-def-${id}`).value);
        const exp = parseInt(document.getElementById(`monster-exp-${id}`).value);
        const coin = parseInt(document.getElementById(`monster-coin-${id}`).value); 
        const type = document.getElementById(`monster-type-${id}`).value;
        const locationId = document.getElementById(`monster-location-${id}`).value || null;

        const { error } = await this.supabase
            .from('monsters')
            .update({
                name,
                base_hp: hp,
                base_atk: atk,
                base_def: def,
                exp_reward: exp,
                coin: coin,
                type,
                location_id: locationId
            })
            .eq('id', id);

        if (error) {
            this.showToast("Lỗi cập nhật: " + error.message);
        } else {
            this.showToast("✅ Đã cập nhật Monster thành công!");
            this.loadMonsters();
        }
    }

    async deleteMonster(id) {
        if (!confirm("Bạn có chắc muốn xóa Monster này?")) return;
        
        const { error } = await this.supabase.from('monsters').delete().eq('id', id);
        
        if (error) {
            this.showToast("Lỗi xóa: " + error.message);
        } else {
            this.showToast("✅ Đã xóa Monster!");
            this.loadMonsters();
        }
    }

    // ===== GEAR MANAGEMENT =====
    setupGearForm() {
        const saveBtn = document.getElementById('save-gear-btn');
        if (!saveBtn) return;

        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('gear-name').value;
            const type = document.getElementById('gear-type').value;
            const frameIndex = parseInt(document.getElementById('gear-frame-index').value) || 0;
            const gearFile = document.getElementById('gear-file').files[0];
            const gearUrl = document.getElementById('gear-url').value;

            if (!name) return this.showToast("Vui lòng nhập tên trang bị!");

            try {
                saveBtn.innerText = "Đang lưu...";
                saveBtn.disabled = true;

                let finalUrl = gearUrl;
                if (gearFile) {
                    finalUrl = await this.uploadAsset(gearFile, 'gear');
                }

                const { error } = await this.supabase
                    .from('gear')
                    .insert([{
                        name: name,
                        type: type,
                        image_url: finalUrl,
                        frame_index: frameIndex
                    }]);

                if (error) throw error;
                
                this.showToast("✅ Lưu trang bị thành công!");
                
                // Reset form
                document.getElementById('gear-name').value = '';
                document.getElementById('gear-url').value = '';
                document.getElementById('gear-file').value = '';
                document.getElementById('gear-frame-index').value = '0';

            } catch (err) {
                this.showToast("Lỗi: " + err.message);
            } finally {
                saveBtn.innerText = "Lưu Trang bị";
                saveBtn.disabled = false;
            }
        });
    }

    async loadGears() {
        const container = document.getElementById('asset-grid-container');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500">Đang tải Gear...</p>';

        const { data: gears, error } = await this.supabase
            .from('gear')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-500">Lỗi: ${error.message}</p>`;
            return;
        }

        container.innerHTML = '';

        gears.forEach(gear => {
            const card = this.createGearCard(gear);
            container.appendChild(card);
        });
    }

    createGearCard(gear) {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-purple-200 shadow-sm space-y-3";
        
        const typeIcon = gear.type === 'weapon' ? '⚔️' : '🛡️';
        const typeText = gear.type === 'weapon' ? 'Vũ khí' : 'Khiên';
        
        card.innerHTML = `
            <div class="flex items-center gap-4 pb-3 border-b border-gray-100">
                <img src="${gear.image_url}" class="w-20 h-20 object-contain bg-gray-50 rounded-lg" alt="${gear.name}">
                <div class="flex-1">
                    <input type="text" id="gear-name-${gear.id}" value="${gear.name}" 
                           class="font-bold text-xl text-gray-700 w-full border-b border-transparent focus:border-purple-400 outline-none mb-1">
                    <p class="text-xs text-gray-400">ID: ${gear.id.substring(0,8)}...</p>
                    <span class="inline-block mt-1 px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700">
                        ${typeIcon} ${typeText}
                    </span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs text-gray-500 font-bold">Loại</label>
                    <select id="gear-type-${gear.id}" class="w-full p-2 border rounded-lg text-sm bg-white">
                        <option value="weapon" ${gear.type === 'weapon' ? 'selected' : ''}>⚔️ Vũ khí</option>
                        <option value="shield" ${gear.type === 'shield' ? 'selected' : ''}>🛡️ Khiên</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">Frame Index (0-31)</label>
                    <input type="number" id="gear-frame-${gear.id}" value="${gear.frame_index || 0}" 
                           min="0" max="31" class="w-full p-2 border rounded-lg text-center font-bold text-purple-600">
                </div>
            </div>

            <div>
                <label class="text-xs text-gray-500 font-bold">URL ảnh</label>
                <input type="text" id="gear-url-${gear.id}" value="${gear.image_url || ''}" 
                       class="w-full p-2 border rounded-lg text-sm">
            </div>

            <div class="flex gap-2 pt-2">
                <button onclick="window.assetManager.updateGear('${gear.id}')" 
                        class="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors">
                    💾 Lưu
                </button>
                <button onclick="window.assetManager.deleteGear('${gear.id}')" 
                        class="py-2 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors">
                    🗑️
                </button>
            </div>
        `;
        
        return card;
    }

    async updateGear(id) {
        const name = document.getElementById(`gear-name-${id}`).value;
        const type = document.getElementById(`gear-type-${id}`).value;
        const frameIndex = parseInt(document.getElementById(`gear-frame-${id}`).value);
        const imageUrl = document.getElementById(`gear-url-${id}`).value;

        const { error } = await this.supabase
            .from('gear')
            .update({
                name,
                type,
                frame_index: frameIndex,
                image_url: imageUrl
            })
            .eq('id', id);

        if (error) {
            this.showToast("Lỗi cập nhật: " + error.message);
        } else {
            this.showToast("✅ Đã cập nhật Gear thành công!");
            this.loadGears();
        }
    }

    async deleteGear(id) {
        if (!confirm("Bạn có chắc muốn xóa Gear này?")) return;
        
        const { error } = await this.supabase.from('gear').delete().eq('id', id);
        
        if (error) {
            this.showToast("Lỗi xóa: " + error.message);
        } else {
            this.showToast("✅ Đã xóa Gear!");
            this.loadGears();
        }
    }

    // ===== TAB SWITCHING =====
    setupTabSwitching() {
        const btnHeroes = document.getElementById('btn-show-heroes');
        const btnMonsters = document.getElementById('btn-show-monsters');
        const btnGears = document.getElementById('btn-show-gears');
    
        if (btnHeroes) {
            btnHeroes.addEventListener('click', () => {
                this.setActiveAssetTab('heroes');
            });
        }
        if (btnMonsters) {
            btnMonsters.addEventListener('click', () => {
                this.setActiveAssetTab('monsters');
            });
        }
        if (btnGears) {
            btnGears.addEventListener('click', () => {
                this.setActiveAssetTab('gears');
            });
        }
    }

    setActiveAssetTab(tabName) {
        const tabs = ['heroes', 'monsters', 'gears'];
        tabs.forEach(tab => {
            const btn = document.getElementById(`btn-show-${tab}`);
            if (btn) {
                if (tab === tabName) {
                    btn.className = 'asset-tab px-6 py-2 rounded-lg bg-blue-500 text-white font-bold transition-all';
                } else {
                    btn.className = 'asset-tab px-6 py-2 rounded-lg text-gray-500 font-bold hover:bg-gray-200 transition-all';
                }
            }
        });
    }

    // ===== HELPER FUNCTIONS =====
    async loadStationsForUnlock() {
        const { data: stations } = await this.supabase
            .from('stations')
            .select('id, name, order_index, locations(name)')
            .order('order_index');
        
        const select = document.getElementById('hero-unlock-station');
        if (select && stations) {
            select.innerHTML = '<option value="">Hero mặc định (không khóa)</option>' +
                stations.map(st => 
                    `<option value="${st.id}">${st.locations?.name} - Chặng ${st.order_index}: ${st.name}</option>`
                ).join('');
        }
    }

    async loadLocationsForMonster() {
        const { data: locations } = await this.supabase
            .from('locations')
            .select('id, name')
            .order('order_index');
        
        const select = document.getElementById('monster-location');
        if (select && locations) {
            select.innerHTML = '<option value="">-- Tất cả vùng --</option>' +
                locations.map(loc => 
                    `<option value="${loc.id}">${loc.name}</option>`
                ).join('');
        }
    }

    showToast(message, duration = 3000) {
        const toast = document.getElementById("toast");
        if (!toast) return;

        toast.innerText = message;
        toast.classList.remove("hidden");
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
            toast.classList.add("hidden");
        }, duration);
    }

    /**
     * Hiển thị search filters khi chọn tab
     */
    setActiveAssetTab(tabName) {
        const tabs = ['heroes', 'monsters', 'gears'];
        tabs.forEach(tab => {
            const btn = document.getElementById(`btn-show-${tab}`);
            if (btn) {
                if (tab === tabName) {
                    btn.className = 'asset-tab px-6 py-2 rounded-lg bg-blue-500 text-white font-bold transition-all';
                } else {
                    btn.className = 'asset-tab px-6 py-2 rounded-lg text-gray-500 font-bold hover:bg-gray-200 transition-all';
                }
            }
        });

        // ✅ Hiển thị search filters
        const searchArea = document.getElementById('asset-search-filters');
        if (searchArea) {
            searchArea.classList.remove('hidden');
        }

        // ✅ Hiển thị monster filters nếu là tab monster
        const monsterFilters = document.getElementById('monster-filters');
        if (monsterFilters) {
            if (tabName === 'monsters') {
                monsterFilters.classList.remove('hidden');
                this.loadLocationsForFilter(); // Load locations vào dropdown
            } else {
                monsterFilters.classList.add('hidden');
            }
        }

        // ✅ Clear grid và đặt lại current tab
        const container = document.getElementById('asset-grid-container');
        if (container) {
            container.innerHTML = '<p class="text-gray-400 italic text-center col-span-full">📋 Nhập từ khóa và nhấn "Tìm kiếm"</p>';
        }

        this.currentAssetTab = tabName;
    }

    /**
     * Load locations vào filter dropdown
     */
    async loadLocationsForFilter() {
        const { data: locations } = await this.supabase
            .from('locations')
            .select('id, name')
            .order('order_index');
        
        const select = document.getElementById('filter-monster-location');
        if (select && locations) {
            select.innerHTML = '<option value="">-- Tất cả vùng --</option>' +
                locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
        }
    }

    /**
     * Tìm kiếm assets
     */
    async search() {
        if (!this.currentAssetTab) {
            alert('Vui lòng chọn tab (Heroes/Monsters/Gears) trước!');
            return;
        }

        const keyword = document.getElementById('search-asset-name')?.value.toLowerCase().trim() || '';

        if (this.currentAssetTab === 'heroes') {
            await this.searchHeroes(keyword);
        } else if (this.currentAssetTab === 'monsters') {
            await this.searchMonsters(keyword);
        } else if (this.currentAssetTab === 'gears') {
            await this.searchGears(keyword);
        }
    }

    /**
     * Tìm kiếm Heroes
     */
    async searchHeroes(keyword) {
        let query = this.supabase
            .from('heroes')
            .select(`*, stations:unlock_station_id (id, name, order_index, locations(name))`);

        if (keyword) {
            query = query.ilike('name', `%${keyword}%`);
        }

        const { data: heroes, error } = await query.order('created_at', { ascending: false });

        if (error) {
            this.showToast('Lỗi: ' + error.message);
            return;
        }

        const { data: allStations } = await this.supabase
            .from('stations')
            .select('id, name, order_index, locations(name)')
            .order('order_index');

        const container = document.getElementById('asset-grid-container');
        container.innerHTML = '';

        if (heroes.length === 0) {
            container.innerHTML = '<p class="text-gray-400 italic col-span-full text-center">Không tìm thấy Hero nào</p>';
            return;
        }

        heroes.forEach(hero => {
            const card = this.createHeroCard(hero, allStations);
            container.appendChild(card);
        });
    }

    /**
     * Tìm kiếm Monsters (có filters)
     */
    async searchMonsters(keyword) {
        const typeFilter = document.getElementById('filter-monster-type')?.value || '';
        const locationFilter = document.getElementById('filter-monster-location')?.value || '';

        let query = this.supabase
            .from('monsters')
            .select(`*, locations:location_id (name)`);

        if (keyword) {
            query = query.ilike('name', `%${keyword}%`);
        }

        if (typeFilter) {
            query = query.eq('type', typeFilter);
        }

        if (locationFilter) {
            query = query.eq('location_id', locationFilter);
        }

        const { data: monsters, error } = await query.order('created_at', { ascending: false });

        if (error) {
            this.showToast('Lỗi: ' + error.message);
            return;
        }

        const { data: allLocations } = await this.supabase
            .from('locations')
            .select('id, name, order_index')
            .order('order_index');

        const container = document.getElementById('asset-grid-container');
        container.innerHTML = '';

        if (monsters.length === 0) {
            container.innerHTML = '<p class="text-gray-400 italic col-span-full text-center">Không tìm thấy Monster nào</p>';
            return;
        }

        monsters.forEach(monster => {
            const card = this.createMonsterCard(monster, allLocations);
            container.appendChild(card);
        });
    }

    /**
     * Tìm kiếm Gears
     */
    async searchGears(keyword) {
        let query = this.supabase.from('gear').select('*');

        if (keyword) {
            query = query.ilike('name', `%${keyword}%`);
        }

        const { data: gears, error } = await query.order('created_at', { ascending: false });

        if (error) {
            this.showToast('Lỗi: ' + error.message);
            return;
        }

        const container = document.getElementById('asset-grid-container');
        container.innerHTML = '';

        if (gears.length === 0) {
            container.innerHTML = '<p class="text-gray-400 italic col-span-full text-center">Không tìm thấy Gear nào</p>';
            return;
        }

        gears.forEach(gear => {
            const card = this.createGearCard(gear);
            container.appendChild(card);
        });
    }
}   