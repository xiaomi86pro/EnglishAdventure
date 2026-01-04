import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Khởi tạo Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey =import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)
window.supabase = supabase;

const fileInput = document.getElementById('excel-file');
const uploadBtn = document.getElementById('upload-btn');
const statusDiv = document.getElementById('status');

if (window.AuthComponent) {
    AuthComponent.init(supabase);
}

let searchEn, searchVi, categorySelect, editGrid;

function initSearchElements() {
    searchEn = document.getElementById('search-en');
    searchVi = document.getElementById('search-vi');
    categorySelect = document.getElementById('category-select');
    editGrid = document.getElementById('edit-grid');

    if (searchEn) searchEn.addEventListener('input', performSearch);
    if (searchVi) searchVi.addEventListener('input', performSearch);
    if (categorySelect) categorySelect.addEventListener('change', performSearch);
}

uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        statusDiv.innerText = "Vui lòng chọn một file Excel trước!";
        return;
    }

    statusDiv.innerText = "Đang đọc file và xử lý...";

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            let successCount = 0;
            let errorCount = 0;
            let duplicateCount = 0;
            let logMessages = [];

            for (const item of jsonData) {
                const { error } = await supabase
                    .from('vocabulary')
                    .insert([{
                        english_word: item.english_word,
                        vietnamese_translation: item.vietnamese_translation,
                        category: item.category
                    }]);

                if (error) {
                    if (error.code === '23505') {
                        duplicateCount++;
                    } else {
                        errorCount++;
                        logMessages.push(`Lỗi từ "${item.english_word || 'không tên'}": ${error.message}`);
                    }
                } else {
                    successCount++;
                }
            }

            statusDiv.innerText = `Hoàn thành!
- Thành công: ${successCount}
- Trùng (bỏ qua): ${duplicateCount}
- Lỗi khác: ${errorCount}
${logMessages.join('\n')}`;

            // Load lại categories sau khi upload thành công
            await loadCategories();

        } catch (err) {
            statusDiv.innerText = "Lỗi hệ thống: " + err.message;
        }
    };
    reader.readAsArrayBuffer(file);
});

// Hàm lấy danh sách Category để bỏ vào Dropdown
async function loadCategories() {
    const { data, error } = await supabase
        .from('vocabulary')
        .select('category');
    
    if (data) {
        const uniqueCats = [...new Set(data.map(item => item.category))].filter(Boolean);
        categorySelect.innerHTML = '<option value="">-- Chọn loại --</option>';
        uniqueCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            categorySelect.appendChild(opt);
        });
    }
}

// Load locations vào dropdown monster form
async function loadLocationsForMonster() {
    const { data: locations } = await supabase
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

// Gọi khi load trang
window.addEventListener('DOMContentLoaded', () => {
    loadStationsForUnlock();  // Đã có
    loadLocationsForMonster();  // ✅ Thêm dòng này
});

// Hàm hiển thị dữ liệu vào Grid
function displayGrid(items) {
    if (!editGrid) return;

    // Vẽ lại Header
    editGrid.innerHTML = `
        <div class="grid-header">Tiếng Anh</div>
        <div class="grid-header">Tiếng Việt</div>
        <div class="grid-header">Category</div>
        <div class="grid-header">Thao tác</div>
    `;

    // Nếu không có dữ liệu
    if (!items || items.length === 0) {
        const msg = document.createElement('div');
        msg.style.gridColumn = "span 4";
        msg.style.padding = "20px";
        msg.style.textAlign = "center";
        msg.style.color = "#999";
        msg.style.fontStyle = "italic";
        
        // Kiểm tra xem có điều kiện tìm kiếm nào không
        const hasSearch = (searchEn?.value.trim() !== "") || 
                         (searchVi?.value.trim() !== "") || 
                         (categorySelect?.value !== "");
        
        msg.innerText = hasSearch 
            ? "❌ Không tìm thấy kết quả phù hợp." 
            : "💡 Nhập từ khóa (Tiếng Anh/Tiếng Việt) hoặc chọn Category để tìm kiếm.";
        
        editGrid.appendChild(msg);
        return;
    }

    // Đổ dữ liệu vào
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'grid-row';
        row.style.display = 'contents';
        row.innerHTML = `
            <input type="text" value="${item.english_word || ''}" id="en-${item.id}">
            <input type="text" value="${item.vietnamese_translation || ''}" id="vi-${item.id}">
            <input type="text" value="${item.category || ''}" id="cat-${item.id}">
            <div class="flex gap-1">
                <button class="btn-save" onclick="window.saveRow('${item.id}')">Lưu</button>
                <button class="btn-delete" onclick="window.deleteRow('${item.id}')">Xóa</button>
            </div>
        `;
        editGrid.appendChild(row);
    });
}

