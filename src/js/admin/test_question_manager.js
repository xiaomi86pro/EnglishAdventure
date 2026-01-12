// test_question_manager.js
export class TestQuestionManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    // Khởi tạo
    init() {
        this.loadQuestionTypes();
        this.setupAddButton();
    }

    // Load danh sách question types
    async loadQuestionTypes() {
        const container = document.getElementById('question-types-list');
        if (!container) return;

        try {
            const { data, error } = await this.supabase
                .from('question_types')
                .select('*')
                .order('id');

            if (error) throw error;

            if (data && data.length > 0) {
                container.innerHTML = data.map(qt => `
                    <div class="bg-gradient-to-br from-white to-gray-50 p-4 rounded-xl border-2 border-gray-200 hover:border-purple-400 transition-all shadow-sm">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex items-center gap-2">
                                <span class="text-3xl">${qt.icon}</span>
                                <div>
                                    <h4 class="font-bold text-lg">${qt.name}</h4>
                                    <p class="text-xs text-gray-500">Type ${qt.id}</p>
                                </div>
                            </div>
                            <button onclick="window.testQuestionManager.deleteQuestionType(${qt.id})" 
                                    class="text-red-500 hover:text-red-700 text-sm">
                                🗑️
                            </button>
                        </div>
                        <p class="text-sm text-gray-600 mb-3">${qt.description || ''}</p>
                        <button onclick="window.testQuestionManager.testQuestion(${qt.id})" 
                                class="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-bold text-sm">
                            ▶️ Test Question ${qt.id}
                        </button>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-gray-500 col-span-3">Chưa có loại câu hỏi nào</p>';
            }
        } catch (err) {
            console.error('Lỗi load question types:', err);
            container.innerHTML = '<p class="text-red-500 col-span-3">Lỗi: ' + err.message + '</p>';
        }
    }

    // Setup nút thêm câu hỏi
    setupAddButton() {
        // Nút này được gọi từ onclick trong HTML
        // Không cần setup ở đây
    }

    // Hiện form thêm câu hỏi
    showAddForm() {
        const form = document.getElementById('add-question-form');
        if (form) {
            form.classList.remove('hidden');
            
            // Clear inputs
            document.getElementById('new-question-id').value = '';
            document.getElementById('new-question-name').value = '';
            document.getElementById('new-question-icon').value = '';
            document.getElementById('new-question-desc').value = '';
        }
    }

    // Ẩn form
    cancelAddForm() {
        const form = document.getElementById('add-question-form');
        if (form) {
            form.classList.add('hidden');
        }
    }

    // Lưu loại câu hỏi mới
    async saveNewQuestionType() {
        const id = parseInt(document.getElementById('new-question-id').value);
        const name = document.getElementById('new-question-name').value.trim();
        const icon = document.getElementById('new-question-icon').value.trim();
        const desc = document.getElementById('new-question-desc').value.trim();

        if (!id || !name || !icon) {
            alert('Vui lòng điền đầy đủ ID, Tên và Icon!');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('question_types')
                .insert([{
                    id: id,
                    name: name,
                    icon: icon,
                    description: desc
                }]);

            if (error) throw error;

            alert('✅ Đã thêm loại câu hỏi mới!');
            this.cancelAddForm();
            this.loadQuestionTypes();
        } catch (err) {
            alert('Lỗi: ' + err.message);
        }
    }

    // Xóa loại câu hỏi
    async deleteQuestionType(id) {
        if (!confirm(`Xóa loại câu hỏi ${id}? (Lưu ý: Không xóa được nếu đang được dùng trong steps)`)) return;

        try {
            const { error } = await this.supabase
                .from('question_types')
                .delete()
                .eq('id', id);

            if (error) throw error;

            alert('✅ Đã xóa!');
            this.loadQuestionTypes();
        } catch (err) {
            alert('Lỗi: ' + err.message);
        }
    }

    // Test câu hỏi
    async testQuestion(typeNumber) {
        const area = document.getElementById('questionarea');
        if (!area) return;
        
        // Hiện loading
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4">
                <div class="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-purple-600 font-bold">Đang load Question Type ${typeNumber}...</p>
            </div>
        `;

        try {
            if (window.QuestionManager) {
                await window.QuestionManager.loadType(typeNumber);
            } else {
                throw new Error('QuestionManager chưa sẵn sàng');
            }
        } catch (err) {
            area.innerHTML = `
                <div class="text-center text-red-500">
                    <p class="font-bold text-xl mb-2">❌ Lỗi!</p>
                    <p>${err.message}</p>
                    <p class="text-sm mt-2">Có thể file <code>question${typeNumber}.js</code> chưa được tạo.</p>
                </div>
            `;
        }
    }
}

// Global functions để gọi từ HTML onclick
window.showAddQuestionForm = function() {
    if (window.testQuestionManager) {
        window.testQuestionManager.showAddForm();
    }
};

window.cancelAddQuestionForm = function() {
    if (window.testQuestionManager) {
        window.testQuestionManager.cancelAddForm();
    }
};

window.saveNewQuestionType = async function() {
    if (window.testQuestionManager) {
        await window.testQuestionManager.saveNewQuestionType();
    }
};