// grammar_manager.js
import * as XLSX from 'xlsx';

export class GrammarManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.fileInput = document.getElementById('grammar-excel-file');
        this.uploadBtn = document.getElementById('grammar-upload-btn');
        this.statusEl = document.getElementById('grammar-upload-status');
    }

    init() {
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', async () => {
                await this.handleUpload();
            });
        }
    }

    async handleUpload() {
        const file = this.fileInput.files[0];

        if (!file) {
            this.setStatus("❌ Vui lòng chọn file Excel!");
            return;
        }

        try {
            this.setStatus("⏳ Đang đọc file Excel...");

            const workbook = await this.readExcel(file);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);

            this.setStatus(`📊 Đọc được ${rows.length} dòng dữ liệu từ Excel.`);

            // Upload lên Supabase (bảng words)
            await this.uploadToSupabase(rows);

            this.setStatus("✅ Upload thành công lên Supabase!");
        } catch (err) {
            console.error("Lỗi upload Grammar:", err);
            this.setStatus("❌ Có lỗi xảy ra khi upload!");
        }
    }

    async readExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                resolve(workbook);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    async uploadToSupabase(rows) {
        // Insert dữ liệu vào bảng words
        const { data, error } = await this.supabase
            .from('words')
            .insert(
                rows.map(row => ({
                    word: row.word || row.english_word || '',
                    part_of_speech: row.part_of_speech || null,
                    semantic_category: row.semantic_category || null,
                    is_countable: row.is_countable ?? null,
                    base_form: row.base_form || null,
                    past_simple: row.past_simple || null,
                    past_participle: row.past_participle || null,
                    present_participle: row.present_participle || null,
                    third_person_singular: row.third_person_singular || null,
                    is_irregular: row.is_irregular ?? null,
                }))
            );

        if (error) {
            throw error;
        }
        return data;
    }

    setStatus(msg) {
        if (this.statusEl) {
            this.statusEl.textContent = msg;
        }
    }
}