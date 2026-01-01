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

// Xử lý sự kiện nhấn nút "Lưu Hero"
const saveHeroBtn = document.getElementById('save-hero-btn');
if (saveHeroBtn) {
    saveHeroBtn.addEventListener('click', async () => {
        const name = document.getElementById('hero-name').value;
        const heroFile = document.getElementById('hero-file').files[0];
        const heroUrlInput = document.getElementById('hero-url').value;

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
                    base_hp: 100, // Bạn có thể thêm input để nhập số này sau
                    frame_width: 64,
                    frame_height: 64,
                    total_frames: 4 // Giả định mặc định là 4
                }]);

            if (error) throw error;
            alert("Lưu Hero thành công!");
            
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
        const type = document.getElementById('monster-type').value;
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
                    base_hp: 50,
                    total_frames: 1 // Bạn có thể thêm input để nhập số này
                }]);

            if (error) throw error;
            alert("Lưu Quái vật thành công!");
        } catch (err) {
            alert("Lỗi: " + err.message);
        } finally {
            saveMonsterBtn.innerText = "Lưu Quái vật";
            saveMonsterBtn.disabled = false;
        }
    });
} 

let currentAssetTab = 'heroes'; // Mặc định bảng đầu tiên

// Hàm tải và hiển thị danh sách tài nguyên
async function loadAssets(tableName) {
    currentAssetTab = tableName;
    const container = document.getElementById('asset-grid-container');
    container.innerHTML = '<p class="text-gray-500">Đang tải dữ liệu...</p>';

    const { data, error } = await supabase.from(tableName).select('*').order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-red-500">Lỗi: ${error.message}</p>`;
        return;
    }

    container.innerHTML = ''; // Xóa thông báo loading

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm space-y-3";
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <img src="${item.image_url}" class="w-16 h-16 object-contain bg-gray-50 rounded-lg" alt="${item.name}">
                <div class="flex-1">
                    <input type="text" id="name-${item.id}" value="${item.name}" class="font-bold text-gray-700 w-full border-b border-transparent focus:border-blue-400 outline-none">
                    <p class="text-xs text-gray-400">ID: ${item.id.substring(0,8)}...</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                    <label class="text-xs text-gray-400">HP</label>
                    <input type="number" id="hp-${item.id}" value="${item.base_hp || 0}" class="w-full p-1 border rounded">
                </div>
                <div>
                    <label class="text-xs text-gray-400">ATK</label>
                    <input type="number" id="atk-${item.id}" value="${item.base_atk || 0}" class="w-full p-1 border rounded">
                </div>
                <div>
                    <label class="text-xs text-gray-400">Frames</label>
                    <input type="number" id="frames-${item.id}" value="${item.total_frames || 1}" class="w-full p-1 border rounded">
                </div>
                <div>
                    <label class="text-xs text-gray-400">Loại (nếu có)</label>
                    <input type="text" id="type-${item.id}" value="${item.type || ''}" class="w-full p-1 border rounded">
                </div>
            </div>
            <div class="flex gap-2 pt-2">
                <button onclick="updateAsset('${item.id}')" class="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600">Lưu sửa</button>
                <button onclick="deleteAsset('${item.id}')" class="py-2 px-3 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200">Xóa</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Hàm cập nhật chỉ số
window.updateAsset = async (id) => {
    const updateData = {
        name: document.getElementById(`name-${id}`).value,
        base_hp: parseInt(document.getElementById(`hp-${id}`).value),
        base_atk: parseInt(document.getElementById(`atk-${id}`).value),
        total_frames: parseInt(document.getElementById(`frames-${id}`).value),
    };

    const { error } = await supabase.from(currentAssetTab).update(updateData).eq('id', id);

    if (error) alert("Lỗi cập nhật: " + error.message);
    else alert("Đã cập nhật chỉ số thành công!");
};

// Hàm xóa tài nguyên
window.deleteAsset = async (id) => {
    if(!confirm("Bạn có chắc muốn xóa tài nguyên này?")) return;
    const { error } = await supabase.from(currentAssetTab).delete().eq('id', id);
    if (error) alert("Lỗi khi xóa: " + error.message);
    else loadAssets(currentAssetTab);
};

// Sự kiện bấm nút chuyển Tab
document.getElementById('btn-show-heroes')?.addEventListener('click', () => loadAssets('heroes'));
document.getElementById('btn-show-monsters')?.addEventListener('click', () => loadAssets('monsters'));

// Load mặc định khi mở trang
loadAssets('heroes');

startAdminSystem();