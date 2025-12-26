import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Khởi tạo Supabase (Đảm bảo bạn đã có file .env đúng chuẩn)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const fileInput = document.getElementById('excel-file');
const uploadBtn = document.getElementById('upload-btn');
const statusDiv = document.getElementById('status');

// Dòng 14: Các phần tử giao diện mới
const searchEn = document.getElementById('search-en');
const searchVi = document.getElementById('search-vi');
const categorySelect = document.getElementById('category-select');
const editGrid = document.getElementById('edit-grid');

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
            // Dòng 31: Chuyển dữ liệu Excel thành mảng JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            let successCount = 0;
            let errorCount = 0;
            let duplicateCount = 0;
            let logMessages = [];

            for (const item of jsonData) {
                // Dòng 40: Thực hiện chèn từng dòng vào table 'vocabulary'
                const { error } = await supabase
                    .from('vocabulary')
                    .insert([{
                        english_word: item.english_word,           // Lấy từ cột A trong Excel
                        vietnamese_translation: item.vietnamese_translation, // Lấy từ cột B trong Excel
                        category: item.category            // Lấy từ cột C trong Excel
                    }]);

                if (error) {
                    // Kiểm tra lỗi trùng (mã 23505 thường là Unique Violation trong Postgres)
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

            // Dòng 58: Hiển thị tổng hợp kết quả
            statusDiv.innerText = `Hoàn thành!
            - Thành công: ${successCount}
            - Trùng (bỏ qua): ${duplicateCount}
            - Lỗi khác: ${errorCount}
            ${logMessages.join('\n')}`;

        } catch (err) {
            statusDiv.innerText = "Lỗi hệ thống: " + err.message;
        }
    };
    reader.readAsArrayBuffer(file);
    loadCategories();  
});
// Hàm lấy danh sách Category duy nhất để bỏ vào Dropdown
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
    // Giữ lại 4 ô header đầu tiên
    const headers = Array.from(editGrid.querySelectorAll('.grid-header'));
    editGrid.innerHTML = '';
    headers.forEach(h => editGrid.appendChild(h));

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'grid-row';
        row.innerHTML = `
            <input type="text" value="${item.english_word}" id="en-${item.id}">
            <input type="text" value="${item.vietnamese_translation}" id="vi-${item.id}">
            <input type="text" value="${item.category}" id="cat-${item.id}">
            <button onclick="window.saveRow('${item.id}')">Lưu</button>
        `;
        editGrid.appendChild(row);
    });
}

// Hàm tìm kiếm tổng hợp
async function performSearch() {
    let query = supabase.from('vocabulary').select('*');

    if (searchEn.value) query = query.ilike('english_word', `%${searchEn.value}%`);
    if (searchVi.value) query = query.ilike('vietnamese_translation', `%${searchVi.value}%`);
    if (categorySelect.value) query = query.eq('category', categorySelect.value);

    const { data, error } = await query.limit(20);
    if (data) displayGrid(data);
}

// Gán sự kiện Live Search
searchEn.addEventListener('input', performSearch);
searchVi.addEventListener('input', performSearch);
categorySelect.addEventListener('change', performSearch);

// Hàm lưu dữ liệu khi nhấn nút Lưu
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

    if (error) alert("Lỗi khi lưu: " + error.message);
    else alert("Đã lưu thành công!");
};

// Chạy lần đầu khi load trang
loadCategories();