// Hàm tìm kiếm
async function performSearch() {
    try {
        let query = supabase.from('vocabulary').select('*');
        let hasFilter = false;

        // Kiểm tra nếu có nhập Tiếng Anh
        if (searchEn && searchEn.value.trim() !== "") {
            query = query.ilike('english_word', `%${searchEn.value.trim()}%`);
            hasFilter = true;
        }
        
        // Kiểm tra nếu có nhập Tiếng Việt
        if (searchVi && searchVi.value.trim() !== "") {
            query = query.ilike('vietnamese_translation', `%${searchVi.value.trim()}%`);
            hasFilter = true;
        }
        
        // Kiểm tra nếu có chọn Category
        if (categorySelect && categorySelect.value !== "") {
            query = query.eq('category', categorySelect.value);
            hasFilter = true;
        }

        // Nếu không có điều kiện lọc nào, hiển thị grid rỗng
        if (!hasFilter) {
            displayGrid([]);
            return;
        }

        const { data, error } = await query.limit(50);

        if (error) {
            console.error("Lỗi tìm kiếm:", error.message);
            return;
        }

        if (data) {
            displayGrid(data);
        }
    } catch (err) {
        console.error("Hệ thống gặp lỗi:", err);
    }
}

// Hàm xóa dòng
window.deleteRow = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn xóa từ này không?")) return;

    const { error } = await supabase
        .from('vocabulary')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Lỗi khi xóa: " + error.message);
    } else {
        alert("Đã xóa thành công!");
        performSearch(); // Tải lại danh sách sau khi xóa
    }
};

// Hàm lưu chỉnh sửa
window.saveRow = async (id) => {
    const newEn = document.getElementById(`en-${id}`).value;
    const newVi = document.getElementById(`vi-${id}`).value;
    const newCat = document.getElementById(`cat-${id}`).value;

    const { error } = await supabase
        .from('vocabulary')
        .update({ 
            english_word: newEn, 
            vietnamese_translation: newVi, 
            category: newCat 
        })
        .eq('id', id);

    if (error) {
        alert("Lỗi khi lưu: " + error.message);
    } else {
        alert("Đã lưu thành công!");
        performSearch(); // Cập nhật lại bảng sau khi lưu
    }
};

// Khởi động hệ thống
async function startAdminSystem() {
    initSearchElements(); 
    await loadCategories();
    
    // Hiển thị grid rỗng với thông báo hướng dẫn
    displayGrid([]);
    
    console.log("Hệ thống quản trị đã sẵn sàng!");
}

