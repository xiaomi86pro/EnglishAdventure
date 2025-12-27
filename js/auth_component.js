/**
 * Component xử lý giao diện chọn User đầu game
 * Kết nối trực tiếp với Supabase qua biến toàn cục window.supabase
 */
const AuthComponent = {
    selectedUserId: null, 
    containerId: 'questionarea',
    
    // Danh sách Avatar có sẵn
    availableAvatars: ["🧑‍🚀", "👸", "🤖", "🧸", "🐱", "🐶", "🦊", "🦁"],
    users: [], 

    /**
     * Hàm khởi tạo component
     */
    init: function() {
        this.fetchUsers();
    },

    /**
     * Hàm lấy danh sách User từ Supabase
     */
    fetchUsers: async function() {
        try {
            const supabase = window.supabase;
            if (!supabase) {
                console.warn("AuthComponent: Đang chờ Supabase client...");
                // Thử lại sau 500ms nếu chưa thấy supabase
                setTimeout(() => this.fetchUsers(), 500);
                return;
            }

            // Đã loại bỏ .order('created_at') vì bảng của bạn không có cột này
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .limit(4);

            if (error) throw error;
            
            this.users = data || [];
            console.log("Danh sách User đã tải:", this.users);
            this.displayLoginMenu();
        } catch (err) {
            console.error("Lỗi fetchUsers:", err.message);
            // Hiển thị menu trống nếu lỗi để người dùng vẫn có thể ấn "Thêm mới"
            this.displayLoginMenu();
        }
    },

    /**
     * Hàm hiển thị giao diện Login/Menu chính
     */
    displayLoginMenu: function(containerId) {
        this.containerId = containerId || this.containerId;
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Reset trạng thái chọn khi quay lại menu
        this.selectedUserId = null;

        let htmlContent = `
            <div id="login-menu" class="flex flex-col items-center justify-center w-full h-full animate-fade-in p-4">
                <h2 class="text-3xl font-bold text-blue-600 mb-8 tracking-wide uppercase text-center">Ai sẽ chơi hôm nay nhỉ?</h2>
                
                <div class="flex items-center gap-6 mb-12 overflow-x-auto py-4 px-2 no-scrollbar w-full justify-center">
                    ${this.users.map(user => `
                        <div id="user-card-${user.id}" 
                             class="user-card group cursor-pointer flex flex-col items-center transition-all duration-300 hover:scale-105" 
                             onclick="AuthComponent.selectUser('${user.id}')">
                            <div class="avatar-box w-24 h-24 bg-blue-50 border-4 border-blue-200 rounded-3xl flex items-center justify-center text-5xl group-hover:border-blue-500 transition-all shadow-sm">
                                ${user.avatar_key || '👤'}
                            </div>
                            <span class="mt-3 font-bold text-gray-700 group-hover:text-blue-600">${user.display_name}</span>
                        </div>
                    `).join('')}

                    <!-- NÚT TẠO USER MỚI -->
                    <div class="group cursor-pointer flex flex-col items-center transition-all duration-300 hover:scale-105"
                         onclick="AuthComponent.displayCreateUserForm()">
                        <div class="w-24 h-24 bg-white border-4 border-dashed border-blue-300 rounded-3xl flex items-center justify-center text-5xl text-blue-300 group-hover:bg-blue-50 transition-all">
                            ➕
                        </div>
                        <span class="mt-3 font-bold text-blue-400 uppercase">Thêm mới</span>
                    </div>
                </div>

                <button id="btn-start" class="px-12 py-4 bg-gray-300 text-white text-3xl font-black rounded-full shadow-[0_10px_0_rgb(156,163,175)] cursor-not-allowed transition-all uppercase">
                    Bắt đầu
                </button>
            </div>
        `;

        container.innerHTML = htmlContent;

        const startBtn = document.getElementById('btn-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.selectedUserId) {
                    const userData = this.users.find(u => u.id == this.selectedUserId);
                    localStorage.setItem('game_user_id', this.selectedUserId);
                    console.log("Khởi động Game Engine với User:", userData.display_name);
                    
                    // Gọi sang GameEngine để bắt đầu trò chơi
                    if (window.GameEngine) {
                        GameEngine.start(userData);
                    }
                }
            });
        }
    },

    /**
     * Hiển thị Form tạo User mới
     */
    displayCreateUserForm: function() {
        const container = document.getElementById(this.containerId);
        this.tempAvatar = this.availableAvatars[0];

        let htmlContent = `
            <div id="create-user-form" class="flex flex-col items-center justify-center w-full h-full animate-fade-in p-4">
                <h2 class="text-3xl font-bold text-blue-600 mb-6 uppercase">Tạo nhân vật mới</h2>
                <div class="bg-blue-50 p-8 rounded-3xl border-4 border-blue-200 w-full max-w-md shadow-inner">
                    <input type="text" id="input-username" placeholder="Tên của bé..." 
                           class="w-full px-6 py-4 rounded-2xl border-2 border-blue-200 focus:border-blue-500 outline-none text-xl font-bold text-blue-700 mb-6 shadow-sm">
                    
                    <div class="grid grid-cols-4 gap-3 mb-8">
                        ${this.availableAvatars.map((emoji, index) => `
                            <div onclick="document.querySelectorAll('.avatar-opt').forEach(el=>el.classList.remove('border-blue-500','bg-white')); this.classList.add('border-blue-500','bg-white'); AuthComponent.tempAvatar='${emoji}'" 
                                 class="avatar-opt cursor-pointer p-2 border-2 border-transparent rounded-xl text-4xl flex items-center justify-center hover:bg-white transition-all ${index === 0 ? 'border-blue-500 bg-white' : ''}">
                                ${emoji}
                            </div>
                        `).join('')}
                    </div>

                    <div class="flex gap-4">
                        <button onclick="AuthComponent.displayLoginMenu()" class="flex-1 py-3 bg-gray-200 text-gray-600 font-bold rounded-2xl uppercase">Hủy</button>
                        <button id="btn-confirm-save" onclick="AuthComponent.handleSaveUser()" class="flex-1 py-3 bg-blue-500 text-white font-bold rounded-2xl shadow-[0_5px_0_rgb(37,99,235)] uppercase text-lg">Xác nhận</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = htmlContent;
    },

    /**
     * Xử lý lưu User vào Supabase
     */
    handleSaveUser: async function() {
        const nameInput = document.getElementById('input-username');
        if (!nameInput) return;
        
        const name = nameInput.value.trim();
        const btnConfirm = document.getElementById('btn-confirm-save');

        if (!name) return;

        try {
            btnConfirm.disabled = true;
            btnConfirm.innerText = "Đang lưu...";

            const { data, error } = await window.supabase
                .from('profiles')
                .insert([{ 
                    display_name: name, 
                    avatar_key: this.tempAvatar,
                    level: 1,
                    exp: 0,
                    hp_current: 100
                }])
                .select();

            if (error) throw error;
            
            console.log("Lưu thành công, đang tải lại danh sách...");
            // Đợi một chút để DB ổn định rồi load lại
            setTimeout(() => this.fetchUsers(), 300);
            
        } catch (err) {
            console.error("Lỗi Supabase:", err);
            alert(`Lỗi: ${err.message}`);
            if (btnConfirm) {
                btnConfirm.disabled = false;
                btnConfirm.innerText = "Xác nhận";
            }
        }
    },

    selectUser: function(userId) {
        document.querySelectorAll('.user-card').forEach(card => card.classList.remove('user-selected'));
        const selectedCard = document.getElementById(`user-card-${userId}`);
        if (selectedCard) {
            selectedCard.classList.add('user-selected');
            this.selectedUserId = userId;
            const btnStart = document.getElementById('btn-start');
            if (btnStart) {
                btnStart.classList.replace('bg-gray-300', 'bg-yellow-400');
                btnStart.classList.remove('cursor-not-allowed');
                btnStart.classList.add('shadow-[0_10px_0_rgb(202,138,4)]');
            }
        }
    }
};

// Đăng ký component vào window
window.AuthComponent = AuthComponent;

// Tự động khởi chạy khi load trang
window.addEventListener('load', () => {
    AuthComponent.init();
});