// vocab_manager.js
export class VocabManager {
  constructor(supabase) {
      this.supabase = supabase;
      this.searchEn = null;
      this.searchVi = null;
      this.categorySelect = null;
      this.editGrid = null;
  }

  // Khởi tạo các elements và event listeners
  init() {
      this.searchEn = document.getElementById('search-en');
      this.searchVi = document.getElementById('search-vi');
      this.categorySelect = document.getElementById('category-select');
      this.editGrid = document.getElementById('edit-grid');

      if (this.searchEn) this.searchEn.addEventListener('input', () => this.performSearch());
      if (this.searchVi) this.searchVi.addEventListener('input', () => this.performSearch());
      if (this.categorySelect) this.categorySelect.addEventListener('change', () => this.performSearch());

      // Load categories ban đầu
      this.loadCategories();
      this.displayGrid([]);
  }

  // Hàm lấy danh sách Category để bỏ vào Dropdown
  async loadCategories() {
      const { data, error } = await this.supabase
          .from('vocabulary')
          .select('category');
      
      if (data && this.categorySelect) {
          const uniqueCats = [...new Set(data.map(item => item.category))].filter(Boolean);
          this.categorySelect.innerHTML = '<option value="">-- Chọn loại --</option>';
          uniqueCats.forEach(cat => {
              const opt = document.createElement('option');
              opt.value = cat;
              opt.innerText = cat;
              this.categorySelect.appendChild(opt);
          });
      }
  }

  // Hàm hiển thị dữ liệu vào Grid
  displayGrid(items) {
      if (!this.editGrid) return;

      // Vẽ lại Header
      this.editGrid.innerHTML = `
          <div class="font-bold text-gray-400 uppercase text-xs border-b-2 border-gray-100 pb-2">Tiếng Anh</div>
          <div class="font-bold text-gray-400 uppercase text-xs border-b-2 border-gray-100 pb-2">Tiếng Việt</div>
          <div class="font-bold text-gray-400 uppercase text-xs border-b-2 border-gray-100 pb-2">Category</div>
          <div class="font-bold text-gray-400 uppercase text-xs border-b-2 border-gray-100 pb-2">Thao tác</div>
      `;

      // Nếu không có dữ liệu
      if (!items || items.length === 0) {
          const msg = document.createElement('div');
          msg.style.gridColumn = "span 4";
          msg.style.padding = "20px";
          msg.style.textAlign = "center";
          msg.style.color = "#999";
          msg.style.fontStyle = "italic";
          
          const hasSearch = (this.searchEn?.value.trim() !== "") || 
                           (this.searchVi?.value.trim() !== "") || 
                           (this.categorySelect?.value !== "");
          
          msg.innerText = hasSearch 
              ? "❌ Không tìm thấy kết quả phù hợp." 
              : "💡 Nhập từ khóa (Tiếng Anh/Tiếng Việt) hoặc chọn Category để tìm kiếm.";
          
          this.editGrid.appendChild(msg);
          return;
      }

      // Đổ dữ liệu vào
      items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'grid-row';
          row.style.display = 'contents';
          row.innerHTML = `
              <input type="text" value="${item.english_word || ''}" id="en-${item.id}" class="p-3 rounded-xl border-2 border-gray-100 outline-none focus:border-blue-400">
              <input type="text" value="${item.vietnamese_translation || ''}" id="vi-${item.id}" class="p-3 rounded-xl border-2 border-gray-100 outline-none focus:border-blue-400">
              <input type="text" value="${item.category || ''}" id="cat-${item.id}" class="p-3 rounded-xl border-2 border-gray-100 outline-none focus:border-blue-400">
              <div class="flex gap-1">
                  <button class="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600" onclick="window.vocabManager.saveRow('${item.id}')">Lưu</button>
                  <button class="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600" onclick="window.vocabManager.deleteRow('${item.id}')">Xóa</button>
              </div>
          `;
          this.editGrid.appendChild(row);
      });
  }

  // Hàm tìm kiếm
  async performSearch() {
      try {
          let query = this.supabase.from('vocabulary').select('*');
          let hasFilter = false;

          // Kiểm tra nếu có nhập Tiếng Anh
          if (this.searchEn && this.searchEn.value.trim() !== "") {
              query = query.ilike('english_word', `%${this.searchEn.value.trim()}%`);
              hasFilter = true;
          }
          
          // Kiểm tra nếu có nhập Tiếng Việt
          if (this.searchVi && this.searchVi.value.trim() !== "") {
              query = query.ilike('vietnamese_translation', `%${this.searchVi.value.trim()}%`);
              hasFilter = true;
          }
          
          // Kiểm tra nếu có chọn Category
          if (this.categorySelect && this.categorySelect.value !== "") {
              query = query.eq('category', this.categorySelect.value);
              hasFilter = true;
          }

          // Nếu không có điều kiện lọc nào, hiển thị grid rỗng
          if (!hasFilter) {
              this.displayGrid([]);
              return;
          }

          const { data, error } = await query.limit(50);

          if (error) {
              console.error("Lỗi tìm kiếm:", error.message);
              return;
          }

          if (data) {
              this.displayGrid(data);
          }
      } catch (err) {
          console.error("Hệ thống gặp lỗi:", err);
      }
  }

  // Hàm xóa dòng
  async deleteRow(id) {
      if (!confirm("Bạn có chắc chắn muốn xóa từ này không?")) return;

      const { error } = await this.supabase
          .from('vocabulary')
          .delete()
          .eq('id', id);

      if (error) {
          this.showToast("Lỗi khi xóa: " + error.message);
      } else {
          this.showToast("Đã xóa thành công!");
          this.performSearch();
      }
  }

  // Hàm lưu chỉnh sửa
  async saveRow(id) {
      const newEn = document.getElementById(`en-${id}`).value;
      const newVi = document.getElementById(`vi-${id}`).value;
      const newCat = document.getElementById(`cat-${id}`).value;

      const { error } = await this.supabase
          .from('vocabulary')
          .update({ 
              english_word: newEn, 
              vietnamese_translation: newVi, 
              category: newCat 
          })
          .eq('id', id);

      if (error) {
          this.showToast("Lỗi khi lưu: " + error.message);
      } else {
          this.showToast("Đã lưu thành công!");
          this.performSearch();
      }
  }

  // Hàm upload Excel
  async uploadExcel(file) {
      const statusDiv = document.getElementById('status');
      if (!statusDiv) return;

      statusDiv.innerText = "Đang đọc file và xử lý...";

      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
              try {
                  // Import XLSX nếu cần
                  const XLSX = await import('xlsx');
                  
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
                      const { error } = await this.supabase
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
                  await this.loadCategories();
                  resolve();

              } catch (err) {
                  statusDiv.innerText = "Lỗi hệ thống: " + err.message;
                  reject(err);
              }
          };
          reader.readAsArrayBuffer(file);
      });
  }

  // Toast notification
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
}
