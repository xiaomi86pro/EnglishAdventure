import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Khởi tạo Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const fileInput = document.getElementById('excel-file');
const uploadBtn = document.getElementById('upload-btn');
const statusDiv = document.getElementById('status');

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
            <button onclick="window.saveRow('${item.id}')">Lưu</button>
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

startAdminSystem();