// Load danh sách stations để chọn unlock condition
async function loadStationsForUnlock() {
    const { data: stations } = await supabase
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

// Gọi khi load trang admin
loadStationsForUnlock();

// Xử lý sự kiện nhấn nút "Lưu Hero"
const saveHeroBtn = document.getElementById('save-hero-btn');
if (saveHeroBtn) {
    saveHeroBtn.addEventListener('click', async () => {
        const name = document.getElementById('hero-name').value;
        const hp = parseInt(document.getElementById('hero-hp').value) || 100;  
        const atk = parseInt(document.getElementById('hero-atk').value) || 10;  
        const def = parseInt(document.getElementById('hero-def').value) || 5; 
        const heroFile = document.getElementById('hero-file').files[0];
        const heroUrlInput = document.getElementById('hero-url').value;
        const isLocked = document.getElementById('hero-locked').checked;  
        const unlockStationId = document.getElementById('hero-unlock-station').value || null;  

        if (!name) return alert("Vui lòng nhập tên Hero!");

        try {
            saveHeroBtn.innerText = "Đang xử lý...";
            saveHeroBtn.disabled = true;

            let finalUrl = heroUrlInput;

            // Nếu có chọn file, ưu tiên upload file lên Storage
            if (heroFile) {
                finalUrl = await uploadAsset(heroFile, 'heroes');
            }

            const { error } = await supabase
                .from('heroes')
                .insert([{
                    name: name,
                    image_url: finalUrl,
                    base_hp: hp, 
                    base_atk: atk,
                    base_def: atk,
                    is_locked: isLocked,  
                    unlock_station_id: unlockStationId  
                }]);

            if (error) throw error;
            //alert("Lưu Hero thành công!");
            
        } catch (err) {
            alert("Lỗi: " + err.message);
        } finally {
            saveHeroBtn.innerText = "Lưu Hero";
            saveHeroBtn.disabled = false;
        }
    });
}

// 1. Hàm upload ảnh tùy chỉnh theo cấu trúc của bạn
async function uploadAsset(file, subFolder) {
    // subFolder sẽ là 'heroes' hoặc 'monsters'
    const fileExt = file.name.split('.').pop();
    const fileName = `hero_${Date.now()}.${fileExt}`; // Tạo tên file unique
    const filePath = `${subFolder}/${fileName}`; 

    // Chú ý: Tên Bucket phải khớp chính xác với tên bạn tạo trên Supabase (ví dụ: 'Assets')
    const { data, error } = await supabase.storage
        .from('Assets') 
        .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
        .from('Assets')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

// 2. Logic lưu Monster (Dán dưới phần lưu Hero)
const saveMonsterBtn = document.getElementById('save-monster-btn');
if (saveMonsterBtn) {
    saveMonsterBtn.addEventListener('click', async () => {
        const name = document.getElementById('monster-name').value;
        const hp = parseInt(document.getElementById('monster-hp').value) || 50;
        const atk = parseInt(document.getElementById('monster-atk').value) || 5;
        const def = parseInt(document.getElementById('monster-def').value) || 0;
        const exp = parseInt(document.getElementById('monster-exp').value) || 10;
        const type = document.getElementById('monster-type').value;
        const locationId = document.getElementById('monster-location').value || null;
        const monsterFile = document.getElementById('monster-file').files[0];
        const monsterUrlInput = document.getElementById('monster-url').value;

        if (!name) return alert("Vui lòng nhập tên Quái vật!");

        try {
            saveMonsterBtn.innerText = "Đang lưu...";
            saveMonsterBtn.disabled = true;

            let finalUrl = monsterUrlInput;
            if (monsterFile) {
                finalUrl = await uploadAsset(monsterFile, 'monsters');
            }

            const { error } = await supabase
                .from('monsters')
                .insert([{
                    name: name,
                    type: type,
                    image_url: finalUrl,
                    base_hp: hp,
                    base_atk: atk,
                    base_def: def,
                    exp_reward: exp,
                    location_id: locationId
                }]);

            if (error) throw error;
            alert("Lưu Quái vật thành công!");
            
            // Reset form
            document.getElementById('monster-name').value = '';
            document.getElementById('monster-hp').value = '50';
            document.getElementById('monster-atk').value = '5';
            document.getElementById('monster-def').value = '0';
            document.getElementById('monster-exp').value = '10';
            document.getElementById('monster-url').value = '';
            
            loadMonsters();  // Reload danh sách
            
        } catch (err) {
            alert("Lỗi: " + err.message);
        } finally {
            saveMonsterBtn.innerText = "Lưu Quái vật";
            saveMonsterBtn.disabled = false;
        }
    });
} 

// Hàm tải và hiển thị danh sách tài nguyên
// ===== HERO MANAGEMENT =====
async function loadHeroes() {
    const container = document.getElementById('asset-grid-container');
    container.innerHTML = '<p class="text-gray-500">Đang tải Heroes...</p>';

    // Load heroes kèm thông tin unlock station
    const { data: heroes, error } = await supabase
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

    // Load danh sách stations để cho dropdown
    const { data: allStations } = await supabase
        .from('stations')
        .select('id, name, order_index, locations(name)')
        .order('order_index');

    container.innerHTML = ''; // Xóa loading

    heroes.forEach(hero => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-blue-200 shadow-sm space-y-3";
        
        const unlockInfo = hero.stations 
            ? `${hero.stations.locations?.name || '?'} - ${hero.stations.name}`
            : 'Không khóa';
        
        card.innerHTML = `
            <!-- Header với ảnh và thông tin cơ bản -->
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

            <!-- Chỉ số -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-500 font-bold">❤️ HP</label>
                    <input type="number" 
                           id="hero-hp-${hero.id}" 
                           value="${hero.base_hp || 100}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-red-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">⚔️ ATK</label>
                    <input type="number" 
                           id="hero-atk-${hero.id}" 
                           value="${hero.base_atk || 10}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-orange-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">🛡️ DEF</label>
                    <input type="number" 
                        id="hero-def-${hero.id}" 
                        value="${hero.base_def || 5}" 
                        class="w-full p-2 border rounded-lg text-center font-bold text-blue-600">
                </div>
            </div>

            <!-- Cấu hình khóa -->
            <div class="bg-blue-50 p-3 rounded-lg space-y-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" 
                           id="hero-locked-${hero.id}" 
                           ${hero.is_locked ? 'checked' : ''}
                           class="w-4 h-4">
                    <label for="hero-locked-${hero.id}" class="text-sm font-bold">🔒 Khóa hero này</label>
                </div>
                
                <select id="hero-unlock-${hero.id}" 
                        class="w-full p-2 border rounded-lg text-sm bg-white"
                        ${!hero.is_locked ? 'disabled' : ''}>
                    <option value="">-- Chọn chặng để unlock --</option>
                    ${allStations?.map(st => `
                        <option value="${st.id}" ${hero.unlock_station_id === st.id ? 'selected' : ''}>
                            ${st.locations?.name || '?'} - Chặng ${st.order_index}: ${st.name}
                        </option>
                    `).join('') || ''}
                </select>
            </div>

            <!-- Nút hành động -->
            <div class="flex gap-2 pt-2">
                <button onclick="updateHero('${hero.id}')" 
                        class="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors">
                    💾 Lưu
                </button>
                <button onclick="deleteHero('${hero.id}')" 
                        class="py-2 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors">
                    🗑️
                </button>
            </div>
        `;
        
        // Gắn sự kiện checkbox
        const checkbox = card.querySelector(`#hero-locked-${hero.id}`);
        const dropdown = card.querySelector(`#hero-unlock-${hero.id}`);
        checkbox.addEventListener('change', () => {
            dropdown.disabled = !checkbox.checked;
            if (!checkbox.checked) dropdown.value = '';
        });
        
        container.appendChild(card);
    });
}

// ===== MONSTER MANAGEMENT =====
async function loadMonsters() {
    const container = document.getElementById('asset-grid-container');
    container.innerHTML = '<p class="text-gray-500">Đang tải Monsters...</p>';

    // Load monsters kèm location
    const { data: monsters, error } = await supabase
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

    // Load danh sách locations
    const { data: allLocations } = await supabase
        .from('locations')
        .select('id, name, order_index')
        .order('order_index');

    container.innerHTML = '';

    monsters.forEach(monster => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-red-200 shadow-sm space-y-3";
        
        const typeColors = {
            'normal': 'bg-gray-100 text-gray-700',
            'elite': 'bg-yellow-100 text-yellow-700',
            'boss': 'bg-red-100 text-red-700',
            'final boss': 'bg-purple-100 text-purple-700'
        };
        
        card.innerHTML = `
            <!-- Header -->
            <div class="flex items-center gap-4 pb-3 border-b border-gray-100">
                <img src="${monster.image_url}" 
                     class="w-20 h-20 object-contain bg-gray-50 rounded-lg" 
                     alt="${monster.name}">
                <div class="flex-1">
                    <input type="text" 
                           id="monster-name-${monster.id}" 
                           value="${monster.name}" 
                           class="font-bold text-xl text-gray-700 w-full border-b border-transparent focus:border-red-400 outline-none mb-1">
                    <p class="text-xs text-gray-400">ID: ${monster.id.substring(0,8)}...</p>
                    <span class="inline-block mt-1 px-2 py-1 rounded text-xs font-bold ${typeColors[monster.type] || typeColors['normal']}">
                        ${monster.type?.toUpperCase() || 'NORMAL'}
                    </span>
                </div>
            </div>

            <!-- Chỉ số -->
            <div class="grid grid-cols-3 gap-2">
                <div>
                    <label class="text-xs text-gray-500 font-bold">❤️ HP</label>
                    <input type="number" 
                           id="monster-hp-${monster.id}" 
                           value="${monster.base_hp || 50}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-red-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">⚔️ ATK</label>
                    <input type="number" 
                           id="monster-atk-${monster.id}" 
                           value="${monster.base_atk || 5}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-orange-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">🛡️ DEF</label>
                    <input type="number" 
                        id="monster-def-${monster.id}" 
                        value="${monster.base_def || 0}" 
                        class="w-full p-2 border rounded-lg text-center font-bold text-blue-600">
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">💰 EXP</label>
                    <input type="number" 
                           id="monster-exp-${monster.id}" 
                           value="${monster.exp_reward || 10}" 
                           class="w-full p-2 border rounded-lg text-center font-bold text-blue-600">
                </div>
            </div>

            <!-- Loại và Vùng -->
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs text-gray-500 font-bold">Loại</label>
                    <select id="monster-type-${monster.id}" 
                            class="w-full p-2 border rounded-lg text-sm bg-white">
                        <option value="normal" ${monster.type === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="elite" ${monster.type === 'elite' ? 'selected' : ''}>Elite</option>
                        <option value="boss" ${monster.type === 'boss' ? 'selected' : ''}>Boss</option>
                        <option value="final boss" ${monster.type === 'final boss' ? 'selected' : ''}>Final Boss</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500 font-bold">Vùng đất</label>
                    <select id="monster-location-${monster.id}" 
                            class="w-full p-2 border rounded-lg text-sm bg-white">
                        <option value="">-- Tất cả vùng --</option>
                        ${allLocations?.map(loc => `
                            <option value="${loc.id}" ${monster.location_id === loc.id ? 'selected' : ''}>
                                ${loc.name}
                            </option>
                        `).join('') || ''}
                    </select>
                </div>
            </div>

            <!-- Nút hành động -->
            <div class="flex gap-2 pt-2">
                <button onclick="updateMonster('${monster.id}')" 
                        class="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors">
                    💾 Lưu
                </button>
                <button onclick="deleteMonster('${monster.id}')" 
                        class="py-2 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors">
                    🗑️
                </button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ===== UPDATE HERO =====
window.updateHero = async (id) => {
    const name = document.getElementById(`hero-name-${id}`).value;
    const hp = parseInt(document.getElementById(`hero-hp-${id}`).value);
    const atk = parseInt(document.getElementById(`hero-atk-${id}`).value);
    const def = parseInt(document.getElementById(`hero-def-${id}`).value);
    const isLocked = document.getElementById(`hero-locked-${id}`).checked;
    const unlockStationId = document.getElementById(`hero-unlock-${id}`).value || null;

    const { error } = await supabase
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
        alert("Lỗi cập nhật: " + error.message);
    } else {
        alert("✅ Đã cập nhật Hero thành công!");
        loadHeroes();
    }
};

// ===== DELETE HERO =====
window.deleteHero = async (id) => {
    if (!confirm("Bạn có chắc muốn xóa Hero này?")) return;
    
    const { error } = await supabase
        .from('heroes')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert("Lỗi xóa: " + error.message);
    } else {
        alert("✅ Đã xóa Hero!");
        loadHeroes();
    }
};

// ===== UPDATE MONSTER =====
window.updateMonster = async (id) => {
    const name = document.getElementById(`monster-name-${id}`).value;
    const hp = parseInt(document.getElementById(`monster-hp-${id}`).value);
    const atk = parseInt(document.getElementById(`monster-atk-${id}`).value);
    const def = parseInt(document.getElementById(`monster-def-${id}`).value);
    const exp = parseInt(document.getElementById(`monster-exp-${id}`).value);
    const type = document.getElementById(`monster-type-${id}`).value;
    const locationId = document.getElementById(`monster-location-${id}`).value || null;

    const { error } = await supabase
        .from('monsters')
        .update({
            name,
            base_hp: hp,
            base_atk: atk,
            base_def: def,
            exp_reward: exp,
            type,
            location_id: locationId
        })
        .eq('id', id);

    if (error) {
        alert("Lỗi cập nhật: " + error.message);
    } else {
        alert("✅ Đã cập nhật Monster thành công!");
        loadMonsters();
    }
};

// ===== DELETE MONSTER =====
window.deleteMonster = async (id) => {
    if (!confirm("Bạn có chắc muốn xóa Monster này?")) return;
    
    const { error } = await supabase
        .from('monsters')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert("Lỗi xóa: " + error.message);
    } else {
        alert("✅ Đã xóa Monster!");
        loadMonsters();
    }
};

// Sửa sự kiện bấm nút chuyển Tab
document.getElementById('btn-show-heroes')?.addEventListener('click', () => loadHeroes());
document.getElementById('btn-show-monsters')?.addEventListener('click', () => loadMonsters());

// Load mặc định khi mở trang
loadHeroes();

startAdminSystem();

// Đảm bảo các Manager được load
window.addEventListener('DOMContentLoaded', () => {
    console.log('Admin system loaded');
    if (window.LocationManager) console.log('✓ LocationManager ready');
    if (window.StationManager) console.log('✓ StationManager ready');
    if (window.StepManager) console.log('✓ StepManager ready');
});
