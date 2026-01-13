// src/js/auth/auth_component.js
import { AuthState } from './auth_state.js';
import { AuthUI } from './auth_ui.js';
import { UserService } from './user_service.js';
import { HeroService } from './hero_service.js';

/**
 * Component xử lý giao diện chọn User đầu game
 * Kết nối trực tiếp với Supabase qua biến toàn cục window.supabase
 */
class AuthComponent {
    constructor() {
        this.state = new AuthState();
        this.ui = new AuthUI(this.state.containerId);
        this.userService = null;
        this.heroService = null;
    }

    /**
     * Khởi tạo component
     */
    init() {
        // Đợi Supabase client sẵn sàng
        if (!window.supabase) {
            console.warn("AuthComponent: Đang chờ Supabase client...");
            setTimeout(() => this.init(), 500);
            return;
        }

        // Khởi tạo services
        this.userService = new UserService(window.supabase);
        this.heroService = new HeroService(window.supabase);

        // Load users và hiển thị menu
        this.fetchUsers();
    }

    /**
     * Lấy danh sách users
     */
    async fetchUsers() {
        try {
            const users = await this.userService.fetchUsers();
            this.state.setUsers(users);
            console.log("Danh sách User đã tải:", users);
            this.displayLoginMenu();
        } catch (err) {
            console.error("Lỗi fetchUsers:", err.message);
        }
    }

    /**
     * Hiển thị menu login
     */
    displayLoginMenu() {
        this.state.reset();
        this.ui.displayLoginMenu(this.state.getUsers());
    }

    /**
     * Chọn user
     */
    selectUser(userId) {
        this.ui.highlightSelectedUser(userId);
        this.state.setSelectedUserId(userId);
        
        // Kiểm tra xem profile này có game đã lưu không
        const savedGame = this.state.checkSavedGame(userId);
        if (savedGame) {
            // Profile này có game đã lưu → Hiện menu Continue/New
            this.displayContinueOrNewMenu(savedGame);
        } else {
            // Profile này chưa có game → Hiện vùng chọn Hero
            this.ui.showHeroSelectionArea();
            this.loadHeroList();
        }
    }

    /**
     * Hiển thị menu Continue hoặc New Game
     */
    displayContinueOrNewMenu(savedGame) {
        this.ui.displayContinueOrNewMenu(savedGame);
    }

    /**
     * Continue game đã lưu
     */
    continueGame() {
        const savedGame = this.state.checkSavedGame(this.state.getSelectedUserId());
        if (!savedGame) {
            alert('Không tìm thấy game đã lưu!');
            this.displayLoginMenu();
            return;
        }
        if (window.GameEngine) {
            window.GameEngine.restoreGameState(savedGame);
        }
    }

    /**
     * Bắt đầu game mới (xóa save cũ)
     */
    startNewGame() {
        this.state.clearSavedGame(this.state.getSelectedUserId());
        this.displayLoginMenu();
    }

    /**
     * Hiển thị form tạo user
     */
    displayCreateUserForm() {
        const avatars = this.state.getAvailableAvatars();
        this.state.setTempAvatar(avatars[0]);
        this.ui.displayCreateUserForm(avatars);
    }

    /**
     * Chọn avatar khi tạo user
     */
    selectAvatar(emoji) {
        this.state.setTempAvatar(emoji);
    }

    /**
     * Xử lý lưu user mới
     */
    async handleSaveUser() {
        const nameInput = document.getElementById('input-username');
        if (!nameInput) return;
        
        const name = nameInput.value.trim();
        if (!name) {
            alert('Vui lòng nhập tên!');
            return;
        }

        this.ui.updateButtonState('btn-confirm-save', 'Đang lưu...', true);

        try {
            await this.userService.createUser(name, this.state.tempAvatar);
            console.log("Lưu thành công, đang tải lại danh sách...");
            
            // Đợi một chút để DB ổn định rồi load lại
            setTimeout(() => this.fetchUsers(), 300);
            
        } catch (err) {
            console.error("Lỗi handleSaveUser:", err);
            alert(`Lỗi: ${err.message}`);
            this.ui.updateButtonState('btn-confirm-save', 'Xác nhận', false);
        }
    }

    /**
     * Load danh sách heroes
     */
    async loadHeroList() {
        this.ui.showHeroListLoading();

        try {
            const heroes = await this.heroService.fetchHeroes();
            this.ui.displayHeroList(heroes);
        } catch (err) {
            console.error("Lỗi loadHeroList:", err);
            const heroListContainer = document.getElementById('hero-list');
            if (heroListContainer) {
                heroListContainer.innerHTML = "<p class='text-red-500 text-xs'>Lỗi tải Hero</p>";
            }
        }
    }

    /**
     * Chọn hero
     */
    async pickHero(heroId) {
        // Kiểm tra hero có bị khóa không
        const isLocked = await this.heroService.isHeroLocked(heroId);
        if (isLocked) {
            alert('Hero này đang bị khóa! Hãy hoàn thành nhiệm vụ để mở khóa.');
            return;
        }

        this.ui.highlightSelectedHero(heroId);
        this.state.setSelectedHeroId(heroId);
        this.ui.enableStartButton();
    }

    /**
     * Bắt đầu game
     */
    async startGame() {
        // Kiểm tra xem đã chọn đầy đủ chưa
        if (!this.state.getSelectedUserId() || !this.state.getSelectedHeroId()) {
            alert("Vui lòng chọn cả nhân vật và hiệp sĩ!");
            return;
        }

        // Phát âm thanh intro
        try {
            const introSound = new Audio('https://xiaomi86pro.github.io/EnglishAdventure/sounds/StartGame.mp3');
            introSound.currentTime = 0;
            introSound.play().catch(e => console.log('Không thể phát âm thanh:', e));
        } catch (e) {
            console.log('Lỗi audio:', e);
        }

        this.ui.updateButtonState('btn-start', 'Đang chuẩn bị...', true);

        try {
            // 1. Lưu selected_hero_id vào profiles
            await this.userService.updateSelectedHero(
                this.state.getSelectedUserId(), 
                this.state.getSelectedHeroId()
            );

            // 2. Lấy thông tin đầy đủ user kèm hero
            const userData = await this.userService.getUserWithHero(this.state.getSelectedUserId());
            userData.selected_hero_id = this.state.getSelectedHeroId();

            // 3. Khởi động GameEngine
            if (window.GameEngine) {
                window.GameEngine.start(userData);
            } else {
                throw new Error('GameEngine chưa sẵn sàng');
            }

        } catch (err) {
            console.error("Lỗi startGame:", err);
            alert(`Lỗi: ${err.message}`);
            this.ui.updateButtonState('btn-start', 'Vào Trận!', false);
        }
    }
}

// Tạo instance và expose ra window
const authComponent = new AuthComponent();
window.AuthComponent = authComponent;

export default authComponent;